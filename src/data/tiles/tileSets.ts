import type { TileGroup } from './types';
import { stoneTiles } from './stoneTiles';
import { dirtTiles } from './dirtTiles';

export const TILE_PREVIEW_SCALE = 0.5;

export const TILE_SETS: TileGroup[] = [
  {
    title: 'Stone Tiles',
    tiles: stoneTiles, 
  },
  {
    title: 'dirtTiles',
    tiles: dirtTiles, 
  },
];
