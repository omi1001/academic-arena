import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { signOut, sendPasswordResetEmail } from 'firebase/auth';
import { LinearGradient } from 'expo-linear-gradient';
import { auth } from '../../lib/firebase';
import api from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { useUserStore } from '../../stores/userStore';
import { useThemeStore } from '../../stores/themeStore';
import { soundManager } from '../../lib/soundManager';
import { ThemedBackground } from '../../components/ThemedBackground';
import { ThemeSelectorModal } from '../../components/ThemeSelectorModal';
import { Colors, Gradients } from '../../constants/theme';
import { LEADERBOARD_TIERS } from '../../constants/config';
import { BouncyButton } from '../../components/BouncyButton';
import { GlowingProfileCard } from '../../components/GlowingProfileCard';

export default function ProfileScreen() {
  const router = useRouter();
  const { firebaseUser, logout } = useAuthStore();
  const { profile, setProfile } = useUserStore();
  const { mode, toggleMode, getColors } = useThemeStore();
  const colors = getColors();

  const [upiInput, setUpiInput] = useState(profile?.upiId || '');
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const fetchProfile = async () => {
        if (!firebaseUser) return;
        try {
          const res = await api.get('/auth/profile');
          if (res.data?.user) {
            setProfile(res.data.user as any);
            setUpiInput(res.data.user.upiId || '');
          }
        } catch (e) {
          console.warn('Failed to fetch profile from backend:', e);
        }
      };
      fetchProfile();
    }, [firebaseUser])
  );

  const getTier = (exp: number) => {
    if (exp >= LEADERBOARD_TIERS.DIAMOND.minEXP) return LEADERBOARD_TIERS.DIAMOND;
    if (exp >= LEADERBOARD_TIERS.GOLD.minEXP) return LEADERBOARD_TIERS.GOLD;
    if (exp >= LEADERBOARD_TIERS.SILVER.minEXP) return LEADERBOARD_TIERS.SILVER;
    return LEADERBOARD_TIERS.BRONZE;
  };

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to exit?', [
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

  const handleResetPassword = async () => {
    if (!firebaseUser?.email) {
      Alert.alert('Error', 'No email address found for this account.');
      return;
    }

    Alert.alert(
      'Reset Password',
      `Send a password reset link to ${firebaseUser.email}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Link',
          onPress: async () => {
            try {
              await sendPasswordResetEmail(auth, firebaseUser.email!);
              Alert.alert(
                'Reset Email Sent! 📩',
                `A password reset link has been sent to ${firebaseUser.email}. Please check your inbox.`
              );
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Failed to send password reset email.');
            }
          },
        },
      ]
    );
  };

  const handleUpdateClass = async (newClass: 9 | 10) => {
    try {
      const res = await api.put('/auth/profile', { class: newClass });
      if (res.data?.user) {
        setProfile(res.data.user as any);
        Alert.alert('Class Updated', `Default class set to Class ${newClass}`);
      }
    } catch (e) {
      Alert.alert('Update Failed', 'Failed to update class. Please try again.');
    }
  };

  const handleSaveUpi = async () => {
    try {
      const res = await api.put('/auth/profile', { upiId: upiInput });
      if (res.data?.user) {
        setProfile(res.data.user as any);
        Alert.alert('UPI Saved', 'Your UPI ID has been updated for weekly rewards!');
      }
    } catch (e) {
      Alert.alert('Update Failed', 'Failed to save UPI ID.');
    }
  };

  const handleUpdateAvatar = async (selectedAvatar: string) => {
    try {
      const res = await api.put('/auth/profile', { avatar: selectedAvatar });
      if (res.data?.user) {
        setProfile(res.data.user as any);
        Alert.alert('Avatar Updated', `Selected avatar: ${selectedAvatar}`);
      }
    } catch (e) {
      Alert.alert('Update Failed', 'Failed to save avatar.');
    }
  };

  const AVATAR_LIST = ['🎓', '⚡', '🥷', '🧙‍♂️', '🚀', '👑', '🦁', '🔥', '🤖', '🐯', '🦅', '👾'];

  const tier = profile ? getTier(profile.totalEXP) : LEADERBOARD_TIERS.BRONZE;
  const accuracy = profile?.totalAnswered
    ? Math.round((profile.totalCorrect / profile.totalAnswered) * 100)
    : 0;

  const userName = profile?.name || firebaseUser?.displayName || 'Player';
  const initial = userName[0]?.toUpperCase() || 'P';
  const userAvatar = profile?.avatar;
  const isAdmin =
    profile?.role === 'admin' ||
    firebaseUser?.email?.toLowerCase() === 'monusingh2646@gmail.com' ||
    firebaseUser?.email?.toLowerCase() === 'monus@gmail.com';

  const userBorder = profile?.activeBorder && profile.activeBorder !== 'default'
    ? profile.activeBorder
    : isAdmin
    ? 'glowing_gold'
    : 'default';

  return (
    <ThemedBackground>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>PLAYER PROFILE</Text>

        {/* ─── Hero Profile Card ─── */}
        <LinearGradient
          colors={mode === 'dark' ? ['#161B33', '#0F1224'] : ['#FFFFFF', '#F1F5F9']}
          style={[styles.profileCard, { borderColor: colors.border }]}
        >
          <GlowingProfileCard
            name={userName}
            initial={initial}
            avatar={userAvatar}
            activeBorder={userBorder}
            badges={profile?.badges || []}
            size="lg"
          />
          <Text style={[styles.name, { color: colors.text, marginTop: 14 }]}>{userName}</Text>
          <Text style={[styles.email, { color: colors.textMuted }]}>{firebaseUser?.email}</Text>

          <View style={[styles.tierBadge, { backgroundColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)' }]}>
            <View style={[styles.tierDot, { backgroundColor: tier.color }]} />
            <Text style={[styles.tierText, { color: tier.color }]}>
              {tier.name} Division
            </Text>
          </View>
        </LinearGradient>

        {/* ─── Select Avatar ─── */}
        <Text style={[styles.sectionHeader, { color: colors.primary }]}>CHOOSE YOUR AVATAR</Text>
        <View style={styles.avatarGrid}>
          {AVATAR_LIST.map((av) => (
            <TouchableOpacity
              key={av}
              style={[
                styles.avatarItem,
                { backgroundColor: colors.surface, borderColor: colors.border },
                profile?.avatar === av && [styles.avatarItemSelected, { borderColor: colors.primary, backgroundColor: colors.surfaceHighlight }],
              ]}
              onPress={() => handleUpdateAvatar(av)}
            >
              <Text style={styles.avatarEmoji}>{av}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ─── Admin Portal Access (If Admin) ─── */}
        {isAdmin && (
          <BouncyButton
            style={styles.adminPortalButton}
            onPress={() => router.push('/(main)/admin')}
          >
            <LinearGradient
              colors={['#FFD700', '#FF8C00']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.adminPortalGradient}
            >
              <Text style={styles.adminPortalText}>⚡ OPEN ADMIN CONTROL PANEL</Text>
            </LinearGradient>
          </BouncyButton>
        )}

        {/* ─── UPI Details for Weekly ₹10 Reward ─── */}
        <Text style={[styles.sectionHeader, { color: colors.primary }]}>🎁 WEEKLY UPI REWARD SETTINGS</Text>
        <View style={[styles.upiContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.upiSubtext, { color: colors.textMuted }]}>
            Top player each week receives ₹10 directly in their UPI account!
          </Text>
          <View style={styles.upiRow}>
            <TextInput
              style={[styles.upiInput, { color: colors.text, borderColor: colors.border, backgroundColor: mode === 'dark' ? '#0B0D1B' : '#FFFFFF' }]}
              placeholder="Enter UPI ID (e.g. name@upi)"
              placeholderTextColor={colors.textMuted}
              value={upiInput}
              onChangeText={setUpiInput}
            />
            <BouncyButton style={[styles.saveUpiBtn, { backgroundColor: colors.primary }]} onPress={handleSaveUpi}>
              <Text style={styles.saveUpiText}>Save</Text>
            </BouncyButton>
          </View>
        </View>

        {/* ─── Academic Class Selector ─── */}
        <Text style={[styles.sectionHeader, { color: colors.primary }]}>ACADEMIC CLASS</Text>
        <View style={styles.classRow}>
          <BouncyButton
            style={[
              styles.classChip,
              { backgroundColor: colors.surface, borderColor: colors.border },
              profile?.class === 9 && [styles.classChipSelected, { borderColor: colors.primary, backgroundColor: colors.surfaceHighlight }],
            ]}
            onPress={() => handleUpdateClass(9)}
          >
            <Text style={[styles.classChipText, { color: colors.textMuted }, profile?.class === 9 && [styles.classChipTextSelected, { color: colors.primary }]]}>
              CLASS 9
            </Text>
          </BouncyButton>
          <BouncyButton
            style={[
              styles.classChip,
              { backgroundColor: colors.surface, borderColor: colors.border },
              profile?.class === 10 && [styles.classChipSelected, { borderColor: colors.primary, backgroundColor: colors.surfaceHighlight }],
            ]}
            onPress={() => handleUpdateClass(10)}
          >
            <Text style={[styles.classChipText, { color: colors.textMuted }, profile?.class === 10 && [styles.classChipTextSelected, { color: colors.primary }]]}>
              CLASS 10
            </Text>
          </BouncyButton>
        </View>

        {/* ─── 1v1 Bot Challenge Stats ─── */}
        <Text style={[styles.sectionHeader, { color: colors.primary }]}>⚔️ 1v1 BOT CHALLENGE STATS</Text>
        <View style={styles.statsGrid}>
          <View style={[styles.statBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={styles.statIcon}>⚔️</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>{profile?.challengeGamesPlayed || 0}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Challenges</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={styles.statIcon}>🏆</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {profile?.challengeWins || 0}W / {profile?.challengeLosses || 0}L
            </Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Record</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={styles.statIcon}>📈</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {profile?.challengeGamesPlayed
                ? Math.round(((profile?.challengeWins || 0) / profile.challengeGamesPlayed) * 100)
                : 0}%
            </Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Win Rate</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={styles.statIcon}>🤖</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>Lv.{profile?.highestChallengeDifficulty || 1}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Peak Bot</Text>
          </View>
        </View>

        {/* ─── Lifetime Stats Grid ─── */}
        <Text style={[styles.sectionHeader, { color: colors.primary }]}>LIFETIME STATS</Text>
        <View style={styles.statsGrid}>
          <View style={[styles.statBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={styles.statIcon}>⚡</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>{profile?.totalEXP || 0}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Total EXP</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={styles.statIcon}>🎮</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>{profile?.gamesPlayed || 0}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Runs Played</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={styles.statIcon}>❓</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>{profile?.totalAnswered || 0}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Questions</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={styles.statIcon}>🎯</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>{accuracy}%</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Accuracy</Text>
          </View>
        </View>

      <BouncyButton
        style={[styles.themeSettingsBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => setIsThemeModalOpen(true)}
      >
        <Text style={[styles.themeSettingsBtnText, { color: colors.text }]}>🎨 Theme, Wallpaper & Sound Settings</Text>
      </BouncyButton>

      <BouncyButton style={styles.resetPasswordBtn} onPress={handleResetPassword}>
        <Text style={styles.resetPasswordText}>🔒 Reset Password</Text>
      </BouncyButton>

      <BouncyButton style={styles.helpButton} onPress={() => router.push('/(main)/help')}>
        <Text style={styles.helpButtonText}>💬 Help & Support</Text>
      </BouncyButton>

      <BouncyButton style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>🚪 Logout Account</Text>
      </BouncyButton>
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
  themeSettingsBtn: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    marginBottom: 12,
  },
  themeSettingsBtnText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  content: {
    padding: 20,
    paddingTop: 56,
    paddingBottom: 110,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.dark.text,
    marginBottom: 20,
    letterSpacing: 1,
  },
  profileCard: {
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    elevation: 8,
  },
  name: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.dark.text,
  },
  email: {
    fontSize: 13,
    color: Colors.dark.textMuted,
    marginTop: 2,
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
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
  adminPortalButton: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 24,
  },
  adminPortalGradient: {
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 14,
  },
  adminPortalText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.dark.cyan,
    letterSpacing: 1,
    marginBottom: 12,
  },
  upiContainer: {
    backgroundColor: Colors.dark.surface,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginBottom: 24,
  },
  upiSubtext: {
    color: Colors.dark.textMuted,
    fontSize: 12,
    marginBottom: 12,
  },
  upiRow: {
    flexDirection: 'row',
    gap: 10,
  },
  upiInput: {
    flex: 1,
    backgroundColor: '#0F1224',
    color: '#FFF',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  saveUpiBtn: {
    backgroundColor: Colors.dark.cyan,
    paddingHorizontal: 18,
    justifyContent: 'center',
    borderRadius: 10,
  },
  saveUpiText: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  classRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  classChip: {
    flex: 1,
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.dark.border,
  },
  classChipSelected: {
    borderColor: Colors.dark.primary,
    backgroundColor: 'rgba(255, 42, 109, 0.12)',
  },
  classChipText: {
    color: Colors.dark.textMuted,
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  classChipTextSelected: {
    color: Colors.dark.primary,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 28,
  },
  statBox: {
    width: '47%',
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  statIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.dark.text,
  },
  statLabel: {
    fontSize: 10,
    color: Colors.dark.textMuted,
    marginTop: 2,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
    backgroundColor: Colors.dark.surface,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  avatarItem: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#0F1224',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.dark.border,
  },
  avatarItemSelected: {
    borderColor: Colors.dark.cyan,
    backgroundColor: 'rgba(5, 213, 230, 0.15)',
    transform: [{ scale: 1.1 }],
  },
  avatarEmoji: {
    fontSize: 22,
  },
  resetPasswordBtn: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.cyan,
    marginBottom: 12,
  },
  resetPasswordText: {
    color: Colors.dark.cyan,
    fontSize: 15,
    fontWeight: 'bold',
  },
  helpButton: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginBottom: 12,
  },
  helpButtonText: {
    color: Colors.dark.text,
    fontSize: 15,
    fontWeight: 'bold',
  },
  logoutButton: {
    backgroundColor: 'rgba(255, 46, 99, 0.12)',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.danger,
  },
  logoutButtonText: {
    color: Colors.dark.danger,
    fontSize: 15,
    fontWeight: 'bold',
  },
});
