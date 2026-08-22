import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Modal,
  ActivityIndicator,
  Share,
  Linking,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { ThemedBackground } from '../../components/ThemedBackground';
import { BouncyButton } from '../../components/BouncyButton';
import { FriendService } from '../../lib/friendService';
import { FriendlyBattleService } from '../../lib/friendlyBattleService';
import { useAuthStore } from '../../stores/authStore';
import { useUserStore } from '../../stores/userStore';
import { useThemeStore } from '../../stores/themeStore';
import { Friend, User, FriendlyRoom, FriendRequest } from '../../types';
import { Colors } from '../../constants/theme';
import { soundManager } from '../../lib/soundManager';

export default function FriendsScreen() {
  const router = useRouter();
  const { firebaseUser } = useAuthStore();
  const { profile } = useUserStore();
  const { getColors, mode } = useThemeStore();
  const colors = getColors();

  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const [sentRequestUids, setSentRequestUids] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Create Room state
  const [createRoomModalVisible, setCreateRoomModalVisible] = useState(false);
  const [selectedClass, setSelectedClass] = useState<number>(profile?.class || 10);
  const [selectedSubject, setSelectedSubject] = useState<string>('Science');
  const [activeRoom, setActiveRoom] = useState<FriendlyRoom | null>(null);
  const [waitingForGuest, setWaitingForGuest] = useState(false);

  // Join Room state
  const [joinModalVisible, setJoinModalVisible] = useState(false);
  const [joinRoomCode, setJoinRoomCode] = useState('');
  const [joiningLoading, setJoiningLoading] = useState(false);

  const loadFriendsData = async () => {
    if (!firebaseUser) return;
    try {
      setLoading(true);
      const [list, pending, sent] = await Promise.all([
        FriendService.getFriends(firebaseUser.uid),
        FriendService.getPendingRequests(firebaseUser.uid),
        FriendService.getSentRequestUids(firebaseUser.uid),
      ]);
      setFriends(list);
      setPendingRequests(pending);
      setSentRequestUids(sent);
    } catch (e) {
      console.warn('loadFriendsData error:', e);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadFriendsData();
      soundManager.resumeBgm();
    }, [firebaseUser])
  );

  const handleSearch = async (text: string) => {
    setSearchQuery(text);
    if (!text.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setIsSearching(true);
      const results = await FriendService.searchPlayers(text);
      // Filter out self
      const filtered = results.filter((u) => u.uid !== firebaseUser?.uid);
      setSearchResults(filtered);
    } catch (e) {
      console.warn('Search error:', e);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSendFriendRequest = async (target: User) => {
    if (!firebaseUser) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const res = await FriendService.sendFriendRequest(
        profile || { uid: firebaseUser.uid, name: firebaseUser.displayName || 'Player' },
        target
      );

      if (res === 'already_friends') {
        Alert.alert('Already Squad Friends! 🤝', `${target.name} is already in your friend squad.`);
      } else if (res === 'already_requested') {
        Alert.alert('Request Pending ⏳', `You already sent a friend request to ${target.name}.`);
      } else if (res === 'sent') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        soundManager.playCorrect();
        Alert.alert('Friend Request Sent! 📩', `Invitation sent to ${target.name || 'Player'}. When they accept, they will join your Squad!`);
        setSentRequestUids((prev) => [...prev, target.uid]);
      } else {
        Alert.alert('Error', 'Could not send friend request.');
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to send friend request.');
    }
  };

  const handleAcceptRequest = async (request: FriendRequest) => {
    if (!firebaseUser) return;
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      soundManager.playCorrect();
      await FriendService.acceptFriendRequest(request, firebaseUser.uid);
      Alert.alert('Friend Added! 🎉', `${request.senderName} is now in your Squad!`);
      loadFriendsData();
    } catch (e) {
      Alert.alert('Error', 'Failed to accept request.');
    }
  };

  const handleDeclineRequest = async (request: FriendRequest) => {
    if (!firebaseUser) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await FriendService.declineFriendRequest(request, firebaseUser.uid);
      loadFriendsData();
    } catch (e) {
      Alert.alert('Error', 'Failed to decline request.');
    }
  };

  const handleRemoveFriend = (friend: Friend) => {
    Alert.alert('Remove Friend', `Remove ${friend.name} from your squad?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          if (!firebaseUser) return;
          await FriendService.removeFriend(firebaseUser.uid, friend.uid);
          loadFriendsData();
        },
      },
    ]);
  };

  const handleCreateRoom = () => {
    if (!profile && !firebaseUser) return;
    const roomCode = FriendlyBattleService.generateRoomCode();
    const hostUser = profile || {
      uid: firebaseUser!.uid,
      name: firebaseUser!.displayName || 'Player',
      email: firebaseUser!.email || '',
      class: selectedClass as any,
      totalEXP: 0,
      gamesPlayed: 0,
      totalCorrect: 0,
      totalAnswered: 0,
      highestStreak: 0,
      highestDifficulty: 1,
      username: `@player_${firebaseUser!.uid.slice(-4)}`,
      arenaTag: `#AA-${firebaseUser!.uid.slice(-4).toUpperCase()}`,
      avatar: '🎓',
    };

    const room = FriendlyBattleService.createRoom(
      roomCode,
      hostUser,
      selectedClass,
      selectedSubject,
      (event) => {
        if (event.type === 'PLAYER_JOINED') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setWaitingForGuest(false);
          setCreateRoomModalVisible(false);

          // Route to Friendly duel arena screen
          router.push({
            pathname: '/(main)/game/duel',
            params: {
              roomCode,
              role: 'host',
              class: selectedClass.toString(),
              subject: selectedSubject,
              guestName: event.payload.guestName,
              guestAvatar: event.payload.guestAvatar,
            },
          });
        }
      }
    );

    setActiveRoom(room);
    setWaitingForGuest(true);
    setCreateRoomModalVisible(true);
  };

  const handleShareRoomCode = async () => {
    if (!activeRoom) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const msg = `⚔️ *ACADEMIC ARENA 1v1 DUEL!* ⚔️\n\nJoin my room to battle me in Class ${activeRoom.classNum} ${activeRoom.subject}!\n\n🔑 *ROOM CODE:* ${activeRoom.roomCode}\n\nOpen Academic Arena ➔ Tap Friends ➔ Join Duel Code ${activeRoom.roomCode}! 🚀`;

    const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(msg)}`;
    const canOpen = await Linking.canOpenURL(whatsappUrl).catch(() => false);
    if (canOpen) {
      await Linking.openURL(whatsappUrl);
    } else {
      await Share.share({ message: msg, title: 'Academic Arena Duel Code' });
    }
  };

  const handleJoinRoom = async () => {
    const cleanCode = joinRoomCode.trim();
    if (cleanCode.length !== 4) {
      Alert.alert('Invalid Code', 'Please enter a valid 4-digit room code.');
      return;
    }

    if (!profile && !firebaseUser) return;
    try {
      setJoiningLoading(true);
      const guestUser = profile || {
        uid: firebaseUser!.uid,
        name: firebaseUser!.displayName || 'Player',
        email: firebaseUser!.email || '',
        class: 10,
        totalEXP: 0,
        gamesPlayed: 0,
        totalCorrect: 0,
        totalAnswered: 0,
        highestStreak: 0,
        highestDifficulty: 1,
        username: `@player_${firebaseUser!.uid.slice(-4)}`,
        arenaTag: `#AA-${firebaseUser!.uid.slice(-4).toUpperCase()}`,
        avatar: '⚡',
      };

      await FriendlyBattleService.joinRoom(cleanCode, guestUser, (event) => {
        if (event.type === 'GAME_START') {
          setJoinModalVisible(false);
          router.push({
            pathname: '/(main)/game/duel',
            params: {
              roomCode: cleanCode,
              role: 'guest',
              class: '10',
              subject: 'Science',
            },
          });
        }
      });

      // Navigate guest to waiting lobby
      setJoinModalVisible(false);
      router.push({
        pathname: '/(main)/game/duel',
        params: {
          roomCode: cleanCode,
          role: 'guest',
          class: '10',
          subject: 'Science',
        },
      });
    } catch (e) {
      Alert.alert('Join Failed', 'Could not connect to room. Please check the code.');
    } finally {
      setJoiningLoading(false);
    }
  };

  return (
    <ThemedBackground>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>👥 SQUAD & 1v1 DUELS</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Challenge classmates, create private rooms, and trade sarcastic taunts in real-time!
          </Text>
        </View>

        {/* ─── 1v1 Battle Quick Action Buttons ─── */}
        <View style={styles.actionRow}>
          <BouncyButton style={styles.actionCard} onPress={handleCreateRoom}>
            <LinearGradient
              colors={['#FF007A', '#7928CA']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.actionGradient}
            >
              <Text style={styles.actionIcon}>⚔️</Text>
              <Text style={styles.actionTitle}>HOST 1v1 DUEL</Text>
              <Text style={styles.actionSub}>Create room & share code</Text>
            </LinearGradient>
          </BouncyButton>

          <BouncyButton style={styles.actionCard} onPress={() => setJoinModalVisible(true)}>
            <LinearGradient
              colors={['#00F0FF', '#0070F3']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.actionGradient}
            >
              <Text style={styles.actionIcon}>🔑</Text>
              <Text style={styles.actionTitle}>JOIN ROOM</Text>
              <Text style={styles.actionSub}>Enter 4-digit code</Text>
            </LinearGradient>
          </BouncyButton>
        </View>

        {/* ─── 🔍 Search Classmates ─── */}
        <Text style={[styles.sectionTitle, { color: colors.primary }]}>🔍 FIND CLASSMATES</Text>
        <TextInput
          style={[
            styles.searchInput,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              color: colors.text,
            },
          ]}
          placeholder="Search by @handle, #AA-tag, or name..."
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={handleSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />

        {/* Search Results */}
        {isSearching && <ActivityIndicator color={colors.primary} style={{ marginVertical: 10 }} />}

        {searchResults.length > 0 && (
          <View style={styles.resultsBox}>
            {searchResults.map((user) => {
              const isAlreadyFriend = friends.some((f) => f.uid === user.uid);
              const isRequested = sentRequestUids.includes(user.uid);
              return (
                <View
                  key={user.uid}
                  style={[styles.userCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <View style={styles.userInfo}>
                    <Text style={styles.userAvatar}>{user.avatar || '🎓'}</Text>
                    <View>
                      <Text style={[styles.userName, { color: colors.text }]}>{user.name}</Text>
                      <Text style={[styles.userHandle, { color: colors.primary }]}>{user.username}</Text>
                      <Text style={[styles.userTag, { color: '#FFD700' }]}>{user.arenaTag} • Class {user.class || 10}</Text>
                    </View>
                  </View>

                  {isAlreadyFriend ? (
                    <View style={styles.friendBadge}>
                      <Text style={styles.friendBadgeText}>✓ Friends</Text>
                    </View>
                  ) : isRequested ? (
                    <View style={[styles.friendBadge, { backgroundColor: 'rgba(255, 184, 0, 0.15)', borderColor: '#FFB800' }]}>
                      <Text style={[styles.friendBadgeText, { color: '#FFB800' }]}>⏳ Requested</Text>
                    </View>
                  ) : (
                    <BouncyButton
                      style={[styles.addBtn, { backgroundColor: colors.primary }]}
                      onPress={() => handleSendFriendRequest(user)}
                    >
                      <Text style={styles.addBtnText}>➕ Add Friend</Text>
                    </BouncyButton>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* ─── 🔔 Pending Friend Requests ─── */}
        {pendingRequests.length > 0 && (
          <View style={styles.pendingSection}>
            <View style={styles.listHeaderRow}>
              <Text style={[styles.sectionTitle, { color: '#FFB800', marginBottom: 0 }]}>
                🔔 PENDING FRIEND REQUESTS ({pendingRequests.length})
              </Text>
            </View>

            {pendingRequests.map((req) => (
              <View
                key={req.id}
                style={[
                  styles.pendingCard,
                  { backgroundColor: colors.surface, borderColor: 'rgba(255, 184, 0, 0.4)' },
                ]}
              >
                <View style={styles.pendingTopRow}>
                  <View style={styles.userInfo}>
                    <Text style={styles.userAvatar}>{req.senderAvatar || '🎓'}</Text>
                    <View>
                      <Text style={[styles.userName, { color: colors.text }]}>{req.senderName}</Text>
                      <Text style={[styles.userHandle, { color: colors.primary }]}>{req.senderUsername}</Text>
                      <Text style={[styles.userTag, { color: '#FFD700' }]}>
                        {req.senderTag} • Class {req.senderClass} • {req.senderExp.toLocaleString()} EXP
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.requestActionRow}>
                  <TouchableOpacity
                    style={[styles.reqDeclineBtn, { borderColor: colors.border }]}
                    onPress={() => handleDeclineRequest(req)}
                  >
                    <Text style={[styles.reqDeclineText, { color: colors.textMuted }]}>✕ Decline</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.reqAcceptBtn, { backgroundColor: '#10B981' }]}
                    onPress={() => handleAcceptRequest(req)}
                  >
                    <Text style={styles.reqAcceptText}>✓ Accept</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ─── 👥 My Friends List ─── */}
        <View style={styles.listHeaderRow}>
          <Text style={[styles.sectionTitle, { color: colors.primary, marginBottom: 0 }]}>
            MY SQUAD ({friends.length})
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
        ) : friends.length > 0 ? (
          friends.map((friend) => (
            <View
              key={friend.uid}
              style={[
                styles.friendCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View style={styles.userInfo}>
                <View style={styles.avatarWrap}>
                  <Text style={styles.userAvatar}>{friend.avatar || '🎓'}</Text>
                  <View style={styles.onlineDot} />
                </View>
                <View>
                  <Text style={[styles.userName, { color: colors.text }]}>{friend.name}</Text>
                  <Text style={[styles.userHandle, { color: colors.primary }]}>{friend.username}</Text>
                  <Text style={[styles.userTag, { color: '#FFD700' }]}>
                    {friend.arenaTag} • {friend.totalEXP.toLocaleString()} EXP
                  </Text>
                </View>
              </View>

              <View style={styles.friendActions}>
                <BouncyButton
                  style={[styles.challengeBtn, { backgroundColor: '#FF007A' }]}
                  onPress={handleCreateRoom}
                >
                  <Text style={styles.challengeBtnText}>⚔️ Duel</Text>
                </BouncyButton>

                <TouchableOpacity
                  style={styles.removeIconBtn}
                  onPress={() => handleRemoveFriend(friend)}
                >
                  <Text style={{ fontSize: 14 }}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        ) : (
          <View style={[styles.emptyBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={{ fontSize: 36, marginBottom: 8 }}>👥</Text>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No Friends Added Yet</Text>
            <Text style={[styles.emptySub, { color: colors.textMuted }]}>
              Search for classmates above or share your Arena Tag on WhatsApp to start building your squad!
            </Text>
          </View>
        )}
      </ScrollView>

      {/* ─── HOST ROOM WAITING MODAL ─── */}
      <Modal visible={createRoomModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: mode === 'dark' ? '#0E1322' : '#FFFFFF', borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: '#FF007A' }]}>⚔️ HOST FRIENDLY DUEL</Text>
            <Text style={[styles.modalSub, { color: colors.textMuted }]}>
              Share this room code with your opponent to enter the arena!
            </Text>

            {activeRoom && (
              <View style={styles.roomCodeBox}>
                <Text style={styles.roomCodeLabel}>ROOM CODE</Text>
                <Text style={styles.roomCodeBig}>{activeRoom.roomCode}</Text>
              </View>
            )}

            <View style={styles.waitingIndicatorRow}>
              <ActivityIndicator size="small" color="#00F0FF" />
              <Text style={{ color: '#00F0FF', fontSize: 13, fontWeight: 'bold' }}>
                Waiting for challenger to connect...
              </Text>
            </View>

            <BouncyButton style={styles.shareCodeBtn} onPress={handleShareRoomCode}>
              <LinearGradient
                colors={['#25D366', '#128C7E']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.shareCodeGradient}
              >
                <Text style={styles.shareCodeBtnText}>📲 SHARE CODE ON WHATSAPP</Text>
              </LinearGradient>
            </BouncyButton>

            <TouchableOpacity
              style={styles.cancelRoomBtn}
              onPress={() => {
                FriendlyBattleService.leaveCurrentRoom();
                setCreateRoomModalVisible(false);
              }}
            >
              <Text style={[styles.cancelRoomBtnText, { color: colors.textMuted }]}>Cancel Duel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ─── JOIN ROOM MODAL ─── */}
      <Modal visible={joinModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: mode === 'dark' ? '#0E1322' : '#FFFFFF', borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: '#00F0FF' }]}>🔑 ENTER ROOM CODE</Text>
            <Text style={[styles.modalSub, { color: colors.textMuted }]}>
              Type the 4-digit code sent by your friend to jump into the duel!
            </Text>

            <TextInput
              style={[styles.roomInput, { color: colors.text, borderColor: colors.border, backgroundColor: mode === 'dark' ? '#161C30' : '#F1F5F9' }]}
              placeholder="e.g. 4892"
              placeholderTextColor={colors.textMuted}
              value={joinRoomCode}
              onChangeText={setJoinRoomCode}
              keyboardType="number-pad"
              maxLength={4}
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                onPress={() => setJoinModalVisible(false)}
                style={[styles.modalCancelBtn, { backgroundColor: 'rgba(255, 255, 255, 0.08)' }]}
              >
                <Text style={[styles.modalBtnText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleJoinRoom}
                style={[styles.modalJoinBtn, { backgroundColor: '#00F0FF' }]}
                disabled={joiningLoading}
              >
                {joiningLoading ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <Text style={[styles.modalBtnText, { color: '#000', fontWeight: 'bold' }]}>
                    ⚔️ Join Duel
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
  content: {
    padding: 20,
    paddingTop: 56,
    paddingBottom: 110,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 4,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  actionCard: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
  },
  actionGradient: {
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  actionIcon: {
    fontSize: 28,
    marginBottom: 4,
  },
  actionTitle: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  actionSub: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 10,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    marginBottom: 16,
  },
  resultsBox: {
    marginBottom: 20,
    gap: 8,
  },
  userCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  avatarWrap: {
    position: 'relative',
  },
  userAvatar: {
    fontSize: 26,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#00FFA3',
    borderWidth: 1.5,
    borderColor: '#0E1322',
  },
  userName: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  userHandle: {
    fontSize: 12,
    fontWeight: '600',
  },
  userTag: {
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 2,
  },
  friendBadge: {
    backgroundColor: 'rgba(0, 255, 163, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#00FFA3',
  },
  friendBadgeText: {
    color: '#00FFA3',
    fontSize: 11,
    fontWeight: 'bold',
  },
  addBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addBtnText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 12,
  },
  pendingSection: {
    marginBottom: 24,
  },
  pendingCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    marginBottom: 10,
  },
  pendingTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  requestActionRow: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-end',
  },
  reqDeclineBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  reqDeclineText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  reqAcceptBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  reqAcceptText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '900',
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  friendCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 10,
  },
  friendActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  challengeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  challengeBtnText: {
    color: '#FFF',
    fontWeight: '900',
    fontSize: 12,
  },
  removeIconBtn: {
    padding: 8,
    opacity: 0.6,
  },
  emptyBox: {
    padding: 30,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  emptySub: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBox: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  modalSub: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  roomCodeBox: {
    backgroundColor: '#161C30',
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FF007A',
    marginBottom: 16,
  },
  roomCodeLabel: {
    color: '#8A99AD',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 4,
  },
  roomCodeBig: {
    color: '#FFF',
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 6,
  },
  waitingIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  shareCodeBtn: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 12,
  },
  shareCodeGradient: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  shareCodeBtnText: {
    color: '#FFF',
    fontWeight: '900',
    fontSize: 13,
  },
  cancelRoomBtn: {
    paddingVertical: 8,
  },
  cancelRoomBtnText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  roomInput: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 8,
    marginBottom: 20,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  modalJoinBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  modalBtnText: {
    fontSize: 14,
  },
});
