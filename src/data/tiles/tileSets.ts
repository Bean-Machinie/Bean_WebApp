import type { TileGroup } from './types';
import { stoneTiles } from './stoneTiles';

export const TILE_PREVIEW_SCALE = 0.5;

export const TILE_SETS: TileGroup[] = [
  {
    title: 'Stone Tiles',
    tiles: stoneTiles, 
  },
];
