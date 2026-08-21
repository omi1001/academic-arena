import AsyncStorage from '@react-native-async-storage/async-storage';
import { SupabaseService } from './supabaseService';
import { BUNDLED_QUESTION_BANK, BundledQuestion } from '../constants/bundledQuestions';
import { OfflineQueueService } from './offlineQueueService';
import type { Question } from '../types';

const REMOTE_CACHE_KEY = 'academic_arena_remote_question_cache';
const REMOTE_VERSION_KEY = 'academic_arena_question_cache_version';
const SEEN_QUESTIONS_KEY = '@academic_arena_seen_questions_history';
const MAX_SEEN_HISTORY = 300; // Tracks up to 300 recently played questions in a FIFO rolling queue

export class QuestionService {
  /**
   * Get recently played question IDs from AsyncStorage
   */
  static async getSeenQuestionIds(): Promise<string[]> {
    try {
      const raw = await AsyncStorage.getItem(SEEN_QUESTIONS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  /**
   * Mark question IDs as seen in the rolling FIFO queue
   */
  static async markQuestionsAsSeen(newIds: string[]): Promise<void> {
    try {
      const existing = await this.getSeenQuestionIds();
      const set = new Set(newIds);
      const filteredExisting = existing.filter((id) => !set.has(id));
      const combined = [...newIds, ...filteredExisting].slice(0, MAX_SEEN_HISTORY);
      await AsyncStorage.setItem(SEEN_QUESTIONS_KEY, JSON.stringify(combined));
    } catch (e) {}
  }

  /**
   * Get questions with 3-layer resolution:
   * 1. Dynamic Local Cache (Downloaded from CDN/Supabase)
   * 2. Live Supabase Query (if online)
   * 3. Bundled Offline Bank (Instant 0ms fallback)
   */
  static async getQuestions(
    classNum: number,
    subject: string,
    limit: number = 10,
    difficulty?: number
  ): Promise<Question[]> {
    let pool: BundledQuestion[] = [];

    // 1. Try Live Supabase Query (with 2.5s timeout)
    try {
      const livePromise = SupabaseService.getRandomQuestions(classNum, subject, limit);
      const timeoutPromise = new Promise<Question[]>((_, reject) =>
        setTimeout(() => reject(new Error('Supabase question timeout')), 2500)
      );

      const liveQuestions = await Promise.race([livePromise, timeoutPromise]);
      if (liveQuestions && liveQuestions.length >= limit) {
        // Also flush any pending offline queue in background since we know we are online
        OfflineQueueService.flushOfflineQueue().catch(() => {});
        return liveQuestions;
      }
    } catch (e) {
      console.log('[QUESTION SERVICE] Live fetch skipped/offline, using local bank.');
    }

    // 2. Check Dynamic Cached Remote Pack in AsyncStorage
    try {
      const cachedRaw = await AsyncStorage.getItem(REMOTE_CACHE_KEY);
      if (cachedRaw) {
        const cached: BundledQuestion[] = JSON.parse(cachedRaw);
        const filteredCached = cached.filter(
          (q) => q.class === classNum && q.subject.toLowerCase() === subject.toLowerCase()
        );
        if (filteredCached.length > 0) {
          pool = pool.concat(filteredCached);
        }
      }
    } catch (e) {}

    // 3. Bundled Question Bank (Baked into APK)
    const filteredBundled = BUNDLED_QUESTION_BANK.filter(
      (q) => q.class === classNum && q.subject.toLowerCase() === subject.toLowerCase()
    );
    pool = pool.concat(filteredBundled);

    if (pool.length === 0) {
      // General fallback if specific class/subject has no matches
      pool = BUNDLED_QUESTION_BANK;
    }

    // If specific difficulty is requested, filter or prioritize
    let candidatePool = pool;
    if (difficulty) {
      const diffMatches = pool.filter((q) => q.difficulty === difficulty);
      if (diffMatches.length >= limit) {
        candidatePool = diffMatches;
      }
    }

    // Shuffle and pick
    const shuffled = [...candidatePool].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, limit);

    return selected.map((q) => ({
      _id: q._id,
      class: q.class,
      subject: q.subject,
      difficulty: q.difficulty || 1,
      packet: q.packet || 1,
      question: q.question,
      options: q.options,
      answer: q.answer,
      explanation: q.explanation || '',
    }));
  }

  /**
   * Get questions stacked by progressive difficulty based on player EXP & League
   * WITH STRICT ANTI-REPETITION GUARANTEE (maximum 1-2 repeats per match for spaced reinforcement)
   * 🟢 EASY (1) ➔ 🟡 MEDIUM (2) ➔ 🟠 HARD (3) ➔ 🔴 VERY HARD (4) ➔ 🟣 EXTREME (5) ➔ 👑 LEGENDARY (6)
   */
  static async getProgressiveQuestionBatch(
    classNum: number,
    subject: string,
    playerExp: number = 0,
    count: number = 10
  ): Promise<Question[]> {
    // 1. Calculate Base Difficulty Tier from Player EXP
    let baseTier = 1;
    if (playerExp >= 200000) baseTier = 6; // Mythic
    else if (playerExp >= 100000) baseTier = 5; // Diamond
    else if (playerExp >= 50000) baseTier = 4; // Platinum
    else if (playerExp >= 20000) baseTier = 3; // Gold
    else if (playerExp >= 5000) baseTier = 2; // Silver
    else baseTier = 1; // Bronze

    // 2. Fetch full question pool and seen history
    const allQuestions = await this.getQuestions(classNum, subject, 80);
    const seenIds = await this.getSeenQuestionIds();
    const seenSet = new Set(seenIds);

    // 3. Separate pool into Unseen (Fresh) vs Seen (History)
    const unseenPool = allQuestions.filter((q) => !seenSet.has(q._id));
    const seenPool = allQuestions.filter((q) => seenSet.has(q._id));

    // Sort seenPool so the oldest seen questions come first (FIFO)
    seenPool.sort((a, b) => {
      const idxA = seenIds.indexOf(a._id);
      const idxB = seenIds.indexOf(b._id);
      return idxB - idxA; // Largest index = oldest seen
    });

    const stackedQuestions: Question[] = [];
    const usedInThisRun = new Set<string>();

    // Maximum repeats strictly capped at 20% of total match (at most 1-2 questions in a 10-question match)
    const maxAllowedRepeats = Math.min(2, Math.floor(count * 0.2));
    let repeatCount = 0;

    for (let i = 0; i < count; i++) {
      // Progressive difficulty ladder step
      const progressFraction = i / (count - 1 || 1);
      const stepIncrement = Math.floor(progressFraction * 3); // Climbs +0 to +3 tiers during the run
      const targetDiff = Math.min(6, Math.max(1, baseTier + stepIncrement));

      // 1. Try to find a FRESH (unseen) question matching target difficulty
      let match = unseenPool.find(
        (q) => !usedInThisRun.has(q._id) && (q.difficulty || 1) === targetDiff
      );

      // 2. If no fresh match of exact difficulty, try any fresh question
      if (!match) {
        match = unseenPool.find((q) => !usedInThisRun.has(q._id));
      }

      // 3. If fresh questions are exhausted, allow up to maxAllowedRepeats from oldest seen questions
      if (!match && repeatCount < maxAllowedRepeats) {
        match = seenPool.find(
          (q) => !usedInThisRun.has(q._id) && (q.difficulty || 1) === targetDiff
        );
        if (!match) {
          match = seenPool.find((q) => !usedInThisRun.has(q._id));
        }
        if (match) {
          repeatCount++;
        }
      }

      // 4. Absolute fallback: pick any remaining available question in pool
      if (!match) {
        match = allQuestions.find((q) => !usedInThisRun.has(q._id));
      }

      if (match) {
        usedInThisRun.add(match._id);
        stackedQuestions.push({
          ...match,
          difficulty: targetDiff,
        });
      }
    }

    // Mark questions chosen in this run as seen
    const chosenIds = stackedQuestions.map((q) => q._id);
    this.markQuestionsAsSeen(chosenIds).catch(() => {});

    return stackedQuestions;
  }

  /**
   * Save completed run: tries Supabase first, automatically enqueues offline if network fails
   */
  static async recordRun(run: {
    firebaseUid: string;
    runId: string;
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
  }): Promise<{ onlineSaved: boolean; queuedOffline: boolean }> {
    try {
      const success = await SupabaseService.recordCompletedRun(run as any);
      if (success) {
        // Also flush any pending queued runs
        OfflineQueueService.flushOfflineQueue().catch(() => {});
        return { onlineSaved: true, queuedOffline: false };
      }
    } catch (e) {
      console.warn('[QUESTION SERVICE] Online record failed, queuing offline:', e);
    }

    // Queue offline
    await OfflineQueueService.queueOfflineRun(run);
    return { onlineSaved: false, queuedOffline: true };
  }

  /**
   * Update / Cache new question packets from CDN or Supabase
   */
  static async updateCache(newQuestions: BundledQuestion[], version?: string): Promise<void> {
    try {
      await AsyncStorage.setItem(REMOTE_CACHE_KEY, JSON.stringify(newQuestions));
      if (version) {
        await AsyncStorage.setItem(REMOTE_VERSION_KEY, version);
      }
      console.log(`[QUESTION SERVICE] Cached ${newQuestions.length} remote questions locally.`);
    } catch (e) {
      console.warn('[QUESTION SERVICE] Failed to cache remote questions:', e);
    }
  }

  /**
   * Sync and download remote question pack from jsDelivr / GitHub CDN
   * Runs in the background on startup, 0ms blocking, zero rate limits!
   */
  static async syncFromCdn(customUrl?: string): Promise<boolean> {
    try {
      const cdnEndpoint =
        customUrl ||
        'https://cdn.jsdelivr.net/gh/omi1001/academic-arena@main/constants/bundledQuestions.json';

      const response = await fetch(cdnEndpoint, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        return false;
      }

      const remoteQuestions: BundledQuestion[] = await response.json();
      if (Array.isArray(remoteQuestions) && remoteQuestions.length > 0) {
        await this.updateCache(remoteQuestions, `cdn_${Date.now()}`);
        console.log(`[QUESTION SERVICE] Successfully synced ${remoteQuestions.length} questions from jsDelivr CDN!`);
        return true;
      }
      return false;
    } catch (e) {
      // Silent catch - local offline fallback is always active
      return false;
    }
  }
}
