import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  Animated,
  Easing,
  ActivityIndicator,
  BackHandler,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { ThemedBackground } from '../../../components/ThemedBackground';
import { BouncyButton } from '../../../components/BouncyButton';
import { LetterWheel } from '../../../components/LetterWheel';
import { CrosswordService, CrosswordLevel } from '../../../lib/crosswordService';
import { QuestionService } from '../../../lib/questionService';
import { useAuthStore } from '../../../stores/authStore';
import { useUserStore } from '../../../stores/userStore';
import { useThemeStore } from '../../../stores/themeStore';
import { soundManager } from '../../../lib/soundManager';

export default function CrosswordScreen() {
  const router = useRouter();
  const { firebaseUser } = useAuthStore();
  const { profile, setProfile } = useUserStore();
  const { getColors, mode } = useThemeStore();
  const colors = getColors();

  const [loading, setLoading] = useState(true);
  const [levelData, setLevelData] = useState<CrosswordLevel | null>(null);
  const [letters, setLetters] = useState<string[]>([]);
  const [solvedWords, setSolvedWords] = useState<string[]>([]);
  const [revealedHints, setRevealedHints] = useState<Record<string, number[]>>({});
  const [hintedCellKeys, setHintedCellKeys] = useState<string[]>([]);
  const [bonusWordsFound, setBonusWordsFound] = useState<string[]>([]);
  const [bonusExpTotal, setBonusExpTotal] = useState(0);
  const [hintPoints, setHintPoints] = useState(5);

  // Victory Modal State
  const [victoryModalVisible, setVictoryModalVisible] = useState(false);
  const [conceptModalVisible, setConceptModalVisible] = useState(false);
  const [expEarned, setExpEarned] = useState(300);

  const myUid = firebaseUser?.uid || profile?.uid || 'player';

  // Load level on start
  const loadLevel = async () => {
    try {
      setLoading(true);
      const [currentLevelNum, currentHints] = await Promise.all([
        CrosswordService.getCurrentLevel(),
        CrosswordService.getHintPoints(),
      ]);
      const level = await CrosswordService.getLevel(currentLevelNum);

      setLevelData(level);
      setLetters(level.letters);
      setHintPoints(currentHints);
      setSolvedWords([]);
      setRevealedHints({});
      setHintedCellKeys([]);
      setBonusWordsFound([]);
      setBonusExpTotal(0);
      setVictoryModalVisible(false);
    } catch (e) {
      console.warn('Failed to load crossword level:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLevel();
    soundManager.pauseBgm();

    const onBackPress = () => {
      router.replace('/(main)');
      return true;
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => {
      sub.remove();
      soundManager.resumeBgm();
    };
  }, []);

  const handleShuffle = () => {
    if (!levelData) return;
    setLetters(CrosswordService.shuffleLetters(letters));
  };

  const handleWordSubmit = (word: string) => {
    if (!levelData) return;
    const cleanWord = word.trim().toUpperCase();

    // 1. Check if it is a target Grid Word
    if (levelData.gridWords.includes(cleanWord)) {
      setSolvedWords((prev) => {
        if (prev.includes(cleanWord)) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          return prev;
        }

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        soundManager.playCorrect();
        const next = [...prev, cleanWord];

        if (next.length === levelData.gridWords.length) {
          handleLevelComplete(next);
        }
        return next;
      });
      return;
    }

    // 2. Check if it is a Bonus Word
    if (levelData.bonusWords.includes(cleanWord)) {
      setBonusWordsFound((prev) => {
        if (prev.includes(cleanWord)) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          return prev;
        }

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        soundManager.playWoo();
        setBonusExpTotal((e) => e + 50);

        CrosswordService.addHintPoints(1).then((pts) => setHintPoints(pts));
        Alert.alert('⭐ Bonus Word Found!', `You uncovered "${cleanWord}"!\n+50 EXP & +1 💡 Hint Point earned!`);
        return [...prev, cleanWord];
      });
      return;
    }

    // 3. Invalid Word
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    soundManager.playWrong();
  };

  // 💡 Powerup 1: Single Letter Hint (Costs 1 Hint Point)
  const handleUseHint = async () => {
    if (!levelData) return;

    if (hintPoints < 1) {
      Alert.alert(
        '💡 Out of Hint Points!',
        'Find bonus words or complete puzzle levels to earn more 💡 Hint Points!'
      );
      return;
    }

    // Find first unrevealed cell in an unsolved word on the 2D grid
    for (let r = 0; r < levelData.layout.rows; r++) {
      for (let c = 0; c < levelData.layout.cols; c++) {
        const cell = levelData.layout.grid[r][c];
        if (cell) {
          const isSolved = cell.words.some((w) => solvedWords.includes(w));
          const isHinted = hintedCellKeys.includes(`${r},${c}`);
          if (!isSolved && !isHinted) {
            const { success, remaining } = await CrosswordService.spendHintPoints(1);
            if (success) {
              setHintPoints(remaining);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setHintedCellKeys((prev) => [...prev, `${r},${c}`]);
              soundManager.playIGotThis();
            }
            return;
          }
        }
      }
    }
  };

  // ⚡ Powerup 2: Magic Wand (Reveals 1 entire unsolved word, Costs 3 Hint Points)
  const handleMagicWand = async () => {
    if (!levelData) return;

    if (hintPoints < 3) {
      Alert.alert(
        '⚡ Magic Wand Needs 3 💡 Hints',
        `You have ${hintPoints} 💡 Hints. Find bonus words to get more!`
      );
      return;
    }

    for (const word of levelData.gridWords) {
      if (!solvedWords.includes(word)) {
        const { success, remaining } = await CrosswordService.spendHintPoints(3);
        if (success) {
          setHintPoints(remaining);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          soundManager.playCorrect();

          setSolvedWords((prev) => {
            if (prev.includes(word)) return prev;
            const next = [...prev, word];
            if (next.length === levelData.gridWords.length) {
              handleLevelComplete(next);
            }
            return next;
          });
        }
        return;
      }
    }
  };

  const handleLevelComplete = async (finalSolved: string[]) => {
    if (!levelData) return;
    const baseExp = levelData.isBonusLevel ? 600 : 300;
    const totalAward = baseExp + bonusExpTotal;
    const hintBonusAward = levelData.isBonusLevel ? 3 : 2;

    setExpEarned(totalAward);
    setVictoryModalVisible(true);
    soundManager.playVictory();

    // Advance Level and award hint points
    await CrosswordService.advanceLevel();
    const updatedHints = await CrosswordService.addHintPoints(hintBonusAward);
    setHintPoints(updatedHints);

    // Record completed run non-blocking
    QuestionService.recordRun({
      firebaseUid: myUid,
      runId: `crossword_lvl${levelData.level}_${Date.now()}`,
      classNum: profile?.class || 10,
      subject: levelData.category,
      mode: 'crossword',
      score: finalSolved.length,
      correctAnswers: finalSolved.length,
      questionsAnswered: finalSolved.length,
      expEarned: totalAward,
      maxStreak: finalSolved.length,
      highestDifficulty: 2,
      heartsRemaining: 3,
      status: 'completed',
    }).catch(() => {});

    if (profile) {
      setProfile({
        ...profile,
        totalEXP: (profile.totalEXP || 0) + totalAward,
        gamesPlayed: (profile.gamesPlayed || 0) + 1,
      });
    }
  };

  if (loading || !levelData) {
    return (
      <ThemedBackground>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00F0FF" />
          <Text style={styles.loadingText}>Building Academic Crossword...</Text>
        </View>
      </ThemedBackground>
    );
  }

  // Compute adaptive cell size for true 2D crossword matrix
  const maxDim = Math.max(levelData.layout.rows, levelData.layout.cols, 5);
  const cellSize = Math.min(38, Math.max(26, Math.floor(290 / maxDim)));

  return (
    <ThemedBackground>
      <View style={styles.container}>
        {/* ─── Header HUD (Words of Wonders Style) ─── */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.replace('/(main)')}
            activeOpacity={0.75}
          >
            <Text style={styles.backBtnText}>✕</Text>
          </TouchableOpacity>

          <View style={styles.levelInfo}>
            <Text style={[styles.levelBadge, levelData.isBonusLevel && { color: '#FFD700' }]}>
              {levelData.isBonusLevel ? '⭐ BONUS ROUND' : `LEVEL ${levelData.level}`}
            </Text>
            <View style={styles.categoryPill}>
              <Text style={styles.categoryText}>🔬 {levelData.category.toUpperCase()}</Text>
            </View>
          </View>

          {/* Hint Currency & Clue Button */}
          <View style={styles.headerActions}>
            <View style={styles.hintCurrencyPill}>
              <Text style={styles.hintCurrencyText}>💡 {hintPoints}</Text>
            </View>

            <TouchableOpacity
              style={styles.clueBtn}
              onPress={() => setConceptModalVisible(true)}
              activeOpacity={0.75}
            >
              <Text style={styles.clueIcon}>📖</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Bonus Level Banner */}
        {levelData.isBonusLevel && (
          <View style={styles.bonusLevelBanner}>
            <Text style={styles.bonusLevelBannerText}>
              🌟 GOLDEN VAULT: 2x EXP & +3 HINTS REWARD!
            </Text>
          </View>
        )}

        {/* Bonus Words Found Counter */}
        {bonusWordsFound.length > 0 && !levelData.isBonusLevel && (
          <View style={styles.bonusBanner}>
            <Text style={styles.bonusBannerText}>
              ⭐ {bonusWordsFound.length} BONUS WORDS FOUND (+{bonusExpTotal} EXP)
            </Text>
          </View>
        )}

        {/* ─── 2D Intersecting Crossword Board Area (Spacious & Centered) ─── */}
        <View style={styles.gridBoardWrapper}>
          <ScrollView
            contentContainerStyle={styles.gridContentContainer}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <View style={styles.matrixBoard}>
              {levelData.layout.grid.map((row, rIdx) => (
                <View key={`row_${rIdx}`} style={styles.matrixRow}>
                  {row.map((cell, cIdx) => {
                    if (!cell) {
                      return (
                        <View
                          key={`empty_${rIdx}_${cIdx}`}
                          style={[styles.emptyCell, { width: cellSize, height: cellSize }]}
                        />
                      );
                    }

                    const isCellSolved = cell.words.some((w) => solvedWords.includes(w));
                    const isCellHinted = hintedCellKeys.includes(`${rIdx},${cIdx}`);

                    return (
                      <View
                        key={`cell_${rIdx}_${cIdx}`}
                        style={[
                          styles.cellBox,
                          { width: cellSize, height: cellSize },
                          isCellSolved && styles.cellBoxSolved,
                          !isCellSolved && isCellHinted && styles.cellBoxHinted,
                        ]}
                      >
                        <Text
                          style={[
                            styles.cellLetter,
                            { fontSize: Math.floor(cellSize * 0.54) },
                            isCellSolved && styles.cellLetterSolved,
                            !isCellSolved && isCellHinted && styles.cellLetterHinted,
                          ]}
                        >
                          {isCellSolved || isCellHinted ? cell.char : ''}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* ─── Bottom Area: Side Powerups + Letter Circle ─── */}
        <View style={styles.bottomArea}>
          <View style={styles.sidePowerupCol}>
            <TouchableOpacity style={styles.powerupCircle} onPress={handleUseHint} activeOpacity={0.8}>
              <Text style={styles.powerupCircleIcon}>💡</Text>
              <View style={styles.powerupCostBadge}>
                <Text style={styles.powerupCostText}>1</Text>
              </View>
            </TouchableOpacity>
            <Text style={styles.powerupLabelText}>HINT</Text>
          </View>

          <LetterWheel
            letters={letters}
            onWordSubmit={handleWordSubmit}
            onShuffle={handleShuffle}
          />

          <View style={styles.sidePowerupCol}>
            <TouchableOpacity style={styles.powerupCircle} onPress={handleMagicWand} activeOpacity={0.8}>
              <Text style={styles.powerupCircleIcon}>⚡</Text>
              <View style={styles.powerupCostBadge}>
                <Text style={styles.powerupCostText}>3</Text>
              </View>
            </TouchableOpacity>
            <Text style={styles.powerupLabelText}>WAND</Text>
          </View>
        </View>

        {/* ─── Concept Clue Modal ─── */}
        <Modal visible={conceptModalVisible} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <Text style={styles.clueModalTitle}>📖 ACADEMIC CONCEPT</Text>
              <Text style={styles.clueModalCategory}>{levelData.category}</Text>
              <Text style={styles.clueModalHint}>"{levelData.hint}"</Text>

              <BouncyButton
                style={styles.closeClueBtn}
                onPress={() => setConceptModalVisible(false)}
              >
                <Text style={styles.closeClueBtnText}>GOT IT</Text>
              </BouncyButton>
            </View>
          </View>
        </Modal>

        {/* ─── Level Clear Victory Modal ─── */}
        <Modal visible={victoryModalVisible} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalBox, styles.victoryBox]}>
              <Text style={{ fontSize: 50, marginBottom: 6 }}>🏆</Text>
              <Text style={styles.victoryTitle}>
                {levelData.isBonusLevel ? '⭐ BONUS LEVEL ' : 'LEVEL '}
                {levelData.level} CLEARED!
              </Text>
              <Text style={styles.victoryRootWord}>"{levelData.root}"</Text>
              <Text style={styles.victoryHint}>{levelData.hint}</Text>

              <View style={styles.rewardBadgesRow}>
                <View style={styles.expBadge}>
                  <Text style={styles.expBadgeText}>+{expEarned} TOTAL EXP</Text>
                </View>
                <View style={styles.hintRewardBadge}>
                  <Text style={styles.hintRewardBadgeText}>
                    +{levelData.isBonusLevel ? 3 : 2} 💡 HINTS
                  </Text>
                </View>
              </View>

              <BouncyButton style={styles.nextLevelBtn} onPress={loadLevel}>
                <LinearGradient
                  colors={['#00F0FF', '#7928CA']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.nextLevelGradient}
                >
                  <Text style={styles.nextLevelBtnText}>NEXT PUZZLE ▶</Text>
                </LinearGradient>
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
    paddingTop: 42,
    paddingHorizontal: 12,
    paddingBottom: 6,
    justifyContent: 'space-between',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#00F0FF',
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(15, 20, 36, 0.75)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 4,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  levelInfo: {
    alignItems: 'center',
  },
  levelBadge: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  categoryPill: {
    backgroundColor: 'rgba(0, 240, 255, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 2,
  },
  categoryText: {
    color: '#00F0FF',
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  hintCurrencyPill: {
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  hintCurrencyText: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: '900',
  },
  clueBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 240, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#00F0FF',
  },
  clueIcon: {
    fontSize: 15,
  },
  bonusLevelBanner: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignSelf: 'center',
    marginBottom: 4,
    borderWidth: 1.5,
    borderColor: '#FFD700',
    shadowColor: '#FFD700',
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 3,
  },
  bonusLevelBannerText: {
    color: '#FFD700',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  bonusBanner: {
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 10,
    alignSelf: 'center',
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  bonusBannerText: {
    color: '#FFD700',
    fontSize: 10,
    fontWeight: '900',
  },
  gridBoardWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 2,
  },
  gridContentContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  matrixBoard: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  matrixRow: {
    flexDirection: 'row',
    gap: 3,
  },
  emptyCell: {
    backgroundColor: 'transparent',
  },
  cellBox: {
    borderRadius: 6,
    backgroundColor: 'rgba(22, 30, 52, 0.92)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  cellBoxSolved: {
    backgroundColor: '#00F0FF',
    borderColor: '#FFF',
    borderWidth: 1.5,
    shadowColor: '#00F0FF',
    shadowOpacity: 0.9,
    shadowRadius: 8,
    elevation: 6,
  },
  cellBoxHinted: {
    backgroundColor: 'rgba(255, 215, 0, 0.28)',
    borderColor: '#FFD700',
    borderWidth: 1.5,
  },
  cellLetter: {
    fontWeight: '900',
    color: '#FFF',
  },
  cellLetterSolved: {
    color: '#0A0E1A',
  },
  cellLetterHinted: {
    color: '#FFD700',
  },
  bottomArea: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 2,
  },
  sidePowerupCol: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    gap: 4,
  },
  powerupCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  powerupCircleIcon: {
    fontSize: 20,
  },
  powerupCostBadge: {
    position: 'absolute',
    bottom: -3,
    right: -3,
    backgroundColor: '#FFD700',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: '#000',
  },
  powerupCostText: {
    color: '#000',
    fontSize: 9,
    fontWeight: '900',
  },
  powerupLabelText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalBox: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#0E1322',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.3)',
    alignItems: 'center',
  },
  clueModalTitle: {
    color: '#00F0FF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 4,
  },
  clueModalCategory: {
    color: '#8A99AD',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 14,
  },
  clueModalHint: {
    color: '#FFF',
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: 20,
  },
  closeClueBtn: {
    backgroundColor: '#00F0FF',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 14,
  },
  closeClueBtnText: {
    color: '#000',
    fontSize: 13,
    fontWeight: '900',
  },
  victoryBox: {
    borderColor: '#00FFA3',
    shadowColor: '#00FFA3',
    shadowOpacity: 0.6,
    shadowRadius: 18,
  },
  victoryTitle: {
    color: '#00FFA3',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 6,
  },
  victoryRootWord: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 3,
    marginBottom: 6,
  },
  victoryHint: {
    color: '#8A99AD',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  rewardBadgesRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  expBadge: {
    backgroundColor: 'rgba(0, 255, 163, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#00FFA3',
  },
  expBadgeText: {
    color: '#00FFA3',
    fontSize: 12,
    fontWeight: '900',
  },
  hintRewardBadge: {
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  hintRewardBadgeText: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: '900',
  },
  nextLevelBtn: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
  },
  nextLevelGradient: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  nextLevelBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
  },
});
