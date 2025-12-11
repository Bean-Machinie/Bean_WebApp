export type BattleMap = {
  id: string;
  project_id: string;
  width: number;
  height: number;
  tile_size: number;
  grid_type: 'square' | 'hex';
  created_at?: string;
};

export type Tile = {
  id: string;
  owner: string;
  name: string;
  image_url: string;
  type?: string;
  created_at?: string;
};

export type PlacedTile = {
  id: string;
  map_id: string;
  tile_id: string;
  x: number;
  y: number;
  rotation?: number;
  scale?: number;
  // Joined data
  tile?: Tile;
};

export type BattleMapWidget = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  content: string;
  isFixed?: boolean;
  updated_at?: string;
};

export type BattleMapConfig = {
  gridColumns: number;
  gridRows: number;
  cellSize: number;
  widgets: BattleMapWidget[];
  version?: number;
  updated_at?: string;
};
