import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BoardComponent, BoardMove } from '../../shared/components/board/board.component';
import { MoveListComponent, MoveEntry } from '../../shared/components/move-list/move-list.component';
import { EvalChartComponent } from '../../shared/components/eval-chart/eval-chart.component';
import { DatabaseService } from '../../core/services/database.service';
import { AuthService } from '../../core/services/auth.service';
import { Game, CoachReviewData } from '../../models/game.model';
import { CriticalMoment } from '../../models/coach.model';
import { MoveClassification } from '../../core/services/game-analysis.service';
import { TranslationService } from '../../core/services/translation.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { Chess } from 'chess.js';

interface AnalysisData {
  moves: Array<{
    moveIndex: number;
    san: string;
    fen: string;
    color: 'w' | 'b';
    classification: MoveClassification;
    winDrop: number;
    accuracy: number;
    evalBefore: { fen: string; bestMoveSan: string; cp: number; winPercent: number };
    evalAfter: { cp: number; winPercent: number };
  }>;
  evalHistory: number[];
  whiteAccuracy: number;
  blackAccuracy: number;
}

@Component({
  selector: 'app-game-review',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, BoardComponent, MoveListComponent, EvalChartComponent, TranslatePipe],
  template: `
    <div class="review" *ngIf="game; else loadingTpl">
      <div class="review-header">
        <a routerLink="/coach" class="back-link">&larr; {{ 'review.back' | translate }}</a>
        <h1>{{ 'review.title' | translate }}</h1>
        <span class="game-title">{{ game.white }} vs {{ game.black }} &middot; {{ game.date }}</span>
      </div>

      <div class="review-layout">
        <!-- Left: Board + Eval Chart -->
        <div class="board-panel">
          <app-board
            [fen]="currentFen"
            [orientation]="playerColor"
            [viewOnly]="true"
            [lastMove]="lastMoveArr">
          </app-board>
          <app-eval-chart
            *ngIf="evalHistory.length > 0"
            [evalHistory]="evalHistory"
            [classifications]="classifications"
            [currentIndex]="currentMoveIndex"
            [timeHistory]="timeHistory"
            (moveClicked)="goToMove($event)">
          </app-eval-chart>
          <div class="accuracy-bar" *ngIf="analysis">
            <span>White: {{ analysis.whiteAccuracy | number:'1.1-1' }}%</span>
            <span>Black: {{ analysis.blackAccuracy | number:'1.1-1' }}%</span>
          </div>
        </div>

        <!-- Right: Critical Moments + Notes -->
        <div class="info-panel">
          <!-- Move List -->
          <div class="section">
            <app-move-list
              [moves]="moveEntries"
              [currentMoveIndex]="currentMoveIndex"
              (moveSelected)="onMoveSelected($event)">
            </app-move-list>
          </div>

          <!-- Critical Moments -->
          <div class="section">
            <h3>{{ 'review.criticalMoments' | translate }}</h3>
            <div class="moments-list" *ngIf="criticalMoments.length > 0; else noMoments">
              <div class="moment-card" *ngFor="let m of criticalMoments; let i = index"
                   [class.selected]="selectedMoment === i"
                   [class]="'moment-' + m.classification"
                   (click)="selectMoment(i)">
                <div class="moment-header">
                  <span class="move-num">{{ 'review.move' | translate:{num: m.move_index + 1} }}</span>
                  <span class="badge" [class]="m.classification">{{ m.classification }}</span>
                  <span class="error-type">{{ m.error_type }}</span>
                </div>
                <div class="moment-body">
                  <div class="move-comparison">
                    <span class="played">{{ 'review.played' | translate }} <strong>{{ m.san }}</strong></span>
                    <span class="best">{{ 'review.best' | translate }} <strong>{{ m.best_san }}</strong></span>
                  </div>
                  <span class="win-drop">-{{ (m.win_drop * 100) | number:'1.0-0' }}%</span>
                </div>
              </div>
            </div>
            <ng-template #noMoments>
              <div class="empty" *ngIf="analysis">{{ 'review.noCritical' | translate }}</div>
              <div class="empty" *ngIf="!analysis">{{ 'review.notAnalyzed' | translate }}</div>
            </ng-template>
          </div>

          <!-- Error Classification Summary -->
          <div class="section" *ngIf="errorClassifications">
            <h3>{{ 'review.errorClassification' | translate }}</h3>
            <div class="error-summary">
              <div class="error-chip" *ngFor="let entry of errorClassEntries">
                <span class="chip-label">{{ entry[0] }}</span>
                <span class="chip-value">{{ entry[1] }}</span>
              </div>
            </div>
          </div>

          <!-- What Were You Thinking? -->
          <div class="section" *ngIf="selectedMoment >= 0">
            <h3>{{ 'review.whatThinking' | translate:{num: criticalMoments[selectedMoment].move_index + 1} }}</h3>
            <textarea class="notes-input"
                      [(ngModel)]="playerNotes[criticalMoments[selectedMoment].move_index]"
                      (blur)="saveReview()"
                      [placeholder]="'review.thoughtProcess' | translate"
                      rows="3"></textarea>
          </div>

          <!-- Lesson Summary -->
          <div class="section">
            <h3>{{ 'review.lessonSummary' | translate }}</h3>
            <textarea class="notes-input lesson"
                      [(ngModel)]="lessonSummary"
                      (blur)="saveReview()"
                      [placeholder]="autoLesson || i18n.t('review.lessonPlaceholder')"
                      rows="3"></textarea>
          </div>
        </div>
      </div>
    </div>

    <ng-template #loadingTpl>
      <div class="loading">{{ 'review.loadingGame' | translate }}</div>
    </ng-template>
  `,
  styles: [`
    .review {
      padding: 16px 24px;
      max-width: 1200px;
      margin: 0 auto;
    }
    .review-header {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 16px;
    }
    .back-link {
      color: #8a8886;
      text-decoration: none;
      font-size: 0.9rem;
    }
    .back-link:hover { color: #bf811d; }
    .review-header h1 {
      color: #e0e0e0;
      font-size: 1.3rem;
      margin: 0;
    }
    .game-title {
      color: #8a8886;
      font-size: 0.85rem;
    }
    .review-layout {
      display: grid;
      grid-template-columns: minmax(300px, 420px) 1fr;
      gap: 20px;
    }
    .board-panel {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .accuracy-bar {
      display: flex;
      justify-content: space-between;
      background: #262421;
      border-radius: 4px;
      padding: 6px 12px;
      color: #bababa;
      font-size: 0.8rem;
    }
    .info-panel {
      display: flex;
      flex-direction: column;
      gap: 16px;
      max-height: 80vh;
      overflow-y: auto;
    }
    .section {
      background: #262421;
      border: 1px solid #3d3a37;
      border-radius: 6px;
      padding: 12px;
    }
    .section h3 {
      color: #e0e0e0;
      font-size: 0.9rem;
      margin: 0 0 8px;
    }
    .moments-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .moment-card {
      background: #1a1917;
      border-radius: 4px;
      padding: 8px 10px;
      cursor: pointer;
      border-left: 3px solid transparent;
      transition: border-color 150ms ease;
    }
    .moment-card.selected {
      border-left-color: #bf811d;
    }
    .moment-card.moment-blunder {
      border-left-color: #db3030;
    }
    .moment-card.moment-mistake {
      border-left-color: #e6a817;
    }
    .moment-card:hover {
      background: #2e2b28;
    }
    .moment-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
    }
    .move-num {
      color: #8a8886;
      font-size: 0.8rem;
    }
    .badge {
      font-size: 0.7rem;
      padding: 1px 6px;
      border-radius: 3px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .badge.blunder { background: #db3030; color: #fff; }
    .badge.mistake { background: #e6a817; color: #1a1917; }
    .badge.inaccuracy { background: #56b4e9; color: #1a1917; }
    .error-type {
      color: #8a8886;
      font-size: 0.75rem;
      font-style: italic;
    }
    .moment-body {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .move-comparison {
      display: flex;
      gap: 12px;
      font-size: 0.8rem;
    }
    .played { color: #db3030; }
    .best { color: #81b64c; }
    .win-drop {
      color: #db3030;
      font-weight: 600;
      font-size: 0.85rem;
    }
    .error-summary {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .error-chip {
      background: #1a1917;
      border-radius: 4px;
      padding: 4px 10px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .chip-label {
      color: #bababa;
      font-size: 0.8rem;
      text-transform: capitalize;
    }
    .chip-value {
      color: #bf811d;
      font-weight: 600;
      font-size: 0.85rem;
    }
    .notes-input {
      width: 100%;
      background: #1a1917;
      border: 1px solid #3d3a37;
      border-radius: 4px;
      color: #e0e0e0;
      padding: 8px;
      font-size: 0.85rem;
      font-family: inherit;
      resize: vertical;
      box-sizing: border-box;
    }
    .notes-input::placeholder { color: #5a5856; }
    .empty {
      color: #5a5856;
      font-style: italic;
      font-size: 0.85rem;
    }
    .loading {
      color: #8a8886;
      text-align: center;
      padding: 40px;
    }
  `],
})
export class GameReviewComponent implements OnInit {
  game: Game | null = null;
  analysis: AnalysisData | null = null;
  currentFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  playerColor: 'white' | 'black' = 'white';
  currentMoveIndex = -1;
  lastMoveArr: [string, string] | null = null;

  // Analysis data
  movesSan: string[] = [];
  moveEntries: MoveEntry[] = [];
  evalHistory: number[] = [];
  classifications: MoveClassification[] = [];
  timeHistory: number[] = [];

  // Critical moments
  criticalMoments: CriticalMoment[] = [];
  selectedMoment = -1;

  // Review data
  errorClassifications: Record<string, number> = {};
  playerNotes: Record<number, string> = {};
  lessonSummary = '';
  autoLesson = '';

  // Navigation
  private positions: string[] = [];
  private chess = new Chess();

  constructor(
    private route: ActivatedRoute,
    private db: DatabaseService,
    private auth: AuthService,
    public i18n: TranslationService,
  ) {}

  get errorClassEntries(): [string, number][] {
    return Object.entries(this.errorClassifications).filter(([, v]) => v > 0);
  }

  ngOnInit(): void {
    const gameId = Number(this.route.snapshot.paramMap.get('gameId'));
    if (gameId) this.loadGame(gameId);
  }

  async loadGame(gameId: number): Promise<void> {
    try {
      this.game = (await this.db.getGame(gameId)) || null;
      if (!this.game) return;

      const username = this.auth.user?.username || '';
      this.playerColor = this.game.black.toLowerCase() === username.toLowerCase() ? 'black' : 'white';

      // Parse moves
      this.chess.reset();
      if (this.game.pgn) {
        this.chess.loadPgn(this.game.pgn);
      }
      this.movesSan = this.chess.history();

      // Build position list and MoveEntry array
      this.positions = ['rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'];
      const tempChess = new Chess();
      this.moveEntries = [];
      for (let i = 0; i < this.movesSan.length; i++) {
        tempChess.move(this.movesSan[i]);
        this.positions.push(tempChess.fen());
        const moveNum = Math.floor(i / 2) + 1;
        if (i % 2 === 0) {
          this.moveEntries.push({ moveNumber: moveNum, white: this.movesSan[i], whiteFen: tempChess.fen() });
        } else {
          if (this.moveEntries.length > 0) {
            const last = this.moveEntries[this.moveEntries.length - 1];
            last.black = this.movesSan[i];
            last.blackFen = tempChess.fen();
          }
        }
      }

      // Parse analysis
      if (this.game.analysis_json) {
        try {
          this.analysis = JSON.parse(this.game.analysis_json);
          if (this.analysis) {
            this.evalHistory = this.analysis.evalHistory || [];
            this.classifications = this.analysis.moves.map(m => m.classification);
            // Add classification CSS classes to moveEntries
            for (const move of this.analysis.moves) {
              const entryIdx = Math.floor(move.moveIndex / 2);
              if (entryIdx < this.moveEntries.length) {
                if (move.color === 'w') {
                  this.moveEntries[entryIdx].whiteClass = move.classification;
                } else {
                  this.moveEntries[entryIdx].blackClass = move.classification;
                }
              }
            }
            this.extractCriticalMoments();
          }
        } catch { /* ignore parse errors */ }
      }

      // Build time history from clock_data
      if (this.game.clock_data) {
        const isWhite = this.playerColor === 'white';
        const wt = this.game.clock_data.white || [];
        const bt = this.game.clock_data.black || [];
        // Interleave: pos0 (start), pos1 (after white move 1), pos2 (after black move 1), ...
        this.timeHistory = [];
        const maxLen = Math.max(wt.length, bt.length);
        for (let i = 0; i < maxLen; i++) {
          if (i < wt.length) this.timeHistory.push(wt[i]);
          if (i < bt.length) this.timeHistory.push(bt[i]);
        }
      }

      // Load existing coach review
      if (this.game.coach_review) {
        const cr = this.game.coach_review;
        this.playerNotes = cr.player_notes || {};
        this.lessonSummary = cr.lesson_summary || '';
      }

      this.goToMove(-1);
    } catch (err) {
      console.error('Failed to load game for review:', err);
    }
  }

  private extractCriticalMoments(): void {
    if (!this.analysis) return;

    const username = this.auth.user?.username || '';
    const isWhite = this.game!.white.toLowerCase() === username.toLowerCase();
    const playerColor = isWhite ? 'w' : 'b';

    const errorCounts: Record<string, number> = {};
    this.criticalMoments = [];

    for (const move of this.analysis.moves) {
      if (move.color !== playerColor) continue;
      if (move.winDrop < 0.10) continue; // Only significant drops

      const classification = move.classification;
      if (classification === 'best' || classification === 'good' || classification === 'book') continue;

      // Classify error type
      let errorType = 'positional';
      const hasClockData = this.game!.clock_data != null;
      const times = hasClockData
        ? (isWhite ? this.game!.clock_data!.white : this.game!.clock_data!.black)
        : null;
      const moveIdx = Math.floor(move.moveIndex / 2);
      const timeRemaining = times && moveIdx < times.length ? times[moveIdx] / 100 : null;

      if (timeRemaining !== null && timeRemaining < 10) {
        errorType = 'time pressure';
      } else if (move.moveIndex < 15) {
        errorType = 'theoretical';
      } else if (move.winDrop >= 0.30) {
        errorType = 'tactical';
      } else if (move.winDrop >= 0.15) {
        errorType = 'positional';
      } else {
        errorType = 'calculation';
      }

      errorCounts[errorType] = (errorCounts[errorType] || 0) + 1;

      this.criticalMoments.push({
        move_index: move.moveIndex,
        san: move.san,
        best_san: move.evalBefore?.bestMoveSan || '?',
        classification,
        win_drop: move.winDrop,
        error_type: errorType,
        fen: move.evalBefore?.fen || move.fen || '',
      });
    }

    this.errorClassifications = errorCounts;

    // Auto-generate lesson
    if (this.criticalMoments.length > 0) {
      const types = Object.entries(errorCounts).sort(([, a], [, b]) => b - a);
      const mainType = types[0]?.[0] || 'unknown';
      this.autoLesson = `Main issue: ${mainType} errors (${types[0]?.[1] || 0} occurrences). ` +
        `${this.criticalMoments.length} critical moments found. Focus on ${mainType} training.`;
    }
  }

  goToMove(index: number): void {
    this.currentMoveIndex = index;
    const posIdx = index + 1;
    if (posIdx >= 0 && posIdx < this.positions.length) {
      this.currentFen = this.positions[posIdx];
    }
    if (index >= 0 && index < this.movesSan.length) {
      const tempChess = new Chess();
      for (let i = 0; i <= index; i++) {
        tempChess.move(this.movesSan[i]);
      }
      const history = tempChess.history({ verbose: true });
      if (history.length > 0) {
        const last = history[history.length - 1];
        this.lastMoveArr = [last.from, last.to];
      }
    } else {
      this.lastMoveArr = null;
    }
  }

  onMoveSelected(event: { index: number; fen?: string }): void {
    this.goToMove(event.index);
  }

  selectMoment(index: number): void {
    this.selectedMoment = index;
    const moment = this.criticalMoments[index];
    this.goToMove(moment.move_index);
  }

  async saveReview(): Promise<void> {
    if (!this.game?.id) return;

    const review: CoachReviewData = {
      critical_moments: this.criticalMoments,
      error_classifications: this.errorClassifications,
      lesson_summary: this.lessonSummary || this.autoLesson,
      player_notes: this.playerNotes,
    };

    try {
      await this.db.updateGame(this.game.id, { coach_review: review } as any);
    } catch (err) {
      console.error('Failed to save review:', err);
    }
  }
}
