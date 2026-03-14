import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Game, Collection, Tag } from '../../models/game.model';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class DatabaseService {
  private api = environment.apiBaseUrl;

  constructor(private http: HttpClient) {}

  // ---- Games ----

  async addGame(game: Omit<Game, 'id'>): Promise<number> {
    const body: any = {
      pgn: game.pgn,
      white: game.white,
      black: game.black,
      date: game.date,
      result: game.result,
      event: game.event,
      site: game.site || '',
      eco: game.eco,
      source: game.source,
      collection_id: game.collection_id || null,
      pgn_headers: game.tags || {},
      analysis_json: game.analysis_json || null,
      notes: game.notes || '',
      is_favorite: game.is_favorite || false,
    };
    const created = await firstValueFrom(
      this.http.post<Game>(`${this.api}/games/`, body)
    );
    return created.id!;
  }

  async getGame(id: number): Promise<Game | undefined> {
    try {
      return await firstValueFrom(
        this.http.get<Game>(`${this.api}/games/${id}`)
      );
    } catch {
      return undefined;
    }
  }

  async getAllGames(): Promise<Game[]> {
    return firstValueFrom(
      this.http.get<Game[]>(`${this.api}/games/`, { params: { page_size: '1000' } })
    );
  }

  async getGames(params: {
    collection_id?: number;
    query?: string;
    result?: string;
    eco?: string;
    is_favorite?: boolean;
    tag_id?: number;
    page?: number;
    page_size?: number;
  } = {}): Promise<Game[]> {
    let httpParams = new HttpParams();
    if (params.collection_id != null) httpParams = httpParams.set('collection_id', params.collection_id);
    if (params.query) httpParams = httpParams.set('query', params.query);
    if (params.result) httpParams = httpParams.set('result', params.result);
    if (params.eco) httpParams = httpParams.set('eco', params.eco);
    if (params.is_favorite != null) httpParams = httpParams.set('is_favorite', params.is_favorite);
    if (params.tag_id != null) httpParams = httpParams.set('tag_id', params.tag_id);
    if (params.page) httpParams = httpParams.set('page', params.page);
    if (params.page_size) httpParams = httpParams.set('page_size', params.page_size);

    return firstValueFrom(
      this.http.get<Game[]>(`${this.api}/games/`, { params: httpParams })
    );
  }

  async updateGame(id: number, data: Partial<Game>): Promise<number> {
    await firstValueFrom(
      this.http.put<Game>(`${this.api}/games/${id}`, data)
    );
    return 1;
  }

  async deleteGame(id: number): Promise<void> {
    await firstValueFrom(
      this.http.delete(`${this.api}/games/${id}`)
    );
  }

  async searchGames(query: string): Promise<Game[]> {
    return this.getGames({ query, page_size: 100 });
  }

  async getGameCount(): Promise<number> {
    const games = await firstValueFrom(
      this.http.get<Game[]>(`${this.api}/games/`, { params: { page_size: '1' } })
    );
    // For count we do a minimal fetch; the backend could add a count endpoint later
    return (await this.getAllGames()).length;
  }

  async toggleFavorite(id: number): Promise<Game> {
    return firstValueFrom(
      this.http.put<Game>(`${this.api}/games/${id}/favorite`, {})
    );
  }

  async importGames(games: Omit<Game, 'id'>[], collectionName?: string): Promise<number> {
    const body = {
      games: games.map(g => ({
        pgn: g.pgn,
        white: g.white,
        black: g.black,
        date: g.date,
        result: g.result,
        event: g.event,
        site: g.site || '',
        eco: g.eco,
        source: g.source,
        pgn_headers: g.tags || {},
      })),
      collection_name: collectionName || null,
      collection_type: 'import',
    };
    const created = await firstValueFrom(
      this.http.post<Game[]>(`${this.api}/games/import`, body)
    );
    return created.length;
  }

  async exportAll(): Promise<string> {
    const games = await firstValueFrom(
      this.http.get<Game[]>(`${this.api}/games/export/json`)
    );
    return JSON.stringify({ games }, null, 2);
  }

  async importAll(json: string, merge = true): Promise<void> {
    const data = JSON.parse(json);
    if (data.games) {
      for (const game of data.games) {
        delete game.id;
        await this.addGame(game);
      }
    }
  }

  async clearAll(): Promise<void> {
    // Not supported in multi-user — could add a backend endpoint if needed
    console.warn('clearAll is not supported in server mode');
  }

  // ---- Collections ----

  async getCollections(): Promise<Collection[]> {
    return firstValueFrom(
      this.http.get<Collection[]>(`${this.api}/collections/`)
    );
  }

  async getCollection(id: number): Promise<Collection> {
    return firstValueFrom(
      this.http.get<Collection>(`${this.api}/collections/${id}`)
    );
  }

  async createCollection(data: { name: string; description?: string; type?: string; icon?: string; color?: string }): Promise<Collection> {
    return firstValueFrom(
      this.http.post<Collection>(`${this.api}/collections/`, data)
    );
  }

  async updateCollection(id: number, data: Partial<Collection>): Promise<Collection> {
    return firstValueFrom(
      this.http.put<Collection>(`${this.api}/collections/${id}`, data)
    );
  }

  async deleteCollection(id: number): Promise<void> {
    await firstValueFrom(
      this.http.delete(`${this.api}/collections/${id}`)
    );
  }

  /** Find the AI games collection for the current user */
  async getAiGamesCollectionId(): Promise<number | null> {
    const collections = await this.getCollections();
    const aiColl = collections.find(c => c.type === 'ai-games');
    return aiColl?.id || null;
  }

  // ---- Tags ----

  async getTags(): Promise<Tag[]> {
    return firstValueFrom(
      this.http.get<Tag[]>(`${this.api}/tags/`)
    );
  }

  async createTag(name: string, color: string = '#666666'): Promise<Tag> {
    return firstValueFrom(
      this.http.post<Tag>(`${this.api}/tags/`, { name, color })
    );
  }

  async deleteTag(id: number): Promise<void> {
    await firstValueFrom(
      this.http.delete(`${this.api}/tags/${id}`)
    );
  }

  async addTagToGame(gameId: number, tagId: number): Promise<void> {
    await firstValueFrom(
      this.http.post(`${this.api}/games/${gameId}/tags/${tagId}`, {})
    );
  }

  async removeTagFromGame(gameId: number, tagId: number): Promise<void> {
    await firstValueFrom(
      this.http.delete(`${this.api}/games/${gameId}/tags/${tagId}`)
    );
  }

  // ---- Settings ----

  async getSetting<T>(key: string): Promise<T | undefined> {
    try {
      const result = await firstValueFrom(
        this.http.get<{ key: string; value: T }>(`${this.api}/settings/${key}`)
      );
      return result.value;
    } catch {
      return undefined;
    }
  }

  async setSetting(key: string, value: any): Promise<void> {
    await firstValueFrom(
      this.http.put(`${this.api}/settings/${key}`, { value })
    );
  }
}
