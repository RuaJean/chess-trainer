import { Injectable } from '@angular/core';
import { ECO_OPENINGS, EcoEntry } from '../data/eco-openings';

export interface OpeningMatch {
  eco: string;
  name: string;
  ply: number;
}

interface ProcessedEntry {
  eco: string;
  name: string;
  sans: string[];
}

@Injectable({ providedIn: 'root' })
export class OpeningService {
  private entries: ProcessedEntry[] = [];

  constructor() {
    this.entries = ECO_OPENINGS.map(e => ({
      eco: e.eco,
      name: e.name,
      sans: this.parseMoves(e.moves),
    }));
    // Sort by number of moves descending so longest match is found first
    this.entries.sort((a, b) => b.sans.length - a.sans.length);
  }

  /**
   * Detect the opening from an array of SAN moves (e.g. ['e4', 'e5', 'Nf3', 'Nc6']).
   * Returns the most specific (longest) matching opening, or null.
   */
  detectOpening(moves: string[]): OpeningMatch | null {
    const normalized = moves.map(m => this.normalizeSan(m));

    for (const entry of this.entries) {
      if (entry.sans.length > normalized.length) continue;
      if (entry.sans.length === 0) continue;

      let match = true;
      for (let i = 0; i < entry.sans.length; i++) {
        if (entry.sans[i] !== normalized[i]) {
          match = false;
          break;
        }
      }
      if (match) {
        return { eco: entry.eco, name: entry.name, ply: entry.sans.length };
      }
    }
    return null;
  }

  /** Lookup by ECO code — returns the first match. */
  getOpeningByEco(eco: string): { eco: string; name: string } | null {
    const entry = ECO_OPENINGS.find(e => e.eco === eco);
    return entry ? { eco: entry.eco, name: entry.name } : null;
  }

  /** Parse a move string like "1.e4 e5 2.Nf3 Nc6" into ['e4', 'e5', 'Nf3', 'Nc6'] */
  private parseMoves(moveText: string): string[] {
    return moveText
      .replace(/\d+\.\s*/g, '')  // Remove move numbers
      .split(/\s+/)
      .filter(s => s.length > 0)
      .map(s => this.normalizeSan(s));
  }

  /** Normalize a SAN string: strip check/mate symbols and annotations */
  private normalizeSan(san: string): string {
    return san.replace(/[+#!?]+$/, '');
  }
}
