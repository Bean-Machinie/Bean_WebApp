import type { TileDefinition } from './types';

export const stoneTiles: TileDefinition[] = [
  {
    id: 'stone-2x2',
    label: 'Big Stone',
    cols: 2,
    rows: 2,
    image: '/assets/widgets/stone_tile.webp',
    isFixed: true,
  },
{
    id: 'gravel-1x1',
    label: 'Small Gravel',
    cols: 1,
    rows: 1,
    image: '/assets/widgets/gravel_tile.webp',
    isFixed: true,
  },
];