export const SUBJECTS = ['Mathematics', 'Science', 'English', 'Social Science'] as const;
export type Subject = (typeof SUBJECTS)[number];

export const CLASS_OPTIONS = [9, 10] as const;
export type ClassOption = (typeof CLASS_OPTIONS)[number];

export const MAX_HEARTS = 3;
export const STREAK_TO_LEVEL_UP = 3;
export const MIN_DIFFICULTY = 1;
export const MAX_DIFFICULTY = 10;
export const STARTING_DIFFICULTY = 1;

export const SPEED_THRESHOLDS = {
  FAST: 5,
  MEDIUM: 10,
} as const;

export const SPEED_MULTIPLIERS = {
  FAST: 1.5,
  MEDIUM: 1.2,
  NORMAL: 1.0,
} as const;

export const EXP_PER_DIFFICULTY = 100;
export const COMBO_BONUS_PER_STREAK = 50;
export const MAX_COMBO_BONUS = 500;

export const PASSIVE_EXP_INTERVAL = 30000;
export const PASSIVE_EXP_AMOUNT = 5;

export const INACTIVITY_TIMEOUT = 600000;

export const SUBJECT_ICONS: Record<Subject, string> = {
  Mathematics: 'calculator',
  Science: 'flask',
  English: 'book-open',
  'Social Science': 'globe',
};

export const LEADERBOARD_TIERS = {
  BRONZE: { id: 'BRONZE', name: 'Bronze (Textbook Opener)', minEXP: 0, color: '#CD7F32', tag: '📖 Searching for page 1' },
  SILVER: { id: 'SILVER', name: 'Silver (Homework Survivor)', minEXP: 5000, color: '#C0C0C0', tag: '⚡ 1 min before deadline' },
  GOLD: { id: 'GOLD', name: 'Gold (95% Aspirant)', minEXP: 20000, color: '#FFD700', tag: '🏆 Sharma ji is sweating' },
  PLATINUM: { id: 'PLATINUM', name: 'Platinum (Board Elite)', minEXP: 50000, color: '#00F0FF', tag: '⚡ 100% Accuracy Demon' },
  DIAMOND: { id: 'DIAMOND', name: 'Diamond (Academic Demon)', minEXP: 100000, color: '#BD00FF', tag: '👑 200 IQ NCERT Connoisseur' },
  MYTHIC: { id: 'MYTHIC', name: 'Mythic (Grandmaster Topper)', minEXP: 200000, color: '#FF007A', tag: '🔥 CBSE Rank 1 Overlord' },
} as const;

export interface DifficultyTierInfo {
  level: number;
  name: string;
  label: string;
  badge: string;
  expMultiplier: number;
  color: string;
  glowColor: string;
}

export const DIFFICULTY_CONFIG: Record<number, DifficultyTierInfo> = {
  1: { level: 1, name: 'EASY', label: 'Easy', badge: '🟢 EASY', expMultiplier: 1.0, color: '#00FFA3', glowColor: 'rgba(0, 255, 163, 0.3)' },
  2: { level: 2, name: 'MEDIUM', label: 'Medium', badge: '🟡 MEDIUM', expMultiplier: 1.3, color: '#FFD700', glowColor: 'rgba(255, 215, 0, 0.3)' },
  3: { level: 3, name: 'HARD', label: 'Hard', badge: '🟠 HARD', expMultiplier: 1.7, color: '#FF8C00', glowColor: 'rgba(255, 140, 0, 0.3)' },
  4: { level: 4, name: 'VERY_HARD', label: 'Very Hard', badge: '🔴 VERY HARD', expMultiplier: 2.2, color: '#FF2E63', glowColor: 'rgba(255, 46, 99, 0.3)' },
  5: { level: 5, name: 'EXTREME', label: 'Extreme', badge: '🟣 EXTREME', expMultiplier: 2.8, color: '#BD00FF', glowColor: 'rgba(189, 0, 255, 0.3)' },
  6: { level: 6, name: 'LEGENDARY', label: 'Legendary', badge: '👑 LEGENDARY', expMultiplier: 3.5, color: '#00F0FF', glowColor: 'rgba(0, 240, 255, 0.4)' },
};

export const QUESTIONS_PER_BATCH = 10;

