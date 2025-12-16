import type { HexTileDefinition } from './types';

export const hexTiles: HexTileDefinition[] = [
  {
    id: 'hex-stone',
    gridType: 'hex',
    label: 'Hex Stone',
    image: '/assets/widgets/stone_tile.webp',
    isFixed: true,
  },
  {
    id: 'hex-gravel',
    gridType: 'hex',
    label: 'Hex Gravel',
    image: '/assets/widgets/gravel_tile.webp',
    isFixed: true,
  },
];
