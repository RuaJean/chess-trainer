// Stockfish Web Worker wrapper
// Loads the WASM build (stockfish.wasm.js) with asm.js fallback (stockfish.js)
try {
  importScripts('stockfish.wasm.js');
} catch (e) {
  importScripts('stockfish.js');
}
