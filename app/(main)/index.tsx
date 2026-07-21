import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import api from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { useUserStore } from '../../stores/userStore';
import { Colors } from '../../constants/theme';
import { SUBJECTS, CLASS_OPTIONS, LEADERBOARD_TIERS } from '../../constants/config';
import type { Subject, ClassOption } from '../../constants/config';

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
      }
    } catch (e) {
      console.warn('Failed to fetch profile from backend:', e);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [firebaseUser]);

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
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>
            Hey, {profile?.name || firebaseUser?.displayName || 'Player'}
          </Text>
          <View style={styles.tierBadge}>
            <View style={[styles.tierDot, { backgroundColor: tier.color }]} />
            <Text style={[styles.tierText, { color: tier.color }]}>
              {tier.name}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{profile?.totalEXP || 0}</Text>
          <Text style={styles.statLabel}>Total EXP</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{profile?.gamesPlayed || 0}</Text>
          <Text style={styles.statLabel}>Games</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>
            {profile?.totalAnswered
              ? Math.round(
                  ((profile?.totalCorrect || 0) /
                    profile.totalAnswered) *
                    100
                )
              : 0}
            %
          </Text>
          <Text style={styles.statLabel}>Accuracy</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Select Class</Text>
      <View style={styles.optionRow}>
        {CLASS_OPTIONS.map((cls) => (
          <TouchableOpacity
            key={cls}
            style={[
              styles.classOption,
              selectedClass === cls && styles.classOptionSelected,
            ]}
            onPress={() => setSelectedClass(cls)}
          >
            <Text
              style={[
                styles.classOptionText,
                selectedClass === cls && styles.classOptionTextSelected,
              ]}
            >
              Class {cls}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Select Subject</Text>
      <View style={styles.subjectGrid}>
        {SUBJECTS.map((subject) => (
          <TouchableOpacity
            key={subject}
            style={[
              styles.subjectCard,
              selectedSubject === subject && styles.subjectCardSelected,
            ]}
            onPress={() => setSelectedSubject(subject)}
          >
            <Text
              style={[
                styles.subjectEmoji,
                selectedSubject === subject && styles.subjectEmojiSelected,
              ]}
            >
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
                selectedSubject === subject && styles.subjectNameSelected,
              ]}
            >
              {subject}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[
          styles.startButton,
          (!selectedClass || !selectedSubject) && styles.startButtonDisabled,
        ]}
        onPress={handleStartGame}
        disabled={!selectedClass || !selectedSubject}
      >
        <Text style={styles.startButtonText}>Start Run</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  content: {
    padding: 24,
    paddingTop: 60,
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 32,
  },
  greeting: {
    fontSize: 28,
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
    fontSize: 13,
    fontWeight: '600',
  },
  logoutBtn: {
    padding: 8,
  },
  logoutText: {
    color: Colors.dark.textMuted,
    fontSize: 14,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.dark.text,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.dark.textMuted,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.dark.text,
    marginBottom: 16,
    marginTop: 8,
  },
  optionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  classOption: {
    flex: 1,
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  classOptionSelected: {
    borderColor: Colors.dark.primary,
    backgroundColor: Colors.dark.surfaceLight,
  },
  classOptionText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.dark.textMuted,
  },
  classOptionTextSelected: {
    color: Colors.dark.primary,
  },
  subjectGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 32,
  },
  subjectCard: {
    width: '47%',
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  subjectCardSelected: {
    borderColor: Colors.dark.primary,
    backgroundColor: Colors.dark.surfaceLight,
  },
  subjectEmoji: {
    fontSize: 32,
    marginBottom: 8,
    opacity: 0.6,
  },
  subjectEmojiSelected: {
    opacity: 1,
  },
  subjectName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.textMuted,
    textAlign: 'center',
  },
  subjectNameSelected: {
    color: Colors.dark.text,
  },
  startButton: {
    backgroundColor: Colors.dark.primary,
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
  },
  startButtonDisabled: {
    opacity: 0.4,
  },
  startButtonText: {
    color: Colors.dark.text,
    fontSize: 18,
    fontWeight: 'bold',
  },
});
