import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, SupabaseService } from './supabaseService';
import { Friend, User } from '../types';

const FRIENDS_CACHE_PREFIX = 'academic_arena_friends_';

export class FriendService {
  /**
   * Get all friends for a user
   */
  static async getFriends(firebaseUid: string): Promise<Friend[]> {
    try {
      // 1. Check local storage cache for 0ms render
      const cacheKey = `${FRIENDS_CACHE_PREFIX}${firebaseUid}`;
      const raw = await AsyncStorage.getItem(cacheKey);
      let localFriends: Friend[] = raw ? JSON.parse(raw) : [];

      // 2. Try Supabase friends table sync if online
      try {
        const { data, error } = await supabase
          .from('friends')
          .select('friend_uid, created_at')
          .eq('user_uid', firebaseUid);

        if (!error && Array.isArray(data) && data.length > 0) {
          const friendUids = data.map((d: any) => d.friend_uid);
          const { data: usersData } = await supabase
            .from('users')
            .select('*')
            .in('firebase_uid', friendUids);

          if (usersData) {
            localFriends = usersData.map((u: any) => ({
              uid: u.firebase_uid,
              name: u.name || 'Classmate',
              username: u.username || `@user_${u.firebase_uid.slice(-4)}`,
              arenaTag: u.arena_tag || `#AA-${u.firebase_uid.slice(-4).toUpperCase()}`,
              class: u.class || 10,
              totalEXP: u.total_exp || 0,
              avatar: u.avatar || '🎓',
              status: 'online',
              addedAt: Date.now(),
            }));
            await AsyncStorage.setItem(cacheKey, JSON.stringify(localFriends));
          }
        }
      } catch (err) {
        // Supabase sync fallback
      }

      return localFriends;
    } catch (e) {
      console.warn('getFriends error:', e);
      return [];
    }
  }

  /**
   * Add a friend by their profile
   */
  static async addFriend(currentUserUid: string, targetUser: User | Friend): Promise<boolean> {
    try {
      const cacheKey = `${FRIENDS_CACHE_PREFIX}${currentUserUid}`;
      const friends = await this.getFriends(currentUserUid);

      const alreadyExists = friends.some((f) => f.uid === targetUser.uid);
      if (alreadyExists) return true;

      const newFriend: Friend = {
        uid: targetUser.uid,
        name: targetUser.name || 'Classmate',
        username: targetUser.username || `@user_${targetUser.uid.slice(-4)}`,
        arenaTag: targetUser.arenaTag || `#AA-${targetUser.uid.slice(-4).toUpperCase()}`,
        class: typeof targetUser.class === 'number' ? targetUser.class : 10,
        totalEXP: targetUser.totalEXP || 0,
        avatar: targetUser.avatar || '🎓',
        status: 'online',
        addedAt: Date.now(),
      };

      const updated = [newFriend, ...friends];
      await AsyncStorage.setItem(cacheKey, JSON.stringify(updated));

      // Try Supabase insert
      try {
        await supabase.from('friends').insert([
          { user_uid: currentUserUid, friend_uid: targetUser.uid },
          { user_uid: targetUser.uid, friend_uid: currentUserUid },
        ]);
      } catch (e) {}

      return true;
    } catch (e) {
      console.warn('addFriend error:', e);
      return false;
    }
  }

  /**
   * Remove a friend
   */
  static async removeFriend(currentUserUid: string, friendUid: string): Promise<boolean> {
    try {
      const cacheKey = `${FRIENDS_CACHE_PREFIX}${currentUserUid}`;
      const friends = await this.getFriends(currentUserUid);
      const filtered = friends.filter((f) => f.uid !== friendUid);
      await AsyncStorage.setItem(cacheKey, JSON.stringify(filtered));

      try {
        await supabase
          .from('friends')
          .delete()
          .match({ user_uid: currentUserUid, friend_uid: friendUid });
      } catch (e) {}

      return true;
    } catch (e) {
      console.warn('removeFriend error:', e);
      return false;
    }
  }

  /**
   * Search for players by name, handle (@...), or Arena Tag (#AA-...)
   */
  static async searchPlayers(query: string): Promise<User[]> {
    return SupabaseService.searchUsers(query);
  }
}
