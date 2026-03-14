import { Injectable } from '@angular/core';
import { Chess } from 'chess.js';
import { Game } from '../../models/game.model';

@Injectable({ providedIn: 'root' })
export class PgnService {

  parsePgn(text: string): Game[] {
    const games: Game[] = [];
    // Split multi-game PGN by empty line followed by move text or headers
    const sections = text.split(/\n\n(?=\[)/);

    for (const section of sections) {
      const trimmed = section.trim();
      if (!trimmed) continue;

      try {
        const game = this.parseSinglePgn(trimmed);
        if (game) games.push(game);
      } catch (e) {
        console.warn('Failed to parse PGN section:', e);
      }
    }

    // If splitting by headers didn't work, try as single game
    if (games.length === 0 && text.trim()) {
      try {
        const game = this.parseSinglePgn(text.trim());
        if (game) games.push(game);
      } catch (e) {
        console.warn('Failed to parse PGN:', e);
      }
    }

    return games;
  }

  private parseSinglePgn(pgnText: string): Game | null {
    const chess = new Chess();
    try {
      chess.loadPgn(pgnText);
    } catch {
      return null;
    }

    const rawHeaders = chess.header();
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(rawHeaders)) {
      if (v != null) headers[k] = v;
    }

    return {
      pgn: chess.pgn(),
      white: headers['White'] || 'Unknown',
      black: headers['Black'] || 'Unknown',
      date: headers['Date'] || new Date().toISOString().split('T')[0],
      result: headers['Result'] || '*',
      event: headers['Event'] || '',
      site: headers['Site'] || '',
      eco: headers['ECO'] || '',
      fen: headers['FEN'] || undefined,
      tags: headers,
      source: 'import',
      created_at: new Date(),
    };
  }

  exportPgn(game: Game): string {
    const headers = [
      `[Event "${game.event || '?'}"]`,
      `[Site "${game.site || '?'}"]`,
      `[Date "${game.date || '?'}"]`,
      `[White "${game.white || '?'}"]`,
      `[Black "${game.black || '?'}"]`,
      `[Result "${game.result || '*'}"]`,
    ];

    if (game.eco) headers.push(`[ECO "${game.eco}"]`);
    if (game.fen) headers.push(`[FEN "${game.fen}"]`);

    return headers.join('\n') + '\n\n' + game.pgn + (game.result !== '*' ? ' ' + game.result : '');
  }

  async importFile(file: File): Promise<Game[]> {
    const text = await file.text();
    return this.parsePgn(text);
  }
}
