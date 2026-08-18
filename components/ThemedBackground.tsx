import React from 'react';
import { View, ImageBackground, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeStore } from '../stores/themeStore';
import { THEME_PRESETS } from '../constants/themes';

interface ThemedBackgroundProps {
  children: React.ReactNode;
  style?: ViewStyle;
  overlayOpacity?: number;
  useWallpaper?: boolean;
}

export const ThemedBackground: React.FC<ThemedBackgroundProps> = ({
  children,
  style,
  overlayOpacity,
  useWallpaper = true,
}) => {
  const { mode, getPreset, customWallpaper } = useThemeStore();
  const preset = getPreset() || THEME_PRESETS.cosmic_lofi;
  const currentMode = mode === 'light' ? 'light' : 'dark';
  const colors = (preset && preset.colors && preset.colors[currentMode])
    ? preset.colors[currentMode]
    : THEME_PRESETS.cosmic_lofi.colors.dark;
  const wallpaper = customWallpaper || preset?.wallpaperUrl;

  const defaultOpacity = currentMode === 'dark' ? 0.82 : 0.72;
  const finalOpacity = overlayOpacity !== undefined ? overlayOpacity : defaultOpacity;

  const bg = colors?.background || '#0B0D1B';
  const gradientColors = currentMode === 'dark'
    ? [bg, 'rgba(10, 13, 27, 0.94)', bg]
    : [bg, 'rgba(255, 255, 255, 0.88)', bg];

  if (!useWallpaper || !wallpaper) {
    return (
      <View style={[styles.container, { backgroundColor: bg }, style]}>
        {children}
      </View>
    );
  }

  return (
    <ImageBackground
      source={{ uri: wallpaper }}
      style={[styles.container, style]}
      resizeMode="cover"
    >
      <LinearGradient
        colors={gradientColors as [string, string, ...string[]]}
        style={[styles.overlay, { opacity: finalOpacity }]}
      />
      <View style={styles.content}>{children}</View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  content: {
    flex: 1,
    zIndex: 1,
  },
});
