import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Configure foreground notification behavior safely
try {
  if (Notifications && typeof Notifications.setNotificationHandler === 'function') {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  }
} catch (e) {
  console.warn('[NOTIFICATIONS] Handler init skipped:', e);
}

export interface SarcasticNotificationPrompt {
  title: string;
  body: string;
}

export const SARCASTIC_NOTIFICATION_VAULT: SarcasticNotificationPrompt[] = [
  {
    title: '👀 Sharma ji ka beta is grinding...',
    body: 'While you were scrolling reels, he solved 15 Math questions. Time to defend your family honor in the Arena! ⚔️',
  },
  {
    title: '☕ Mitochondria Check-in!',
    body: 'Your brain battery is running on 1%. Come recharge it with 5 quick Science questions before your mom asks about marks. ⚡',
  },
  {
    title: '🍕 Fresh Delivery for Your Brain Cells!',
    body: 'Hot, piping-hot MCQs just arrived at your doorstep. Zero calories, 100% brain gains. Play a quick 2-minute run! 😋',
  },
  {
    title: '🤫 Quick, pretend to study!',
    body: 'Open Academic Arena right now so it looks like you are actively studying when someone enters your room! 📖',
  },
  {
    title: '🤖 A Bot called you a Backbencher!',
    body: 'SharmaJi_Bot is flexing in the 1v1 arena. Jump into a Challenge match and show that computer who has real IQ! 💥',
  },
  {
    title: '💸 Free ₹10 UPI Cash Alert!',
    body: 'Sunday midnight is approaching. Rank #1 gets real cash. Do not let someone else steal your samosa money! 🏆',
  },
  {
    title: '⚠️ 404: Formula Not Found',
    body: 'Did you forget the quadratic formula again? Quick 2-minute speedrun to save you from exam panic! 🧠',
  },
  {
    title: '🔥 Bro thought he could skip today...',
    body: 'Your daily study streak is crying in the corner. Answer 5 questions to keep the flame alive! 🏃‍♂️',
  },
  {
    title: '🎯 200 IQ Demon Spotted!',
    body: 'Someone just got a 10x streak in Class 10 Science. Can you beat their high score? Jump in! 🚀',
  },
  {
    title: '🍔 Swiggy of Knowledge is here!',
    body: 'Your order of [10 Fresh MCQs + Extra Sarcasm] is ready for pickup in the Arena. Tap to feast! 🍟',
  },
  {
    title: '🥱 Waking up your sleeping neurons...',
    body: 'Even your calculator is judging your calculation speed. Warm up with a rapid-fire Math round! 🔢',
  },
  {
    title: '👑 Coronation Pending...',
    body: 'The Weekly Leaderboard podium is missing a king. Will it be you or the backbencher? Find out now! 🥇',
  },
];

const NOTIFICATION_STORAGE_KEY = 'academic_arena_notifications_scheduled';

export class NotificationService {
  private static isInitialized = false;

  /**
   * Request permissions and create Android notification channel
   */
  static async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;

    try {
      if (!Notifications || typeof Notifications.getPermissionsAsync !== 'function') {
        console.log('[NOTIFICATIONS] Native module not linked in current binary, skipping.');
        return false;
      }

      if (Platform.OS === 'android' && typeof Notifications.setNotificationChannelAsync === 'function') {
        await Notifications.setNotificationChannelAsync('academic-arena-reminders', {
          name: 'Arena Brain Quests',
          description: 'Sarcastic & motivating quiz reminders every 3-4 hours',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#00F0FF',
          sound: 'default',
          enableVibrate: true,
          showBadge: true,
        });
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted' && typeof Notifications.requestPermissionsAsync === 'function') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus === 'granted') {
        this.isInitialized = true;
        // Schedule the 3-4 hour recurring sequence
        await this.scheduleRollingSarcasticReminders();
        return true;
      }

      return false;
    } catch (e) {
      console.warn('[NOTIFICATIONS] Failed to initialize notifications:', e);
      return false;
    }
  }

  /**
   * Schedules a rolling queue of sarcastic notifications every 3.5 hours
   */
  static async scheduleRollingSarcasticReminders(): Promise<void> {
    try {
      if (!Notifications || typeof Notifications.scheduleNotificationAsync !== 'function') {
        return;
      }

      // Cancel previous scheduled notifications to avoid duplicates
      if (typeof Notifications.cancelAllScheduledNotificationsAsync === 'function') {
        await Notifications.cancelAllScheduledNotificationsAsync();
      }

      // Intervals in seconds: 3.5 hours, 7 hours, 10.5 hours, 14 hours, 18 hours, 22 hours, 26 hours
      const intervalsHours = [3.5, 7, 10.5, 14, 18, 22, 26, 30];

      // Shuffle quotes
      const shuffled = [...SARCASTIC_NOTIFICATION_VAULT].sort(() => Math.random() - 0.5);

      for (let i = 0; i < intervalsHours.length; i++) {
        const hours = intervalsHours[i];
        const seconds = Math.round(hours * 3600);
        const quote = shuffled[i % shuffled.length];

        await Notifications.scheduleNotificationAsync({
          content: {
            title: quote.title,
            body: quote.body,
            data: { screen: 'home', type: 'sarcastic_reminder' },
            sound: true,
            priority: Notifications.AndroidNotificationPriority.HIGH,
            color: '#00F0FF',
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds,
            repeats: false,
          },
        });
      }

      await AsyncStorage.setItem(NOTIFICATION_STORAGE_KEY, Date.now().toString());
      console.log('[NOTIFICATIONS] Successfully scheduled 8 staggered sarcastic reminders every 3.5 hours!');
    } catch (e) {
      console.warn('[NOTIFICATIONS] Error scheduling sarcastic reminders:', e);
    }
  }

  /**
   * Send an immediate test notification in 2 seconds (for instant verification)
   */
  static async sendTestNotification(): Promise<void> {
    try {
      if (!Notifications || typeof Notifications.scheduleNotificationAsync !== 'function') {
        console.warn('[NOTIFICATIONS] Native module unavailable');
        return;
      }

      const quote = SARCASTIC_NOTIFICATION_VAULT[Math.floor(Math.random() * SARCASTIC_NOTIFICATION_VAULT.length)];
      await Notifications.scheduleNotificationAsync({
        content: {
          title: quote.title,
          body: quote.body,
          data: { screen: 'home', type: 'test' },
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
          color: '#00F0FF',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: 2,
          repeats: false,
        },
      });
      console.log('[NOTIFICATIONS] Test notification dispatched in 2s!');
    } catch (e) {
      console.warn('[NOTIFICATIONS] Test notification failed:', e);
    }
  }
}
