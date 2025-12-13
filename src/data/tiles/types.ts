export type TileDefinition = {
  id: string;
  label: string;
  cols: number;
  rows: number;
  image: string;
  isFixed?: boolean;
};

export type TileGroup = {
  title: string;
  tiles: TileDefinition[];
};
