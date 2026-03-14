import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { ClockConfig, ClockState } from '../../models/clock.model';

@Injectable({ providedIn: 'root' })
export class ClockService implements OnDestroy {
  private intervalId: any = null;
  private lastTick: number = 0;

  private state: ClockState = {
    whiteTime: 0,
    blackTime: 0,
    activeSide: null,
    flagged: null,
  };

  private config: ClockConfig = { initialTime: 0, increment: 0 };
  private state$ = new BehaviorSubject<ClockState>({ ...this.state });
  private flagged$ = new Subject<'w' | 'b'>();

  get clockState$(): Observable<ClockState> { return this.state$.asObservable(); }
  get onFlag$(): Observable<'w' | 'b'> { return this.flagged$.asObservable(); }

  get isEnabled(): boolean {
    return this.config.initialTime > 0;
  }

  configure(config: ClockConfig): void {
    this.stop();
    this.config = config;
    this.state = {
      whiteTime: config.initialTime * 1000,
      blackTime: config.initialTime * 1000,
      activeSide: null,
      flagged: null,
    };
    this.emit();
  }

  start(side: 'w' | 'b'): void {
    if (!this.isEnabled) return;
    this.state.activeSide = side;
    this.lastTick = performance.now();
    this.emit();

    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = setInterval(() => this.tick(), 100);
  }

  switchTurn(): void {
    if (!this.isEnabled || !this.state.activeSide) return;

    // Add increment to the side that just moved
    const justMoved = this.state.activeSide;
    if (this.config.increment > 0) {
      if (justMoved === 'w') {
        this.state.whiteTime += this.config.increment * 1000;
      } else {
        this.state.blackTime += this.config.increment * 1000;
      }
    }

    this.state.activeSide = justMoved === 'w' ? 'b' : 'w';
    this.lastTick = performance.now();
    this.emit();
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.state.activeSide = null;
    this.emit();
  }

  pause(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  resume(): void {
    if (!this.isEnabled || !this.state.activeSide) return;
    this.lastTick = performance.now();
    if (!this.intervalId) {
      this.intervalId = setInterval(() => this.tick(), 100);
    }
  }

  getTime(side: 'w' | 'b'): number {
    return side === 'w' ? this.state.whiteTime : this.state.blackTime;
  }

  private tick(): void {
    if (!this.state.activeSide || this.state.flagged) return;

    const now = performance.now();
    const elapsed = now - this.lastTick;
    this.lastTick = now;

    if (this.state.activeSide === 'w') {
      this.state.whiteTime = Math.max(0, this.state.whiteTime - elapsed);
      if (this.state.whiteTime <= 0) {
        this.state.flagged = 'w';
        this.flagged$.next('w');
        this.stop();
      }
    } else {
      this.state.blackTime = Math.max(0, this.state.blackTime - elapsed);
      if (this.state.blackTime <= 0) {
        this.state.flagged = 'b';
        this.flagged$.next('b');
        this.stop();
      }
    }

    this.emit();
  }

  private emit(): void {
    this.state$.next({ ...this.state });
  }

  ngOnDestroy(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }
}
