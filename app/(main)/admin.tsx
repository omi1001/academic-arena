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
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../lib/api';
import { Colors, Gradients } from '../../constants/theme';
import { BouncyButton } from '../../components/BouncyButton';

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
      Alert.alert('Admin Access Error', e.response?.data?.error || 'Failed to load admin data');
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
      'Trigger Weekly Rewards',
      'Are you sure you want to calculate the past week top player and create a ₹10 UPI payout & grant them the Gold Glow badge?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Calculate & Award',
          onPress: async () => {
            try {
              const res = await api.post('/admin/rewards/trigger-weekly');
              Alert.alert('Success!', `Weekly Champion: ${res.data.winner.name}\nReward queued!`);
              loadData();
            } catch (err: any) {
              Alert.alert('Error', err.response?.data?.error || 'Failed to trigger weekly reward');
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
      Alert.alert('Success', 'Payout marked as PAID!');
      setPayoutModalVisible(false);
      setTxIdInput('');
      loadData();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to update payout');
    }
  };

  // ─── Save Question (Add or Edit) ───
  const handleSaveQuestion = async () => {
    const { _id, class: cls, subject, difficulty, question, options, answer, explanation, packet } = editingQuestion;

    if (!question || !options || options.some((o) => !o.trim())) {
      Alert.alert('Validation Error', 'Please fill in question text and all 4 options.');
      return;
    }

    try {
      if (_id) {
        await api.put(`/admin/questions/${_id}`, editingQuestion);
        Alert.alert('Success', 'Question updated successfully!');
      } else {
        await api.post('/admin/questions', editingQuestion);
        Alert.alert('Success', 'New question created!');
      }
      setQuestionModalVisible(false);
      loadData();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to save question');
    }
  };

  // ─── Delete Question ───
  const handleDeleteQuestion = (id: string) => {
    Alert.alert('Delete Question', 'Are you sure you want to delete this question?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/admin/questions/${id}`);
            loadData();
          } catch (e: any) {
            Alert.alert('Error', 'Failed to delete question');
          }
        },
      },
    ]);
  };

  // ─── Grant Glow Border to User ───
  const handleGrantBorder = async (uid: string, border: string) => {
    try {
      await api.post('/users/grant-badge', { uid, activeBorder: border });
      Alert.alert('Updated', `User profile card style changed to ${border}`);
      loadData();
    } catch (e: any) {
      Alert.alert('Error', 'Failed to update user border');
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>⚡ ADMIN PORTAL</Text>
            <Text style={styles.headerSubtitle}>Academic Arena Control Panel</Text>
          </View>
        </View>

        {/* Tab Navigation Bar */}
        <View style={styles.tabBar}>
          {(['STATS', 'REWARDS', 'QUESTIONS', 'USERS'] as Tab[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tabItem, activeTab === tab && styles.tabItemActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab === 'STATS'
                  ? '📊 STATS'
                  : tab === 'REWARDS'
                  ? '🎁 UPI PAYOUTS'
                  : tab === 'QUESTIONS'
                  ? '❓ QUESTIONS'
                  : '👥 USERS'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Main Content */}
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentInner}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.dark.cyan} />
          }
        >
          {loading ? (
            <ActivityIndicator size="large" color={Colors.dark.cyan} style={{ marginTop: 40 }} />
          ) : activeTab === 'STATS' ? (
            /* 📊 STATS OVERVIEW TAB */
            <View>
              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                  <Text style={styles.statNumber}>{stats?.totalUsers || 0}</Text>
                  <Text style={styles.statLabel}>Total Students</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statNumber}>{stats?.totalRuns || 0}</Text>
                  <Text style={styles.statLabel}>Runs Played</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statNumber}>{stats?.totalQuestions || 0}</Text>
                  <Text style={styles.statLabel}>Question Bank</Text>
                </View>
                <View style={[styles.statCard, { borderColor: '#FFD700' }]}>
                  <Text style={[styles.statNumber, { color: '#FFD700' }]}>{stats?.pendingRewards || 0}</Text>
                  <Text style={styles.statLabel}>Pending Payouts</Text>
                </View>
              </View>

              {/* Weekly Champions Candidate List */}
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>🏆 THIS WEEK'S TOP PLAYERS</Text>
                <BouncyButton onPress={handleTriggerWeekly} style={styles.actionBtnSmall}>
                  <Text style={styles.actionBtnText}>⚡ Trigger Reward</Text>
                </BouncyButton>
              </View>

              {stats?.weeklyCandidates && stats.weeklyCandidates.length > 0 ? (
                stats.weeklyCandidates.map((c) => (
                  <View key={c.uid} style={styles.listItem}>
                    <View style={styles.rankBadge}>
                      <Text style={styles.rankText}>#{c.rank}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.userNameText}>{c.name}</Text>
                      <Text style={styles.userSubText}>
                        UPI: {c.upiId || 'Not set'} | EXP: {c.weeklyEXP}
                      </Text>
                    </View>
                    {c.rank === 1 && (
                      <View style={styles.crownTag}>
                        <Text style={{ color: '#FFD700', fontWeight: 'bold' }}>👑 LEADER</Text>
                      </View>
                    )}
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>No user activity recorded this week yet.</Text>
              )}
            </View>
          ) : activeTab === 'REWARDS' ? (
            /* 🎁 REWARDS & UPI PAYOUTS TAB */
            <View>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>🎁 UPI PAYOUT QUEUE (₹10 WINNERS)</Text>
                <BouncyButton onPress={handleTriggerWeekly} style={styles.actionBtnSmall}>
                  <Text style={styles.actionBtnText}>+ Calculate Winner</Text>
                </BouncyButton>
              </View>

              {rewards.length > 0 ? (
                rewards.map((r) => (
                  <View key={r._id} style={styles.rewardCard}>
                    <View style={styles.rewardHeader}>
                      <Text style={styles.rewardUser}>{r.userName}</Text>
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
                        <Text style={styles.statusText}>{r.status.toUpperCase()}</Text>
                      </View>
                    </View>
                    <Text style={styles.rewardDetail}>Week: {r.weekLabel}</Text>
                    <Text style={styles.rewardDetail}>UPI ID: {r.upiId || '⚠️ Missing UPI ID'}</Text>
                    <Text style={styles.rewardAmount}>Amount: ₹{r.amount}</Text>
                    {r.transactionId ? <Text style={styles.txText}>Ref TX: {r.transactionId}</Text> : null}

                    {r.status === 'pending' && (
                      <View style={styles.rewardActionRow}>
                        <BouncyButton
                          onPress={() => {
                            setSelectedReward(r);
                            setPayoutModalVisible(true);
                          }}
                          style={styles.payBtn}
                        >
                          <Text style={styles.payBtnText}>✅ Mark Paid ₹10</Text>
                        </BouncyButton>
                      </View>
                    )}
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>No reward payout entries yet.</Text>
              )}
            </View>
          ) : activeTab === 'QUESTIONS' ? (
            /* ❓ QUESTIONS MANAGEMENT TAB */
            <View>
              <View style={styles.filterRow}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search questions..."
                  placeholderTextColor="#666"
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
                  style={styles.addBtn}
                >
                  <Text style={styles.addBtnText}>+ Add New</Text>
                </BouncyButton>
              </View>

              {questions.length > 0 ? (
                questions.map((q) => (
                  <View key={q._id} style={styles.questionCard}>
                    <View style={styles.qHeader}>
                      <Text style={styles.qMeta}>
                        CLASS {q.class} | {q.subject} | LVL {q.difficulty}
                      </Text>
                      <View style={styles.qActions}>
                        <TouchableOpacity
                          onPress={() => {
                            setEditingQuestion(q);
                            setQuestionModalVisible(true);
                          }}
                          style={styles.iconBtn}
                        >
                          <Text style={{ color: Colors.dark.cyan }}>✏️</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDeleteQuestion(q._id)} style={styles.iconBtn}>
                          <Text style={{ color: Colors.dark.danger }}>🗑️</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                    <Text style={styles.qText}>{q.question}</Text>
                    {q.options.map((opt, i) => (
                      <Text
                        key={i}
                        style={[styles.qOption, i === q.answer && { color: Colors.dark.success, fontWeight: 'bold' }]}
                      >
                        {String.fromCharCode(65 + i)}. {opt} {i === q.answer ? '✓' : ''}
                      </Text>
                    ))}
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>No questions found.</Text>
              )}
            </View>
          ) : (
            /* 👥 USERS & BADGE GRANTER TAB */
            <View>
              <TextInput
                style={styles.searchInput}
                placeholder="Search user by name or email..."
                placeholderTextColor="#666"
                value={userSearch}
                onChangeText={setUserSearch}
                onSubmitEditing={loadData}
              />

              {users.length > 0 ? (
                users.map((u) => (
                  <View key={u._id} style={styles.userCard}>
                    <View style={styles.userHeader}>
                      <View>
                        <Text style={styles.userNameText}>{u.name}</Text>
                        <Text style={styles.userSubText}>{u.email}</Text>
                        <Text style={styles.userSubText}>
                          Total EXP: {u.totalEXP} | UPI: {u.upiId || 'None'}
                        </Text>
                      </View>
                      <Text style={[styles.roleTag, u.role === 'admin' && styles.adminRoleTag]}>
                        {u.role ? u.role.toUpperCase() : 'USER'}
                      </Text>
                    </View>

                    {/* Grant Glowing Borders */}
                    <Text style={styles.grantTitle}>PROFILE CARD GLOW:</Text>
                    <View style={styles.borderBtnRow}>
                      {(['default', 'glowing_gold', 'neon_cyan', 'fire_ring'] as const).map((border) => (
                        <TouchableOpacity
                          key={border}
                          style={[
                            styles.borderBtn,
                            u.activeBorder === border && styles.borderBtnSelected,
                          ]}
                          onPress={() => handleGrantBorder(u.uid, border)}
                        >
                          <Text style={styles.borderBtnText}>
                            {border === 'glowing_gold'
                              ? '👑 Gold'
                              : border === 'neon_cyan'
                              ? '⚡ Cyan'
                              : border === 'fire_ring'
                              ? '🔥 Fire'
                              : 'Normal'}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>No users found.</Text>
              )}
            </View>
          )}
        </ScrollView>

        {/* ─── Mark Paid Modal ─── */}
        <Modal visible={payoutModalVisible} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>Confirm UPI Payout (₹10)</Text>
              <Text style={styles.modalText}>Winner: {selectedReward?.userName}</Text>
              <Text style={styles.modalText}>UPI ID: {selectedReward?.upiId}</Text>

              <TextInput
                style={styles.modalInput}
                placeholder="Enter Payment Ref / Transaction ID..."
                placeholderTextColor="#666"
                value={txIdInput}
                onChangeText={setTxIdInput}
              />

              <View style={styles.modalBtnRow}>
                <TouchableOpacity
                  onPress={() => setPayoutModalVisible(false)}
                  style={[styles.modalBtn, { backgroundColor: '#333' }]}
                >
                  <Text style={styles.modalBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleConfirmPayout} style={[styles.modalBtn, { backgroundColor: Colors.dark.success }]}>
                  <Text style={styles.modalBtnText}>Confirm Paid</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* ─── Question Create/Edit Modal ─── */}
        <Modal visible={questionModalVisible} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <ScrollView contentContainerStyle={styles.modalBoxLarge}>
              <Text style={styles.modalTitle}>
                {editingQuestion._id ? 'Edit Question' : 'Add New Question'}
              </Text>

              <Text style={styles.fieldLabel}>Question Text:</Text>
              <TextInput
                style={[styles.modalInput, { height: 80 }]}
                multiline
                value={editingQuestion.question}
                onChangeText={(t) => setEditingQuestion({ ...editingQuestion, question: t })}
              />

              <Text style={styles.fieldLabel}>Grade (9 or 10):</Text>
              <TextInput
                style={styles.modalInput}
                keyboardType="numeric"
                value={String(editingQuestion.class || 9)}
                onChangeText={(t) => setEditingQuestion({ ...editingQuestion, class: parseInt(t) || 9 })}
              />

              <Text style={styles.fieldLabel}>Subject:</Text>
              <TextInput
                style={styles.modalInput}
                value={editingQuestion.subject}
                onChangeText={(t) => setEditingQuestion({ ...editingQuestion, subject: t })}
              />

              <Text style={styles.fieldLabel}>Difficulty (1 to 5):</Text>
              <TextInput
                style={styles.modalInput}
                keyboardType="numeric"
                value={String(editingQuestion.difficulty || 1)}
                onChangeText={(t) => setEditingQuestion({ ...editingQuestion, difficulty: parseInt(t) || 1 })}
              />

              <Text style={styles.fieldLabel}>Options (4 choices):</Text>
              {(editingQuestion.options || ['', '', '', '']).map((opt, idx) => (
                <TextInput
                  key={idx}
                  style={styles.modalInput}
                  placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                  placeholderTextColor="#666"
                  value={opt}
                  onChangeText={(t) => {
                    const newOpts = [...(editingQuestion.options || ['', '', '', ''])];
                    newOpts[idx] = t;
                    setEditingQuestion({ ...editingQuestion, options: newOpts });
                  }}
                />
              ))}

              <Text style={styles.fieldLabel}>Correct Answer Index (0=A, 1=B, 2=C, 3=D):</Text>
              <TextInput
                style={styles.modalInput}
                keyboardType="numeric"
                value={String(editingQuestion.answer ?? 0)}
                onChangeText={(t) => setEditingQuestion({ ...editingQuestion, answer: parseInt(t) || 0 })}
              />

              <View style={styles.modalBtnRow}>
                <TouchableOpacity
                  onPress={() => setQuestionModalVisible(false)}
                  style={[styles.modalBtn, { backgroundColor: '#333' }]}
                >
                  <Text style={styles.modalBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSaveQuestion} style={[styles.modalBtn, { backgroundColor: Colors.dark.cyan }]}>
                  <Text style={[styles.modalBtnText, { color: '#000' }]}>Save Question</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </Modal>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  header: {
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: Colors.dark.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  backBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  backBtnText: {
    color: Colors.dark.text,
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.dark.cyan,
  },
  headerSubtitle: {
    fontSize: 12,
    color: Colors.dark.textMuted,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#0F1224',
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  tabItemActive: {
    borderBottomWidth: 3,
    borderBottomColor: Colors.dark.cyan,
  },
  tabText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: Colors.dark.textMuted,
  },
  tabTextActive: {
    color: Colors.dark.cyan,
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: 20,
    paddingBottom: 60,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    width: '47%',
    backgroundColor: Colors.dark.surface,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.dark.cyan,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.dark.textMuted,
    marginTop: 4,
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: Colors.dark.text,
    letterSpacing: 0.5,
  },
  actionBtnSmall: {
    backgroundColor: Colors.dark.cyan,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  actionBtnText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 12,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    gap: 12,
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.dark.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankText: {
    color: Colors.dark.cyan,
    fontWeight: 'bold',
  },
  userNameText: {
    color: Colors.dark.text,
    fontWeight: 'bold',
    fontSize: 15,
  },
  userSubText: {
    color: Colors.dark.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  crownTag: {
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  emptyText: {
    color: Colors.dark.textMuted,
    textAlign: 'center',
    marginTop: 30,
  },
  rewardCard: {
    backgroundColor: Colors.dark.surface,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginBottom: 12,
  },
  rewardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  rewardUser: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.dark.text,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusPending: { backgroundColor: '#FF9900' },
  statusPaid: { backgroundColor: '#00F5A0' },
  statusRejected: { backgroundColor: '#FF2E63' },
  statusText: { fontSize: 10, fontWeight: 'bold', color: '#000' },
  rewardDetail: { color: Colors.dark.textMuted, fontSize: 13, marginTop: 2 },
  rewardAmount: { color: Colors.dark.cyan, fontWeight: 'bold', fontSize: 15, marginTop: 4 },
  txText: { color: '#888', fontSize: 11, marginTop: 2 },
  rewardActionRow: { marginTop: 12 },
  payBtn: {
    backgroundColor: Colors.dark.success,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  payBtnText: { color: '#000', fontWeight: 'bold' },
  filterRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    backgroundColor: Colors.dark.surface,
    color: '#FFF',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginBottom: 16,
  },
  addBtn: {
    backgroundColor: Colors.dark.cyan,
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderRadius: 12,
  },
  addBtnText: { color: '#000', fontWeight: 'bold' },
  questionCard: {
    backgroundColor: Colors.dark.surface,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginBottom: 12,
  },
  qHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  qMeta: { color: Colors.dark.cyan, fontSize: 11, fontWeight: 'bold' },
  qActions: { flexDirection: 'row', gap: 12 },
  iconBtn: { padding: 2 },
  qText: { color: '#FFF', fontSize: 15, fontWeight: '600', marginBottom: 10 },
  qOption: { color: Colors.dark.textMuted, fontSize: 13, marginBottom: 2 },
  userCard: {
    backgroundColor: Colors.dark.surface,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginBottom: 12,
  },
  userHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  roleTag: {
    color: Colors.dark.textMuted,
    fontSize: 10,
    fontWeight: 'bold',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    height: 22,
  },
  adminRoleTag: { color: '#FFD700', backgroundColor: 'rgba(255, 215, 0, 0.2)' },
  grantTitle: { color: Colors.dark.textMuted, fontSize: 11, fontWeight: 'bold', marginTop: 12, marginBottom: 6 },
  borderBtnRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  borderBtn: {
    backgroundColor: Colors.dark.surfaceLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  borderBtnSelected: { borderColor: Colors.dark.cyan, backgroundColor: 'rgba(0, 245, 160, 0.15)' },
  borderBtnText: { color: '#FFF', fontSize: 11, fontWeight: 'bold' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    padding: 20,
  },
  modalBox: {
    backgroundColor: Colors.dark.surface,
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  modalBoxLarge: {
    backgroundColor: Colors.dark.surface,
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginVertical: 40,
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#FFF', marginBottom: 12 },
  modalText: { color: Colors.dark.textMuted, fontSize: 14, marginBottom: 4 },
  modalInput: {
    backgroundColor: '#0F1224',
    color: '#FFF',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginTop: 6,
    marginBottom: 12,
  },
  fieldLabel: { color: Colors.dark.cyan, fontSize: 12, fontWeight: 'bold', marginTop: 8 },
  modalBtnRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  modalBtnText: { color: '#FFF', fontWeight: 'bold' },
});
