import { Injectable, OnDestroy } from '@angular/core';
import { Observable, Subject, BehaviorSubject } from 'rxjs';
import { EngineConfig, DEFAULT_ENGINE_CONFIG, eloToSkillLevel, eloToDepth } from '../../models/engine-config.model';

export interface EngineEval {
  depth: number;
  score: number;
  mate: number | null;
  pv: string;
  multipv: number;
}

@Injectable({ providedIn: 'root' })
export class StockfishService implements OnDestroy {
  private worker: Worker | null = null;
  private ready$ = new BehaviorSubject<boolean>(false);
  private bestMove$ = new Subject<string>();
  private readyOk$ = new Subject<void>();
  private evaluation$ = new Subject<EngineEval>();
  private config: EngineConfig = { ...DEFAULT_ENGINE_CONFIG };
  private analyzing = false;
  private maxDepthSeen = 0;

  get isReady$(): Observable<boolean> { return this.ready$.asObservable(); }
  get isReady(): boolean { return this.ready$.value; }

  async init(): Promise<void> {
    if (this.worker) return;

    console.log('[SF] init: creating worker...');
    this.worker = new Worker('/assets/stockfish/stockfish-worker.js');
    this.worker.onmessage = (e: MessageEvent) => {
      const line = e.data;
      if (typeof line === 'string' && !line.startsWith('info ')) {
        console.log(`[SF] << ${line}`);
      }
      this.handleMessage(line);
    };
    this.worker.onerror = (e) => {
      console.error('[SF] Worker error:', e);
    };

    // Phase 1: send uci, wait for uciok
    console.log('[SF] init: phase 1 — waiting for uciok...');
    await new Promise<void>(resolve => {
      const sub = this.ready$.subscribe(ready => {
        if (ready) {
          sub.unsubscribe();
          resolve();
        }
      });
      this.send('uci');
    });
    console.log('[SF] init: got uciok');

    // Phase 2: send default config + isready, wait for readyok
    console.log('[SF] init: phase 2 — sending config + isready...');
    this.applyConfig();
    await this.waitReady();
    console.log('[SF] init: got readyok — engine fully ready');
  }

  private send(cmd: string): void {
    console.log(`[SF] >> ${cmd}`);
    this.worker?.postMessage(cmd);
  }

  private handleMessage(line: string): void {
    if (line === 'uciok') {
      this.ready$.next(true);
    } else if (line === 'readyok') {
      this.readyOk$.next();
    } else if (line.startsWith('bestmove')) {
      const parts = line.split(' ');
      console.log(`[SF] bestmove ${parts[1]} (depth ${this.maxDepthSeen})`);
      this.bestMove$.next(parts[1]);
      this.analyzing = false;
    } else if (line.startsWith('info') && line.includes(' score ')) {
      this.parseInfo(line);
    }
  }

  private parseInfo(line: string): void {
    const depthMatch = line.match(/\bdepth (\d+)/);
    const scoreMatch = line.match(/\bscore (cp|mate) (-?\d+)/);
    const pvMatch = line.match(/\bpv (.+)/);
    const multipvMatch = line.match(/\bmultipv (\d+)/);

    if (depthMatch && scoreMatch) {
      const depth = parseInt(depthMatch[1]);
      const evalData: EngineEval = {
        depth,
        score: scoreMatch[1] === 'cp' ? parseInt(scoreMatch[2]) : 0,
        mate: scoreMatch[1] === 'mate' ? parseInt(scoreMatch[2]) : null,
        pv: pvMatch ? pvMatch[1] : '',
        multipv: multipvMatch ? parseInt(multipvMatch[1]) : 1,
      };

      if (depth > this.maxDepthSeen) {
        this.maxDepthSeen = depth;
      }

      this.evaluation$.next(evalData);
    }
  }

  setOptions(config: Partial<EngineConfig>): void {
    console.log('[SF] setOptions called:', JSON.stringify(config));
    this.config = { ...this.config, ...config };
    if (this.config.limitStrength) {
      this.config.skillLevel = eloToSkillLevel(this.config.elo);
      const maxDepth = eloToDepth(this.config.elo);
      if (maxDepth > 0) {
        this.config.depth = maxDepth;
        this.config.moveTime = 0;
      }
    }
    console.log(`[SF] setOptions resolved: skillLevel=${this.config.skillLevel}, depth=${this.config.depth}, moveTime=${this.config.moveTime}`);
    this.applyConfig();
  }

  /**
   * Send setoption commands to the engine (no isready — caller is responsible).
   * NOTE: Never send "setoption name Threads" or "setoption name Hash" —
   * this WASM build (Multi-Variant Stockfish 10) has Threads=1 and Hash=16
   * as fixed min=max values. Sending setoption for them hangs ccall("uci_command")
   * permanently, blocking the Worker thread.
   */
  private applyConfig(): void {
    if (!this.worker || !this.ready$.value) {
      console.warn('[SF] applyConfig: skipped (worker or ready check failed)');
      return;
    }
    this.send(`setoption name Skill Level value ${this.config.skillLevel}`);
  }

  /** Wait for the engine to finish processing all pending commands. */
  waitReady(): Promise<void> {
    return new Promise(resolve => {
      const sub = this.readyOk$.subscribe(() => {
        sub.unsubscribe();
        resolve();
      });
      this.send('isready');
    });
  }

  /**
   * Prepare the engine for sequential game analysis.
   * Stops any running search, clears hash table once, and waits for ready.
   */
  async prepareGameAnalysis(): Promise<void> {
    this.send('stop');
    this.analyzing = false;
    await this.waitReady();
    this.send('setoption name MultiPV value 1');
  }

  /**
   * Fast sequential evaluation for game analysis.
   * No stop/ucinewgame/isready between positions - keeps hash table
   * for massive speedup on consecutive game positions.
   * MUST call prepareGameAnalysis() first.
   */
  evaluateNext(fen: string, depth: number): Promise<{ evals: EngineEval[], bestMove: string }> {
    this.maxDepthSeen = 0;
    return new Promise(resolve => {
      const evals: EngineEval[] = [];

      const evalSub = this.evaluation$.subscribe(evalData => {
        evals.push(evalData);
      });

      const bestMoveSub = this.bestMove$.subscribe(bestMove => {
        evalSub.unsubscribe();
        bestMoveSub.unsubscribe();
        resolve({ evals, bestMove });
      });

      this.send(`position fen ${fen}`);
      this.send(`go depth ${depth}`);
      this.analyzing = true;
    });
  }

  /**
   * Safe one-off evaluation. Stops any running search, waits for clean state,
   * then evaluates. Use for single-position analysis, not batch.
   */
  async evaluateOnce(fen: string, depth: number): Promise<{ evals: EngineEval[], bestMove: string }> {
    this.send('stop');
    this.analyzing = false;
    await this.waitReady();

    this.send('setoption name MultiPV value 1');

    this.maxDepthSeen = 0;
    return new Promise(resolve => {
      const evals: EngineEval[] = [];

      const evalSub = this.evaluation$.subscribe(evalData => {
        evals.push(evalData);
      });

      const bestMoveSub = this.bestMove$.subscribe(bestMove => {
        evalSub.unsubscribe();
        bestMoveSub.unsubscribe();
        resolve({ evals, bestMove });
      });

      this.send(`position fen ${fen}`);
      this.send(`go depth ${depth}`);
      this.analyzing = true;
    });
  }

  getBestMove(fen: string, depth?: number, moveTime?: number): Observable<string> {
    console.log(`[SF] getBestMove: fen=${fen}`);
    return new Observable(subscriber => {
      if (this.analyzing) {
        console.log('[SF] getBestMove: stopping previous search');
        this.send('stop');
        this.analyzing = false;
      }

      const sub = this.bestMove$.subscribe(move => {
        console.log(`[SF] getBestMove: received bestmove=${move}`);
        subscriber.next(move);
        subscriber.complete();
        sub.unsubscribe();
      });

      this.send(`position fen ${fen}`);

      const d = depth || this.config.depth;
      const mt = moveTime || this.config.moveTime;

      console.log(`[SF] getBestMove: depth=${d}, moveTime=${mt}`);
      if (d > 0) {
        this.send(`go depth ${d}`);
      } else if (mt > 0) {
        this.send(`go movetime ${mt}`);
      } else {
        this.send('go depth 15');
      }

      this.analyzing = true;
    });
  }

  analyze(fen: string, depth: number = 20, multiPv: number = 1): Observable<EngineEval> {
    this.stop();
    this.send(`setoption name MultiPV value ${multiPv}`);
    this.send(`position fen ${fen}`);
    this.send(`go depth ${depth}`);
    this.analyzing = true;
    return this.evaluation$.asObservable();
  }

  stop(): void {
    if (this.analyzing) {
      this.send('stop');
      this.analyzing = false;
    }
  }

  destroy(): void {
    this.stop();
    this.worker?.terminate();
    this.worker = null;
    this.ready$.next(false);
  }

  ngOnDestroy(): void {
    this.destroy();
  }
}
