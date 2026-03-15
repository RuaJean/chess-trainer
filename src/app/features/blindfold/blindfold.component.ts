import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { BoardComponent, BoardMove } from '../../shared/components/board/board.component';
import { ClockComponent } from '../../shared/components/clock/clock.component';
import { MoveListComponent, MoveEntry } from '../../shared/components/move-list/move-list.component';
import { NewGameDialogComponent, NewGameOptions } from '../play-ai/new-game-dialog.component';
import { ChessLogicService, MoveResult } from '../../core/services/chess-logic.service';
import { StockfishService } from '../../core/services/stockfish.service';
import { ClockService } from '../../core/services/clock.service';
import { SpeechService, VoiceCommand, SpeechStatus } from '../../core/services/speech.service';
import { SoundService } from '../../core/services/sound.service';
import { TranslationService } from '../../core/services/translation.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { EngineConfig } from '../../models/engine-config.model';

@Component({
  selector: 'app-blindfold',
  standalone: true,
  imports: [CommonModule, FormsModule, BoardComponent, ClockComponent, MoveListComponent, NewGameDialogComponent, TranslatePipe],
  template: `
    <div class="blindfold-container">
      <div class="board-area">
        <app-clock [side]="topClockSide" [enabled]="clockEnabled"></app-clock>

        <div class="board-wrapper" [class.hidden-pieces]="hidePieces">
          <app-board
            [fen]="currentFen"
            [orientation]="playerColor"
            [interactive]="isPlayerTurn && !gameOver"
            [legalMoves]="legalMoves"
            [lastMove]="lastMove"
            [turnColor]="turnColor"
            (onMove)="onPlayerMove($event)">
          </app-board>
          <div class="pieces-overlay" *ngIf="hidePieces"></div>
        </div>

        <app-clock [side]="bottomClockSide" [enabled]="clockEnabled"></app-clock>
      </div>

      <div class="side-panel">
        <!-- Blindfold controls -->
        <div class="bf-controls card">
          <h3>{{ 'blindfold.title' | translate }}</h3>
          <div class="control-toggles">
            <label class="toggle">
              <input type="checkbox" [(ngModel)]="hidePieces">
              {{ 'blindfold.hidePieces' | translate }}
            </label>
            <label class="toggle">
              <input type="checkbox" [(ngModel)]="speakMoves" (change)="onSpeakToggle()">
              {{ 'blindfold.speakMoves' | translate }}
            </label>
            <label class="toggle" *ngIf="speechService.isRecognitionSupported">
              <input type="checkbox" [(ngModel)]="voiceInput" (change)="onVoiceInputToggle()">
              {{ 'blindfold.voiceInput' | translate }}
            </label>
          </div>
        </div>

        <!-- Voice status -->
        <div class="voice-section card" *ngIf="voiceInput">
          <div class="voice-status"
               [class.listening]="speechStatus === 'listening'"
               [class.processing]="speechStatus === 'processing'">
            <span class="mic-icon">{{ speechStatus === 'listening' ? '🎙️' : speechStatus === 'processing' ? '⏳' : '🔇' }}</span>
            <span>{{ voiceStatus }}</span>
          </div>
          <div class="voice-text" *ngIf="lastVoiceText">
            <span class="label">Heard:</span> "{{ lastVoiceText }}"
          </div>
          <div class="voice-suggestion" *ngIf="voiceSuggestion">
            {{ voiceSuggestion }}
          </div>
        </div>

        <!-- Game info -->
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

        <!-- Move list -->
        <div class="moves-panel card">
          <app-move-list
            [moves]="moveEntries"
            [currentMoveIndex]="currentMoveIdx"
            (moveSelected)="onMoveSelected($event)"
            (navigate)="onNavigate($event)">
          </app-move-list>
        </div>

        <!-- Game result -->
        <div class="game-result card" *ngIf="gameOver">
          <div class="result-text">{{ resultText }}</div>
          <div class="result-reason">{{ resultReason }}</div>
        </div>

        <!-- Controls -->
        <div class="controls card">
          <button class="btn btn-secondary" (click)="showNewGameDialog = true">{{ 'blindfold.newGame' | translate }}</button>
          <button class="btn btn-secondary" (click)="undoMove()" [disabled]="gameOver || !canUndo">{{ 'blindfold.undo' | translate }}</button>
          <button class="btn btn-danger" (click)="resign()" [disabled]="gameOver">{{ 'blindfold.resign' | translate }}</button>
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
    .blindfold-container {
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
    .board-wrapper {
      position: relative;
    }
    .pieces-overlay {
      position: absolute;
      inset: 0;
      z-index: 10;
      pointer-events: none;
    }
    /* Piece hiding is done via global styles.scss (.hidden-pieces .cg-wrap piece) */

    .side-panel {
      display: flex;
      flex-direction: column;
      gap: 10px;
      width: 280px;
      max-height: calc(100vh - 60px);
      overflow-y: auto;
    }

    .bf-controls h3 { color: #e0e0e0; font-size: 1em; margin-bottom: 10px; }
    .control-toggles {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .toggle {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #bababa;
      cursor: pointer;
      font-size: 0.9em;
    }
    .toggle input[type="checkbox"] {
      width: 16px;
      height: 16px;
      accent-color: #bf811d;
    }

    .voice-section { padding: 10px; }
    .voice-status {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px;
      border-radius: 4px;
      background: #302e2c;
      color: #8a8886;
      font-size: 0.9em;
    }
    .voice-status.listening {
      background: #1a3a1a;
      color: #629924;
    }
    .voice-status.processing {
      background: #3a351a;
      color: #bf811d;
    }
    .mic-icon { font-size: 1.2em; }
    .voice-text {
      margin-top: 8px;
      font-size: 0.85em;
      color: #bababa;
    }
    .voice-text .label { color: #8a8886; }
    .voice-suggestion {
      margin-top: 6px;
      font-size: 0.85em;
      color: #bf811d;
      font-style: italic;
    }

    .game-info { padding: 10px; }
    .players { display: flex; align-items: center; gap: 8px; justify-content: center; }
    .player { display: flex; align-items: center; gap: 6px; padding: 4px 8px; border-radius: 4px; color: #bababa; }
    .player.active { background: #3d3a37; color: #e0e0e0; }
    .piece-dot { width: 12px; height: 12px; border-radius: 50%; }
    .white-dot { background: #f0f0f0; }
    .black-dot { background: #333; border: 1px solid #666; }
    .vs { color: #8a8886; font-size: 0.85em; }

    .moves-panel { flex: 1; min-height: 150px; max-height: 300px; padding: 0; overflow: hidden; }

    .game-result { text-align: center; padding: 12px; }
    .result-text { font-size: 1.2rem; font-weight: 600; color: #e0e0e0; }
    .result-reason { color: #8a8886; font-size: 0.85em; margin-top: 4px; }

    .controls { display: flex; gap: 8px; justify-content: center; }
    .controls .btn { flex: 1; font-size: 0.85em; }
  `],
})
export class BlindfoldComponent implements OnInit, OnDestroy {
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
  canUndo = false;

  whiteName = '';
  blackName = '';
  clockEnabled = false;

  // Blindfold options
  hidePieces = true;
  speakMoves = true;
  voiceInput = false;
  voiceStatus = '';
  lastVoiceText = '';
  voiceSuggestion = '';
  speechStatus: SpeechStatus = 'stopped';

  private engineConfig!: EngineConfig;
  private subs: Subscription[] = [];
  private engineReady = false;
  private moveHistory: { san: string; fen: string }[] = [];

  constructor(
    private chessLogic: ChessLogicService,
    private stockfish: StockfishService,
    private clockService: ClockService,
    public speechService: SpeechService,
    private sound: SoundService,
    private i18n: TranslationService,
  ) {
    this.voiceStatus = this.i18n.t('blindfold.voiceReady');
  }

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
      this.clockService.onFlag$.subscribe(side => this.onFlagged(side))
    );

    // Listen for voice commands
    this.subs.push(
      this.speechService.onVoiceCommand$.subscribe(cmd => this.handleVoiceCommand(cmd))
    );

    // Listen for speech status changes
    this.subs.push(
      this.speechService.onStatusChange$.subscribe(status => this.onSpeechStatusChange(status))
    );

    // loadingProgress$ no longer needed — model runs on server
  }

  onSpeakToggle(): void {
    // nothing special needed
  }

  onVoiceInputToggle(): void {
    if (this.voiceInput) {
      this.speechService.startListening();
    } else {
      this.speechService.stopListening();
      this.voiceStatus = this.i18n.t('blindfold.voiceOff');
    }
  }

  private onSpeechStatusChange(status: SpeechStatus): void {
    this.speechStatus = status;
    if (!this.voiceInput) return;
    switch (status) {
      case 'listening':
        this.voiceStatus = 'Escuchando...';
        break;
      case 'processing':
        this.voiceStatus = 'Procesando...';
        break;
      case 'denied':
        this.voiceStatus = 'Micrófono denegado. Permite el acceso en tu navegador.';
        this.voiceInput = false;
        this.speechService.speak('Permiso de micrófono denegado.');
        break;
      case 'error':
        this.voiceStatus = 'Error en reconocimiento de voz. Intenta de nuevo.';
        break;
      case 'stopped':
        this.voiceStatus = this.i18n.t('blindfold.voiceOff');
        break;
    }
  }

  private async handleVoiceCommand(cmd: VoiceCommand): Promise<void> {
    if (!this.voiceInput || this.gameOver || !this.isPlayerTurn) return;

    this.lastVoiceText = cmd.text;
    this.voiceSuggestion = '';

    // Try to parse the voice command into a SAN move
    const san = this.speechService.parseSpanishToSan(cmd.text);
    if (!san) {
      this.voiceSuggestion = 'No entendí la jugada. Intenta: "caballo efe tres" o "e cuatro"';
      await this.speechService.speakAndWait('No entendí la jugada. Intenta de nuevo.');
      return;
    }

    // Try to make the move
    const result = this.chessLogic.makeMoveFromSan(san);
    if (result) {
      this.voiceSuggestion = '';
      await this.afterMove(result, result.from, result.to);
      if (!this.gameOver) {
        this.requestAiMove();
      }
    } else {
      // Get legal moves to suggest alternatives
      const legalMoves = this.chessLogic.getLegalSanMoves();
      // Try to find similar legal moves (same piece or same target square)
      const sanPiece = san.match(/^[KQRBN]/)?.[0] || '';
      const sanTarget = san.replace(/^[KQRBN]?x?/, '');
      const similar = legalMoves.filter((m: string) => {
        const mPiece = m.match(/^[KQRBN]/)?.[0] || '';
        const mTarget = m.replace(/^[KQRBN]?[a-h]?x?/, '');
        return (sanPiece && mPiece === sanPiece) || (sanTarget.length >= 2 && mTarget === sanTarget);
      }).slice(0, 3);

      // Convert suggestions to Spanish for display AND speech
      const similarSpanish = similar.map(m => this.speechService.moveToSpanish(m));
      const suggestion = similar.length > 0
        ? `Jugada ilegal: ${san}. ¿Quisiste decir ${similarSpanish.join(', ')}?`
        : `Jugada ilegal: ${san}. Intenta otra jugada.`;
      this.voiceSuggestion = suggestion;
      await this.speechService.speakAndWait(
        similar.length > 0
          ? `Jugada ilegal. Quisiste decir ${similarSpanish.join(', o ')}?`
          : 'Jugada ilegal. Intenta otra jugada.'
      );
    }
  }

  startNewGame(options: NewGameOptions): void {
    this.showNewGameDialog = false;
    this.playerColor = options.playerColor as 'white' | 'black';
    this.engineConfig = options.engineConfig;
    this.clockEnabled = options.clockConfig.initialTime > 0;

    this.whiteName = this.playerColor === 'white' ? this.i18n.t('play.you') : `Stockfish (${options.engineConfig.elo})`;
    this.blackName = this.playerColor === 'black' ? this.i18n.t('play.you') : `Stockfish (${options.engineConfig.elo})`;

    this.stockfish.setOptions(this.engineConfig);
    if (this.clockEnabled) this.clockService.configure(options.clockConfig);

    this.chessLogic.newGame();
    this.gameOver = false;
    this.resultText = '';
    this.resultReason = '';
    this.moveEntries = [];
    this.moveHistory = [];
    this.currentMoveIdx = -1;
    this.lastMove = null;
    this.canUndo = false;
    this.updateBoardState();

    if (this.playerColor === 'black') {
      if (this.clockEnabled) this.clockService.start('w');
      this.requestAiMove();
    } else if (this.clockEnabled) {
      this.clockService.start('w');
    }

    if (this.voiceInput) {
      this.speechService.startListening();
    }

    // Announce game start
    if (this.speakMoves) {
      const color = this.playerColor === 'white' ? 'blancas' : 'negras';
      this.speechService.speak(`Nueva partida. Juegas con ${color}. ${this.playerColor === 'white' ? 'Tu turno.' : 'Turno del oponente.'}`);
    }
  }

  async onPlayerMove(move: BoardMove): Promise<void> {
    if (this.gameOver || !this.isPlayerTurn) return;
    const result = this.chessLogic.makeMove(move.from, move.to, move.promotion);
    if (!result) return;
    await this.afterMove(result, move.from, move.to);
    if (!this.gameOver) this.requestAiMove();
  }

  private async afterMove(result: MoveResult, from: string, to: string): Promise<void> {
    // After makeMove(), the turn has already flipped, so invert isPlayerTurn
    const wasPlayerMove = !this.isPlayerTurn;

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
    } else {
      this.sound.play('move');
    }

    if (this.clockEnabled) this.clockService.switchTurn();
    this.canUndo = this.moveHistory.length >= 2 && !this.gameOver;

    if (result.isGameOver) {
      this.handleGameOver(result);
      return;
    }

    // Speak the move — await so AI doesn't cancel player speech
    if (this.speakMoves) {
      const moveText = this.speechService.moveToSpanish(result.san);
      if (!wasPlayerMove) {
        await this.speechService.speakAndWait(`Oponente juega: ${moveText}. Tu turno.`);
      } else {
        await this.speechService.speakAndWait(moveText);
      }
    }
  }

  private requestAiMove(): void {
    if (!this.engineReady || this.gameOver) return;
    const fen = this.chessLogic.getFen();
    const sub = this.stockfish.getBestMove(fen).subscribe(async bestMove => {
      if (this.gameOver) return;
      const from = bestMove.substring(0, 2);
      const to = bestMove.substring(2, 4);
      const promotion = bestMove.length > 4 ? bestMove[4] : undefined;
      const result = this.chessLogic.makeMove(from, to, promotion);
      if (result) await this.afterMove(result, from, to);
      sub.unsubscribe();
    });
    this.subs.push(sub);
  }

  private addMoveToList(san: string, fen: string): void {
    const totalMoves = this.moveHistory.length;
    const isWhiteMove = totalMoves % 2 === 1;
    const moveNum = Math.ceil(totalMoves / 2);

    if (isWhiteMove) {
      this.moveEntries = [...this.moveEntries, { moveNumber: moveNum, white: san, whiteFen: fen }];
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
    if (this.voiceInput) this.speechService.stopListening();

    if (result.isCheckmate) {
      const winner = this.chessLogic.turn() === 'w' ? 'Negras' : 'Blancas';
      this.resultText = `${winner} ganan`;
      this.resultReason = 'por jaque mate';
    } else if (result.isStalemate) {
      this.resultText = 'Tablas';
      this.resultReason = 'por ahogado';
    } else if (result.isDraw) {
      this.resultText = 'Tablas';
      this.resultReason = 'por empate';
    }

    // Always speak game result - user may be blindfolded
    this.speechService.speak(this.resultText + ', ' + this.resultReason);
  }

  private onFlagged(side: 'w' | 'b'): void {
    this.gameOver = true;
    this.clockService.stop();
    if (this.voiceInput) this.speechService.stopListening();
    const winner = side === 'w' ? 'Negras' : 'Blancas';
    this.resultText = `${winner} ganan`;
    this.resultReason = 'por tiempo';
    this.speechService.speak(this.resultText + ', ' + this.resultReason);
  }

  resign(): void {
    if (this.gameOver) return;
    this.gameOver = true;
    this.clockService.stop();
    this.stockfish.stop();
    if (this.voiceInput) this.speechService.stopListening();
    const winner = this.playerColor === 'white' ? 'Negras' : 'Blancas';
    this.resultText = `${winner} ganan`;
    this.resultReason = 'por rendición';
    this.speechService.speak(this.resultText + ', ' + this.resultReason);
  }

  undoMove(): void {
    if (this.gameOver || this.moveHistory.length < 2) return;
    this.chessLogic.undo();
    this.chessLogic.undo();
    this.moveHistory.splice(-2);
    this.stockfish.stop();
    this.rebuildMoveEntries();
    this.updateBoardState();

    if (this.moveHistory.length > 0) {
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
    this.moveEntries = [...this.moveEntries];
  }

  onMoveSelected(event: { index: number; fen?: string }): void {
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

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    this.clockService.stop();
    this.stockfish.stop();
    this.speechService.stopListening();
  }
}
