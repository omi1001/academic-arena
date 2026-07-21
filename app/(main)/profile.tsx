import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { signOut } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import api from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { useUserStore } from '../../stores/userStore';
import { Colors } from '../../constants/theme';
import { LEADERBOARD_TIERS } from '../../constants/config';

export default function ProfileScreen() {
  const { firebaseUser, logout } = useAuthStore();
  const { profile, setProfile } = useUserStore();

  useEffect(() => {
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
    fetchProfile();
  }, [firebaseUser]);

  const getTier = (exp: number) => {
    if (exp >= LEADERBOARD_TIERS.DIAMOND.minEXP) return LEADERBOARD_TIERS.DIAMOND;
    if (exp >= LEADERBOARD_TIERS.GOLD.minEXP) return LEADERBOARD_TIERS.GOLD;
    if (exp >= LEADERBOARD_TIERS.SILVER.minEXP) return LEADERBOARD_TIERS.SILVER;
    return LEADERBOARD_TIERS.BRONZE;
  };

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await signOut(auth);
          logout();
        },
      },
    ]);
  };

  const tier = profile ? getTier(profile.totalEXP) : LEADERBOARD_TIERS.BRONZE;
  const accuracy = profile?.totalAnswered
    ? Math.round((profile.totalCorrect / profile.totalAnswered) * 100)
    : 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Profile</Text>

      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {profile?.name?.[0]?.toUpperCase() || firebaseUser?.displayName?.[0]?.toUpperCase() || '?'}
          </Text>
        </View>
        <Text style={styles.name}>{profile?.name || firebaseUser?.displayName || 'Player'}</Text>
        <Text style={styles.email}>{firebaseUser?.email}</Text>
        <View style={styles.tierBadge}>
          <View style={[styles.tierDot, { backgroundColor: tier.color }]} />
          <Text style={[styles.tierText, { color: tier.color }]}>
            {tier.name}
          </Text>
        </View>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{profile?.totalEXP || 0}</Text>
          <Text style={styles.statLabel}>Total EXP</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{profile?.gamesPlayed || 0}</Text>
          <Text style={styles.statLabel}>Games Played</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{profile?.totalAnswered || 0}</Text>
          <Text style={styles.statLabel}>Questions</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{accuracy}%</Text>
          <Text style={styles.statLabel}>Accuracy</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>Logout</Text>
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
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.dark.text,
    marginBottom: 32,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.dark.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.dark.text,
  },
  name: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.dark.text,
  },
  email: {
    fontSize: 14,
    color: Colors.dark.textMuted,
    marginTop: 4,
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  tierDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tierText: {
    fontSize: 14,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 32,
  },
  statBox: {
    width: '47%',
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.dark.text,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    marginTop: 4,
  },
  logoutButton: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.danger,
  },
  logoutButtonText: {
    color: Colors.dark.danger,
    fontSize: 16,
    fontWeight: '600',
  },
});
