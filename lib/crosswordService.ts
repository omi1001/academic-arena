import AsyncStorage from '@react-native-async-storage/async-storage';
import { ACADEMIC_CROSSWORD_PACKS, CrosswordPack } from '../constants/crosswordData';

const CROSSWORD_LEVEL_KEY = '@academic_arena_crossword_level';
const CROSSWORD_HINT_POINTS_KEY = '@academic_arena_crossword_hint_points';

export interface GridPlacement {
  word: string;
  row: number;
  col: number;
  direction: 'H' | 'V';
}

export interface CrosswordCell {
  row: number;
  col: number;
  char: string;
  words: string[];
}

export interface CrosswordLayout {
  rows: number;
  cols: number;
  placements: GridPlacement[];
  grid: (CrosswordCell | null)[][];
  targetWords: string[];
}

export interface CrosswordLevel {
  level: number;
  packId: string;
  root: string;
  category: string;
  hint: string;
  letters: string[];
  gridWords: string[];
  bonusWords: string[];
  isBonusLevel: boolean;
  layout: CrosswordLayout;
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
   * Get player's available Hint Points (💡)
   */
  static async getHintPoints(): Promise<number> {
    try {
      const raw = await AsyncStorage.getItem(CROSSWORD_HINT_POINTS_KEY);
      return raw !== null ? parseInt(raw, 10) : 5; // Default 5 starting hints
    } catch (e) {
      return 5;
    }
  }

  /**
   * Add hint points (e.g. from bonus words or bonus levels)
   */
  static async addHintPoints(amount: number): Promise<number> {
    try {
      const current = await this.getHintPoints();
      const updated = current + amount;
      await AsyncStorage.setItem(CROSSWORD_HINT_POINTS_KEY, updated.toString());
      return updated;
    } catch (e) {
      return 5;
    }
  }

  /**
   * Spend hint points
   */
  static async spendHintPoints(amount: number): Promise<{ success: boolean; remaining: number }> {
    try {
      const current = await this.getHintPoints();
      if (current < amount) {
        return { success: false, remaining: current };
      }
      const updated = current - amount;
      await AsyncStorage.setItem(CROSSWORD_HINT_POINTS_KEY, updated.toString());
      return { success: true, remaining: updated };
    } catch (e) {
      return { success: false, remaining: 0 };
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
   * Generate an authentic intersecting 2D crossword grid layout
   */
  static generateCrosswordLayout(words: string[]): CrosswordLayout {
    const sorted = [...words].sort((a, b) => b.length - a.length);
    const placements: GridPlacement[] = [];
    const cellMap = new Map<string, { char: string; words: string[]; row: number; col: number }>();

    const setCell = (r: number, c: number, char: string, word: string) => {
      const key = `${r},${c}`;
      const existing = cellMap.get(key);
      if (existing) {
        if (!existing.words.includes(word)) existing.words.push(word);
      } else {
        cellMap.set(key, { char, words: [word], row: r, col: c });
      }
    };

    // Helper validation function
    const canPlaceWord = (
      w: string,
      startRow: number,
      startCol: number,
      dir: 'H' | 'V'
    ): boolean => {
      const beforeKey = dir === 'V' ? `${startRow - 1},${startCol}` : `${startRow},${startCol - 1}`;
      const afterKey = dir === 'V' ? `${startRow + w.length},${startCol}` : `${startRow},${startCol + w.length}`;
      if (cellMap.has(beforeKey) || cellMap.has(afterKey)) return false;

      let touches = 0;
      for (let i = 0; i < w.length; i++) {
        const r = dir === 'V' ? startRow + i : startRow;
        const c = dir === 'H' ? startCol + i : startCol;
        const key = `${r},${c}`;
        const existing = cellMap.get(key);

        if (existing) {
          if (existing.char !== w[i]) return false;
          touches++;
        } else {
          const side1 = dir === 'V' ? `${r},${c - 1}` : `${r - 1},${c}`;
          const side2 = dir === 'V' ? `${r},${c + 1}` : `${r + 1},${c}`;
          if (cellMap.has(side1) || cellMap.has(side2)) return false;
        }
      }
      return touches >= 1;
    };

    // Place first word horizontally
    const firstWord = sorted[0];
    placements.push({ word: firstWord, row: 0, col: 0, direction: 'H' });
    for (let i = 0; i < firstWord.length; i++) {
      setCell(0, i, firstWord[i], firstWord);
    }

    // Place intersecting words
    for (let wIdx = 1; wIdx < sorted.length; wIdx++) {
      const word = sorted[wIdx];
      let bestPlacement: GridPlacement | null = null;
      let maxIntersections = -1;

      for (const placed of [...placements]) {
        const targetDir: 'H' | 'V' = placed.direction === 'H' ? 'V' : 'H';

        for (let i = 0; i < word.length; i++) {
          const char = word[i];
          for (let j = 0; j < placed.word.length; j++) {
            if (placed.word[j] === char) {
              const intersectRow = placed.direction === 'H' ? placed.row : placed.row + j;
              const intersectCol = placed.direction === 'H' ? placed.col + j : placed.col;

              const startRow = targetDir === 'V' ? intersectRow - i : intersectRow;
              const startCol = targetDir === 'H' ? intersectCol - i : intersectCol;

              if (canPlaceWord(word, startRow, startCol, targetDir)) {
                let intersections = 0;
                for (let k = 0; k < word.length; k++) {
                  const r = targetDir === 'V' ? startRow + k : startRow;
                  const c = targetDir === 'H' ? startCol + k : startCol;
                  if (cellMap.has(`${r},${c}`)) intersections++;
                }

                if (intersections > maxIntersections) {
                  maxIntersections = intersections;
                  bestPlacement = { word, row: startRow, col: startCol, direction: targetDir };
                }
              }
            }
          }
        }
      }

      if (bestPlacement) {
        placements.push(bestPlacement);
        for (let k = 0; k < word.length; k++) {
          const r = bestPlacement.direction === 'V' ? bestPlacement.row + k : bestPlacement.row;
          const c = bestPlacement.direction === 'H' ? bestPlacement.col + k : bestPlacement.col;
          setCell(r, c, word[k], word);
        }
      }
    }

    // Compute bounding box
    let minRow = Infinity, maxRow = -Infinity, minCol = Infinity, maxCol = -Infinity;
    for (const item of cellMap.values()) {
      if (item.row < minRow) minRow = item.row;
      if (item.row > maxRow) maxRow = item.row;
      if (item.col < minCol) minCol = item.col;
      if (item.col > maxCol) maxCol = item.col;
    }

    const numRows = maxRow - minRow + 1;
    const numCols = maxCol - minCol + 1;

    const normPlacements = placements.map((p) => ({
      ...p,
      row: p.row - minRow,
      col: p.col - minCol,
    }));

    const grid: (CrosswordCell | null)[][] = Array.from({ length: numRows }, () =>
      Array(numCols).fill(null)
    );

    for (const item of cellMap.values()) {
      const r = item.row - minRow;
      const c = item.col - minCol;
      grid[r][c] = {
        row: r,
        col: c,
        char: item.char,
        words: item.words,
      };
    }

    return {
      rows: numRows,
      cols: numCols,
      placements: normPlacements,
      grid,
      targetWords: normPlacements.map((p) => p.word),
    };
  }

  /**
   * Generate / Fetch procedural crossword level with 0 repeats
   */
  static async getLevel(levelNumber: number): Promise<CrosswordLevel> {
    const packs = ACADEMIC_CROSSWORD_PACKS;
    const packIndex = (levelNumber - 1) % packs.length;
    const pack = packs[packIndex];

    // Every 5th level is a Golden Bonus Level!
    const isBonusLevel = levelNumber % 5 === 0;

    // Scramble letters for the circular wheel
    const rootLetters = pack.root.toUpperCase().split('');
    const shuffledLetters = [...rootLetters].sort(() => Math.random() - 0.5);

    // Filter candidate words
    const candidateWords = pack.gridWords;
    const layout = this.generateCrosswordLayout(candidateWords);

    return {
      level: levelNumber,
      packId: pack.id,
      root: pack.root,
      category: pack.category,
      hint: pack.hint,
      letters: shuffledLetters,
      gridWords: layout.targetWords,
      bonusWords: pack.bonusWords,
      isBonusLevel,
      layout,
    };
  }

  /**
   * Shuffle wheel letters
   */
  static shuffleLetters(letters: string[]): string[] {
    return [...letters].sort(() => Math.random() - 0.5);
  }
}
