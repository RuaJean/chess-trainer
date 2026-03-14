import {
  Component,
  ElementRef,
  ViewChild,
  Input,
  Output,
  EventEmitter,
  OnDestroy,
  OnChanges,
  SimpleChanges,
  AfterViewInit,
  ViewEncapsulation,
} from '@angular/core';
import { Chessground } from 'chessground';
import { Api } from 'chessground/api';
import { Config } from 'chessground/config';
import { Key } from 'chessground/types';
import { DrawShape } from 'chessground/draw';

export interface BoardMove {
  from: string;
  to: string;
  promotion?: string;
}

@Component({
  selector: 'app-board',
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  template: `<div class="board-wrap"><div #boardEl class="cg-wrap"></div></div>`,
  styles: [`
    :host {
      display: block;
    }
    .board-wrap {
      width: var(--board-size, 560px);
      height: var(--board-size, 560px);
    }
    .cg-wrap {
      width: 100%;
      height: 100%;
    }
    .cg-wrap, .cg-wrap * {
      box-sizing: content-box;
    }
  `],
})
export class BoardComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('boardEl') boardEl!: ElementRef<HTMLElement>;

  @Input() fen: string = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  @Input() orientation: 'white' | 'black' = 'white';
  @Input() interactive: boolean = true;
  @Input() legalMoves: Map<string, string[]> = new Map();
  @Input() lastMove: [string, string] | null = null;
  @Input() viewOnly: boolean = false;
  @Input() turnColor: 'white' | 'black' = 'white';
  @Input() autoShapes: { orig: string; dest: string; brush: string }[] = [];

  @Output() onMove = new EventEmitter<BoardMove>();
  @Output() onPromotion = new EventEmitter<BoardMove>();

  private api: Api | null = null;

  ngAfterViewInit(): void {
    this.initBoard();
  }

  ngOnChanges(_changes: SimpleChanges): void {
    if (!this.api) return;
    // Always do a full update to keep everything in sync
    this.syncBoard();
  }

  private initBoard(): void {
    const canMove = this.interactive && !this.viewOnly;

    const config: Config = {
      fen: this.fen,
      orientation: this.orientation,
      turnColor: this.turnColor,
      viewOnly: false, // We control interaction via movable, not viewOnly
      movable: {
        free: false,
        color: canMove ? this.orientation : undefined,
        dests: canMove ? this.toDests(this.legalMoves) : new Map(),
        showDests: true,
        events: {
          after: (orig: Key, dest: Key) => this.onPieceMoved(orig, dest),
        },
      },
      draggable: {
        enabled: true,
        showGhost: true,
      },
      highlight: {
        lastMove: true,
        check: true,
      },
      animation: {
        enabled: true,
        duration: 200,
      },
      premovable: {
        enabled: false,
      },
      coordinates: true,
    };

    if (this.lastMove) {
      config.lastMove = this.lastMove as [Key, Key];
    }

    this.api = Chessground(this.boardEl.nativeElement, config);
  }

  private syncBoard(): void {
    if (!this.api) return;

    const canMove = this.interactive && !this.viewOnly;

    const update: Partial<Config> = {
      fen: this.fen,
      orientation: this.orientation,
      turnColor: this.turnColor,
      lastMove: this.lastMove ? (this.lastMove as [Key, Key]) : undefined,
      movable: {
        color: canMove ? this.orientation : undefined,
        dests: canMove ? this.toDests(this.legalMoves) : new Map(),
      },
    };

    this.api.set(update);

    // Apply auto shapes (arrows) separately via API
    const shapes: DrawShape[] = this.autoShapes.map(s => ({
      orig: s.orig as Key,
      dest: s.dest as Key,
      brush: s.brush,
    }));
    this.api.setAutoShapes(shapes);
  }

  private toDests(moves: Map<string, string[]>): Map<Key, Key[]> {
    const dests = new Map<Key, Key[]>();
    moves.forEach((targets, from) => {
      dests.set(from as Key, targets as Key[]);
    });
    return dests;
  }

  private onPieceMoved(orig: Key, dest: Key): void {
    if (this.isPromotion(orig, dest)) {
      this.onPromotion.emit({ from: orig, to: dest });
      // Default to queen promotion
      this.onMove.emit({ from: orig, to: dest, promotion: 'q' });
    } else {
      this.onMove.emit({ from: orig, to: dest });
    }
  }

  private isPromotion(orig: Key, dest: Key): boolean {
    const destRank = dest.charAt(1);
    const origRank = orig.charAt(1);
    if (destRank === '8' && origRank === '7') return true;
    if (destRank === '1' && origRank === '2') return true;
    return false;
  }

  setCheck(color: 'white' | 'black' | false): void {
    if (this.api) {
      this.api.set({ check: color });
    }
  }

  ngOnDestroy(): void {
    if (this.api) {
      this.api.destroy();
    }
  }
}
