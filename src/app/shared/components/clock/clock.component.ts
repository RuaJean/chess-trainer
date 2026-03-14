import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { ClockService } from '../../../core/services/clock.service';
import { ClockState } from '../../../models/clock.model';

@Component({
  selector: 'app-clock',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="clock-container" *ngIf="enabled">
      <div class="clock"
           [class.active]="state.activeSide === side"
           [class.low-time]="getTime() < 10000 && getTime() > 0"
           [class.flagged]="state.flagged === side">
        <span class="time">{{ formatTime(getTime()) }}</span>
      </div>
    </div>
  `,
  styles: [`
    .clock-container {
      display: flex;
      justify-content: center;
    }
    .clock {
      background: #1a1917;
      color: #999;
      padding: 6px 16px;
      border-radius: 4px;
      font-family: 'Roboto Mono', monospace;
      font-size: 1.4rem;
      font-weight: 500;
      min-width: 100px;
      text-align: center;
      transition: all 150ms ease;
    }
    .clock.active {
      background: #629924;
      color: #fff;
    }
    .clock.low-time {
      background: #ac3333;
      color: #fff;
      animation: blink 1s ease-in-out infinite;
    }
    .clock.flagged {
      background: #ac3333;
      color: #fff;
    }
    @keyframes blink {
      50% { opacity: 0.7; }
    }
  `],
})
export class ClockComponent implements OnInit, OnDestroy {
  @Input() side: 'w' | 'b' = 'w';
  @Input() enabled: boolean = true;

  state: ClockState = { whiteTime: 0, blackTime: 0, activeSide: null, flagged: null };
  private sub?: Subscription;

  constructor(private clockService: ClockService) {}

  ngOnInit(): void {
    this.sub = this.clockService.clockState$.subscribe(s => this.state = s);
  }

  getTime(): number {
    return this.side === 'w' ? this.state.whiteTime : this.state.blackTime;
  }

  formatTime(ms: number): string {
    if (ms <= 0) return '0:00';
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    if (totalSeconds < 10) {
      // Show tenths when under 10 seconds
      const tenths = Math.floor((ms % 1000) / 100);
      return `${seconds}.${tenths}`;
    }

    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }
}
