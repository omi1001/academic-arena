import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { signOut } from 'firebase/auth';
import { LinearGradient } from 'expo-linear-gradient';
import { auth } from '../../lib/firebase';
import api from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { useUserStore } from '../../stores/userStore';
import { Colors, Gradients } from '../../constants/theme';
import { SUBJECTS, CLASS_OPTIONS, LEADERBOARD_TIERS } from '../../constants/config';
import type { Subject, ClassOption } from '../../constants/config';
import { BouncyButton } from '../../components/BouncyButton';

export default function DashboardScreen() {
  const router = useRouter();
  const { firebaseUser, logout } = useAuthStore();
  const { profile, setProfile } = useUserStore();
  const [selectedClass, setSelectedClass] = useState<ClassOption | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchProfile = async () => {
    if (!firebaseUser) return;
    try {
      const res = await api.get('/auth/profile');
      if (res.data?.user) {
        setProfile(res.data.user as any);
        if (res.data.user.class && !selectedClass) {
          setSelectedClass(res.data.user.class);
        }
      }
    } catch (e) {
      console.warn('Failed to fetch profile from backend:', e);
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

  const handleStartGame = () => {
    if (!selectedClass || !selectedSubject) return;
    router.push({
      pathname: '/(main)/game',
      params: { class: selectedClass, subject: selectedSubject },
    });
  };

  const handleLogout = async () => {
    await signOut(auth);
    logout();
  };

  const tier = profile ? getTier(profile.totalEXP) : LEADERBOARD_TIERS.BRONZE;
  const userName = profile?.name || firebaseUser?.displayName || 'Player';
  const initial = userName[0]?.toUpperCase() || 'P';

  // Calculate next tier progress percentage
  const nextTierExp =
    tier.name === 'Bronze'
      ? LEADERBOARD_TIERS.SILVER.minEXP
      : tier.name === 'Silver'
        ? LEADERBOARD_TIERS.GOLD.minEXP
        : tier.name === 'Gold'
          ? LEADERBOARD_TIERS.DIAMOND.minEXP
          : 100000;
  const currentExp = profile?.totalEXP || 0;
  const progressPercent = Math.min(Math.round((currentExp / nextTierExp) * 100), 100);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={Colors.dark.primary}
        />
      }
    >
      {/* ─── Hero User Card ─── */}
      <LinearGradient colors={['#161B33', '#0F1224']} style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <View style={styles.userProfileGroup}>
            <View style={[styles.avatarGlow, { borderColor: tier.color }]}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
            <View>
              <Text style={styles.greetingTitle}>{userName}</Text>
              <View style={styles.tierBadge}>
                <View style={[styles.tierDot, { backgroundColor: tier.color }]} />
                <Text style={[styles.tierText, { color: tier.color }]}>
                  {tier.name} Division
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
            <Text style={styles.progressText}>Tier Progress</Text>
            <Text style={styles.progressPercentText}>{progressPercent}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <LinearGradient
              colors={Gradients.primary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.progressFill, { width: `${progressPercent}%` }]}
            />
          </View>
        </View>
      </LinearGradient>

      {/* ─── Stats Grid ─── */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statIcon}>⚡</Text>
          <Text style={styles.statValue}>{profile?.totalEXP || 0}</Text>
          <Text style={styles.statLabel}>Total EXP</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statIcon}>🎮</Text>
          <Text style={styles.statValue}>{profile?.gamesPlayed || 0}</Text>
          <Text style={styles.statLabel}>Runs Played</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statIcon}>🎯</Text>
          <Text style={styles.statValue}>
            {profile?.totalAnswered
              ? Math.round(
                  ((profile?.totalCorrect || 0) / profile.totalAnswered) * 100
                )
              : 0}
            %
          </Text>
          <Text style={styles.statLabel}>Accuracy</Text>
        </View>
      </View>

      {/* ─── Class Selection ─── */}
      <Text style={styles.sectionTitle}>SELECT GRADE</Text>
      <View style={styles.optionRow}>
        {CLASS_OPTIONS.map((cls) => {
          const isSelected = selectedClass === cls;
          return (
            <BouncyButton
              key={cls}
              style={[styles.classOption, isSelected && styles.classOptionSelected]}
              onPress={() => setSelectedClass(cls)}
            >
              {isSelected ? (
                <LinearGradient
                  colors={Gradients.primary}
                  style={styles.classOptionGradient}
                >
                  <Text style={styles.classOptionTextSelected}>CLASS {cls}</Text>
                </LinearGradient>
              ) : (
                <Text style={styles.classOptionText}>CLASS {cls}</Text>
              )}
            </BouncyButton>
          );
        })}
      </View>

      {/* ─── Subject Selection ─── */}
      <Text style={styles.sectionTitle}>SELECT ARENA SUBJECT</Text>
      <View style={styles.subjectGrid}>
        {SUBJECTS.map((subject) => {
          const isSelected = selectedSubject === subject;
          return (
            <BouncyButton
              key={subject}
              style={[styles.subjectCard, isSelected && styles.subjectCardSelected]}
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
                  isSelected && styles.subjectNameSelected,
                ]}
              >
                {subject}
              </Text>
              {isSelected && <View style={styles.subjectActiveDot} />}
            </BouncyButton>
          );
        })}
      </View>

      {/* ─── Action Button ─── */}
      <BouncyButton
        style={styles.startBtnWrapper}
        onPress={handleStartGame}
        disabled={!selectedClass || !selectedSubject}
      >
        <LinearGradient
          colors={
            selectedClass && selectedSubject
              ? Gradients.primary
              : ['#283054', '#1E243D']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[
            styles.startButton,
            (!selectedClass || !selectedSubject) && styles.startButtonDisabled,
          ]}
        >
          <Text style={styles.startButtonText}>
            {!selectedClass || !selectedSubject
              ? 'SELECT CLASS & SUBJECT'
              : '⚡ LAUNCH RUN'}
          </Text>
        </LinearGradient>
      </BouncyButton>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  content: {
    padding: 20,
    paddingTop: 56,
    paddingBottom: 110,
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
    width: '48%',
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
});
