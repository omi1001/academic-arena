import { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Colors } from '../../constants/theme';
import { LEADERBOARD_TIERS } from '../../constants/config';
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

  useEffect(() => {
    fetchLeaderboard();
  }, []);

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

  const renderItem = ({ item }: { item: LeaderboardEntry }) => {
    const tier = getTier(item.totalEXP);
    const isTop3 = item.rank <= 3;

    return (
      <View style={styles.row}>
        <Text
          style={[
            styles.rank,
            isTop3 && styles.rankTop3,
            item.rank === 1 && { color: Colors.dark.gold },
            item.rank === 2 && { color: Colors.dark.silver },
            item.rank === 3 && { color: Colors.dark.bronze },
          ]}
        >
          {item.rank}
        </Text>

        <View style={styles.userInfo}>
          <Text
            style={[
              styles.userName,
              isTop3 && styles.userNameTop3,
              item.rank === 1 && { color: Colors.dark.gold },
            ]}
          >
            {item.name}
          </Text>
          <View style={styles.tierRow}>
            <View style={[styles.tierDot, { backgroundColor: tier.color }]} />
            <Text style={[styles.tierLabel, { color: tier.color }]}>
              {tier.name}
            </Text>
          </View>
        </View>

        <Text style={styles.exp}>{item.totalEXP.toLocaleString()} EXP</Text>
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
      <Text style={styles.title}>Leaderboard</Text>
      <FlatList
        data={data}
        keyExtractor={(item) => item.uid}
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
          <Text style={styles.empty}>
            No players yet. Be the first!
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    paddingTop: 60,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.dark.background,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.dark.text,
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  list: {
    paddingHorizontal: 24,
    paddingBottom: 100,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  rank: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.dark.textMuted,
    width: 36,
    textAlign: 'center',
  },
  rankTop3: {
    fontSize: 22,
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  userNameTop3: {
    fontSize: 18,
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
  exp: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.primary,
  },
  empty: {
    textAlign: 'center',
    color: Colors.dark.textMuted,
    marginTop: 60,
    fontSize: 16,
  },
});
