import AsyncStorage from '@react-native-async-storage/async-storage';
import { ACADEMIC_CROSSWORD_PACKS, CrosswordPack } from '../constants/crosswordData';

const CROSSWORD_LEVEL_KEY = '@academic_arena_crossword_level';
const CROSSWORD_SEEN_KEY = '@academic_arena_crossword_seen_roots';
const CROSSWORD_BONUS_EXP_KEY = '@academic_arena_crossword_bonus_exp';

export interface CrosswordLevel {
  level: number;
  packId: string;
  root: string;
  category: string;
  hint: string;
  letters: string[];
  gridWords: string[];
  bonusWords: string[];
}

export class CrosswordService {
  /**
   * Get current player level
   */
  static async getCurrentLevel(): Promise<number> {
    try {
      const raw = await AsyncStorage.getItem(CROSSWORD_LEVEL_KEY);
      return raw ? parseInt(raw, 10) || 1 : 1;
    } catch (e) {
      return 1;
    }
  }

  /**
   * Advance to next level
   */
  static async advanceLevel(): Promise<number> {
    try {
      const current = await this.getCurrentLevel();
      const next = current + 1;
      await AsyncStorage.setItem(CROSSWORD_LEVEL_KEY, next.toString());
      return next;
    } catch (e) {
      return 1;
    }
  }

  /**
   * Generate / Fetch procedural crossword level with 0 repeats
   */
  static async getLevel(levelNumber: number): Promise<CrosswordLevel> {
    const packs = ACADEMIC_CROSSWORD_PACKS;
    const packIndex = (levelNumber - 1) % packs.length;
    const pack = packs[packIndex];

    // Scramble letters for the circular wheel
    const rootLetters = pack.root.toUpperCase().split('');
    const shuffledLetters = [...rootLetters].sort(() => Math.random() - 0.5);

    // Filter grid words: 4 to 8 words per level depending on progression
    const maxWords = Math.min(pack.gridWords.length, 4 + Math.floor(levelNumber / 3));
    const targetGridWords = pack.gridWords.slice(0, maxWords);

    return {
      level: levelNumber,
      packId: pack.id,
      root: pack.root,
      category: pack.category,
      hint: pack.hint,
      letters: shuffledLetters,
      gridWords: targetGridWords,
      bonusWords: pack.bonusWords,
    };
  }

  /**
   * Shuffle wheel letters
   */
  static shuffleLetters(letters: string[]): string[] {
    return [...letters].sort(() => Math.random() - 0.5);
  }
}
