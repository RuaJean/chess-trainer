export interface EngineConfig {
  elo: number;
  depth: number;
  moveTime: number;
  skillLevel: number;
  limitStrength: boolean;
}

export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  elo: 1500,
  depth: 0,
  moveTime: 2000,
  skillLevel: 10,
  limitStrength: true,
};

/**
 * Maps ELO to Stockfish Skill Level (0-20).
 * Stockfish.js 10 only supports Skill Level, NOT UCI_Elo.
 */
export function eloToSkillLevel(elo: number): number {
  if (elo <= 1320) return 0;
  if (elo >= 3190) return 20;
  return Math.round((elo - 1320) / 93.5);
}

/**
 * Returns a max search depth appropriate for the given ELO.
 * Lower ELO = shallower search = weaker play.
 * Without depth limits, Skill Level alone barely weakens Stockfish
 * because it still searches deeply and only adds randomness at leaf nodes.
 */
export function eloToDepth(elo: number): number {
  if (elo <= 1400) return 1;
  if (elo <= 1500) return 2;
  if (elo <= 1600) return 3;
  if (elo <= 1700) return 4;
  if (elo <= 1800) return 5;
  if (elo <= 1900) return 6;
  if (elo <= 2000) return 7;
  if (elo <= 2100) return 8;
  if (elo <= 2200) return 10;
  if (elo <= 2400) return 12;
  if (elo <= 2600) return 14;
  if (elo <= 2800) return 16;
  return 0; // 0 = unlimited (use movetime instead)
}
