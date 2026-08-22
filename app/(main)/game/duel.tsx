import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Animated,
  Easing,
  ActivityIndicator,
  Modal,
  BackHandler,
} from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { ThemedBackground } from '../../../components/ThemedBackground';
import { BouncyButton } from '../../../components/BouncyButton';
import { TauntWheelModal, TauntBannerOverlay } from '../../../components/TauntWheelModal';
import { FriendlyBattleService } from '../../../lib/friendlyBattleService';
import { QuestionService } from '../../../lib/questionService';
import { useAuthStore } from '../../../stores/authStore';
import { useUserStore } from '../../../stores/userStore';
import { useThemeStore } from '../../../stores/themeStore';
import { Question, TauntItem } from '../../../types';
import { MAX_HEARTS, EXP_PER_DIFFICULTY } from '../../../constants/config';
import { soundManager } from '../../../lib/soundManager';

export default function FriendlyDuelScreen() {
  const router = useRouter();
  const { roomCode, role, class: classStr, subject, guestName, guestAvatar } = useLocalSearchParams<{
    roomCode: string;
    role: 'host' | 'guest';
    class: string;
    subject: string;
    guestName?: string;
    guestAvatar?: string;
  }>();

  const { firebaseUser } = useAuthStore();
  const { profile, setProfile } = useUserStore();
  const { getColors, mode } = useThemeStore();
  const colors = getColors();

  // Match State
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [playerScore, setPlayerScore] = useState(0);
  const [playerHearts, setPlayerHearts] = useState(MAX_HEARTS);
  const [playerStreak, setPlayerStreak] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showAnswerResult, setShowAnswerResult] = useState(false);
  const [timeLeft, setTimeLeft] = useState(15);
  const [isGameOver, setIsGameOver] = useState(false);
  const [matchEnded, setMatchEnded] = useState(false);
  const [didWin, setDidWin] = useState(false);
  const [totalExpEarned, setTotalExpEarned] = useState(0);

  // Opponent Telemetry
  const [opponentName, setOpponentName] = useState(guestName || 'Challenger');
  const [opponentAvatar, setOpponentAvatar] = useState(guestAvatar || '⚡');
  const [opponentScore, setOpponentScore] = useState(0);
  const [opponentHearts, setOpponentHearts] = useState(MAX_HEARTS);
  const [opponentQIndex, setOpponentQIndex] = useState(0);

  // Taunts state
  const [tauntModalVisible, setTauntModalVisible] = useState(false);
  const [tauntCooldown, setTauntCooldown] = useState(false);
  const [incomingTaunt, setIncomingTaunt] = useState<{
    senderName: string;
    senderAvatar: string;
    tauntItem: TauntItem;
  } | null>(null);

  // Animations
  const questionFadeAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const myUid = firebaseUser?.uid || profile?.uid || 'player';

  // Load questions and initialize room events
  useEffect(() => {
    let isMounted = true;

    const setupMatch = async () => {
      const classNum = parseInt(classStr || '10', 10);
      const subjectName = subject || 'Science';

      const list = await QuestionService.getQuestions(classNum, subjectName, 15);
      if (isMounted) {
        setQuestions(list);
      }

      if (role === 'host') {
        // Broadcast game start with question payload
        FriendlyBattleService.startMatch(list).catch(() => {});
      }
    };

    setupMatch();

    // Listen to real-time duel events
    const channelHandler = (event: any) => {
      if (!isMounted) return;

      if (event.type === 'TAUNT_TRIGGERED') {
        setIncomingTaunt(event.payload);
      } else if (event.type === 'OPPONENT_PROGRESS') {
        if (event.payload.uid !== myUid) {
          setOpponentScore(event.payload.score || 0);
          setOpponentHearts(event.payload.hearts ?? MAX_HEARTS);
          setOpponentQIndex(event.payload.questionIndex || 0);

          if (event.payload.hearts <= 0) {
            // Opponent ran out of hearts, player wins!
            handleEndDuel(true);
          }
        }
      } else if (event.type === 'OPPONENT_FINISHED') {
        if (event.payload.uid !== myUid) {
          // Compare final scores
          const won = (playerScore > event.payload.score);
          handleEndDuel(won);
        }
      } else if (event.type === 'OPPONENT_LEFT') {
        Alert.alert('Opponent Surrendered 🏳️', 'Your opponent disconnected or fled the arena! You win!');
        handleEndDuel(true);
      }
    };

    if (role === 'guest') {
      FriendlyBattleService.joinRoom(roomCode, profile || ({} as any), channelHandler);
    }

    soundManager.pauseBgm();

    const onBackPress = () => {
      if (isGameOver) {
        FriendlyBattleService.leaveCurrentRoom();
        router.replace('/(main)/friends');
        return true;
      }
      Alert.alert(
        'Leave Duel Arena? 🚪',
        'Surrendering will forfeit the match to your opponent.',
        [
          { text: 'Stay in Duel', style: 'cancel' },
          {
            text: 'Leave Arena',
            style: 'destructive',
            onPress: () => {
              FriendlyBattleService.leaveCurrentRoom();
              router.replace('/(main)/friends');
            },
          },
        ]
      );
      return true;
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);

    return () => {
      isMounted = false;
      sub.remove();
      soundManager.resumeBgm();
      if (timerRef.current) clearInterval(timerRef.current);
      FriendlyBattleService.leaveCurrentRoom();
    };
  }, [isGameOver]);

  // Question Timer
  useEffect(() => {
    if (showAnswerResult || isGameOver || questions.length === 0) return;

    setTimeLeft(15);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          handleAnswerSelect(-1); // Timeout
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentQIndex, showAnswerResult, isGameOver, questions.length]);

  const currentQ = questions[currentQIndex];

  const handleAnswerSelect = (optionIndex: number) => {
    if (showAnswerResult || isGameOver || !currentQ) return;
    if (timerRef.current) clearInterval(timerRef.current);

    setSelectedOption(optionIndex);
    setShowAnswerResult(true);

    const isCorrect = optionIndex === currentQ.answer;
    let newScore = playerScore;
    let newHearts = playerHearts;
    let newStreak = playerStreak;

    if (isCorrect) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      soundManager.playCorrect();
      newScore += 1;
      newStreak += 1;
      setPlayerScore(newScore);
      setPlayerStreak(newStreak);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      soundManager.playWrong();
      newHearts -= 1;
      newStreak = 0;
      setPlayerHearts(newHearts);
      setPlayerStreak(0);
    }

    // Broadcast progress to opponent in real-time
    FriendlyBattleService.sendProgress({
      uid: myUid,
      score: newScore,
      questionIndex: currentQIndex + 1,
      hearts: newHearts,
      streak: newStreak,
    }).catch(() => {});

    setTimeout(() => {
      if (newHearts <= 0) {
        handleEndDuel(false);
      } else if (currentQIndex + 1 >= questions.length) {
        handleEndDuel(newScore >= opponentScore);
      } else {
        setSelectedOption(null);
        setShowAnswerResult(false);
        setCurrentQIndex((prev) => prev + 1);
      }
    }, 1400);
  };

  const handleSendTaunt = (tauntItem: TauntItem) => {
    setTauntCooldown(true);
    FriendlyBattleService.sendTaunt({
      senderName: profile?.name || 'Player',
      senderAvatar: profile?.avatar || '🎓',
      tauntItem,
    }).catch(() => {});

    setTimeout(() => setTauntCooldown(false), 2500);
  };

  const handleEndDuel = (won: boolean) => {
    if (matchEnded) return;
    setMatchEnded(true);
    setIsGameOver(true);
    setDidWin(won);

    const earned = won ? playerScore * EXP_PER_DIFFICULTY * 2 + 100 : playerScore * EXP_PER_DIFFICULTY;
    setTotalExpEarned(earned);

    if (won) {
      soundManager.playLevelUp();
    } else {
      soundManager.playGameOver();
    }

    // Record non-blocking run
    QuestionService.recordRun({
      firebaseUid: myUid,
      runId: `duel_${roomCode}_${Date.now()}`,
      classNum: parseInt(classStr || '10', 10),
      subject: subject || 'Science',
      mode: 'challenge',
      score: playerScore,
      correctAnswers: playerScore,
      questionsAnswered: currentQIndex + 1,
      expEarned: earned,
      maxStreak: playerStreak,
      highestDifficulty: 2,
      heartsRemaining: playerHearts,
      status: 'completed',
      isChallengeWin: won,
    }).catch(() => {});

    if (profile) {
      setProfile({
        ...profile,
        totalEXP: (profile.totalEXP || 0) + earned,
        gamesPlayed: (profile.gamesPlayed || 0) + 1,
        challengeWins: (profile.challengeWins || 0) + (won ? 1 : 0),
        challengeLosses: (profile.challengeLosses || 0) + (won ? 0 : 1),
      });
    }

    FriendlyBattleService.sendFinish({
      uid: myUid,
      score: playerScore,
      expEarned: earned,
      won,
    }).catch(() => {});
  };

  if (questions.length === 0) {
    return (
      <ThemedBackground>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF007A" />
          <Text style={styles.loadingText}>Connecting Duel Arena...</Text>
        </View>
      </ThemedBackground>
    );
  }

  return (
    <ThemedBackground>
      <View style={styles.container}>
        {/* Incoming Opponent Taunt Overlay Banner */}
        <TauntBannerOverlay taunt={incomingTaunt} />

        {/* ─── DUAL HEALTH & PROGRESS HUD ─── */}
        <View style={styles.hudContainer}>
          {/* Player (You) */}
          <View style={styles.playerHudBox}>
            <View style={styles.hudHeader}>
              <Text style={styles.hudAvatar}>{profile?.avatar || '🎓'}</Text>
              <View>
                <Text style={styles.hudName}>YOU</Text>
                <Text style={styles.hudScore}>{playerScore} pts</Text>
              </View>
            </View>
            <View style={styles.heartsRow}>
              {Array.from({ length: MAX_HEARTS }).map((_, i) => (
                <Text key={i} style={[styles.heartIcon, i >= playerHearts && styles.heartLost]}>
                  {i < playerHearts ? '❤️' : '🖤'}
                </Text>
              ))}
            </View>
          </View>

          {/* VS Divider & Room Code */}
          <View style={styles.vsCenter}>
            <Text style={styles.vsText}>VS</Text>
            <Text style={styles.roomCodeTag}>#{roomCode}</Text>
          </View>

          {/* Opponent (Classmate) */}
          <View style={[styles.playerHudBox, styles.opponentHudBox]}>
            <View style={[styles.hudHeader, { justifyContent: 'flex-end' }]}>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.hudName}>{opponentName}</Text>
                <Text style={styles.hudScore}>{opponentScore} pts</Text>
              </View>
              <Text style={styles.hudAvatar}>{opponentAvatar}</Text>
            </View>
            <View style={[styles.heartsRow, { justifyContent: 'flex-end' }]}>
              {Array.from({ length: MAX_HEARTS }).map((_, i) => (
                <Text key={i} style={[styles.heartIcon, i >= opponentHearts && styles.heartLost]}>
                  {i < opponentHearts ? '❤️' : '🖤'}
                </Text>
              ))}
            </View>
          </View>
        </View>

        {/* Timer Bar */}
        <View style={styles.timerBar}>
          <View
            style={[
              styles.timerProgress,
              {
                width: `${(timeLeft / 15) * 100}%`,
                backgroundColor: timeLeft <= 5 ? '#FF2E63' : '#00F0FF',
              },
            ]}
          />
        </View>

        {/* ─── Question Card ─── */}
        <View style={styles.questionCard}>
          <View style={styles.qMetaHeader}>
            <Text style={styles.qIndexLabel}>
              QUESTION {currentQIndex + 1} / {questions.length}
            </Text>
            <Text style={styles.qTimerText}>{timeLeft}s</Text>
          </View>
          <Text style={styles.qText}>{currentQ.question}</Text>
        </View>

        {/* ─── 4 Option Buttons ─── */}
        <View style={styles.optionsGrid}>
          {currentQ.options.map((opt, idx) => {
            const isSelected = selectedOption === idx;
            const isCorrectOption = idx === currentQ.answer;

            let btnBg = '#161C30';
            let btnBorder = 'rgba(255, 255, 255, 0.1)';

            if (showAnswerResult) {
              if (isCorrectOption) {
                btnBg = 'rgba(0, 255, 163, 0.2)';
                btnBorder = '#00FFA3';
              } else if (isSelected) {
                btnBg = 'rgba(255, 46, 99, 0.2)';
                btnBorder = '#FF2E63';
              }
            }

            return (
              <TouchableOpacity
                key={idx}
                style={[styles.optionBtn, { backgroundColor: btnBg, borderColor: btnBorder }]}
                onPress={() => handleAnswerSelect(idx)}
                disabled={showAnswerResult}
                activeOpacity={0.7}
              >
                <Text style={styles.optionIndex}>{String.fromCharCode(65 + idx)}</Text>
                <Text style={styles.optionText}>{opt}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ─── Floating Taunt Button (Clash Royale Style) ─── */}
        <TouchableOpacity
          style={styles.floatingTauntBtn}
          onPress={() => setTauntModalVisible(true)}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#BD00FF', '#7928CA']}
            style={styles.floatingTauntGradient}
          >
            <Text style={styles.floatingTauntIcon}>😈</Text>
            <Text style={styles.floatingTauntLabel}>TAUNT</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Taunt Modal Picker */}
        <TauntWheelModal
          visible={tauntModalVisible}
          onClose={() => setTauntModalVisible(false)}
          onSelectTaunt={handleSendTaunt}
          cooldownActive={tauntCooldown}
        />

        {/* ─── POST MATCH DUEL SUMMARY MODAL ─── */}
        <Modal visible={isGameOver} transparent animationType="slide">
          <View style={styles.resultModalOverlay}>
            <View style={styles.resultModalBox}>
              <Text style={{ fontSize: 50, marginBottom: 8 }}>{didWin ? '👑' : '💀'}</Text>
              <Text style={[styles.resultTitle, { color: didWin ? '#00FFA3' : '#FF2E63' }]}>
                {didWin ? 'VICTORY!' : 'DEFEAT!'}
              </Text>
              <Text style={styles.resultSub}>
                {didWin
                  ? `You crushed ${opponentName} in Academic Combat!`
                  : `${opponentName} outsmarted you in the arena!`}
              </Text>

              <View style={styles.finalScoreRow}>
                <View style={styles.finalScoreCol}>
                  <Text style={styles.finalScoreLabel}>YOUR SCORE</Text>
                  <Text style={styles.finalScoreVal}>{playerScore}</Text>
                </View>
                <Text style={{ color: '#BD00FF', fontSize: 24, fontWeight: 'bold' }}>-</Text>
                <View style={styles.finalScoreCol}>
                  <Text style={styles.finalScoreLabel}>{opponentName.toUpperCase()}</Text>
                  <Text style={styles.finalScoreVal}>{opponentScore}</Text>
                </View>
              </View>

              <View style={styles.expEarnedBadge}>
                <Text style={styles.expEarnedText}>+{totalExpEarned} TOTAL EXP EARNED</Text>
              </View>

              <BouncyButton
                style={styles.returnBtn}
                onPress={() => router.replace('/(main)/friends')}
              >
                <Text style={styles.returnBtnText}>🏠 RETURN TO SQUAD</Text>
              </BouncyButton>
            </View>
          </View>
        </Modal>
      </View>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFF',
    marginTop: 14,
    fontSize: 14,
    fontWeight: 'bold',
  },
  hudContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0E1322',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 14,
  },
  playerHudBox: {
    flex: 1,
  },
  opponentHudBox: {
    alignItems: 'flex-end',
  },
  hudHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  hudAvatar: {
    fontSize: 22,
  },
  hudName: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  hudScore: {
    color: '#00F0FF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  heartsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  heartIcon: {
    fontSize: 12,
  },
  heartLost: {
    opacity: 0.3,
  },
  vsCenter: {
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  vsText: {
    color: '#BD00FF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
  },
  roomCodeTag: {
    color: '#8A99AD',
    fontSize: 9,
    fontWeight: 'bold',
    marginTop: 2,
  },
  timerBar: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    marginBottom: 16,
    overflow: 'hidden',
  },
  timerProgress: {
    height: '100%',
  },
  questionCard: {
    backgroundColor: '#0E1322',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 16,
  },
  qMetaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  qIndexLabel: {
    color: '#8A99AD',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  qTimerText: {
    color: '#00F0FF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  qText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    lineHeight: 22,
  },
  optionsGrid: {
    gap: 10,
    flex: 1,
  },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  optionIndex: {
    color: '#00F0FF',
    fontSize: 14,
    fontWeight: '900',
    marginRight: 12,
    width: 20,
  },
  optionText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  floatingTauntBtn: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    borderRadius: 25,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#BD00FF',
    shadowOpacity: 0.6,
    shadowRadius: 10,
  },
  floatingTauntGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  floatingTauntIcon: {
    fontSize: 20,
  },
  floatingTauntLabel: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  resultModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  resultModalBox: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#0E1322',
    borderRadius: 24,
    padding: 24,
    borderWidth: 2,
    borderColor: 'rgba(189, 0, 255, 0.4)',
    alignItems: 'center',
  },
  resultTitle: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 4,
  },
  resultSub: {
    color: '#8A99AD',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 20,
  },
  finalScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    backgroundColor: '#161C30',
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderRadius: 16,
    marginBottom: 16,
  },
  finalScoreCol: {
    alignItems: 'center',
  },
  finalScoreLabel: {
    color: '#8A99AD',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  finalScoreVal: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '900',
  },
  expEarnedBadge: {
    backgroundColor: 'rgba(0, 240, 255, 0.12)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#00F0FF',
    marginBottom: 20,
  },
  expEarnedText: {
    color: '#00F0FF',
    fontSize: 12,
    fontWeight: '900',
  },
  returnBtn: {
    width: '100%',
    backgroundColor: '#BD00FF',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  returnBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
