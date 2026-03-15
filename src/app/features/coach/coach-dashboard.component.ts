import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { CoachService } from '../../core/services/coach.service';
import { TranslationService } from '../../core/services/translation.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { DashboardData, DAILY_THEMES } from '../../models/coach.model';

@Component({
  selector: 'app-coach-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslatePipe],
  template: `
    <div class="dashboard">
      <div class="dashboard-header">
        <h1>{{ 'coach.dashboard' | translate }}</h1>
        <div class="streak-badge" *ngIf="data">
          <span class="streak-fire">&#x1f525;</span>
          <span>{{ 'coach.dayStreak' | translate:{count: data.current_streak} }}</span>
        </div>
      </div>

      <div class="cards-grid" *ngIf="data; else loading">
        <!-- Daily Exercise -->
        <div class="card">
          <div class="card-header">
            <span class="card-icon">{{ getDailyIcon() }}</span>
            <h3>{{ 'coach.todayExercise' | translate }}</h3>
          </div>
          <div class="card-body">
            <div class="theme-label">{{ data.daily_theme_description }}</div>
            <button class="btn-primary" (click)="startDailyExercise()">
              {{ 'coach.startTraining' | translate }}
            </button>
          </div>
        </div>

        <!-- Game to Analyze -->
        <div class="card">
          <div class="card-header">
            <span class="card-icon">&#x1f50d;</span>
            <h3>{{ 'coach.gameToAnalyze' | translate }}</h3>
          </div>
          <div class="card-body" *ngIf="data.unanalyzed_game; else noGame">
            <div class="game-info">
              <span class="players">{{ data.unanalyzed_game.white }} vs {{ data.unanalyzed_game.black }}</span>
              <span class="game-meta">{{ data.unanalyzed_game.date }} &middot; {{ data.unanalyzed_game.eco }}</span>
              <span class="game-result" [class]="resultClass(data.unanalyzed_game.result)">
                {{ data.unanalyzed_game.result }}
              </span>
            </div>
            <a class="btn-primary" [routerLink]="['/analysis']"
               [queryParams]="{gameId: data.unanalyzed_game.id}">
              {{ 'coach.analyze' | translate }}
            </a>
          </div>
          <ng-template #noGame>
            <div class="card-body empty-state">
              {{ 'coach.allAnalyzed' | translate }}
            </div>
          </ng-template>
        </div>

        <!-- Weekly Progress -->
        <div class="card">
          <div class="card-header">
            <span class="card-icon">&#x1f4c5;</span>
            <h3>{{ 'coach.weeklyProgress' | translate }}</h3>
          </div>
          <div class="card-body">
            <div class="week-dots">
              <div class="day-dot" *ngFor="let done of data.weekly_sessions; let i = index"
                   [class.completed]="done" [class.today]="i === todayIndex">
                <div class="dot"></div>
                <span class="day-label">{{ dayLabels[i] }}</span>
              </div>
            </div>
            <div class="week-summary">
              {{ 'coach.daysCompleted' | translate:{count: completedDays} }}
            </div>
          </div>
        </div>

        <!-- Next Milestone -->
        <div class="card">
          <div class="card-header">
            <span class="card-icon">&#x1f3af;</span>
            <h3>{{ 'coach.nextMilestone' | translate }}</h3>
          </div>
          <div class="card-body" *ngIf="data.next_milestone; else noMilestone">
            <div class="milestone-name">{{ data.next_milestone.name }}</div>
            <div class="milestone-progress">
              <div class="progress-bar">
                <div class="progress-fill"
                     [style.width.%]="milestonePercent"></div>
              </div>
              <span class="progress-text">
                {{ data.next_milestone.current || 0 }}/{{ data.next_milestone.target }}
              </span>
            </div>
          </div>
          <ng-template #noMilestone>
            <div class="card-body empty-state">
              {{ 'coach.noMilestones' | translate }}
            </div>
          </ng-template>
        </div>
      </div>

      <ng-template #loading>
        <div class="loading">{{ 'coach.loadingDashboard' | translate }}</div>
      </ng-template>

      <!-- Quick Links -->
      <div class="quick-links" *ngIf="data">
        <a routerLink="/coach/profile" class="quick-link">
          <span>&#x1f4ca;</span> {{ 'coach.playerProfile' | translate }}
        </a>
        <a routerLink="/coach/plan" class="quick-link">
          <span>&#x1f4c5;</span> {{ 'coach.trainingPlan' | translate }}
        </a>
        <a routerLink="/coach/positions" class="quick-link">
          <span>&#x265f;&#xfe0e;</span> {{ 'coach.positionBank' | translate }}
        </a>
      </div>
    </div>
  `,
  styles: [`
    .dashboard {
      padding: 24px;
      max-width: 1100px;
      margin: 0 auto;
    }
    .dashboard-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 24px;
    }
    .dashboard-header h1 {
      color: #e0e0e0;
      font-size: 1.5rem;
      margin: 0;
    }
    .streak-badge {
      display: flex;
      align-items: center;
      gap: 6px;
      background: #2e2b28;
      border: 1px solid #3d3a37;
      border-radius: 20px;
      padding: 6px 14px;
      color: #bf811d;
      font-weight: 600;
    }
    .streak-fire { font-size: 1.2em; }
    .cards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .card {
      background: #262421;
      border: 1px solid #3d3a37;
      border-radius: 8px;
      overflow: hidden;
    }
    .card-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 14px 16px 0;
    }
    .card-icon { font-size: 1.3em; }
    .card-header h3 {
      color: #e0e0e0;
      font-size: 0.95rem;
      margin: 0;
    }
    .card-body {
      padding: 12px 16px 16px;
    }
    .theme-label {
      color: #bababa;
      margin-bottom: 12px;
      font-size: 0.9rem;
    }
    .btn-primary {
      display: inline-block;
      background: #bf811d;
      color: #fff;
      border: none;
      border-radius: 4px;
      padding: 8px 16px;
      cursor: pointer;
      font-size: 0.85rem;
      text-decoration: none;
      text-align: center;
    }
    .btn-primary:hover { background: #d4922a; }
    .game-info {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-bottom: 12px;
    }
    .players { color: #e0e0e0; font-size: 0.9rem; }
    .game-meta { color: #8a8886; font-size: 0.8rem; }
    .game-result {
      font-weight: 600;
      font-size: 0.85rem;
    }
    .game-result.win { color: #81b64c; }
    .game-result.loss { color: #db3030; }
    .game-result.draw { color: #8a8886; }
    .empty-state {
      color: #5a5856;
      font-style: italic;
      font-size: 0.9rem;
    }
    .week-dots {
      display: flex;
      justify-content: space-between;
      margin-bottom: 10px;
    }
    .day-dot {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
    }
    .dot {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: #3d3a37;
      border: 2px solid #3d3a37;
    }
    .day-dot.completed .dot {
      background: #81b64c;
      border-color: #81b64c;
    }
    .day-dot.today .dot {
      border-color: #bf811d;
    }
    .day-label {
      color: #8a8886;
      font-size: 0.7rem;
    }
    .week-summary {
      color: #bababa;
      font-size: 0.85rem;
      text-align: center;
    }
    .milestone-name {
      color: #e0e0e0;
      font-weight: 600;
      margin-bottom: 10px;
      font-size: 0.9rem;
    }
    .milestone-progress {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .progress-bar {
      flex: 1;
      height: 8px;
      background: #3d3a37;
      border-radius: 4px;
      overflow: hidden;
    }
    .progress-fill {
      height: 100%;
      background: #bf811d;
      border-radius: 4px;
      transition: width 300ms ease;
    }
    .progress-text {
      color: #8a8886;
      font-size: 0.8rem;
      white-space: nowrap;
    }
    .quick-links {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }
    .quick-link {
      display: flex;
      align-items: center;
      gap: 6px;
      background: #2e2b28;
      border: 1px solid #3d3a37;
      border-radius: 6px;
      padding: 10px 16px;
      color: #bababa;
      text-decoration: none;
      font-size: 0.9rem;
      transition: border-color 150ms ease;
    }
    .quick-link:hover {
      border-color: #bf811d;
      color: #e0e0e0;
    }
    .loading {
      color: #8a8886;
      text-align: center;
      padding: 40px;
    }
  `],
})
export class CoachDashboardComponent implements OnInit {
  data: DashboardData | null = null;
  dayLabels: string[] = [];
  todayIndex = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1; // Mon=0 ... Sun=6

  constructor(
    private coachService: CoachService,
    private router: Router,
    private i18n: TranslationService,
  ) {
    this.dayLabels = [
      this.i18n.t('coach.dayMon'), this.i18n.t('coach.dayTue'), this.i18n.t('coach.dayWed'),
      this.i18n.t('coach.dayThu'), this.i18n.t('coach.dayFri'), this.i18n.t('coach.daySat'),
      this.i18n.t('coach.daySun'),
    ];
  }

  ngOnInit(): void {
    this.loadDashboard();
  }

  async loadDashboard(): Promise<void> {
    try {
      this.data = await this.coachService.getDashboard();
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    }
  }

  getDailyIcon(): string {
    const theme = DAILY_THEMES.find(t => t.key === this.data?.daily_theme);
    return theme?.icon || '📋';
  }

  get completedDays(): number {
    return this.data?.weekly_sessions.filter(Boolean).length || 0;
  }

  get milestonePercent(): number {
    if (!this.data?.next_milestone) return 0;
    const { current = 0, target } = this.data.next_milestone;
    return target > 0 ? Math.min(100, (current / target) * 100) : 0;
  }

  resultClass(result: string): string {
    if (result === '1-0') return 'win';
    if (result === '0-1') return 'loss';
    return 'draw';
  }

  startDailyExercise(): void {
    // Route based on theme
    const theme = this.data?.daily_theme;
    switch (theme) {
      case 'analysis':
        if (this.data?.unanalyzed_game) {
          this.router.navigate(['/analysis'], { queryParams: { gameId: this.data.unanalyzed_game.id } });
        } else {
          this.router.navigate(['/library']);
        }
        break;
      case 'openings':
        this.router.navigate(['/coach/positions'], { queryParams: { category: 'theoretical' } });
        break;
      case 'review':
        this.router.navigate(['/coach/profile']);
        break;
      default:
        this.router.navigate(['/coach/positions']);
        break;
    }
  }
}
