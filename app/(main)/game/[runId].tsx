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
import * as Haptics from 'expo-haptics';
import { useGameStore } from '../../../stores/gameStore';
import { useUserStore } from '../../../stores/userStore';
import { Colors } from '../../../constants/theme';
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
  const [passiveExp, setPassiveExp] = useState(0);

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
      setPassiveExp((prev) => prev + PASSIVE_EXP_AMOUNT);
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
      questionBatchRef.current = res.data;
      if (res.data.length > 0) {
        game.setQuestions(res.data);
        game.setQuestion(res.data[0]);
      }
    } catch (e) {
      console.warn('Failed to fetch questions:', e);
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
      game.correctAnswer(exp);
      user.addExp(exp);
      user.incrementQuestions(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      const remaining = game.incorrectAnswer();
      user.incrementQuestions(false);
      Vibration.vibrate(200);

      if (remaining <= 0) {
        setTimeout(() => endGame('completed'), 1500);
        return;
      }
    }

    setTimeout(() => {
      setShowResult(false);
      setSelectedOption(null);
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

  const endGame = async (status: 'completed' | 'cheat_detected' | 'timeout') => {
    game.endRun();
    if (timerRef.current) clearInterval(timerRef.current);
    if (passiveRef.current) clearInterval(passiveRef.current);
    if (inactivityRef.current) clearInterval(inactivityRef.current);

    user.incrementGamesPlayed();

    try {
      await api.post('/runs', {
        runId,
        class: classStr,
        subject,
        score: game.score,
        expEarned: game.expEarned,
        questionsAnswered: game.questionIndex,
        correctAnswers: game.score,
        maxStreak: game.maxStreak,
        highestDifficulty: game.currentDifficulty,
        heartsRemaining: game.hearts,
        startTime: game.startTime,
        status,
      });
    } catch (e) {
      console.warn('Failed to save run:', e);
    }

    if (status === 'cheat_detected') {
      Alert.alert(
        'Game Ended',
        'You left the app during a run. Your score has been recorded.',
        [{ text: 'OK', onPress: () => router.replace('/(main)') }]
      );
    } else {
      router.replace('/(main)');
    }
  };

  const getOptionStyle = (index: number) => {
    if (!showResult) return styles.option;
    if (index === game.currentQuestion?.answer) return styles.optionCorrect;
    if (index === selectedOption && !isCorrect) return styles.optionWrong;
    return styles.option;
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
        <View style={styles.topBar}>
          <View style={styles.heartsRow}>
            {Array.from({ length: MAX_HEARTS }).map((_, i) => (
              <Text key={i} style={styles.heart}>
                {i < game.hearts ? '❤️' : '🖤'}
              </Text>
            ))}
          </View>
          <View style={styles.scoreArea}>
            <Text style={styles.score}>{game.score}</Text>
            <Text style={styles.scoreLabel}>Score</Text>
          </View>
          <View style={styles.expArea}>
            <Text style={styles.exp}>{game.expEarned + passiveExp}</Text>
            <Text style={styles.expLabel}>EXP</Text>
          </View>
        </View>

        <View style={styles.difficultyBar}>
          <View style={styles.difficultyLabel}>
            <Text style={styles.difficultyText}>
              Difficulty: {game.currentDifficulty}
            </Text>
            <Text style={styles.streakText}>
              {game.streak > 0 ? `🔥 ${game.streak} streak` : ''}
            </Text>
          </View>
          <View style={styles.timerTrack}>
            <View
              style={[
                styles.timerFill,
                {
                  width: `${(timeLeft / 15) * 100}%`,
                  backgroundColor:
                    timeLeft <= 5 ? Colors.dark.danger : Colors.dark.primary,
                },
              ]}
            />
          </View>
          <Text style={styles.timerText}>{timeLeft}s</Text>
        </View>

        <View style={styles.questionArea}>
          {isLoading ? (
            <Text style={styles.loadingText}>Loading questions...</Text>
          ) : game.currentQuestion ? (
            <>
              <Text style={styles.questionText}>
                {game.currentQuestion.question}
              </Text>

              <View style={styles.optionsContainer}>
                {game.currentQuestion.options.map((option, index) => (
                  <TouchableOpacity
                    key={index}
                    style={getOptionStyle(index)}
                    onPress={() => handleAnswer(index)}
                    disabled={showResult}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.optionLabel}>
                      {String.fromCharCode(65 + index)}
                    </Text>
                    <Text style={styles.optionText}>{option}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          ) : (
            <Text style={styles.loadingText}>No more questions</Text>
          )}
        </View>

        {showResult && (
          <View
            style={[
              styles.resultBanner,
              isCorrect ? styles.resultCorrect : styles.resultWrong,
            ]}
          >
            <Text style={styles.resultText}>
              {isCorrect ? 'Correct!' : 'Wrong!'}
            </Text>
          </View>
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
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  heartsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  heart: {
    fontSize: 24,
  },
  scoreArea: {
    alignItems: 'center',
  },
  score: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.dark.text,
  },
  scoreLabel: {
    fontSize: 11,
    color: Colors.dark.textMuted,
  },
  expArea: {
    alignItems: 'center',
  },
  exp: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.dark.primary,
  },
  expLabel: {
    fontSize: 11,
    color: Colors.dark.textMuted,
  },
  difficultyBar: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  difficultyLabel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  difficultyText: {
    fontSize: 13,
    color: Colors.dark.textMuted,
  },
  streakText: {
    fontSize: 13,
    color: Colors.dark.warning,
    fontWeight: '600',
  },
  timerTrack: {
    height: 4,
    backgroundColor: Colors.dark.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  timerFill: {
    height: '100%',
    borderRadius: 2,
  },
  timerText: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    textAlign: 'right',
    marginTop: 4,
  },
  questionArea: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  loadingText: {
    textAlign: 'center',
    color: Colors.dark.textMuted,
    fontSize: 16,
  },
  questionText: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.dark.text,
    lineHeight: 28,
    marginBottom: 32,
  },
  optionsContainer: {
    gap: 12,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionCorrect: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00C85320',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: Colors.dark.success,
  },
  optionWrong: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF174420',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: Colors.dark.danger,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.dark.textMuted,
    marginRight: 12,
    width: 24,
  },
  optionText: {
    fontSize: 16,
    color: Colors.dark.text,
    flex: 1,
  },
  resultBanner: {
    position: 'absolute',
    bottom: 40,
    left: 24,
    right: 24,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  resultCorrect: {
    backgroundColor: Colors.dark.success,
  },
  resultWrong: {
    backgroundColor: Colors.dark.danger,
  },
  resultText: {
    color: Colors.dark.text,
    fontSize: 18,
    fontWeight: 'bold',
  },
});
