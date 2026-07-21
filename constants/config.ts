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
  BRONZE: { name: 'Bronze', minEXP: 0, color: '#CD7F32' },
  SILVER: { name: 'Silver', minEXP: 5000, color: '#C0C0C0' },
  GOLD: { name: 'Gold', minEXP: 20000, color: '#FFD700' },
  DIAMOND: { name: 'Diamond', minEXP: 50000, color: '#B9F2FF' },
} as const;

export const QUESTIONS_PER_BATCH = 10;
