import { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  AppState,
  Alert,
  Animated,
  Easing,
  ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUserStore } from '../../../stores/userStore';
import { useAuthStore } from '../../../stores/authStore';
import { useThemeStore } from '../../../stores/themeStore';
import { Colors, Gradients } from '../../../constants/theme';
import { MAX_HEARTS, LEADERBOARD_TIERS } from '../../../constants/config';
import { soundManager } from '../../../lib/soundManager';
import { auth } from '../../../lib/firebase';
import api from '../../../lib/api';
import { SupabaseService } from '../../../lib/supabaseService';
import { QuestionService } from '../../../lib/questionService';
import type { Question } from '../../../types';
import { BouncyButton } from '../../../components/BouncyButton';
import { SarcasticLoader } from '../../../components/SarcasticLoader';

const TOTAL_CHALLENGE_QUESTIONS = 15;
const SEEN_QUESTIONS_KEY = '@seen_challenge_questions';
const MAX_SEEN_HISTORY = 150; // Keeps history of 10 challenge matches (10 * 15 = 150 questions)

const getSeenQuestionIds = async (): Promise<string[]> => {
  try {
    const raw = await AsyncStorage.getItem(SEEN_QUESTIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
};

const saveSeenQuestionIds = async (newIds: string[]) => {
  try {
    const existing = await getSeenQuestionIds();
    const combined = [...existing, ...newIds];
    const trimmed = combined.slice(-MAX_SEEN_HISTORY);
    await AsyncStorage.setItem(SEEN_QUESTIONS_KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.warn('Failed to save seen challenge question IDs:', e);
  }
};

const BOT_NAMES = [
  'SharmaJi_Ka_Beta',
  'Backbencher_99',
  'NCERT_Connoisseur',
  'CalculusDemon',
  'Rohan_Speedrunner',
  'Topper_Ananya',
  'MitochondriaMaster',
  'LateNightGrinder',
  'ZeroSocialLife',
  'SamosaAddict',
];

const BOT_AVATARS = ['🤖', '🥷', '⚡', '🦅', '🦁', '🔥', '👑', '👾'];

export default function ChallengeGameScreen() {
  const router = useRouter();
  const { runId, class: classStr, subject } = useLocalSearchParams<{
    runId: string;
    class: string;
    subject: string;
    packet?: string;
  }>();

  const { profile, setProfile } = useUserStore();
  const { firebaseUser } = useAuthStore();
  const { getColors, mode } = useThemeStore();
  const colors = getColors();
  const playerExp = profile?.totalEXP || 0;

  // ─── Player State ───
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [playerHearts, setPlayerHearts] = useState(MAX_HEARTS);
  const [playerScore, setPlayerScore] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [timeLeft, setTimeLeft] = useState(15);
  const [isLoading, setIsLoading] = useState(true);

  // ─── Bot State ───
  const [botName] = useState(() => BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)]);
  const [botAvatar] = useState(() => BOT_AVATARS[Math.floor(Math.random() * BOT_AVATARS.length)]);
  const [botQIndex, setBotQIndex] = useState(0);
  const [botHearts, setBotHearts] = useState(MAX_HEARTS);
  const [botScore, setBotScore] = useState(0);
  const [botStatusText, setBotStatusText] = useState('Thinking...');

  // ─── Match Finish State ───
  const [matchEnded, setMatchEnded] = useState(false);
  const [isPlayerWinner, setIsPlayerWinner] = useState(false);
  const [expEarnedTotal, setExpEarnedTotal] = useState(0);
  const [heartBonusExp, setHeartBonusExp] = useState(0);

  // ─── Bot AI Parameters (Scales with player totalEXP) ───
  const botAccuracyRef = useRef(
    Math.min(0.70 + Math.min(playerExp / 50000, 1) * 0.22, 0.92)
  );
  const botMinSpeedMsRef = useRef(
    Math.max(3000, 6000 - Math.min(playerExp / 50000, 1) * 2500)
  );
  const botMaxSpeedMsRef = useRef(
    Math.max(5000, 9000 - Math.min(playerExp / 50000, 1) * 3500)
  );

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const botTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Animation Drivers ───
  const questionFadeAnim = useRef(new Animated.Value(0)).current;
  const questionSlideAnim = useRef(new Animated.Value(20)).current;
  const resultFadeAnim = useRef(new Animated.Value(0)).current;

  // Question entrance animation
  const animateQuestionEntrance = useCallback(() => {
    questionFadeAnim.setValue(0);
    questionSlideAnim.setValue(20);
    Animated.parallel([
      Animated.timing(questionFadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
        easing: Easing.out(Easing.quad),
      }),
      Animated.timing(questionSlideAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
        easing: Easing.out(Easing.quad),
      }),
    ]).start();
  }, []);

  // Fetch Questions across ALL packets with automatic 3-layer resolution
  const fetchQuestions = async () => {
    try {
      setIsLoading(true);
      const classNum = parseInt(classStr || `${profile?.class || 10}`);
      const subjectName = subject || 'Mathematics';

      // Unified 3-layer fetch: Cache -> Supabase -> Offline Bundled Bank
      const fetchedList: Question[] = await QuestionService.getQuestions(classNum, subjectName, TOTAL_CHALLENGE_QUESTIONS);

      if (fetchedList && fetchedList.length > 0) {
        let final15 = fetchedList.slice(0, TOTAL_CHALLENGE_QUESTIONS);
        while (final15.length < TOTAL_CHALLENGE_QUESTIONS && fetchedList.length > 0) {
          final15 = [...final15, ...fetchedList].slice(0, TOTAL_CHALLENGE_QUESTIONS);
        }

        setQuestions(final15);

        const fetchedIds = final15.map((q: Question) => q._id || (q as any).id).filter(Boolean);
        if (fetchedIds.length > 0) {
          await saveSeenQuestionIds(fetchedIds);
        }
      } else {
        Alert.alert(
          'Connecting to Arena',
          'Could not retrieve questions from server. Returning to home.',
          [{ text: 'OK', onPress: () => router.replace('/(main)') }]
        );
      }
    } catch (e) {
      console.warn('Failed to fetch challenge questions:', e);
      Alert.alert(
        'Arena Error',
        'Could not load challenge questions. Please check connection.',
        [{ text: 'OK', onPress: () => router.replace('/(main)') }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestions();
    soundManager.pauseBgm();
    return () => {
      soundManager.resumeBgm();
      if (timerRef.current) clearInterval(timerRef.current);
      if (botTimeoutRef.current) clearTimeout(botTimeoutRef.current);
    };
  }, []);

  // Question entrance trigger
  useEffect(() => {
    if (questions.length > 0 && !matchEnded) {
      animateQuestionEntrance();
      startQuestionTimer();
    }
  }, [currentQIndex, questions, matchEnded]);

  // Player question timer (15 seconds per question)
  const startQuestionTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeLeft(15);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          handleTimeOut();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleTimeOut = () => {
    if (showResult || matchEnded) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    setIsCorrect(false);
    setSelectedOption(-1);
    setShowResult(true);

    const newHearts = playerHearts - 1;
    setPlayerHearts(newHearts);

    if (newHearts <= 0) {
      finishMatch(false);
    }
  };

  // Bot Engine Loop Refs to prevent stale closures
  const botQIndexRef = useRef(0);
  const botHeartsRef = useRef(MAX_HEARTS);
  const botScoreRef = useRef(0);
  const matchEndedRef = useRef(false);

  const scheduleBotTurn = useCallback(() => {
    if (matchEndedRef.current || botHeartsRef.current <= 0 || botQIndexRef.current >= TOTAL_CHALLENGE_QUESTIONS) return;

    const delay =
      botMinSpeedMsRef.current +
      Math.random() * (botMaxSpeedMsRef.current - botMinSpeedMsRef.current);

    setBotStatusText('Thinking...');

    botTimeoutRef.current = setTimeout(() => {
      if (matchEndedRef.current) return;

      const isBotCorrect = Math.random() < botAccuracyRef.current;
      if (isBotCorrect) {
        botQIndexRef.current += 1;
        botScoreRef.current += 1;
        setBotQIndex(botQIndexRef.current);
        setBotScore(botScoreRef.current);
        setBotStatusText(`Answered Q${botQIndexRef.current} correctly!`);

        if (botQIndexRef.current >= TOTAL_CHALLENGE_QUESTIONS) {
          finishMatch(false); // Bot won the race!
          return;
        }
      } else {
        botHeartsRef.current -= 1;
        setBotHearts(botHeartsRef.current);
        setBotStatusText('Made an error! 💔');

        if (botHeartsRef.current <= 0) {
          finishMatch(true); // Player wins because bot lost all hearts!
          return;
        }
      }

      // Schedule next bot turn if match is still going
      scheduleBotTurn();
    }, delay);
  }, []);

  // Start bot engine once questions are loaded
  useEffect(() => {
    if (!isLoading && questions.length > 0 && !matchEnded) {
      scheduleBotTurn();
    }
  }, [isLoading, questions]);

  const questionStartTimeRef = useRef<number>(Date.now());
  const answersRecordRef = useRef<Array<{ questionId: string; selectedOption: number; timeTakenMs: number }>>([]);

  // Handle Player Answer Selection
  const handleSelectOption = (index: number) => {
    if (showResult || matchEnded) return;
    if (timerRef.current) clearInterval(timerRef.current);

    const now = Date.now();
    const timeTakenMs = Math.max(100, now - (questionStartTimeRef.current || now));
    setSelectedOption(index);
    const currentQ = questions[currentQIndex];

    if (currentQ?._id) {
      answersRecordRef.current.push({
        questionId: currentQ._id,
        selectedOption: index,
        timeTakenMs,
      });
    }

    const correct = index === currentQ.answer;
    setIsCorrect(correct);
    setShowResult(true);

    if (correct) {
      const nextScore = playerScore + 1;
      // Trigger "MUDA MUDA MUDA!" anime audio on high battle surges
      if (nextScore >= 3 && (nextScore % 3 === 0 || nextScore % 5 === 0)) {
        soundManager.playMudaMuda();
      } else {
        soundManager.playCorrect();
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPlayerScore(nextScore);
    } else {
      // Sarcastic meme sound (Faah! / Chii Sasur / Aayein / Bruh)
      soundManager.playWrong();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const newHearts = playerHearts - 1;
      setPlayerHearts(newHearts);
      if (newHearts <= 0) {
        finishMatch(false);
      }
    }
  };

  // Move to Next Question
  const handleNextQuestion = () => {
    if (matchEnded) return;

    questionStartTimeRef.current = Date.now();
    setShowResult(false);
    setSelectedOption(null);

    const nextQ = currentQIndex + 1;
    if (nextQ >= TOTAL_CHALLENGE_QUESTIONS) {
      // Player finished all 15 questions!
      finishMatch(true);
    } else {
      setCurrentQIndex(nextQ);
    }
  };

  // Finish Match & Calculate EXP Rewards based on Hearts Remaining
  const finishMatch = (playerWon: boolean) => {
    if (matchEndedRef.current) return;
    matchEndedRef.current = true;
    setMatchEnded(true);
    setIsPlayerWinner(playerWon);

    if (timerRef.current) clearInterval(timerRef.current);
    if (botTimeoutRef.current) clearTimeout(botTimeoutRef.current);
    soundManager.stopBgm();

    if (playerWon) {
      soundManager.playVictory();
    } else {
      soundManager.playDefeat();
    }

    let baseExp = playerWon ? 400 : 50;
    let bonusExp = 0;

    if (playerWon) {
      if (playerHearts === 3) {
        bonusExp = 250; // Flawless bonus
      } else if (playerHearts === 2) {
        bonusExp = 150; // 1 heart lost
      } else if (playerHearts === 1) {
        bonusExp = 50; // 2 hearts lost
      }
    }

    const totalExp = baseExp + bonusExp;
    setHeartBonusExp(bonusExp);
    setExpEarnedTotal(totalExp);

    // Save run to backend server with telemetry
    saveRunToServer(playerWon ? 'completed' : 'timeout', totalExp, playerWon);

    // Show result entrance animation
    Animated.timing(resultFadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  };

  const saveRunToServer = async (status: string, expEarned: number, playerWon: boolean) => {
    try {
      const payloadRunId = runId || `challenge_${Date.now()}`;
      const botDifficultyLevel = Math.min(10, Math.max(1, Math.floor(playerExp / 5000) + 1));
      const classNum = parseInt(classStr || `${profile?.class || 10}`);
      const subjectName = subject || 'Mathematics';
      const currentUid = firebaseUser?.uid || profile?.uid || auth.currentUser?.uid || 'anonymous';

      // 1. Record completed run with automatic offline queue fallback
      await QuestionService.recordRun({
        firebaseUid: currentUid,
        runId: payloadRunId,
        classNum,
        subject: subjectName,
        mode: 'challenge',
        score: playerScore,
        correctAnswers: playerScore,
        questionsAnswered: currentQIndex + 1,
        expEarned,
        maxStreak: 0,
        highestDifficulty: botDifficultyLevel,
        heartsRemaining: playerHearts,
        status: status as any,
        isChallengeWin: playerWon,
        answers: answersRecordRef.current,
      });

      // 2. Immediately update local Zustand user profile
      if (profile) {
        const newWins = (profile.challengeWins || 0) + (playerWon ? 1 : 0);
        const newLosses = (profile.challengeLosses || 0) + (playerWon ? 0 : 1);
        const newGames = (profile.challengeGamesPlayed || 0) + 1;
        const newPeakDiff = Math.max(profile.highestChallengeDifficulty || 1, botDifficultyLevel);

        setProfile({
          ...profile,
          totalEXP: (profile.totalEXP || 0) + expEarned,
          gamesPlayed: (profile.gamesPlayed || 0) + 1,
          totalAnswered: (profile.totalAnswered || 0) + (currentQIndex + 1),
          totalCorrect: (profile.totalCorrect || 0) + playerScore,
          challengeWins: newWins,
          challengeLosses: newLosses,
          challengeGamesPlayed: newGames,
          highestChallengeDifficulty: newPeakDiff,
        });
      }

      // 3. Non-blocking legacy API fallback
      api.post('/runs', {
        runId: payloadRunId,
        class: classNum,
        subject: subjectName,
        packet: 1,
        score: playerScore,
        correctAnswers: playerScore,
        questionsAnswered: currentQIndex + 1,
        expEarned,
        maxStreak: 0,
        highestDifficulty: botDifficultyLevel,
        heartsRemaining: playerHearts,
        startTime: Date.now() - 30000,
        status,
        mode: 'challenge',
        challengeDifficulty: botDifficultyLevel,
        isChallengeWin: playerWon,
        answers: answersRecordRef.current,
      }, { timeout: 3000 }).catch(() => {});
    } catch (e) {
      console.warn('Failed to save challenge run:', e);
    }
  };

  if (isLoading || !questions || questions.length === 0) {
    return (
      <SarcasticLoader
        title="SUMMONING 1v1 OPPONENT"
        subtitle="Matching your brainpower against an AI bot..."
      />
    );
  }

  const currentQ = questions[currentQIndex];
  const playerProgressPct = Math.min(
    ((currentQIndex + (showResult ? 1 : 0)) / TOTAL_CHALLENGE_QUESTIONS) * 100,
    100
  );
  const botProgressPct = Math.min((botQIndex / TOTAL_CHALLENGE_QUESTIONS) * 100, 100);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient colors={['#1F0307', '#3A060E', '#0D0003']} style={styles.container}>
        {/* ─── HELL FIGHT DUAL HUD HEADER ─── */}
        <LinearGradient colors={['#2E040B', '#140003']} style={styles.hudContainer}>
          {/* Battle Header Tag */}
          <View style={styles.battleHeaderTag}>
            <Text style={styles.battleHeaderText}>⚔️ HELL FIGHT 1v1 ARENA 🔥</Text>
          </View>

          {/* Top Row: User vs Bot Avatars & Hearts */}
          <View style={styles.hudTopRow}>
            {/* Player Side */}
            <View style={styles.playerHudBox}>
              <View style={[styles.avatarCircle, { borderColor: colors.primary }]}>
                <Text style={styles.avatarText}>{profile?.avatar || '👤'}</Text>
              </View>
              <View>
                <Text style={[styles.hudName, { color: colors.text }]} numberOfLines={1}>
                  {profile?.name || 'You'}
                </Text>
                <View style={styles.heartsRow}>
                  {Array.from({ length: MAX_HEARTS }).map((_, i) => (
                    <Text key={i} style={{ opacity: i < playerHearts ? 1 : 0.2, fontSize: 12 }}>
                      ❤️
                    </Text>
                  ))}
                </View>
              </View>
            </View>

            {/* VS Badge */}
            <LinearGradient colors={['#FF0055', '#FF5500']} style={styles.vsBadge}>
              <Text style={styles.vsText}>VS</Text>
            </LinearGradient>

            {/* Bot Side */}
            <View style={[styles.playerHudBox, { justifyContent: 'flex-end' }]}>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.hudName, { color: colors.text }]} numberOfLines={1}>
                  {botName}
                </Text>
                <View style={styles.heartsRow}>
                  {Array.from({ length: MAX_HEARTS }).map((_, i) => (
                    <Text key={i} style={{ opacity: i < botHearts ? 1 : 0.2, fontSize: 12 }}>
                      ❤️
                    </Text>
                  ))}
                </View>
              </View>
              <View style={[styles.avatarCircle, { borderColor: '#FF3300' }]}>
                <Text style={styles.avatarText}>{botAvatar}</Text>
              </View>
            </View>
          </View>

          {/* Dual Progress Race Track */}
          <View style={styles.raceTrackContainer}>
            {/* Player Track */}
            <View style={styles.trackRow}>
              <Text style={styles.trackLabel}>YOU ({currentQIndex + 1}/15)</Text>
              <View style={styles.trackBackground}>
                <LinearGradient
                  colors={[colors.primary, colors.secondary]}
                  style={[styles.trackFill, { width: `${playerProgressPct}%` }]}
                />
              </View>
            </View>
            {/* Bot Track */}
            <View style={styles.trackRow}>
              <Text style={styles.trackLabel}>
                BOT ({botQIndex}/15) • {botStatusText}
              </Text>
              <View style={styles.trackBackground}>
                <LinearGradient
                  colors={['#FF0055', '#FF5500']}
                  style={[styles.trackFill, { width: `${botProgressPct}%` }]}
                />
              </View>
            </View>
          </View>
        </LinearGradient>

        {/* ─── MAIN QUESTION AREA ─── */}
        {!matchEnded && currentQ ? (
          <ScrollView contentContainerStyle={styles.questionContent}>
            {/* Question Header & Timer */}
            <View style={styles.questionHeader}>
              <Text style={[styles.questionNumberText, { color: colors.primary }]}>
                QUESTION {currentQIndex + 1} OF 15
              </Text>
              <View style={[styles.timerBadge, { backgroundColor: colors.surface, borderColor: colors.primary }, timeLeft <= 5 && styles.timerBadgeWarning]}>
                <Text style={styles.timerText}>⏱️ {timeLeft}s</Text>
              </View>
            </View>

            {/* Question Card */}
            <Animated.View
              style={[
                styles.questionCard,
                { backgroundColor: colors.cardBg || colors.surface, borderColor: colors.border },
                { opacity: questionFadeAnim, transform: [{ translateY: questionSlideAnim }] },
              ]}
            >
              <Text style={[styles.questionText, { color: colors.text }]}>{currentQ.question}</Text>
            </Animated.View>

            {/* Options List */}
            <View style={styles.optionsContainer}>
              {currentQ.options.map((option, idx) => {
                const isCorrectOption = showResult && idx === currentQ.answer;
                const isWrongOption = showResult && idx === selectedOption && !isCorrect;

                return (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.optionButton,
                      { backgroundColor: colors.cardBg || colors.surface, borderColor: colors.border },
                      isCorrectOption && styles.optionCorrect,
                      isWrongOption && styles.optionWrong,
                    ]}
                    activeOpacity={0.8}
                    onPress={() => handleSelectOption(idx)}
                    disabled={showResult}
                  >
                    <View style={[styles.optionIndexBadge, { backgroundColor: colors.surfaceHighlight || colors.surface }]}>
                      <Text style={[styles.optionIndexText, { color: colors.textMuted }]}>
                        {String.fromCharCode(65 + idx)}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.optionText,
                        { color: colors.text },
                        isCorrectOption && styles.optionTextCorrect,
                        isWrongOption && styles.optionTextWrong,
                      ]}
                    >
                      {option}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Next Question Button */}
            {showResult && (
              <BouncyButton style={styles.nextBtnWrapper} onPress={handleNextQuestion}>
                <LinearGradient colors={[colors.primary, colors.secondary]} style={styles.nextBtn}>
                  <Text style={styles.nextBtnText}>NEXT QUESTION ➔</Text>
                </LinearGradient>
              </BouncyButton>
            )}
          </ScrollView>
        ) : null}

        {/* ─── MATCH RESULT OVERLAY MODAL ─── */}
        {matchEnded && (
          <Animated.View style={[styles.resultOverlay, { opacity: resultFadeAnim }]}>
            <View style={[styles.resultCard, { backgroundColor: colors.cardBg || colors.surface, borderColor: colors.border }]}>
              <Text style={styles.resultTitleEmoji}>{isPlayerWinner ? '🏆' : '💀'}</Text>
              <Text style={[styles.resultTitleText, { color: colors.text }]}>
                {isPlayerWinner ? 'BOT HUMBLED & COOKED!' : 'DEFEATED BY AN AI NERD!'}
              </Text>
              <Text style={[styles.resultSubtitle, { color: colors.textMuted }]}>
                {isPlayerWinner
                  ? `You destroyed ${botName} in the 1v1 duel! Your brain cells > silicon chips.`
                  : `${botName} solved questions faster! Go revise NCERT and come back stronger.`}
              </Text>

              {/* Stats Breakdown */}
              <View style={[styles.resultStatsBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.resultRow}>
                  <Text style={[styles.resultRowLabel, { color: colors.textMuted }]}>Your Score:</Text>
                  <Text style={[styles.resultRowValue, { color: colors.text }]}>{playerScore} / 15</Text>
                </View>
                <View style={styles.resultRow}>
                  <Text style={[styles.resultRowLabel, { color: colors.textMuted }]}>Bot Score:</Text>
                  <Text style={[styles.resultRowValue, { color: colors.text }]}>{botScore} / 15</Text>
                </View>
                <View style={styles.resultRow}>
                  <Text style={[styles.resultRowLabel, { color: colors.textMuted }]}>Hearts Remaining:</Text>
                  <Text style={[styles.resultRowValue, { color: colors.text }]}>
                    {'❤️'.repeat(playerHearts) || '0'}
                  </Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.resultRow}>
                  <Text style={[styles.resultRowLabel, { color: colors.textMuted }]}>Base Victory EXP:</Text>
                  <Text style={[styles.resultRowValue, { color: colors.text }]}>+{isPlayerWinner ? 400 : 50} EXP</Text>
                </View>
                {heartBonusExp > 0 && (
                  <View style={styles.resultRow}>
                    <Text style={[styles.resultRowLabel, { color: colors.textMuted }]}>
                      ❤️ Heart Bonus ({playerHearts}/3 remaining):
                    </Text>
                    <Text style={[styles.resultRowValue, { color: colors.primary }]}>
                      +{heartBonusExp} EXP
                    </Text>
                  </View>
                )}
                <View style={[styles.resultRow, { marginTop: 6 }]}>
                  <Text style={[styles.totalExpLabel, { color: colors.primary }]}>TOTAL EXP GAINED:</Text>
                  <Text style={[styles.totalExpValue, { color: colors.primary }]}>+{expEarnedTotal} EXP</Text>
                </View>
              </View>

              <BouncyButton style={styles.finishBtnWrapper} onPress={() => router.replace('/(main)')}>
                <LinearGradient colors={[colors.primary, colors.secondary]} style={styles.finishBtn}>
                  <Text style={styles.finishBtnText}>RETURN TO ARENA ⚔️</Text>
                </LinearGradient>
              </BouncyButton>
            </View>
          </Animated.View>
        )}
      </LinearGradient>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  battleHeaderTag: {
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 46, 0, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 60, 0, 0.4)',
    marginBottom: 10,
  },
  battleHeaderText: {
    color: '#FF4500',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#140306',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FF4500',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  // HUD
  hudContainer: {
    paddingTop: 44,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1.5,
    borderColor: 'rgba(255, 50, 0, 0.35)',
  },
  hudTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  playerHudBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#0F1224',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.dark.primary,
  },
  avatarText: {
    fontSize: 20,
  },
  hudName: {
    color: Colors.dark.text,
    fontSize: 14,
    fontWeight: 'bold',
    maxWidth: 90,
  },
  heartsRow: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 2,
  },
  vsBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 46, 99, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.dark.primary,
  },
  vsText: {
    color: Colors.dark.primary,
    fontSize: 13,
    fontWeight: 'bold',
  },
  raceTrackContainer: {
    gap: 8,
    marginTop: 4,
  },
  trackRow: {
    gap: 4,
  },
  trackLabel: {
    color: Colors.dark.textMuted,
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  trackBackground: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  trackFill: {
    height: '100%',
    borderRadius: 4,
  },
  // Question Area
  questionContent: {
    padding: 20,
    paddingBottom: 40,
  },
  questionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  questionNumberText: {
    color: Colors.dark.cyan,
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  timerBadge: {
    backgroundColor: 'rgba(5, 213, 230, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.cyan,
  },
  timerBadgeWarning: {
    backgroundColor: 'rgba(255, 46, 99, 0.2)',
    borderColor: Colors.dark.danger,
  },
  timerText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  questionCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1.5,
    borderColor: Colors.dark.border,
    marginBottom: 20,
  },
  questionText: {
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 24,
  },
  optionsContainer: {
    gap: 12,
    marginBottom: 24,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1.5,
    borderColor: Colors.dark.border,
    gap: 12,
  },
  optionCorrect: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 255, 136, 0.15)',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1.5,
    borderColor: Colors.dark.success,
    gap: 12,
  },
  optionWrong: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 46, 99, 0.15)',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1.5,
    borderColor: Colors.dark.danger,
    gap: 12,
  },
  optionIndexBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionIndexText: {
    color: Colors.dark.text,
    fontSize: 13,
    fontWeight: 'bold',
  },
  optionText: {
    color: Colors.dark.text,
    fontSize: 15,
    flex: 1,
  },
  optionTextCorrect: {
    color: Colors.dark.success,
    fontSize: 15,
    fontWeight: 'bold',
    flex: 1,
  },
  optionTextWrong: {
    color: Colors.dark.danger,
    fontSize: 15,
    fontWeight: 'bold',
    flex: 1,
  },
  nextBtnWrapper: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  nextBtn: {
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 14,
  },
  nextBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  // Result Modal
  resultOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    zIndex: 99,
  },
  resultCard: {
    width: '100%',
    backgroundColor: Colors.dark.surface,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.dark.border,
  },
  resultTitleEmoji: {
    fontSize: 54,
    marginBottom: 8,
  },
  resultTitleText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.dark.text,
    letterSpacing: 1.5,
  },
  resultSubtitle: {
    color: Colors.dark.textMuted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 20,
  },
  resultStatsBox: {
    width: '100%',
    backgroundColor: '#0F1224',
    borderRadius: 16,
    padding: 16,
    gap: 8,
    marginBottom: 20,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultRowLabel: {
    color: Colors.dark.textMuted,
    fontSize: 13,
  },
  resultRowValue: {
    color: Colors.dark.text,
    fontSize: 14,
    fontWeight: 'bold',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.dark.border,
    marginVertical: 4,
  },
  totalExpLabel: {
    color: Colors.dark.cyan,
    fontSize: 13,
    fontWeight: 'bold',
  },
  totalExpValue: {
    color: Colors.dark.cyan,
    fontSize: 18,
    fontWeight: 'bold',
  },
  finishBtnWrapper: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
  },
  finishBtn: {
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 14,
  },
  finishBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
});
