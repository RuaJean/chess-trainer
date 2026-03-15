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
            <span class="coll-icon">{{ c.type === 'lichess' ? '♟' : c.icon }}</span>
            <span class="coll-name">{{ collectionDisplayName(c) }}</span>
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
              <select [(ngModel)]="lichessPerfType">
                <option value="blitz">Blitz (3-5 min)</option>
                <option value="bullet">Bullet (1-2 min)</option>
                <option value="rapid">Rapid (10-15 min)</option>
                <option value="classical">Classical (30+ min)</option>
                <option value="ultraBullet">UltraBullet</option>
                <option value="correspondence">Correspondence</option>
              </select>
              <button class="btn btn-primary" (click)="fetchLichessGames()"
                      [disabled]="!lichessUsername.trim() || lichessLoading">
                {{ lichessLoading ? 'Fetching...' : 'Fetch & Import' }}
              </button>
              <button class="btn btn-secondary" (click)="showLichessImport = false">Cancel</button>
            </div>
            <p *ngIf="lichessProgress" class="progress-msg">{{ lichessProgress }}</p>
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

          <!-- Speed filter chips for Lichess collections -->
          <div class="speed-chips" *ngIf="availableSpeeds.length > 0">
            <button class="speed-chip" [class.active]="speedFilter === ''"
                    (click)="setSpeedFilter('')">All</button>
            <button class="speed-chip" *ngFor="let speed of availableSpeeds"
                    [class.active]="speedFilter === speed"
                    (click)="setSpeedFilter(speed)">{{ speed }}</button>
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
            <select *ngIf="availableOpenings.length > 0" [(ngModel)]="filterOpening" (change)="loadGames()" class="opening-filter">
              <option value="">All openings</option>
              <option *ngFor="let o of availableOpenings" [value]="o">{{ o }}</option>
            </select>
          </div>

          <div class="sort-bar">
            <span class="game-count">{{ displayedGames.length }}<span *ngIf="collectionGameCount > 0"> of {{ collectionGameCount }}</span> games</span>
            <div class="sort-buttons">
              <button class="sort-btn" [class.active]="sortField === 'date'"
                      (click)="toggleSort('date')" title="Sort by date">
                Date {{ sortField === 'date' ? (sortDir === 'asc' ? '↑' : '↓') : '' }}
              </button>
              <button class="sort-btn" [class.active]="sortField === 'white_elo'"
                      (click)="toggleSort('white_elo')" title="Sort by ELO">
                ELO {{ sortField === 'white_elo' ? (sortDir === 'asc' ? '↑' : '↓') : '' }}
              </button>
              <button class="sort-btn" [class.active]="sortField === 'result'"
                      (click)="toggleSort('result')" title="Sort by result">
                Result {{ sortField === 'result' ? (sortDir === 'asc' ? '↑' : '↓') : '' }}
              </button>
              <button class="sort-btn" [class.active]="sortField === 'eco'"
                      (click)="toggleSort('eco')" title="Sort by opening">
                ECO {{ sortField === 'eco' ? (sortDir === 'asc' ? '↑' : '↓') : '' }}
              </button>
            </div>
          </div>

          <div class="games-list" *ngIf="displayedGames.length > 0">
            <div class="game-row card" *ngFor="let game of displayedGames; trackBy: trackById"
                 (click)="openGame(game)">
              <div class="game-players">
                <span class="white-player">{{ game.white }}</span>
                <span class="result" [ngClass]="resultClass(game.result)">{{ game.result }}</span>
                <span class="black-player">{{ game.black }}</span>
              </div>
              <div class="game-meta">
                <span *ngIf="game.event" class="tag">{{ game.event }}</span>
                <span *ngIf="game.eco" class="tag eco">{{ game.eco }}</span>
                <span *ngIf="game.opening_name" class="tag opening" [title]="game.opening_name">{{ game.opening_name }}</span>
                <span class="tag source">{{ game.source }}</span>
                <span *ngIf="game.analysis_json" class="tag analyzed">Analyzed</span>
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

          <div class="empty-state card" *ngIf="displayedGames.length === 0 && !loading">
            <p>No games found.</p>
            <p class="hint">Play a game vs AI, import a PGN file, or fetch games from Lichess.</p>
          </div>

          <div class="load-more" *ngIf="hasMore">
            <button class="btn btn-secondary load-more-btn" (click)="loadMore()" [disabled]="loadingMore">
              {{ loadingMore ? 'Loading...' : 'Load more' }}
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

    .speed-chips {
      display: flex;
      gap: 6px;
      margin-bottom: 10px;
      flex-wrap: wrap;
    }
    .speed-chip {
      padding: 4px 12px;
      border-radius: 16px;
      border: 1px solid #3d3a37;
      background: #262421;
      color: #bababa;
      font-size: 0.82em;
      cursor: pointer;
      transition: all 150ms;
    }
    .speed-chip:hover { border-color: #bf811d; }
    .speed-chip.active {
      background: #bf811d;
      color: #161512;
      border-color: #bf811d;
      font-weight: 600;
    }

    .filters {
      display: flex;
      gap: 10px;
      align-items: center;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }
    .search-input { flex: 1; min-width: 200px; }
    .opening-filter { max-width: 220px; }
    .game-count { color: #8a8886; font-size: 0.85em; }

    .sort-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
      flex-wrap: wrap;
      gap: 8px;
    }
    .sort-buttons { display: flex; gap: 4px; }
    .sort-btn {
      padding: 3px 10px;
      border-radius: 4px;
      border: 1px solid #3d3a37;
      background: #262421;
      color: #8a8886;
      font-size: 0.8em;
      cursor: pointer;
      transition: all 150ms;
    }
    .sort-btn:hover { border-color: #bf811d; color: #bababa; }
    .sort-btn.active {
      border-color: #bf811d;
      color: #bf811d;
      font-weight: 600;
    }

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
    .tag.opening { color: #a88adb; max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .tag.source { color: #629924; }
    .tag.analyzed { color: #96bc4b; border: 1px solid #629924; }
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

    .load-more {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      margin-top: 16px;
    }
    .load-more-btn {
      min-width: 160px;
    }
    .load-more-info { color: #8a8886; font-size: 0.85em; }

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
    .lichess-form select { width: auto; min-width: 100px; }
    .progress-msg { color: #bf811d; margin-top: 8px; font-size: 0.9em; }
    .error-msg { color: #ac3333; margin-top: 8px; font-size: 0.9em; }
  `],
})
export class GamesLibraryComponent implements OnInit {
  collections: Collection[] = [];
  selectedCollectionId: number | null = null;
  totalGameCount = 0;

  displayedGames: Game[] = [];
  loading = true;
  loadingMore = false;
  hasMore = false;

  searchQuery = '';
  filterResult = '';

  currentPage = 1;
  pageSize = 20;

  showPgnPaste = false;
  pgnText = '';
  statusMsg = '';

  // Lichess import
  showLichessImport = false;
  lichessUsername = '';
  lichessMax = 50;
  lichessLoading = false;
  lichessError = '';
  lichessPerfType = 'blitz';
  lichessProgress = '';

  // Speed filter for Lichess collections
  speedFilter = '';
  availableSpeeds: string[] = [];

  // Sorting
  sortField = 'date';
  sortDir: 'asc' | 'desc' = 'desc';

  // Opening filter
  filterOpening = '';
  availableOpenings: string[] = [];

  // Total count for the selected collection
  collectionGameCount = 0;

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
    this.currentPage = 1;
    const games = await this.fetchPage(1);
    this.displayedGames = games;
    this.hasMore = games.length >= this.pageSize;
    this.loading = false;
  }

  async loadMore(): Promise<void> {
    if (this.loadingMore) return;
    this.loadingMore = true;
    this.currentPage++;
    const games = await this.fetchPage(this.currentPage);
    this.displayedGames = [...this.displayedGames, ...games];
    this.hasMore = games.length >= this.pageSize;
    this.loadingMore = false;
  }

  private async fetchPage(page: number): Promise<Game[]> {
    let query = this.searchQuery || undefined;
    if (this.speedFilter) {
      const speedQuery = `Lichess ${this.speedFilter}`;
      query = query ? `${query} ${speedQuery}` : speedQuery;
    }
    if (this.filterOpening) {
      query = query ? `${query} ${this.filterOpening}` : this.filterOpening;
    }
    const ordering = this.sortDir === 'asc' ? this.sortField : `-${this.sortField}`;
    return this.db.getGames({
      collection_id: this.selectedCollectionId ?? undefined,
      query,
      result: this.filterResult || undefined,
      ordering,
      page,
      page_size: this.pageSize,
    });
  }

  async selectCollection(id: number | null): Promise<void> {
    this.selectedCollectionId = id;
    this.speedFilter = '';
    this.availableSpeeds = [];
    this.filterOpening = '';
    this.availableOpenings = [];
    this.collectionGameCount = 0;

    if (id !== null) {
      const coll = this.collections.find(c => c.id === id);
      this.collectionGameCount = coll?.game_count || 0;
    } else {
      this.collectionGameCount = this.totalGameCount;
    }

    await this.loadGames();

    // Compute available filters from all games in this collection
    if (id !== null) {
      const allGames = await this.db.getAllGamesPaginated(id);
      const coll = this.collections.find(c => c.id === id);

      // Speed chips for Lichess collections
      if (coll?.type === 'lichess') {
        const speedSet = new Set<string>();
        for (const g of allGames) {
          const match = g.event?.match(/^Lichess\s+(.+)$/i);
          if (match) speedSet.add(match[1]);
        }
        this.availableSpeeds = Array.from(speedSet).sort();
      }

      // Opening filter — extract unique opening names
      const openingSet = new Set<string>();
      for (const g of allGames) {
        if (g.opening_name) openingSet.add(g.opening_name);
      }
      this.availableOpenings = Array.from(openingSet).sort();
    }
  }

  setSpeedFilter(speed: string): void {
    this.speedFilter = speed;
    this.loadGames();
  }

  toggleSort(field: string): void {
    if (this.sortField === field) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDir = field === 'date' ? 'desc' : 'asc';
    }
    this.loadGames();
  }

  collectionDisplayName(c: Collection): string {
    if (c.type === 'lichess') {
      // Strip legacy "Lichess - " prefix
      return c.name.replace(/^Lichess\s*-\s*/i, '');
    }
    return c.name;
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
    this.displayedGames = this.displayedGames.filter(g => g.id !== game.id);
    await this.loadCollections();
    this.statusMsg = 'Game deleted.';
    setTimeout(() => this.statusMsg = '', 3000);
  }

  async toggleFavorite(game: Game): Promise<void> {
    if (!game.id) return;
    const updated = await this.db.toggleFavorite(game.id);
    const idx = this.displayedGames.findIndex(g => g.id === game.id);
    if (idx >= 0) {
      this.displayedGames[idx] = { ...this.displayedGames[idx], is_favorite: updated.is_favorite };
    }
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
    this.lichessProgress = '';

    try {
      const token = await this.db.getSetting<string>('lichess_token') || undefined;
      const result = await this.lichessApi.fetchUserGames(
        this.lichessUsername.trim(),
        this.lichessMax,
        this.lichessPerfType || undefined,
        (received, total) => {
          this.lichessProgress = `Fetching... ${received}/${total}`;
        },
        token,
      );
      this.lichessProgress = '';
      this.showLichessImport = false;
      await this.loadCollections();
      await this.selectCollection(result.collection_id);

      let msg = `Imported ${result.imported} game(s) from Lichess.`;
      if (result.skipped_duplicates > 0) {
        msg += ` (${result.skipped_duplicates} duplicates skipped)`;
      }
      this.statusMsg = msg;
      setTimeout(() => this.statusMsg = '', 5000);
    } catch (e: any) {
      this.lichessProgress = '';
      const detail = e.error?.detail;
      this.lichessError = (typeof detail === 'string' ? detail : (detail ? JSON.stringify(detail) : null))
        || e.message || 'Failed to fetch games.';
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
      this.speedFilter = '';
      this.availableSpeeds = [];
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
