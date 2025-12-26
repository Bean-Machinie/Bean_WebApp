import type { HexTileDefinition } from './types';
import { toPublicAssetUrl } from '@/lib/assetPaths';

export const hexTiles: HexTileDefinition[] = [
  {
    id: 'hex_grass',
    gridType: 'hex',
    label: 'hex_grass',
    image: toPublicAssetUrl('assets/widgets/hex/grass/hex_grass.webp'),
    isFixed: true,
  },
  {
    id: 'hex_grass_path_1',
    gridType: 'hex',
    label: 'hex_grass_path_1',
    image: toPublicAssetUrl('assets/widgets/hex/grass/hex_grass_path_1.webp'),
    isFixed: true,
  },
  {
    id: 'hex_grass_path_2',
    gridType: 'hex',
    label: 'hex_grass_path_2',
    image: toPublicAssetUrl('assets/widgets/hex/grass/hex_grass_path_2.webp'),
    isFixed: true,
  },
  {
    id: 'hex_grass_path_3',
    gridType: 'hex',
    label: 'hex_grass_path_3',
    image: toPublicAssetUrl('assets/widgets/hex/grass/hex_grass_path_3.webp'),
    isFixed: true,
  },
  {
    id: 'hex_grass_path_4',
    gridType: 'hex',
    label: 'hex_grass_path_4',
    image: toPublicAssetUrl('assets/widgets/hex/grass/hex_grass_path_4.webp'),
    isFixed: true,
  },
  {
    id: 'hex_grass_path_5',
    gridType: 'hex',
    label: 'hex_grass_path_5',
    image: toPublicAssetUrl('assets/widgets/hex/grass/hex_grass_path_5.webp'),
    isFixed: true,
  },
  {
    id: 'hex_grass_path_6',
    gridType: 'hex',
    label: 'hex_grass_path_6',
    image: toPublicAssetUrl('assets/widgets/hex/grass/hex_grass_path_6.webp'),
    isFixed: true,
  },
];
