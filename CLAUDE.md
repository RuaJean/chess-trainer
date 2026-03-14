# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
ng serve              # Dev server at http://localhost:4200 (with Lichess proxy)
ng build              # Production build → dist/
ng test               # Unit tests via Karma/Jasmine
ng test --include='**/chess-logic.service.spec.ts'  # Run a single test file
```

The dev server uses `proxy.conf.json` to proxy `/lichess-api/*` → `https://lichess.org/api/*` to avoid CORS issues.

## Architecture

Angular 17.3 app using **standalone components** (no NgModules). All routes are lazy-loaded. Dark-themed chess training tool with offline-first design (IndexedDB via Dexie, no backend server).

### Layer Structure

- **`src/app/models/`** — TypeScript interfaces: `Game`, `ClockConfig`/`ClockState`, `EngineConfig`
- **`src/app/core/services/`** — Singleton services (`providedIn: 'root'`):
  - `ChessLogicService` — Wraps `chess.js` for move validation, PGN/FEN handling
  - `StockfishService` — Manages Stockfish WASM engine via Web Worker, UCI protocol
  - `GameAnalysisService` — Full game analysis with Lichess-compatible accuracy/classification formulas
  - `DatabaseService` — Dexie IndexedDB CRUD for games and settings
  - `ClockService` — Chess clock with `performance.now()` precision
  - `LichessApiService` — Fetches games via NDJSON, uses proxy with direct HTTPS fallback
  - `PgnService` — PGN parsing/export and file import
  - `SoundService` — Web Audio API synthesized move sounds (no audio files)
  - `SpeechService` — Spanish voice recognition/synthesis for blindfold mode
- **`src/app/shared/components/`** — Reusable UI: `BoardComponent` (Chessground wrapper), `ClockComponent`, `MoveListComponent`, `EvalChartComponent`
- **`src/app/features/`** — Lazy-loaded feature routes:
  - `play-ai/` — Play vs Stockfish with configurable ELO and clock
  - `analysis/` — Position and full-game analysis with eval chart and move arrows
  - `games-library/` — Game database with import (PGN/Lichess) and export
  - `blindfold/` — Blindfold training with Spanish voice input/output
  - `settings/` — Database export/import and app info

### Key Design Decisions

- **Single-threaded Stockfish**: Intentional — multi-threaded WASM requires COOP/COEP headers which break the Web Speech API used in blindfold mode.
- **Fast game analysis**: `StockfishService.evaluateNext()` reuses the hash table across sequential positions (no `ucinewgame` between moves) for speed.
- **Component styles are inline** (via Angular's `styles` property), not in separate SCSS files. Global styles/variables are in `src/styles.scss` and `src/styles/variables.scss`.
- **Chessground CSS** is loaded as a build asset from `node_modules` (configured in `angular.json`).
- **All persistence is IndexedDB** via Dexie — no localStorage, no backend.

### Key Libraries

| Library | Purpose |
|---------|---------|
| `chess.js` | Move validation, PGN/FEN parsing (allowed as CommonJS in angular.json) |
| `chessground` | Interactive board UI (Lichess's board library) |
| `stockfish.js` | Chess engine (WASM), files in `src/assets/stockfish/` |
| `dexie` | IndexedDB wrapper for game/settings storage |
