import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges,
  ElementRef,
  ViewChild,
  AfterViewInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MoveClassification } from '../../../core/services/game-analysis.service';

@Component({
  selector: 'app-eval-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="chart-container" (click)="onChartClick($event)" #chartContainer>
      <canvas #canvas></canvas>
      <div class="chart-marker" *ngIf="currentIndex >= 0"
           [style.left.px]="markerX"></div>
    </div>
  `,
  styles: [`
    .chart-container {
      position: relative;
      width: 100%;
      height: 100px;
      background: #1a1917;
      border-radius: 4px;
      cursor: pointer;
      overflow: hidden;
    }
    canvas {
      width: 100%;
      height: 100%;
    }
    .chart-marker {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 2px;
      background: #bf811d;
      pointer-events: none;
    }
  `],
})
export class EvalChartComponent implements AfterViewInit, OnChanges {
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('chartContainer') containerRef!: ElementRef<HTMLDivElement>;

  /** Win% from white's perspective for each position (start + after each move) */
  @Input() evalHistory: number[] = [];
  /** Move classifications for coloring */
  @Input() classifications: MoveClassification[] = [];
  /** Currently selected move index (-1 = start) */
  @Input() currentIndex: number = -1;

  @Output() moveClicked = new EventEmitter<number>();

  markerX = 0;

  ngAfterViewInit(): void {
    this.draw();
  }

  ngOnChanges(_changes: SimpleChanges): void {
    this.draw();
    this.updateMarker();
  }

  private draw(): void {
    const canvas = this.canvasRef?.nativeElement;
    const container = this.containerRef?.nativeElement;
    if (!canvas || !container || this.evalHistory.length < 2) return;

    const rect = container.getBoundingClientRect();
    const w = rect.width || 400;
    const h = rect.height || 100;

    canvas.width = w * 2; // higher res
    canvas.height = h * 2;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';

    const ctx = canvas.getContext('2d')!;
    ctx.scale(2, 2);
    ctx.clearRect(0, 0, w, h);

    const points = this.evalHistory;
    const n = points.length;
    const stepX = w / (n - 1);
    const midY = h / 2;

    // Draw center line (equality)
    ctx.strokeStyle = '#3d3a37';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(w, midY);
    ctx.stroke();

    // Draw white area (above center when white is winning)
    ctx.beginPath();
    ctx.moveTo(0, midY);
    for (let i = 0; i < n; i++) {
      const x = i * stepX;
      const winPct = points[i]; // 0-100, 50 = equal
      const y = midY - ((winPct - 50) / 50) * midY;
      ctx.lineTo(x, Math.max(0, Math.min(h, y)));
    }
    ctx.lineTo((n - 1) * stepX, midY);
    ctx.closePath();

    // White area
    ctx.fillStyle = 'rgba(240, 240, 240, 0.3)';
    ctx.fill();

    // Black area (mirror)
    ctx.beginPath();
    ctx.moveTo(0, midY);
    for (let i = 0; i < n; i++) {
      const x = i * stepX;
      const winPct = points[i];
      const y = midY - ((winPct - 50) / 50) * midY;
      ctx.lineTo(x, Math.max(0, Math.min(h, y)));
    }
    ctx.lineTo((n - 1) * stepX, midY);
    ctx.closePath();
    ctx.fillStyle = 'rgba(50, 50, 50, 0.3)';
    // Actually we want to fill below the line for black
    // Let's draw properly: the line and fill above/below

    // Redraw: fill white area (from line to top)
    ctx.clearRect(0, 0, w, h);

    // Background gradient
    ctx.fillStyle = '#1a1917';
    ctx.fillRect(0, 0, w, h);

    // Center line
    ctx.strokeStyle = '#3d3a37';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(w, midY);
    ctx.stroke();

    // Build path points
    const pathPoints: { x: number; y: number }[] = [];
    for (let i = 0; i < n; i++) {
      const x = i * stepX;
      const winPct = Math.max(0, Math.min(100, points[i]));
      const y = h - (winPct / 100) * h;
      pathPoints.push({ x, y });
    }

    // Fill white area (above the eval line, from top to line)
    ctx.beginPath();
    ctx.moveTo(0, 0);
    for (const p of pathPoints) {
      ctx.lineTo(p.x, p.y);
    }
    ctx.lineTo(pathPoints[pathPoints.length - 1].x, 0);
    ctx.closePath();
    ctx.fillStyle = 'rgba(200, 200, 200, 0.15)';
    ctx.fill();

    // Fill black area (below the eval line, from line to bottom)
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (const p of pathPoints) {
      ctx.lineTo(p.x, p.y);
    }
    ctx.lineTo(pathPoints[pathPoints.length - 1].x, h);
    ctx.closePath();
    ctx.fillStyle = 'rgba(60, 60, 60, 0.3)';
    ctx.fill();

    // Draw eval line
    ctx.beginPath();
    ctx.moveTo(pathPoints[0].x, pathPoints[0].y);
    for (let i = 1; i < pathPoints.length; i++) {
      ctx.lineTo(pathPoints[i].x, pathPoints[i].y);
    }
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Draw classification markers on the line
    for (let i = 0; i < this.classifications.length; i++) {
      const cls = this.classifications[i];
      if (cls === 'best' || cls === 'good' || cls === 'book') continue;

      const p = pathPoints[i + 1]; // +1 because classifications are for moves, not positions
      if (!p) continue;

      let color = '';
      let radius = 3;
      if (cls === 'blunder') { color = '#db3030'; radius = 4; }
      else if (cls === 'mistake') { color = '#e6a817'; radius = 3.5; }
      else if (cls === 'inaccuracy') { color = '#56b4e9'; radius = 3; }

      if (color) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      }
    }
  }

  private updateMarker(): void {
    if (!this.containerRef?.nativeElement || this.evalHistory.length < 2) return;
    const w = this.containerRef.nativeElement.getBoundingClientRect().width;
    const n = this.evalHistory.length;
    const idx = this.currentIndex + 1; // positions index
    this.markerX = (idx / (n - 1)) * w;
  }

  onChartClick(event: MouseEvent): void {
    const container = this.containerRef?.nativeElement;
    if (!container || this.evalHistory.length < 2) return;

    const rect = container.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const ratio = x / rect.width;
    const idx = Math.round(ratio * (this.evalHistory.length - 1));
    // Emit move index (-1 for start position)
    this.moveClicked.emit(idx - 1);
  }
}
