import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import api from '../../lib/api';
import { BouncyButton } from '../../components/BouncyButton';
import { NotificationService } from '../../lib/notificationService';

type Tab = 'STATS' | 'REWARDS' | 'QUESTIONS' | 'USERS';

interface AdminStats {
  totalUsers: number;
  totalRuns: number;
  totalQuestions: number;
  pendingRewards: number;
  weeklyCandidates: Array<{
    rank: number;
    uid: string;
    name: string;
    email: string;
    upiId: string;
    activeBorder: string;
    weeklyEXP: number;
    runsPlayed: number;
  }>;
}

interface QuestionItem {
  _id: string;
  class: number;
  subject: string;
  difficulty: number;
  question: string;
  options: string[];
  answer: number;
  explanation?: string;
  packet?: number;
}

interface RewardItem {
  _id: string;
  uid: string;
  userName: string;
  upiId: string;
  amount: number;
  weekLabel: string;
  status: 'pending' | 'paid' | 'rejected';
  transactionId?: string;
  paidAt?: string;
  createdAt: string;
}

interface UserItem {
  _id: string;
  uid: string;
  name: string;
  email: string;
  class: number;
  totalEXP: number;
  role?: string;
  upiId?: string;
  activeBorder?: string;
  badges?: string[];
  avatar?: string;
}

export default function AdminScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('STATS');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Stats state
  const [stats, setStats] = useState<AdminStats | null>(null);

  // Rewards state
  const [rewards, setRewards] = useState<RewardItem[]>([]);
  const [selectedReward, setSelectedReward] = useState<RewardItem | null>(null);
  const [txIdInput, setTxIdInput] = useState('');
  const [payoutModalVisible, setPayoutModalVisible] = useState(false);

  // Questions state
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [qSearch, setQSearch] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [questionModalVisible, setQuestionModalVisible] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Partial<QuestionItem>>({
    class: 9,
    subject: 'Mathematics',
    difficulty: 1,
    question: '',
    options: ['', '', '', ''],
    answer: 0,
    explanation: '',
    packet: 1,
  });

  // Users state
  const [users, setUsers] = useState<UserItem[]>([]);
  const [userSearch, setUserSearch] = useState('');

  // Admin Password Management state
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [selectedUserForPassword, setSelectedUserForPassword] = useState<UserItem | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [passwordUpdating, setPasswordUpdating] = useState(false);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'STATS') {
        const res = await api.get('/admin/stats');
        setStats(res.data);
      } else if (activeTab === 'REWARDS') {
        const res = await api.get('/admin/rewards');
        setRewards(res.data);
      } else if (activeTab === 'QUESTIONS') {
        const res = await api.get('/admin/questions', {
          params: {
            class: selectedClass || undefined,
            subject: selectedSubject || undefined,
            search: qSearch || undefined,
          },
        });
        setQuestions(res.data.questions || []);
      } else if (activeTab === 'USERS') {
        const res = await api.get('/admin/users', {
          params: { search: userSearch || undefined },
        });
        setUsers(res.data || []);
      }
    } catch (e: any) {
      console.warn('Admin load error:', e);
      Alert.alert('Overlord Clearance Error', e.response?.data?.error || 'Failed to load master console telemetry');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // ─── Trigger Weekly Champion Calculation ───
  const handleTriggerWeekly = async () => {
    Alert.alert(
      '👑 Fire Bounty Cannon',
      'Scan the biggest try-hard of the past week, award them a ₹10 UPI bounty & bestow the Golden God Glow?',
      [
        { text: 'Aborted', style: 'cancel' },
        {
          text: '🚀 Fire Cannon!',
          onPress: async () => {
            try {
              const res = await api.post('/admin/rewards/trigger-weekly');
              Alert.alert('🎉 Coronation Complete!', `Weekly Champion: ${res.data.winner.name}\n₹10 Bounty queued in the Vault!`);
              loadData();
            } catch (err: any) {
              Alert.alert('Cannon Jammed', err.response?.data?.error || 'Failed to trigger weekly reward');
            }
          },
        },
      ]
    );
  };

  // ─── Mark Payout Paid ───
  const handleConfirmPayout = async () => {
    if (!selectedReward) return;
    try {
      await api.patch(`/admin/rewards/${selectedReward._id}`, {
        status: 'paid',
        transactionId: txIdInput,
      });
      Alert.alert('💸 Bounty Dispatched', 'Payout recorded as PAID! The nerd has been rewarded.');
      setPayoutModalVisible(false);
      setTxIdInput('');
      loadData();
    } catch (e: any) {
      Alert.alert('Vault Error', e.response?.data?.error || 'Failed to update payout');
    }
  };

  // ─── Save Question (Add or Edit) ───
  const handleSaveQuestion = async () => {
    const { _id, class: cls, subject, difficulty, question, options, answer, explanation, packet } = editingQuestion;

    if (!question || !options || options.some((o) => !o.trim())) {
      Alert.alert('Incomplete Torture Material', 'Please fill in question text and all 4 options.');
      return;
    }

    try {
      if (_id) {
        await api.put(`/admin/questions/${_id}`, editingQuestion);
        Alert.alert('🧠 Brain Melter Upgraded', 'Question updated in the archives!');
      } else {
        await api.post('/admin/questions', editingQuestion);
        Alert.alert('💥 New Brain Melter Armed', 'Question unleashed into the Arena pool!');
      }
      setQuestionModalVisible(false);
      loadData();
    } catch (e: any) {
      Alert.alert('Fabrication Failed', e.response?.data?.error || 'Failed to save question');
    }
  };

  // ─── Delete Question ───
  const handleDeleteQuestion = (id: string) => {
    Alert.alert('Nuke Brain Melter?', 'Are you sure you want to permanently vaporize this question?', [
      { text: 'Mercy (Cancel)', style: 'cancel' },
      {
        text: '💣 Vaporize',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/admin/questions/${id}`);
            loadData();
          } catch (e: any) {
            Alert.alert('Error', 'Failed to vaporize question');
          }
        },
      },
    ]);
  };

  // ─── Grant Glow Border to User ───
  const handleGrantBorder = async (uid: string, border: string) => {
    try {
      await api.post('/admin/users/grant-badge', { uid, activeBorder: border });
      Alert.alert('Aura Bestowed ✨', `User profile aura transformed to ${border}`);
      loadData();
    } catch (e: any) {
      console.warn('Grant border error:', e.response?.data || e.message);
      Alert.alert('Aura Error', e.response?.data?.error || e.message || 'Failed to update user border');
    }
  };

  // ─── Toggle User Badge / Banner ───
  const handleToggleBadge = async (uid: string, badge: string) => {
    try {
      await api.post('/admin/users/grant-badge', { uid, badge });
      Alert.alert('Medal Toggled 🎖️', `Toggled honor badge: ${badge}`);
      loadData();
    } catch (e: any) {
      Alert.alert('Medal Error', e.response?.data?.error || 'Failed to update badge');
    }
  };

  // ─── Toggle User Role ───
  const handleToggleRole = async (uid: string, currentRole?: string) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    try {
      await api.post('/admin/users/grant-badge', { uid, role: newRole });
      Alert.alert('Rank Shifted ⚔️', `Subject role transformed to ${newRole === 'admin' ? '👑 CO-OVERLORD' : '🧑‍🌾 NOOB PEASANT'}`);
      loadData();
    } catch (e: any) {
      Alert.alert('Command Failed', e.response?.data?.error || 'Failed to update role');
    }
  };

  // ─── Set User Avatar ───
  const handleGrantAvatar = async (uid: string, avatar: string) => {
    try {
      await api.post('/admin/users/grant-badge', { uid, avatar });
      Alert.alert('Disguise Applied 🎭', `User avatar disguised as ${avatar}`);
      loadData();
    } catch (e: any) {
      Alert.alert('Disguise Error', e.response?.data?.error || 'Failed to update avatar');
    }
  };

  // ─── Admin Password Override Functions ───
  const handleOpenPasswordModal = (user: UserItem) => {
    setSelectedUserForPassword(user);
    setNewPasswordInput('');
    setPasswordModalVisible(true);
  };

  const handleAdminChangePassword = async () => {
    if (!selectedUserForPassword) return;
    const targetUid = selectedUserForPassword.uid;
    const targetName = selectedUserForPassword.name || selectedUserForPassword.email;
    const newPass = newPasswordInput.trim();

    if (!newPass || newPass.length < 6) {
      Alert.alert('Weak Cipher', 'New password must be at least 6 characters long.');
      return;
    }

    setPasswordUpdating(true);
    try {
      await api.post('/admin/users/reset-password', {
        uid: targetUid,
        newPassword: newPass,
      });

      setPasswordModalVisible(false);
      Alert.alert(
        '🔑 Master Key Overridden!',
        `The password for "${targetName}" has been successfully set to:\n\n👉  ${newPass}\n\nThe user can now log in immediately without knowing their old password.`
      );
    } catch (e: any) {
      console.warn('Admin password reset error:', e);
      const errMsg = e?.response?.data?.error || e?.message || 'Failed to update password on server.';
      Alert.alert(
        'Direct Override Fallback',
        `${errMsg}\n\nWould you like to dispatch an official Password Reset Missive to ${selectedUserForPassword.email} instead?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: '📩 Dispatch Missive',
            onPress: async () => {
              try {
                if (selectedUserForPassword.email) {
                  await sendPasswordResetEmail(auth, selectedUserForPassword.email);
                  setPasswordModalVisible(false);
                  Alert.alert(
                    'Missive Dispatched! 📩',
                    `A password reset link has been beamed to ${selectedUserForPassword.email}.`
                  );
                }
              } catch (err: any) {
                Alert.alert('Missive Jammed', err.message || 'Failed to send reset email.');
              }
            },
          },
        ]
      );
    } finally {
      setPasswordUpdating(false);
    }
  };

  const handleSendResetEmailDirect = async (user: UserItem) => {
    if (!user.email) {
      Alert.alert('No Transmission Target', 'No email address found for this user.');
      return;
    }

    Alert.alert(
      'Beam Password Reset Missive',
      `Dispatch an official password reset link directly to ${user.email}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: '🚀 Dispatch Missive',
          onPress: async () => {
            try {
              await sendPasswordResetEmail(auth, user.email);
              Alert.alert(
                'Missive Dispatched! 📩',
                `A password reset link has been beamed to ${user.email}.`
              );
            } catch (e: any) {
              Alert.alert('Transmission Failed', e.message || 'Failed to send password reset email.');
            }
          },
        },
      ]
    );
  };

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#070A10" />
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        {/* ─── CYBER MASTER CONSOLE HEADER ─── */}
        <LinearGradient colors={['#101726', '#090D15']} style={styles.header}>
          <View style={styles.headerTopRow}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
              <Text style={styles.backBtnText}>◀ EXIT CONSOLE</Text>
            </TouchableOpacity>

            <View style={styles.godModePill}>
              <View style={styles.blinkingDot} />
              <Text style={styles.godModeText}>GOD MODE ACTIVE</Text>
            </View>
          </View>

          <View style={styles.titleWrap}>
            <Text style={styles.headerTitle}>⚡ OVERLORD MASTER CONSOLE 🕹️</Text>
            <Text style={styles.headerSubtitle}>
              "With great admin power comes zero responsibility to be boring."
            </Text>
          </View>

          {/* Live Cyber Telemetry Badges */}
          <View style={styles.telemetryBar}>
            <View style={styles.telemetryBadge}>
              <Text style={styles.telemetryDot}>🟢</Text>
              <Text style={styles.telemetryLabel}>MAINFRAME: ONLINE</Text>
            </View>
            <View style={styles.telemetryBadge}>
              <Text style={styles.telemetryDot}>📡</Text>
              <Text style={styles.telemetryLabel}>CLOUD MATRIX: SYNCED</Text>
            </View>
            <View style={styles.telemetryBadge}>
              <Text style={styles.telemetryDot}>🛡️</Text>
              <Text style={styles.telemetryLabel}>ANTI-CHEAT: ARMED</Text>
            </View>
          </View>
        </LinearGradient>

        {/* ─── CYBER HUD TAB NAVIGATION ─── */}
        <View style={styles.tabBar}>
          {(['STATS', 'REWARDS', 'QUESTIONS', 'USERS'] as Tab[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tabItem, activeTab === tab && styles.tabItemActive]}
              onPress={() => setActiveTab(tab)}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab === 'STATS'
                  ? '📊 TELEMETRY'
                  : tab === 'REWARDS'
                  ? '💸 BOUNTY VAULT'
                  : tab === 'QUESTIONS'
                  ? '🧠 BRAIN MELTERS'
                  : '👥 MINION SQUAD'}
              </Text>
              {activeTab === tab && <View style={styles.activeTabGlow} />}
            </TouchableOpacity>
          ))}
        </View>

        {/* ─── MAIN CONTENT ─── */}
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentInner}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00F0FF" />
          }
        >
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#00F0FF" />
              <Text style={styles.loadingSub}>Decrypting mainframe surveillance data...</Text>
            </View>
          ) : activeTab === 'STATS' ? (
            /* 📊 ARENA TELEMETRY TAB */
            <View>
              <View style={styles.hudCardHeader}>
                <Text style={styles.hudSectionTitle}>📡 LIVE ARENA SURVEILLANCE</Text>
                <Text style={styles.hudSectionSub}>Stalking your student subjects in real-time.</Text>
              </View>

              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                  <Text style={styles.statCardEmoji}>🧑‍🎓</Text>
                  <Text style={styles.statNumber}>{stats?.totalUsers || 0}</Text>
                  <Text style={styles.statLabel}>Brainiacs Enrolled</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statCardEmoji}>🔥</Text>
                  <Text style={[styles.statNumber, { color: '#FF7B00' }]}>{stats?.totalRuns || 0}</Text>
                  <Text style={styles.statLabel}>Grinding Sessions</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statCardEmoji}>💣</Text>
                  <Text style={[styles.statNumber, { color: '#BD00FF' }]}>{stats?.totalQuestions || 0}</Text>
                  <Text style={styles.statLabel}>Knowledge Nukes</Text>
                </View>
                <View style={[styles.statCard, { borderColor: '#FFD700' }]}>
                  <Text style={styles.statCardEmoji}>🤑</Text>
                  <Text style={[styles.statNumber, { color: '#FFD700' }]}>{stats?.pendingRewards || 0}</Text>
                  <Text style={styles.statLabel}>Unclaimed Loot</Text>
                </View>
              </View>

              {/* Instant Notification Broadcast Tester */}
              <View style={{ marginBottom: 14 }}>
                <BouncyButton
                  style={styles.cannonFireBtn}
                  onPress={async () => {
                    await NotificationService.sendTestNotification();
                    Alert.alert('📡 Broadcast Triggered!', 'A random sarcastic reminder will pop up on your device in 2 seconds.');
                  }}
                >
                  <Text style={styles.cannonFireBtnText}>🔔 TEST SARCASTIC NOTIFICATION (IN 2s)</Text>
                </BouncyButton>
              </View>

              {/* Weekly Champions Section */}
              <View style={styles.cannonCard}>
                <View style={styles.cannonHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cannonTitle}>👑 THIS WEEK'S TOP SWEAT-LORDS</Text>
                    <Text style={styles.cannonSub}>
                      Ranked by who has the least social life and highest weekly EXP!
                    </Text>
                  </View>
                  <BouncyButton onPress={handleTriggerWeekly} style={styles.cannonFireBtn}>
                    <Text style={styles.cannonFireBtnText}>🚀 FIRE BOUNTY CANNON</Text>
                  </BouncyButton>
                </View>

                {stats?.weeklyCandidates && stats.weeklyCandidates.length > 0 ? (
                  stats.weeklyCandidates.map((c) => (
                    <View key={c.uid} style={styles.sweatLordRow}>
                      <View style={[styles.rankBadge, c.rank === 1 && styles.rankBadgeGold]}>
                        <Text style={[styles.rankText, c.rank === 1 && { color: '#FFD700' }]}>
                          #{c.rank}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.userNameText}>{c.name}</Text>
                        <Text style={styles.userSubText}>
                          UPI: {c.upiId || '⚠️ None registered'} • {c.weeklyEXP.toLocaleString()} W-EXP
                        </Text>
                      </View>
                      {c.rank === 1 && (
                        <View style={styles.crownTag}>
                          <Text style={styles.crownTagText}>👑 CHOSEN CHAMPION</Text>
                        </View>
                      )}
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyText}>No students have entered the arena grinder this week yet.</Text>
                )}
              </View>
            </View>
          ) : activeTab === 'REWARDS' ? (
            /* 💸 BOUNTY VAULT TAB */
            <View>
              <View style={styles.hudCardHeader}>
                <Text style={styles.hudSectionTitle}>💸 REAL CASH PAYOUT QUEUE (₹10 UPI BOUNTY)</Text>
                <Text style={styles.hudSectionSub}>Pay the weekly champion before they storm the server room!</Text>
              </View>

              <View style={styles.sectionHeaderRow}>
                <BouncyButton onPress={handleTriggerWeekly} style={styles.cannonFireBtn}>
                  <Text style={styles.cannonFireBtnText}>+ Crown New Winner (₹10)</Text>
                </BouncyButton>
              </View>

              {rewards.length > 0 ? (
                rewards.map((r) => (
                  <View key={r._id} style={styles.rewardCard}>
                    <View style={styles.rewardHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={{ fontSize: 20 }}>💰</Text>
                        <Text style={styles.rewardUser}>{r.userName}</Text>
                      </View>
                      <View
                        style={[
                          styles.statusBadge,
                          r.status === 'paid'
                            ? styles.statusPaid
                            : r.status === 'rejected'
                            ? styles.statusRejected
                            : styles.statusPending,
                        ]}
                      >
                        <Text style={styles.statusText}>
                          {r.status === 'paid' ? '✅ BOUNTY DISPATCHED' : r.status === 'rejected' ? '🚫 REJECTED' : '⏳ AWAITING CASH'}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.rewardDetail}>📅 Arena Period: {r.weekLabel}</Text>
                    <Text style={styles.rewardDetail}>📱 UPI ID: <Text style={{ color: '#00F0FF', fontWeight: 'bold' }}>{r.upiId || '⚠️ Not provided by user'}</Text></Text>
                    <Text style={styles.rewardAmount}>Loot: ₹{r.amount} Cold Hard Cash</Text>
                    {r.transactionId ? <Text style={styles.txText}>🏦 Bank Ref: {r.transactionId}</Text> : null}

                    {r.status === 'pending' && (
                      <View style={styles.rewardActionRow}>
                        <BouncyButton
                          onPress={() => {
                            setSelectedReward(r);
                            setPayoutModalVisible(true);
                          }}
                          style={styles.payBtn}
                        >
                          <Text style={styles.payBtnText}>✅ Confirm ₹10 Dispatched</Text>
                        </BouncyButton>
                      </View>
                    )}
                  </View>
                ))
              ) : (
                <View style={styles.emptyBox}>
                  <Text style={{ fontSize: 32, marginBottom: 8 }}>🏆</Text>
                  <Text style={styles.emptyText}>The Bounty Vault is clear! No pending payments.</Text>
                </View>
              )}
            </View>
          ) : activeTab === 'QUESTIONS' ? (
            /* 🧠 BRAIN MELTERS TAB */
            <View>
              <View style={styles.hudCardHeader}>
                <Text style={styles.hudSectionTitle}>🧠 BRAIN MELTER ARCHIVES</Text>
                <Text style={styles.hudSectionSub}>Craft mind-bending MCQs to humble overconfident students.</Text>
              </View>

              <View style={styles.filterRow}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="🔍 Search through the torture archives..."
                  placeholderTextColor="#667"
                  value={qSearch}
                  onChangeText={setQSearch}
                  onSubmitEditing={loadData}
                />
                <BouncyButton
                  onPress={() => {
                    setEditingQuestion({
                      class: 9,
                      subject: 'Mathematics',
                      difficulty: 1,
                      question: '',
                      options: ['', '', '', ''],
                      answer: 0,
                      explanation: '',
                      packet: 1,
                    });
                    setQuestionModalVisible(true);
                  }}
                  style={styles.addQuestionBtn}
                >
                  <Text style={styles.addQuestionBtnText}>➕ CRAFT MELTER</Text>
                </BouncyButton>
              </View>

              {questions.length > 0 ? (
                questions.map((q) => (
                  <View key={q._id} style={styles.questionCard}>
                    <View style={styles.qHeader}>
                      <View style={styles.qMetaBadge}>
                        <Text style={styles.qMetaText}>GRADE {q.class} • {q.subject.toUpperCase()} • LVL {q.difficulty}</Text>
                      </View>
                      <View style={styles.qActions}>
                        <TouchableOpacity
                          onPress={() => {
                            setEditingQuestion(q);
                            setQuestionModalVisible(true);
                          }}
                          style={styles.iconBtn}
                        >
                          <Text style={{ fontSize: 16 }}>✏️</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDeleteQuestion(q._id)} style={styles.iconBtn}>
                          <Text style={{ fontSize: 16 }}>🗑️</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                    <Text style={styles.qText}>{q.question}</Text>
                    {q.options.map((opt, i) => (
                      <View
                        key={i}
                        style={[
                          styles.qOptionBox,
                          i === q.answer && styles.qOptionBoxCorrect,
                        ]}
                      >
                        <Text
                          style={[
                            styles.qOptionText,
                            i === q.answer && styles.qOptionTextCorrect,
                          ]}
                        >
                          {String.fromCharCode(65 + i)}. {opt} {i === q.answer ? '  [CORRECT ✓]' : ''}
                        </Text>
                      </View>
                    ))}
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>No matching brain melters discovered.</Text>
              )}
            </View>
          ) : (
            /* 👥 MINION SQUAD TAB */
            <View>
              <View style={styles.hudCardHeader}>
                <Text style={styles.hudSectionTitle}>👥 MINION SQUAD & GOD-MODE CONTROLS</Text>
                <Text style={styles.hudSectionSub}>Bestow sacred glowing auras, override forgotten passwords, and crown co-overlords.</Text>
              </View>

              <TextInput
                style={styles.searchInput}
                placeholder="🔍 Search minion by name or email..."
                placeholderTextColor="#667"
                value={userSearch}
                onChangeText={setUserSearch}
                onSubmitEditing={loadData}
              />

              {users.length > 0 ? (
                users.map((u) => (
                  <View key={u._id} style={styles.userCard}>
                    <View style={styles.userHeader}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={{ fontSize: 20 }}>{u.avatar || '🎓'}</Text>
                          <Text style={styles.userNameText}>{u.name}</Text>
                        </View>
                        <Text style={styles.userSubText}>{u.email}</Text>
                        <Text style={styles.userMetaText}>
                          ⚔️ Total EXP: <Text style={{ color: '#00F0FF', fontWeight: 'bold' }}>{u.totalEXP.toLocaleString()}</Text> • 📱 UPI: {u.upiId || 'None'}
                        </Text>
                      </View>

                      <TouchableOpacity onPress={() => handleToggleRole(u.uid, u.role)} activeOpacity={0.8}>
                        <View style={[styles.roleBadge, u.role === 'admin' && styles.adminRoleBadge]}>
                          <Text style={[styles.roleBadgeText, u.role === 'admin' && { color: '#000' }]}>
                            {u.role === 'admin' ? '👑 OVERLORD' : '🧑‍🌾 PEASANT'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    </View>

                    {/* Profile Aura Section */}
                    <Text style={styles.grantSectionTitle}>✨ BESTOW SACRED GLOWING AURA:</Text>
                    <View style={styles.borderBtnRow}>
                      {(['default', 'glowing_gold', 'neon_cyan', 'fire_ring'] as const).map((border) => (
                        <TouchableOpacity
                          key={border}
                          style={[
                            styles.borderBtn,
                            u.activeBorder === border && styles.borderBtnSelected,
                          ]}
                          onPress={() => handleGrantBorder(u.uid, border)}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.borderBtnText, u.activeBorder === border && { color: '#00F0FF' }]}>
                            {border === 'glowing_gold'
                              ? '👑 Gold Glow'
                              : border === 'neon_cyan'
                              ? '⚡ Neon Cyber'
                              : border === 'fire_ring'
                              ? '🔥 Fire Ring'
                              : '🧊 Normal'}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Honor Medals */}
                    <Text style={styles.grantSectionTitle}>🎖️ HONOR MEDALS & BANNERS:</Text>
                    <View style={styles.borderBtnRow}>
                      {[
                        { id: 'WEEKLY_CHAMPION_GOLD', label: '👑 Weekly Champion' },
                        { id: 'ARENA_LEGEND', label: '🌟 Arena Legend' },
                        { id: 'FIRE_WARRIOR', label: '🔥 Fire Warrior' },
                        { id: 'CYAN_HERO', label: '⚡ Cyber Hero' },
                        { id: 'TOP_SCORER', label: '🎯 200 IQ Demon' },
                        { id: 'CLASS_CHAMP', label: '🎓 Top Class' },
                      ].map((b) => {
                        const hasBadge = (u.badges || []).includes(b.id);
                        return (
                          <TouchableOpacity
                            key={b.id}
                            style={[
                              styles.borderBtn,
                              hasBadge && styles.borderBtnActiveMedal,
                            ]}
                            onPress={() => handleToggleBadge(u.uid, b.id)}
                            activeOpacity={0.7}
                          >
                            <Text style={[styles.borderBtnText, hasBadge && { color: '#00FFA3' }]}>
                              {hasBadge ? `${b.label} ✓` : b.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {/* Avatar Disguise */}
                    <Text style={styles.grantSectionTitle}>🎭 ASSIGN AVATAR DISGUISE:</Text>
                    <View style={styles.borderBtnRow}>
                      {['🎓', '⚡', '🥷', '🧙‍♂️', '🚀', '👑', '🦁', '🔥', '🤖', '🐯', '🦅', '👾'].map((av) => (
                        <TouchableOpacity
                          key={av}
                          style={[
                            styles.avatarBtn,
                            u.avatar === av && styles.avatarBtnSelected,
                          ]}
                          onPress={() => handleGrantAvatar(u.uid, av)}
                          activeOpacity={0.7}
                        >
                          <Text style={{ fontSize: 18 }}>{av}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Account Security & Password Direct Override */}
                    <Text style={styles.grantSectionTitle}>🔐 MASTER ACCOUNT SECURITY & OVERRIDES:</Text>
                    <View style={styles.securityBtnRow}>
                      <TouchableOpacity
                        style={styles.passwordOverrideBtn}
                        onPress={() => handleOpenPasswordModal(u)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.passwordOverrideBtnText}>🔑 Override Password</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.sendResetEmailBtn}
                        onPress={() => handleSendResetEmailDirect(u)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.sendResetEmailBtnText}>📩 Dispatch Reset Missive</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>No minions discovered in the registry.</Text>
              )}
            </View>
          )}
        </ScrollView>

        {/* ─── CONFIRM UPI BOUNTY MODAL ─── */}
        <Modal visible={payoutModalVisible} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>💸 CONFIRM UPI BOUNTY DISPATCH</Text>
              <Text style={styles.modalSubText}>Recipient Minion: <Text style={{ color: '#FFF', fontWeight: 'bold' }}>{selectedReward?.userName}</Text></Text>
              <Text style={styles.modalSubText}>Target UPI ID: <Text style={{ color: '#00F0FF', fontWeight: 'bold' }}>{selectedReward?.upiId}</Text></Text>
              <Text style={[styles.modalSubText, { marginBottom: 14 }]}>Amount: <Text style={{ color: '#00FFA3', fontWeight: 'bold' }}>₹{selectedReward?.amount || 10} Cash</Text></Text>

              <TextInput
                style={styles.modalInput}
                placeholder="Enter UPI / Bank Ref Transaction ID..."
                placeholderTextColor="#667"
                value={txIdInput}
                onChangeText={setTxIdInput}
              />

              <View style={styles.modalBtnRow}>
                <TouchableOpacity
                  onPress={() => setPayoutModalVisible(false)}
                  style={[styles.modalBtn, { backgroundColor: '#1C2436' }]}
                >
                  <Text style={styles.modalBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleConfirmPayout} style={[styles.modalBtn, { backgroundColor: '#00FFA3' }]}>
                  <Text style={[styles.modalBtnText, { color: '#000' }]}>Confirm Dispatched</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* ─── BRAIN MELTER CREATOR MODAL ─── */}
        <Modal visible={questionModalVisible} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <ScrollView contentContainerStyle={styles.modalBoxLarge}>
              <Text style={styles.modalTitle}>
                {editingQuestion._id ? '🛠️ CALIBRATE BRAIN MELTER' : '💣 FORGE NEW BRAIN MELTER'}
              </Text>

              <Text style={styles.fieldLabel}>Torture Question Prompt:</Text>
              <TextInput
                style={[styles.modalInput, { height: 80 }]}
                multiline
                placeholder="e.g. If a train travels at the speed of light..."
                placeholderTextColor="#667"
                value={editingQuestion.question}
                onChangeText={(t) => setEditingQuestion({ ...editingQuestion, question: t })}
              />

              <Text style={styles.fieldLabel}>Target Student Grade (9 or 10):</Text>
              <TextInput
                style={styles.modalInput}
                keyboardType="numeric"
                value={String(editingQuestion.class || 9)}
                onChangeText={(t) => setEditingQuestion({ ...editingQuestion, class: parseInt(t) || 9 })}
              />

              <Text style={styles.fieldLabel}>Subject Domain:</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 6 }}>
                {['Mathematics', 'Science', 'English', 'Social Science'].map((sub) => (
                  <TouchableOpacity
                    key={sub}
                    style={[
                      styles.subjectPill,
                      editingQuestion.subject === sub && styles.subjectPillSelected,
                    ]}
                    onPress={() => setEditingQuestion({ ...editingQuestion, subject: sub })}
                  >
                    <Text
                      style={[
                        styles.subjectPillText,
                        editingQuestion.subject === sub && { color: '#000', fontWeight: 'bold' },
                      ]}
                    >
                      {sub}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Four Deceptive Answer Options (Tap letter to set CORRECT answer):</Text>
              {(editingQuestion.options || ['', '', '', '']).map((opt, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 4 }}>
                  <TouchableOpacity
                    onPress={() => setEditingQuestion({ ...editingQuestion, answer: i })}
                    style={[
                      styles.answerIndexBtn,
                      editingQuestion.answer === i && styles.answerIndexBtnCorrect,
                    ]}
                  >
                    <Text style={[styles.answerIndexText, editingQuestion.answer === i && { color: '#000' }]}>
                      {String.fromCharCode(65 + i)}
                    </Text>
                  </TouchableOpacity>
                  <TextInput
                    style={[styles.modalInput, { flex: 1, marginVertical: 0 }]}
                    placeholder={`Option ${String.fromCharCode(65 + i)}`}
                    placeholderTextColor="#667"
                    value={opt}
                    onChangeText={(t) => {
                      const newOpts = [...(editingQuestion.options || ['', '', '', ''])];
                      newOpts[i] = t;
                      setEditingQuestion({ ...editingQuestion, options: newOpts });
                    }}
                  />
                </View>
              ))}

              <Text style={styles.fieldLabel}>Sarcastic Explanation / Walkthrough:</Text>
              <TextInput
                style={[styles.modalInput, { height: 60 }]}
                multiline
                placeholder="Explain why the other 3 options were utter nonsense..."
                placeholderTextColor="#667"
                value={editingQuestion.explanation}
                onChangeText={(t) => setEditingQuestion({ ...editingQuestion, explanation: t })}
              />

              <View style={styles.modalBtnRow}>
                <TouchableOpacity
                  onPress={() => setQuestionModalVisible(false)}
                  style={[styles.modalBtn, { backgroundColor: '#1C2436' }]}
                >
                  <Text style={styles.modalBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSaveQuestion} style={[styles.modalBtn, { backgroundColor: '#00F0FF' }]}>
                  <Text style={[styles.modalBtnText, { color: '#000' }]}>Arm Question 🚀</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </Modal>

        {/* ─── DIRECT PASSWORD OVERRIDE MODAL ─── */}
        <Modal visible={passwordModalVisible} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <View style={styles.passwordModalHeader}>
                <Text style={{ fontSize: 24 }}>🔑</Text>
                <Text style={styles.modalTitle}>MASTER PASSWORD OVERRIDE</Text>
              </View>
              <Text style={styles.passwordModalDesc}>
                Set a direct new password for this user without requiring their old password or email reset link.
              </Text>

              {selectedUserForPassword && (
                <View style={styles.userTargetInfoBox}>
                  <Text style={styles.userTargetName}>👤 {selectedUserForPassword.name || 'Anonymous User'}</Text>
                  <Text style={styles.userTargetEmail}>✉️ {selectedUserForPassword.email}</Text>
                </View>
              )}

              <Text style={styles.fieldLabel}>Enter Brand New Password (min 6 characters):</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. arenaWinner2026"
                placeholderTextColor="#667"
                value={newPasswordInput}
                onChangeText={setNewPasswordInput}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <View style={styles.modalBtnRow}>
                <TouchableOpacity
                  onPress={() => setPasswordModalVisible(false)}
                  style={[styles.modalBtn, { backgroundColor: '#1C2436' }]}
                  disabled={passwordUpdating}
                >
                  <Text style={styles.modalBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleAdminChangePassword}
                  style={[styles.modalBtn, { backgroundColor: '#FFD700' }]}
                  disabled={passwordUpdating}
                >
                  {passwordUpdating ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <Text style={[styles.modalBtnText, { color: '#000', fontWeight: 'bold' }]}>
                      ⚡ Override Now
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070A10',
  },
  header: {
    paddingTop: 48,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.25)',
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  backBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  backBtnText: {
    color: '#00F0FF',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  godModePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    borderWidth: 1,
    borderColor: '#FFD700',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  blinkingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00FFA3',
  },
  godModeText: {
    color: '#FFD700',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  titleWrap: {
    marginBottom: 12,
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    color: '#8A99AD',
    fontSize: 12,
    marginTop: 2,
    fontStyle: 'italic',
  },
  telemetryBar: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 4,
  },
  telemetryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 240, 255, 0.06)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.18)',
  },
  telemetryDot: {
    fontSize: 10,
  },
  telemetryLabel: {
    color: '#00F0FF',
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#0B0F19',
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  tabItem: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  tabItemActive: {
    backgroundColor: 'rgba(0, 240, 255, 0.08)',
  },
  tabText: {
    color: '#6F8099',
    fontSize: 11,
    fontWeight: 'bold',
  },
  tabTextActive: {
    color: '#00F0FF',
    fontWeight: '900',
  },
  activeTabGlow: {
    position: 'absolute',
    bottom: 0,
    left: '15%',
    right: '15%',
    height: 3,
    backgroundColor: '#00F0FF',
    borderRadius: 2,
    shadowColor: '#00F0FF',
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 4,
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: 16,
    paddingBottom: 40,
  },
  loadingContainer: {
    marginTop: 60,
    alignItems: 'center',
  },
  loadingSub: {
    color: '#6F8099',
    fontSize: 12,
    marginTop: 12,
  },
  hudCardHeader: {
    marginBottom: 14,
  },
  hudSectionTitle: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  hudSectionSub: {
    color: '#6F8099',
    fontSize: 12,
    marginTop: 2,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    minWidth: '46%',
    backgroundColor: '#0E1322',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.2)',
  },
  statCardEmoji: {
    fontSize: 18,
    marginBottom: 4,
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '900',
    color: '#00F0FF',
  },
  statLabel: {
    fontSize: 11,
    color: '#8A99AD',
    marginTop: 2,
    fontWeight: '600',
  },
  cannonCard: {
    backgroundColor: '#0E1322',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.35)',
    marginTop: 8,
  },
  cannonHeader: {
    marginBottom: 14,
    gap: 10,
  },
  cannonTitle: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: '900',
  },
  cannonSub: {
    color: '#8A99AD',
    fontSize: 12,
    marginTop: 2,
  },
  cannonFireBtn: {
    backgroundColor: '#FFD700',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#FFD700',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 3,
  },
  cannonFireBtnText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 12,
  },
  sweatLordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141A2D',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    gap: 10,
  },
  rankBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#1E2742',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankBadgeGold: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  rankText: {
    color: '#00F0FF',
    fontWeight: 'bold',
    fontSize: 12,
  },
  userNameText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  userSubText: {
    color: '#8A99AD',
    fontSize: 11,
    marginTop: 2,
  },
  crownTag: {
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    borderWidth: 1,
    borderColor: '#FFD700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  crownTagText: {
    color: '#FFD700',
    fontWeight: 'bold',
    fontSize: 10,
  },
  emptyText: {
    color: '#6F8099',
    textAlign: 'center',
    marginTop: 20,
    fontSize: 12,
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  sectionHeaderRow: {
    marginBottom: 14,
  },
  rewardCard: {
    backgroundColor: '#0E1322',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.25)',
    marginBottom: 12,
  },
  rewardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  rewardUser: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFF',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusPending: { backgroundColor: '#FF9900' },
  statusPaid: { backgroundColor: '#00FFA3' },
  statusRejected: { backgroundColor: '#FF2A6D' },
  statusText: { fontSize: 10, fontWeight: '900', color: '#000' },
  rewardDetail: { color: '#8A99AD', fontSize: 12, marginTop: 3 },
  rewardAmount: { color: '#00FFA3', fontWeight: 'bold', fontSize: 14, marginTop: 6 },
  txText: { color: '#6F8099', fontSize: 11, marginTop: 4 },
  rewardActionRow: { marginTop: 12 },
  payBtn: {
    backgroundColor: '#00FFA3',
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  payBtnText: { color: '#000', fontWeight: '900', fontSize: 12 },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#0E1322',
    color: '#FFF',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.25)',
    fontSize: 13,
    marginBottom: 14,
  },
  addQuestionBtn: {
    backgroundColor: '#00F0FF',
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderRadius: 12,
    height: 48,
  },
  addQuestionBtnText: { color: '#000', fontWeight: '900', fontSize: 11 },
  questionCard: {
    backgroundColor: '#0E1322',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 12,
  },
  qHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  qMetaBadge: {
    backgroundColor: 'rgba(0, 240, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.2)',
  },
  qMetaText: { color: '#00F0FF', fontSize: 10, fontWeight: 'bold' },
  qActions: { flexDirection: 'row', gap: 10 },
  iconBtn: { padding: 4 },
  qText: { color: '#FFF', fontSize: 14, fontWeight: 'bold', marginBottom: 10, lineHeight: 20 },
  qOptionBox: {
    backgroundColor: '#141A2D',
    padding: 10,
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  qOptionBoxCorrect: {
    borderColor: 'rgba(0, 255, 163, 0.4)',
    backgroundColor: 'rgba(0, 255, 163, 0.08)',
  },
  qOptionText: { color: '#8A99AD', fontSize: 12 },
  qOptionTextCorrect: { color: '#00FFA3', fontWeight: 'bold' },
  userCard: {
    backgroundColor: '#0E1322',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.2)',
    marginBottom: 14,
  },
  userHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  userMetaText: {
    color: '#8A99AD',
    fontSize: 11,
    marginTop: 3,
  },
  roleBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  adminRoleBadge: {
    backgroundColor: '#FFD700',
    borderColor: '#FFD700',
  },
  roleBadgeText: {
    color: '#8A99AD',
    fontSize: 10,
    fontWeight: '900',
  },
  grantSectionTitle: {
    color: '#6F8099',
    fontSize: 10,
    fontWeight: '900',
    marginTop: 12,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  borderBtnRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  borderBtn: {
    backgroundColor: '#141A2D',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  borderBtnSelected: {
    borderColor: '#00F0FF',
    backgroundColor: 'rgba(0, 240, 255, 0.12)',
  },
  borderBtnActiveMedal: {
    borderColor: '#00FFA3',
    backgroundColor: 'rgba(0, 255, 163, 0.12)',
  },
  borderBtnText: {
    color: '#8A99AD',
    fontSize: 11,
    fontWeight: 'bold',
  },
  avatarBtn: {
    backgroundColor: '#141A2D',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  avatarBtnSelected: {
    borderColor: '#FFD700',
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
  },
  securityBtnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  passwordOverrideBtn: {
    flex: 1,
    backgroundColor: '#FFD700',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  passwordOverrideBtnText: {
    color: '#000',
    fontSize: 11,
    fontWeight: '900',
  },
  sendResetEmailBtn: {
    flex: 1,
    backgroundColor: 'rgba(0, 240, 255, 0.08)',
    borderWidth: 1,
    borderColor: '#00F0FF',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendResetEmailBtnText: {
    color: '#00F0FF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    padding: 18,
  },
  modalBox: {
    backgroundColor: '#0E1322',
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.3)',
  },
  modalBoxLarge: {
    backgroundColor: '#0E1322',
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.3)',
    marginVertical: 30,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFF',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  modalSubText: {
    color: '#8A99AD',
    fontSize: 13,
    marginBottom: 3,
  },
  modalInput: {
    backgroundColor: '#070A10',
    color: '#FFF',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.25)',
    marginTop: 6,
    marginBottom: 12,
    fontSize: 13,
  },
  fieldLabel: {
    color: '#00F0FF',
    fontSize: 11,
    fontWeight: 'bold',
    marginTop: 6,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalBtnText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  passwordModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  passwordModalDesc: {
    color: '#8A99AD',
    fontSize: 12,
    marginBottom: 12,
    lineHeight: 16,
  },
  userTargetInfoBox: {
    backgroundColor: '#070A10',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
    marginBottom: 12,
  },
  userTargetName: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  userTargetEmail: {
    color: '#8A99AD',
    fontSize: 11,
    marginTop: 2,
  },
  subjectPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#141A2D',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  subjectPillSelected: {
    backgroundColor: '#00F0FF',
    borderColor: '#00F0FF',
  },
  subjectPillText: {
    color: '#8A99AD',
    fontSize: 12,
  },
  answerIndexBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#141A2D',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  answerIndexBtnCorrect: {
    backgroundColor: '#00FFA3',
    borderColor: '#00FFA3',
  },
  answerIndexText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
