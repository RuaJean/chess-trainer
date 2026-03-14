import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DatabaseService } from '../../core/services/database.service';
import { PgnService } from '../../core/services/pgn.service';
import { LichessApiService, LichessImportResult } from '../../core/services/lichess-api.service';
import { Game, Collection } from '../../models/game.model';

@Component({
  selector: 'app-games-library',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="library-container">
      <div class="library-header">
        <h1>Game Library</h1>
        <div class="header-actions">
          <label class="btn btn-secondary">
            Import PGN
            <input type="file" accept=".pgn" (change)="importPgnFile($event)" hidden>
          </label>
          <button class="btn btn-secondary" (click)="showPgnPaste = !showPgnPaste">
            Paste PGN
          </button>
          <button class="btn btn-secondary" (click)="showLichessImport = !showLichessImport">
            Lichess Import
          </button>
          <button class="btn btn-secondary" (click)="showNewCollection = !showNewCollection">
            New Collection
          </button>
        </div>
      </div>

      <!-- Collections sidebar + games -->
      <div class="library-body">
        <div class="collections-panel">
          <div class="coll-item" [class.active]="selectedCollectionId === null"
               (click)="selectCollection(null)">
            <span class="coll-icon">📋</span>
            <span class="coll-name">All Games</span>
            <span class="coll-count">{{ totalGameCount }}</span>
          </div>
          <div class="coll-item" *ngFor="let c of collections"
               [class.active]="selectedCollectionId === c.id"
               [class.pinned]="c.pinned"
               (click)="selectCollection(c.id)">
            <span class="coll-icon">{{ c.icon }}</span>
            <span class="coll-name">{{ c.name }}</span>
            <span class="coll-count">{{ c.game_count }}</span>
            <button class="coll-delete" (click)="$event.stopPropagation(); deleteCollection(c)"
                    *ngIf="c.type !== 'ai-games'" title="Delete">✕</button>
          </div>
        </div>

        <div class="games-panel">
          <div class="pgn-paste card" *ngIf="showPgnPaste">
            <textarea [(ngModel)]="pgnText" placeholder="Paste PGN here..." rows="6"></textarea>
            <div class="paste-actions">
              <button class="btn btn-primary" (click)="importPgnText()" [disabled]="!pgnText.trim()">
                Import
              </button>
              <button class="btn btn-secondary" (click)="showPgnPaste = false">Cancel</button>
            </div>
          </div>

          <div class="lichess-import card" *ngIf="showLichessImport">
            <h3>Import from Lichess</h3>
            <div class="lichess-form">
              <input type="text" [(ngModel)]="lichessUsername" placeholder="Lichess username..."
                     (keyup.enter)="fetchLichessGames()">
              <select [(ngModel)]="lichessMax">
                <option [value]="10">Last 10</option>
                <option [value]="25">Last 25</option>
                <option [value]="50">Last 50</option>
                <option [value]="100">Last 100</option>
              </select>
              <button class="btn btn-primary" (click)="fetchLichessGames()"
                      [disabled]="!lichessUsername.trim() || lichessLoading">
                {{ lichessLoading ? 'Fetching...' : 'Fetch & Import' }}
              </button>
              <button class="btn btn-secondary" (click)="showLichessImport = false">Cancel</button>
            </div>
            <p *ngIf="lichessError" class="error-msg">{{ lichessError }}</p>
          </div>

          <div class="new-collection card" *ngIf="showNewCollection">
            <h3>New Collection</h3>
            <div class="new-coll-form">
              <input type="text" [(ngModel)]="newCollName" placeholder="Collection name...">
              <input type="text" [(ngModel)]="newCollDesc" placeholder="Description (optional)">
              <button class="btn btn-primary" (click)="createCollection()"
                      [disabled]="!newCollName.trim()">Create</button>
              <button class="btn btn-secondary" (click)="showNewCollection = false">Cancel</button>
            </div>
          </div>

          <div class="filters card">
            <input type="text" [(ngModel)]="searchQuery" placeholder="Search player, event..."
                   (input)="loadGames()" class="search-input">
            <select [(ngModel)]="filterResult" (change)="loadGames()">
              <option value="">All results</option>
              <option value="1-0">White wins (1-0)</option>
              <option value="0-1">Black wins (0-1)</option>
              <option value="1/2-1/2">Draw (1/2-1/2)</option>
            </select>
            <span class="game-count">{{ filteredGames.length }} games</span>
          </div>

          <div class="games-list" *ngIf="filteredGames.length > 0">
            <div class="game-row card" *ngFor="let game of paginatedGames; trackBy: trackById"
                 (click)="openGame(game)">
              <div class="game-players">
                <span class="white-player">{{ game.white }}</span>
                <span class="result" [ngClass]="resultClass(game.result)">{{ game.result }}</span>
                <span class="black-player">{{ game.black }}</span>
              </div>
              <div class="game-meta">
                <span *ngIf="game.event" class="tag">{{ game.event }}</span>
                <span *ngIf="game.eco" class="tag eco">{{ game.eco }}</span>
                <span class="tag source">{{ game.source }}</span>
                <span *ngIf="game.is_favorite" class="tag fav">★</span>
                <span class="date">{{ game.date }}</span>
              </div>
              <div class="game-actions" (click)="$event.stopPropagation()">
                <button class="btn-icon" title="Favorite" (click)="toggleFavorite(game)">
                  {{ game.is_favorite ? '★' : '☆' }}
                </button>
                <button class="btn-icon" title="Analyze" (click)="analyzeGame(game)">🔍</button>
                <button class="btn-icon" title="Export PGN" (click)="exportGame(game)">📋</button>
                <button class="btn-icon delete" title="Delete" (click)="deleteGame(game)">✕</button>
              </div>
            </div>
          </div>

          <div class="empty-state card" *ngIf="filteredGames.length === 0 && !loading">
            <p>No games found.</p>
            <p class="hint">Play a game vs AI, import a PGN file, or fetch games from Lichess.</p>
          </div>

          <div class="pagination" *ngIf="totalPages > 1">
            <button class="btn btn-secondary" (click)="goToPage(currentPage - 1)" [disabled]="currentPage <= 1">
              Previous
            </button>
            <span class="page-info">Page {{ currentPage }} of {{ totalPages }}</span>
            <button class="btn btn-secondary" (click)="goToPage(currentPage + 1)" [disabled]="currentPage >= totalPages">
              Next
            </button>
          </div>

          <p class="status-msg" *ngIf="statusMsg">{{ statusMsg }}</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .library-container {
      padding: 24px;
      max-width: 1100px;
      margin: 0 auto;
    }
    .library-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }
    h1 { color: #e0e0e0; font-size: 1.4rem; }
    .header-actions { display: flex; gap: 8px; flex-wrap: wrap; }

    .library-body {
      display: flex;
      gap: 16px;
    }
    .collections-panel {
      width: 220px;
      min-width: 220px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .coll-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-radius: 4px;
      color: #bababa;
      cursor: pointer;
      font-size: 0.9em;
      transition: background 150ms;
    }
    .coll-item:hover { background: #302e2c; }
    .coll-item.active { background: #3d3a37; color: #bf811d; }
    .coll-item.pinned .coll-name { font-weight: 600; }
    .coll-icon { width: 20px; text-align: center; }
    .coll-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .coll-count { font-size: 0.8em; color: #8a8886; }
    .coll-delete {
      background: none; border: none; color: #8a8886; cursor: pointer;
      font-size: 0.8em; padding: 2px 4px; border-radius: 3px;
      opacity: 0; transition: opacity 150ms;
    }
    .coll-item:hover .coll-delete { opacity: 1; }
    .coll-delete:hover { color: #ac3333; }

    .games-panel { flex: 1; min-width: 0; }

    .pgn-paste { margin-bottom: 16px; }
    .pgn-paste textarea {
      width: 100%;
      font-family: 'Roboto Mono', monospace;
      font-size: 0.85em;
      background: #161512;
      color: #bababa;
      border: 1px solid #3d3a37;
      border-radius: 4px;
      padding: 10px;
      resize: vertical;
    }
    .pgn-paste textarea:focus { border-color: #bf811d; outline: none; }
    .paste-actions { display: flex; gap: 8px; margin-top: 8px; }

    .filters {
      display: flex;
      gap: 10px;
      align-items: center;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }
    .search-input { flex: 1; min-width: 200px; }
    .game-count { color: #8a8886; font-size: 0.85em; margin-left: auto; }

    .games-list { display: flex; flex-direction: column; gap: 4px; }
    .game-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 16px;
      cursor: pointer;
      transition: background 150ms ease;
    }
    .game-row:hover { background: #3d3a37; }
    .game-players {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 260px;
    }
    .white-player, .black-player {
      font-weight: 500;
      color: #e0e0e0;
      max-width: 120px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .result {
      font-family: 'Roboto Mono', monospace;
      font-size: 0.85em;
      padding: 1px 6px;
      border-radius: 3px;
      background: #3d3a37;
    }
    .result.win-white { color: #f0f0f0; }
    .result.win-black { color: #999; }
    .result.draw { color: #8a8886; }

    .game-meta {
      display: flex;
      gap: 6px;
      align-items: center;
      flex: 1;
      flex-wrap: wrap;
    }
    .tag {
      font-size: 0.8em;
      background: #302e2c;
      color: #8a8886;
      padding: 1px 6px;
      border-radius: 3px;
    }
    .tag.eco { color: #bf811d; }
    .tag.source { color: #629924; }
    .tag.fav { color: #bf811d; background: transparent; }
    .date { font-size: 0.8em; color: #8a8886; margin-left: auto; }

    .game-actions { display: flex; gap: 4px; }
    .btn-icon {
      padding: 4px 8px;
      background: transparent;
      border: none;
      border-radius: 3px;
      cursor: pointer;
      font-size: 0.85em;
      color: #8a8886;
    }
    .btn-icon:hover { background: #3d3a37; }
    .btn-icon.delete:hover { color: #ac3333; }

    .empty-state {
      text-align: center;
      padding: 40px;
      color: #8a8886;
    }
    .hint { font-size: 0.9em; margin-top: 8px; }

    .pagination {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 16px;
      margin-top: 16px;
    }
    .page-info { color: #8a8886; font-size: 0.9em; }

    .status-msg {
      color: #629924;
      text-align: center;
      margin-top: 12px;
      font-size: 0.9em;
    }

    .lichess-import, .new-collection { margin-bottom: 16px; }
    .lichess-import h3, .new-collection h3 { color: #e0e0e0; margin-bottom: 10px; font-size: 1em; }
    .lichess-form, .new-coll-form { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .lichess-form input, .new-coll-form input { flex: 1; min-width: 150px; }
    .lichess-form select { width: 100px; }
    .error-msg { color: #ac3333; margin-top: 8px; font-size: 0.9em; }
  `],
})
export class GamesLibraryComponent implements OnInit {
  collections: Collection[] = [];
  selectedCollectionId: number | null = null;
  totalGameCount = 0;

  filteredGames: Game[] = [];
  paginatedGames: Game[] = [];
  loading = true;

  searchQuery = '';
  filterResult = '';

  currentPage = 1;
  pageSize = 20;
  totalPages = 1;

  showPgnPaste = false;
  pgnText = '';
  statusMsg = '';

  // Lichess import
  showLichessImport = false;
  lichessUsername = '';
  lichessMax = 50;
  lichessLoading = false;
  lichessError = '';

  // New collection
  showNewCollection = false;
  newCollName = '';
  newCollDesc = '';

  constructor(
    private db: DatabaseService,
    private pgnService: PgnService,
    private lichessApi: LichessApiService,
    private router: Router,
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadCollections();
    await this.loadGames();
  }

  async loadCollections(): Promise<void> {
    this.collections = await this.db.getCollections();
    this.totalGameCount = this.collections.reduce((sum, c) => sum + c.game_count, 0);
  }

  async loadGames(): Promise<void> {
    this.loading = true;
    this.filteredGames = await this.db.getGames({
      collection_id: this.selectedCollectionId ?? undefined,
      query: this.searchQuery || undefined,
      result: this.filterResult || undefined,
      page: this.currentPage,
      page_size: this.pageSize,
    });
    this.totalPages = Math.max(1, Math.ceil(this.filteredGames.length / this.pageSize));
    this.paginatedGames = this.filteredGames;
    this.loading = false;
  }

  async selectCollection(id: number | null): Promise<void> {
    this.selectedCollectionId = id;
    this.currentPage = 1;
    await this.loadGames();
  }

  goToPage(page: number): void {
    this.currentPage = Math.max(1, Math.min(page, this.totalPages));
    this.loadGames();
  }

  openGame(game: Game): void {
    if (game.analysis_json) {
      this.router.navigate(['/analysis'], { queryParams: { gameId: game.id } });
    } else {
      this.router.navigate(['/library', game.id]);
    }
  }

  analyzeGame(game: Game): void {
    this.router.navigate(['/analysis'], { queryParams: { gameId: game.id } });
  }

  async deleteGame(game: Game): Promise<void> {
    if (!game.id) return;
    if (!confirm(`Delete game ${game.white} vs ${game.black}?`)) return;
    await this.db.deleteGame(game.id);
    await this.loadCollections();
    await this.loadGames();
    this.statusMsg = 'Game deleted.';
    setTimeout(() => this.statusMsg = '', 3000);
  }

  async toggleFavorite(game: Game): Promise<void> {
    if (!game.id) return;
    await this.db.toggleFavorite(game.id);
    await this.loadGames();
  }

  exportGame(game: Game): void {
    const pgn = this.pgnService.exportPgn(game);
    navigator.clipboard.writeText(pgn);
    this.statusMsg = 'PGN copied to clipboard!';
    setTimeout(() => this.statusMsg = '', 3000);
  }

  async importPgnFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    const games = await this.pgnService.importFile(file);
    const count = await this.db.importGames(games, file.name.replace(/\.pgn$/i, ''));
    await this.loadCollections();
    await this.loadGames();
    this.statusMsg = `Imported ${count} game(s) from file.`;
    setTimeout(() => this.statusMsg = '', 4000);
    input.value = '';
  }

  async importPgnText(): Promise<void> {
    if (!this.pgnText.trim()) return;
    const games = this.pgnService.parsePgn(this.pgnText);
    const count = await this.db.importGames(games);
    await this.loadCollections();
    await this.loadGames();
    this.pgnText = '';
    this.showPgnPaste = false;
    this.statusMsg = `Imported ${count} game(s).`;
    setTimeout(() => this.statusMsg = '', 4000);
  }

  async fetchLichessGames(): Promise<void> {
    if (!this.lichessUsername.trim() || this.lichessLoading) return;
    this.lichessLoading = true;
    this.lichessError = '';

    try {
      const result = await this.lichessApi.fetchUserGames(
        this.lichessUsername.trim(),
        this.lichessMax,
      );
      this.showLichessImport = false;
      await this.loadCollections();
      // Select the new Lichess collection
      this.selectedCollectionId = result.collection_id;
      await this.loadGames();
      this.statusMsg = `Imported ${result.imported} game(s) from Lichess.`;
      setTimeout(() => this.statusMsg = '', 4000);
    } catch (e: any) {
      this.lichessError = e.error?.detail || e.message || 'Failed to fetch games.';
    } finally {
      this.lichessLoading = false;
    }
  }

  async createCollection(): Promise<void> {
    if (!this.newCollName.trim()) return;
    await this.db.createCollection({
      name: this.newCollName,
      description: this.newCollDesc,
    });
    this.newCollName = '';
    this.newCollDesc = '';
    this.showNewCollection = false;
    await this.loadCollections();
  }

  async deleteCollection(coll: Collection): Promise<void> {
    if (!confirm(`Delete collection "${coll.name}"? Games will be moved to "Sin colección".`)) return;
    await this.db.deleteCollection(coll.id);
    if (this.selectedCollectionId === coll.id) {
      this.selectedCollectionId = null;
    }
    await this.loadCollections();
    await this.loadGames();
    this.statusMsg = 'Collection deleted.';
    setTimeout(() => this.statusMsg = '', 3000);
  }

  resultClass(result: string): string {
    if (result === '1-0') return 'win-white';
    if (result === '0-1') return 'win-black';
    return 'draw';
  }

  trackById(_index: number, game: Game): number {
    return game.id || 0;
  }
}
