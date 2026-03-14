import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Chess } from 'chess.js';
import { DatabaseService } from '../../core/services/database.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="settings-container">
      <h1>Settings</h1>

      <div class="card setting-section">
        <h3>Mi cuenta</h3>
        <p class="info">
          Usuario: <strong>{{ auth.user?.username }}</strong><br>
          Email: {{ auth.user?.email }}
        </p>
        <button class="btn btn-danger" (click)="auth.logout()">Cerrar sesión</button>
      </div>

      <div class="card setting-section">
        <h3>Database</h3>
        <div class="actions">
          <button class="btn btn-secondary" (click)="exportDb()">Export Database</button>
          <label class="btn btn-secondary">
            Import Database
            <input type="file" accept=".json" (change)="importDb($event)" hidden>
          </label>
        </div>
      </div>

      <div class="card setting-section">
        <h3>PGN Import</h3>
        <div class="pgn-import">
          <textarea [(ngModel)]="pgnText" placeholder="Paste PGN here..." rows="8"></textarea>
          <button class="btn btn-primary" (click)="importPgn()" [disabled]="!pgnText.trim()">
            Import PGN
          </button>
          <label class="btn btn-secondary">
            Import .pgn File
            <input type="file" accept=".pgn" (change)="importPgnFile($event)" hidden>
          </label>
        </div>
        <p *ngIf="importStatus" class="status">{{ importStatus }}</p>
      </div>

      <div class="card setting-section">
        <h3>About</h3>
        <p>Chess Trainer - Multi-user chess training application</p>
        <p class="info">Built with Angular, Chessground, chess.js, Stockfish WASM, FastAPI &amp; PostgreSQL</p>
      </div>
    </div>
  `,
  styles: [`
    .settings-container {
      padding: 24px;
      max-width: 700px;
      margin: 0 auto;
    }
    h1 {
      color: #e0e0e0;
      margin-bottom: 24px;
    }
    .setting-section {
      margin-bottom: 16px;
    }
    h3 {
      color: #e0e0e0;
      margin-bottom: 12px;
    }
    .info { color: #8a8886; font-size: 0.9em; margin-bottom: 8px; }
    .info strong { color: #e0e0e0; }
    .actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .pgn-import {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    textarea {
      font-family: 'Roboto Mono', monospace;
      font-size: 0.85em;
      background: #161512;
      color: #bababa;
      border: 1px solid #3d3a37;
      border-radius: 4px;
      padding: 10px;
      resize: vertical;
    }
    textarea:focus { border-color: #bf811d; outline: none; }
    .status { color: #629924; margin-top: 8px; font-size: 0.9em; }
  `],
})
export class SettingsComponent {
  pgnText = '';
  importStatus = '';

  constructor(
    private db: DatabaseService,
    public auth: AuthService,
  ) {}

  async exportDb(): Promise<void> {
    const json = await this.db.exportAll();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chess-trainer-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async importDb(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const text = await input.files[0].text();
    await this.db.importAll(text);
    this.importStatus = 'Database imported successfully!';
  }

  async importPgn(): Promise<void> {
    if (!this.pgnText.trim()) return;
    const games = this.parsePgnText(this.pgnText);
    const count = await this.db.importGames(games);
    this.importStatus = `Imported ${count} game(s)!`;
    this.pgnText = '';
  }

  async importPgnFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    const text = await file.text();
    const games = this.parsePgnText(text);
    const count = await this.db.importGames(games, file.name.replace(/\.pgn$/i, ''));
    this.importStatus = `Imported ${count} game(s) from file!`;
  }

  private parsePgnText(text: string): any[] {
    const games: any[] = [];
    const sections = text.split(/\n\n(?=\[)/);
    for (const section of sections) {
      const trimmed = section.trim();
      if (!trimmed) continue;
      try {
        const chess = new Chess();
        chess.loadPgn(trimmed);
        const rawHeaders = chess.header();
        const headers: Record<string, string> = {};
        for (const [k, v] of Object.entries(rawHeaders)) {
          if (v != null) headers[k] = v;
        }
        games.push({
          pgn: chess.pgn(),
          white: headers['White'] || 'Unknown',
          black: headers['Black'] || 'Unknown',
          date: headers['Date'] || new Date().toISOString().split('T')[0],
          result: headers['Result'] || '*',
          event: headers['Event'] || '',
          site: headers['Site'] || '',
          eco: headers['ECO'] || '',
          tags: headers,
          source: 'import' as const,
          created_at: new Date(),
        });
      } catch {}
    }
    return games;
  }
}
