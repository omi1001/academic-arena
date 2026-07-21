import { create } from 'zustand';
import { GameState } from '../types';
import {
  MAX_HEARTS,
  STARTING_DIFFICULTY,
  STREAK_TO_LEVEL_UP,
  MAX_DIFFICULTY,
} from '../constants/config';

interface GameActions {
  startRun: (runId: string, classNum: number, subject: string) => void;
  setQuestion: (question: GameState['currentQuestion']) => void;
  correctAnswer: (expEarned: number) => void;
  incorrectAnswer: () => number;
  addExp: (amount: number) => void;
  endRun: () => void;
  resetGame: () => void;
  setQuestions: (questions: GameState['questions']) => void;
  resetQuestionIndex: () => void;
  markQuestionAnswered: (questionId: string) => void;
  setLastAnswerTime: (time: number) => void;
}

const initialGameState: GameState = {
  currentQuestion: null,
  questionIndex: 0,
  hearts: MAX_HEARTS,
  score: 0,
  expEarned: 0,
  currentDifficulty: STARTING_DIFFICULTY,
  streak: 0,
  maxStreak: 0,
  isGameActive: false,
  runId: null,
  selectedClass: null,
  selectedSubject: null,
  questions: [],
  answeredQuestionIds: [],
  startTime: 0,
  lastAnswerTime: null,
};

export const useGameStore = create<GameState & GameActions>((set, get) => ({
  ...initialGameState,

  startRun: (runId, classNum, subject) =>
    set({
      ...initialGameState,
      runId,
      selectedClass: classNum as 9 | 10,
      selectedSubject: subject as any,
      isGameActive: true,
      startTime: Date.now(),
    }),

  setQuestion: (question) => set({ currentQuestion: question }),

  correctAnswer: (expEarned) => {
    const state = get();
    const newStreak = state.streak + 1;
    const newDifficulty =
      newStreak >= STREAK_TO_LEVEL_UP && state.currentDifficulty < MAX_DIFFICULTY
        ? state.currentDifficulty + 1
        : state.currentDifficulty;

    set({
      streak: newStreak,
      maxStreak: Math.max(state.maxStreak, newStreak),
      currentDifficulty:
        newStreak >= STREAK_TO_LEVEL_UP ? newDifficulty : state.currentDifficulty,
      score: state.score + 1,
      expEarned: state.expEarned + expEarned,
      questionIndex: state.questionIndex + 1,
      currentQuestion: null,
      lastAnswerTime: Date.now(),
    });
  },

  incorrectAnswer: () => {
    const state = get();
    const newHearts = state.hearts - 1;

    set({
      hearts: newHearts,
      streak: 0,
      currentDifficulty: Math.max(STARTING_DIFFICULTY, state.currentDifficulty - 1),
      questionIndex: state.questionIndex + 1,
      currentQuestion: null,
      lastAnswerTime: Date.now(),
    });

    return newHearts;
  },

  addExp: (amount) => set((state) => ({ expEarned: state.expEarned + amount })),

  endRun: () => set({ isGameActive: false }),

  resetGame: () => set(initialGameState),

  setQuestions: (questions) => set({ questions }),

  resetQuestionIndex: () => set({ questionIndex: 0 }),

  markQuestionAnswered: (questionId) =>
    set((state) => ({
      answeredQuestionIds: [...state.answeredQuestionIds, questionId],
    })),

  setLastAnswerTime: (time) => set({ lastAnswerTime: time }),
}));
