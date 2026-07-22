import { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Gradients } from '../../constants/theme';
import { LEADERBOARD_TIERS } from '../../constants/config';
import { useAuthStore } from '../../stores/authStore';
import { useUserStore } from '../../stores/userStore';
import api from '../../lib/api';

interface LeaderboardEntry {
  rank: number;
  uid: string;
  name: string;
  totalEXP: number;
}

export default function LeaderboardScreen() {
  const [data, setData] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const { firebaseUser } = useAuthStore();
  const { profile } = useUserStore();

  const fetchLeaderboard = async () => {
    try {
      const res = await api.get('/leaderboard');
      setData(res.data);
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
    }, [])
  );

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

  // Top 3 Podium
  const top1 = data.find((d) => d.rank === 1);
  const top2 = data.find((d) => d.rank === 2);
  const top3 = data.find((d) => d.rank === 3);

  const renderHeader = () => {
    if (data.length === 0) return null;

    return (
      <View style={styles.podiumSection}>
        {/* 2nd Place (Left) */}
        {top2 ? (
          <View style={[styles.podiumCard, styles.podiumCard2]}>
            <View style={[styles.podiumAvatar, { borderColor: Colors.dark.silver }]}>
              <Text style={styles.podiumAvatarText}>
                {top2.name[0]?.toUpperCase() || 'P'}
              </Text>
            </View>

            <Text style={styles.podiumMedal}>🥈</Text>
            <Text style={styles.podiumName} numberOfLines={1}>
              {top2.name}
            </Text>
            <Text style={styles.podiumExp}>{top2.totalEXP.toLocaleString()} EXP</Text>
          </View>
        ) : (
          <View style={styles.podiumCardPlaceholder} />
        )}

        {/* 1st Place (Center - Elevated) */}
        {top1 && (
          <LinearGradient
            colors={['#2A2206', '#141829']}
            style={[styles.podiumCard, styles.podiumCard1]}
          >
            <View style={[styles.podiumAvatar, { borderColor: Colors.dark.gold, width: 56, height: 56 }]}>
              <Text style={[styles.podiumAvatarText, { fontSize: 24 }]}>
                {top1.name[0]?.toUpperCase() || 'P'}
              </Text>
            </View>

            <Text style={[styles.podiumMedal, { fontSize: 26 }]}>👑 🥇</Text>
            <Text style={[styles.podiumName, { fontSize: 16, fontWeight: 'bold' }]} numberOfLines={1}>
              {top1.name}
            </Text>
            <Text style={[styles.podiumExp, { color: Colors.dark.gold }]}>
              {top1.totalEXP.toLocaleString()} EXP
            </Text>
          </LinearGradient>
        )}

        {/* 3rd Place (Right) */}
        {top3 ? (
          <View style={[styles.podiumCard, styles.podiumCard3]}>
            <View style={[styles.podiumAvatar, { borderColor: Colors.dark.bronze }]}>
              <Text style={styles.podiumAvatarText}>
                {top3.name[0]?.toUpperCase() || 'P'}
              </Text>
            </View>

            <Text style={styles.podiumMedal}>🥉</Text>
            <Text style={styles.podiumName} numberOfLines={1}>
              {top3.name}
            </Text>
            <Text style={styles.podiumExp}>{top3.totalEXP.toLocaleString()} EXP</Text>
          </View>
        ) : (
          <View style={styles.podiumCardPlaceholder} />
        )}
      </View>
    );
  };

  const renderItem = ({ item }: { item: LeaderboardEntry }) => {
    const tier = getTier(item.totalEXP);
    const isTop3 = item.rank <= 3;
    const isCurrentUser = firebaseUser && item.uid === firebaseUser.uid;
    const displayName =
      (isCurrentUser ? (profile?.name || firebaseUser.displayName) : item.name) || 'Player';

    return (
      <View
        style={[
          styles.row,
          isCurrentUser && styles.currentUserRow,
          isTop3 && styles.top3Row,
        ]}
      >
        <Text
          style={[
            styles.rankText,
            item.rank === 1 && { color: Colors.dark.gold },
            item.rank === 2 && { color: Colors.dark.silver },
            item.rank === 3 && { color: Colors.dark.bronze },
          ]}
        >
          #{item.rank}
        </Text>

        <View style={styles.userInfo}>
          <View style={styles.nameRow}>
            <Text
              style={[
                styles.userName,
                isCurrentUser && { color: Colors.dark.primary, fontWeight: 'bold' },
              ]}
            >
              {displayName}
            </Text>
            {isCurrentUser && (
              <View style={styles.youBadge}>
                <Text style={styles.youBadgeText}>YOU</Text>
              </View>
            )}
          </View>

          <View style={styles.tierRow}>
            <View style={[styles.tierDot, { backgroundColor: tier.color }]} />
            <Text style={[styles.tierLabel, { color: tier.color }]}>
              {tier.name}
            </Text>
          </View>
        </View>

        <View style={styles.expPill}>
          <Text style={styles.expText}>{item.totalEXP.toLocaleString()} EXP</Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.dark.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>ARENA LEADERBOARD</Text>
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
            tintColor={Colors.dark.primary}
          />
        }
        ListEmptyComponent={
          <Text style={styles.empty}>No arena runners yet. Be the first!</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    paddingTop: 56,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.dark.background,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.dark.text,
    paddingHorizontal: 20,
    marginBottom: 16,
    letterSpacing: 1,
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 110,
  },
  podiumSection: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 24,
    marginTop: 8,
  },
  podiumCard: {
    flex: 1,
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    padding: 14,
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
    marginBottom: 12,
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
  podiumAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.dark.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    marginBottom: 6,
  },
  podiumAvatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.dark.text,
  },
  podiumMedal: {
    fontSize: 18,
    marginBottom: 4,
  },
  podiumName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: Colors.dark.text,
    textAlign: 'center',
    marginBottom: 2,
  },
  podiumExp: {
    fontSize: 11,
    color: Colors.dark.cyan,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
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
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.dark.textMuted,
    width: 36,
    textAlign: 'center',
  },
  userInfo: {
    flex: 1,
    marginLeft: 10,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  youBadge: {
    backgroundColor: Colors.dark.primary,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  youBadgeText: {
    color: '#FFF',
    fontSize: 9,
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
    fontSize: 11,
    fontWeight: '600',
  },
  expPill: {
    backgroundColor: 'rgba(5, 213, 230, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.dark.cyan,
  },
  expText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.dark.cyan,
  },
  empty: {
    textAlign: 'center',
    color: Colors.dark.textMuted,
    marginTop: 60,
    fontSize: 15,
  },
});
