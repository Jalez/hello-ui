// Map service types

export interface Map {
  name: string;
  random: number;
  can_use_ai: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface MapWithLevels extends Map {
  levels?: Array<{
    identifier: string;
    name: string;
    json: Record<string, any>;
  }>;
}

export interface CreateMapOptions {
  name: string;
  random?: number;
  can_use_ai?: boolean;
}

export interface UpdateMapOptions {
  random?: number;
  can_use_ai?: boolean;
}







