import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subject, Observable, BehaviorSubject, firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

declare global {
  interface Window {
    vad?: { MicVAD: any };
    ort?: any;
  }
}

export type SpeechStatus = 'listening' | 'processing' | 'loading' | 'stopped' | 'denied' | 'error';

export interface VoiceCommand {
  text: string;
  confidence: number;
}

// Maps piece letters to Spanish names
const PIECE_NAMES_ES: Record<string, string> = {
  'K': 'rey',
  'Q': 'dama',
  'R': 'torre',
  'B': 'alfil',
  'N': 'caballo',
  'P': 'peón',
};

// Maps Spanish piece names back to SAN letters (chess.js uses English letters)
const PIECE_FROM_SPANISH: Record<string, string> = {
  'rey': 'K',
  'dama': 'Q',
  'reina': 'Q',
  'torre': 'R',
  'alfil': 'B',
  'caballo': 'N',
  'peon': '',
  // Common Whisper misrecognitions
  'caladio': 'N',
  'cavallo': 'N',
  'kawajo': 'N',
  'kabayo': 'N',
  'cabayo': 'N',
  'kavajo': 'N',
  'alfin': 'B',
  'alfi': 'B',
  'tore': 'R',
};

@Injectable({ providedIn: 'root' })
export class SpeechService {
  private synthesis = window.speechSynthesis;
  private voiceCommand$ = new Subject<VoiceCommand>();
  private statusChange$ = new Subject<SpeechStatus>();
  private loadingProgress = new BehaviorSubject<number>(0);
  private listening = false;
  private spanishVoice: SpeechSynthesisVoice | null = null;
  private paused = false;
  private ttsGeneration = 0;

  private vad: any = null;
  private api = environment.apiBaseUrl;

  get isRecognitionSupported(): boolean {
    return !!(navigator.mediaDevices?.getUserMedia) && window.isSecureContext;
  }

  get isSynthesisSupported(): boolean {
    return 'speechSynthesis' in window;
  }

  get isListening(): boolean {
    return this.listening && !this.paused;
  }

  get onVoiceCommand$(): Observable<VoiceCommand> {
    return this.voiceCommand$.asObservable();
  }

  get onStatusChange$(): Observable<SpeechStatus> {
    return this.statusChange$.asObservable();
  }

  get loadingProgress$(): Observable<number> {
    return this.loadingProgress.asObservable();
  }

  constructor(private http: HttpClient) {
    this.loadVoices();
  }

  private loadVoices(): void {
    const setVoice = () => {
      const voices = this.synthesis.getVoices();
      this.spanishVoice = voices.find(v => v.lang.startsWith('es')) || null;
    };
    setVoice();
    if (this.synthesis.onvoiceschanged !== undefined) {
      this.synthesis.onvoiceschanged = setVoice;
    }
  }

  private emitStatus(status: SpeechStatus): void {
    this.statusChange$.next(status);
  }

  // --- VAD ---

  private loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      document.head.appendChild(script);
    });
  }

  private async startVAD(): Promise<void> {
    if (this.vad) {
      try {
        await this.vad.start();
        this.emitStatus('listening');
      } catch (err) {
        console.warn('[SPEECH] VAD restart failed:', err);
        this.emitStatus('error');
      }
      return;
    }

    try {
      // Load ONNX runtime + vad-web as standalone scripts (bypasses Angular bundler)
      if (!window.ort) {
        await this.loadScript('/assets/vad/ort.min.js');
      }
      // Set WASM paths before VAD loads
      if (window.ort) {
        window.ort.env.wasm.wasmPaths = '/assets/vad/';
      }
      if (!window.vad) {
        await this.loadScript('/assets/vad/vad.bundle.min.js');
      }

      const MicVAD = window.vad?.MicVAD;
      if (!MicVAD) {
        throw new Error('MicVAD not available after loading scripts');
      }

      this.vad = await MicVAD.new({
        baseAssetPath: '/assets/vad/',
        onnxWASMBasePath: '/assets/vad/',
        model: 'legacy',
        startOnLoad: false,
        additionalAudioConstraints: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
        onSpeechEnd: (audio: Float32Array) => {
          this.onSpeechSegmentEnd(audio);
        },
      });
      await this.vad.start();
      this.emitStatus('listening');
      console.log('[SPEECH] VAD started — mic open');
    } catch (err: any) {
      console.error('[SPEECH] VAD init failed:', err);
      if (err?.name === 'NotAllowedError' || err?.message?.includes('Permission')) {
        this.listening = false;
        this.emitStatus('denied');
      } else {
        this.emitStatus('error');
      }
    }
  }

  private onSpeechSegmentEnd(audio: Float32Array): void {
    if (!this.listening) return;
    this.vad?.pause().catch(() => {});
    this.emitStatus('processing');
    this.transcribeViaApi(audio);
  }

  private async transcribeViaApi(audio: Float32Array): Promise<void> {
    try {
      // Convert Float32Array to WAV blob
      const wavBlob = this.float32ToWav(audio, 16000);
      const formData = new FormData();
      formData.append('file', wavBlob, 'audio.wav');

      const result = await firstValueFrom(
        this.http.post<{ text: string }>(`${this.api}/transcribe/`, formData)
      );

      this.handleTranscribeResult(result.text);
    } catch (err) {
      console.error('[SPEECH] Transcription error:', err);
      this.emitStatus('error');
      this.resumeVAD();
    }
  }

  private float32ToWav(samples: Float32Array, sampleRate: number): Blob {
    const numChannels = 1;
    const bitsPerSample = 16;
    const bytesPerSample = bitsPerSample / 8;
    const blockAlign = numChannels * bytesPerSample;
    const dataSize = samples.length * bytesPerSample;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    // WAV header
    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    };
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);

    // Convert float32 [-1,1] to int16
    let offset = 44;
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      offset += 2;
    }

    return new Blob([buffer], { type: 'audio/wav' });
  }

  private handleTranscribeResult(text: string): void {
    if (!text) {
      this.resumeVAD();
      return;
    }
    const cleaned = text.trim().toLowerCase();
    console.log(`[SPEECH] Transcription: "${cleaned}"`);
    this.voiceCommand$.next({ text: cleaned, confidence: 1.0 });
    this.resumeVAD();
  }

  private async resumeVAD(): Promise<void> {
    if (this.listening && !this.paused) {
      try {
        await this.vad?.start();
        this.emitStatus('listening');
      } catch (err) {
        console.warn('[SPEECH] VAD resume failed:', err);
        this.emitStatus('error');
      }
    }
  }

  // --- Public API ---

  startListening(): void {
    if (this.listening) return;
    this.listening = true;
    this.paused = false;
    // No model to download — start VAD immediately
    this.startVAD();
  }

  async stopListening(): Promise<void> {
    this.listening = false;
    this.paused = false;
    if (this.vad) {
      await this.vad.pause();
      await this.vad.destroy();
      this.vad = null;
    }
    this.emitStatus('stopped');
  }

  speakMove(san: string): void {
    if (!this.isSynthesisSupported) return;
    const text = this.moveToSpanish(san);
    this.speak(text);
  }

  speak(text: string): void {
    if (!this.isSynthesisSupported) return;
    this.synthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-ES';
    if (this.spanishVoice) utterance.voice = this.spanishVoice;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    this.synthesis.speak(utterance);
  }

  async speakAndWait(text: string): Promise<void> {
    if (!this.isSynthesisSupported) return;
    const gen = ++this.ttsGeneration;
    if (this.listening) {
      this.paused = true;
      this.vad?.pause().catch(() => {});
    }
    // Mute mic tracks so browser echo cancellation doesn't suppress TTS
    this.setMicTracksMuted(true);
    this.synthesis.cancel();
    // Small delay after cancel() — browsers drop utterances
    // if speak() is called synchronously after cancel()
    await new Promise(r => setTimeout(r, 80));
    return new Promise(resolve => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'es-ES';
      if (this.spanishVoice) utterance.voice = this.spanishVoice;
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      let settled = false;
      const settle = () => {
        if (settled) return;
        settled = true;
        clearTimeout(safetyTimer);
        this.setMicTracksMuted(false);
        if (gen === this.ttsGeneration) this.resumeAfterTTS();
        resolve();
      };

      utterance.onend = settle;
      utterance.onerror = settle;
      const safetyTimer = setTimeout(settle, Math.max(4000, text.length * 150));

      this.synthesis.speak(utterance);
    });
  }

  private setMicTracksMuted(muted: boolean): void {
    try {
      const stream = this.vad?.stream as MediaStream | undefined;
      if (stream) {
        stream.getTracks().forEach((t: MediaStreamTrack) => t.enabled = !muted);
      }
    } catch { /* ignore */ }
  }

  private resumeAfterTTS(): void {
    if (this.listening && this.paused) {
      this.paused = false;
      setTimeout(() => this.resumeVAD(), 300);
    }
  }

  moveToSpanish(san: string): string {
    if (san === 'O-O') return 'enroque corto';
    if (san === 'O-O-O') return 'enroque largo';

    let text = '';
    let s = san.replace(/[+#!?]/g, '');

    const pieceMatch = s.match(/^([KQRBN])/);
    if (pieceMatch) {
      text += PIECE_NAMES_ES[pieceMatch[1]] + ' ';
      s = s.substring(1);
    }

    const disambig = s.match(/^([a-h]?)(\d?)x?([a-h])(\d)/);
    if (disambig) {
      if (disambig[1] && !pieceMatch) {
        text += this.columnToSpanish(disambig[1]) + ' ';
      } else if (disambig[1]) {
        text += this.columnToSpanish(disambig[1]) + ' ';
      }

      if (s.includes('x')) {
        text += 'captura ';
      }

      text += this.columnToSpanish(disambig[3]) + ' ' + this.rankToSpanish(disambig[4]);
    }

    const promoMatch = san.match(/=([QRBN])/);
    if (promoMatch) {
      text += ' corona ' + PIECE_NAMES_ES[promoMatch[1]];
    }

    if (san.includes('#')) {
      text += ', jaque mate';
    } else if (san.includes('+')) {
      text += ', jaque';
    }

    return text.trim() || san;
  }

  parseSpanishToSan(spoken: string): string | null {
    let text = spoken.toLowerCase().trim()
      .replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i')
      .replace(/ó/g, 'o').replace(/ú/g, 'u')
      .replace(/[.,;:!?¿¡"'()\[\]]/g, '')
      .trim();

    if (!text) return null;

    text = text
      .replace(/\bal\s+fil\b/g, 'alfil')
      .replace(/\bal\s+fill\b/g, 'alfil')
      .replace(/\bca\s+ballo\b/g, 'caballo')
      .replace(/\bca\s+ba\s+llo\b/g, 'caballo')
      .replace(/\bkawajo\b/g, 'caballo')
      .replace(/\bkabayo\b/g, 'caballo')
      .replace(/\bcabayo\b/g, 'caballo')
      .replace(/\bkavajo\b/g, 'caballo')
      .replace(/\bcaladio\b/g, 'caballo')
      .replace(/\bcavallo\b/g, 'caballo')
      .replace(/\balfin\b/g, 'alfil')
      .replace(/\btore\b/g, 'torre')
      .replace(/\bmusica\b/g, '')
      // Castling variants: "en roque" → "enroque", "roke/rocky" → "roque", "korto" → "corto"
      .replace(/\ben\s+ro[ck]+[eiy]?\b/gi, 'enroque')
      .replace(/\bkorto\b/gi, 'corto')
      .replace(/\blargo\b/gi, 'largo')
      // "de 4" → "d 4", "de cuatro" → "d cuatro" (Spanish preposition before digit/rank)
      .replace(/\bde\s+([1-8])\b/g, 'd $1')
      .replace(/\bde\s+(uno|dos|tres|cuatro|cinco|seis|siete|ocho)\b/g, 'd $1')
      .replace(/\s+/g, ' ')
      .trim();

    if (!text) return null;

    console.log(`[SPEECH] Parsing: "${text}"`);

    // Castling detection (after normalization)
    if (/enroque\s*(corto|rey|kingside)?/.test(text) && !text.includes('largo') && !text.includes('dama')) return 'O-O';
    if (text.includes('enroque largo') || text.includes('enroque dama')) return 'O-O-O';

    const directSan = text.replace(/\s/g, '');
    if (/^[KQRBN]?[a-h]?x?[a-h][1-8](=[QRBN])?$/.test(directSan)) {
      console.log(`[SPEECH] Direct SAN match: "${directSan}"`);
      return directSan;
    }

    let remaining = text.replace(
      /^(el|la|un|una|los|las|mi|tu|su|mueve|muevo|juego|juega|mover|pon|poner)\s+/,
      ''
    ).trim();

    let san = '';

    const pieceEntries = Object.entries(PIECE_FROM_SPANISH);
    pieceEntries.sort((a, b) => b[0].length - a[0].length);
    for (const [name, letter] of pieceEntries) {
      if (remaining.startsWith(name + ' ') || remaining === name) {
        san += letter;
        remaining = remaining.substring(name.length).trim();
        break;
      }
    }

    const isCapture = remaining.includes('captura') || remaining.includes('come')
      || remaining.includes('toma') || remaining.includes('por');
    remaining = remaining.replace(/\b(captura|come|toma|por)\b/g, '').trim();

    remaining = remaining.replace(/\b(a|en|la|el|las|los|al|del)\b/g, ' ').replace(/\s+/g, ' ').trim();

    const words = remaining.split(/\s+/).filter(w => w.length > 0);
    let col = '';
    let row = '';
    let disambigCol = '';

    for (const word of words) {
      const squareMatch = word.match(/^([a-h])([1-8])$/);
      if (squareMatch) {
        col = squareMatch[1];
        row = squareMatch[2];
        continue;
      }

      const colMatch = this.wordToColumn(word);
      if (colMatch) {
        if (!col) {
          col = colMatch;
        } else if (!row) {
          disambigCol = col;
          col = colMatch;
        }
        continue;
      }

      const rowMatch = this.wordToRow(word);
      if (rowMatch) {
        row = rowMatch;
        continue;
      }

      if (word.length >= 2) {
        const c = this.wordToColumn(word[0]);
        const r = this.wordToRow(word.substring(1));
        if (c && r) {
          col = c;
          row = r;
        }
      }
    }

    if (!col || !row) {
      console.log(`[SPEECH] Parse failed: col="${col}" row="${row}" from words=[${words.join(', ')}]`);
      return null;
    }

    if (disambigCol) {
      san += disambigCol;
    }
    if (isCapture) {
      san += 'x';
    }

    san += col + row;

    console.log(`[SPEECH] Parsed "${text}" → "${san}"`);
    return san || null;
  }

  private columnToSpanish(col: string): string {
    const names: Record<string, string> = {
      'a': 'a', 'b': 'be', 'c': 'ce', 'd': 'de',
      'e': 'e', 'f': 'efe', 'g': 'ge', 'h': 'hache',
    };
    return names[col] || col;
  }

  private rankToSpanish(rank: string): string {
    const names: Record<string, string> = {
      '1': 'uno', '2': 'dos', '3': 'tres', '4': 'cuatro',
      '5': 'cinco', '6': 'seis', '7': 'siete', '8': 'ocho',
    };
    return names[rank] || rank;
  }

  private wordToColumn(word: string): string | null {
    const map: Record<string, string> = {
      'a': 'a', 'alfa': 'a', 'ah': 'a', 'alpha': 'a', 'ha': 'a',
      'be': 'b', 'b': 'b', 'beta': 'b', 've': 'b', 'uve': 'b', 'bravo': 'b', 'bay': 'b',
      'ce': 'c', 'c': 'c', 'se': 'c', 'charlie': 'c', 'ze': 'c',
      'de': 'd', 'd': 'd', 'delta': 'd', 'the': 'd',
      'e': 'e', 'eco': 'e', 'echo': 'e',
      'efe': 'f', 'f': 'f', 'foxtrot': 'f', 'ef': 'f',
      'ge': 'g', 'g': 'g', 'he': 'g', 'je': 'g', 'golf': 'g', 'gay': 'g',
      'hache': 'h', 'h': 'h', 'ache': 'h', 'hotel': 'h', 'ash': 'h',
    };
    return map[word] || null;
  }

  private wordToRow(word: string): string | null {
    const map: Record<string, string> = {
      'uno': '1', 'una': '1', '1': '1', 'un': '1', 'primero': '1', 'primera': '1',
      'dos': '2', '2': '2', 'segundo': '2', 'segunda': '2',
      'tres': '3', '3': '3', 'tercero': '3', 'tercera': '3',
      'cuatro': '4', '4': '4', 'quatro': '4', 'cuartro': '4',
      'cinco': '5', '5': '5', 'sinco': '5',
      'seis': '6', '6': '6', 'sei': '6', 'says': '6',
      'siete': '7', '7': '7', 'ciete': '7',
      'ocho': '8', '8': '8', 'oyo': '8',
    };
    return map[word] || null;
  }
}
