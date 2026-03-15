import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Chess } from 'chess.js';
import { DatabaseService } from '../../core/services/database.service';
import { AuthService } from '../../core/services/auth.service';
import { TranslationService } from '../../core/services/translation.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  template: `
    <div class="settings-container">
      <h1>{{ 'settings.title' | translate }}</h1>

      <div class="card setting-section">
        <h3>{{ 'settings.language' | translate }}</h3>
        <div class="lang-buttons">
          <button class="lang-btn" [class.active]="i18n.language === 'en'"
                  (click)="switchLang('en')">English</button>
          <button class="lang-btn" [class.active]="i18n.language === 'es'"
                  (click)="switchLang('es')">Español</button>
        </div>
      </div>

      <div class="card setting-section">
        <h3>{{ 'settings.account' | translate }}</h3>
        <p class="info">
          {{ 'settings.user' | translate }}: <strong>{{ auth.user?.username }}</strong><br>
          {{ 'auth.email' | translate }}: {{ auth.user?.email }}
        </p>
        <button class="btn btn-danger" (click)="auth.logout()">{{ 'settings.logout' | translate }}</button>
      </div>

      <div class="card setting-section">
        <h3>{{ 'settings.database' | translate }}</h3>
        <div class="actions">
          <button class="btn btn-secondary" (click)="exportDb()">{{ 'settings.exportDb' | translate }}</button>
          <label class="btn btn-secondary">
            {{ 'settings.importDb' | translate }}
            <input type="file" accept=".json" (change)="importDb($event)" hidden>
          </label>
        </div>
      </div>

      <div class="card setting-section">
        <h3>{{ 'settings.pgnImport' | translate }}</h3>
        <div class="pgn-import">
          <textarea [(ngModel)]="pgnText" [placeholder]="'settings.pastePgn' | translate" rows="8"></textarea>
          <button class="btn btn-primary" (click)="importPgn()" [disabled]="!pgnText.trim()">
            {{ 'settings.importPgn' | translate }}
          </button>
          <label class="btn btn-secondary">
            {{ 'settings.importPgnFile' | translate }}
            <input type="file" accept=".pgn" (change)="importPgnFile($event)" hidden>
          </label>
        </div>
        <p *ngIf="importStatus" class="status">{{ importStatus }}</p>
      </div>

      <div class="card setting-section">
        <h3>{{ 'settings.about' | translate }}</h3>
        <p>{{ 'settings.aboutDesc' | translate }}</p>
        <p class="info">{{ 'settings.aboutTech' | translate }}</p>
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
    .lang-buttons { display: flex; gap: 8px; }
    .lang-btn {
      padding: 8px 20px;
      background: #302e2c;
      border: 2px solid transparent;
      border-radius: 4px;
      color: #bababa;
      cursor: pointer;
      font-size: 0.95em;
    }
    .lang-btn:hover { background: #3d3a37; }
    .lang-btn.active { border-color: #bf811d; background: #3d3a37; color: #e0e0e0; }
  `],
})
export class SettingsComponent {
  pgnText = '';
  importStatus = '';

  constructor(
    private db: DatabaseService,
    public auth: AuthService,
    public i18n: TranslationService,
  ) {}

  async switchLang(lang: string): Promise<void> {
    await this.i18n.setLanguage(lang);
  }

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
    this.importStatus = this.i18n.t('settings.dbImported');
  }

  async importPgn(): Promise<void> {
    if (!this.pgnText.trim()) return;
    const games = this.parsePgnText(this.pgnText);
    const count = await this.db.importGames(games);
    this.importStatus = this.i18n.t('settings.gamesImported', { count });
    this.pgnText = '';
  }

  async importPgnFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    const text = await file.text();
    const games = this.parsePgnText(text);
    const count = await this.db.importGames(games, file.name.replace(/\.pgn$/i, ''));
    this.importStatus = this.i18n.t('settings.gamesImportedFile', { count });
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
