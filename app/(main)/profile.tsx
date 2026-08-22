import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TextInput,
  TouchableOpacity,
  Share,
  Modal,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { signOut, sendPasswordResetEmail } from 'firebase/auth';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
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
          const supProfile = await SupabaseService.getUserProfile(firebaseUser.uid);
          if (supProfile) {
            setProfile(supProfile);
            setUpiInput(supProfile.upiId || '');
            return;
          }

          const res = await api.get('/auth/profile');
          if (res.data?.user) {
            setProfile(res.data.user as any);
            setUpiInput(res.data.user.upiId || '');
          }
        } catch (e) {
          console.warn('Failed to fetch profile from Supabase/backend:', e);
        }
      };
      fetchProfile();
      soundManager.resumeBgm();
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
      if (firebaseUser?.uid) {
        const updated = await SupabaseService.upsertUserProfile({
          firebaseUid: firebaseUser.uid,
          class: newClass,
        });
        if (updated) setProfile(updated);
      }
      try {
        await api.put('/auth/profile', { class: newClass });
      } catch (ignored) {}
      Alert.alert('Class Updated', `Default class set to Class ${newClass}`);
    } catch (e) {
      Alert.alert('Update Failed', 'Failed to update class. Please try again.');
    }
  };

  const handleSaveUpi = async () => {
    try {
      if (firebaseUser?.uid) {
        const updated = await SupabaseService.upsertUserProfile({
          firebaseUid: firebaseUser.uid,
          upiId: upiInput.trim(),
        });
        if (updated) setProfile(updated);
      }
      try {
        await api.put('/auth/profile', { upiId: upiInput });
      } catch (ignored) {}
      Alert.alert('UPI Saved', 'Your UPI ID has been updated for weekly rewards!');
    } catch (e) {
      Alert.alert('Update Failed', 'Failed to save UPI ID.');
    }
  };

  const handleUpdateAvatar = async (selectedAvatar: string) => {
    try {
      if (firebaseUser?.uid) {
        const updated = await SupabaseService.upsertUserProfile({
          firebaseUid: firebaseUser.uid,
          avatar: selectedAvatar,
        });
        if (updated) setProfile(updated);
      }
      try {
        await api.put('/auth/profile', { avatar: selectedAvatar });
      } catch (ignored) {}
      Alert.alert('Avatar Updated', `Selected avatar: ${selectedAvatar}`);
    } catch (e) {
      Alert.alert('Update Failed', 'Failed to save avatar.');
    }
  };

  const [editUsernameModalVisible, setEditUsernameModalVisible] = useState(false);
  const [newUsernameInput, setNewUsernameInput] = useState('');
  const [usernameUpdating, setUsernameUpdating] = useState(false);

  const handleCopyTag = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const tag = profile?.arenaTag || '#AA-8492';
      Alert.alert(
        'Player Tag Copied! 📋',
        `Your unique Arena Player Tag is:\n\n${tag}\n\nShare this ID with classmates to 1v1 duel in academic battles!`
      );
    } catch (e) {}
  };

  const handleShareToWhatsApp = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      const name = profile?.name || firebaseUser?.displayName || 'Player';
      const tag = profile?.arenaTag || '#AA-8492';
      const handle = profile?.username || '@player';
      const classNum = profile?.class || 10;
      const exp = (profile?.totalEXP || 0).toLocaleString();

      const inviteMsg = `⚔️ *ACADEMIC ARENA DUEL CHALLENGE!* ⚔️\n\nHey! Add me on Academic Arena to 1v1 duel me in CBSE Class ${classNum}!\n\n🏷️ *My Player Tag:* ${tag}\n👤 *Handle:* ${handle}\n🏆 *Total EXP:* ${exp} EXP\n\nDownload the app & let's see who tops the leaderboard! 🚀`;

      const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(inviteMsg)}`;
      const canOpen = await Linking.canOpenURL(whatsappUrl).catch(() => false);

      if (canOpen) {
        await Linking.openURL(whatsappUrl);
      } else {
        await Share.share({
          message: inviteMsg,
          title: 'Academic Arena Duel Invite',
        });
      }
    } catch (e) {
      console.warn('Share error:', e);
    }
  };

  const handleSaveUsername = async () => {
    let clean = newUsernameInput.trim().toLowerCase();
    if (!clean) {
      Alert.alert('Empty Username', 'Please enter a valid handle.');
      return;
    }
    if (!clean.startsWith('@')) {
      clean = `@${clean}`;
    }

    if (clean.length < 4 || clean.length > 20) {
      Alert.alert('Invalid Length', 'Username must be between 3 and 20 characters.');
      return;
    }

    if (!/^@[a-z0-9_]+$/.test(clean)) {
      Alert.alert('Invalid Format', 'Username can only contain letters, numbers, and underscores.');
      return;
    }

    if (!firebaseUser) return;

    try {
      setUsernameUpdating(true);
      const isAvailable = await SupabaseService.checkUsernameAvailable(clean, firebaseUser.uid);
      if (!isAvailable) {
        Alert.alert('Already Taken', `${clean} is already claimed by another student. Try adding numbers!`);
        setUsernameUpdating(false);
        return;
      }

      const updated = await SupabaseService.upsertUserProfile({
        firebaseUid: firebaseUser.uid,
        username: clean,
      });

      if (updated) {
        setProfile(updated);
      }
      setEditUsernameModalVisible(false);
      Alert.alert('Identity Claimed ✨', `Your unique Arena handle is now ${clean}!`);
    } catch (e) {
      Alert.alert('Update Failed', 'Failed to update username.');
    } finally {
      setUsernameUpdating(false);
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
          
          {/* Unique Handle & Arena Tag Bar */}
          <View style={styles.identityRow}>
            <TouchableOpacity
              style={[styles.handlePill, { backgroundColor: mode === 'dark' ? '#1B243B' : '#E2E8F0', borderColor: colors.border }]}
              onPress={() => {
                setNewUsernameInput(profile?.username?.replace('@', '') || '');
                setEditUsernameModalVisible(true);
              }}
              activeOpacity={0.8}
            >
              <Text style={[styles.handleText, { color: colors.primary }]}>
                {profile?.username || '@player'} ✏️
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.arenaTagPill, { backgroundColor: 'rgba(0, 240, 255, 0.12)', borderColor: '#00F0FF' }]}
              onPress={handleCopyTag}
              activeOpacity={0.8}
            >
              <Text style={styles.arenaTagText}>{profile?.arenaTag || '#AA-8492'}</Text>
              <Text style={{ fontSize: 11, marginLeft: 4 }}>📋</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.email, { color: colors.textMuted }]}>{firebaseUser?.email}</Text>

          <View style={[styles.tierBadge, { backgroundColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)' }]}>
            <View style={[styles.tierDot, { backgroundColor: tier.color }]} />
            <Text style={[styles.tierText, { color: tier.color }]}>
              {tier.name} Division
            </Text>
          </View>
        </LinearGradient>

        {/* ─── 📲 1-Tap Share Arena Tag on WhatsApp Button ─── */}
        <BouncyButton
          style={styles.shareWhatsAppBtn}
          onPress={handleShareToWhatsApp}
        >
          <LinearGradient
            colors={['#25D366', '#128C7E']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.shareWhatsAppGradient}
          >
            <Text style={styles.shareWhatsAppText}>📲 SHARE ARENA TAG ON WHATSAPP</Text>
          </LinearGradient>
        </BouncyButton>

        {/* ─── Select Avatar ─── */}
        <Text style={[styles.sectionHeader, { color: colors.primary }]}>CHOOSE YOUR BATTLE AVATAR 🎭</Text>
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
              <Text style={styles.adminPortalText}>⚡ OPEN OVERLORD MASTER CONSOLE 🕹️</Text>
            </LinearGradient>
          </BouncyButton>
        )}

        {/* ─── UPI Details for Weekly ₹10 Reward ─── */}
        <Text style={[styles.sectionHeader, { color: colors.primary }]}>💸 WEEKLY ₹10 UPI BOUNTY ADDRESS</Text>
        <View style={[styles.upiContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.upiSubtext, { color: colors.textMuted }]}>
            Top grinder each week receives ₹10 cold hard cash directly in their UPI account! Enter a valid GPay/PhonePe/Paytm ID.
          </Text>
          <View style={styles.upiRow}>
            <TextInput
              style={[styles.upiInput, { color: colors.text, borderColor: colors.border, backgroundColor: mode === 'dark' ? '#0B0D1B' : '#FFFFFF' }]}
              placeholder="Enter UPI ID (e.g. name@okhdfcbank)"
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
        <Text style={[styles.sectionHeader, { color: colors.primary }]}>ACADEMIC GRADE</Text>
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
              CLASS 9 (FOUNDATION)
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
              CLASS 10 👑 (BOARDS)
            </Text>
          </BouncyButton>
        </View>

        {/* ─── 1v1 Bot Challenge Stats ─── */}
        <Text style={[styles.sectionHeader, { color: colors.primary }]}>⚔️ 1v1 BOT SLAYER TELEMETRY</Text>
        <View style={styles.statsGrid}>
          <View style={[styles.statBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={styles.statIcon}>⚔️</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>{profile?.challengeGamesPlayed || 0}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Duels Fought</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={styles.statIcon}>🏆</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {profile?.challengeWins || 0}W / {profile?.challengeLosses || 0}L
            </Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Duel Record</Text>
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
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Peak Bot Level</Text>
          </View>
        </View>

        {/* ─── Lifetime Stats Grid ─── */}
        <Text style={[styles.sectionHeader, { color: colors.primary }]}>📊 LIFETIME GRIND TELEMETRY</Text>
        <View style={styles.statsGrid}>
          <View style={[styles.statBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={styles.statIcon}>⚡</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>{(profile?.totalEXP || 0).toLocaleString()}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Brain Battery</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={styles.statIcon}>🔥</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>{profile?.gamesPlayed || 0}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Study Grinds</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={styles.statIcon}>❓</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>{profile?.totalAnswered || 0}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Q's Solved</Text>
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

    {/* ─── EDIT ARENA USERNAME MODAL ─── */}
    <Modal visible={editUsernameModalVisible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={[styles.modalBox, { backgroundColor: mode === 'dark' ? '#0F1224' : '#FFFFFF', borderColor: colors.border }]}>
          <Text style={[styles.modalTitle, { color: colors.text }]}>⚔️ CUSTOMIZE ARENA HANDLE</Text>
          <Text style={[styles.modalDesc, { color: colors.textMuted }]}>
            Pick a unique username handle (e.g., @aarav_topper). Friends can use this to search and duel you!
          </Text>

          <TextInput
            style={[styles.modalInput, { color: colors.text, borderColor: colors.border, backgroundColor: mode === 'dark' ? '#1B243B' : '#F1F5F9' }]}
            placeholder="e.g. topper_alex"
            placeholderTextColor={colors.textMuted}
            value={newUsernameInput}
            onChangeText={setNewUsernameInput}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <View style={styles.modalBtnRow}>
            <TouchableOpacity
              onPress={() => setEditUsernameModalVisible(false)}
              style={[styles.modalBtn, { backgroundColor: 'rgba(255, 255, 255, 0.08)' }]}
              disabled={usernameUpdating}
            >
              <Text style={[styles.modalBtnText, { color: colors.text }]}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSaveUsername}
              style={[styles.modalBtn, { backgroundColor: colors.primary }]}
              disabled={usernameUpdating}
            >
              {usernameUpdating ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={[styles.modalBtnText, { color: '#FFF', fontWeight: 'bold' }]}>
                  Save Handle
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    marginBottom: 4,
  },
  handlePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
  },
  handleText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  arenaTagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
  },
  arenaTagText: {
    color: '#00F0FF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  shareWhatsAppBtn: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
    elevation: 4,
    shadowColor: '#25D366',
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  shareWhatsAppGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  shareWhatsAppText: {
    color: '#FFF',
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBox: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: 8,
    textAlign: 'center',
  },
  modalDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
    textAlign: 'center',
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 18,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 12,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnText: {
    fontSize: 14,
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
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 96,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.dark.text,
    marginBottom: 16,
    letterSpacing: 0.8,
  },
  profileCard: {
    borderRadius: 18,
    padding: 20,
    alignItems: 'center',
    marginBottom: 18,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    elevation: 6,
  },
  name: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.dark.text,
  },
  email: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    marginTop: 2,
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tierDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  tierText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  adminPortalButton: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 20,
  },
  adminPortalGradient: {
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 14,
  },
  adminPortalText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: 'bold',
    color: Colors.dark.cyan,
    letterSpacing: 1,
    marginBottom: 10,
  },
  upiContainer: {
    backgroundColor: Colors.dark.surface,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginBottom: 20,
  },
  upiSubtext: {
    color: Colors.dark.textMuted,
    fontSize: 11,
    marginBottom: 10,
  },
  upiRow: {
    flexDirection: 'row',
    gap: 8,
  },
  upiInput: {
    flex: 1,
    backgroundColor: '#0F1224',
    color: '#FFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    fontSize: 13,
  },
  saveUpiBtn: {
    backgroundColor: Colors.dark.cyan,
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: 10,
  },
  saveUpiText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 12,
  },
  classRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  classChip: {
    flex: 1,
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    padding: 12,
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
    fontSize: 13,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  classChipTextSelected: {
    color: Colors.dark.primary,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 22,
  },
  statBox: {
    width: '48.4%',
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  statIcon: {
    fontSize: 18,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.dark.text,
  },
  statLabel: {
    fontSize: 9,
    color: Colors.dark.textMuted,
    marginTop: 2,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
    backgroundColor: Colors.dark.surface,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  avatarItem: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#0F1224',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.dark.border,
  },
  avatarItemSelected: {
    borderColor: Colors.dark.cyan,
    backgroundColor: 'rgba(5, 213, 230, 0.15)',
    transform: [{ scale: 1.08 }],
  },
  avatarEmoji: {
    fontSize: 20,
  },
  resetPasswordBtn: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.cyan,
    marginBottom: 10,
  },
  resetPasswordText: {
    color: Colors.dark.cyan,
    fontSize: 13,
    fontWeight: 'bold',
  },
  helpButton: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginBottom: 10,
  },
  helpButtonText: {
    color: Colors.dark.text,
    fontSize: 13,
    fontWeight: 'bold',
  },
  logoutButton: {
    backgroundColor: 'rgba(255, 46, 99, 0.12)',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.danger,
  },
  logoutButtonText: {
    color: Colors.dark.danger,
    fontSize: 13,
    fontWeight: 'bold',
  },
});
