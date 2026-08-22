import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, SupabaseService } from './supabaseService';
import { Friend, User, FriendRequest } from '../types';

const FRIENDS_CACHE_PREFIX = 'academic_arena_friends_';
const PENDING_REQUESTS_CACHE_PREFIX = 'academic_arena_pending_requests_';
const SENT_REQUESTS_CACHE_PREFIX = 'academic_arena_sent_requests_';

export class FriendService {
  /**
   * Get all accepted mutual friends for a user
   */
  static async getFriends(firebaseUid: string): Promise<Friend[]> {
    try {
      const cacheKey = `${FRIENDS_CACHE_PREFIX}${firebaseUid}`;
      const raw = await AsyncStorage.getItem(cacheKey);
      let localFriends: Friend[] = raw ? JSON.parse(raw) : [];

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
        } else if (!error && Array.isArray(data) && data.length === 0) {
          localFriends = [];
          await AsyncStorage.setItem(cacheKey, JSON.stringify([]));
        }
      } catch (err) {
        // offline fallback
      }

      return localFriends;
    } catch (e) {
      console.warn('getFriends error:', e);
      return [];
    }
  }

  /**
   * Get pending incoming friend requests for recipient
   */
  static async getPendingRequests(recipientUid: string): Promise<FriendRequest[]> {
    try {
      const cacheKey = `${PENDING_REQUESTS_CACHE_PREFIX}${recipientUid}`;
      const raw = await AsyncStorage.getItem(cacheKey);
      let localRequests: FriendRequest[] = raw ? JSON.parse(raw) : [];

      try {
        const { data, error } = await supabase
          .from('friend_requests')
          .select('*')
          .eq('recipient_uid', recipientUid)
          .eq('status', 'pending')
          .order('created_at', { ascending: false });

        if (!error && Array.isArray(data)) {
          const senderUids = data.map((d: any) => d.sender_uid);
          if (senderUids.length > 0) {
            const { data: senders } = await supabase
              .from('users')
              .select('*')
              .in('firebase_uid', senderUids);

            const senderMap = new Map((senders || []).map((s: any) => [s.firebase_uid, s]));

            localRequests = data.map((r: any) => {
              const sender = senderMap.get(r.sender_uid) || {};
              return {
                id: r.id?.toString() || `${r.sender_uid}_${r.recipient_uid}`,
                senderUid: r.sender_uid,
                senderName: sender.name || 'Classmate',
                senderUsername: sender.username || `@user_${r.sender_uid.slice(-4)}`,
                senderTag: sender.arena_tag || `#AA-${r.sender_uid.slice(-4).toUpperCase()}`,
                senderAvatar: sender.avatar || '🎓',
                senderClass: sender.class || 10,
                senderExp: sender.total_exp || 0,
                recipientUid: r.recipient_uid,
                status: 'pending',
                createdAt: new Date(r.created_at || Date.now()).getTime(),
              };
            });
            await AsyncStorage.setItem(cacheKey, JSON.stringify(localRequests));
          } else {
            localRequests = [];
            await AsyncStorage.setItem(cacheKey, JSON.stringify([]));
          }
        }
      } catch (err) {}

      return localRequests;
    } catch (e) {
      console.warn('getPendingRequests error:', e);
      return [];
    }
  }

  /**
   * Get list of user UIDs to whom the current user has sent a pending request
   */
  static async getSentRequestUids(senderUid: string): Promise<string[]> {
    try {
      const cacheKey = `${SENT_REQUESTS_CACHE_PREFIX}${senderUid}`;
      const raw = await AsyncStorage.getItem(cacheKey);
      let localSent: string[] = raw ? JSON.parse(raw) : [];

      try {
        const { data, error } = await supabase
          .from('friend_requests')
          .select('recipient_uid')
          .eq('sender_uid', senderUid)
          .eq('status', 'pending');

        if (!error && Array.isArray(data)) {
          localSent = data.map((d: any) => d.recipient_uid);
          await AsyncStorage.setItem(cacheKey, JSON.stringify(localSent));
        }
      } catch (e) {}

      return localSent;
    } catch (e) {
      return [];
    }
  }

  /**
   * Send a friend request
   */
  static async sendFriendRequest(
    sender: User | { uid: string; name?: string; username?: string; avatar?: string; class?: number; totalEXP?: number },
    target: User | Friend
  ): Promise<'sent' | 'already_friends' | 'already_requested' | 'error'> {
    try {
      // 1. Check if already friends
      const friends = await this.getFriends(sender.uid);
      if (friends.some((f) => f.uid === target.uid)) {
        return 'already_friends';
      }

      // 2. Check if already sent
      const sentUids = await this.getSentRequestUids(sender.uid);
      if (sentUids.includes(target.uid)) {
        return 'already_requested';
      }

      // 3. Update local sent cache
      const updatedSent = [...sentUids, target.uid];
      await AsyncStorage.setItem(
        `${SENT_REQUESTS_CACHE_PREFIX}${sender.uid}`,
        JSON.stringify(updatedSent)
      );

      // 4. Try Supabase insert
      try {
        await supabase.from('friend_requests').upsert({
          sender_uid: sender.uid,
          recipient_uid: target.uid,
          status: 'pending',
          created_at: new Date().toISOString(),
        });
      } catch (e) {}

      return 'sent';
    } catch (e) {
      console.warn('sendFriendRequest error:', e);
      return 'error';
    }
  }

  /**
   * Accept an incoming friend request
   */
  static async acceptFriendRequest(request: FriendRequest, currentUserUid: string): Promise<boolean> {
    try {
      // 1. Add to mutual friends in Supabase
      try {
        await supabase.from('friends').upsert([
          { user_uid: currentUserUid, friend_uid: request.senderUid },
          { user_uid: request.senderUid, friend_uid: currentUserUid },
        ]);

        await supabase
          .from('friend_requests')
          .update({ status: 'accepted' })
          .match({ sender_uid: request.senderUid, recipient_uid: currentUserUid });
      } catch (e) {}

      // 2. Update local friends cache
      const cacheKey = `${FRIENDS_CACHE_PREFIX}${currentUserUid}`;
      const friends = await this.getFriends(currentUserUid);
      const newFriend: Friend = {
        uid: request.senderUid,
        name: request.senderName,
        username: request.senderUsername,
        arenaTag: request.senderTag,
        class: request.senderClass,
        totalEXP: request.senderExp,
        avatar: request.senderAvatar,
        status: 'online',
        addedAt: Date.now(),
      };
      const updated = [newFriend, ...friends.filter((f) => f.uid !== request.senderUid)];
      await AsyncStorage.setItem(cacheKey, JSON.stringify(updated));

      // 3. Remove from local pending requests cache
      const pendingCacheKey = `${PENDING_REQUESTS_CACHE_PREFIX}${currentUserUid}`;
      const pending = await this.getPendingRequests(currentUserUid);
      const updatedPending = pending.filter((p) => p.senderUid !== request.senderUid);
      await AsyncStorage.setItem(pendingCacheKey, JSON.stringify(updatedPending));

      return true;
    } catch (e) {
      console.warn('acceptFriendRequest error:', e);
      return false;
    }
  }

  /**
   * Decline an incoming friend request
   */
  static async declineFriendRequest(request: FriendRequest, currentUserUid: string): Promise<boolean> {
    try {
      try {
        await supabase
          .from('friend_requests')
          .update({ status: 'declined' })
          .match({ sender_uid: request.senderUid, recipient_uid: currentUserUid });
      } catch (e) {}

      // Update local pending requests cache
      const pendingCacheKey = `${PENDING_REQUESTS_CACHE_PREFIX}${currentUserUid}`;
      const pending = await this.getPendingRequests(currentUserUid);
      const updatedPending = pending.filter((p) => p.senderUid !== request.senderUid);
      await AsyncStorage.setItem(pendingCacheKey, JSON.stringify(updatedPending));

      return true;
    } catch (e) {
      console.warn('declineFriendRequest error:', e);
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

        await supabase
          .from('friends')
          .delete()
          .match({ user_uid: friendUid, friend_uid: currentUserUid });
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
