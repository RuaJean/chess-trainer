export interface Game {
  id?: number;
  collection_id?: number | null;
  pgn: string;
  white: string;
  black: string;
  white_elo?: number | null;
  black_elo?: number | null;
  date: string;
  result: string;
  event: string;
  site: string;
  round?: string;
  eco: string;
  opening_name?: string;
  fen?: string;
  ply_count?: number;
  pgn_headers?: Record<string, string>;
  tags: Record<string, string>;
  source: 'manual' | 'import' | 'lichess' | 'ai-game';
  analysis_json?: string;
  notes?: string;
  is_favorite?: boolean;
  created_at?: Date | string;
  // Tag references from backend
  game_tags?: { id: number; name: string; color: string }[];
}

export interface Collection {
  id: number;
  name: string;
  description: string;
  type: 'custom' | 'lichess' | 'ai-games' | 'import' | 'repertoire';
  icon: string;
  color: string;
  pinned: boolean;
  source_info: Record<string, any>;
  game_count: number;
  created_at: string;
  updated_at: string;
}

export interface Tag {
  id: number;
  name: string;
  color: string;
}
