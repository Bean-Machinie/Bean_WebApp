import type { TileDefinition } from './types';

export const dirtTiles: TileDefinition[] = [
  {
    id: 'dirt-1x1',
    label: 'Dirt 1x1',
    cols: 1,
    rows: 1,
    image: '/assets/widgets/dirt_tile.webp',
    isFixed: true, // or false if you want it resizable
  },
  // add more dirt variants here
];
