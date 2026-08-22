import { supabase } from './supabase';
import { auth } from './firebase';
import type { User, Question } from '../types';

export { supabase };

export interface LeaderboardEntry {
  id: string;
  firebase_uid: string;
  name: string;
  username?: string;
  arena_tag?: string;
  avatar: string;
  class: number;
  score: number;
  games_played: number;
  rank: number;
}

export function generateDefaultUsername(name: string, uid: string): string {
  const cleanName = (name || 'player')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 10);
  const hash = Math.abs(
    uid.split('').reduce((acc, char) => (acc << 5) - acc + char.charCodeAt(0), 0)
  )
    .toString()
    .slice(-4);
  return `@${cleanName || 'player'}_${hash.padStart(4, '7')}`;
}

export function generateArenaTag(uid: string): string {
  const hash = Math.abs(
    uid.split('').reduce((acc, char) => (acc << 5) - acc + char.charCodeAt(0), 0)
  )
    .toString(36)
    .toUpperCase()
    .slice(-4);
  return `#AA-${hash.padStart(4, 'X')}`;
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

      const fallbackUsername = generateDefaultUsername(data.name || 'player', data.firebase_uid);
      const fallbackTag = generateArenaTag(data.firebase_uid);

      const username = data.username || fallbackUsername;
      const arenaTag = data.arena_tag || fallbackTag;

      // Auto-heal missing username or arena_tag in database silently
      if (!data.username || !data.arena_tag) {
        (async () => {
          try {
            await supabase
              .from('users')
              .update({
                username: username,
                arena_tag: arenaTag,
              })
              .eq('firebase_uid', firebaseUid);
          } catch (ignored) {}
        })();
      }

      return {
        uid: data.firebase_uid,
        name: data.name,
        username,
        arenaTag,
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
      const defaultUsername = generateDefaultUsername(profile.name || 'player', profile.firebaseUid);
      const defaultTag = generateArenaTag(profile.firebaseUid);

      const payload: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (profile.name) payload.name = profile.name;
      if (profile.email) payload.email = profile.email;
      if (profile.class) payload.class = profile.class;
      if (profile.username) payload.username = profile.username;
      if (profile.arenaTag) payload.arena_tag = profile.arenaTag;
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

      const { data: existingUser } = await supabase
        .from('users')
        .select('*')
        .eq('firebase_uid', profile.firebaseUid)
        .maybeSingle();

      let resultData: any = null;

      if (existingUser) {
        const { data, error } = await supabase
          .from('users')
          .update(payload)
          .eq('firebase_uid', profile.firebaseUid)
          .select()
          .single();

        if (error) {
          console.warn('Supabase update user profile error:', error);
          return null;
        }
        resultData = data;
      } else {
        const insertPayload = {
          firebase_uid: profile.firebaseUid,
          name: profile.name || auth.currentUser?.displayName || 'Player',
          email: profile.email || auth.currentUser?.email || '',
          username: profile.username || defaultUsername,
          arena_tag: profile.arenaTag || defaultTag,
          class: profile.class || 10,
          total_exp: profile.totalEXP || 0,
          weekly_exp: profile.totalEXP || 0,
          hearts: 3,
          avatar: profile.avatar || '👤',
          games_played: profile.gamesPlayed || 0,
          total_answered: profile.totalAnswered || 0,
          total_correct: profile.totalCorrect || 0,
          challenge_wins: profile.challengeWins || 0,
          challenge_losses: profile.challengeLosses || 0,
          challenge_games_played: profile.challengeGamesPlayed || 0,
          highest_challenge_difficulty: profile.highestChallengeDifficulty || 1,
          theme_preset: 'cosmic_lofi',
          theme_mode: 'dark',
          ...payload,
        };

        const { data, error } = await supabase
          .from('users')
          .insert(insertPayload)
          .select()
          .single();

        if (error) {
          console.warn('Supabase insert user profile error:', error);
          return null;
        }
        resultData = data;
      }

      if (!resultData) return null;

      return {
        uid: resultData.firebase_uid,
        name: resultData.name,
        username: resultData.username || defaultUsername,
        arenaTag: resultData.arena_tag || defaultTag,
        email: resultData.email,
        class: resultData.class,
        totalEXP: resultData.total_exp || 0,
        gamesPlayed: resultData.games_played || 0,
        totalAnswered: resultData.total_answered || 0,
        totalCorrect: resultData.total_correct || 0,
        highestStreak: 0,
        highestDifficulty: 1,
        challengeWins: resultData.challenge_wins || 0,
        challengeLosses: resultData.challenge_losses || 0,
        challengeGamesPlayed: resultData.challenge_games_played || 0,
        highestChallengeDifficulty: resultData.highest_challenge_difficulty || 1,
        avatar: resultData.avatar || '👤',
        upiId: resultData.upi_id || '',
        createdAt: resultData.created_at,
        updatedAt: resultData.updated_at,
      };
    } catch (e) {
      console.warn('Supabase upsertUserProfile failed:', e);
      return null;
    }
  },

  async checkUsernameAvailable(username: string, excludeUid?: string): Promise<boolean> {
    try {
      const clean = username.trim().toLowerCase();
      let query = supabase.from('users').select('firebase_uid').eq('username', clean);
      if (excludeUid) {
        query = query.neq('firebase_uid', excludeUid);
      }
      const { data, error } = await query;
      if (error || !data) return true;
      return data.length === 0;
    } catch (e) {
      return true;
    }
  },

  async searchUsers(searchQuery: string, limit = 20): Promise<User[]> {
    try {
      const raw = searchQuery.trim();
      if (!raw) return [];

      // 1. Strip special query characters that break URL encoding in PostgREST
      const clean = raw.replace(/[#@%()]/g, '').trim();
      if (!clean) return [];

      // 2. Extract alphanumeric token (for tags like #AA-4B29 or 4B29)
      const alphaNum = clean.replace(/[^A-Za-z0-9]/g, '');
      const hexSuffix = alphaNum.toUpperCase().startsWith('AA') ? alphaNum.slice(2) : alphaNum;

      // 3. Build safe OR clauses
      const orClauses: string[] = [
        `name.ilike.%${clean}%`,
        `username.ilike.%${clean}%`,
        `arena_tag.ilike.%${clean}%`,
      ];

      // If user typed a 2+ char tag part (e.g. "4B29" or "AA4B29"), also search firebase_uid and arena_tag
      if (hexSuffix.length >= 2) {
        orClauses.push(`firebase_uid.ilike.%${hexSuffix}%`);
        orClauses.push(`arena_tag.ilike.%${hexSuffix}%`);
      }

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .or(orClauses.join(','))
        .limit(limit);

      if (error || !data || data.length === 0) {
        // Fallback: Simple direct ILIKE on name or username
        const { data: fallbackData } = await supabase
          .from('users')
          .select('*')
          .ilike('name', `%${clean}%`)
          .limit(limit);

        if (!fallbackData || fallbackData.length === 0) return [];
        return fallbackData.map((u: any) => ({
          uid: u.firebase_uid,
          name: u.name || 'Player',
          username: u.username || generateDefaultUsername(u.name || 'player', u.firebase_uid),
          arenaTag: u.arena_tag || generateArenaTag(u.firebase_uid),
          email: u.email,
          class: u.class || 10,
          totalEXP: u.total_exp || 0,
          gamesPlayed: u.games_played || 0,
          totalAnswered: u.total_answered || 0,
          totalCorrect: u.total_correct || 0,
          highestStreak: 0,
          highestDifficulty: 1,
          avatar: u.avatar || '👤',
        }));
      }

      return data.map((u: any) => ({
        uid: u.firebase_uid,
        name: u.name || 'Player',
        username: u.username || generateDefaultUsername(u.name || 'player', u.firebase_uid),
        arenaTag: u.arena_tag || generateArenaTag(u.firebase_uid),
        email: u.email,
        class: u.class || 10,
        totalEXP: u.total_exp || 0,
        gamesPlayed: u.games_played || 0,
        totalAnswered: u.total_answered || 0,
        totalCorrect: u.total_correct || 0,
        highestStreak: 0,
        highestDifficulty: 1,
        avatar: u.avatar || '👤',
      }));
    } catch (e) {
      console.warn('searchUsers error:', e);
      return [];
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

  // ─── ADMIN QUESTION CRUD ───
  async createQuestion(question: Omit<Question, '_id'>): Promise<Question | null> {
    try {
      const { data, error } = await supabase
        .from('questions')
        .insert({
          class: question.class,
          subject: question.subject,
          difficulty: question.difficulty || 1,
          question: question.question,
          options: question.options,
          answer: question.answer,
          explanation: question.explanation || '',
          packet: question.packet || 1,
        })
        .select()
        .single();

      if (error || !data) {
        console.warn('Supabase createQuestion error:', error);
        return null;
      }

      return {
        _id: data.id,
        class: data.class,
        subject: data.subject,
        difficulty: data.difficulty,
        question: data.question,
        options: data.options,
        answer: data.answer,
        explanation: data.explanation,
        packet: data.packet,
      };
    } catch (e) {
      console.warn('Supabase createQuestion failed:', e);
      return null;
    }
  },

  async updateQuestion(id: string, updates: Partial<Question>): Promise<boolean> {
    try {
      const payload: Record<string, any> = {};
      if (updates.class !== undefined) payload.class = updates.class;
      if (updates.subject !== undefined) payload.subject = updates.subject;
      if (updates.difficulty !== undefined) payload.difficulty = updates.difficulty;
      if (updates.question !== undefined) payload.question = updates.question;
      if (updates.options !== undefined) payload.options = updates.options;
      if (updates.answer !== undefined) payload.answer = updates.answer;
      if (updates.explanation !== undefined) payload.explanation = updates.explanation;
      if (updates.packet !== undefined) payload.packet = updates.packet;

      const { error } = await supabase
        .from('questions')
        .update(payload)
        .eq('id', id);

      return !error;
    } catch (e) {
      console.warn('Supabase updateQuestion failed:', e);
      return false;
    }
  },

  async deleteQuestion(id: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('questions')
        .delete()
        .eq('id', id);

      return !error;
    } catch (e) {
      console.warn('Supabase deleteQuestion failed:', e);
      return false;
    }
  },

  async insertBulkQuestions(questions: Array<Omit<Question, '_id'>>): Promise<number> {
    try {
      const payload = questions.map((q) => ({
        class: q.class,
        subject: q.subject,
        difficulty: q.difficulty || 1,
        question: q.question,
        options: q.options,
        answer: q.answer,
        explanation: q.explanation || '',
        packet: q.packet || 1,
      }));

      const { data, error } = await supabase
        .from('questions')
        .insert(payload)
        .select();

      if (error) {
        console.warn('Supabase insertBulkQuestions error:', error);
        return 0;
      }
      return data?.length || 0;
    } catch (e) {
      console.warn('Supabase insertBulkQuestions failed:', e);
      return 0;
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
    mode?: 'solo' | 'challenge' | 'crossword' | 'bomb';
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

        if (userRow) {
          const { error: updateError } = await supabase
            .from('users')
            .update(updates)
            .eq('firebase_uid', firebaseUid);

          if (updateError) {
            console.warn('Supabase update user EXP error:', updateError);
          } else {
            console.log(`[SUPABASE] Successfully updated ${firebaseUid} with +${expEarned} EXP!`);
          }
        } else {
          const insertPayload = {
            firebase_uid: firebaseUid,
            name: auth.currentUser?.displayName || 'Player',
            email: auth.currentUser?.email || '',
            class: classNum || 10,
            hearts: 3,
            avatar: '👤',
            theme_preset: 'cosmic_lofi',
            theme_mode: 'dark',
            ...updates,
          };

          const { error: insertError } = await supabase
            .from('users')
            .insert(insertPayload);

          if (insertError) {
            console.warn('Supabase insert user EXP error:', insertError);
          } else {
            console.log(`[SUPABASE] Successfully inserted user ${firebaseUid} with +${expEarned} EXP!`);
          }
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
