export type ThemeId = 'system' | 'light' | 'dark' | 'ocean' | 'forest' | 'neon' | 'sunset';

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
    description: 'Bright backgrounds and strong contrast.',
  },
  {
    id: 'dark',
    name: 'Dark',
    description: 'Low-glare palette for late sessions.',
  },
  {
    id: 'ocean',
    name: 'Ocean',
    description: 'Reserved for future rolling waves of blue.',
  },
  {
    id: 'forest',
    name: 'Forest',
    description: 'Reserved for earthy, woodland-inspired greens.',
  },
  {
    id: 'neon',
    name: 'Neon',
    description: 'Reserved for a vivid high-contrast glow.',
  },
  {
    id: 'sunset',
    name: 'Sunset',
    description: 'Reserved for warm, radiant dusk tones.',
  },
];
