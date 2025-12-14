type BaseTileDefinition = {
  id: string;
  label: string;
  image: string;
  isFixed?: boolean;
};

export type SquareTileDefinition = BaseTileDefinition & {
  gridType: 'square';
  cols: number;
  rows: number;
};

export type HexTileDefinition = BaseTileDefinition & {
  gridType: 'hex';
};

export type TileDefinition = SquareTileDefinition | HexTileDefinition;

export type TileGroup<T extends TileDefinition = TileDefinition> = {
  title: string;
  tiles: T[];
};
