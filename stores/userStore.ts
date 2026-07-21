import { create } from 'zustand';
import { User } from '../types';

interface UserState {
  profile: User | null;
  setProfile: (profile: User | null) => void;
  addExp: (amount: number) => void;
  incrementGamesPlayed: () => void;
  incrementQuestions: (correct: boolean) => void;
}

export const useUserStore = create<UserState>((set) => ({
  profile: null,

  setProfile: (profile) => set({ profile }),

  addExp: (amount) =>
    set((state) => {
      if (!state.profile) return state;
      return {
        profile: {
          ...state.profile,
          totalEXP: state.profile.totalEXP + amount,
        },
      };
    }),

  incrementGamesPlayed: () =>
    set((state) => {
      if (!state.profile) return state;
      return {
        profile: {
          ...state.profile,
          gamesPlayed: state.profile.gamesPlayed + 1,
        },
      };
    }),

  incrementQuestions: (correct) =>
    set((state) => {
      if (!state.profile) return state;
      return {
        profile: {
          ...state.profile,
          totalAnswered: state.profile.totalAnswered + 1,
          totalCorrect: state.profile.totalCorrect + (correct ? 1 : 0),
        },
      };
    }),
}));
