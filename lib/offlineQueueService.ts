import AsyncStorage from '@react-native-async-storage/async-storage';
import { SupabaseService } from './supabaseService';

export interface OfflineRunPayload {
  runId: string;
  firebaseUid: string;
  classNum: number;
  subject: string;
  mode: 'solo' | 'challenge' | 'crossword' | 'bomb';
  score: number;
  correctAnswers: number;
  questionsAnswered: number;
  expEarned: number;
  maxStreak: number;
  highestDifficulty: number;
  heartsRemaining: number;
  status: string;
  isChallengeWin?: boolean;
  answers?: Array<{ questionId: string; selectedOption: number; timeTakenMs: number }>;
  timestamp: number;
  checksum: string;
}

const OFFLINE_QUEUE_KEY = 'academic_arena_offline_runs_queue';
const OFFLINE_EXP_KEY = 'academic_arena_offline_pending_exp';

function generateChecksum(runId: string, exp: number, timestamp: number): string {
  const raw = `${runId}_${exp}_${timestamp}_arena_secure`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return hash.toString(36);
}

export class OfflineQueueService {
  private static isSyncing = false;

  /**
   * Enqueue a run completed while offline
   */
  static async queueOfflineRun(run: Omit<OfflineRunPayload, 'timestamp' | 'checksum'>): Promise<void> {
    try {
      const timestamp = Date.now();
      const checksum = generateChecksum(run.runId, run.expEarned, timestamp);
      const queuedItem: OfflineRunPayload = {
        ...run,
        timestamp,
        checksum,
      };

      const existingRaw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
      const queue: OfflineRunPayload[] = existingRaw ? JSON.parse(existingRaw) : [];
      queue.push(queuedItem);

      await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));

      // Also track total pending offline EXP
      const pendingExpRaw = await AsyncStorage.getItem(OFFLINE_EXP_KEY);
      const currentPendingExp = pendingExpRaw ? parseInt(pendingExpRaw, 10) : 0;
      await AsyncStorage.setItem(OFFLINE_EXP_KEY, (currentPendingExp + run.expEarned).toString());

      console.log(`[OFFLINE QUEUE] Successfully queued run ${run.runId} (+ ${run.expEarned} EXP)`);
    } catch (e) {
      console.warn('[OFFLINE QUEUE] Failed to queue offline run:', e);
    }
  }

  /**
   * Get list of pending offline runs
   */
  static async getPendingRuns(): Promise<OfflineRunPayload[]> {
    try {
      const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  /**
   * Flush all pending runs to Supabase when back online
   */
  static async flushOfflineQueue(): Promise<{ syncedCount: number; syncedExp: number }> {
    if (this.isSyncing) return { syncedCount: 0, syncedExp: 0 };
    this.isSyncing = true;

    try {
      const queue = await this.getPendingRuns();
      if (queue.length === 0) {
        this.isSyncing = false;
        return { syncedCount: 0, syncedExp: 0 };
      }

      console.log(`[OFFLINE QUEUE] Flushing ${queue.length} pending offline runs to Supabase...`);
      let syncedCount = 0;
      let syncedExp = 0;
      const failedQueue: OfflineRunPayload[] = [];

      for (const item of queue) {
        // Validate checksum
        const validChecksum = generateChecksum(item.runId, item.expEarned, item.timestamp);
        if (item.checksum !== validChecksum) {
          console.warn(`[OFFLINE QUEUE] Checksum mismatch on run ${item.runId}, skipping.`);
          continue;
        }

        try {
          const success = await SupabaseService.recordCompletedRun({
            firebaseUid: item.firebaseUid,
            runId: item.runId,
            classNum: item.classNum,
            subject: item.subject,
            mode: item.mode,
            score: item.score,
            correctAnswers: item.correctAnswers,
            questionsAnswered: item.questionsAnswered,
            expEarned: item.expEarned,
            maxStreak: item.maxStreak,
            highestDifficulty: item.highestDifficulty,
            heartsRemaining: item.heartsRemaining,
            status: item.status as any,
            isChallengeWin: item.isChallengeWin,
            answers: item.answers,
          });

          if (success) {
            syncedCount++;
            syncedExp += item.expEarned;
          } else {
            failedQueue.push(item);
          }
        } catch (err) {
          console.warn(`[OFFLINE QUEUE] Failed to sync run ${item.runId}: `, err);
          failedQueue.push(item);
        }
      }

      await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(failedQueue));
      if (failedQueue.length === 0) {
        await AsyncStorage.removeItem(OFFLINE_EXP_KEY);
      }

      console.log(`[OFFLINE QUEUE] Sync complete. ${syncedCount} runs synced (+ ${syncedExp} EXP)`);
      this.isSyncing = false;
      return { syncedCount, syncedExp };
    } catch (e) {
      console.warn('[OFFLINE QUEUE] Flush failed:', e);
      this.isSyncing = false;
      return { syncedCount: 0, syncedExp: 0 };
    }
  }
}
