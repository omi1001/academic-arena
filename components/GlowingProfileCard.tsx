import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface Props {
  name: string;
  initial: string;
  activeBorder?: 'default' | 'glowing_gold' | 'neon_cyan' | 'fire_ring';
  badges?: string[];
  role?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const GlowingProfileCard: React.FC<Props> = ({
  name,
  initial,
  activeBorder = 'default',
  badges = [],
  role = 'user',
  size = 'md',
}) => {
  const glowAnim = useRef(new Animated.Value(0.4)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (activeBorder !== 'default') {
      const pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0.4,
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );

      const rotateLoop = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 4000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );

      pulseLoop.start();
      rotateLoop.start();

      return () => {
        pulseLoop.stop();
        rotateLoop.stop();
      };
    }
  }, [activeBorder]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const isGold = activeBorder === 'glowing_gold';
  const isCyan = activeBorder === 'neon_cyan';
  const isFire = activeBorder === 'fire_ring';

  const gradientColors: [string, string, ...string[]] = isGold
    ? ['#FFD700', '#FFA500', '#FFF8DC', '#FFD700']
    : isCyan
    ? ['#00F5A0', '#00D9F6', '#7B2CBF', '#00F5A0']
    : isFire
    ? ['#FF0055', '#FF512F', '#F09819', '#FF0055']
    : ['#2A2F4C', '#1A1D36'];

  const avatarSize = size === 'sm' ? 40 : size === 'lg' ? 68 : 52;
  const textSize = size === 'sm' ? 16 : size === 'lg' ? 28 : 22;

  return (
    <View style={styles.container}>
      {activeBorder !== 'default' ? (
        <Animated.View style={{ opacity: glowAnim }}>
          <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              styles.glowBorder,
              { width: avatarSize + 8, height: avatarSize + 8, borderRadius: (avatarSize + 8) / 2 },
            ]}
          >
            <View
              style={[
                styles.avatarInner,
                { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 },
              ]}
            >
              <Text style={[styles.avatarText, { fontSize: textSize }]}>{initial}</Text>
            </View>
          </LinearGradient>
        </Animated.View>
      ) : (
        <View
          style={[
            styles.avatarInner,
            styles.defaultBorder,
            { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 },
          ]}
        >
          <Text style={[styles.avatarText, { fontSize: textSize }]}>{initial}</Text>
        </View>
      )}

      {badges.includes('WEEKLY_CHAMPION_GOLD') && (
        <View style={styles.badgeCrown}>
          <Text style={{ fontSize: size === 'sm' ? 10 : 14 }}>👑</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowBorder: {
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FFD700',
    shadowRadius: 10,
    shadowOpacity: 0.8,
    elevation: 8,
  },
  avatarInner: {
    backgroundColor: '#161B33',
    alignItems: 'center',
    justifyContent: 'center',
  },
  defaultBorder: {
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  avatarText: {
    fontWeight: 'bold',
    color: '#FFF',
  },
  badgeCrown: {
    position: 'absolute',
    top: -6,
    right: -4,
    backgroundColor: '#1E243D',
    borderRadius: 10,
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
});
