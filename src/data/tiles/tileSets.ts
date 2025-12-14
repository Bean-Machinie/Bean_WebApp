import type { HexTileDefinition, SquareTileDefinition, TileGroup } from './types';
import { stoneTiles } from './stoneTiles';
import { dirtTiles } from './dirtTiles';
import { hexTiles } from './hexTiles';

export const TILE_PREVIEW_SCALE = 0.85;
export const HEX_TILE_PREVIEW_SCALE = 0.65;
export const HEX_TILE_PREVIEW_GAP = '5.55rem';

export const SQUARE_TILE_SETS: TileGroup<SquareTileDefinition>[] = [
  {
    title: 'Stone Tiles',
    tiles: stoneTiles,
  },
  {
    title: 'Dirt Tiles',
    tiles: dirtTiles,
  },
];

export const HEX_TILE_SETS: TileGroup<HexTileDefinition>[] = [
  {
    title: 'Hex Tiles',
    tiles: hexTiles,
  },
];

// Backwards compatibility export (defaults to square tiles)
export const TILE_SETS = SQUARE_TILE_SETS;
