import { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  AppState,
  Alert,
  Vibration,
} from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useGameStore } from '../../../stores/gameStore';
import { useUserStore } from '../../../stores/userStore';
import { Colors, Gradients } from '../../../constants/theme';
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
import type { Question } from '../../../types';
import { BouncyButton } from '../../../components/BouncyButton';

export default function GameRunScreen() {
  const router = useRouter();
  const { runId, class: classStr, subject } = useLocalSearchParams<{
    runId: string;
    class: string;
    subject: string;
  }>();

  const game = useGameStore();
  const user = useUserStore();

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

  // Initialize game run
  useEffect(() => {
    game.startRun(runId!, parseInt(classStr!), subject!);
    fetchQuestions();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (passiveRef.current) clearInterval(passiveRef.current);
      if (inactivityRef.current) clearInterval(inactivityRef.current);
    };
  }, []);

  // AppState anti-cheat
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active' && game.isGameActive) {
        endGame('cheat_detected');
      }
    });
    return () => sub.remove();
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
      const res = await api.get('/questions', {
        params: {
          class: classStr,
          subject,
          difficulty: game.currentDifficulty,
          exclude: game.answeredQuestionIds.join(','),
          limit: QUESTIONS_PER_BATCH,
        },
      });
      if (res.data.length > 0) {
        questionBatchRef.current = res.data;
        game.setQuestions(res.data);
        game.resetQuestionIndex();
        game.setQuestion(res.data[0]);
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

  const handleAnswer = (optionIndex: number) => {
    if (showResult || !game.currentQuestion) return;
    if (timerRef.current) clearInterval(timerRef.current);

    lastTouchRef.current = Date.now();
    setSelectedOption(optionIndex);

    const correct = optionIndex === game.currentQuestion.answer;
    setIsCorrect(correct);
    setShowResult(true);

    if (correct) {
      const exp = calculateEXP();
      setEarnedExpToast(exp);
      game.correctAnswer(exp);
      game.markQuestionAnswered(game.currentQuestion._id);
      user.addExp(exp);
      user.incrementQuestions(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      setEarnedExpToast(null);
      game.markQuestionAnswered(game.currentQuestion._id);
      const remaining = game.incorrectAnswer();
      user.incrementQuestions(false);
      Vibration.vibrate(250);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

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
    const nextIndex = game.questionIndex;
    if (nextIndex < game.questions.length) {
      game.setQuestion(game.questions[nextIndex]);
    } else {
      fetchQuestions();
    }
  };

  const isEndingRef = useRef(false);

  const endGame = async (status: 'completed' | 'cheat_detected' | 'timeout') => {
    if (isEndingRef.current) return;
    isEndingRef.current = true;

    game.endRun();
    if (timerRef.current) clearInterval(timerRef.current);
    if (passiveRef.current) clearInterval(passiveRef.current);
    if (inactivityRef.current) clearInterval(inactivityRef.current);

    user.incrementGamesPlayed();

    let runSaved = false;
    try {
      await api.post('/runs', {
        runId,
        class: classStr,
        subject,
        score: game.score,
        expEarned: game.expEarned,
        questionsAnswered: game.totalQuestionsAnswered,
        correctAnswers: game.score,
        maxStreak: game.maxStreak,
        highestDifficulty: game.currentDifficulty,
        heartsRemaining: game.hearts,
        startTime: game.startTime,
        status,
      });
      runSaved = true;
    } catch (e) {
      console.warn('Failed to save run:', e);
    }

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
        [{ text: 'OK', onPress: () => router.replace('/(main)') }]
      );
    } else {
      router.replace('/(main)');
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <TouchableOpacity
        style={styles.container}
        activeOpacity={1}
        onPress={() => {
          lastTouchRef.current = Date.now();
        }}
      >
        {/* ─── Top HUD Bar ─── */}
        <View style={styles.topBar}>
          <View style={styles.heartsCard}>
            {Array.from({ length: MAX_HEARTS }).map((_, i) => (
              <Text key={i} style={styles.heart}>
                {i < game.hearts ? '❤️' : '🖤'}
              </Text>
            ))}
          </View>

          <View style={styles.scoreCard}>
            <Text style={styles.scoreValue}>{game.score}</Text>
            <Text style={styles.hudLabel}>SCORE</Text>
          </View>

          <View style={styles.expCard}>
            <Text style={styles.expValue}>⚡ {game.expEarned}</Text>
            <Text style={styles.hudLabel}>TOTAL EXP</Text>
          </View>
        </View>

        {/* ─── Difficulty & Timer Track ─── */}
        <View style={styles.difficultyBar}>
          <View style={styles.difficultyLabelRow}>
            <View style={styles.difficultyBadge}>
              <Text style={styles.difficultyText}>
                LVL {game.currentDifficulty}
              </Text>
            </View>
            {game.streak > 0 && (
              <View style={styles.streakBadge}>
                <Text style={styles.streakText}>🔥 STREAK x{game.streak}</Text>
              </View>
            )}
            <Text style={styles.timerNumber}>{timeLeft}s</Text>
          </View>

          <View style={styles.timerTrack}>
            <LinearGradient
              colors={
                timeLeft <= 4
                  ? [Colors.dark.danger, '#FF0055']
                  : timeLeft <= 8
                    ? [Colors.dark.warning, '#FF9900']
                    : Gradients.cyan
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
            <View style={styles.loadingBox}>
              <Text style={styles.loadingText}>FETCHING ARENA QUESTION...</Text>
            </View>
          ) : game.currentQuestion ? (
            <>
              {/* Question Text Box */}
              <LinearGradient colors={['#161B33', '#0F1224']} style={styles.questionCard}>
                <Text style={styles.questionText}>
                  {game.currentQuestion.question}
                </Text>
              </LinearGradient>

              {/* Options */}
              <View style={styles.optionsContainer}>
                {game.currentQuestion.options.map((option, index) => {
                  const isAnswer = index === game.currentQuestion?.answer;
                  const isSelected = index === selectedOption;

                  return (
                    <BouncyButton
                      key={index}
                      onPress={() => handleAnswer(index)}
                      disabled={showResult}
                      style={styles.optionWrapper}
                    >
                      <View
                        style={[
                          styles.optionCard,
                          showResult && isAnswer && styles.optionCardCorrect,
                          showResult && isSelected && !isCorrect && styles.optionCardWrong,
                        ]}
                      >
                        <View
                          style={[
                            styles.optionBadge,
                            showResult && isAnswer && styles.optionBadgeCorrect,
                            showResult && isSelected && !isCorrect && styles.optionBadgeWrong,
                          ]}
                        >
                          <Text
                            style={[
                              styles.optionBadgeText,
                              showResult && isAnswer && styles.optionBadgeTextActive,
                              showResult && isSelected && !isCorrect && styles.optionBadgeTextActive,
                            ]}
                          >
                            {String.fromCharCode(65 + index)}
                          </Text>
                        </View>

                        <Text style={styles.optionText}>{option}</Text>
                      </View>
                    </BouncyButton>
                  );
                })}
              </View>
            </>
          ) : (
            <Text style={styles.loadingText}>NO MORE QUESTIONS</Text>
          )}
        </View>

        {/* ─── Result Toast Banner ─── */}
        {showResult && (
          <LinearGradient
            colors={
              isCorrect ? Gradients.success : Gradients.fire
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.resultBanner}
          >
            <Text style={styles.resultText}>
              {isCorrect
                ? `⚡ PERFECT! +${earnedExpToast || 100} EXP`
                : '💥 INCORRECT! -1 HEART'}
            </Text>
          </LinearGradient>
        )}
      </TouchableOpacity>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
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
  resultBanner: {
    position: 'absolute',
    bottom: 36,
    left: 20,
    right: 20,
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
