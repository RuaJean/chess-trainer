import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { Chess } from 'chess.js';
import { BoardComponent, BoardMove } from '../../shared/components/board/board.component';
import { MoveListComponent, MoveEntry } from '../../shared/components/move-list/move-list.component';
import { EvalChartComponent } from '../../shared/components/eval-chart/eval-chart.component';
import { ChessLogicService } from '../../core/services/chess-logic.service';
import { StockfishService, EngineEval } from '../../core/services/stockfish.service';
import { DatabaseService } from '../../core/services/database.service';
import {
  GameAnalysisService,
  FullAnalysisResult,
  AnalysisProgress,
  MoveAnalysis,
  MoveClassification,
} from '../../core/services/game-analysis.service';
import { Game } from '../../models/game.model';
import { OpeningService } from '../../core/services/opening.service';
import { TranslationService } from '../../core/services/translation.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-analysis',
  standalone: true,
  imports: [CommonModule, FormsModule, BoardComponent, MoveListComponent, EvalChartComponent, TranslatePipe],
  template: `
    <div class="analysis-container">
      <div class="board-area">
        <app-board
          [fen]="currentFen"
          [orientation]="orientation"
          [interactive]="true"
          [legalMoves]="legalMoves"
          [lastMove]="lastMove"
          [turnColor]="turnColor"
          [autoShapes]="boardArrows"
          (onMove)="onUserMove($event)">
        </app-board>

        <app-eval-chart *ngIf="fullAnalysis"
          [evalHistory]="fullAnalysis.evalHistory"
          [classifications]="classificationsList"
          [currentIndex]="currentMoveIdx"
          (moveClicked)="onChartMoveClicked($event)">
        </app-eval-chart>
      </div>

      <div class="side-panel">
        <!-- Real-time eval display -->
        <div class="eval-section card">
          <div class="eval-bar-container">
            <div class="eval-bar">
              <div class="eval-white" [style.height.%]="evalPercent"></div>
            </div>
            <div class="eval-info">
              <span class="eval-score">{{ evalDisplay }}</span>
              <span class="eval-depth">{{ 'analysis.depthLabel' | translate }} {{ currentDepth }}</span>
            </div>
          </div>
          <div class="engine-lines" *ngIf="engineLines.length > 0">
            <div class="pv-line" *ngFor="let line of engineLines; let i = index">
              <span class="pv-score" [ngClass]="line.scoreClass">{{ line.scoreText }}</span>
              <span class="pv-moves">{{ line.moves }}</span>
            </div>
          </div>
        </div>

        <!-- Engine controls -->
        <div class="engine-controls card">
          <div class="control-row">
            <label>{{ 'analysis.lines' | translate }}</label>
            <select [(ngModel)]="multiPv" (change)="restartAnalysis()">
              <option [value]="1">1</option>
              <option [value]="2">2</option>
              <option [value]="3">3</option>
            </select>
            <label>{{ 'analysis.depth' | translate }}</label>
            <select [(ngModel)]="maxDepth" (change)="restartAnalysis()">
              <option [value]="18">18</option>
              <option [value]="20">20</option>
              <option [value]="24">24</option>
              <option [value]="30">30</option>
            </select>
          </div>
          <div class="control-row">
            <button class="btn btn-secondary" [class.active]="analyzing" (click)="toggleAnalysis()">
              {{ analyzing ? ('analysis.stopEngine' | translate) : ('analysis.engine' | translate) }}
            </button>
            <button class="btn btn-secondary" (click)="flipBoard()">{{ 'analysis.flip' | translate }}</button>
            <button class="btn btn-secondary" (click)="resetBoard()">{{ 'analysis.reset' | translate }}</button>
          </div>
          <div class="control-row" *ngIf="hasLoadedGame && !isAnalyzingGame">
            <button class="btn btn-primary full-width" (click)="analyzeFullGame()">
              {{ fullAnalysis ? ('analysis.reanalyze' | translate) : ('analysis.analyzeGame' | translate) }}
            </button>
            <select [(ngModel)]="analysisDepth" class="depth-select">
              <option [ngValue]="10">{{ 'analysis.d10' | translate }}</option>
              <option [ngValue]="12">{{ 'analysis.d12' | translate }}</option>
              <option [ngValue]="16">{{ 'analysis.d16' | translate }}</option>
            </select>
          </div>
        </div>

        <!-- Full Analysis Progress -->
        <div class="progress-section card" *ngIf="isAnalyzingGame">
          <div class="progress-header">
            <span>{{ 'analysis.analyzing' | translate }}</span>
            <button class="btn btn-danger small" (click)="cancelFullAnalysis()">{{ 'analysis.cancel' | translate }}</button>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" [style.width.%]="analysisProgress?.percent || 0"></div>
          </div>
          <span class="progress-text">
            {{ 'analysis.moveOf' | translate:{ current: analysisProgress?.currentMove || 0, total: analysisProgress?.totalMoves || 0 } }}
          </span>
        </div>

        <!-- Full Analysis Results -->
        <div class="results-section card" *ngIf="fullAnalysis && !isAnalyzingGame">
          <div class="results-header">{{ 'analysis.gameAnalysis' | translate }}</div>
          <div class="accuracy-row">
            <div class="accuracy-col">
              <div class="accuracy-value white-text">{{ fullAnalysis.whiteAccuracy }}%</div>
              <div class="accuracy-label">{{ 'analysis.white' | translate }}</div>
              <div class="accuracy-detail">
                <span class="stat-inaccuracy">{{ fullAnalysis.whiteInaccuracies }} {{ 'analysis.inaccuracies' | translate }}</span>
                <span class="stat-mistake">{{ fullAnalysis.whiteMistakes }} {{ 'analysis.mistakes' | translate }}</span>
                <span class="stat-blunder">{{ fullAnalysis.whiteBlunders }} {{ 'analysis.blunders' | translate }}</span>
              </div>
              <div class="acpl-label">ACPL: {{ fullAnalysis.whiteACPL }}</div>
            </div>
            <div class="accuracy-col">
              <div class="accuracy-value black-text">{{ fullAnalysis.blackAccuracy }}%</div>
              <div class="accuracy-label">{{ 'analysis.black' | translate }}</div>
              <div class="accuracy-detail">
                <span class="stat-inaccuracy">{{ fullAnalysis.blackInaccuracies }} {{ 'analysis.inaccuracies' | translate }}</span>
                <span class="stat-mistake">{{ fullAnalysis.blackMistakes }} {{ 'analysis.mistakes' | translate }}</span>
                <span class="stat-blunder">{{ fullAnalysis.blackBlunders }} {{ 'analysis.blunders' | translate }}</span>
              </div>
              <div class="acpl-label">ACPL: {{ fullAnalysis.blackACPL }}</div>
            </div>
          </div>
        </div>

        <!-- Per-move detail -->
        <div class="move-detail card" *ngIf="selectedMoveAnalysis as ma">
          <div class="detail-header" [ngClass]="'cls-' + ma.classification">
            <span class="detail-cls">{{ classLabel(ma.classification) }}</span>
            <span class="detail-acc">{{ ma.accuracy | number:'1.0-0' }}% {{ 'analysis.accuracy' | translate }}</span>
          </div>
          <div class="detail-body">
            <div class="detail-row">
              <span class="detail-label">{{ 'analysis.played' | translate }}</span>
              <span class="detail-move">{{ ma.san }}</span>
            </div>
            <div class="detail-row" *ngIf="ma.evalBefore.bestMoveSan && ma.evalBefore.bestMoveSan !== ma.san">
              <span class="detail-label">{{ 'analysis.best' | translate }}</span>
              <span class="detail-move best">{{ ma.evalBefore.bestMoveSan }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">{{ 'analysis.winPct' | translate }}</span>
              <span>{{ ma.winPercentBefore | number:'1.0-0' }}% &rarr; {{ ma.winPercentAfter | number:'1.0-0' }}%</span>
            </div>
          </div>
        </div>

        <!-- Load FEN/PGN -->
        <div class="load-section card">
          <div class="load-tabs">
            <button [class.active]="loadTab === 'fen'" (click)="loadTab = 'fen'">{{ 'analysis.fen' | translate }}</button>
            <button [class.active]="loadTab === 'pgn'" (click)="loadTab = 'pgn'">{{ 'analysis.pgn' | translate }}</button>
          </div>
          <div *ngIf="loadTab === 'fen'">
            <input type="text" [(ngModel)]="fenInput" [placeholder]="'analysis.pasteFen' | translate"
                   class="full-input" (keyup.enter)="loadFen()">
            <button class="btn btn-primary small" (click)="loadFen()">{{ 'analysis.load' | translate }}</button>
          </div>
          <div *ngIf="loadTab === 'pgn'">
            <textarea [(ngModel)]="pgnInput" [placeholder]="'analysis.pastePgn' | translate" rows="3" class="full-input"></textarea>
            <button class="btn btn-primary small" (click)="loadPgn()">{{ 'analysis.load' | translate }}</button>
          </div>
        </div>

        <!-- Move list -->
        <div class="moves-panel card" *ngIf="moveEntries.length > 0">
          <app-move-list
            [moves]="moveEntries"
            [currentMoveIndex]="currentMoveIdx"
            (moveSelected)="onMoveSelected($event)"
            (navigate)="onNavigate($event)">
          </app-move-list>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .analysis-container {
      display: flex;
      gap: 20px;
      padding: 16px;
      height: 100%;
      align-items: flex-start;
      justify-content: center;
      overflow-y: auto;
      --board-size: min(calc(100vh - 160px), calc(100vw - 560px), 560px);
    }
    .board-area {
      display: flex;
      flex-direction: column;
      gap: 8px;
      width: var(--board-size, 560px);
    }
    .side-panel {
      display: flex;
      flex-direction: column;
      gap: 10px;
      width: 300px;
      max-height: calc(100vh - 60px);
      overflow-y: auto;
    }

    /* Eval */
    .eval-section { padding: 10px; }
    .eval-bar-container {
      display: flex;
      gap: 10px;
      align-items: stretch;
      min-height: 40px;
    }
    .eval-bar {
      width: 20px;
      min-height: 100px;
      background: #333;
      border-radius: 3px;
      position: relative;
      overflow: hidden;
      display: flex;
      flex-direction: column-reverse;
    }
    .eval-white {
      background: #f0f0f0;
      transition: height 300ms ease;
      width: 100%;
    }
    .eval-info {
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 2px;
    }
    .eval-score {
      font-family: 'Roboto Mono', monospace;
      font-size: 1.3rem;
      font-weight: 600;
      color: #e0e0e0;
    }
    .eval-depth { font-size: 0.75em; color: #8a8886; }

    .engine-lines { margin-top: 8px; }
    .pv-line {
      display: flex;
      gap: 8px;
      padding: 3px 0;
      font-size: 0.85em;
      border-bottom: 1px solid #302e2c;
    }
    .pv-score {
      font-family: 'Roboto Mono', monospace;
      font-weight: 600;
      min-width: 50px;
    }
    .pv-score.positive { color: #f0f0f0; }
    .pv-score.negative { color: #999; }
    .pv-score.mate { color: #ac3333; }
    .pv-moves {
      color: #bababa;
      font-family: 'Roboto Mono', monospace;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* Controls */
    .engine-controls { padding: 10px; }
    .control-row {
      display: flex;
      gap: 8px;
      align-items: center;
      margin-bottom: 6px;
    }
    .control-row:last-child { margin-bottom: 0; }
    .control-row label { font-size: 0.85em; color: #8a8886; }
    .control-row select { width: 60px; }
    .control-row .btn.active { background: #629924; color: #fff; }
    .control-row .btn { font-size: 0.85em; flex: 1; }
    .full-width { flex: 2 !important; }
    .depth-select { width: 100px !important; font-size: 0.85em; }

    /* Progress */
    .progress-section { padding: 10px; }
    .progress-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      font-size: 0.9em;
    }
    .progress-bar {
      height: 6px;
      background: #302e2c;
      border-radius: 3px;
      overflow: hidden;
      margin-bottom: 4px;
    }
    .progress-fill {
      height: 100%;
      background: #629924;
      transition: width 200ms ease;
      border-radius: 3px;
    }
    .progress-text {
      font-size: 0.8em;
      color: #8a8886;
    }

    /* Results */
    .results-section { padding: 12px; }
    .results-header {
      font-weight: 600;
      font-size: 0.95em;
      margin-bottom: 10px;
      color: #e0e0e0;
    }
    .accuracy-row {
      display: flex;
      gap: 16px;
    }
    .accuracy-col {
      flex: 1;
      text-align: center;
    }
    .accuracy-value {
      font-size: 1.4rem;
      font-weight: 700;
      font-family: 'Roboto Mono', monospace;
    }
    .white-text { color: #f0f0f0; }
    .black-text { color: #a0a0a0; }
    .accuracy-label {
      font-size: 0.8em;
      color: #8a8886;
      margin-bottom: 6px;
    }
    .accuracy-detail {
      display: flex;
      flex-direction: column;
      gap: 2px;
      font-size: 0.8em;
    }
    .stat-inaccuracy { color: #56b4e9; }
    .stat-mistake { color: #e6a817; }
    .stat-blunder { color: #db3030; }
    .acpl-label {
      font-size: 0.75em;
      color: #8a8886;
      margin-top: 4px;
    }

    /* Move detail */
    .move-detail { padding: 10px; }
    .detail-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 6px;
      margin-bottom: 6px;
      border-bottom: 1px solid #302e2c;
    }
    .detail-cls {
      font-weight: 600;
      font-size: 0.9em;
    }
    .detail-header.cls-blunder .detail-cls { color: #db3030; }
    .detail-header.cls-mistake .detail-cls { color: #e6a817; }
    .detail-header.cls-inaccuracy .detail-cls { color: #56b4e9; }
    .detail-header.cls-best .detail-cls { color: #96bc4b; }
    .detail-header.cls-good .detail-cls { color: #bababa; }
    .detail-header.cls-book .detail-cls { color: #a88adb; }
    .detail-acc {
      font-size: 0.8em;
      color: #8a8886;
    }
    .detail-body { font-size: 0.85em; }
    .detail-row {
      display: flex;
      gap: 8px;
      padding: 2px 0;
    }
    .detail-label {
      color: #8a8886;
      min-width: 50px;
    }
    .detail-move {
      font-family: 'Roboto Mono', monospace;
      font-weight: 500;
    }
    .detail-move.best { color: #96bc4b; }

    /* Load section */
    .load-section { padding: 10px; }
    .load-tabs {
      display: flex;
      gap: 4px;
      margin-bottom: 8px;
    }
    .load-tabs button {
      padding: 4px 12px;
      background: #302e2c;
      border: none;
      border-radius: 3px;
      color: #8a8886;
      cursor: pointer;
      font-size: 0.85em;
    }
    .load-tabs button.active { background: #3d3a37; color: #e0e0e0; }
    .full-input {
      width: 100%;
      margin-bottom: 6px;
      font-family: 'Roboto Mono', monospace;
      font-size: 0.8em;
    }
    textarea.full-input { resize: vertical; }
    .btn.small { padding: 4px 12px; font-size: 0.85em; }

    .moves-panel {
      height: 250px;
      padding: 0;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
  `],
})
export class AnalysisComponent implements OnInit, OnDestroy {
  // Board state
  orientation: 'white' | 'black' = 'white';
  currentFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  legalMoves = new Map<string, string[]>();
  lastMove: [string, string] | null = null;
  turnColor: 'white' | 'black' = 'white';

  // Move list
  moveEntries: MoveEntry[] = [];
  currentMoveIdx = -1;

  // Real-time engine
  analyzing = false;
  multiPv = 1;
  maxDepth = 20;
  currentDepth = 0;
  evalPercent = 50;
  evalDisplay = '0.0';
  engineLines: { scoreText: string; moves: string; scoreClass: string }[] = [];

  // Load
  loadTab: 'fen' | 'pgn' = 'fen';
  fenInput = '';
  pgnInput = '';

  // Full game analysis
  fullAnalysis: FullAnalysisResult | null = null;
  isAnalyzingGame = false;
  analysisProgress: AnalysisProgress | null = null;
  analysisDepth = 12;

  // Board arrows for best move suggestions
  boardArrows: { orig: string; dest: string; brush: string }[] = [];

  private chess = new Chess();
  private moveHistory: { san: string; fen: string; from: string; to: string }[] = [];
  private positions: { fen: string; from?: string; to?: string }[] = [];
  private analysisSub?: Subscription;
  private progressSub?: Subscription;
  private loadedGameId: number | null = null;

  constructor(
    private stockfish: StockfishService,
    private chessLogic: ChessLogicService,
    private db: DatabaseService,
    private gameAnalysis: GameAnalysisService,
    private openingService: OpeningService,
    private route: ActivatedRoute,
    private i18n: TranslationService,
  ) {}

  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) {
      return;
    }
    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault();
        this.onNavigate('back');
        break;
      case 'ArrowRight':
        event.preventDefault();
        this.onNavigate('forward');
        break;
      case 'ArrowUp':
      case 'Home':
        event.preventDefault();
        this.onNavigate('start');
        break;
      case 'ArrowDown':
      case 'End':
        event.preventDefault();
        this.onNavigate('end');
        break;
    }
  }

  get hasLoadedGame(): boolean {
    return this.moveHistory.length > 0;
  }

  get selectedMoveAnalysis(): MoveAnalysis | null {
    if (!this.fullAnalysis || this.currentMoveIdx < 0 || this.currentMoveIdx >= this.fullAnalysis.moves.length) {
      return null;
    }
    return this.fullAnalysis.moves[this.currentMoveIdx];
  }

  get classificationsList(): MoveClassification[] {
    return this.fullAnalysis?.moves.map(m => m.classification) || [];
  }

  classLabel(cls: MoveClassification): string {
    switch (cls) {
      case 'blunder': return this.i18n.t('analysis.blunder');
      case 'mistake': return this.i18n.t('analysis.mistake');
      case 'inaccuracy': return this.i18n.t('analysis.inaccuracy');
      case 'best': return this.i18n.t('analysis.bestMove');
      case 'good': return this.i18n.t('analysis.goodMove');
      case 'book': return this.i18n.t('analysis.bookMove');
    }
  }

  async ngOnInit(): Promise<void> {
    console.log('[ANALYSIS] ngOnInit: initializing stockfish...');
    await this.stockfish.init();
    console.log('[ANALYSIS] ngOnInit: stockfish ready');

    const gameId = this.route.snapshot.queryParamMap.get('gameId');
    if (gameId) {
      console.log('[ANALYSIS] Loading game from DB, id:', gameId);
      const game = await this.db.getGame(Number(gameId));
      if (game) {
        this.loadedGameId = game.id ?? null;
        this.loadGamePgn(game.pgn);

        // Load saved analysis if available
        if (game.analysis_json) {
          try {
            this.fullAnalysis = JSON.parse(game.analysis_json) as FullAnalysisResult;
            this.applyAnalysisToMoves();
            this.updateEvalFromAnalysis(this.positions.length - 1);
            console.log('[ANALYSIS] Loaded saved analysis from DB');
          } catch (e) {
            console.error('[ANALYSIS] Failed to parse saved analysis:', e);
          }
        }
        return;
      }
    }

    this.resetBoard();
    this.startAnalysis();
  }

  // --- Board interaction ---

  onUserMove(move: BoardMove): void {
    const result = this.chessLogic.makeMove(move.from, move.to, move.promotion);
    if (!result) return;

    // Clear full analysis if user makes a new move
    if (this.fullAnalysis) {
      this.fullAnalysis = null;
      this.boardArrows = [];
    }

    this.moveHistory.push({ san: result.san, fen: result.fen, from: move.from, to: move.to });
    this.positions.push({ fen: result.fen, from: move.from, to: move.to });
    this.addMoveToList(result.san, result.fen);
    this.updateBoardState();
    this.lastMove = [move.from, move.to];
    this.currentMoveIdx = this.moveHistory.length - 1;

    if (this.analyzing) {
      this.restartAnalysis();
    }
  }

  private addMoveToList(san: string, fen: string): void {
    const total = this.moveHistory.length;
    const isWhite = total % 2 === 1;
    const moveNum = Math.ceil(total / 2);

    if (isWhite) {
      this.moveEntries = [...this.moveEntries, { moveNumber: moveNum, white: san, whiteFen: fen }];
    } else {
      const last = { ...this.moveEntries[this.moveEntries.length - 1] };
      last.black = san;
      last.blackFen = fen;
      this.moveEntries = [...this.moveEntries.slice(0, -1), last];
    }
  }

  private updateBoardState(): void {
    this.currentFen = this.chessLogic.getFen();
    this.legalMoves = this.chessLogic.getLegalMoves();
    this.turnColor = this.chessLogic.turn() === 'w' ? 'white' : 'black';
  }

  // --- Real-time engine analysis ---

  toggleAnalysis(): void {
    if (this.analyzing) {
      this.stopAnalysis();
    } else {
      this.startAnalysis();
    }
  }

  startAnalysis(): void {
    this.stopAnalysis();
    this.analyzing = true;
    this.analysisSub = this.stockfish.analyze(this.currentFen, this.maxDepth, this.multiPv)
      .subscribe(evalData => this.onEvalUpdate(evalData));
  }

  stopAnalysis(): void {
    this.analyzing = false;
    this.stockfish.stop();
    this.analysisSub?.unsubscribe();
  }

  restartAnalysis(): void {
    if (this.analyzing) {
      this.startAnalysis();
    }
  }

  private onEvalUpdate(evalData: EngineEval): void {
    this.currentDepth = evalData.depth;

    if (evalData.multipv === 1) {
      if (evalData.mate !== null) {
        this.evalDisplay = `M${evalData.mate}`;
        this.evalPercent = evalData.mate > 0 ? 95 : 5;
      } else {
        const cp = this.turnColor === 'white' ? evalData.score : -evalData.score;
        const pawns = cp / 100;
        this.evalDisplay = (pawns >= 0 ? '+' : '') + pawns.toFixed(1);
        this.evalPercent = Math.max(5, Math.min(95, 50 + (cp / 10)));
      }
    }

    const idx = evalData.multipv - 1;
    while (this.engineLines.length < evalData.multipv) {
      this.engineLines.push({ scoreText: '', moves: '', scoreClass: '' });
    }

    let scoreText: string;
    let scoreClass: string;
    if (evalData.mate !== null) {
      scoreText = `M${evalData.mate}`;
      scoreClass = 'mate';
    } else {
      const cp = evalData.score;
      const pawns = cp / 100;
      scoreText = (pawns >= 0 ? '+' : '') + pawns.toFixed(1);
      scoreClass = cp >= 0 ? 'positive' : 'negative';
    }

    this.engineLines[idx] = {
      scoreText,
      scoreClass,
      moves: this.formatPv(evalData.pv),
    };
    this.engineLines = [...this.engineLines];
  }

  private formatPv(pv: string): string {
    const moves = pv.split(' ').slice(0, 8);
    const chess = new Chess(this.currentFen);
    const sans: string[] = [];
    for (const uci of moves) {
      try {
        const from = uci.substring(0, 2);
        const to = uci.substring(2, 4);
        const promo = uci.length > 4 ? uci[4] : undefined;
        const m = chess.move({ from: from as any, to: to as any, promotion: promo as any });
        if (m) sans.push(m.san);
        else break;
      } catch { break; }
    }
    return sans.join(' ');
  }

  // --- Full game analysis ---

  async analyzeFullGame(): Promise<void> {
    console.log('[ANALYSIS] analyzeFullGame called, moveHistory.length:', this.moveHistory.length, 'isAnalyzingGame:', this.isAnalyzingGame);
    if (this.moveHistory.length === 0 || this.isAnalyzingGame) {
      console.log('[ANALYSIS] analyzeFullGame: skipping (no moves or already analyzing)');
      return;
    }

    console.log('[ANALYSIS] Stopping real-time analysis...');
    this.stopAnalysis();
    this.isAnalyzingGame = true;
    this.fullAnalysis = null;
    this.analysisProgress = null;

    const fens = this.positions.map(p => p.fen);
    const moves = this.moveHistory.map(m => ({ san: m.san, from: m.from, to: m.to }));

    // Detect opening length for book move classification
    const sans = this.moveHistory.map(m => m.san);
    const opening = this.openingService.detectOpening(sans);
    const bookPly = opening?.ply || 0;
    console.log(`[ANALYSIS] Starting full game analysis: ${fens.length} positions, ${moves.length} moves, depth=${this.analysisDepth}, bookPly=${bookPly}${opening ? ` (${opening.name})` : ''}`);

    this.progressSub = this.gameAnalysis.onProgress$.subscribe(p => {
      console.log(`[ANALYSIS] Progress update: move ${p.currentMove}/${p.totalMoves} (${p.percent}%)`);
      this.analysisProgress = p;
    });

    try {
      console.log('[ANALYSIS] Calling gameAnalysis.analyzeGame...');
      this.fullAnalysis = await this.gameAnalysis.analyzeGame(
        fens, moves, this.stockfish, Number(this.analysisDepth), bookPly,
      );
      console.log('[ANALYSIS] Full analysis complete! Applying to moves...');
      this.applyAnalysisToMoves();
      this.updateEvalFromAnalysis(this.currentMoveIdx + 1);

      // Save analysis to DB if loaded from library
      if (this.loadedGameId) {
        try {
          await this.db.updateGame(this.loadedGameId, {
            analysis_json: JSON.stringify(this.fullAnalysis),
          });
          console.log('[ANALYSIS] Analysis saved to DB for game', this.loadedGameId);
        } catch (e) {
          console.error('[ANALYSIS] Failed to save analysis to DB:', e);
        }
      }
      console.log('[ANALYSIS] Done!');
    } catch (e: any) {
      if (e.message !== 'Analysis aborted') {
        console.error('[ANALYSIS] Analysis failed:', e);
      } else {
        console.log('[ANALYSIS] Analysis was aborted');
      }
    } finally {
      this.isAnalyzingGame = false;
      this.analysisProgress = null;
      this.progressSub?.unsubscribe();
    }
  }

  cancelFullAnalysis(): void {
    this.gameAnalysis.abort();
  }

  private applyAnalysisToMoves(): void {
    if (!this.fullAnalysis) return;
    const updated = this.moveEntries.map(e => ({ ...e }));
    for (const ma of this.fullAnalysis.moves) {
      const entryIdx = Math.floor(ma.moveIndex / 2);
      if (entryIdx >= updated.length) continue;
      if (ma.color === 'w') {
        updated[entryIdx].whiteClass = ma.classification;
      } else {
        updated[entryIdx].blackClass = ma.classification;
      }
    }
    this.moveEntries = updated;
  }

  private updateEvalFromAnalysis(posIdx: number): void {
    if (!this.fullAnalysis || posIdx < 0 || posIdx >= this.fullAnalysis.evalHistory.length) return;

    const winPct = this.fullAnalysis.evalHistory[posIdx];
    this.evalPercent = winPct;

    // Get the PositionEval for this position
    let posEval = null;
    if (posIdx === 0 && this.fullAnalysis.moves.length > 0) {
      posEval = this.fullAnalysis.moves[0].evalBefore;
    } else if (posIdx > 0 && posIdx <= this.fullAnalysis.moves.length) {
      posEval = this.fullAnalysis.moves[posIdx - 1].evalAfter;
    }

    if (posEval) {
      if (posEval.mate !== null) {
        this.evalDisplay = `M${posEval.mate}`;
      } else {
        const pawns = posEval.cp / 100;
        this.evalDisplay = (pawns >= 0 ? '+' : '') + pawns.toFixed(1);
      }
      this.currentDepth = posEval.depth;
    }

    this.updateBoardArrows(posIdx);
  }

  private updateBoardArrows(posIdx: number): void {
    this.boardArrows = [];
    if (!this.fullAnalysis) return;

    // For the current position, show the best move arrow
    // posIdx is the position index (0 = start, 1 = after move 0, etc.)
    // The best move for position posIdx is stored in the evalBefore of move posIdx
    // (i.e., the best move FROM this position)
    let bestMove = '';
    if (posIdx < this.fullAnalysis.moves.length) {
      // There's a next move - show the best move from this position
      bestMove = this.fullAnalysis.moves[posIdx].evalBefore.bestMove;
    }

    // Also show the played move as red arrow if it was a mistake/blunder
    if (this.currentMoveIdx >= 0 && this.currentMoveIdx < this.fullAnalysis.moves.length) {
      const ma = this.fullAnalysis.moves[this.currentMoveIdx];
      const cls = ma.classification;
      if (cls === 'blunder' || cls === 'mistake' || cls === 'inaccuracy') {
        // Show what was the best move for the position BEFORE this move
        const bestBefore = ma.evalBefore.bestMove;
        if (bestBefore && bestBefore.length >= 4) {
          this.boardArrows.push({
            orig: bestBefore.substring(0, 2),
            dest: bestBefore.substring(2, 4),
            brush: 'green',
          });
        }
      }
    }

    // Show best move arrow for current position (looking forward)
    if (bestMove && bestMove.length >= 4 && posIdx < this.fullAnalysis.moves.length) {
      const arrow = {
        orig: bestMove.substring(0, 2),
        dest: bestMove.substring(2, 4),
        brush: 'blue',
      };
      // Don't duplicate if already added as green
      const isDuplicate = this.boardArrows.some(a => a.orig === arrow.orig && a.dest === arrow.dest);
      if (!isDuplicate) {
        this.boardArrows.push(arrow);
      }
    }
  }

  onChartMoveClicked(moveIdx: number): void {
    const posIdx = moveIdx + 1;
    if (posIdx >= 0 && posIdx < this.positions.length) {
      this.goToPositionIdx(posIdx);
      if (this.analyzing) this.restartAnalysis();
    }
  }

  // --- UI ---

  flipBoard(): void {
    this.orientation = this.orientation === 'white' ? 'black' : 'white';
  }

  resetBoard(): void {
    this.stopAnalysis();
    this.chess = new Chess();
    this.chessLogic.newGame();
    this.moveHistory = [];
    this.positions = [{ fen: this.chess.fen() }];
    this.moveEntries = [];
    this.currentMoveIdx = -1;
    this.lastMove = null;
    this.engineLines = [];
    this.currentDepth = 0;
    this.evalDisplay = '0.0';
    this.evalPercent = 50;
    this.fullAnalysis = null;
    this.updateBoardState();
    this.startAnalysis();
  }

  loadFen(): void {
    if (!this.fenInput.trim()) return;
    this.stopAnalysis();
    try {
      this.chess = new Chess(this.fenInput.trim());
      this.chessLogic.loadFen(this.fenInput.trim());
    } catch { return; }
    this.moveHistory = [];
    this.positions = [{ fen: this.chess.fen() }];
    this.moveEntries = [];
    this.currentMoveIdx = -1;
    this.lastMove = null;
    this.engineLines = [];
    this.fullAnalysis = null;
    this.updateBoardState();
    this.startAnalysis();
  }

  loadPgn(): void {
    if (!this.pgnInput.trim()) return;
    this.loadGamePgn(this.pgnInput.trim());
  }

  private loadGamePgn(pgnText: string): void {
    console.log('[ANALYSIS] loadGamePgn called, pgnText length:', pgnText.length);
    this.stopAnalysis();
    const chess = new Chess();
    try { chess.loadPgn(pgnText); } catch (e) { console.error('[ANALYSIS] Failed to load PGN:', e); return; }

    const history = chess.history({ verbose: true });
    chess.reset();

    this.chessLogic.newGame();
    this.moveHistory = [];
    this.moveEntries = [];
    this.positions = [{ fen: chess.fen() }];
    this.engineLines = [];
    this.fullAnalysis = null;

    for (let i = 0; i < history.length; i++) {
      const m = history[i];
      chess.move(m.san);
      this.chessLogic.makeMoveFromSan(m.san);

      this.moveHistory.push({ san: m.san, fen: chess.fen(), from: m.from, to: m.to });
      this.positions.push({ fen: chess.fen(), from: m.from, to: m.to });

      const isWhite = i % 2 === 0;
      const moveNum = Math.floor(i / 2) + 1;
      if (isWhite) {
        this.moveEntries.push({ moveNumber: moveNum, white: m.san, whiteFen: chess.fen() });
      } else {
        const last = this.moveEntries[this.moveEntries.length - 1];
        last.black = m.san;
        last.blackFen = chess.fen();
      }
    }

    this.moveEntries = [...this.moveEntries];

    if (this.positions.length > 1) {
      this.goToPositionIdx(this.positions.length - 1);
    } else {
      this.updateBoardState();
    }
    this.startAnalysis();
  }

  // --- Navigation ---

  private goToPositionIdx(idx: number): void {
    const pos = this.positions[idx];
    this.chessLogic.loadFen(pos.fen);
    this.updateBoardState();
    this.lastMove = pos.from && pos.to ? [pos.from, pos.to] : null;
    this.currentMoveIdx = idx - 1;

    if (this.fullAnalysis) {
      this.updateEvalFromAnalysis(idx);
    } else {
      this.boardArrows = [];
    }
  }

  onMoveSelected(event: { index: number; fen?: string }): void {
    this.goToPositionIdx(event.index + 1);
    if (this.analyzing) this.restartAnalysis();
  }

  onNavigate(direction: 'start' | 'back' | 'forward' | 'end'): void {
    const total = this.positions.length;
    const current = this.currentMoveIdx + 1;
    let target = current;

    switch (direction) {
      case 'start': target = 0; break;
      case 'back': target = Math.max(0, current - 1); break;
      case 'forward': target = Math.min(total - 1, current + 1); break;
      case 'end': target = total - 1; break;
    }

    if (target !== current) {
      this.goToPositionIdx(target);
      if (this.analyzing) this.restartAnalysis();
    }
  }

  ngOnDestroy(): void {
    this.stopAnalysis();
    this.progressSub?.unsubscribe();
    if (this.isAnalyzingGame) {
      this.gameAnalysis.abort();
    }
  }
}
