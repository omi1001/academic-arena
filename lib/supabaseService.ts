import { supabase } from './supabase';
import type { User, Question } from '../types';

export interface LeaderboardEntry {
  id: string;
  firebase_uid: string;
  name: string;
  avatar: string;
  class: number;
  score: number;
  games_played: number;
  rank: number;
}

export const SupabaseService = {
  // ─── USER PROFILES ───
  async getUserProfile(firebaseUid: string): Promise<User | null> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('firebase_uid', firebaseUid)
        .maybeSingle();

      if (error) {
        console.warn('Supabase getUserProfile error:', error);
        return null;
      }
      if (!data) return null;

      return {
        uid: data.firebase_uid,
        name: data.name,
        email: data.email,
        class: data.class,
        totalEXP: data.total_exp || 0,
        gamesPlayed: data.games_played || 0,
        totalAnswered: data.total_answered || 0,
        totalCorrect: data.total_correct || 0,
        highestStreak: 0,
        highestDifficulty: 1,
        challengeWins: data.challenge_wins || 0,
        challengeLosses: data.challenge_losses || 0,
        challengeGamesPlayed: data.challenge_games_played || 0,
        highestChallengeDifficulty: data.highest_challenge_difficulty || 1,
        avatar: data.avatar || '👤',
        upiId: data.upi_id || '',
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };
    } catch (e) {
      console.warn('Supabase getUserProfile failed:', e);
      return null;
    }
  },

  async upsertUserProfile(profile: Partial<User> & { firebaseUid: string }): Promise<User | null> {
    try {
      const payload: Record<string, any> = {
        firebase_uid: profile.firebaseUid,
        updated_at: new Date().toISOString(),
      };

      if (profile.name) payload.name = profile.name;
      if (profile.email) payload.email = profile.email;
      if (profile.class) payload.class = profile.class;
      if (profile.totalEXP !== undefined) payload.total_exp = profile.totalEXP;
      if (profile.avatar) payload.avatar = profile.avatar;
      if (profile.upiId !== undefined) payload.upi_id = profile.upiId;
      if (profile.gamesPlayed !== undefined) payload.games_played = profile.gamesPlayed;
      if (profile.totalAnswered !== undefined) payload.total_answered = profile.totalAnswered;
      if (profile.totalCorrect !== undefined) payload.total_correct = profile.totalCorrect;
      if (profile.challengeWins !== undefined) payload.challenge_wins = profile.challengeWins;
      if (profile.challengeLosses !== undefined) payload.challenge_losses = profile.challengeLosses;
      if (profile.challengeGamesPlayed !== undefined) payload.challenge_games_played = profile.challengeGamesPlayed;
      if (profile.highestChallengeDifficulty !== undefined) payload.highest_challenge_difficulty = profile.highestChallengeDifficulty;

      const { data, error } = await supabase
        .from('users')
        .upsert(payload, { onConflict: 'firebase_uid' })
        .select()
        .single();

      if (error) {
        console.warn('Supabase upsertUserProfile error:', error);
        return null;
      }

      return {
        uid: data.firebase_uid,
        name: data.name,
        email: data.email,
        class: data.class,
        totalEXP: data.total_exp || 0,
        gamesPlayed: data.games_played || 0,
        totalAnswered: data.total_answered || 0,
        totalCorrect: data.total_correct || 0,
        highestStreak: 0,
        highestDifficulty: 1,
        challengeWins: data.challenge_wins || 0,
        challengeLosses: data.challenge_losses || 0,
        challengeGamesPlayed: data.challenge_games_played || 0,
        highestChallengeDifficulty: data.highest_challenge_difficulty || 1,
        avatar: data.avatar || '👤',
        upiId: data.upi_id || '',
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };
    } catch (e) {
      console.warn('Supabase upsertUserProfile failed:', e);
      return null;
    }
  },

  // ─── QUESTIONS ───
  async getRandomQuestions(classNum: number, subject: string, limit = 15): Promise<Question[]> {
    try {
      // 1. Try invoking the SQL random questions function
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_random_arena_questions', {
        p_class: classNum,
        p_subject: subject,
        p_limit: limit,
      });

      if (!rpcError && Array.isArray(rpcData) && rpcData.length > 0) {
        return rpcData.map((q: any) => ({
          _id: q.id,
          class: q.class,
          subject: q.subject,
          difficulty: q.difficulty || 1,
          packet: q.packet || 1,
          question: q.question,
          options: Array.isArray(q.options) ? q.options : JSON.parse(q.options || '[]'),
          answer: q.answer,
          explanation: q.explanation || '',
        }));
      }

      // 2. Fallback to standard SELECT query
      const { data, error } = await supabase
        .from('questions')
        .select('*')
        .eq('class', classNum)
        .eq('subject', subject)
        .limit(limit * 2);

      if (error || !data || data.length === 0) {
        console.warn('Supabase questions fallback query:', error);
        return [];
      }

      const shuffled = [...data].sort(() => Math.random() - 0.5);
      return shuffled.slice(0, limit).map((q: any) => ({
        _id: q.id,
        class: q.class,
        subject: q.subject,
        difficulty: q.difficulty || 1,
        packet: q.packet || 1,
        question: q.question,
        options: Array.isArray(q.options) ? q.options : JSON.parse(q.options || '[]'),
        answer: q.answer,
        explanation: q.explanation || '',
      }));
    } catch (e) {
      console.warn('Supabase getRandomQuestions failed:', e);
      return [];
    }
  },

  // ─── GAME RUNS & EXP SYNC ───
  async saveGameRun(run: Record<string, any>): Promise<boolean> {
    try {
      const { error } = await supabase.from('game_runs').insert({
        run_id: run.runId,
        user_id: run.userId || 'anonymous',
        class: run.class,
        subject: run.subject,
        mode: run.mode || 'solo',
        score: run.score || 0,
        correct_answers: run.correctAnswers || 0,
        questions_answered: run.questionsAnswered || 0,
        exp_earned: run.expEarned || 0,
        max_streak: run.maxStreak || 0,
        highest_difficulty: run.highestDifficulty || 1,
        hearts_remaining: run.heartsRemaining || 0,
        status: run.status || 'completed',
        is_challenge_win: run.isChallengeWin || false,
        answers: run.answers || [],
      });

      if (error) {
        console.warn('Supabase saveGameRun error:', error);
        return false;
      }
      return true;
    } catch (e) {
      console.warn('Supabase saveGameRun failed:', e);
      return false;
    }
  },

  async recordCompletedRun(params: {
    firebaseUid: string;
    runId: string;
    classNum: number;
    subject: string;
    mode?: 'solo' | 'challenge';
    score: number;
    correctAnswers: number;
    questionsAnswered: number;
    expEarned: number;
    maxStreak?: number;
    highestDifficulty?: number;
    heartsRemaining?: number;
    status?: 'completed' | 'cheat_detected' | 'timeout';
    isChallengeWin?: boolean;
    answers?: any[];
  }): Promise<boolean> {
    try {
      const {
        firebaseUid,
        runId,
        classNum,
        subject,
        mode = 'solo',
        score,
        correctAnswers,
        questionsAnswered,
        expEarned,
        maxStreak = 0,
        highestDifficulty = 1,
        heartsRemaining = 0,
        status = 'completed',
        isChallengeWin = false,
        answers = [],
      } = params;

      // 1. Insert into game_runs table
      const { error: runError } = await supabase.from('game_runs').insert({
        run_id: runId,
        user_id: firebaseUid || 'anonymous',
        class: classNum,
        subject,
        mode,
        score,
        correct_answers: correctAnswers,
        questions_answered: questionsAnswered,
        exp_earned: expEarned,
        max_streak: maxStreak,
        highest_difficulty: highestDifficulty,
        hearts_remaining: heartsRemaining,
        status,
        is_challenge_win: isChallengeWin,
        answers,
      });

      if (runError) {
        console.warn('Supabase insert game_run error:', runError);
      }

      // 2. Atomically update user EXP & stats in Supabase users table
      if (firebaseUid && firebaseUid !== 'anonymous') {
        const { data: userRow } = await supabase
          .from('users')
          .select('*')
          .eq('firebase_uid', firebaseUid)
          .maybeSingle();

        const currentTotalExp = userRow?.total_exp || 0;
        const currentWeeklyExp = userRow?.weekly_exp || 0;
        const currentGames = userRow?.games_played || 0;
        const currentAnswered = userRow?.total_answered || 0;
        const currentCorrect = userRow?.total_correct || 0;

        const updates: Record<string, any> = {
          firebase_uid: firebaseUid,
          total_exp: currentTotalExp + expEarned,
          weekly_exp: currentWeeklyExp + expEarned,
          games_played: currentGames + 1,
          total_answered: currentAnswered + questionsAnswered,
          total_correct: currentCorrect + correctAnswers,
          updated_at: new Date().toISOString(),
        };

        if (mode === 'challenge') {
          updates.challenge_games_played = (userRow?.challenge_games_played || 0) + 1;
          if (isChallengeWin) {
            updates.challenge_wins = (userRow?.challenge_wins || 0) + 1;
          } else {
            updates.challenge_losses = (userRow?.challenge_losses || 0) + 1;
          }
          updates.highest_challenge_difficulty = Math.max(
            userRow?.highest_challenge_difficulty || 1,
            highestDifficulty
          );
        }

        const { error: userError } = await supabase
          .from('users')
          .upsert(updates, { onConflict: 'firebase_uid' });

        if (userError) {
          console.warn('Supabase update user EXP error:', userError);
        } else {
          console.log(`[SUPABASE] Successfully updated ${firebaseUid} with +${expEarned} EXP!`);
        }
      }

      return true;
    } catch (e) {
      console.warn('Supabase recordCompletedRun failed:', e);
      return false;
    }
  },

  // ─── LEADERBOARD VIEWS & DIRECT FALLBACK ───
  async getLeaderboard(type: 'all_time' | 'weekly' | 'challenge' = 'all_time', classFilter?: number): Promise<LeaderboardEntry[]> {
    try {
      const viewName =
        type === 'weekly'
          ? 'leaderboard_weekly'
          : type === 'challenge'
            ? 'leaderboard_challenge'
            : 'leaderboard_all_time';

      let query = supabase.from(viewName).select('*').limit(50);
      if (classFilter) {
        query = query.eq('class', classFilter);
      }

      const { data, error } = await query;
      if (!error && Array.isArray(data) && data.length > 0) {
        return data.map((row: any, idx: number) => ({
          id: row.id,
          firebase_uid: row.firebase_uid,
          name: row.name || 'Player',
          avatar: row.avatar || '👤',
          class: row.class || 10,
          score: type === 'weekly' ? (row.weekly_exp ?? row.total_exp ?? 0) : type === 'challenge' ? (row.challenge_wins ?? 0) : (row.total_exp ?? 0),
          games_played: row.games_played || 0,
          rank: row.rank ?? (idx + 1),
        }));
      }

      // Fallback: Query users table directly
      const sortColumn = type === 'weekly' ? 'weekly_exp' : type === 'challenge' ? 'challenge_wins' : 'total_exp';
      let userQuery = supabase.from('users').select('*').order(sortColumn, { ascending: false }).limit(50);
      if (classFilter) {
        userQuery = userQuery.eq('class', classFilter);
      }

      const { data: usersData, error: userError } = await userQuery;
      if (userError || !usersData) {
        console.warn('Supabase users fallback error:', userError);
        return [];
      }

      return usersData.map((u: any, idx: number) => ({
        id: u.id,
        firebase_uid: u.firebase_uid,
        name: u.name || 'Player',
        avatar: u.avatar || '👤',
        class: u.class || 10,
        score: type === 'weekly' ? (u.weekly_exp ?? u.total_exp ?? 0) : type === 'challenge' ? (u.challenge_wins ?? 0) : (u.total_exp ?? 0),
        games_played: u.games_played || 0,
        rank: idx + 1,
      }));
    } catch (e) {
      console.warn('Supabase getLeaderboard failed:', e);
      return [];
    }
  },
};
