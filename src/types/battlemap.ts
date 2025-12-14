export type BattleMap = {
  id: string;
  project_id: string;
  width: number;
  height: number;
  tile_size: number;
  grid_type: 'square' | 'hex';
  created_at?: string;
};

export type GridType = 'square' | 'hex';

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

export type WidgetAppearance = {
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
  backgroundImageUrl?: string;
};

export type BattleMapWidget = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  content: string;
  appearance?: WidgetAppearance;
  isFixed?: boolean;
  updated_at?: string;
};

export type HexGridSettings = {
  hexSize: number;
  orientation: 'pointy' | 'flat';
};

export type HexWidget = {
  id: string;
  gridType: 'hex';
  q: number;
  r: number;
  s: number;
  tileId: string;
  appearance?: WidgetAppearance;
  updated_at?: string;
};

export type BattleMapConfig = {
  gridType: GridType;
  gridColumns: number;
  gridRows: number;
  cellSize: number;
  widgets: BattleMapWidget[];
  hexSettings?: HexGridSettings;
  hexWidgets?: HexWidget[];
  version?: number;
  updated_at?: string;
};
