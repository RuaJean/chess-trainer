import { Injectable } from '@angular/core';
import { Game } from '../../models/game.model';
import { DatabaseService } from './database.service';
import { OpeningService } from './opening.service';
import { Chess } from 'chess.js';

export interface LichessImportResult {
  collection_id: number;
  collection_name: string;
  imported: number;
  skipped_duplicates: number;
}

interface LichessGame {
  id: string;
  rated: boolean;
  variant: string;
  speed: string;
  perf: string;
  status: string;
  players: {
    white: { user?: { name: string; id: string }; rating?: number; aiLevel?: number };
    black: { user?: { name: string; id: string }; rating?: number; aiLevel?: number };
  };
  winner?: 'white' | 'black';
  opening?: { eco: string; name: string; ply: number };
  pgn?: string;
  moves?: string;
  clock?: { initial: number; increment: number; totalTime: number };
  createdAt?: number;
  lastMoveAt?: number;
}

@Injectable({ providedIn: 'root' })
export class LichessApiService {

  constructor(
    private db: DatabaseService,
    private openingService: OpeningService,
  ) {}

  /**
   * Fetches games for a Lichess user directly from Lichess API (NDJSON stream).
   * Deduplicates by site URL, reuses existing collection, reports progress.
   */
  async fetchUserGames(
    username: string,
    max: number = 50,
    perfType?: string,
    onProgress?: (received: number, total: number) => void,
    token?: string,
  ): Promise<LichessImportResult> {
    // Build URL — direct to Lichess (CORS OK from localhost)
    // Don't use perfType in URL (Lichess API returns incomplete results with it).
    // Instead fetch more games and filter client-side by speed.
    const encodedUser = encodeURIComponent(username);
    const fetchMax = perfType ? max * 10 : max; // overfetch when filtering by speed
    const url = `https://lichess.org/api/games/user/${encodedUser}?max=${fetchMax}&opening=true&pgnInJson=true`;

    const headers: Record<string, string> = { 'Accept': 'application/x-ndjson' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await this.fetchWithRetry(url, { headers });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Lichess user "${username}" not found.`);
      }
      if (response.status === 429) {
        throw new Error('Lichess rate limit reached. Please wait a minute and try again.');
      }
      throw new Error(`Lichess API error: ${response.status} ${response.statusText}`);
    }

    // Read NDJSON stream line by line for progress reporting
    let lichessGames = await this.readNdjsonStream(response, perfType ? fetchMax : max, onProgress);

    // Client-side speed filter (more reliable than perfType param)
    if (perfType) {
      lichessGames = lichessGames
        .filter(g => g.speed === perfType || g.perf === perfType)
        .slice(0, max);
    }

    onProgress?.(lichessGames.length, max);

    // Find or create collection — match both "username" and legacy "Lichess - username"
    const collections = await this.db.getCollections();
    let collection = collections.find(c =>
      c.type === 'lichess' && (c.name === username || c.name === `Lichess - ${username}`)
    );
    if (collection && collection.name !== username) {
      // Rename legacy collection to just the username
      collection = await this.db.updateCollection(collection.id, { name: username });
    }
    if (!collection) {
      collection = await this.db.createCollection({
        name: username,
        type: 'lichess',
      });
    }

    // Deduplicate: load existing game sites from this collection (paginated, max 100 per page)
    const existingGames = await this.db.getAllGamesPaginated(collection.id);
    const existingSites = new Set(existingGames.map(g => g.site).filter(Boolean));

    const allMapped: Omit<Game, 'id'>[] = lichessGames.map(lg => this.mapLichessGame(lg));
    const newGames = allMapped.filter(g => !existingSites.has(g.site));
    const skipped = allMapped.length - newGames.length;

    // Import games one by one with collection_id (bulk import ignores collection_id)
    let imported = 0;
    for (const game of newGames) {
      try {
        await this.db.addGame({ ...game, collection_id: collection.id });
        imported++;
      } catch {
        // Skip games that fail to insert
      }
    }

    // Save last import timestamp in source_info for future incremental imports
    await this.db.updateCollection(collection.id, {
      source_info: {
        ...collection.source_info,
        lastImportTimestamp: Date.now(),
        username,
      },
    });

    return {
      collection_id: collection.id,
      collection_name: collection.name,
      imported,
      skipped_duplicates: skipped,
    };
  }

  private async readNdjsonStream(
    response: Response,
    total: number,
    onProgress?: (received: number, total: number) => void,
  ): Promise<LichessGame[]> {
    const games: LichessGame[] = [];
    const reader = response.body?.getReader();

    if (!reader) {
      // Fallback: read all at once
      const text = await response.text();
      const lines = text.split('\n').filter(line => line.trim().length > 0);
      return lines.map(line => JSON.parse(line));
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      // Keep the last (potentially incomplete) line in the buffer
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.length === 0) continue;
        try {
          games.push(JSON.parse(trimmed));
          onProgress?.(games.length, total);
        } catch {
          // Skip malformed lines
        }
      }
    }

    // Process any remaining data in buffer
    if (buffer.trim().length > 0) {
      try {
        games.push(JSON.parse(buffer.trim()));
        onProgress?.(games.length, total);
      } catch {
        // Skip malformed
      }
    }

    return games;
  }

  private mapLichessGame(lg: LichessGame): Omit<Game, 'id'> {
    const whiteName = lg.players.white.user?.name || `AI Level ${lg.players.white.aiLevel || '?'}`;
    const blackName = lg.players.black.user?.name || `AI Level ${lg.players.black.aiLevel || '?'}`;

    let result = '1/2-1/2';
    if (lg.winner === 'white') result = '1-0';
    else if (lg.winner === 'black') result = '0-1';
    else if (lg.status === 'draw' || lg.status === 'stalemate') result = '1/2-1/2';
    else if (!lg.winner && (lg.status === 'timeout' || lg.status === 'resign' || lg.status === 'outoftime')) {
      result = '*';
    }

    let eco = lg.opening?.eco || '';
    let openingName = lg.opening?.name || '';

    // Fallback: detect opening from moves if Lichess didn't provide it
    if (!eco && lg.pgn) {
      const detected = this.detectOpeningFromPgn(lg.pgn);
      if (detected) {
        eco = detected.eco;
        openingName = detected.name;
      }
    }

    const date = lg.createdAt
      ? new Date(lg.createdAt).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

    return {
      pgn: lg.pgn || '',
      white: whiteName,
      black: blackName,
      white_elo: lg.players.white.rating || null,
      black_elo: lg.players.black.rating || null,
      date,
      result,
      event: `Lichess ${lg.speed || lg.perf || 'game'}`,
      site: `https://lichess.org/${lg.id}`,
      eco,
      opening_name: openingName,
      tags: {},
      source: 'lichess',
    };
  }

  private detectOpeningFromPgn(pgn: string): { eco: string; name: string } | null {
    try {
      const chess = new Chess();
      chess.loadPgn(pgn);
      const history = chess.history();
      return this.openingService.detectOpening(history);
    } catch {
      return null;
    }
  }

  /** Fetch with retry on 429 (rate limit) — up to 3 attempts with exponential backoff */
  private async fetchWithRetry(url: string, init: RequestInit, maxRetries = 3): Promise<Response> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const response = await fetch(url, init);
      if (response.status === 429 && attempt < maxRetries - 1) {
        const waitMs = (attempt + 1) * 5000; // 5s, 10s, 15s
        await new Promise(resolve => setTimeout(resolve, waitMs));
        continue;
      }
      return response;
    }
    throw new Error('Lichess rate limit — max retries exceeded.');
  }
}
