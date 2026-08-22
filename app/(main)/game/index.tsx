import { useEffect, useState, useRef } from 'react';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { View, Text, StyleSheet, Animated, Easing, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Gradients } from '../../../constants/theme';
import { MAX_HEARTS, LEADERBOARD_TIERS } from '../../../constants/config';
import { BouncyButton } from '../../../components/BouncyButton';
import { ThemedBackground } from '../../../components/ThemedBackground';
import { useUserStore } from '../../../stores/userStore';
import { useThemeStore } from '../../../stores/themeStore';
import api from '../../../lib/api';

interface PacketInfo {
  packet: number;
  totalQuestions: number;
  chapters: string[];
}

export default function GameSetupScreen() {
  const router = useRouter();
  const { class: classStr, subject, mode: routeMode } = useLocalSearchParams<{
    class: string;
    subject: string;
    mode?: 'solo' | 'challenge';
  }>();

  const { profile } = useUserStore();
  const isAdmin = profile?.role === 'admin';
  const playerExp = profile?.totalEXP || 0;
  const isSilverUnlocked = isAdmin || playerExp >= LEADERBOARD_TIERS.SILVER.minEXP;

  const [gameMode, setGameMode] = useState<'solo' | 'challenge'>(
    routeMode === 'challenge' && isSilverUnlocked ? 'challenge' : 'solo'
  );

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

  const handleSelectChallengeMode = () => {
    if (!isSilverUnlocked) {
      const remaining = LEADERBOARD_TIERS.SILVER.minEXP - playerExp;
      Alert.alert(
        '🔒 Challenge Mode Locked',
        `Reach Silver Division (${LEADERBOARD_TIERS.SILVER.minEXP.toLocaleString()} EXP) to unlock 1v1 Bot Challenge Mode!\n\nYou need ${remaining.toLocaleString()} more EXP.`
      );
      return;
    }
    setGameMode('challenge');
  };

  const handleStart = () => {
    const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    if (gameMode === 'challenge') {
      router.replace({
        pathname: '/(main)/game/challenge',
        params: {
          runId,
          class: classStr,
          subject,
        },
      });
    } else {
      router.replace({
        pathname: '/(main)/game/[runId]',
        params: {
          runId,
          class: classStr,
          subject,
        },
      });
    }
  };

  const { getColors, mode } = useThemeStore();
  const colors = getColors();

  return (
    <ThemedBackground>
      <Stack.Screen
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          title: '',
        }}
      />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            styles.animatedWrapper,
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
              { backgroundColor: colors.surface, borderColor: colors.border },
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

          <Text style={[styles.subjectName, { color: colors.text }]}>{subject}</Text>
          <View style={[styles.classBadge, { backgroundColor: colors.surface, borderColor: colors.primary }]}>
            <Text style={[styles.className, { color: colors.primary }]}>CLASS {classStr} ARENA</Text>
          </View>

          {/* ─── Game Mode Selection ─── */}
          <Text style={[styles.sectionHeader, { color: colors.primary }]}>SELECT ARENA GAME MODE</Text>
          <View style={styles.modeGrid}>
            {/* Solo Arena Mode Card */}
            <BouncyButton
              style={[
                styles.modeCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
                gameMode === 'solo' && [styles.modeCardSelected, { borderColor: colors.primary, backgroundColor: colors.surfaceHighlight }],
              ]}
              onPress={() => setGameMode('solo')}
            >
              <Text style={styles.modeEmoji}>⚡</Text>
              <Text style={[styles.modeTitle, { color: colors.text }]}>SOLO RUN</Text>
              <Text style={[styles.modeDesc, { color: colors.textMuted }]}>Endless continuous practice</Text>
            </BouncyButton>

            {/* 1v1 Bot Challenge Mode Card */}
            <BouncyButton
              style={[
                styles.modeCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
                gameMode === 'challenge' && [styles.modeCardSelected, { borderColor: colors.primary, backgroundColor: colors.surfaceHighlight }],
                !isSilverUnlocked && styles.modeCardLocked,
              ]}
              onPress={handleSelectChallengeMode}
            >
              <View style={styles.modeHeaderRow}>
                <Text style={styles.modeEmoji}>⚔️</Text>
                {!isSilverUnlocked && <Text style={styles.lockBadge}>🔒 LOCKED</Text>}
              </View>
              <Text style={[styles.modeTitle, { color: colors.text }]}>1v1 CHALLENGE</Text>
              <Text style={[styles.modeDesc, { color: colors.textMuted }]}>
                {isSilverUnlocked
                  ? '15 Questions Race vs Adaptive Bot'
                  : 'Unlocks at Silver (5,000 EXP)'}
              </Text>
            </BouncyButton>
          </View>

          {/* Info Card */}
          <LinearGradient
            colors={mode === 'dark' ? ['#161B33', '#0F1224'] : ['#FFFFFF', '#F1F5F9']}
            style={[styles.infoCard, { borderColor: colors.border }]}
          >
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textMuted }]}>SELECTED MODE</Text>
              <Text style={[styles.infoValueHighlight, { color: colors.primary }]}>
                {gameMode === 'challenge' ? '⚔️ 1v1 Bot Challenge (15 Qs)' : '⚡ Endless Solo Arena'}
              </Text>
            </View>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textMuted }]}>RUN LIVES</Text>
              <View style={styles.heartsPreview}>
                {Array.from({ length: MAX_HEARTS }).map((_, i) => (
                  <Text key={i} style={styles.heartIcon}>
                    ❤️
                  </Text>
                ))}
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textMuted }]}>QUESTION POOL</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>
                🎲 All Chapters (Auto-Shuffled)
              </Text>
            </View>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textMuted }]}>BOT DIFFICULTY</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>
                {gameMode === 'challenge' ? 'Adaptive to your EXP' : 'Standard Scaling'}
              </Text>
            </View>
          </LinearGradient>

          <Text style={[styles.rules, { color: colors.textMuted }]}>
            {gameMode === 'challenge'
              ? '⚔️ Race the bot to answer 15 random questions! Keep your hearts for high EXP bonuses.'
              : '🎯 Answer fast to level up difficulty & multiplier. Questions cycle seamlessly across all chapters!'}
          </Text>

          <BouncyButton style={styles.startBtnWrapper} onPress={handleStart}>
            <LinearGradient
              colors={[colors.primary, colors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.startButton}
            >
              <Text style={styles.startButtonText}>
                {gameMode === 'challenge'
                  ? `⚔️ ENTER 1v1 BOT BATTLE ⚔️`
                  : `⚡ START SOLO ARENA RUN ⚡`}
              </Text>
            </LinearGradient>
          </BouncyButton>
        </Animated.View>
      </ScrollView>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  container: {
    padding: 24,
    paddingBottom: 40,
    alignItems: 'center',
  },
  animatedWrapper: {
    width: '100%',
    alignItems: 'center',
  },
  emojiContainer: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: Colors.dark.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.dark.cyan,
    marginBottom: 12,
    elevation: 10,
    shadowColor: Colors.dark.cyanGlow,
    shadowRadius: 15,
    shadowOpacity: 0.6,
  },
  subjectEmoji: {
    fontSize: 48,
  },
  subjectName: {
    fontSize: 26,
    fontWeight: 'bold',
    color: Colors.dark.text,
    textAlign: 'center',
  },
  classBadge: {
    backgroundColor: 'rgba(5, 213, 230, 0.12)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 6,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.dark.cyan,
  },
  className: {
    fontSize: 12,
    color: Colors.dark.cyan,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  modeGrid: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginBottom: 24,
  },
  modeCard: {
    flex: 1,
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: Colors.dark.border,
  },
  modeCardSelected: {
    borderColor: Colors.dark.cyan,
    backgroundColor: 'rgba(5, 213, 230, 0.12)',
  },
  modeCardLocked: {
    opacity: 0.45,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'rgba(20, 24, 45, 0.6)',
  },
  modeHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lockBadge: {
    fontSize: 9,
    fontWeight: 'bold',
    color: Colors.dark.danger,
    backgroundColor: 'rgba(255, 46, 99, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  modeEmoji: {
    fontSize: 24,
    marginBottom: 6,
  },
  modeTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.dark.text,
    marginBottom: 2,
  },
  modeDesc: {
    fontSize: 11,
    color: Colors.dark.textMuted,
    lineHeight: 14,
  },
  packetSection: {
    width: '100%',
    marginBottom: 24,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.dark.cyan,
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  packetSubtext: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    marginBottom: 14,
  },
  packetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  packetCard: {
    width: '48%',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.surface,
  },
  packetCardSelected: {
    borderColor: 'transparent',
  },
  packetGradient: {
    padding: 12,
    alignItems: 'center',
  },
  packetInner: {
    padding: 12,
    alignItems: 'center',
  },
  packetNumber: {
    fontSize: 13,
    fontWeight: 'bold',
    color: Colors.dark.textMuted,
  },
  packetNumberSelected: {
    fontSize: 13,
    fontWeight: 'bold',
    color: Colors.dark.text,
  },
  packetCount: {
    fontSize: 11,
    color: Colors.dark.textMuted,
    marginTop: 2,
  },
  packetCountSelected: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 2,
    fontWeight: '600',
  },
  infoCard: {
    width: '100%',
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    gap: 10,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 11,
    color: Colors.dark.textMuted,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 13,
    color: Colors.dark.text,
    fontWeight: 'bold',
  },
  infoValueHighlight: {
    fontSize: 14,
    color: Colors.dark.cyan,
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
    fontSize: 16,
  },
  rules: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 18,
    paddingHorizontal: 8,
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
    fontSize: 15,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
});
