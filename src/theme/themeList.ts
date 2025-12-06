export type ThemeId = 'ink-wash' | 'light' | 'dark';

export type ThemeOption = {
  id: ThemeId;
  name: string;
  description: string;
};

export const themeOptions: ThemeOption[] = [
  {
    id: 'ink-wash',
    name: 'Ink Wash',
    description: 'Graphite neutrals inspired by monochrome ink.',
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
];
