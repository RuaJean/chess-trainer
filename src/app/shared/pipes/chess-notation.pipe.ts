import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'chessNotation',
  standalone: true,
})
export class ChessNotationPipe implements PipeTransform {
  private pieceSymbols: Record<string, string> = {
    'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘',
    'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞',
  };

  transform(san: string, useSymbols: boolean = false): string {
    if (!useSymbols || !san) return san;

    return san.replace(/^([KQRBN])/, (_, piece) => {
      return this.pieceSymbols[piece] || piece;
    });
  }
}
