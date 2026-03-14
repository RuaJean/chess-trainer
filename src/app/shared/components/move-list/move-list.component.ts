import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges,
  ElementRef,
  ViewChild,
  AfterViewChecked,
} from '@angular/core';
import { CommonModule } from '@angular/common';

export interface MoveEntry {
  moveNumber: number;
  white?: string;
  black?: string;
  whiteFen?: string;
  blackFen?: string;
  whiteClass?: string;
  blackClass?: string;
}

@Component({
  selector: 'app-move-list',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="move-list-container">
      <div class="moves-scroll" #scrollContainer>
        <div class="move-pairs">
          <div class="move-pair" *ngFor="let entry of moves; let i = index">
            <span class="move-number">{{ entry.moveNumber }}.</span>
            <span class="move white-move"
                  [class.active]="currentMoveIndex === i * 2"
                  [class.cls-best]="entry.whiteClass === 'best'"
                  [class.cls-inaccuracy]="entry.whiteClass === 'inaccuracy'"
                  [class.cls-mistake]="entry.whiteClass === 'mistake'"
                  [class.cls-blunder]="entry.whiteClass === 'blunder'"
                  (click)="onMoveClick(i * 2, entry.whiteFen)">
              {{ entry.white }}{{ glyphFor(entry.whiteClass) }}
            </span>
            <span class="move black-move"
                  *ngIf="entry.black"
                  [class.active]="currentMoveIndex === i * 2 + 1"
                  [class.cls-best]="entry.blackClass === 'best'"
                  [class.cls-inaccuracy]="entry.blackClass === 'inaccuracy'"
                  [class.cls-mistake]="entry.blackClass === 'mistake'"
                  [class.cls-blunder]="entry.blackClass === 'blunder'"
                  (click)="onMoveClick(i * 2 + 1, entry.blackFen)">
              {{ entry.black }}{{ glyphFor(entry.blackClass) }}
            </span>
          </div>
        </div>
      </div>
      <div class="nav-buttons">
        <button class="btn-icon" (click)="goToStart()" title="Start">⏮</button>
        <button class="btn-icon" (click)="goBack()" title="Back">◀</button>
        <button class="btn-icon" (click)="goForward()" title="Forward">▶</button>
        <button class="btn-icon" (click)="goToEnd()" title="End">⏭</button>
      </div>
    </div>
  `,
  styles: [`
    .move-list-container {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: #262421;
      border-radius: 4px;
    }
    .moves-scroll {
      flex: 1;
      overflow-y: auto;
      padding: 8px;
      min-height: 0;
    }
    .move-pair {
      display: flex;
      gap: 4px;
      padding: 2px 0;
      align-items: center;
    }
    .move-number {
      color: #8a8886;
      min-width: 30px;
      text-align: right;
      font-size: 0.85em;
    }
    .move {
      padding: 2px 6px;
      border-radius: 3px;
      cursor: pointer;
      font-family: 'Roboto Mono', monospace;
      font-size: 0.9em;
      min-width: 55px;
      color: #bababa;
    }
    .move:hover {
      background: #3d3a37;
    }
    .move.active {
      background: #bf811d;
      color: #fff;
      font-weight: 500;
    }
    .move.cls-best:not(.active) { color: #96bc4b; }
    .move.cls-inaccuracy:not(.active) { color: #56b4e9; }
    .move.cls-mistake:not(.active) { color: #e6a817; }
    .move.cls-blunder:not(.active) { color: #db3030; }
    .nav-buttons {
      display: flex;
      justify-content: center;
      gap: 4px;
      padding: 8px;
      border-top: 1px solid #3d3a37;
    }
    .btn-icon {
      padding: 6px 12px;
      background: #3d3a37;
      border: none;
      border-radius: 4px;
      color: #bababa;
      cursor: pointer;
      font-size: 0.9em;
    }
    .btn-icon:hover {
      background: #4d4a47;
    }
  `],
})
export class MoveListComponent implements OnChanges, AfterViewChecked {
  @ViewChild('scrollContainer') scrollContainer!: ElementRef;

  @Input() moves: MoveEntry[] = [];
  @Input() currentMoveIndex: number = -1;

  @Output() moveSelected = new EventEmitter<{ index: number; fen?: string }>();
  @Output() navigate = new EventEmitter<'start' | 'back' | 'forward' | 'end'>();

  private shouldScroll = false;

  glyphFor(cls?: string): string {
    if (cls === 'blunder') return '??';
    if (cls === 'mistake') return '?';
    if (cls === 'inaccuracy') return '?!';
    return '';
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['moves'] || changes['currentMoveIndex']) {
      this.shouldScroll = true;
    }
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll && this.scrollContainer) {
      this.shouldScroll = false;
      const container = this.scrollContainer.nativeElement;
      const activeEl = container.querySelector('.move.active') as HTMLElement;
      if (activeEl) {
        const containerRect = container.getBoundingClientRect();
        const activeRect = activeEl.getBoundingClientRect();
        const relativeTop = activeRect.top - containerRect.top + container.scrollTop;
        container.scrollTop = relativeTop - containerRect.height / 2 + activeRect.height / 2;
      }
    }
  }

  onMoveClick(index: number, fen?: string): void {
    this.moveSelected.emit({ index, fen });
  }

  goToStart(): void { this.navigate.emit('start'); }
  goBack(): void { this.navigate.emit('back'); }
  goForward(): void { this.navigate.emit('forward'); }
  goToEnd(): void { this.navigate.emit('end'); }
}
