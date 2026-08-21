import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { THEME_PRESETS, ThemeMode, ThemePresetKey, ThemePreset } from '../constants/themes';
import { soundManager } from '../lib/soundManager';

const STORAGE_THEME_MODE = '@app_theme_mode';
const STORAGE_THEME_PRESET = '@app_theme_preset';
const STORAGE_CUSTOM_WALLPAPER = '@app_theme_custom_wallpaper';

interface ThemeState {
  mode: ThemeMode;
  presetKey: ThemePresetKey;
  customWallpaper: string | null;
  isLoaded: boolean;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
  setPreset: (presetKey: ThemePresetKey) => void;
  setCustomWallpaper: (url: string | null) => void;
  loadStoredTheme: () => Promise<void>;
  getPreset: () => ThemePreset;
  getColors: () => ThemePreset['colors']['dark'];
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: 'dark',
  presetKey: 'cosmic_lofi',
  customWallpaper: null,
  isLoaded: false,

  setMode: async (mode: ThemeMode) => {
    set({ mode });
    await AsyncStorage.setItem(STORAGE_THEME_MODE, mode);
  },

  toggleMode: async () => {
    const nextMode = get().mode === 'dark' ? 'light' : 'dark';
    set({ mode: nextMode });
    await AsyncStorage.setItem(STORAGE_THEME_MODE, nextMode);
  },

  setPreset: async (presetKey: ThemePresetKey) => {
    const preset = THEME_PRESETS[presetKey];
    set({ presetKey, mode: preset ? preset.defaultMode : get().mode });
    await AsyncStorage.setItem(STORAGE_THEME_PRESET, presetKey);
    if (preset) {
      await AsyncStorage.setItem(STORAGE_THEME_MODE, preset.defaultMode);
    }
    soundManager.playThemeBgm(presetKey);
  },

  setCustomWallpaper: async (url: string | null) => {
    set({ customWallpaper: url });
    if (url) {
      await AsyncStorage.setItem(STORAGE_CUSTOM_WALLPAPER, url);
    } else {
      await AsyncStorage.removeItem(STORAGE_CUSTOM_WALLPAPER);
    }
  },

  loadStoredTheme: async () => {
    try {
      const [storedMode, storedPreset, storedWallpaper] = await Promise.all([
        AsyncStorage.getItem(STORAGE_THEME_MODE),
        AsyncStorage.getItem(STORAGE_THEME_PRESET),
        AsyncStorage.getItem(STORAGE_CUSTOM_WALLPAPER),
      ]);

      const activePreset = (storedPreset as ThemePresetKey) || 'cosmic_lofi';
      set({
        mode: (storedMode as ThemeMode) || 'dark',
        presetKey: activePreset,
        customWallpaper: storedWallpaper || null,
        isLoaded: true,
      });
      soundManager.playThemeBgm(activePreset);
    } catch (e) {
      set({ isLoaded: true });
    }
  },

  getPreset: () => {
    const { presetKey } = get();
    return THEME_PRESETS[presetKey] || THEME_PRESETS.cosmic_lofi;
  },

  getColors: () => {
    const { mode, presetKey } = get();
    const currentMode = mode === 'light' ? 'light' : 'dark';
    const preset = THEME_PRESETS[presetKey] || THEME_PRESETS.cosmic_lofi;
    if (!preset || !preset.colors) return THEME_PRESETS.cosmic_lofi.colors.dark;
    return preset.colors[currentMode] || preset.colors.dark || THEME_PRESETS.cosmic_lofi.colors.dark;
  },
}));
