import { Injectable } from '@angular/core';
import { Chess, Move, Square } from 'chess.js';

export interface MoveResult {
  san: string;
  from: string;
  to: string;
  captured?: string;
  promotion?: string;
  flags: string;
  fen: string;
  isCheck: boolean;
  isCheckmate: boolean;
  isStalemate: boolean;
  isDraw: boolean;
  isGameOver: boolean;
}

@Injectable({ providedIn: 'root' })
export class ChessLogicService {
  private chess = new Chess();

  newGame(): void {
    this.chess = new Chess();
  }

  loadFen(fen: string): boolean {
    try {
      this.chess.load(fen);
      return true;
    } catch {
      return false;
    }
  }

  loadPgn(pgn: string): boolean {
    try {
      this.chess.loadPgn(pgn);
      return true;
    } catch {
      return false;
    }
  }

  makeMove(from: string, to: string, promotion?: string): MoveResult | null {
    try {
      const move = this.chess.move({ from: from as Square, to: to as Square, promotion: promotion as any });
      if (!move) return null;
      return this.toMoveResult(move);
    } catch {
      return null;
    }
  }

  makeMoveFromSan(san: string): MoveResult | null {
    try {
      const move = this.chess.move(san);
      if (!move) return null;
      return this.toMoveResult(move);
    } catch {
      return null;
    }
  }

  private toMoveResult(move: Move): MoveResult {
    return {
      san: move.san,
      from: move.from,
      to: move.to,
      captured: move.captured,
      promotion: move.promotion,
      flags: move.flags,
      fen: this.chess.fen(),
      isCheck: this.chess.isCheck(),
      isCheckmate: this.chess.isCheckmate(),
      isStalemate: this.chess.isStalemate(),
      isDraw: this.chess.isDraw(),
      isGameOver: this.chess.isGameOver(),
    };
  }

  getLegalMoves(): Map<string, string[]> {
    const dests = new Map<string, string[]>();
    const moves = this.chess.moves({ verbose: true });
    for (const m of moves) {
      const existing = dests.get(m.from) || [];
      existing.push(m.to);
      dests.set(m.from, existing);
    }
    return dests;
  }

  getLegalSanMoves(): string[] {
    return this.chess.moves();
  }

  isCheck(): boolean { return this.chess.isCheck(); }
  isCheckmate(): boolean { return this.chess.isCheckmate(); }
  isStalemate(): boolean { return this.chess.isStalemate(); }
  isDraw(): boolean { return this.chess.isDraw(); }
  isGameOver(): boolean { return this.chess.isGameOver(); }
  isThreefoldRepetition(): boolean { return this.chess.isThreefoldRepetition(); }
  isInsufficientMaterial(): boolean { return this.chess.isInsufficientMaterial(); }

  getFen(): string { return this.chess.fen(); }
  getPgn(): string { return this.chess.pgn(); }

  getHistory(verbose?: boolean): any[] {
    return this.chess.history({ verbose: verbose || false });
  }

  turn(): 'w' | 'b' { return this.chess.turn(); }

  undo(): Move | null {
    return this.chess.undo();
  }

  reset(): void {
    this.chess.reset();
  }

  getMoveNumber(): number {
    return this.chess.moveNumber();
  }

  header(...args: string[]): Record<string, string> {
    const raw = this.chess.header(...args);
    const result: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (v != null) result[k] = v;
    }
    return result;
  }
}
