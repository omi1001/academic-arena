import React from 'react';
import { View, ImageBackground, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeStore } from '../stores/themeStore';

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
  const preset = getPreset();
  const colors = preset.colors[mode];
  const wallpaper = customWallpaper || preset.wallpaperUrl;

  const defaultOpacity = mode === 'dark' ? 0.82 : 0.72;
  const finalOpacity = overlayOpacity !== undefined ? overlayOpacity : defaultOpacity;

  const gradientColors = mode === 'dark'
    ? [colors.background, 'rgba(10, 13, 27, 0.94)', colors.background]
    : [colors.background, 'rgba(255, 255, 255, 0.88)', colors.background];

  if (!useWallpaper || !wallpaper) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }, style]}>
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
