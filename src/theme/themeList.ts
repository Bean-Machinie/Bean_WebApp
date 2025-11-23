export type ThemeId =
  | 'system'
  | 'light'
  | 'dark'
  | 'ink-wash'
  | 'jade-pebble'
  | 'urban-slate'
  | 'sorbet'
  | 'yacht-club';

export type ThemeOption = {
  id: ThemeId;
  name: string;
  description: string;
};

export const themeOptions: ThemeOption[] = [
  {
    id: 'system',
    name: 'System',
    description: 'Automatically follows your OS preference.',
  },
  {
    id: 'light',
    name: 'Light',
    description: 'Bright, crisp default palette.',
  },
  {
    id: 'dark',
    name: 'Dark',
    description: 'Low-glare palette for late sessions.',
  },
  {
    id: 'ink-wash',
    name: 'Ink Wash',
    description: 'Graphite neutrals inspired by monochrome ink.',
  },
  {
    id: 'jade-pebble',
    name: 'Jade Pebble Morning',
    description: 'Soft greens and stone neutrals.',
  },
  {
    id: 'urban-slate',
    name: 'Urban Slate',
    description: 'Warm grays with steel blue accents.',
  },
  {
    id: 'sorbet',
    name: 'Sorbet',
    description: 'Pastel citrus and berry tones.',
  },
  {
    id: 'yacht-club',
    name: 'Yacht Club',
    description: 'Nautical copper and deep teal highlights.',
  },
];
