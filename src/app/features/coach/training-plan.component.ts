import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CoachService } from '../../core/services/coach.service';
import { TranslationService } from '../../core/services/translation.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import {
  CoachingSession,
  TrainingProgress,
  DAILY_THEMES,
  TRAINING_CYCLES,
  DailyTheme,
} from '../../models/coach.model';

@Component({
  selector: 'app-training-plan',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  template: `
    <div class="plan">
      <h1>{{ 'plan.title' | translate }}</h1>

      <!-- Cycle Indicator -->
      <div class="cycle-indicator">
        <span class="cycle-label">{{ 'plan.cycleOf' | translate:{current: progress.current_cycle, total: cycles.length} }}</span>
        <span class="cycle-name">{{ currentCycleName }}</span>
        <span class="cycle-week">{{ 'plan.week' | translate:{num: currentWeekInCycle} }}</span>
      </div>

      <!-- Calendar Grid -->
      <div class="calendar">
        <div class="calendar-header">
          <div class="cal-cell" *ngFor="let d of dayHeaders">{{ d }}</div>
        </div>
        <div class="calendar-row" *ngFor="let week of calendarWeeks; let wi = index">
          <div class="cal-cell day-cell" *ngFor="let day of week"
               [class.today]="isToday(day.date)"
               [class.completed]="day.completed"
               [class.future]="isFuture(day.date)">
            <span class="day-num">{{ day.date | date:'d' }}</span>
            <span class="day-icon">{{ day.theme?.icon || '' }}</span>
            <span class="day-status" *ngIf="day.completed">&#x2713;</span>
          </div>
        </div>
      </div>

      <!-- Log Session -->
      <div class="log-section">
        <h2>{{ 'plan.logSession' | translate }}</h2>
        <div class="log-form">
          <div class="form-row">
            <label>{{ 'plan.theme' | translate }}</label>
            <select [(ngModel)]="newSession.theme">
              <option *ngFor="let t of themes" [value]="t.key">{{ t.icon }} {{ t.label }}</option>
            </select>
          </div>
          <div class="form-row">
            <label>{{ 'plan.duration' | translate }}</label>
            <input type="number" [(ngModel)]="newSession.duration_minutes" min="1" max="180">
          </div>
          <div class="form-row">
            <label>{{ 'plan.notes' | translate }}</label>
            <textarea [(ngModel)]="newSession.notes" rows="2" [placeholder]="'plan.notesPlaceholder' | translate"></textarea>
          </div>
          <button class="btn-primary" (click)="logSession()" [disabled]="saving">
            {{ saving ? ('plan.saving' | translate) : ('plan.logSession' | translate) }}
          </button>
        </div>
      </div>

      <!-- Session History -->
      <div class="history">
        <h2>{{ 'plan.sessionHistory' | translate }}</h2>
        <div class="sessions-list" *ngIf="sessions.length > 0; else noSessions">
          <div class="session-row" *ngFor="let s of sessions">
            <span class="session-date">{{ s.date }}</span>
            <span class="session-theme">{{ getThemeIcon(s.theme) }} {{ s.theme }}</span>
            <span class="session-duration">{{ s.duration_minutes }} {{ 'plan.min' | translate }}</span>
            <span class="session-notes" *ngIf="s.notes">{{ s.notes }}</span>
          </div>
        </div>
        <ng-template #noSessions>
          <div class="empty">{{ 'plan.noSessions' | translate }}</div>
        </ng-template>
      </div>
    </div>
  `,
  styles: [`
    .plan {
      padding: 24px;
      max-width: 900px;
      margin: 0 auto;
    }
    h1 {
      color: #e0e0e0;
      font-size: 1.5rem;
      margin-bottom: 16px;
    }
    h2 {
      color: #e0e0e0;
      font-size: 1.1rem;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid #3d3a37;
    }
    .cycle-indicator {
      display: flex;
      align-items: center;
      gap: 12px;
      background: #262421;
      border: 1px solid #3d3a37;
      border-radius: 8px;
      padding: 14px 18px;
      margin-bottom: 20px;
    }
    .cycle-label {
      color: #bf811d;
      font-weight: 600;
      font-size: 0.9rem;
    }
    .cycle-name {
      color: #e0e0e0;
      font-size: 0.9rem;
      flex: 1;
    }
    .cycle-week {
      color: #8a8886;
      font-size: 0.85rem;
    }
    .calendar {
      background: #262421;
      border: 1px solid #3d3a37;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 24px;
    }
    .calendar-header {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 4px;
      margin-bottom: 4px;
    }
    .calendar-header .cal-cell {
      text-align: center;
      color: #8a8886;
      font-size: 0.75rem;
      padding: 4px;
    }
    .calendar-row {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 4px;
    }
    .day-cell {
      background: #1a1917;
      border-radius: 4px;
      padding: 8px 6px;
      text-align: center;
      min-height: 60px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      position: relative;
    }
    .day-cell.today {
      border: 2px solid #bf811d;
    }
    .day-cell.completed {
      background: #2a3a20;
    }
    .day-cell.future {
      opacity: 0.5;
    }
    .day-num {
      color: #bababa;
      font-size: 0.8rem;
    }
    .day-icon {
      font-size: 1.1em;
    }
    .day-status {
      color: #81b64c;
      font-weight: bold;
      font-size: 0.9rem;
    }
    .log-section {
      margin-bottom: 24px;
    }
    .log-form {
      background: #262421;
      border: 1px solid #3d3a37;
      border-radius: 8px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .form-row {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .form-row label {
      color: #8a8886;
      font-size: 0.8rem;
    }
    .form-row select, .form-row input, .form-row textarea {
      background: #1a1917;
      border: 1px solid #3d3a37;
      border-radius: 4px;
      color: #e0e0e0;
      padding: 8px;
      font-size: 0.85rem;
      font-family: inherit;
    }
    .form-row textarea { resize: vertical; }
    .btn-primary {
      background: #bf811d;
      color: #fff;
      border: none;
      border-radius: 4px;
      padding: 8px 16px;
      cursor: pointer;
      font-size: 0.85rem;
      align-self: flex-start;
    }
    .btn-primary:hover { background: #d4922a; }
    .btn-primary:disabled { opacity: 0.5; cursor: default; }
    .sessions-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .session-row {
      display: flex;
      align-items: center;
      gap: 12px;
      background: #262421;
      border: 1px solid #3d3a37;
      border-radius: 4px;
      padding: 10px 14px;
    }
    .session-date { color: #8a8886; font-size: 0.8rem; width: 90px; }
    .session-theme { color: #e0e0e0; font-size: 0.85rem; width: 140px; }
    .session-duration { color: #bf811d; font-size: 0.85rem; width: 60px; }
    .session-notes { color: #bababa; font-size: 0.8rem; flex: 1; }
    .empty {
      color: #5a5856;
      font-style: italic;
      padding: 16px;
    }
  `],
})
export class TrainingPlanComponent implements OnInit {
  themes = DAILY_THEMES;
  cycles = TRAINING_CYCLES;
  progress: TrainingProgress = {
    current_streak: 0,
    longest_streak: 0,
    current_cycle: 1,
    cycle_start_date: null,
    milestones: {},
    updated_at: null,
  };
  sessions: CoachingSession[] = [];
  calendarWeeks: CalendarDay[][] = [];
  dayHeaders: string[] = [];

  newSession = {
    theme: 'analysis',
    duration_minutes: 30,
    notes: '',
  };
  saving = false;

  constructor(
    private coachService: CoachService,
    private i18n: TranslationService,
  ) {
    this.dayHeaders = [
      this.i18n.t('coach.dayMon'), this.i18n.t('coach.dayTue'), this.i18n.t('coach.dayWed'),
      this.i18n.t('coach.dayThu'), this.i18n.t('coach.dayFri'), this.i18n.t('coach.daySat'),
      this.i18n.t('coach.daySun'),
    ];
  }

  ngOnInit(): void {
    this.loadData();
  }

  get currentCycleName(): string {
    const idx = (this.progress.current_cycle - 1) % this.cycles.length;
    return this.cycles[idx]?.name || 'General Training';
  }

  get currentWeekInCycle(): number {
    if (!this.progress.cycle_start_date) return 1;
    const start = new Date(this.progress.cycle_start_date);
    const now = new Date();
    const diff = Math.floor((now.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000));
    return Math.min(3, diff + 1);
  }

  async loadData(): Promise<void> {
    try {
      const [progress, sessions] = await Promise.all([
        this.coachService.getProgress(),
        this.coachService.getSessions(1, 50),
      ]);
      this.progress = progress;
      this.sessions = sessions;

      // Auto-select today's theme
      const todayWeekday = new Date().getDay();
      const idx = todayWeekday === 0 ? 6 : todayWeekday - 1;
      if (this.themes[idx]) {
        this.newSession.theme = this.themes[idx].key;
      }

      this.buildCalendar();
    } catch (err) {
      console.error('Failed to load training plan:', err);
    }
  }

  buildCalendar(): void {
    const today = new Date();
    // Build 3 weeks starting from the Monday of the current week
    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

    const sessionDates = new Set(this.sessions.map(s => s.date));

    this.calendarWeeks = [];
    for (let w = 0; w < 3; w++) {
      const week: CalendarDay[] = [];
      for (let d = 0; d < 7; d++) {
        const date = new Date(monday);
        date.setDate(monday.getDate() + w * 7 + d);
        const dateStr = date.toISOString().split('T')[0];
        week.push({
          date: date,
          dateStr,
          theme: this.themes[d] || null,
          completed: sessionDates.has(dateStr),
        });
      }
      this.calendarWeeks.push(week);
    }
  }

  isToday(date: Date): boolean {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  }

  isFuture(date: Date): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date > today;
  }

  getThemeIcon(themeKey: string): string {
    return this.themes.find(t => t.key === themeKey)?.icon || '📋';
  }

  async logSession(): Promise<void> {
    this.saving = true;
    try {
      const today = new Date().toISOString().split('T')[0];
      await this.coachService.createSession({
        date: today,
        theme: this.newSession.theme,
        duration_minutes: this.newSession.duration_minutes,
        exercises_completed: [],
        notes: this.newSession.notes,
      });
      this.newSession.notes = '';
      await this.loadData();
    } catch (err) {
      console.error('Failed to log session:', err);
    } finally {
      this.saving = false;
    }
  }
}

interface CalendarDay {
  date: Date;
  dateStr: string;
  theme: DailyTheme | null;
  completed: boolean;
}
