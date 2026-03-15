import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Chess } from 'chess.js';
import { BoardComponent } from '../../shared/components/board/board.component';
import { MoveListComponent, MoveEntry } from '../../shared/components/move-list/move-list.component';
import { DatabaseService } from '../../core/services/database.service';
import { PgnService } from '../../core/services/pgn.service';
import { TranslationService } from '../../core/services/translation.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { Game } from '../../models/game.model';

@Component({
  selector: 'app-game-detail',
  standalone: true,
  imports: [CommonModule, BoardComponent, MoveListComponent, TranslatePipe],
  template: `
    <div class="detail-container" *ngIf="game">
      <div class="board-area">
        <app-board
          [fen]="currentFen"
          [orientation]="orientation"
          [interactive]="false"
          [legalMoves]="emptyMoves"
          [lastMove]="lastMove"
          [turnColor]="turnColor">
        </app-board>
      </div>

      <div class="side-panel">
        <div class="game-header card">
          <h2>{{ game.white }} vs {{ game.black }}</h2>
          <div class="meta-row">
            <span *ngIf="game.event" class="tag">{{ game.event }}</span>
            <span *ngIf="game.eco" class="tag eco">{{ game.eco }}</span>
            <span class="tag result">{{ game.result }}</span>
            <span class="date">{{ game.date }}</span>
          </div>
        </div>

        <div class="moves-panel card">
          <app-move-list
            [moves]="moveEntries"
            [currentMoveIndex]="currentMoveIdx"
            (moveSelected)="onMoveSelected($event)"
            (navigate)="onNavigate($event)">
          </app-move-list>
        </div>

        <div class="detail-actions card">
          <button class="btn btn-secondary" (click)="flipBoard()">{{ 'detail.flip' | translate }}</button>
          <button class="btn btn-secondary" (click)="analyzeGame()">{{ 'detail.analyze' | translate }}</button>
          <button class="btn btn-secondary" (click)="copyPgn()">{{ 'detail.copyPgn' | translate }}</button>
          <button class="btn btn-secondary" (click)="goBack()">{{ 'detail.back' | translate }}</button>
        </div>

        <p class="status-msg" *ngIf="statusMsg">{{ statusMsg }}</p>
      </div>
    </div>
  `,
  styles: [`
    .detail-container {
      display: flex;
      gap: 20px;
      padding: 16px;
      height: 100%;
      align-items: flex-start;
      justify-content: center;
      --board-size: min(calc(100vh - 120px), calc(100vw - 560px), 560px);
    }
    .board-area {
      display: flex;
      flex-direction: column;
      gap: 8px;
      align-items: center;
    }
    .side-panel {
      display: flex;
      flex-direction: column;
      gap: 12px;
      width: 280px;
    }
    .game-header h2 {
      color: #e0e0e0;
      font-size: 1.1rem;
      margin-bottom: 8px;
    }
    .meta-row {
      display: flex;
      gap: 6px;
      align-items: center;
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
    .tag.result { color: #e0e0e0; }
    .date { font-size: 0.8em; color: #8a8886; }

    .moves-panel {
      flex: 1;
      min-height: 200px;
      max-height: 400px;
      padding: 0;
      overflow: hidden;
    }
    .detail-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .detail-actions .btn { flex: 1; min-width: 70px; font-size: 0.85em; }
    .status-msg { color: #629924; text-align: center; font-size: 0.9em; }
  `],
})
export class GameDetailComponent implements OnInit {
  game: Game | null = null;
  orientation: 'white' | 'black' = 'white';
  currentFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  turnColor: 'white' | 'black' = 'white';
  lastMove: [string, string] | null = null;
  emptyMoves = new Map<string, string[]>();
  moveEntries: MoveEntry[] = [];
  currentMoveIdx = -1;
  statusMsg = '';

  private positions: { fen: string; from?: string; to?: string }[] = [];
  private startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private db: DatabaseService,
    private pgnService: PgnService,
    private i18n: TranslationService,
  ) {}

  async ngOnInit(): Promise<void> {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) { this.goBack(); return; }

    const game = await this.db.getGame(id);
    if (!game) { this.goBack(); return; }

    this.game = game;
    this.loadMoves();
  }

  private loadMoves(): void {
    if (!this.game) return;
    const chess = new Chess();
    try { chess.loadPgn(this.game.pgn); } catch { return; }

    const history = chess.history({ verbose: true });
    chess.reset();

    this.positions = [{ fen: chess.fen() }];
    this.moveEntries = [];

    for (let i = 0; i < history.length; i++) {
      const m = history[i];
      chess.move(m.san);
      this.positions.push({ fen: chess.fen(), from: m.from, to: m.to });

      const isWhite = i % 2 === 0;
      const moveNum = Math.floor(i / 2) + 1;

      if (isWhite) {
        this.moveEntries.push({
          moveNumber: moveNum,
          white: m.san,
          whiteFen: chess.fen(),
        });
      } else {
        const last = this.moveEntries[this.moveEntries.length - 1];
        last.black = m.san;
        last.blackFen = chess.fen();
      }
    }

    // Go to last position
    if (this.positions.length > 1) {
      this.goToPosition(this.positions.length - 1);
    }
  }

  private goToPosition(idx: number): void {
    const pos = this.positions[idx];
    this.currentFen = pos.fen;
    this.turnColor = pos.fen.includes(' w ') ? 'white' : 'black';
    this.lastMove = pos.from && pos.to ? [pos.from, pos.to] : null;
    this.currentMoveIdx = idx - 1; // -1 because positions[0] is start
  }

  onMoveSelected(event: { index: number; fen?: string }): void {
    this.goToPosition(event.index + 1);
  }

  onNavigate(direction: 'start' | 'back' | 'forward' | 'end'): void {
    const total = this.positions.length;
    const current = this.currentMoveIdx + 1; // index into positions[]

    switch (direction) {
      case 'start':
        this.goToPosition(0);
        break;
      case 'back':
        if (current > 0) this.goToPosition(current - 1);
        break;
      case 'forward':
        if (current < total - 1) this.goToPosition(current + 1);
        break;
      case 'end':
        this.goToPosition(total - 1);
        break;
    }
  }

  flipBoard(): void {
    this.orientation = this.orientation === 'white' ? 'black' : 'white';
  }

  analyzeGame(): void {
    if (this.game?.id) {
      this.router.navigate(['/analysis'], { queryParams: { gameId: this.game.id } });
    }
  }

  copyPgn(): void {
    if (!this.game) return;
    const pgn = this.pgnService.exportPgn(this.game);
    navigator.clipboard.writeText(pgn);
    this.statusMsg = this.i18n.t('detail.pgnCopied');
    setTimeout(() => this.statusMsg = '', 3000);
  }

  goBack(): void {
    this.router.navigate(['/library']);
  }
}
