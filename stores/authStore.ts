import { create } from 'zustand';
import { User as FirebaseUser } from 'firebase/auth';
import { User } from '../types';

interface AuthState {
  firebaseUser: FirebaseUser | null;
  userProfile: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  setFirebaseUser: (user: FirebaseUser | null) => void;
  setUserProfile: (profile: User | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  firebaseUser: null,
  userProfile: null,
  isLoading: true,
  isAuthenticated: false,

  setFirebaseUser: (user) =>
    set({
      firebaseUser: user,
      isAuthenticated: !!user,
    }),

  setUserProfile: (profile) => set({ userProfile: profile }),

  setLoading: (loading) => set({ isLoading: loading }),

  logout: () =>
    set({
      firebaseUser: null,
      userProfile: null,
      isAuthenticated: false,
      isLoading: false,
    }),
}));
