import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface LichessImportResult {
  collection_id: number;
  collection_name: string;
  imported: number;
}

@Injectable({ providedIn: 'root' })
export class LichessApiService {
  private api = environment.apiBaseUrl;

  constructor(private http: HttpClient) {}

  /**
   * Fetches games for a Lichess user via the backend proxy.
   * The backend saves games to the DB and creates a collection automatically.
   */
  async fetchUserGames(
    username: string,
    max: number = 50,
  ): Promise<LichessImportResult> {
    return firstValueFrom(
      this.http.get<LichessImportResult>(
        `${this.api}/lichess/games/${encodeURIComponent(username)}`,
        { params: { max: String(max) } },
      )
    );
  }
}
