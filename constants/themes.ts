export type ThemeMode = 'dark' | 'light';

export type ThemePresetKey =
  | 'sakura_zen'
  | 'cosmic_lofi'
  | 'cyber_neon'
  | 'botanical_calm'
  | 'ember_arena';

export interface ThemePreset {
  id: ThemePresetKey;
  name: string;
  emoji: string;
  defaultMode: ThemeMode;
  fontFamily: string; // e.g. System, sans-serif-rounded, sans-serif-medium
  wallpaperUrl: string; // High-res soothing background imagery
  colors: {
    dark: {
      background: string;
      surface: string;
      surfaceHighlight: string;
      text: string;
      textMuted: string;
      border: string;
      primary: string;
      secondary: string;
      accent: string;
      cardBg: string;
    };
    light: {
      background: string;
      surface: string;
      surfaceHighlight: string;
      text: string;
      textMuted: string;
      border: string;
      primary: string;
      secondary: string;
      accent: string;
      cardBg: string;
    };
  };
}

export const THEME_PRESETS: Record<ThemePresetKey, ThemePreset> = {
  sakura_zen: {
    id: 'sakura_zen',
    name: 'Pastel Sakura',
    emoji: '🌸',
    defaultMode: 'light',
    fontFamily: 'System',
    wallpaperUrl: 'https://images.unsplash.com/photo-1522383225653-ed111181a951?auto=format&fit=crop&w=1200&q=80',
    colors: {
      light: {
        background: '#FFF5F7',
        surface: 'rgba(255, 255, 255, 0.92)',
        surfaceHighlight: '#FFE4E9',
        text: '#4A202A',
        textMuted: '#966771',
        border: 'rgba(255, 182, 193, 0.5)',
        primary: '#FF4D6D',
        secondary: '#FF758F',
        accent: '#C9184A',
        cardBg: 'rgba(255, 255, 255, 0.88)',
      },
      dark: {
        background: '#1A0D13',
        surface: '#29141D',
        surfaceHighlight: '#3E1C2B',
        text: '#FFE5EC',
        textMuted: '#B38B98',
        border: 'rgba(255, 77, 109, 0.25)',
        primary: '#FF4D6D',
        secondary: '#FF758F',
        accent: '#FFB3C1',
        cardBg: 'rgba(41, 20, 29, 0.9)',
      },
    },
  },
  cosmic_lofi: {
    id: 'cosmic_lofi',
    name: 'Cosmic Lofi',
    emoji: '🌌',
    defaultMode: 'dark',
    fontFamily: 'System',
    wallpaperUrl: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=1200&q=80',
    colors: {
      dark: {
        background: '#0B0D1B',
        surface: '#151930',
        surfaceHighlight: '#22284D',
        text: '#F0F3FF',
        textMuted: '#8E9BBF',
        border: 'rgba(120, 119, 198, 0.3)',
        primary: '#7C3AED',
        secondary: '#A855F7',
        accent: '#06B6D4',
        cardBg: 'rgba(21, 25, 48, 0.92)',
      },
      light: {
        background: '#F3F4FD',
        surface: '#FFFFFF',
        surfaceHighlight: '#E8EAFF',
        text: '#1E1B4B',
        textMuted: '#6B7280',
        border: 'rgba(124, 58, 237, 0.2)',
        primary: '#6D28D9',
        secondary: '#8B5CF6',
        accent: '#0284C7',
        cardBg: 'rgba(255, 255, 255, 0.92)',
      },
    },
  },
  cyber_neon: {
    id: 'cyber_neon',
    name: 'Cyber Neon',
    emoji: '⚡',
    defaultMode: 'dark',
    fontFamily: 'System',
    wallpaperUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80',
    colors: {
      dark: {
        background: '#080A10',
        surface: '#101424',
        surfaceHighlight: '#1A213D',
        text: '#FFFFFF',
        textMuted: '#7E8B9B',
        border: 'rgba(0, 240, 255, 0.3)',
        primary: '#00F0FF',
        secondary: '#FF0055',
        accent: '#00FF66',
        cardBg: 'rgba(16, 20, 36, 0.9)',
      },
      light: {
        background: '#F0F9FF',
        surface: '#FFFFFF',
        surfaceHighlight: '#E0F2FE',
        text: '#0C4A6E',
        textMuted: '#64748B',
        border: 'rgba(2, 132, 199, 0.25)',
        primary: '#0284C7',
        secondary: '#E11D48',
        accent: '#059669',
        cardBg: 'rgba(255, 255, 255, 0.95)',
      },
    },
  },
  botanical_calm: {
    id: 'botanical_calm',
    name: 'Cozy Botanical',
    emoji: '🌿',
    defaultMode: 'light',
    fontFamily: 'System',
    wallpaperUrl: 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?auto=format&fit=crop&w=1200&q=80',
    colors: {
      light: {
        background: '#F4F9F4',
        surface: '#FFFFFF',
        surfaceHighlight: '#E6F4EA',
        text: '#1C3829',
        textMuted: '#587A68',
        border: 'rgba(52, 168, 83, 0.25)',
        primary: '#2D6A4F',
        secondary: '#52B788',
        accent: '#D8F3DC',
        cardBg: 'rgba(255, 255, 255, 0.92)',
      },
      dark: {
        background: '#0E1712',
        surface: '#18271F',
        surfaceHighlight: '#23382D',
        text: '#E8F5E9',
        textMuted: '#81C784',
        border: 'rgba(82, 183, 136, 0.25)',
        primary: '#52B788',
        secondary: '#74C69D',
        accent: '#D8F3DC',
        cardBg: 'rgba(24, 39, 31, 0.92)',
      },
    },
  },
  ember_arena: {
    id: 'ember_arena',
    name: 'Ember Hellfight',
    emoji: '🔥',
    defaultMode: 'dark',
    fontFamily: 'System',
    wallpaperUrl: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?auto=format&fit=crop&w=1200&q=80',
    colors: {
      dark: {
        background: '#140306',
        surface: '#26080E',
        surfaceHighlight: '#3E0D17',
        text: '#FFF0F2',
        textMuted: '#B87882',
        border: 'rgba(255, 51, 0, 0.35)',
        primary: '#FF2E00',
        secondary: '#FF6B00',
        accent: '#FFD600',
        cardBg: 'rgba(38, 8, 14, 0.92)',
      },
      light: {
        background: '#FFF4ED',
        surface: '#FFFFFF',
        surfaceHighlight: '#FFE5D4',
        text: '#431407',
        textMuted: '#9A3412',
        border: 'rgba(234, 88, 12, 0.25)',
        primary: '#EA580C',
        secondary: '#F97316',
        accent: '#FBBF24',
        cardBg: 'rgba(255, 255, 255, 0.95)',
      },
    },
  },
};

// Streak-reactive in-game visual atmospheres
export const STREAK_ATMOSPHERES = [
  {
    minStreak: 0,
    maxStreak: 2,
    name: 'Sapphire Calm',
    tag: 'WARMING UP BRAIN CELLS 🧠',
    gradient: ['#0A1931', '#150E28', '#050510'],
    accent: '#00D2FF',
    badgeBg: 'rgba(0, 210, 255, 0.15)',
    pulseSpeed: 1000,
  },
  {
    minStreak: 3,
    maxStreak: 5,
    name: 'Amethyst Surge',
    tag: 'COOKING MODE ACTIVATED 🍳',
    gradient: ['#2E0854', '#170634', '#08011A'],
    accent: '#B800FF',
    badgeBg: 'rgba(184, 0, 255, 0.2)',
    pulseSpeed: 800,
  },
  {
    minStreak: 6,
    maxStreak: 8,
    name: 'Cyber Overdrive',
    tag: 'SHARMA JI KA BETA ENERGY ⚡',
    gradient: ['#4A0033', '#2B0024', '#100010'],
    accent: '#FF007A',
    badgeBg: 'rgba(255, 0, 122, 0.25)',
    pulseSpeed: 600,
  },
  {
    minStreak: 9,
    maxStreak: 11,
    name: 'Inferno Crimson',
    tag: '100% BOARD TOPPER MOMENT 🔥',
    gradient: ['#4D0800', '#2E0500', '#140100'],
    accent: '#FF3B00',
    badgeBg: 'rgba(255, 59, 0, 0.25)',
    pulseSpeed: 450,
  },
  {
    minStreak: 12,
    maxStreak: 999,
    name: 'Solar Supernova',
    tag: 'UNSTOPPABLE ACADEMIC WEAPON 👑',
    gradient: ['#4D3200', '#2B1B00', '#120B00'],
    accent: '#FFD700',
    badgeBg: 'rgba(255, 215, 0, 0.3)',
    pulseSpeed: 300,
  },
];

export function getStreakAtmosphere(streak: number) {
  for (const atm of STREAK_ATMOSPHERES) {
    if (streak >= atm.minStreak && streak <= atm.maxStreak) {
      return atm;
    }
  }
  return STREAK_ATMOSPHERES[STREAK_ATMOSPHERES.length - 1];
}
