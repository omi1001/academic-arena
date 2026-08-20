import { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  AppState,
  Alert,
  Vibration,
  Animated,
  Easing,
} from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useGameStore } from '../../../stores/gameStore';
import { useUserStore } from '../../../stores/userStore';
import { useAuthStore } from '../../../stores/authStore';
import { useThemeStore } from '../../../stores/themeStore';
import { Colors, Gradients } from '../../../constants/theme';
import { getStreakAtmosphere } from '../../../constants/themes';
import { soundManager } from '../../../lib/soundManager';
import { auth } from '../../../lib/firebase';
import {
  MAX_HEARTS,
  SPEED_THRESHOLDS,
  SPEED_MULTIPLIERS,
  EXP_PER_DIFFICULTY,
  COMBO_BONUS_PER_STREAK,
  MAX_COMBO_BONUS,
  PASSIVE_EXP_INTERVAL,
  PASSIVE_EXP_AMOUNT,
  INACTIVITY_TIMEOUT,
  QUESTIONS_PER_BATCH,
} from '../../../constants/config';
import api from '../../../lib/api';
import { SupabaseService } from '../../../lib/supabaseService';
import type { Question } from '../../../types';
import { BouncyButton } from '../../../components/BouncyButton';
import { SarcasticLoader } from '../../../components/SarcasticLoader';

export default function GameRunScreen() {
  const router = useRouter();
  const { runId, class: classStr, subject, packet } = useLocalSearchParams<{
    runId: string;
    class: string;
    subject: string;
    packet?: string;
  }>();

  const game = useGameStore();
  const user = useUserStore();
  const { firebaseUser } = useAuthStore();

  const [timeLeft, setTimeLeft] = useState(15);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [earnedExpToast, setEarnedExpToast] = useState<number | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const passiveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inactivityRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTouchRef = useRef(Date.now());
  const questionBatchRef = useRef<Question[]>([]);
  const questionStartTimeRef = useRef<number>(Date.now());
  const answersRecordRef = useRef<Array<{ questionId: string; selectedOption: number; timeTakenMs: number }>>([]);
  const isEndingRef = useRef(false);

  // ─── Animation Drivers ───
  const questionFadeAnim = useRef(new Animated.Value(0)).current;
  const questionSlideAnim = useRef(new Animated.Value(25)).current;
  const optionFadeAnim = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;
  const optionSlideAnim = useRef([
    new Animated.Value(20),
    new Animated.Value(20),
    new Animated.Value(20),
    new Animated.Value(20),
  ]).current;
  const heartShakeAnim = useRef(new Animated.Value(0)).current;
  const streakScaleAnim = useRef(new Animated.Value(1)).current;
  const resultFadeAnim = useRef(new Animated.Value(0)).current;
  const resultSlideAnim = useRef(new Animated.Value(40)).current;

  // Trigger question entrance animation whenever question changes
  const animateQuestionEntrance = useCallback(() => {
    questionFadeAnim.setValue(0);
    questionSlideAnim.setValue(25);
    optionFadeAnim.forEach((anim) => anim.setValue(0));
    optionSlideAnim.forEach((anim) => anim.setValue(20));

    // Question card entrance
    Animated.parallel([
      Animated.timing(questionFadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
        easing: Easing.out(Easing.quad),
      }),
      Animated.timing(questionSlideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
        easing: Easing.out(Easing.back(1.2)),
      }),
      ...optionFadeAnim.map((anim, i) =>
        Animated.timing(anim, {
          toValue: 1,
          duration: 250,
          delay: 100 + i * 60,
          useNativeDriver: true,
          easing: Easing.out(Easing.quad),
        })
      ),
      ...optionSlideAnim.map((anim, i) =>
        Animated.timing(anim, {
          toValue: 0,
          duration: 250,
          delay: 100 + i * 60,
          useNativeDriver: true,
          easing: Easing.out(Easing.quad),
        })
      ),
    ]).start();
  }, [optionFadeAnim, optionSlideAnim, questionFadeAnim, questionSlideAnim]);

  // Initialize game run & Continuous Background Music
  useEffect(() => {
    const initialPacket = packet ? parseInt(packet) : 1;
    game.startRun(runId!, parseInt(classStr!), subject!, initialPacket);
    fetchQuestions();
    soundManager.startBgm();

    return () => {
      soundManager.stopBgm();
      if (timerRef.current) clearInterval(timerRef.current);
      if (passiveRef.current) clearInterval(passiveRef.current);
      if (inactivityRef.current) clearInterval(inactivityRef.current);
    };
  }, []);

  // Trigger question entry animation on new currentQuestion
  useEffect(() => {
    if (game.currentQuestion) {
      animateQuestionEntrance();
    }
  }, [game.currentQuestion, animateQuestionEntrance]);

  // AppState anti-cheat with safe 10-second background debounce
  useEffect(() => {
    let backgroundTimer: ReturnType<typeof setTimeout> | null = null;

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' && game.isGameActive) {
        // Debounce to prevent false-positives on quick notifications or audio focus changes
        backgroundTimer = setTimeout(() => {
          if (game.isGameActive) {
            endGame('cheat_detected');
          }
        }, 10000);
      } else if (state === 'active') {
        if (backgroundTimer) {
          clearTimeout(backgroundTimer);
          backgroundTimer = null;
        }
      }
    });

    return () => {
      if (backgroundTimer) clearTimeout(backgroundTimer);
      sub.remove();
    };
  }, [game.isGameActive]);

  // Passive EXP accumulation
  useEffect(() => {
    if (!game.isGameActive) return;
    passiveRef.current = setInterval(() => {
      game.addExp(PASSIVE_EXP_AMOUNT);
    }, PASSIVE_EXP_INTERVAL);
    return () => {
      if (passiveRef.current) clearInterval(passiveRef.current);
    };
  }, [game.isGameActive]);

  // Inactivity timeout
  useEffect(() => {
    inactivityRef.current = setInterval(() => {
      if (Date.now() - lastTouchRef.current >= INACTIVITY_TIMEOUT) {
        endGame('timeout');
      }
    }, 30000);
    return () => {
      if (inactivityRef.current) clearInterval(inactivityRef.current);
    };
  }, []);

  // Timer countdown
  useEffect(() => {
    if (showResult || isLoading || !game.currentQuestion) return;
    setTimeLeft(15);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleAnswer(-1);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [game.currentQuestion, showResult, isLoading]);

  const fetchQuestions = async () => {
    try {
      setIsLoading(true);
      const classNum = parseInt(classStr || `${user.profile?.class || 10}`);
      const subjectName = subject || game.selectedSubject || 'Mathematics';

      // 1. Direct fetch from Supabase (sub-100ms speed!)
      let list: Question[] = await SupabaseService.getRandomQuestions(classNum, subjectName, QUESTIONS_PER_BATCH);

      // 2. Fallback to API if Supabase query returned empty
      if (list.length === 0) {
        try {
          const res = await api.get('/questions', {
            params: {
              class: classStr,
              subject: subjectName,
              limit: 20,
              random: 'true',
            },
          });
          const fetched = Array.isArray(res.data) ? res.data : res.data?.questions;
          if (Array.isArray(fetched) && fetched.length > 0) {
            list = fetched;
          }
        } catch (err) {
          console.warn('API fallback fetch failed:', err);
        }
      }

      if (list.length > 0) {
        const shuffled = [...list].sort(() => Math.random() - 0.5);
        questionBatchRef.current = shuffled;
        game.setQuestions(shuffled);
        game.resetQuestionIndex();
        game.setQuestion(shuffled[0]);
      } else {
        endGame('completed');
      }
    } catch (e) {
      console.warn('Failed to fetch questions:', e);
      endGame('completed');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateEXP = useCallback(() => {
    let base = game.currentDifficulty * EXP_PER_DIFFICULTY;
    let multiplier: number = SPEED_MULTIPLIERS.NORMAL;

    if (game.lastAnswerTime) {
      const elapsed = (Date.now() - game.lastAnswerTime) / 1000;
      if (elapsed < SPEED_THRESHOLDS.FAST) multiplier = SPEED_MULTIPLIERS.FAST;
      else if (elapsed < SPEED_THRESHOLDS.MEDIUM) multiplier = SPEED_MULTIPLIERS.MEDIUM;
    }

    const comboBonus = Math.min(
      game.streak * COMBO_BONUS_PER_STREAK,
      MAX_COMBO_BONUS
    );

    return Math.round(base * multiplier + comboBonus);
  }, [game.currentDifficulty, game.streak, game.lastAnswerTime]);

  const animateResultToast = () => {
    resultFadeAnim.setValue(0);
    resultSlideAnim.setValue(40);
    Animated.parallel([
      Animated.timing(resultFadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(resultSlideAnim, {
        toValue: 0,
        friction: 6,
        tension: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleAnswer = (optionIndex: number) => {
    if (showResult || !game.currentQuestion) return;
    if (timerRef.current) clearInterval(timerRef.current);

    const now = Date.now();
    const timeTakenMs = Math.max(100, now - (questionStartTimeRef.current || now));
    lastTouchRef.current = now;
    setSelectedOption(optionIndex);

    // Record answer telemetry for S-Tier backend verification
    if (game.currentQuestion?._id) {
      answersRecordRef.current.push({
        questionId: game.currentQuestion._id,
        selectedOption: optionIndex,
        timeTakenMs,
      });
    }

    const correct = optionIndex === game.currentQuestion.answer;
    setIsCorrect(correct);
    setShowResult(true);
    animateResultToast();

    if (correct) {
      const nextStreak = game.streak + 1;
      // Trigger "MUDA MUDA MUDA!" on big streaks, otherwise hype correct audio
      if (nextStreak >= 3 && (nextStreak % 3 === 0 || nextStreak % 5 === 0)) {
        soundManager.playMudaMuda();
      } else {
        soundManager.playCorrect();
      }

      const exp = calculateEXP();
      setEarnedExpToast(exp);
      game.correctAnswer(exp);
      game.markQuestionAnswered(game.currentQuestion._id);
      user.addExp(exp);
      user.incrementQuestions(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Streak bounce animation
      Animated.sequence([
        Animated.timing(streakScaleAnim, {
          toValue: 1.35,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.spring(streakScaleAnim, {
          toValue: 1,
          friction: 4,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Sarcastic meme sound (Faah! / Chii Sasur / Aayein / Bruh)
      soundManager.playWrong();

      setEarnedExpToast(null);
      game.markQuestionAnswered(game.currentQuestion._id);
      const remaining = game.incorrectAnswer();
      user.incrementQuestions(false);
      Vibration.vibrate(250);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      // Heart shake animation
      Animated.sequence([
        Animated.timing(heartShakeAnim, { toValue: -12, duration: 40, useNativeDriver: true }),
        Animated.timing(heartShakeAnim, { toValue: 12, duration: 40, useNativeDriver: true }),
        Animated.timing(heartShakeAnim, { toValue: -8, duration: 40, useNativeDriver: true }),
        Animated.timing(heartShakeAnim, { toValue: 8, duration: 40, useNativeDriver: true }),
        Animated.timing(heartShakeAnim, { toValue: 0, duration: 40, useNativeDriver: true }),
      ]).start();

      if (remaining <= 0) {
        setTimeout(() => endGame('completed'), 1500);
        return;
      }
    }

    setTimeout(() => {
      setShowResult(false);
      setSelectedOption(null);
      setEarnedExpToast(null);
      loadNextQuestion();
    }, 1500);
  };

  const loadNextQuestion = () => {
    questionStartTimeRef.current = Date.now();
    const nextIndex = game.questionIndex;
    if (nextIndex < game.questions.length) {
      game.setQuestion(game.questions[nextIndex]);
    } else {
      fetchQuestions();
    }
  };

  const saveRunToServer = async (status: 'completed' | 'cheat_detected' | 'timeout'): Promise<boolean> => {
    try {
      const payloadClass = classStr ? parseInt(classStr) : (user.profile?.class || 10);
      const payloadSubject = subject || game.selectedSubject || 'Mathematics';
      const payloadRunId = runId || game.runId || `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const payloadStartTime = game.startTime && game.startTime > 0 ? game.startTime : Date.now() - 60000;
      const scoreVal = game.score || 0;
      const totalAnsweredVal = Math.max(game.totalQuestionsAnswered || 0, scoreVal);
      const expVal = game.expEarned || 0;
      const currentUid = firebaseUser?.uid || user.profile?.uid || auth.currentUser?.uid || 'anonymous';

      // 1. Record completed run and atomically update user EXP in Supabase
      await SupabaseService.recordCompletedRun({
        firebaseUid: currentUid,
        runId: payloadRunId,
        classNum: payloadClass,
        subject: payloadSubject,
        mode: 'solo',
        score: scoreVal,
        correctAnswers: scoreVal,
        questionsAnswered: totalAnsweredVal,
        expEarned: expVal,
        maxStreak: game.maxStreak || 0,
        highestDifficulty: game.currentDifficulty || 1,
        heartsRemaining: game.hearts || 0,
        status,
        answers: answersRecordRef.current,
      });

      // 2. Immediately update local Zustand user profile
      if (user.profile) {
        user.setProfile({
          ...user.profile,
          totalEXP: (user.profile.totalEXP || 0) + expVal,
          gamesPlayed: (user.profile.gamesPlayed || 0) + 1,
          totalAnswered: (user.profile.totalAnswered || 0) + totalAnsweredVal,
          totalCorrect: (user.profile.totalCorrect || 0) + scoreVal,
        });
      }

      // Legacy API fallback
      try {
        await api.post('/runs', {
          runId: payloadRunId,
          class: payloadClass,
          subject: payloadSubject,
          score: scoreVal,
          expEarned: expVal,
          questionsAnswered: totalAnsweredVal,
          correctAnswers: scoreVal,
          maxStreak: game.maxStreak || 0,
          highestDifficulty: game.currentDifficulty || 1,
          heartsRemaining: game.hearts || 0,
          startTime: payloadStartTime,
          status,
          answers: answersRecordRef.current,
        });
      } catch (ignored) {}

      return true;
    } catch (e: any) {
      console.warn('Failed to save run:', e);
      return false;
    }
  };

  const endGame = async (status: 'completed' | 'cheat_detected' | 'timeout') => {
    if (isEndingRef.current) return;
    isEndingRef.current = true;

    soundManager.stopBgm();
    game.endRun();
    if (timerRef.current) clearInterval(timerRef.current);
    if (passiveRef.current) clearInterval(passiveRef.current);
    if (inactivityRef.current) clearInterval(inactivityRef.current);

    if (game.hearts > 0 && game.score > 0) {
      soundManager.playVictory();
    } else {
      soundManager.playDefeat();
    }

    user.incrementGamesPlayed();

    let runSaved = await saveRunToServer(status);

    if (runSaved) {
      try {
        const res = await api.get('/auth/profile');
        if (res.data?.user) {
          user.setProfile(res.data.user as any);
        }
      } catch (e) {
        console.warn('Failed to refresh profile:', e);
      }
    }

    if (status === 'cheat_detected') {
      Alert.alert(
        'Game Ended',
        'You left the app during a run. Your score has been recorded.',
        [{ text: 'OK', onPress: () => router.replace('/(main)') }]
      );
    } else if (!runSaved) {
      Alert.alert(
        'Score Not Saved',
        'Your score could not be saved to the server. Your local stats are still updated.',
        [
          {
            text: 'Retry',
            onPress: async () => {
              const retried = await saveRunToServer(status);
              if (retried) {
                try {
                  const res = await api.get('/auth/profile');
                  if (res.data?.user) user.setProfile(res.data.user as any);
                } catch (e) {}
                router.replace('/(main)');
              } else {
                Alert.alert(
                  'Still Failed',
                  'Could not reach server. Returning to home.',
                  [{ text: 'OK', onPress: () => router.replace('/(main)') }]
                );
              }
            },
          },
          { text: 'Skip', onPress: () => router.replace('/(main)') },
        ]
      );
    } else {
      router.replace('/(main)');
    }
  };

  const currentAtmosphere = getStreakAtmosphere(game.streak);
  const { getColors, mode } = useThemeStore();
  const colors = getColors();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient
        colors={currentAtmosphere.gradient as [string, string, ...string[]]}
        style={styles.container}
      >
        <TouchableOpacity
          style={styles.touchWrapper}
          activeOpacity={1}
          onPress={() => {
            lastTouchRef.current = Date.now();
          }}
        >
          {/* ─── Top HUD Bar ─── */}
          <View style={styles.topBar}>
            <Animated.View style={[styles.heartsCard, { backgroundColor: colors.surface, borderColor: colors.border, transform: [{ translateX: heartShakeAnim }] }]}>
              {Array.from({ length: MAX_HEARTS }).map((_, i) => (
                <Text key={i} style={styles.heart}>
                  {i < game.hearts ? '❤️' : '🖤'}
                </Text>
              ))}
            </Animated.View>

            <View style={[styles.scoreCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.scoreValue, { color: colors.text }]}>{game.score}</Text>
              <Text style={[styles.hudLabel, { color: colors.textMuted }]}>SCORE</Text>
            </View>

            <View style={[styles.expCard, { backgroundColor: colors.surface, borderColor: colors.primary }]}>
              <Text style={[styles.expValue, { color: colors.primary }]}>⚡ {game.expEarned}</Text>
              <Text style={[styles.hudLabel, { color: colors.textMuted }]}>TOTAL EXP</Text>
            </View>
          </View>

          {/* ─── Difficulty & Timer Track ─── */}
          <View style={styles.difficultyBar}>
            <View style={styles.difficultyLabelRow}>
              <View style={[styles.difficultyBadge, { backgroundColor: colors.surface, borderColor: colors.primary }]}>
                <Text style={[styles.difficultyText, { color: colors.primary }]}>
                  LVL {game.currentDifficulty}
                </Text>
              </View>
              <View style={[styles.packetBadge, { backgroundColor: colors.surface, borderColor: colors.secondary || '#9B51E0' }]}>
                <Text style={[styles.packetBadgeText, { color: colors.secondary || '#9B51E0' }]}>
                  🎯 Q #{game.totalQuestionsAnswered + 1}
                </Text>
              </View>
              {game.streak > 0 && (
                <Animated.View
                  style={[
                    styles.streakBadge,
                    { backgroundColor: currentAtmosphere.badgeBg, borderColor: currentAtmosphere.accent, transform: [{ scale: streakScaleAnim }] },
                  ]}
                >
                  <Text style={[styles.streakText, { color: currentAtmosphere.accent }]}>
                    🔥 STREAK x{game.streak} • {currentAtmosphere.tag}
                  </Text>
                </Animated.View>
              )}
              <Text style={[styles.timerNumber, { color: colors.textMuted }]}>{timeLeft}s</Text>
            </View>

          <View style={[styles.timerTrack, { backgroundColor: colors.border || 'rgba(255,255,255,0.1)' }]}>
            <LinearGradient
              colors={
                timeLeft <= 4
                  ? [Colors.dark.danger, '#FF0055']
                  : timeLeft <= 8
                    ? [Colors.dark.warning, '#FF9900']
                    : [colors.primary, colors.secondary]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.timerFill, { width: `${(timeLeft / 15) * 100}%` }]}
            />
          </View>
        </View>

        {/* ─── Question Card & Choices ─── */}
        <View style={styles.questionArea}>
          {isLoading ? (
            <SarcasticLoader
              fullScreen={false}
              title="FETCHING ARENA QUESTION"
              subtitle="Shuffling through all subject chapters..."
            />
          ) : game.currentQuestion ? (
            <>
              {/* Animated Question Text Box */}
              <Animated.View
                style={{
                  opacity: questionFadeAnim,
                  transform: [{ translateY: questionSlideAnim }],
                }}
              >
                <LinearGradient
                  colors={mode === 'dark' ? ['#161B33', '#0F1224'] : ['#FFFFFF', '#F1F5F9']}
                  style={[styles.questionCard, { borderColor: colors.border }]}
                >
                  <Text style={[styles.questionText, { color: colors.text }]}>
                    {game.currentQuestion.question}
                  </Text>
                </LinearGradient>
              </Animated.View>

              {/* Animated Options */}
              <View style={styles.optionsContainer}>
                {game.currentQuestion.options.map((option, index) => {
                  const isAnswer = index === game.currentQuestion?.answer;
                  const isSelected = index === selectedOption;

                  return (
                    <Animated.View
                      key={index}
                      style={{
                        opacity: optionFadeAnim[index] || 1,
                        transform: [{ translateY: optionSlideAnim[index] || 0 }],
                      }}
                    >
                      <BouncyButton
                        onPress={() => handleAnswer(index)}
                        disabled={showResult}
                        style={styles.optionWrapper}
                      >
                        <View
                          style={[
                            styles.optionCard,
                            { backgroundColor: colors.surface, borderColor: colors.border },
                            showResult && isAnswer && styles.optionCardCorrect,
                            showResult && isSelected && !isCorrect && styles.optionCardWrong,
                          ]}
                        >
                          <View
                            style={[
                              styles.optionBadge,
                              { backgroundColor: colors.surfaceHighlight || colors.surface },
                              showResult && isAnswer && styles.optionBadgeCorrect,
                              showResult && isSelected && !isCorrect && styles.optionBadgeWrong,
                            ]}
                          >
                            <Text
                              style={[
                                styles.optionBadgeText,
                                { color: colors.textMuted },
                                showResult && isAnswer && styles.optionBadgeTextActive,
                                showResult && isSelected && !isCorrect && styles.optionBadgeTextActive,
                              ]}
                            >
                              {String.fromCharCode(65 + index)}
                            </Text>
                          </View>

                          <Text style={[styles.optionText, { color: colors.text }]}>{option}</Text>
                        </View>
                      </BouncyButton>
                    </Animated.View>
                  );
                })}
              </View>
            </>
          ) : (
            <Text style={styles.loadingText}>NO MORE QUESTIONS</Text>
          )}
        </View>

        {/* ─── Animated Result Toast Banner ─── */}
        {showResult && (
          <Animated.View
            style={[
              styles.resultBannerWrapper,
              {
                opacity: resultFadeAnim,
                transform: [{ translateY: resultSlideAnim }],
              },
            ]}
          >
            <LinearGradient
              colors={isCorrect ? Gradients.success : Gradients.fire}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.resultBanner}
            >
              <Text style={styles.resultText}>
                {isCorrect
                  ? `⚡ 200 IQ MOVE! +${earnedExpToast || 100} EXP`
                  : '💨 BRO THOUGHT HE COOKED! -1 ❤️'}
              </Text>
            </LinearGradient>
          </Animated.View>
        )}
        </TouchableOpacity>
      </LinearGradient>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  touchWrapper: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  heartsCard: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: Colors.dark.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  heart: {
    fontSize: 18,
  },
  scoreCard: {
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  scoreValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.dark.text,
  },
  hudLabel: {
    fontSize: 9,
    color: Colors.dark.textMuted,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  expCard: {
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.cyan,
  },
  expValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.dark.cyan,
  },
  difficultyBar: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  difficultyLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  difficultyBadge: {
    backgroundColor: 'rgba(5, 213, 230, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.dark.cyan,
  },
  difficultyText: {
    fontSize: 11,
    color: Colors.dark.cyan,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  packetBadge: {
    backgroundColor: 'rgba(155, 81, 224, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#9B51E0',
  },
  packetBadgeText: {
    fontSize: 11,
    color: '#D6A4FF',
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  streakBadge: {
    backgroundColor: 'rgba(255, 81, 47, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FF512F',
  },
  streakText: {
    fontSize: 11,
    color: '#FF512F',
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  timerNumber: {
    fontSize: 13,
    color: Colors.dark.textMuted,
    fontWeight: 'bold',
  },
  timerTrack: {
    height: 6,
    backgroundColor: Colors.dark.surfaceBorder,
    borderRadius: 3,
    overflow: 'hidden',
  },
  timerFill: {
    height: '100%',
    borderRadius: 3,
  },
  questionArea: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  loadingBox: {
    alignItems: 'center',
    padding: 30,
  },
  loadingText: {
    textAlign: 'center',
    color: Colors.dark.textMuted,
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  questionCard: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    elevation: 6,
  },
  questionText: {
    fontSize: 19,
    fontWeight: '600',
    color: Colors.dark.text,
    lineHeight: 28,
  },
  optionsContainer: {
    gap: 12,
  },
  optionWrapper: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1.5,
    borderColor: Colors.dark.border,
  },
  optionCardCorrect: {
    backgroundColor: 'rgba(0, 245, 160, 0.15)',
    borderColor: Colors.dark.success,
  },
  optionCardWrong: {
    backgroundColor: 'rgba(255, 46, 99, 0.15)',
    borderColor: Colors.dark.danger,
  },
  optionBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.dark.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  optionBadgeCorrect: {
    backgroundColor: Colors.dark.success,
  },
  optionBadgeWrong: {
    backgroundColor: Colors.dark.danger,
  },
  optionBadgeText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.dark.textMuted,
  },
  optionBadgeTextActive: {
    color: '#000',
  },
  optionText: {
    fontSize: 15,
    color: Colors.dark.text,
    fontWeight: '600',
    flex: 1,
  },
  resultBannerWrapper: {
    position: 'absolute',
    bottom: 36,
    left: 20,
    right: 20,
  },
  resultBanner: {
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowRadius: 10,
    shadowOpacity: 0.5,
  },
  resultText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
});
