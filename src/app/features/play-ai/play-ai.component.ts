import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { BoardComponent, BoardMove } from '../../shared/components/board/board.component';
import { ClockComponent } from '../../shared/components/clock/clock.component';
import { MoveListComponent, MoveEntry } from '../../shared/components/move-list/move-list.component';
import { NewGameDialogComponent, NewGameOptions } from './new-game-dialog.component';
import { ChessLogicService, MoveResult } from '../../core/services/chess-logic.service';
import { StockfishService } from '../../core/services/stockfish.service';
import { ClockService } from '../../core/services/clock.service';
import { DatabaseService } from '../../core/services/database.service';
import { SoundService } from '../../core/services/sound.service';
import { TranslationService } from '../../core/services/translation.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { EngineConfig } from '../../models/engine-config.model';

@Component({
  selector: 'app-play-ai',
  standalone: true,
  imports: [CommonModule, BoardComponent, ClockComponent, MoveListComponent, NewGameDialogComponent, TranslatePipe],
  template: `
    <div class="play-container">
      <div class="board-area">
        <app-clock [side]="topClockSide" [enabled]="clockEnabled"></app-clock>

        <app-board
          [fen]="currentFen"
          [orientation]="playerColor"
          [interactive]="isPlayerTurn && !gameOver"
          [legalMoves]="legalMoves"
          [lastMove]="lastMove"
          [turnColor]="turnColor"
          (onMove)="onPlayerMove($event)">
        </app-board>

        <app-clock [side]="bottomClockSide" [enabled]="clockEnabled"></app-clock>
      </div>

      <div class="side-panel">
        <div class="game-info card">
          <div class="players">
            <div class="player" [class.active]="turnColor === 'black'">
              <span class="piece-dot black-dot"></span>
              <span>{{ blackName }}</span>
            </div>
            <div class="vs">vs</div>
            <div class="player" [class.active]="turnColor === 'white'">
              <span class="piece-dot white-dot"></span>
              <span>{{ whiteName }}</span>
            </div>
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

        <div class="game-result card" *ngIf="gameOver">
          <div class="result-text">{{ resultText }}</div>
          <div class="result-reason">{{ resultReason }}</div>
        </div>

        <div class="controls card">
          <button class="btn btn-secondary" (click)="showNewGameDialog = true">
            {{ 'play.newGame' | translate }}
          </button>
          <button class="btn btn-secondary" (click)="undoMove()" [disabled]="gameOver || !canUndo">
            {{ 'play.undo' | translate }}
          </button>
          <button class="btn btn-secondary" (click)="offerDraw()" [disabled]="gameOver">
            {{ 'play.draw' | translate }}
          </button>
          <button class="btn btn-danger" (click)="resign()" [disabled]="gameOver">
            {{ 'play.resign' | translate }}
          </button>
        </div>
      </div>
    </div>

    <app-new-game-dialog
      *ngIf="showNewGameDialog"
      (close)="showNewGameDialog = false"
      (startNewGame)="startNewGame($event)">
    </app-new-game-dialog>
  `,
  styles: [`
    .play-container {
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
      max-height: calc(100vh - 60px);
    }
    .game-info {
      padding: 12px;
    }
    .players {
      display: flex;
      align-items: center;
      gap: 8px;
      justify-content: center;
    }
    .player {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 8px;
      border-radius: 4px;
      color: #bababa;
    }
    .player.active {
      background: #3d3a37;
      color: #e0e0e0;
    }
    .piece-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
    }
    .white-dot { background: #f0f0f0; }
    .black-dot { background: #333; border: 1px solid #666; }
    .vs { color: #8a8886; font-size: 0.85em; }

    .moves-panel {
      flex: 1;
      min-height: 200px;
      max-height: 400px;
      padding: 0;
      overflow: hidden;
    }

    .game-result {
      text-align: center;
      padding: 16px;
    }
    .result-text {
      font-size: 1.3rem;
      font-weight: 600;
      color: #e0e0e0;
    }
    .result-reason {
      color: #8a8886;
      font-size: 0.9em;
      margin-top: 4px;
    }

    .controls {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: center;
    }
    .controls .btn {
      flex: 1;
      min-width: 80px;
      font-size: 0.85em;
      padding: 8px 10px;
    }
  `],
})
export class PlayAiComponent implements OnInit, OnDestroy {
  showNewGameDialog = true;

  playerColor: 'white' | 'black' = 'white';
  currentFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  legalMoves = new Map<string, string[]>();
  lastMove: [string, string] | null = null;
  turnColor: 'white' | 'black' = 'white';

  moveEntries: MoveEntry[] = [];
  currentMoveIdx = -1;

  gameOver = false;
  resultText = '';
  resultReason = '';
  resultCode = '*';
  canUndo = false;

  whiteName = '';
  blackName = '';

  clockEnabled = false;
  private engineConfig!: EngineConfig;

  private subs: Subscription[] = [];
  private engineReady = false;
  private moveHistory: { san: string; fen: string }[] = [];

  constructor(
    private chessLogic: ChessLogicService,
    private stockfish: StockfishService,
    private clockService: ClockService,
    private db: DatabaseService,
    private sound: SoundService,
    private i18n: TranslationService,
  ) {}

  get isPlayerTurn(): boolean {
    const turn = this.chessLogic.turn();
    return (turn === 'w' && this.playerColor === 'white') ||
           (turn === 'b' && this.playerColor === 'black');
  }

  get topClockSide(): 'w' | 'b' {
    return this.playerColor === 'white' ? 'b' : 'w';
  }

  get bottomClockSide(): 'w' | 'b' {
    return this.playerColor === 'white' ? 'w' : 'b';
  }

  async ngOnInit(): Promise<void> {
    await this.stockfish.init();
    this.engineReady = true;

    this.subs.push(
      this.clockService.onFlag$.subscribe(side => {
        this.onFlagged(side);
      })
    );
  }

  startNewGame(options: NewGameOptions): void {
    this.showNewGameDialog = false;

    this.playerColor = options.playerColor as 'white' | 'black';
    this.engineConfig = options.engineConfig;
    this.clockEnabled = options.clockConfig.initialTime > 0;

    this.whiteName = this.playerColor === 'white' ? this.i18n.t('play.you') : `Stockfish (${options.engineConfig.elo})`;
    this.blackName = this.playerColor === 'black' ? this.i18n.t('play.you') : `Stockfish (${options.engineConfig.elo})`;

    this.stockfish.setOptions(this.engineConfig);

    if (this.clockEnabled) {
      this.clockService.configure(options.clockConfig);
    }

    this.chessLogic.newGame();
    this.gameOver = false;
    this.resultText = '';
    this.resultReason = '';
    this.resultCode = '*';
    this.moveEntries = [];
    this.moveHistory = [];
    this.currentMoveIdx = -1;
    this.lastMove = null;
    this.canUndo = false;

    this.updateBoardState();

    // If player is black, AI moves first
    if (this.playerColor === 'black') {
      if (this.clockEnabled) {
        this.clockService.start('w');
      }
      this.requestAiMove();
    } else if (this.clockEnabled) {
      this.clockService.start('w');
    }
  }

  onPlayerMove(move: BoardMove): void {
    if (this.gameOver || !this.isPlayerTurn) return;

    const result = this.chessLogic.makeMove(move.from, move.to, move.promotion);
    if (!result) return;

    this.afterMove(result, move.from, move.to);

    if (!this.gameOver) {
      this.requestAiMove();
    }
  }

  private afterMove(result: MoveResult, from: string, to: string): void {
    this.lastMove = [from, to];
    this.moveHistory.push({ san: result.san, fen: result.fen });
    this.addMoveToList(result.san, result.fen);
    this.updateBoardState();

    // Play sound
    if (result.isCheckmate || result.isGameOver) {
      this.sound.play('gameEnd');
    } else if (result.isCheck) {
      this.sound.play('check');
    } else if (result.captured) {
      this.sound.play('capture');
    } else if (result.flags.includes('k') || result.flags.includes('q')) {
      this.sound.play('castle');
    } else if (result.promotion) {
      this.sound.play('promote');
    } else {
      this.sound.play('move');
    }

    if (this.clockEnabled) {
      this.clockService.switchTurn();
    }

    this.canUndo = this.moveHistory.length >= 2 && !this.gameOver;

    if (result.isGameOver) {
      this.handleGameOver(result);
    }
  }

  private requestAiMove(): void {
    console.log(`[PlayAI] requestAiMove: engineReady=${this.engineReady}, gameOver=${this.gameOver}`);
    if (!this.engineReady || this.gameOver) return;

    const fen = this.chessLogic.getFen();
    const sub = this.stockfish.getBestMove(fen).subscribe(bestMove => {
      if (this.gameOver) return;

      const from = bestMove.substring(0, 2);
      const to = bestMove.substring(2, 4);
      const promotion = bestMove.length > 4 ? bestMove[4] : undefined;

      const result = this.chessLogic.makeMove(from, to, promotion);
      if (result) {
        this.afterMove(result, from, to);
      }
      sub.unsubscribe();
    });
    this.subs.push(sub);
  }

  private addMoveToList(san: string, fen: string): void {
    const totalMoves = this.moveHistory.length;
    const isWhiteMove = totalMoves % 2 === 1; // odd = white just moved
    const moveNum = Math.ceil(totalMoves / 2);

    if (isWhiteMove) {
      this.moveEntries = [...this.moveEntries, {
        moveNumber: moveNum,
        white: san,
        whiteFen: fen,
      }];
    } else {
      const last = { ...this.moveEntries[this.moveEntries.length - 1] };
      last.black = san;
      last.blackFen = fen;
      this.moveEntries = [...this.moveEntries.slice(0, -1), last];
    }

    this.currentMoveIdx = totalMoves - 1;
  }

  private updateBoardState(): void {
    this.currentFen = this.chessLogic.getFen();
    this.legalMoves = this.chessLogic.getLegalMoves();
    this.turnColor = this.chessLogic.turn() === 'w' ? 'white' : 'black';
  }

  private handleGameOver(result: MoveResult): void {
    this.gameOver = true;
    this.clockService.stop();

    if (result.isCheckmate) {
      const isWhiteWin = this.chessLogic.turn() === 'b';
      this.resultCode = isWhiteWin ? '1-0' : '0-1';
      this.resultText = this.i18n.t(isWhiteWin ? 'play.whiteWins' : 'play.blackWins');
      this.resultReason = this.i18n.t('play.byCheckmate');
    } else if (result.isStalemate) {
      this.resultCode = '1/2-1/2';
      this.resultText = this.i18n.t('play.drawResult');
      this.resultReason = this.i18n.t('play.byStalemate');
    } else if (result.isDraw) {
      this.resultCode = '1/2-1/2';
      this.resultText = this.i18n.t('play.drawResult');
      if (this.chessLogic.isThreefoldRepetition()) {
        this.resultReason = this.i18n.t('play.byRepetition');
      } else if (this.chessLogic.isInsufficientMaterial()) {
        this.resultReason = this.i18n.t('play.byInsufficient');
      } else {
        this.resultReason = this.i18n.t('play.by50Move');
      }
    }

    this.saveGame();
  }

  private onFlagged(side: 'w' | 'b'): void {
    this.gameOver = true;
    this.clockService.stop();
    const isWhiteWin = side === 'b';
    this.resultCode = isWhiteWin ? '1-0' : '0-1';
    this.resultText = this.i18n.t(isWhiteWin ? 'play.whiteWins' : 'play.blackWins');
    this.resultReason = this.i18n.t('play.onTime');
    this.saveGame();
  }

  resign(): void {
    if (this.gameOver) return;
    this.gameOver = true;
    this.clockService.stop();
    this.stockfish.stop();
    const isWhiteWin = this.playerColor === 'black';
    this.resultCode = isWhiteWin ? '1-0' : '0-1';
    this.resultText = this.i18n.t(isWhiteWin ? 'play.whiteWins' : 'play.blackWins');
    this.resultReason = this.i18n.t('play.byResignation');
    this.saveGame();
  }

  offerDraw(): void {
    if (this.gameOver) return;
    this.gameOver = true;
    this.clockService.stop();
    this.stockfish.stop();
    this.resultCode = '1/2-1/2';
    this.resultText = this.i18n.t('play.drawResult');
    this.resultReason = this.i18n.t('play.byAgreement');
    this.saveGame();
  }

  undoMove(): void {
    if (this.gameOver || this.moveHistory.length < 2) return;

    // Undo two moves (player + AI)
    this.chessLogic.undo();
    this.chessLogic.undo();
    this.moveHistory.splice(-2);
    this.stockfish.stop();

    // Rebuild move entries
    this.rebuildMoveEntries();
    this.updateBoardState();

    if (this.moveHistory.length > 0) {
      const lastHistoryMove = this.moveHistory[this.moveHistory.length - 1];
      // Reconstruct lastMove from the history
      this.currentMoveIdx = this.moveHistory.length - 1;
    } else {
      this.lastMove = null;
      this.currentMoveIdx = -1;
    }

    this.canUndo = this.moveHistory.length >= 2;
  }

  private rebuildMoveEntries(): void {
    this.moveEntries = [];
    for (let i = 0; i < this.moveHistory.length; i++) {
      const { san, fen } = this.moveHistory[i];
      const isWhite = i % 2 === 0;
      const moveNum = Math.floor(i / 2) + 1;

      if (isWhite) {
        this.moveEntries.push({ moveNumber: moveNum, white: san, whiteFen: fen });
      } else {
        const last = this.moveEntries[this.moveEntries.length - 1];
        last.black = san;
        last.blackFen = fen;
      }
    }
    this.moveEntries = [...this.moveEntries]; // trigger change detection
  }

  onMoveSelected(event: { index: number; fen?: string }): void {
    // Navigate to a specific position (view only, doesn't change game state)
    if (event.fen) {
      this.currentFen = event.fen;
      this.currentMoveIdx = event.index;
    }
  }

  onNavigate(direction: 'start' | 'back' | 'forward' | 'end'): void {
    const total = this.moveHistory.length;
    if (total === 0) return;

    switch (direction) {
      case 'start':
        this.currentMoveIdx = -1;
        this.currentFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
        break;
      case 'back':
        if (this.currentMoveIdx > 0) {
          this.currentMoveIdx--;
          this.currentFen = this.moveHistory[this.currentMoveIdx].fen;
        } else if (this.currentMoveIdx === 0) {
          this.currentMoveIdx = -1;
          this.currentFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
        }
        break;
      case 'forward':
        if (this.currentMoveIdx < total - 1) {
          this.currentMoveIdx++;
          this.currentFen = this.moveHistory[this.currentMoveIdx].fen;
        }
        break;
      case 'end':
        this.currentMoveIdx = total - 1;
        this.currentFen = this.moveHistory[total - 1].fen;
        break;
    }
  }

  private async saveGame(): Promise<void> {
    const result = this.resultCode;

    this.chessLogic.header(
      'Event', 'AI Game',
      'Site', 'Chess Trainer',
      'Date', new Date().toISOString().split('T')[0],
      'White', this.whiteName,
      'Black', this.blackName,
      'Result', result,
    );

    try {
      const collectionId = await this.db.getAiGamesCollectionId();
      await this.db.addGame({
        pgn: this.chessLogic.getPgn(),
        white: this.whiteName,
        black: this.blackName,
        date: new Date().toISOString().split('T')[0],
        result,
        event: 'AI Game',
        site: 'Chess Trainer',
        eco: '',
        tags: {},
        source: 'ai-game',
        collection_id: collectionId,
        created_at: new Date(),
      });
    } catch (e) {
      console.error('Failed to save game:', e);
    }
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    this.clockService.stop();
    this.stockfish.stop();
  }
}
