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
import { useUserStore } from '../../../stores/userStore';
import { Colors, Gradients } from '../../../constants/theme';
import { MAX_HEARTS, LEADERBOARD_TIERS } from '../../../constants/config';
import api from '../../../lib/api';
import type { Question } from '../../../types';
import { BouncyButton } from '../../../components/BouncyButton';

const TOTAL_CHALLENGE_QUESTIONS = 15;

const BOT_NAMES = [
  'CyberNinja',
  'QuantumRacer',
  'Titan_Class10',
  'ApexScholar',
  'Vortex_Pro',
  'HyperSonic',
  'ShadowStrike',
  'BlazeRunner',
  'AuraMaster',
  'NovaRider',
];

const BOT_AVATARS = ['🤖', '🥷', '⚡', '🦅', '🦁', '🔥', '👑', '👾'];

export default function ChallengeGameScreen() {
  const router = useRouter();
  const { runId, class: classStr, subject, packet } = useLocalSearchParams<{
    runId: string;
    class: string;
    subject: string;
    packet?: string;
  }>();

  const { profile, setProfile } = useUserStore();
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

  // Fetch Questions (Exactly 15 questions with auto packet progression & variety)
  const fetchQuestions = async () => {
    try {
      setIsLoading(true);
      const wins = profile?.challengeWins || 0;
      const basePacket = packet ? parseInt(packet) : 1;
      // Auto-advance packet on challenge wins so user receives a fresh packet each win!
      const effectivePacket = ((basePacket - 1 + wins) % 10) + 1;
      // Scale target difficulty dynamically with challenge wins (1 to 10)
      const targetDiff = Math.min(10, Math.floor(wins / 2) + 1);

      const res = await api.get('/questions', {
        params: {
          class: classStr,
          subject,
          limit: TOTAL_CHALLENGE_QUESTIONS,
          packet: effectivePacket,
          difficulty: targetDiff,
          random: 'true',
          mode: 'challenge',
        },
      });
      const qList = Array.isArray(res.data) ? res.data : res.data?.questions;
      if (qList && qList.length > 0) {
        // Shuffle questions on client side for guaranteed variety
        const shuffled = [...qList].sort(() => Math.random() - 0.5);
        setQuestions(shuffled.slice(0, TOTAL_CHALLENGE_QUESTIONS));
      } else {
        Alert.alert('Error', 'No questions available for this subject packet.');
        router.back();
      }
    } catch (e) {
      console.warn('Failed to fetch questions:', e);
      Alert.alert('Error', 'Failed to load challenge questions.');
      router.back();
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestions();
    return () => {
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

  // Handle Player Answer Selection
  const handleSelectOption = (index: number) => {
    if (showResult || matchEnded) return;
    if (timerRef.current) clearInterval(timerRef.current);

    setSelectedOption(index);
    const currentQ = questions[currentQIndex];
    const correct = index === currentQ.answer;
    setIsCorrect(correct);
    setShowResult(true);

    if (correct) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPlayerScore((prev) => prev + 1);
    } else {
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

    // Save run to backend server
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

      await api.post('/runs', {
        runId: payloadRunId,
        class: parseInt(classStr!),
        subject,
        packet: parseInt(packet || '1'),
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
      });

      // Update local profile store
      if (profile) {
        const newWins = (profile.challengeWins || 0) + (playerWon ? 1 : 0);
        const newLosses = (profile.challengeLosses || 0) + (playerWon ? 0 : 1);
        const newGames = (profile.challengeGamesPlayed || 0) + 1;
        const newPeakDiff = Math.max(profile.highestChallengeDifficulty || 1, botDifficultyLevel);

        setProfile({
          ...profile,
          totalEXP: profile.totalEXP + expEarned,
          gamesPlayed: profile.gamesPlayed + 1,
          totalAnswered: profile.totalAnswered + (currentQIndex + 1),
          totalCorrect: profile.totalCorrect + playerScore,
          challengeWins: newWins,
          challengeLosses: newLosses,
          challengeGamesPlayed: newGames,
          highestChallengeDifficulty: newPeakDiff,
        });
      }
    } catch (e) {
      console.warn('Failed to save challenge run:', e);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>⚔️ PREPARING 1v1 BOT CHALLENGE...</Text>
      </View>
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
      <View style={styles.container}>
        {/* ─── DUAL HUD HEADER ─── */}
        <LinearGradient colors={['#161B33', '#0A0D1B']} style={styles.hudContainer}>
          {/* Top Row: User vs Bot Avatars & Hearts */}
          <View style={styles.hudTopRow}>
            {/* Player Side */}
            <View style={styles.playerHudBox}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>{profile?.avatar || '👤'}</Text>
              </View>
              <View>
                <Text style={styles.hudName} numberOfLines={1}>
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
            <View style={styles.vsBadge}>
              <Text style={styles.vsText}>VS</Text>
            </View>

            {/* Bot Side */}
            <View style={[styles.playerHudBox, { justifyContent: 'flex-end' }]}>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.hudName} numberOfLines={1}>
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
              <View style={[styles.avatarCircle, { borderColor: Colors.dark.cyan }]}>
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
                  colors={Gradients.primary}
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
              <Text style={styles.questionNumberText}>
                QUESTION {currentQIndex + 1} OF 15
              </Text>
              <View style={[styles.timerBadge, timeLeft <= 5 && styles.timerBadgeWarning]}>
                <Text style={styles.timerText}>⏱️ {timeLeft}s</Text>
              </View>
            </View>

            {/* Question Card */}
            <Animated.View
              style={[
                styles.questionCard,
                { opacity: questionFadeAnim, transform: [{ translateY: questionSlideAnim }] },
              ]}
            >
              <Text style={styles.questionText}>{currentQ.question}</Text>
            </Animated.View>

            {/* Options List */}
            <View style={styles.optionsContainer}>
              {currentQ.options.map((option, idx) => {
                let optionStyle = styles.optionButton;
                let optionTextStyle = styles.optionText;

                if (showResult) {
                  if (idx === currentQ.answer) {
                    optionStyle = styles.optionCorrect;
                    optionTextStyle = styles.optionTextCorrect;
                  } else if (idx === selectedOption) {
                    optionStyle = styles.optionWrong;
                    optionTextStyle = styles.optionTextWrong;
                  }
                }

                return (
                  <TouchableOpacity
                    key={idx}
                    style={optionStyle}
                    activeOpacity={0.8}
                    onPress={() => handleSelectOption(idx)}
                    disabled={showResult}
                  >
                    <View style={styles.optionIndexBadge}>
                      <Text style={styles.optionIndexText}>
                        {String.fromCharCode(65 + idx)}
                      </Text>
                    </View>
                    <Text style={optionTextStyle}>{option}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Next Question Button */}
            {showResult && (
              <BouncyButton style={styles.nextBtnWrapper} onPress={handleNextQuestion}>
                <LinearGradient colors={Gradients.primary} style={styles.nextBtn}>
                  <Text style={styles.nextBtnText}>NEXT QUESTION ➔</Text>
                </LinearGradient>
              </BouncyButton>
            )}
          </ScrollView>
        ) : null}

        {/* ─── MATCH RESULT OVERLAY MODAL ─── */}
        {matchEnded && (
          <Animated.View style={[styles.resultOverlay, { opacity: resultFadeAnim }]}>
            <View style={styles.resultCard}>
              <Text style={styles.resultTitleEmoji}>{isPlayerWinner ? '🏆' : '💀'}</Text>
              <Text style={styles.resultTitleText}>
                {isPlayerWinner ? 'VICTORY!' : 'DEFEATED!'}
              </Text>
              <Text style={styles.resultSubtitle}>
                {isPlayerWinner
                  ? `You out-raced ${botName} in the 1v1 Arena!`
                  : `${botName} answered all 15 questions first.`}
              </Text>

              {/* Stats Breakdown */}
              <View style={styles.resultStatsBox}>
                <View style={styles.resultRow}>
                  <Text style={styles.resultRowLabel}>Your Score:</Text>
                  <Text style={styles.resultRowValue}>{playerScore} / 15</Text>
                </View>
                <View style={styles.resultRow}>
                  <Text style={styles.resultRowLabel}>Bot Score:</Text>
                  <Text style={styles.resultRowValue}>{botScore} / 15</Text>
                </View>
                <View style={styles.resultRow}>
                  <Text style={styles.resultRowLabel}>Hearts Remaining:</Text>
                  <Text style={styles.resultRowValue}>
                    {'❤️'.repeat(playerHearts) || '0'}
                  </Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.resultRow}>
                  <Text style={styles.resultRowLabel}>Base Victory EXP:</Text>
                  <Text style={styles.resultRowValue}>+{isPlayerWinner ? 400 : 50} EXP</Text>
                </View>
                {heartBonusExp > 0 && (
                  <View style={styles.resultRow}>
                    <Text style={styles.resultRowLabel}>
                      ❤️ Heart Bonus ({playerHearts}/3 remaining):
                    </Text>
                    <Text style={[styles.resultRowValue, { color: Colors.dark.cyan }]}>
                      +{heartBonusExp} EXP
                    </Text>
                  </View>
                )}
                <View style={[styles.resultRow, { marginTop: 6 }]}>
                  <Text style={styles.totalExpLabel}>TOTAL EXP GAINED:</Text>
                  <Text style={styles.totalExpValue}>+{expEarnedTotal} EXP</Text>
                </View>
              </View>

              <BouncyButton style={styles.finishBtnWrapper} onPress={() => router.replace('/(main)')}>
                <LinearGradient colors={Gradients.primary} style={styles.finishBtn}>
                  <Text style={styles.finishBtnText}>RETURN TO ARENA ⚔️</Text>
                </LinearGradient>
              </BouncyButton>
            </View>
          </Animated.View>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: Colors.dark.cyan,
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  // HUD
  hudContainer: {
    paddingTop: 48,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderColor: Colors.dark.border,
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
