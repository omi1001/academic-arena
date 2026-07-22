import { useEffect, useRef } from 'react';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Gradients } from '../../../constants/theme';
import { MAX_HEARTS } from '../../../constants/config';
import { BouncyButton } from '../../../components/BouncyButton';

export default function GameSetupScreen() {
  const router = useRouter();
  const { class: classStr, subject } = useLocalSearchParams<{
    class: string;
    subject: string;
  }>();

  // ─── Animations ───
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const cardScaleAnim = useRef(new Animated.Value(0.9)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(cardScaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 80,
        useNativeDriver: true,
      }),
    ]).start();

    // Floating emoji animation
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -8,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    floatLoop.start();
    return () => floatLoop.stop();
  }, []);

  const handleStart = () => {
    const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    router.replace({
      pathname: '/(main)/game/[runId]',
      params: {
        runId,
        class: classStr,
        subject,
      },
    });
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: Colors.dark.background },
          headerTintColor: Colors.dark.text,
          title: '',
        }}
      />
      <Animated.View
        style={[
          styles.container,
          {
            opacity: fadeAnim,
            transform: [{ scale: cardScaleAnim }],
          },
        ]}
      >
        {/* Floating Glow Header Icon */}
        <Animated.View
          style={[
            styles.emojiContainer,
            { transform: [{ translateY: floatAnim }] },
          ]}
        >
          <Text style={styles.subjectEmoji}>
            {subject === 'Mathematics'
              ? '📐'
              : subject === 'Science'
                ? '🔬'
                : subject === 'English'
                  ? '📖'
                  : '🌍'}
          </Text>
        </Animated.View>

        <Text style={styles.subjectName}>{subject}</Text>
        <View style={styles.classBadge}>
          <Text style={styles.className}>CLASS {classStr} ARENA</Text>
        </View>

        {/* Info Card */}
        <LinearGradient colors={['#161B33', '#0F1224']} style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>RUN LIVES</Text>
            <View style={styles.heartsPreview}>
              {Array.from({ length: MAX_HEARTS }).map((_, i) => (
                <Text key={i} style={styles.heartIcon}>
                  ❤️
                </Text>
              ))}
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>DIFFICULTY</Text>
            <Text style={styles.infoValue}>Scales Lv 1 ➔ 10</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>SPEED MULTIPLIER</Text>
            <Text style={styles.infoValueHighlight}>Up to 1.5x EXP</Text>
          </View>
        </LinearGradient>

        <Text style={styles.rules}>
          🎯 Answer fast to level up difficulty & multiplier. 3 mistakes end the run!
        </Text>

        <BouncyButton style={styles.startBtnWrapper} onPress={handleStart}>
          <LinearGradient
            colors={Gradients.primary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.startButton}
          >
            <Text style={styles.startButtonText}>⚡ BEGIN ARENA RUN ⚡</Text>
          </LinearGradient>
        </BouncyButton>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.dark.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.dark.cyan,
    marginBottom: 16,
    elevation: 10,
    shadowColor: Colors.dark.cyanGlow,
    shadowRadius: 15,
    shadowOpacity: 0.6,
  },
  subjectEmoji: {
    fontSize: 52,
  },
  subjectName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.dark.text,
    textAlign: 'center',
  },
  classBadge: {
    backgroundColor: 'rgba(5, 213, 230, 0.12)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 8,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: Colors.dark.cyan,
  },
  className: {
    fontSize: 12,
    color: Colors.dark.cyan,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  infoCard: {
    width: '100%',
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 14,
    color: Colors.dark.text,
    fontWeight: 'bold',
  },
  infoValueHighlight: {
    fontSize: 14,
    color: Colors.dark.success,
    fontWeight: 'bold',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.dark.border,
  },
  heartsPreview: {
    flexDirection: 'row',
    gap: 4,
  },
  heartIcon: {
    fontSize: 18,
  },
  rules: {
    fontSize: 13,
    color: Colors.dark.textMuted,
    textAlign: 'center',
    marginBottom: 36,
    lineHeight: 20,
    paddingHorizontal: 12,
  },
  startBtnWrapper: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  startButton: {
    paddingVertical: 18,
    alignItems: 'center',
    borderRadius: 16,
  },
  startButtonText: {
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
});
