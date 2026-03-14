export interface ClockConfig {
  initialTime: number; // seconds
  increment: number;   // seconds
}

export interface ClockState {
  whiteTime: number;  // milliseconds remaining
  blackTime: number;  // milliseconds remaining
  activeSide: 'w' | 'b' | null;
  flagged: 'w' | 'b' | null;
}

export const CLOCK_PRESETS: { label: string; config: ClockConfig }[] = [
  { label: '1+0 (Bullet)', config: { initialTime: 60, increment: 0 } },
  { label: '2+1 (Bullet)', config: { initialTime: 120, increment: 1 } },
  { label: '3+0 (Blitz)', config: { initialTime: 180, increment: 0 } },
  { label: '3+2 (Blitz)', config: { initialTime: 180, increment: 2 } },
  { label: '5+0 (Blitz)', config: { initialTime: 300, increment: 0 } },
  { label: '5+3 (Blitz)', config: { initialTime: 300, increment: 3 } },
  { label: '10+0 (Rapid)', config: { initialTime: 600, increment: 0 } },
  { label: '15+10 (Rapid)', config: { initialTime: 900, increment: 10 } },
  { label: '30+0 (Classical)', config: { initialTime: 1800, increment: 0 } },
  { label: 'No clock', config: { initialTime: 0, increment: 0 } },
];
