import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../../constants/theme';
import { LEADERBOARD_TIERS } from '../../constants/config';
import { useAuthStore } from '../../stores/authStore';
import { useUserStore } from '../../stores/userStore';
import { useThemeStore } from '../../stores/themeStore';
import { ThemedBackground } from '../../components/ThemedBackground';
import api from '../../lib/api';
import { SupabaseService } from '../../lib/supabaseService';
import { GlowingProfileCard } from '../../components/GlowingProfileCard';
import { soundManager } from '../../lib/soundManager';

type LeaderboardTab = 'weekly' | 'total' | 'challenge';

interface LeaderboardEntry {
  rank: number;
  uid: string;
  name: string;
  exp: number;
  weeklyEXP?: number;
  totalEXP?: number;
  highestChallengeDifficulty?: number;
  challengeWins?: number;
  challengeLosses?: number;
  challengeGamesPlayed?: number;
  activeBorder?: 'default' | 'glowing_gold' | 'neon_cyan' | 'fire_ring';
  badges?: string[];
  avatar?: string;
}

export default function LeaderboardScreen() {
  const [tab, setTab] = useState<LeaderboardTab>('weekly');
  const [data, setData] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const { firebaseUser } = useAuthStore();
  const { profile } = useUserStore();
  const { getColors, mode } = useThemeStore();
  const colors = getColors();

  const fetchLeaderboard = async () => {
    try {
      const typeParam = tab === 'weekly' ? 'weekly' : tab === 'challenge' ? 'challenge' : 'all_time';
      const list = await SupabaseService.getLeaderboard(typeParam);
      if (list && list.length > 0) {
        setData(
          list.map((item) => ({
            rank: item.rank,
            uid: item.firebase_uid,
            name: item.name,
            displayName: item.name,
            exp: item.score,
            totalEXP: item.score,
            weeklyEXP: item.score,
            challengeWins: item.score,
            avatar: item.avatar,
            gamesPlayed: item.games_played,
          })) as any
        );
      } else {
        const res = await api.get('/leaderboard', {
          params: { type: tab },
        });
        setData(res.data || []);
      }
    } catch (e) {
      console.warn('Failed to fetch leaderboard:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchLeaderboard();
      soundManager.resumeBgm();
    }, [tab])
  );

  useEffect(() => {
    setLoading(true);
    fetchLeaderboard();
  }, [tab]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchLeaderboard();
  };

  const getTier = (exp: number) => {
    if (exp >= LEADERBOARD_TIERS.DIAMOND.minEXP) return LEADERBOARD_TIERS.DIAMOND;
    if (exp >= LEADERBOARD_TIERS.GOLD.minEXP) return LEADERBOARD_TIERS.GOLD;
    if (exp >= LEADERBOARD_TIERS.SILVER.minEXP) return LEADERBOARD_TIERS.SILVER;
    return LEADERBOARD_TIERS.BRONZE;
  };

  const top1 = data.find((d) => d.rank === 1);
  const top2 = data.find((d) => d.rank === 2);
  const top3 = data.find((d) => d.rank === 3);

  const renderHeader = () => {
    return (
      <View>
        {/* Info Banner */}
        <View style={[styles.bannerContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.bannerTitle, { color: colors.primary }]}>
            {tab === 'weekly'
              ? '⚡ FRESH WEEKLY ₹10 UPI ARENA'
              : tab === 'total'
                ? '🏆 ALL-TIME HALL OF FAME'
                : '⚔️ 1v1 BOT SLAYERS'}
          </Text>
          <Text style={[styles.bannerSubtitle, { color: colors.textMuted }]}>
            {tab === 'weekly'
              ? 'Resets every Sunday midnight! Rank #1 grinder gets ₹10 real cash via UPI. No excuses, start cooking!'
              : tab === 'total'
                ? 'The ultimate try-hards who forgot what sleep is and farmed maximum lifetime EXP.'
                : 'Ranked by total adaptive AI bots demolished and highest difficulty levels cleared!'}
          </Text>
        </View>

        {/* Podium Section */}
        {data.length > 0 && (
          <View style={styles.podiumSection}>
            {/* 2nd Place (Left) */}
            {top2 ? (
              <View style={[styles.podiumCard, styles.podiumCard2, { backgroundColor: colors.cardBg || colors.surface, borderColor: Colors.dark.silver }]}>
                <GlowingProfileCard
                  name={top2.name}
                  initial={top2.name[0]?.toUpperCase() || 'P'}
                  avatar={top2.avatar}
                  activeBorder={top2.activeBorder || 'default'}
                  badges={top2.badges}
                  size="sm"
                />

                <Text style={styles.podiumMedal}>🥈</Text>
                <Text style={[styles.podiumName, { color: colors.text }]} numberOfLines={1}>
                  {top2.name}
                </Text>
                <Text style={[styles.podiumExp, { color: colors.textMuted }]}>
                  {tab === 'challenge'
                    ? `Lv.${top2.highestChallengeDifficulty || 1} Bot • ${top2.challengeWins || 0}W`
                    : `${(top2.exp || 0).toLocaleString()} EXP`}
                </Text>
              </View>
            ) : (
              <View style={styles.podiumCardPlaceholder} />
            )}

            {/* 1st Place (Center - Elevated) */}
            {top1 && (
              <LinearGradient
                colors={mode === 'dark' ? ['#2A2206', '#141829'] : ['#FFFDF0', '#FFF3C4']}
                style={[styles.podiumCard, styles.podiumCard1, { borderColor: Colors.dark.gold }]}
              >
                <GlowingProfileCard
                  name={top1.name}
                  initial={top1.name[0]?.toUpperCase() || 'P'}
                  avatar={top1.avatar}
                  activeBorder={top1.activeBorder || 'glowing_gold'}
                  badges={top1.badges || ['WEEKLY_CHAMPION_GOLD']}
                  size="lg"
                />

                <Text style={[styles.podiumMedal, { fontSize: 24, marginTop: 4 }]}>👑 🥇</Text>
                <Text style={[styles.podiumName, { fontSize: 16, fontWeight: 'bold', color: colors.text }]} numberOfLines={1}>
                  {top1.name}
                </Text>
                <Text style={[styles.podiumExp, { color: mode === 'dark' ? Colors.dark.gold : '#B45309' }]}>
                  {tab === 'challenge'
                    ? `Lv.${top1.highestChallengeDifficulty || 1} Bot • ${top1.challengeWins || 0} Wins`
                    : `${(top1.exp || 0).toLocaleString()} EXP`}
                </Text>
              </LinearGradient>
            )}

            {/* 3rd Place (Right) */}
            {top3 ? (
              <View style={[styles.podiumCard, styles.podiumCard3, { backgroundColor: colors.cardBg || colors.surface, borderColor: Colors.dark.bronze }]}>
                <GlowingProfileCard
                  name={top3.name}
                  initial={top3.name[0]?.toUpperCase() || 'P'}
                  avatar={top3.avatar}
                  activeBorder={top3.activeBorder || 'default'}
                  badges={top3.badges}
                  size="sm"
                />

                <Text style={styles.podiumMedal}>🥉</Text>
                <Text style={[styles.podiumName, { color: colors.text }]} numberOfLines={1}>
                  {top3.name}
                </Text>
                <Text style={[styles.podiumExp, { color: colors.textMuted }]}>
                  {tab === 'challenge'
                    ? `Lv.${top3.highestChallengeDifficulty || 1} Bot • ${top3.challengeWins || 0}W`
                    : `${(top3.exp || 0).toLocaleString()} EXP`}
                </Text>
              </View>
            ) : (
              <View style={styles.podiumCardPlaceholder} />
            )}
          </View>
        )}
      </View>
    );
  };

  const renderItem = ({ item }: { item: LeaderboardEntry }) => {
    const tier = getTier(item.exp || 0);
    const isTop3 = item.rank <= 3;
    const isCurrentUser = firebaseUser && item.uid === firebaseUser.uid;
    const displayName =
      (isCurrentUser ? (profile?.name || firebaseUser.displayName) : item.name) || 'Player';
    const displayAvatar = isCurrentUser ? (profile?.avatar || item.avatar) : item.avatar;
    const displayBorder = isCurrentUser ? (profile?.activeBorder || item.activeBorder) : item.activeBorder;

    return (
      <View
        style={[
          styles.row,
          { backgroundColor: colors.cardBg || colors.surface, borderColor: colors.border },
          isCurrentUser && [styles.currentUserRow, { borderColor: colors.primary }],
        ]}
      >
        <Text
          style={[
            styles.rankText,
            item.rank === 1 && { color: Colors.dark.gold },
            item.rank === 2 && { color: Colors.dark.silver },
            item.rank === 3 && { color: Colors.dark.bronze },
            item.rank > 3 && { color: colors.textMuted },
          ]}
        >
          #{item.rank}
        </Text>

        <View style={styles.avatarMiniWrap}>
          <GlowingProfileCard
            name={displayName}
            initial={displayName[0]?.toUpperCase() || 'P'}
            avatar={displayAvatar}
            activeBorder={displayBorder || 'default'}
            badges={item.badges}
            size="sm"
          />
        </View>

        <View style={styles.userInfo}>
          <View style={styles.nameRow}>
            <Text
              style={[
                styles.userName,
                { color: colors.text },
                isCurrentUser && { color: colors.primary, fontWeight: 'bold' },
              ]}
              numberOfLines={1}
            >
              {displayName}
            </Text>
            {isCurrentUser && (
              <View style={[styles.youBadge, { backgroundColor: colors.primary }]}>
                <Text style={styles.youBadgeText}>YOU</Text>
              </View>
            )}
          </View>

          <View style={styles.tierRow}>
            {tab === 'challenge' ? (
              <Text style={{ color: colors.primary, fontSize: 11, fontWeight: 'bold' }}>
                🤖 Lv.{item.highestChallengeDifficulty || 1} Bot
              </Text>
            ) : (
              <>
                <View style={[styles.tierDot, { backgroundColor: tier.color }]} />
                <Text style={[styles.tierLabel, { color: tier.color }]}>
                  {tier.name}
                </Text>
              </>
            )}
          </View>
        </View>

        <View style={[styles.expPill, { backgroundColor: colors.surface, borderColor: colors.primary }]}>
          <Text style={[styles.expText, { color: colors.primary }]}>
            {tab === 'challenge'
              ? `${item.challengeWins || 0}W / ${item.challengeLosses || 0}L`
              : tab === 'weekly'
                ? `${(item.exp || 0).toLocaleString()} W-EXP`
                : `${(item.exp || 0).toLocaleString()} EXP`}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <ThemedBackground>
      <View style={styles.container}>
        <Text style={[styles.title, { color: colors.text }]}>ARENA LEADERBOARD</Text>

        {/* Tab Switcher */}
        <View style={[styles.tabContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.tabButton, tab === 'weekly' && [styles.tabButtonActive, { backgroundColor: colors.primary }]]}
            onPress={() => setTab('weekly')}
          >
            <Text style={[styles.tabButtonText, { color: colors.textMuted }, tab === 'weekly' && styles.tabButtonTextActive]}>
              ⚡ WEEKLY ₹10
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, tab === 'total' && [styles.tabButtonActive, { backgroundColor: colors.primary }]]}
            onPress={() => setTab('total')}
          >
            <Text style={[styles.tabButtonText, { color: colors.textMuted }, tab === 'total' && styles.tabButtonTextActive]}>
              🏆 ALL-TIME
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, tab === 'challenge' && [styles.tabButtonActive, { backgroundColor: colors.primary }]]}
            onPress={() => setTab('challenge')}
          >
            <Text style={[styles.tabButtonText, { color: colors.textMuted }, tab === 'challenge' && styles.tabButtonTextActive]}>
              ⚔️ 1v1 BOT DUELS
            </Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={data}
            keyExtractor={(item) => item.uid}
            ListHeaderComponent={renderHeader}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
              />
            }
            ListEmptyComponent={
              <Text style={[styles.empty, { color: colors.textMuted }]}>
                {tab === 'weekly'
                  ? 'No weekly arena points yet this week. Play a game run to claim rank #1!'
                  : 'No arena runners registered yet.'}
              </Text>
            }
          />
        )}
      </View>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingTop: 56,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.dark.text,
    paddingHorizontal: 20,
    marginBottom: 12,
    letterSpacing: 1,
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabButtonActive: {
    backgroundColor: Colors.dark.primary,
  },
  tabButtonText: {
    color: Colors.dark.textMuted,
    fontSize: 13,
    fontWeight: 'bold',
  },
  tabButtonTextActive: {
    color: '#FFF',
  },
  bannerContainer: {
    backgroundColor: 'rgba(5, 213, 230, 0.08)',
    borderWidth: 1,
    borderColor: Colors.dark.cyan,
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
  },
  bannerTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.dark.cyan,
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  bannerSubtitle: {
    fontSize: 10,
    color: Colors.dark.textMuted,
    lineHeight: 14,
  },
  list: {
    paddingHorizontal: 14,
    paddingBottom: 90,
  },
  podiumSection: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
    marginTop: 2,
  },
  podiumCard: {
    flex: 1,
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  podiumCard1: {
    borderColor: Colors.dark.gold,
    elevation: 8,
    shadowColor: Colors.dark.gold,
    shadowRadius: 10,
    shadowOpacity: 0.3,
    marginBottom: 10,
  },
  podiumCard2: {
    borderColor: Colors.dark.silver,
  },
  podiumCard3: {
    borderColor: Colors.dark.bronze,
  },
  podiumCardPlaceholder: {
    flex: 1,
  },
  podiumMedal: {
    fontSize: 16,
    marginBottom: 2,
  },
  podiumName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.dark.text,
    textAlign: 'center',
    marginBottom: 2,
  },
  podiumExp: {
    fontSize: 10,
    color: Colors.dark.cyan,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  top3Row: {
    backgroundColor: Colors.dark.surfaceLight,
  },
  currentUserRow: {
    borderColor: Colors.dark.primary,
    borderWidth: 1.5,
    backgroundColor: 'rgba(255, 42, 109, 0.1)',
  },
  rankText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: Colors.dark.textMuted,
    width: 28,
    textAlign: 'center',
  },
  avatarMiniWrap: {
    marginRight: 8,
  },
  userInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  userName: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.dark.text,
    maxWidth: 130,
  },
  youBadge: {
    backgroundColor: Colors.dark.primary,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  youBadgeText: {
    color: '#FFF',
    fontSize: 8,
    fontWeight: 'bold',
  },
  tierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  tierDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  tierLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  expPill: {
    backgroundColor: 'rgba(5, 213, 230, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.dark.cyan,
  },
  expText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: Colors.dark.cyan,
  },
  empty: {
    textAlign: 'center',
    color: Colors.dark.textMuted,
    marginTop: 60,
    fontSize: 14,
  },
});
