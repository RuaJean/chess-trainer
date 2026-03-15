import { Component, OnInit, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CoachService } from '../../core/services/coach.service';
import { PlayerStatsComputeService } from '../../core/services/player-stats-compute.service';
import { TranslationService } from '../../core/services/translation.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import {
  PlayerStats,
  RatingPoint,
  OpeningStat,
  WeaknessItem,
} from '../../models/coach.model';

@Component({
  selector: 'app-player-profile',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  template: `
    <div class="profile">
      <div class="profile-header">
        <h1>{{ 'profile.title' | translate }}</h1>
        <button class="btn-recalc" (click)="recalculate()" [disabled]="computing">
          {{ computing ? ('profile.computing' | translate) : ('profile.recalculate' | translate) }}
        </button>
      </div>

      <div *ngIf="stats; else loading">
        <!-- Rating Timeline -->
        <section class="section">
          <h2>{{ 'profile.ratingTimeline' | translate }}</h2>
          <div class="chart-wrap">
            <canvas #ratingCanvas></canvas>
          </div>
        </section>

        <!-- Win Rate by Opening -->
        <section class="section">
          <h2>{{ 'profile.winRateByOpening' | translate }}</h2>
          <div class="openings-list" *ngIf="stats.opening_stats.length > 0; else noData">
            <div class="opening-row" *ngFor="let op of topOpenings">
              <div class="opening-label">
                <span class="eco">{{ op.eco }}</span>
                <span class="name">{{ op.name }}</span>
                <span class="game-count">{{ op.games }} {{ 'profile.games' | translate }}</span>
              </div>
              <div class="stacked-bar">
                <div class="bar-win" [style.width.%]="op.wins / op.games * 100"></div>
                <div class="bar-draw" [style.width.%]="op.draws / op.games * 100"></div>
                <div class="bar-loss" [style.width.%]="op.losses / op.games * 100"></div>
              </div>
              <span class="win-rate">{{ (op.win_rate * 100) | number:'1.0-0' }}%</span>
            </div>
          </div>
        </section>

        <!-- Time Management -->
        <section class="section">
          <h2>{{ 'profile.timeManagement' | translate }}</h2>
          <div class="time-stats">
            <div class="stat-chip">
              <span class="stat-value">{{ stats.time_management.games_below_10s || 0 }}</span>
              <span class="stat-label">{{ 'profile.below10s' | translate }}</span>
            </div>
            <div class="stat-chip">
              <span class="stat-value">{{ stats.time_management.games_below_30s || 0 }}</span>
              <span class="stat-label">{{ 'profile.below30s' | translate }}</span>
            </div>
            <div class="stat-chip">
              <span class="stat-value">{{ stats.time_management.timeout_losses || 0 }}</span>
              <span class="stat-label">{{ 'profile.timeouts' | translate }}</span>
            </div>
          </div>
          <div class="chart-wrap">
            <canvas #timeCanvas></canvas>
          </div>
        </section>

        <!-- Error Distribution -->
        <section class="section">
          <h2>{{ 'profile.errorDistribution' | translate }}</h2>
          <div class="chart-wrap short">
            <canvas #errorCanvas></canvas>
          </div>
        </section>

        <!-- Weaknesses -->
        <section class="section">
          <h2>{{ 'profile.topWeaknesses' | translate }}</h2>
          <div class="weaknesses" *ngIf="stats.weaknesses.length > 0; else noData">
            <div class="weakness-card" *ngFor="let w of stats.weaknesses">
              <div class="weakness-header">
                <span class="weakness-name">{{ w.name }}</span>
                <span class="weakness-score">{{ w.score }}</span>
              </div>
              <div class="weakness-desc">{{ w.description }}</div>
              <div class="weakness-trend" [class]="w.trend">
                {{ trendLabel(w.trend) }}
              </div>
            </div>
          </div>
        </section>
      </div>

      <ng-template #loading>
        <div class="loading" *ngIf="!stats">
          <p>{{ 'profile.noStats' | translate }}</p>
          <button class="btn-recalc" (click)="recalculate()" [disabled]="computing">
            {{ computing ? ('profile.computing' | translate) : ('profile.computeNow' | translate) }}
          </button>
        </div>
      </ng-template>

      <ng-template #noData>
        <div class="empty">{{ 'profile.notEnoughData' | translate }}</div>
      </ng-template>
    </div>
  `,
  styles: [`
    .profile {
      padding: 24px;
      max-width: 900px;
      margin: 0 auto;
    }
    .profile-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 24px;
    }
    .profile-header h1 {
      color: #e0e0e0;
      font-size: 1.5rem;
      margin: 0;
    }
    .btn-recalc {
      background: #2e2b28;
      border: 1px solid #3d3a37;
      color: #bababa;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.85rem;
    }
    .btn-recalc:hover:not(:disabled) { border-color: #bf811d; color: #e0e0e0; }
    .btn-recalc:disabled { opacity: 0.5; cursor: default; }
    .section {
      margin-bottom: 32px;
    }
    .section h2 {
      color: #e0e0e0;
      font-size: 1.1rem;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid #3d3a37;
    }
    .chart-wrap {
      background: #1a1917;
      border-radius: 6px;
      padding: 12px;
      height: 200px;
      position: relative;
    }
    .chart-wrap.short { height: 160px; }
    .chart-wrap canvas {
      width: 100%;
      height: 100%;
    }
    .openings-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .opening-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .opening-label {
      width: 260px;
      min-width: 200px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .eco {
      color: #bf811d;
      font-weight: 600;
      font-size: 0.85rem;
      width: 35px;
    }
    .name {
      color: #bababa;
      font-size: 0.85rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex: 1;
    }
    .game-count {
      color: #5a5856;
      font-size: 0.75rem;
      white-space: nowrap;
    }
    .stacked-bar {
      flex: 1;
      height: 20px;
      display: flex;
      border-radius: 3px;
      overflow: hidden;
      background: #3d3a37;
    }
    .bar-win { background: #81b64c; }
    .bar-draw { background: #8a8886; }
    .bar-loss { background: #db3030; }
    .win-rate {
      color: #bababa;
      font-size: 0.85rem;
      width: 40px;
      text-align: right;
    }
    .time-stats {
      display: flex;
      gap: 16px;
      margin-bottom: 12px;
    }
    .stat-chip {
      background: #2e2b28;
      border: 1px solid #3d3a37;
      border-radius: 6px;
      padding: 8px 16px;
      text-align: center;
    }
    .stat-value {
      display: block;
      color: #e0e0e0;
      font-size: 1.3rem;
      font-weight: 600;
    }
    .stat-label {
      color: #8a8886;
      font-size: 0.75rem;
    }
    .weaknesses {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .weakness-card {
      background: #2e2b28;
      border: 1px solid #3d3a37;
      border-radius: 6px;
      padding: 12px 16px;
    }
    .weakness-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 4px;
    }
    .weakness-name {
      color: #e0e0e0;
      font-weight: 600;
      font-size: 0.9rem;
    }
    .weakness-score {
      background: #db3030;
      color: #fff;
      font-size: 0.75rem;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 10px;
    }
    .weakness-desc {
      color: #8a8886;
      font-size: 0.8rem;
      margin-bottom: 4px;
    }
    .weakness-trend {
      font-size: 0.75rem;
      font-weight: 600;
    }
    .weakness-trend.improving { color: #81b64c; }
    .weakness-trend.declining { color: #db3030; }
    .weakness-trend.stable { color: #8a8886; }
    .loading, .empty {
      color: #8a8886;
      text-align: center;
      padding: 40px;
    }
  `],
})
export class PlayerProfileComponent implements OnInit, AfterViewInit {
  @ViewChild('ratingCanvas') ratingCanvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('timeCanvas') timeCanvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('errorCanvas') errorCanvasRef!: ElementRef<HTMLCanvasElement>;

  stats: PlayerStats | null = null;
  computing = false;
  private viewReady = false;

  constructor(
    private coachService: CoachService,
    private statsCompute: PlayerStatsComputeService,
    private i18n: TranslationService,
  ) {}

  ngOnInit(): void {
    this.loadStats();
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    if (this.stats) this.drawAllCharts();
  }

  get topOpenings(): OpeningStat[] {
    return (this.stats?.opening_stats || []).slice(0, 10);
  }

  async loadStats(): Promise<void> {
    try {
      const stats = await this.coachService.getStats();
      if (stats.computed_at) {
        this.stats = stats;
        setTimeout(() => this.drawAllCharts(), 0);
      }
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  }

  async recalculate(): Promise<void> {
    this.computing = true;
    try {
      this.stats = await this.statsCompute.computeAndSave();
      setTimeout(() => this.drawAllCharts(), 0);
    } catch (err) {
      console.error('Failed to compute stats:', err);
    } finally {
      this.computing = false;
    }
  }

  trendLabel(trend: string): string {
    if (trend === 'improving') return this.i18n.t('profile.improving');
    if (trend === 'declining') return this.i18n.t('profile.declining');
    return this.i18n.t('profile.stable');
  }

  private drawAllCharts(): void {
    if (!this.viewReady || !this.stats) return;
    this.drawRatingChart();
    this.drawTimeChart();
    this.drawErrorChart();
  }

  private drawRatingChart(): void {
    const canvas = this.ratingCanvasRef?.nativeElement;
    if (!canvas || !this.stats?.rating_history.length) return;

    const parent = canvas.parentElement!;
    const w = parent.clientWidth - 24;
    const h = parent.clientHeight - 24;
    canvas.width = w * 2;
    canvas.height = h * 2;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';

    const ctx = canvas.getContext('2d')!;
    ctx.scale(2, 2);
    ctx.clearRect(0, 0, w, h);

    const points = this.stats.rating_history;
    const ratings = points.map(p => p.rating);
    const minR = Math.min(...ratings) - 20;
    const maxR = Math.max(...ratings) + 20;
    const range = maxR - minR || 1;

    const pad = { top: 10, bottom: 25, left: 45, right: 10 };
    const cw = w - pad.left - pad.right;
    const ch = h - pad.top - pad.bottom;

    // Grid lines
    ctx.strokeStyle = '#3d3a37';
    ctx.lineWidth = 0.5;
    const gridCount = 4;
    for (let i = 0; i <= gridCount; i++) {
      const y = pad.top + (i / gridCount) * ch;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(w - pad.right, y);
      ctx.stroke();

      const rating = Math.round(maxR - (i / gridCount) * range);
      ctx.fillStyle = '#8a8886';
      ctx.font = '10px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(String(rating), pad.left - 6, y + 4);
    }

    // Rating line
    ctx.beginPath();
    ctx.strokeStyle = '#bf811d';
    ctx.lineWidth = 2;
    for (let i = 0; i < points.length; i++) {
      const x = pad.left + (i / (points.length - 1)) * cw;
      const y = pad.top + ((maxR - points[i].rating) / range) * ch;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Fill under line
    const lastX = pad.left + cw;
    const lastY = pad.top + ((maxR - points[points.length - 1].rating) / range) * ch;
    ctx.lineTo(lastX, pad.top + ch);
    ctx.lineTo(pad.left, pad.top + ch);
    ctx.closePath();
    ctx.fillStyle = 'rgba(191, 129, 29, 0.1)';
    ctx.fill();

    // Start/end labels
    if (points.length > 0) {
      ctx.fillStyle = '#8a8886';
      ctx.font = '9px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(points[0].date, pad.left, h - 4);
      ctx.textAlign = 'right';
      ctx.fillText(points[points.length - 1].date, w - pad.right, h - 4);
    }
  }

  private drawTimeChart(): void {
    const canvas = this.timeCanvasRef?.nativeElement;
    if (!canvas || !this.stats?.time_management.avg_time_by_move?.length) return;

    const parent = canvas.parentElement!;
    const w = parent.clientWidth - 24;
    const h = parent.clientHeight - 24;
    canvas.width = w * 2;
    canvas.height = h * 2;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';

    const ctx = canvas.getContext('2d')!;
    ctx.scale(2, 2);
    ctx.clearRect(0, 0, w, h);

    const times = this.stats.time_management.avg_time_by_move;
    const maxTime = Math.max(...times, 1);

    const pad = { top: 10, bottom: 25, left: 40, right: 10 };
    const cw = w - pad.left - pad.right;
    const ch = h - pad.top - pad.bottom;

    // Grid
    ctx.strokeStyle = '#3d3a37';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 3; i++) {
      const y = pad.top + (i / 3) * ch;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(w - pad.right, y);
      ctx.stroke();

      ctx.fillStyle = '#8a8886';
      ctx.font = '10px monospace';
      ctx.textAlign = 'right';
      ctx.fillText((maxTime - (i / 3) * maxTime).toFixed(0) + 's', pad.left - 4, y + 4);
    }

    // Time line
    ctx.beginPath();
    ctx.strokeStyle = '#e6a817';
    ctx.lineWidth = 2;
    for (let i = 0; i < times.length; i++) {
      const x = pad.left + (i / (times.length - 1 || 1)) * cw;
      const y = pad.top + ((maxTime - times[i]) / maxTime) * ch;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Move number labels
    ctx.fillStyle = '#8a8886';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    const step = Math.max(1, Math.floor(times.length / 6));
    for (let i = 0; i < times.length; i += step) {
      const x = pad.left + (i / (times.length - 1 || 1)) * cw;
      ctx.fillText(String(i + 1), x, h - 4);
    }
  }

  private drawErrorChart(): void {
    const canvas = this.errorCanvasRef?.nativeElement;
    if (!canvas || !this.stats?.error_distribution) return;

    const parent = canvas.parentElement!;
    const w = parent.clientWidth - 24;
    const h = parent.clientHeight - 24;
    canvas.width = w * 2;
    canvas.height = h * 2;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';

    const ctx = canvas.getContext('2d')!;
    ctx.scale(2, 2);
    ctx.clearRect(0, 0, w, h);

    const dist = this.stats.error_distribution;
    const entries: [string, number][] = [
      [this.i18n.t('profile.errTactical'), dist.tactical || 0],
      [this.i18n.t('profile.errPositional'), dist.positional || 0],
      [this.i18n.t('profile.errTime'), dist.time || 0],
      [this.i18n.t('profile.errCalculation'), dist.calculation || 0],
      [this.i18n.t('profile.errTheoretical'), dist.theoretical || 0],
    ];
    const maxVal = Math.max(...entries.map(e => e[1]), 1);

    const colors = ['#db3030', '#e6a817', '#bf811d', '#56b4e9', '#8a8886'];
    const pad = { top: 10, bottom: 25, left: 90, right: 20 };
    const barH = 22;
    const gap = 8;

    for (let i = 0; i < entries.length; i++) {
      const [label, value] = entries[i];
      const y = pad.top + i * (barH + gap);

      // Label
      ctx.fillStyle = '#bababa';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(label, pad.left - 8, y + barH / 2 + 4);

      // Bar
      const barW = ((w - pad.left - pad.right) * value) / maxVal;
      ctx.fillStyle = colors[i];
      ctx.beginPath();
      ctx.roundRect(pad.left, y, Math.max(barW, 2), barH, 3);
      ctx.fill();

      // Value
      ctx.fillStyle = '#e0e0e0';
      ctx.font = '11px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(String(value), pad.left + barW + 6, y + barH / 2 + 4);
    }
  }
}
