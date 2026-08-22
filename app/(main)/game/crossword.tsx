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
  const [bonusWordsFound, setBonusWordsFound] = useState<string[]>([]);
  const [bonusExpTotal, setBonusExpTotal] = useState(0);

  // Victory Modal State
  const [victoryModalVisible, setVictoryModalVisible] = useState(false);
  const [conceptModalVisible, setConceptModalVisible] = useState(false);
  const [expEarned, setExpEarned] = useState(300);

  const myUid = firebaseUser?.uid || profile?.uid || 'player';

  // Load level on start
  const loadLevel = async () => {
    try {
      setLoading(true);
      const currentLevelNum = await CrosswordService.getCurrentLevel();
      const level = await CrosswordService.getLevel(currentLevelNum);

      setLevelData(level);
      setLetters(level.letters);
      setSolvedWords([]);
      setRevealedHints({});
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
    const cleanWord = word.toUpperCase();

    // 1. Check if it is a target Grid Word
    if (levelData.gridWords.includes(cleanWord)) {
      if (solvedWords.includes(cleanWord)) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        return;
      }

      // Solved new grid word!
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      soundManager.playCorrect();

      const newSolved = [...solvedWords, cleanWord];
      setSolvedWords(newSolved);

      // Check if all grid words are solved
      if (newSolved.length === levelData.gridWords.length) {
        handleLevelComplete();
      }
      return;
    }

    // 2. Check if it is a Bonus Word
    if (levelData.bonusWords.includes(cleanWord)) {
      if (bonusWordsFound.includes(cleanWord)) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      soundManager.playWoo();
      setBonusWordsFound((prev) => [...prev, cleanWord]);
      setBonusExpTotal((prev) => prev + 50);
      return;
    }

    // 3. Invalid Word
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    soundManager.playWrong();
  };

  const handleUseHint = () => {
    if (!levelData) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Find first unsolved word and reveal its first unrevealed letter
    for (const word of levelData.gridWords) {
      if (!solvedWords.includes(word)) {
        const revealed = revealedHints[word] || [];
        for (let i = 0; i < word.length; i++) {
          if (!revealed.includes(i)) {
            setRevealedHints({
              ...revealedHints,
              [word]: [...revealed, i],
            });
            soundManager.playIGotThis();
            return;
          }
        }
      }
    }
  };

  const handleLevelComplete = async () => {
    if (!levelData) return;
    const totalAward = 300 + bonusExpTotal;
    setExpEarned(totalAward);
    setVictoryModalVisible(true);
    soundManager.playVictory();

    // Advance Level in background
    await CrosswordService.advanceLevel();

    // Record completed run non-blocking
    QuestionService.recordRun({
      firebaseUid: myUid,
      runId: `crossword_lvl${levelData.level}_${Date.now()}`,
      classNum: profile?.class || 10,
      subject: levelData.category,
      mode: 'crossword',
      score: levelData.gridWords.length,
      correctAnswers: levelData.gridWords.length,
      questionsAnswered: levelData.gridWords.length,
      expEarned: totalAward,
      maxStreak: levelData.gridWords.length,
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

  return (
    <ThemedBackground>
      <View style={styles.container}>
        {/* ─── Header HUD ─── */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.replace('/(main)')}
          >
            <Text style={styles.backBtnText}>✕</Text>
          </TouchableOpacity>

          <View style={styles.levelInfo}>
            <Text style={styles.levelBadge}>LEVEL {levelData.level}</Text>
            <Text style={styles.categoryText}>🔬 {levelData.category.toUpperCase()}</Text>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.clueBtn}
              onPress={() => setConceptModalVisible(true)}
            >
              <Text style={styles.clueIcon}>📖</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.hintBtn} onPress={handleUseHint}>
              <Text style={styles.hintIcon}>💡</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Bonus Words Banner */}
        {bonusWordsFound.length > 0 && (
          <View style={styles.bonusBanner}>
            <Text style={styles.bonusBannerText}>
              ⭐ {bonusWordsFound.length} BONUS WORDS FOUND (+{bonusExpTotal} EXP)
            </Text>
          </View>
        )}

        {/* ─── Crossword Grid Board ─── */}
        <ScrollView
          style={styles.gridScrollView}
          contentContainerStyle={styles.gridContainer}
          showsVerticalScrollIndicator={false}
        >
          {levelData.gridWords.map((word, wordIdx) => {
            const isSolved = solvedWords.includes(word);
            const revealedIndices = revealedHints[word] || [];

            return (
              <View key={wordIdx} style={styles.wordRow}>
                {word.split('').map((char, charIdx) => {
                  const isLetterRevealed = isSolved || revealedIndices.includes(charIdx);

                  return (
                    <View
                      key={charIdx}
                      style={[
                        styles.cellBox,
                        isSolved && styles.cellBoxSolved,
                        !isSolved && isLetterRevealed && styles.cellBoxHinted,
                      ]}
                    >
                      <Text
                        style={[
                          styles.cellLetter,
                          isSolved && styles.cellLetterSolved,
                          !isSolved && isLetterRevealed && styles.cellLetterHinted,
                        ]}
                      >
                        {isLetterRevealed ? char : ''}
                      </Text>
                    </View>
                  );
                })}
              </View>
            );
          })}
        </ScrollView>

        {/* ─── Circular Letter Wheel ─── */}
        <LetterWheel
          letters={letters}
          onWordSubmit={handleWordSubmit}
          onShuffle={handleShuffle}
        />

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
              <Text style={styles.victoryTitle}>LEVEL {levelData.level} CLEARED!</Text>
              <Text style={styles.victoryRootWord}>"{levelData.root}"</Text>
              <Text style={styles.victoryHint}>{levelData.hint}</Text>

              <View style={styles.expBadge}>
                <Text style={styles.expBadgeText}>+{expEarned} TOTAL EXP EARNED</Text>
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
    paddingTop: 48,
    paddingHorizontal: 16,
    paddingBottom: 20,
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
    marginBottom: 8,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  levelInfo: {
    alignItems: 'center',
  },
  levelBadge: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
  },
  categoryText: {
    color: '#00F0FF',
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  clueBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0, 240, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#00F0FF',
  },
  clueIcon: {
    fontSize: 16,
  },
  hintBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  hintIcon: {
    fontSize: 16,
  },
  bonusBanner: {
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignSelf: 'center',
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  bonusBannerText: {
    color: '#FFD700',
    fontSize: 10,
    fontWeight: '900',
  },
  gridScrollView: {
    flex: 1,
    maxHeight: 280,
  },
  gridContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 8,
  },
  wordRow: {
    flexDirection: 'row',
    gap: 6,
  },
  cellBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#161C30',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cellBoxSolved: {
    backgroundColor: '#00FFA3',
    borderColor: '#00FFA3',
    shadowColor: '#00FFA3',
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 4,
  },
  cellBoxHinted: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    borderColor: '#FFD700',
  },
  cellLetter: {
    fontSize: 17,
    fontWeight: '900',
    color: '#FFF',
  },
  cellLetterSolved: {
    color: '#0A0E1A',
  },
  cellLetterHinted: {
    color: '#FFD700',
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
  expBadge: {
    backgroundColor: 'rgba(0, 255, 163, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#00FFA3',
    marginBottom: 20,
  },
  expBadgeText: {
    color: '#00FFA3',
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
