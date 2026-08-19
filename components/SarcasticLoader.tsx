import { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useThemeStore } from '../stores/themeStore';

const SARCASTIC_QUOTES = [
  'Consulting the High Council of Nerds... 🧙‍♂️',
  'Calculating your chances of failing... 99.8% 📉',
  'Bribing the server with digital samosas... 🥟',
  'Downloading common sense... (0/100 MB) 🧠',
  'Asking Einstein for secret cheat codes... 🤫',
  'Pretending to calculate your massive brain score... ⏳',
  'Waking up our sleeping hamster in the server wheel... 🐹',
  'Sharpening digital pencils and inflating egos... ⚔️',
  'Searching Google for the answers before you do... 🔍',
  'Polishing the trophy you probably won\'t win... 🏆',
  'Calibrating question difficulty to "Unfair"... 😈',
  'Summoning the spirits of past toppers... 👻',
  'Double-checking if 2 + 2 is still 4... 🔢',
  'Buffering maximum academic violence... 💥',
  'Negotiating with the algorithm for easy questions... 🤝',
  'Generating difficult questions to ruin your day... 💀',
  'Convincing Newton that apples don\'t fall up... 🍎',
  'Loading... please pretend to be reading textbooks... 📖',
  'Brewing high-voltage brain coffee... ☕',
  'Heating up the Arena battlefield... 🔥',
];

const TAP_QUOTES = [
  'Tapping faster won\'t make the WiFi faster, genius! 😂',
  'Stop poking me! I\'m thinking! 😡',
  'Finger exercise won\'t increase your IQ! ⚡',
  'Aggressive tapping detected. Rage quotient +10. 📈',
  'Patience is a virtue... clearly not yours! 🙄',
  'Screen durability test: PASSED. Now wait! 📱',
];

interface SarcasticLoaderProps {
  title?: string;
  subtitle?: string;
  fullScreen?: boolean;
}

export function SarcasticLoader({
  title = 'PREPARING THE ARENA',
  subtitle,
  fullScreen = true,
}: SarcasticLoaderProps) {
  const { getColors } = useThemeStore();
  const colors = getColors();

  const [quoteIndex, setQuoteIndex] = useState(() =>
    Math.floor(Math.random() * SARCASTIC_QUOTES.length)
  );
  const [tapMessage, setTapMessage] = useState<string | null>(null);

  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const fadeQuoteAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Quote rotation timer
  useEffect(() => {
    const interval = setInterval(() => {
      Animated.sequence([
        Animated.timing(fadeQuoteAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(fadeQuoteAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();

      setQuoteIndex((prev) => (prev + 1) % SARCASTIC_QUOTES.length);
      setTapMessage(null);
    }, 2200);

    return () => clearInterval(interval);
  }, []);

  // Pulsing & Spinning Animations
  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    const rotateLoop = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    const progressLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(progressAnim, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(progressAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: false,
        }),
      ])
    );

    pulseLoop.start();
    rotateLoop.start();
    progressLoop.start();

    return () => {
      pulseLoop.stop();
      rotateLoop.stop();
      progressLoop.stop();
    };
  }, []);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['10%', '75%', '100%'],
  });

  const handleTap = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const randomTap = TAP_QUOTES[Math.floor(Math.random() * TAP_QUOTES.length)];
    setTapMessage(randomTap);
  };

  const containerStyle = fullScreen ? styles.fullScreenContainer : styles.inlineContainer;

  return (
    <TouchableOpacity
      activeOpacity={0.95}
      onPress={handleTap}
      style={[containerStyle, { backgroundColor: colors.background }]}
    >
      <View style={styles.content}>
        {/* Animated Glowing Badge */}
        <Animated.View
          style={[
            styles.badgeWrapper,
            {
              transform: [{ scale: pulseAnim }],
              borderColor: colors.primary,
              shadowColor: colors.primary,
            },
          ]}
        >
          <Animated.View style={{ transform: [{ rotate: spin }] }}>
            <LinearGradient
              colors={[colors.primary, colors.secondary, colors.accent || '#06B6D4']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.spinnerRing}
            />
          </Animated.View>

          <View style={[styles.innerBadge, { backgroundColor: colors.surface }]}>
            <Text style={styles.badgeEmoji}>⚔️</Text>
          </View>
        </Animated.View>

        {/* Title */}
        <Text style={[styles.titleText, { color: colors.text }]}>{title}</Text>
        {subtitle && (
          <Text style={[styles.subtitleText, { color: colors.textMuted }]}>{subtitle}</Text>
        )}

        {/* Progress Bar */}
        <View style={[styles.progressBarTrack, { backgroundColor: colors.surfaceHighlight || 'rgba(255,255,255,0.08)' }]}>
          <Animated.View
            style={[
              styles.progressBarFill,
              {
                width: progressWidth,
                backgroundColor: colors.primary,
              },
            ]}
          />
        </View>

        {/* Sarcastic Quote Box */}
        <Animated.View
          style={[
            styles.quoteContainer,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              opacity: fadeQuoteAnim,
            },
          ]}
        >
          <Text style={styles.quoteIcon}>💡</Text>
          <Text style={[styles.quoteText, { color: colors.text }]}>
            {tapMessage || SARCASTIC_QUOTES[quoteIndex]}
          </Text>
        </Animated.View>

        <Text style={[styles.hintText, { color: colors.textMuted }]}>
          Tap anywhere for instant sarcasm 👆
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fullScreenContainer: {
    ...StyleSheet.absoluteFill,
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  inlineContainer: {
    padding: 28,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  content: {
    alignItems: 'center',
    width: '100%',
    maxWidth: 360,
  },
  badgeWrapper: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 22,
    borderWidth: 2,
    elevation: 12,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
  },
  spinnerRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    opacity: 0.6,
  },
  innerBadge: {
    position: 'absolute',
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeEmoji: {
    fontSize: 32,
  },
  titleText: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitleText: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
  },
  progressBarTrack: {
    width: '80%',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 12,
    marginBottom: 20,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  quoteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
    minHeight: 52,
    width: '100%',
    justifyContent: 'center',
  },
  quoteIcon: {
    fontSize: 16,
  },
  quoteText: {
    fontSize: 13.5,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'center',
  },
  hintText: {
    fontSize: 11,
    marginTop: 12,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
});
