import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Animated,
  Easing,
  Alert,
  TouchableOpacity,
  BackHandler,
  ToastAndroid,
  Platform,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { signOut } from 'firebase/auth';
import { LinearGradient } from 'expo-linear-gradient';
import { auth } from '../../lib/firebase';
import api from '../../lib/api';
import { SupabaseService } from '../../lib/supabaseService';
import { useAuthStore } from '../../stores/authStore';
import { useUserStore } from '../../stores/userStore';
import { useThemeStore } from '../../stores/themeStore';
import { soundManager } from '../../lib/soundManager';
import { ThemedBackground } from '../../components/ThemedBackground';
import { ThemeSelectorModal } from '../../components/ThemeSelectorModal';
import { Colors, Gradients } from '../../constants/theme';
import { SUBJECTS, CLASS_OPTIONS, LEADERBOARD_TIERS } from '../../constants/config';
import type { Subject, ClassOption } from '../../constants/config';
import { BouncyButton } from '../../components/BouncyButton';

export default function DashboardScreen() {
  const router = useRouter();
  const { firebaseUser, logout } = useAuthStore();
  const { profile, setProfile } = useUserStore();
  const { mode, toggleMode, getColors } = useThemeStore();
  const colors = getColors();

  const [selectedClass, setSelectedClass] = useState<ClassOption | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [gameMode, setGameMode] = useState<'solo' | 'challenge'>('solo');
  const [refreshing, setRefreshing] = useState(false);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);

  // ─── Animations ───
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const heroSlideAnim = useRef(new Animated.Value(-20)).current;
  const statsScaleAnim = useRef(new Animated.Value(0.92)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 450,
        useNativeDriver: true,
      }),
      Animated.spring(heroSlideAnim, {
        toValue: 0,
        friction: 6,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.spring(statsScaleAnim, {
        toValue: 1,
        friction: 5,
        tension: 90,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Button pulse when ready
  useEffect(() => {
    if (selectedClass && selectedSubject) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.03,
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
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [selectedClass, selectedSubject]);

  const fetchProfile = async () => {
    if (!firebaseUser) return;
    try {
      const supProfile = await SupabaseService.getUserProfile(firebaseUser.uid);
      if (supProfile) {
        setProfile(supProfile);
        if (supProfile.class && !selectedClass) {
          setSelectedClass(supProfile.class);
        }
        return;
      }

      const res = await api.get('/auth/profile');
      if (res.data?.user) {
        setProfile(res.data.user as any);
        if (res.data.user.class && !selectedClass) {
          setSelectedClass(res.data.user.class);
        }
      }
    } catch (e) {
      console.warn('Failed to fetch profile from Supabase/backend:', e);
    }
  };

  useEffect(() => {
    if (profile?.class && !selectedClass) {
      setSelectedClass(profile.class);
    }
  }, [profile?.class]);

  useFocusEffect(
    useCallback(() => {
      fetchProfile();
      soundManager.resumeBgm();

      let lastBackPress = 0;
      const onBackPress = () => {
        const now = Date.now();
        if (now - lastBackPress < 2000) {
          BackHandler.exitApp();
          return true;
        }
        lastBackPress = now;
        if (Platform.OS === 'android') {
          ToastAndroid.show('Press back again to exit', ToastAndroid.SHORT);
        }
        return true;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [firebaseUser])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchProfile();
    setRefreshing(false);
  };

  const getTier = (exp: number) => {
    if (exp >= LEADERBOARD_TIERS.DIAMOND.minEXP) return LEADERBOARD_TIERS.DIAMOND;
    if (exp >= LEADERBOARD_TIERS.GOLD.minEXP) return LEADERBOARD_TIERS.GOLD;
    if (exp >= LEADERBOARD_TIERS.SILVER.minEXP) return LEADERBOARD_TIERS.SILVER;
    return LEADERBOARD_TIERS.BRONZE;
  };

  const isAdmin =
    profile?.role === 'admin' ||
    firebaseUser?.email?.toLowerCase().includes('admin') ||
    profile?.email?.toLowerCase().includes('admin') ||
    profile?.username?.toLowerCase().includes('admin');
  const isSilverUnlocked = isAdmin || (profile?.totalEXP || 0) >= LEADERBOARD_TIERS.SILVER.minEXP;
  const isCrosswordUnlocked = isAdmin || (profile?.totalEXP || 0) >= 15000;

  const handleSelectChallengeMode = () => {
    if (!isSilverUnlocked) {
      const remaining = LEADERBOARD_TIERS.SILVER.minEXP - (profile?.totalEXP || 0);
      Alert.alert(
        '🔒 Challenge Mode Locked',
        `Reach Silver Division (${LEADERBOARD_TIERS.SILVER.minEXP.toLocaleString()} EXP) to unlock 1v1 Bot Challenge Mode!\n\nYou need ${remaining.toLocaleString()} more EXP.`
      );
      return;
    }
    setGameMode('challenge');
  };

  const handleSelectCrossword = () => {
    if (!isCrosswordUnlocked) {
      const remaining = 15000 - (profile?.totalEXP || 0);
      Alert.alert(
        '🔒 Words of Wonders Locked',
        `Unlock the Academic Crossword puzzle at 15,000 Total EXP (Gold League)!\n\nYou need ${remaining.toLocaleString()} more EXP to unlock.`
      );
      return;
    }
    router.push('/(main)/game/crossword');
  };

  const handleStartGame = () => {
    if (!selectedClass || !selectedSubject) return;
    router.push({
      pathname: '/(main)/game',
      params: { class: selectedClass, subject: selectedSubject, mode: gameMode },
    });
  };

  const handleLogout = async () => {
    await signOut(auth);
    logout();
  };

  const tier = profile ? getTier(profile.totalEXP) : LEADERBOARD_TIERS.BRONZE;
  const userName = profile?.name || firebaseUser?.displayName || 'Player';
  const initial = userName[0]?.toUpperCase() || 'P';

  const nextTierExp =
    tier.id === 'BRONZE'
      ? LEADERBOARD_TIERS.SILVER.minEXP
      : tier.id === 'SILVER'
        ? LEADERBOARD_TIERS.GOLD.minEXP
        : tier.id === 'GOLD'
          ? LEADERBOARD_TIERS.DIAMOND.minEXP
          : 100000;
  const currentExp = profile?.totalEXP || 0;
  const progressPercent = Math.min(Math.round((currentExp / nextTierExp) * 100), 100);

  return (
    <ThemedBackground>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          {/* ─── Top Control Bar ─── */}
          <View style={styles.topControlBar}>
            <TouchableOpacity
              style={[styles.themePillBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => setIsThemeModalOpen(true)}
              activeOpacity={0.8}
            >
              <Text style={[styles.themePillText, { color: colors.text }]}>🎨 Theme & Wallpaper</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modeToggleBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={toggleMode}
              activeOpacity={0.8}
            >
              <Text style={styles.modeToggleIcon}>{mode === 'dark' ? '🌙' : '☀️'}</Text>
            </TouchableOpacity>
          </View>

          {/* ─── Hero User Card ─── */}
          <Animated.View style={{ transform: [{ translateY: heroSlideAnim }] }}>
            <LinearGradient
              colors={mode === 'dark' ? ['#161B33', '#0F1224'] : ['#FFFFFF', '#F1F5F9']}
              style={[styles.heroCard, { borderColor: colors.border }]}
            >
              <View style={styles.heroHeader}>
                <View style={styles.userProfileGroup}>
                  <View style={[styles.avatarGlow, { borderColor: tier.color }]}>
                    <Text style={styles.avatarText}>{profile?.avatar || initial}</Text>
                  </View>
                  <View>
                    <Text style={[styles.greetingTitle, { color: colors.text }]}>{userName}</Text>
                    <View style={styles.tierBadge}>
                      <View style={[styles.tierDot, { backgroundColor: tier.color }]} />
                      <Text style={[styles.tierText, { color: tier.color }]}>
                        {tier.name}
                      </Text>
                    </View>
                  </View>
                </View>

                <BouncyButton onPress={handleLogout} style={styles.logoutBtn}>
                  <Text style={styles.logoutText}>Exit</Text>
                </BouncyButton>
              </View>

              {/* Level XP Bar */}
              <View style={styles.progressContainer}>
                <View style={styles.progressLabelRow}>
                  <Text style={[styles.progressText, { color: colors.textMuted }]}>Topper Quotient Progress</Text>
                  <Text style={[styles.progressPercentText, { color: colors.primary }]}>{progressPercent}%</Text>
                </View>
                <View style={[styles.progressTrack, { backgroundColor: mode === 'dark' ? '#0B0E1B' : '#E2E8F0' }]}>
                  <LinearGradient
                    colors={[colors.primary, colors.secondary]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.progressFill, { width: `${progressPercent}%` }]}
                  />
                </View>
              </View>
            </LinearGradient>
          </Animated.View>
        </Animated.View>

        {/* ─── Stats Grid ─── */}
        <Animated.View style={[styles.statsRow, { transform: [{ scale: statsScaleAnim }] }]}>
          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={styles.statIcon}>⚡</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>{(profile?.totalEXP || 0).toLocaleString()}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Brain Battery</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={styles.statIcon}>🔥</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>{profile?.gamesPlayed || 0}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Study Grinds</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={styles.statIcon}>🎯</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {profile?.totalAnswered
                ? Math.round(
                    ((profile?.totalCorrect || 0) / profile.totalAnswered) * 100
                  )
                : 0}
              %
            </Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Accuracy Aim</Text>
          </View>
        </Animated.View>

        {/* ─── Game Mode Selection ─── */}
        <Text style={[styles.sectionTitle, { color: colors.primary }]}>CHOOSE YOUR BATTLEGROUND</Text>
        <View style={styles.modeGrid}>
          <View style={styles.modeRowTop}>
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
              <Text style={[styles.modeTitle, { color: colors.text }]}>SOLO SPEEDRUN</Text>
              <Text style={[styles.modeDesc, { color: colors.textMuted }]}>Endless rapid fire questions.</Text>
            </BouncyButton>

            {/* 1v1 Bot Challenge Mode Card */}
            <BouncyButton
              style={[
                styles.modeCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
                !isSilverUnlocked && styles.modeCardLocked,
                gameMode === 'challenge' && [styles.modeCardSelected, { borderColor: colors.primary, backgroundColor: colors.surfaceHighlight }],
              ]}
              onPress={handleSelectChallengeMode}
            >
              <View style={styles.modeHeaderRow}>
                <Text style={styles.modeEmoji}>⚔️</Text>
                {!isSilverUnlocked && <Text style={styles.lockBadge}>🔒 5K EXP</Text>}
              </View>
              <Text style={[styles.modeTitle, { color: colors.text }]}>1v1 BOT DUEL</Text>
              <Text style={[styles.modeDesc, { color: colors.textMuted }]}>
                {isSilverUnlocked ? 'Race 15 Qs vs Adaptive Bot' : 'Silver (5,000 EXP)'}
              </Text>
            </BouncyButton>
          </View>

          {/* Words of Wonders Crossword Card */}
          <BouncyButton
            style={[
              styles.modeCardFull,
              { backgroundColor: colors.surface, borderColor: colors.border },
              !isCrosswordUnlocked && styles.modeCardLocked,
            ]}
            onPress={handleSelectCrossword}
          >
            <View style={styles.modeHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <Text style={styles.modeEmoji}>🧩</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modeTitle, { color: colors.text }]}>WORDS OF WONDERS</Text>
                  <Text style={[styles.modeDesc, { color: colors.textMuted }]}>
                    Academic Crossword & Anagram Wheel Puzzles
                  </Text>
                </View>
              </View>
              {!isCrosswordUnlocked ? (
                <Text style={styles.lockBadge}>🔒 15,000 EXP</Text>
              ) : (
                <View style={{ backgroundColor: 'rgba(0, 240, 255, 0.15)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: '#00F0FF' }}>
                  <Text style={{ color: '#00F0FF', fontSize: 11, fontWeight: '900' }}>PLAY ➔</Text>
                </View>
              )}
            </View>
          </BouncyButton>
        </View>

        {/* ─── Class Selection ─── */}
        <Text style={[styles.sectionTitle, { color: colors.primary }]}>SELECT ACADEMIC GRADE</Text>
        <View style={styles.optionRow}>
          {CLASS_OPTIONS.map((cls) => {
            const isSelected = selectedClass === cls;
            return (
              <BouncyButton
                key={cls}
                style={[
                  styles.classOption,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  isSelected && styles.classOptionSelected,
                ]}
                onPress={() => setSelectedClass(cls)}
              >
                {isSelected ? (
                  <LinearGradient
                    colors={[colors.primary, colors.secondary]}
                    style={styles.classOptionGradient}
                  >
                    <Text style={styles.classOptionTextSelected}>
                      CLASS {cls} {cls === 10 ? '👑 (BOARDS)' : '🚀 (FOUNDATION)'}
                    </Text>
                  </LinearGradient>
                ) : (
                  <Text style={[styles.classOptionText, { color: colors.textMuted }]}>
                    CLASS {cls} {cls === 10 ? '👑 (BOARDS)' : '🚀 (FOUNDATION)'}
                  </Text>
                )}
              </BouncyButton>
            );
          })}
        </View>

        {/* ─── Subject Selection ─── */}
        <Text style={[styles.sectionTitle, { color: colors.primary }]}>CHOOSE YOUR ARENA SUBJECT</Text>
        <View style={styles.subjectGrid}>
          {SUBJECTS.map((subject) => {
            const isSelected = selectedSubject === subject;
            return (
              <BouncyButton
                key={subject}
                style={[
                  styles.subjectCard,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  isSelected && [styles.subjectCardSelected, { borderColor: colors.primary, backgroundColor: colors.surfaceHighlight }],
                ]}
                onPress={() => setSelectedSubject(subject)}
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
                <Text
                  style={[
                    styles.subjectName,
                    { color: colors.text },
                    isSelected && { color: colors.primary, fontWeight: 'bold' },
                  ]}
                >
                  {subject}
                </Text>
                {isSelected && <View style={[styles.subjectActiveDot, { backgroundColor: colors.primary }]} />}
              </BouncyButton>
            );
          })}
        </View>

        {/* ─── Action Button ─── */}
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <BouncyButton
            style={styles.startBtnWrapper}
            onPress={handleStartGame}
            disabled={!selectedClass || !selectedSubject}
          >
            <LinearGradient
              colors={
                selectedClass && selectedSubject
                  ? [colors.primary, colors.secondary]
                  : mode === 'dark' ? ['#283054', '#1E243D'] : ['#CBD5E1', '#94A3B8']
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[
                styles.startButton,
                (!selectedClass || !selectedSubject) && styles.startButtonDisabled,
              ]}
            >
              <Text style={[styles.startButtonText, { color: '#FFF' }]}>
                {!selectedClass || !selectedSubject
                  ? '⚠️ PICK GRADE & SUBJECT, BRO'
                  : gameMode === 'challenge'
                    ? '⚔️ ENTER 1v1 BOT DUEL! 💥'
                    : '🚀 ENTER ARENA & COOK! 🔥'}
              </Text>
            </LinearGradient>
          </BouncyButton>
        </Animated.View>
      </ScrollView>
      <ThemeSelectorModal
        visible={isThemeModalOpen}
        onClose={() => setIsThemeModalOpen(false)}
      />
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    padding: 20,
    paddingTop: 52,
    paddingBottom: 110,
  },
  topControlBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  themePillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    elevation: 3,
  },
  themePillText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  modeToggleBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
  },
  modeToggleIcon: {
    fontSize: 18,
  },
  heroCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    elevation: 8,
    shadowColor: Colors.dark.primaryGlow,
    shadowRadius: 10,
    shadowOpacity: 0.3,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userProfileGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarGlow: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.dark.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  avatarText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.dark.text,
  },
  greetingTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.dark.text,
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  tierDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tierText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  logoutBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  logoutText: {
    color: Colors.dark.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  progressContainer: {
    marginTop: 18,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressText: {
    fontSize: 11,
    color: Colors.dark.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  progressPercentText: {
    fontSize: 11,
    color: Colors.dark.cyan,
    fontWeight: 'bold',
  },
  progressTrack: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  statIcon: {
    fontSize: 18,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.dark.text,
  },
  statLabel: {
    fontSize: 10,
    color: Colors.dark.textMuted,
    marginTop: 2,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: Colors.dark.cyan,
    letterSpacing: 1.2,
    marginBottom: 12,
    marginTop: 4,
  },
  optionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  classOption: {
    flex: 1,
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: Colors.dark.border,
  },
  classOptionGradient: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  classOptionSelected: {
    borderColor: 'transparent',
  },
  classOptionText: {
    paddingVertical: 14,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.dark.textMuted,
    letterSpacing: 0.5,
  },
  classOptionTextSelected: {
    color: Colors.dark.text,
    fontSize: 15,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  subjectGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 28,
  },
  subjectCard: {
    width: '47%',
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.dark.border,
    position: 'relative',
  },
  subjectCardSelected: {
    borderColor: Colors.dark.primary,
    backgroundColor: Colors.dark.surfaceLight,
    shadowColor: Colors.dark.primaryGlow,
    shadowRadius: 10,
    shadowOpacity: 0.5,
  },
  subjectEmoji: {
    fontSize: 34,
    marginBottom: 8,
  },
  subjectName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.dark.textMuted,
    textAlign: 'center',
  },
  subjectNameSelected: {
    color: Colors.dark.text,
  },
  subjectActiveDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.dark.primary,
  },
  startBtnWrapper: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  startButton: {
    paddingVertical: 18,
    alignItems: 'center',
    borderRadius: 16,
  },
  startButtonDisabled: {
    opacity: 0.6,
  },
  startButtonText: {
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  modeGrid: {
    gap: 10,
    marginBottom: 20,
  },
  modeRowTop: {
    flexDirection: 'row',
    gap: 10,
  },
  modeCard: {
    flex: 1,
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: Colors.dark.border,
  },
  modeCardFull: {
    width: '100%',
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    padding: 14,
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
    fontSize: 13,
    fontWeight: 'bold',
    color: Colors.dark.text,
    marginBottom: 2,
  },
  modeDesc: {
    fontSize: 11,
    color: Colors.dark.textMuted,
    lineHeight: 14,
  },
});
