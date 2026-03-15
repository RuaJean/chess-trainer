import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import { StockfishService, EngineEval } from './stockfish.service';
import { Chess } from 'chess.js';

// --- Lichess-equivalent formulas ---

/** Convert centipawns to win% using Lichess's sigmoid (from real game data regression) */
export function cpToWinPercent(cp: number): number {
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}

/** Win% for mate scores */
export function mateToWinPercent(movesToMate: number): number {
  return movesToMate > 0 ? 100 : 0;
}

/** Per-move accuracy (Lichess formula) */
export function moveAccuracy(winBefore: number, winAfter: number): number {
  const drop = winBefore - winAfter;
  if (drop <= 0) return 100;
  const acc = 103.1668 * Math.exp(-0.04354 * drop) - 3.1669;
  return Math.max(0, Math.min(100, acc));
}

/** Classify a move based on win% drop (Lichess thresholds) */
export type MoveClassification = 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder' | 'book';

export function classifyMove(winDropPercent: number): MoveClassification {
  const drop = winDropPercent / 100;
  if (drop >= 0.30) return 'blunder';
  if (drop >= 0.20) return 'mistake';
  if (drop >= 0.10) return 'inaccuracy';
  if (drop <= 0.02) return 'best';
  return 'good';
}

export interface PositionEval {
  fen: string;
  cp: number;
  mate: number | null;
  winPercent: number;
  bestMove: string;
  bestMoveSan: string;
  depth: number;
  pv: string;
}

export interface MoveAnalysis {
  moveIndex: number;
  san: string;
  fen: string;
  color: 'w' | 'b';
  evalBefore: PositionEval;
  evalAfter: PositionEval;
  winPercentBefore: number;
  winPercentAfter: number;
  winDrop: number;
  classification: MoveClassification;
  accuracy: number;
  cpLoss: number;
}

export interface FullAnalysisResult {
  moves: MoveAnalysis[];
  whiteAccuracy: number;
  blackAccuracy: number;
  whiteACPL: number;
  blackACPL: number;
  whiteInaccuracies: number;
  whiteMistakes: number;
  whiteBlunders: number;
  blackInaccuracies: number;
  blackMistakes: number;
  blackBlunders: number;
  evalHistory: number[];
}

export interface AnalysisProgress {
  currentMove: number;
  totalMoves: number;
  percent: number;
}

@Injectable({ providedIn: 'root' })
export class GameAnalysisService {
  private progress$ = new Subject<AnalysisProgress>();
  private aborted = false;

  get onProgress$(): Observable<AnalysisProgress> {
    return this.progress$.asObservable();
  }

  abort(): void {
    console.log('[GA] abort() called');
    this.aborted = true;
  }

  /**
   * Run full Lichess-style analysis on a game.
   * Uses fast sequential evaluation (hash table reuse between positions).
   */
  async analyzeGame(
    positions: string[],
    moves: { san: string; from: string; to: string }[],
    stockfish: StockfishService,
    depth: number = 12,
    bookPly: number = 0,
  ): Promise<FullAnalysisResult> {
    this.aborted = false;
    const totalMoves = moves.length;
    const positionEvals: PositionEval[] = [];
    const t0 = performance.now();

    console.log(`[GA] ===== STARTING ANALYSIS: ${totalMoves} moves, depth ${depth} =====`);

    // One-time setup: stop, clear hash, set MultiPV
    await stockfish.prepareGameAnalysis();

    // Evaluate all positions (N+1 positions for N moves)
    for (let i = 0; i <= totalMoves; i++) {
      if (this.aborted) throw new Error('Analysis aborted');

      this.progress$.next({
        currentMove: i,
        totalMoves: totalMoves + 1,
        percent: Math.round((i / (totalMoves + 1)) * 100),
      });

      const fen = positions[i];
      const posT0 = performance.now();

      // Check for terminal positions (checkmate, stalemate, draw)
      // Stockfish hangs on these because there are no legal moves
      const terminalEval = this.checkTerminalPosition(fen);
      if (terminalEval) {
        console.log(`[GA] Pos ${i}/${totalMoves}: terminal position (${terminalEval.mate !== null ? 'checkmate' : 'draw'})`);
        positionEvals.push(terminalEval);
        continue;
      }

      // Fast sequential evaluation - no ucinewgame, keeps hash table
      const { evals, bestMove } = await stockfish.evaluateNext(fen, depth);

      const elapsed = ((performance.now() - posT0) / 1000).toFixed(1);
      const evalResult = this.buildPositionEval(fen, evals, bestMove);

      console.log(`[GA] Pos ${i}/${totalMoves}: ${elapsed}s, d${evalResult.depth}, cp=${evalResult.cp}, best=${evalResult.bestMoveSan || bestMove}`);
      positionEvals.push(evalResult);
    }

    const totalTime = ((performance.now() - t0) / 1000).toFixed(1);
    console.log(`[GA] All positions evaluated in ${totalTime}s`);

    // Build move analyses
    const moveAnalyses: MoveAnalysis[] = [];
    const evalHistory: number[] = [positionEvals[0].winPercent];

    for (let i = 0; i < totalMoves; i++) {
      const evalBefore = positionEvals[i];
      const evalAfter = positionEvals[i + 1];
      const color: 'w' | 'b' = i % 2 === 0 ? 'w' : 'b';

      const winBefore = color === 'w' ? evalBefore.winPercent : (100 - evalBefore.winPercent);
      const winAfter = color === 'w' ? evalAfter.winPercent : (100 - evalAfter.winPercent);
      const winDrop = Math.max(0, winBefore - winAfter);

      const cpBefore = color === 'w' ? evalBefore.cp : -evalBefore.cp;
      const cpAfter = color === 'w' ? evalAfter.cp : -evalAfter.cp;
      const cappedBefore = Math.max(-1000, Math.min(1000, cpBefore));
      const cappedAfter = Math.max(-1000, Math.min(1000, cpAfter));
      const cpLoss = Math.max(0, cappedBefore - cappedAfter);

      const isBook = i < bookPly;
      const classification = isBook ? 'book' : classifyMove(winDrop);
      const acc = isBook ? 100 : moveAccuracy(winBefore, winAfter);

      moveAnalyses.push({
        moveIndex: i,
        san: moves[i].san,
        fen: positions[i + 1],
        color,
        evalBefore,
        evalAfter,
        winPercentBefore: winBefore,
        winPercentAfter: winAfter,
        winDrop,
        classification,
        accuracy: acc,
        cpLoss: isBook ? 0 : cpLoss,
      });

      evalHistory.push(evalAfter.winPercent);
    }

    // Compute aggregate stats (exclude book moves from ACPL and accuracy)
    const whiteMoves = moveAnalyses.filter(m => m.color === 'w');
    const blackMoves = moveAnalyses.filter(m => m.color === 'b');
    const whiteNonBook = whiteMoves.filter(m => m.classification !== 'book');
    const blackNonBook = blackMoves.filter(m => m.classification !== 'book');

    const whiteACPL = whiteNonBook.length > 0
      ? whiteNonBook.reduce((s, m) => s + m.cpLoss, 0) / whiteNonBook.length
      : 0;
    const blackACPL = blackNonBook.length > 0
      ? blackNonBook.reduce((s, m) => s + m.cpLoss, 0) / blackNonBook.length
      : 0;

    const whiteAccuracy = this.computeGameAccuracy(whiteNonBook);
    const blackAccuracy = this.computeGameAccuracy(blackNonBook);

    const result: FullAnalysisResult = {
      moves: moveAnalyses,
      whiteAccuracy,
      blackAccuracy,
      whiteACPL: Math.round(whiteACPL),
      blackACPL: Math.round(blackACPL),
      whiteInaccuracies: whiteNonBook.filter(m => m.classification === 'inaccuracy').length,
      whiteMistakes: whiteNonBook.filter(m => m.classification === 'mistake').length,
      whiteBlunders: whiteNonBook.filter(m => m.classification === 'blunder').length,
      blackInaccuracies: blackNonBook.filter(m => m.classification === 'inaccuracy').length,
      blackMistakes: blackNonBook.filter(m => m.classification === 'mistake').length,
      blackBlunders: blackNonBook.filter(m => m.classification === 'blunder').length,
      evalHistory,
    };

    console.log(`[GA] ===== DONE in ${totalTime}s =====`);
    console.log(`[GA] White: ${whiteAccuracy}% acc, ACPL ${result.whiteACPL}, ?!=${result.whiteInaccuracies} ?=${result.whiteMistakes} ??=${result.whiteBlunders}`);
    console.log(`[GA] Black: ${blackAccuracy}% acc, ACPL ${result.blackACPL}, ?!=${result.blackInaccuracies} ?=${result.blackMistakes} ??=${result.blackBlunders}`);

    return result;
  }

  /** Check if a position is terminal (no legal moves) and return eval without Stockfish. */
  private checkTerminalPosition(fen: string): PositionEval | null {
    try {
      const chess = new Chess(fen);
      if (!chess.isGameOver()) return null;

      const sideToMove = fen.split(' ')[1];

      if (chess.isCheckmate()) {
        // Side to move is checkmated → the OTHER side wins
        const cp = sideToMove === 'w' ? -10000 : 10000;
        const mate = sideToMove === 'w' ? -1 : 1;
        const winPercent = sideToMove === 'w' ? 0 : 100;
        return { fen, cp, mate, winPercent, bestMove: '', bestMoveSan: '', depth: 0, pv: '' };
      }

      // Stalemate or draw (insufficient material, 50-move, threefold)
      return { fen, cp: 0, mate: null, winPercent: 50, bestMove: '', bestMoveSan: '', depth: 0, pv: '' };
    } catch {
      return null;
    }
  }

  /** Build a PositionEval from the collected eval infos and bestmove. */
  private buildPositionEval(fen: string, evals: EngineEval[], bestMove: string): PositionEval {
    const result: PositionEval = {
      fen,
      cp: 0,
      mate: null,
      winPercent: 50,
      bestMove: bestMove || '',
      bestMoveSan: '',
      depth: 0,
      pv: '',
    };

    const sideToMove = fen.split(' ')[1];

    // Use the deepest eval
    for (const evalData of evals) {
      if (evalData.depth >= result.depth) {
        if (evalData.mate !== null) {
          const mateFromWhite = sideToMove === 'w' ? evalData.mate : -evalData.mate;
          result.cp = mateFromWhite > 0 ? 10000 : -10000;
          result.mate = mateFromWhite;
          result.winPercent = mateToWinPercent(mateFromWhite);
        } else {
          const cpFromWhite = sideToMove === 'w' ? evalData.score : -evalData.score;
          result.cp = cpFromWhite;
          result.mate = null;
          result.winPercent = cpToWinPercent(cpFromWhite);
        }
        result.depth = evalData.depth;
        result.pv = evalData.pv;
      }
    }

    // Convert bestmove UCI to SAN
    if (bestMove) {
      try {
        const chess = new Chess(fen);
        const from = bestMove.substring(0, 2);
        const to = bestMove.substring(2, 4);
        const promo = bestMove.length > 4 ? bestMove[4] : undefined;
        const m = chess.move({ from, to, promotion: promo });
        if (m) result.bestMoveSan = m.san;
      } catch {}
    }

    return result;
  }

  private computeGameAccuracy(moves: MoveAnalysis[]): number {
    if (moves.length === 0) return 0;
    const accuracies = moves.map(m => Math.max(m.accuracy, 0.1));
    const harmonicMean = accuracies.length / accuracies.reduce((s, a) => s + (1 / a), 0);
    const simpleMean = accuracies.reduce((s, a) => s + a, 0) / accuracies.length;
    return Math.round(((harmonicMean + simpleMean) / 2) * 10) / 10;
  }
}
