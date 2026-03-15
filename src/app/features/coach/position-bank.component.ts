import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { BoardComponent, BoardMove } from '../../shared/components/board/board.component';
import { PositionBankService } from '../../core/services/position-bank.service';
import { DatabaseService } from '../../core/services/database.service';
import { ChessLogicService } from '../../core/services/chess-logic.service';
import { Chess } from 'chess.js';
import { Position } from '../../models/coach.model';
import { Game } from '../../models/game.model';
import { TranslationService } from '../../core/services/translation.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

type ViewMode = 'list' | 'drill';

interface DrillState {
  positions: Position[];
  currentIndex: number;
  userMove: string;
  feedback: 'none' | 'correct' | 'incorrect';
  showSolution: boolean;
  results: Array<{ position: Position; correct: boolean }>;
  finished: boolean;
}

@Component({
  selector: 'app-position-bank',
  standalone: true,
  imports: [CommonModule, FormsModule, BoardComponent, TranslatePipe],
  template: `
    <div class="bank">
      <!-- List Mode -->
      <div *ngIf="mode === 'list'">
        <div class="bank-header">
          <h1>{{ 'bank.title' | translate }}</h1>
          <div class="header-actions">
            <button class="btn" (click)="startDrill()" [disabled]="duePositions.length === 0">
              {{ 'bank.drill' | translate:{count: duePositions.length} }}
            </button>
          </div>
        </div>

        <!-- Filters -->
        <div class="filters">
          <select [(ngModel)]="filterCategory" (change)="loadPositions()">
            <option value="">{{ 'bank.allCategories' | translate }}</option>
            <option value="tactical">{{ 'bank.tactical' | translate }}</option>
            <option value="positional">{{ 'bank.positional' | translate }}</option>
            <option value="theoretical">{{ 'bank.theoretical' | translate }}</option>
            <option value="endgame">{{ 'bank.endgame' | translate }}</option>
          </select>
          <label class="checkbox-label">
            <input type="checkbox" [(ngModel)]="filterDueOnly" (change)="loadPositions()">
            {{ 'bank.dueOnly' | translate }}
          </label>
        </div>

        <!-- Actions -->
        <div class="actions-bar">
          <button class="btn-sm" (click)="showExtractDialog = true">{{ 'bank.extractFromGame' | translate }}</button>
          <button class="btn-sm" (click)="showAddDialog = true">{{ 'bank.addPosition' | translate }}</button>
        </div>

        <!-- Extract Dialog -->
        <div class="dialog" *ngIf="showExtractDialog">
          <div class="dialog-content">
            <h3>{{ 'bank.extractFromGame' | translate }}</h3>
            <p class="dialog-info">{{ 'bank.extractInfo' | translate }}</p>
            <select [(ngModel)]="selectedGameId" class="game-select">
              <option [ngValue]="null">{{ 'bank.selectGame' | translate }}</option>
              <option *ngFor="let g of analyzedGames" [ngValue]="g.id">
                {{ g.white }} vs {{ g.black }} ({{ g.date }}) - {{ g.eco }}
              </option>
            </select>
            <div class="dialog-actions">
              <button class="btn" (click)="extractFromGame()" [disabled]="!selectedGameId || extracting">
                {{ extracting ? ('bank.extracting' | translate) : ('bank.extract' | translate) }}
              </button>
              <button class="btn-cancel" (click)="showExtractDialog = false">{{ 'bank.cancel' | translate }}</button>
            </div>
          </div>
        </div>

        <!-- Add Position Dialog -->
        <div class="dialog" *ngIf="showAddDialog">
          <div class="dialog-content">
            <h3>{{ 'bank.addPosition' | translate }}</h3>
            <div class="form-row">
              <label>{{ 'bank.fen' | translate }}</label>
              <input type="text" [(ngModel)]="newPosition.fen"
                     placeholder="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1">
            </div>
            <div class="form-row">
              <label>{{ 'bank.solutionSan' | translate }}</label>
              <input type="text" [(ngModel)]="newPosition.solution_san" placeholder="e.g. Nxf7">
            </div>
            <div class="form-row">
              <label>{{ 'bank.category' | translate }}</label>
              <select [(ngModel)]="newPosition.category">
                <option value="tactical">{{ 'bank.tactical' | translate }}</option>
                <option value="positional">{{ 'bank.positional' | translate }}</option>
                <option value="theoretical">{{ 'bank.theoretical' | translate }}</option>
                <option value="endgame">{{ 'bank.endgame' | translate }}</option>
              </select>
            </div>
            <div class="dialog-actions">
              <button class="btn" (click)="addPosition()">{{ 'bank.add' | translate }}</button>
              <button class="btn-cancel" (click)="showAddDialog = false">{{ 'bank.cancel' | translate }}</button>
            </div>
          </div>
        </div>

        <!-- Position Grid -->
        <div class="positions-grid" *ngIf="positions.length > 0; else noPositions">
          <div class="position-card" *ngFor="let p of positions">
            <div class="mini-board">
              <app-board
                [fen]="p.fen"
                [viewOnly]="true">
              </app-board>
            </div>
            <div class="position-info">
              <span class="category-badge" [class]="p.category">{{ p.category }}</span>
              <span class="solution">{{ p.solution_san }}</span>
              <span class="review-info" *ngIf="p.next_review_date">
                {{ 'bank.next' | translate }} {{ p.next_review_date }}
              </span>
              <span class="review-stats">
                {{ p.times_correct }}/{{ p.times_reviewed }} {{ 'bank.correct' | translate }}
              </span>
              <button class="btn-delete" (click)="deletePosition(p.id!)" [title]="'bank.delete' | translate">&times;</button>
            </div>
          </div>
        </div>
        <ng-template #noPositions>
          <div class="empty">
            {{ 'bank.noPositions' | translate }}
          </div>
        </ng-template>
      </div>

      <!-- Drill Mode -->
      <div *ngIf="mode === 'drill' && drill" class="drill-mode">
        <div *ngIf="!drill.finished">
          <div class="drill-header">
            <span>{{ 'bank.positionOf' | translate:{current: drill.currentIndex + 1, total: drill.positions.length} }}</span>
            <button class="btn-cancel" (click)="endDrill()">{{ 'bank.endDrill' | translate }}</button>
          </div>

          <div class="drill-board">
            <app-board
              [fen]="currentDrillFen"
              [orientation]="drillOrientation"
              [viewOnly]="drill.feedback !== 'none'"
              [interactive]="drill.feedback === 'none'"
              [legalMoves]="drillLegalMoves"
              (onMove)="onDrillMove($event)">
            </app-board>
          </div>

          <div class="drill-feedback" *ngIf="drill.feedback !== 'none'">
            <div class="feedback-msg" [class]="drill.feedback">
              <span *ngIf="drill.feedback === 'correct'">&#x2713; {{ 'bank.correctFeedback' | translate }}</span>
              <span *ngIf="drill.feedback === 'incorrect'">
                &#x2717; {{ 'bank.incorrectFeedback' | translate }} <strong>{{ drill.positions[drill.currentIndex].solution_san }}</strong>
              </span>
            </div>
            <div class="difficulty-select">
              <span>{{ 'bank.howDifficult' | translate }}</span>
              <div class="difficulty-buttons">
                <button *ngFor="let d of [1,2,3,4,5]"
                        [class.selected]="drillDifficulty === d"
                        (click)="drillDifficulty = d">{{ d }}</button>
              </div>
            </div>
            <button class="btn" (click)="nextDrillPosition()">{{ 'bank.nextBtn' | translate }}</button>
          </div>

          <div class="drill-prompt" *ngIf="drill.feedback === 'none'">
            <span class="prompt-text">{{ 'bank.findBestMove' | translate }}</span>
          </div>
        </div>

        <!-- Drill Summary -->
        <div *ngIf="drill.finished" class="drill-summary">
          <h2>{{ 'bank.drillComplete' | translate }}</h2>
          <div class="summary-stats">
            <div class="stat">
              <span class="stat-value">{{ drillCorrectCount }}/{{ drill.results.length }}</span>
              <span class="stat-label">{{ 'bank.correctLabel' | translate }}</span>
            </div>
            <div class="stat">
              <span class="stat-value">{{ drillAccuracy | number:'1.0-0' }}%</span>
              <span class="stat-label">{{ 'bank.accuracyLabel' | translate }}</span>
            </div>
          </div>
          <div class="summary-list">
            <div class="summary-item" *ngFor="let r of drill.results"
                 [class.correct]="r.correct" [class.incorrect]="!r.correct">
              <span>{{ r.position.solution_san }}</span>
              <span>{{ r.correct ? ('bank.correctLabel' | translate) : ('bank.missed' | translate) }}</span>
            </div>
          </div>
          <button class="btn" (click)="endDrill()">{{ 'bank.backToBank' | translate }}</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .bank {
      padding: 24px;
      max-width: 1000px;
      margin: 0 auto;
    }
    .bank-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
    }
    .bank-header h1 {
      color: #e0e0e0;
      font-size: 1.5rem;
      margin: 0;
    }
    .btn {
      background: #bf811d;
      color: #fff;
      border: none;
      border-radius: 4px;
      padding: 8px 16px;
      cursor: pointer;
      font-size: 0.85rem;
    }
    .btn:hover { background: #d4922a; }
    .btn:disabled { opacity: 0.5; cursor: default; }
    .btn-sm {
      background: #2e2b28;
      border: 1px solid #3d3a37;
      color: #bababa;
      padding: 6px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.8rem;
    }
    .btn-sm:hover { border-color: #bf811d; color: #e0e0e0; }
    .btn-cancel {
      background: transparent;
      border: 1px solid #3d3a37;
      color: #8a8886;
      padding: 6px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.85rem;
    }
    .btn-cancel:hover { border-color: #ac3333; color: #ac3333; }
    .filters {
      display: flex;
      gap: 12px;
      align-items: center;
      margin-bottom: 12px;
    }
    .filters select {
      background: #1a1917;
      border: 1px solid #3d3a37;
      border-radius: 4px;
      color: #e0e0e0;
      padding: 6px 10px;
      font-size: 0.85rem;
    }
    .checkbox-label {
      display: flex;
      align-items: center;
      gap: 6px;
      color: #bababa;
      font-size: 0.85rem;
      cursor: pointer;
    }
    .actions-bar {
      display: flex;
      gap: 8px;
      margin-bottom: 16px;
    }
    .dialog {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
    }
    .dialog-content {
      background: #262421;
      border: 1px solid #3d3a37;
      border-radius: 8px;
      padding: 20px;
      width: 90%;
      max-width: 450px;
    }
    .dialog-content h3 {
      color: #e0e0e0;
      margin: 0 0 12px;
    }
    .dialog-info {
      color: #8a8886;
      font-size: 0.85rem;
      margin-bottom: 12px;
    }
    .game-select {
      width: 100%;
      background: #1a1917;
      border: 1px solid #3d3a37;
      border-radius: 4px;
      color: #e0e0e0;
      padding: 8px;
      font-size: 0.85rem;
      margin-bottom: 12px;
    }
    .form-row {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-bottom: 10px;
    }
    .form-row label {
      color: #8a8886;
      font-size: 0.8rem;
    }
    .form-row input, .form-row select {
      background: #1a1917;
      border: 1px solid #3d3a37;
      border-radius: 4px;
      color: #e0e0e0;
      padding: 8px;
      font-size: 0.85rem;
    }
    .dialog-actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    }
    .positions-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 12px;
    }
    .position-card {
      background: #262421;
      border: 1px solid #3d3a37;
      border-radius: 6px;
      overflow: hidden;
    }
    .mini-board {
      aspect-ratio: 1;
      max-height: 180px;
    }
    .position-info {
      padding: 8px 10px;
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
    }
    .category-badge {
      font-size: 0.7rem;
      padding: 1px 6px;
      border-radius: 3px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .category-badge.tactical { background: #db3030; color: #fff; }
    .category-badge.positional { background: #56b4e9; color: #1a1917; }
    .category-badge.theoretical { background: #e6a817; color: #1a1917; }
    .category-badge.endgame { background: #81b64c; color: #1a1917; }
    .solution { color: #bababa; font-size: 0.8rem; font-weight: 600; }
    .review-info { color: #8a8886; font-size: 0.75rem; }
    .review-stats { color: #5a5856; font-size: 0.75rem; }
    .btn-delete {
      background: transparent;
      border: none;
      color: #5a5856;
      cursor: pointer;
      font-size: 1.1rem;
      margin-left: auto;
      padding: 0 4px;
    }
    .btn-delete:hover { color: #db3030; }
    .empty {
      color: #5a5856;
      text-align: center;
      padding: 40px;
      font-style: italic;
    }

    /* Drill Mode */
    .drill-mode {
      max-width: 500px;
      margin: 0 auto;
    }
    .drill-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      color: #bababa;
      font-size: 0.9rem;
    }
    .drill-board {
      margin-bottom: 12px;
    }
    .drill-prompt {
      text-align: center;
      padding: 12px;
    }
    .prompt-text {
      color: #bf811d;
      font-size: 1.1rem;
      font-weight: 600;
    }
    .drill-feedback {
      background: #262421;
      border: 1px solid #3d3a37;
      border-radius: 6px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      align-items: center;
    }
    .feedback-msg {
      font-size: 1rem;
      font-weight: 600;
    }
    .feedback-msg.correct { color: #81b64c; }
    .feedback-msg.incorrect { color: #db3030; }
    .difficulty-select {
      display: flex;
      align-items: center;
      gap: 10px;
      color: #8a8886;
      font-size: 0.85rem;
    }
    .difficulty-buttons {
      display: flex;
      gap: 4px;
    }
    .difficulty-buttons button {
      width: 30px;
      height: 30px;
      background: #1a1917;
      border: 1px solid #3d3a37;
      border-radius: 4px;
      color: #bababa;
      cursor: pointer;
      font-size: 0.85rem;
    }
    .difficulty-buttons button.selected {
      background: #bf811d;
      color: #fff;
      border-color: #bf811d;
    }
    .drill-summary {
      text-align: center;
    }
    .drill-summary h2 {
      color: #e0e0e0;
      margin-bottom: 16px;
    }
    .summary-stats {
      display: flex;
      justify-content: center;
      gap: 32px;
      margin-bottom: 20px;
    }
    .stat { text-align: center; }
    .stat .stat-value {
      display: block;
      color: #e0e0e0;
      font-size: 1.5rem;
      font-weight: 600;
    }
    .stat .stat-label {
      color: #8a8886;
      font-size: 0.8rem;
    }
    .summary-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-bottom: 16px;
    }
    .summary-item {
      display: flex;
      justify-content: space-between;
      padding: 6px 12px;
      border-radius: 4px;
      font-size: 0.85rem;
    }
    .summary-item.correct { background: #2a3a20; color: #81b64c; }
    .summary-item.incorrect { background: #3a2020; color: #db3030; }
  `],
})
export class PositionBankComponent implements OnInit {
  mode: ViewMode = 'list';
  positions: Position[] = [];
  duePositions: Position[] = [];
  analyzedGames: Game[] = [];

  // Filters
  filterCategory = '';
  filterDueOnly = false;

  // Dialogs
  showExtractDialog = false;
  showAddDialog = false;
  selectedGameId: number | null = null;
  extracting = false;
  newPosition = { fen: '', solution_san: '', category: 'tactical' };

  // Drill
  drill: DrillState | null = null;
  drillDifficulty = 3;
  currentDrillFen = '';
  drillOrientation: 'white' | 'black' = 'white';
  drillLegalMoves = new Map<string, string[]>();

  constructor(
    private positionService: PositionBankService,
    private db: DatabaseService,
    private chessLogic: ChessLogicService,
    private route: ActivatedRoute,
    private i18n: TranslationService,
  ) {}

  ngOnInit(): void {
    const cat = this.route.snapshot.queryParamMap.get('category');
    if (cat) this.filterCategory = cat;
    this.loadPositions();
    this.loadAnalyzedGames();
  }

  async loadPositions(): Promise<void> {
    try {
      this.positions = await this.positionService.getPositions({
        category: this.filterCategory || undefined,
        due_only: this.filterDueOnly,
      });
      // Also load due positions for drill button count
      this.duePositions = await this.positionService.getPositions({ due_only: true });
    } catch (err) {
      console.error('Failed to load positions:', err);
    }
  }

  async loadAnalyzedGames(): Promise<void> {
    try {
      const allGames = await this.db.getAllGames();
      this.analyzedGames = allGames.filter(g => g.analysis_json);
    } catch (err) {
      console.error('Failed to load games:', err);
    }
  }

  async extractFromGame(): Promise<void> {
    if (!this.selectedGameId) return;
    this.extracting = true;
    try {
      const extracted = await this.positionService.extractFromGame(this.selectedGameId);
      this.showExtractDialog = false;
      this.selectedGameId = null;
      if (extracted.length === 0) {
        alert(this.i18n.t('bank.noErrors'));
      }
      await this.loadPositions();
    } catch (err) {
      console.error('Failed to extract positions:', err);
    } finally {
      this.extracting = false;
    }
  }

  async addPosition(): Promise<void> {
    if (!this.newPosition.fen || !this.newPosition.solution_san) return;
    try {
      await this.positionService.createPosition(this.newPosition);
      this.showAddDialog = false;
      this.newPosition = { fen: '', solution_san: '', category: 'tactical' };
      await this.loadPositions();
    } catch (err) {
      console.error('Failed to add position:', err);
    }
  }

  async deletePosition(id: number): Promise<void> {
    try {
      await this.positionService.deletePosition(id);
      await this.loadPositions();
    } catch (err) {
      console.error('Failed to delete position:', err);
    }
  }

  // --- Drill Mode ---

  startDrill(): void {
    if (this.duePositions.length === 0) return;
    this.mode = 'drill';
    this.drill = {
      positions: [...this.duePositions],
      currentIndex: 0,
      userMove: '',
      feedback: 'none',
      showSolution: false,
      results: [],
      finished: false,
    };
    this.drillDifficulty = 3;
    this.loadDrillPosition();
  }

  private loadDrillPosition(): void {
    if (!this.drill) return;
    const pos = this.drill.positions[this.drill.currentIndex];
    this.currentDrillFen = pos.fen;
    this.drill.feedback = 'none';
    this.drill.showSolution = false;
    this.drillDifficulty = 3;

    // Determine orientation: side to move
    const parts = pos.fen.split(' ');
    this.drillOrientation = parts[1] === 'b' ? 'black' : 'white';

    // Compute legal moves for the board
    try {
      const chess = new Chess(pos.fen);
      const moves = chess.moves({ verbose: true });
      const legalMap = new Map<string, string[]>();
      for (const m of moves) {
        const dests = legalMap.get(m.from) || [];
        dests.push(m.to);
        legalMap.set(m.from, dests);
      }
      this.drillLegalMoves = legalMap;
    } catch {
      this.drillLegalMoves = new Map();
    }
  }

  onDrillMove(move: BoardMove): void {
    if (!this.drill || this.drill.feedback !== 'none') return;

    const pos = this.drill.positions[this.drill.currentIndex];

    // Convert the board move to SAN using chess.js
    try {
      const chess = new Chess(pos.fen);
      const result = chess.move({ from: move.from, to: move.to, promotion: move.promotion || 'q' });
      const moveSan = result?.san || '';

      const correct = this.normalizeSan(moveSan) === this.normalizeSan(pos.solution_san);
      this.drill.feedback = correct ? 'correct' : 'incorrect';
      this.drill.userMove = moveSan;
    } catch {
      this.drill.feedback = 'incorrect';
      this.drill.userMove = `${move.from}-${move.to}`;
    }
  }

  private normalizeSan(san: string): string {
    // Remove check/mate symbols and extra characters for comparison
    return san.replace(/[+#!?]/g, '').trim();
  }

  async nextDrillPosition(): Promise<void> {
    if (!this.drill) return;

    const pos = this.drill.positions[this.drill.currentIndex];
    const correct = this.drill.feedback === 'correct';

    // Record result
    this.drill.results.push({ position: pos, correct });

    // Submit review to backend (SM-2 update)
    try {
      await this.positionService.submitReview(pos.id!, {
        correct,
        difficulty_rating: this.drillDifficulty,
      });
    } catch (err) {
      console.error('Failed to submit review:', err);
    }

    // Next position or finish
    this.drill.currentIndex++;
    if (this.drill.currentIndex >= this.drill.positions.length) {
      this.drill.finished = true;
    } else {
      this.loadDrillPosition();
    }
  }

  get drillCorrectCount(): number {
    return this.drill?.results.filter(r => r.correct).length || 0;
  }

  get drillAccuracy(): number {
    if (!this.drill?.results.length) return 0;
    return (this.drillCorrectCount / this.drill.results.length) * 100;
  }

  endDrill(): void {
    this.mode = 'list';
    this.drill = null;
    this.loadPositions();
  }
}
