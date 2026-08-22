import React, { useState, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  PanResponder,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

interface LetterWheelProps {
  letters: string[];
  onWordSubmit: (word: string) => void;
  onShuffle: () => void;
}

const WHEEL_SIZE = 240;
const RADIUS = 82;
const LETTER_SIZE = 52;
const HIT_RADIUS = 38;

export const LetterWheel: React.FC<LetterWheelProps> = ({
  letters,
  onWordSubmit,
  onShuffle,
}) => {
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const wheelViewRef = useRef<View | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const selectedIndicesRef = useRef<number[]>([]);

  // Wheel position on screen for accurate coordinate calculation
  const wheelPageOffset = useRef<{ px: number; py: number }>({ px: 0, py: 0 });

  const currentWord = useMemo(() => {
    return selectedIndices.map((i) => letters[i] || '').join('');
  }, [selectedIndices, letters]);

  // Compute node positions relative to wheel center
  const nodePositions = useMemo(() => {
    const total = letters.length;
    const center = WHEEL_SIZE / 2;
    return letters.map((_, i) => {
      const angle = (i / total) * 2 * Math.PI - Math.PI / 2;
      const x = center + RADIUS * Math.cos(angle);
      const y = center + RADIUS * Math.sin(angle);
      return { x, y, angle };
    });
  }, [letters]);

  const updateWheelPosition = useCallback(() => {
    if (wheelViewRef.current) {
      wheelViewRef.current.measure((x, y, width, height, pageX, pageY) => {
        if (pageX !== undefined && pageY !== undefined) {
          wheelPageOffset.current = { px: pageX, py: pageY };
        }
      });
    }
  }, []);

  const checkHit = (touchX: number, touchY: number) => {
    for (let i = 0; i < nodePositions.length; i++) {
      const pos = nodePositions[i];
      const dist = Math.hypot(touchX - pos.x, touchY - pos.y);
      if (dist <= HIT_RADIUS) {
        if (!selectedIndicesRef.current.includes(i)) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          const next = [...selectedIndicesRef.current, i];
          selectedIndicesRef.current = next;
          setSelectedIndices(next);
        }
        break;
      }
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        isDraggingRef.current = true;
        updateWheelPosition();
        const { pageX, pageY, locationX, locationY } = evt.nativeEvent;

        const touchX = wheelPageOffset.current.px
          ? pageX - wheelPageOffset.current.px
          : locationX;
        const touchY = wheelPageOffset.current.py
          ? pageY - wheelPageOffset.current.py
          : locationY;

        selectedIndicesRef.current = [];
        setSelectedIndices([]);
        checkHit(touchX, touchY);
      },
      onPanResponderMove: (evt) => {
        const { pageX, pageY } = evt.nativeEvent;
        const touchX = pageX - wheelPageOffset.current.px;
        const touchY = pageY - wheelPageOffset.current.py;
        checkHit(touchX, touchY);
      },
      onPanResponderRelease: () => {
        isDraggingRef.current = false;
        const finalIndices = selectedIndicesRef.current;
        if (finalIndices.length > 0) {
          const word = finalIndices.map((i) => letters[i] || '').join('');
          if (word.length >= 2) {
            onWordSubmit(word);
          }
        }
        selectedIndicesRef.current = [];
        setSelectedIndices([]);
      },
      onPanResponderTerminate: () => {
        isDraggingRef.current = false;
        selectedIndicesRef.current = [];
        setSelectedIndices([]);
      },
    })
  ).current;

  // Tap on single letter support
  const handleLetterPress = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (selectedIndices.includes(index)) {
      const next = selectedIndices.filter((i) => i !== index);
      selectedIndicesRef.current = next;
      setSelectedIndices(next);
    } else {
      const next = [...selectedIndices, index];
      selectedIndicesRef.current = next;
      setSelectedIndices(next);
    }
  };

  const handleManualSubmit = () => {
    if (currentWord.length >= 2) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onWordSubmit(currentWord);
      selectedIndicesRef.current = [];
      setSelectedIndices([]);
    }
  };

  const handleClear = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    selectedIndicesRef.current = [];
    setSelectedIndices([]);
  };

  return (
    <View style={styles.container}>
      {/* ─── Word Preview / Manual Actions ─── */}
      <View style={styles.previewContainer}>
        {currentWord ? (
          <View style={styles.previewRow}>
            <TouchableOpacity style={styles.clearBtn} onPress={handleClear} activeOpacity={0.7}>
              <Text style={styles.clearBtnText}>✕</Text>
            </TouchableOpacity>

            <View style={styles.previewPill}>
              <Text style={styles.previewText}>{currentWord}</Text>
            </View>

            <TouchableOpacity style={styles.submitBtn} onPress={handleManualSubmit} activeOpacity={0.7}>
              <Text style={styles.submitBtnText}>✓</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.previewPlaceholder}>
            <Text style={styles.placeholderText}>Swipe or tap letters to spell</Text>
          </View>
        )}
      </View>

      {/* ─── Circular Letter Wheel ─── */}
      <View
        ref={wheelViewRef}
        style={styles.wheelBox}
        onLayout={() => {
          setTimeout(updateWheelPosition, 100);
        }}
        {...panResponder.panHandlers}
      >
        {/* Wheel Glowing Background Disc */}
        <View style={styles.wheelDisc} pointerEvents="none" />

        {/* Connecting Trace Lines */}
        {selectedIndices.slice(0, -1).map((idx, i) => {
          const nextIdx = selectedIndices[i + 1];
          const p1 = nodePositions[idx];
          const p2 = nodePositions[nextIdx];
          if (!p1 || !p2) return null;

          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const len = Math.hypot(dx, dy);
          const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

          return (
            <View
              key={`line_${idx}_${nextIdx}_${i}`}
              style={[
                styles.traceLine,
                {
                  left: p1.x,
                  top: p1.y - 3,
                  width: len,
                  transform: [{ rotate: `${angle}deg` }],
                },
              ]}
              pointerEvents="none"
            />
          );
        })}

        {/* Central Shuffle Button */}
        <TouchableOpacity
          style={styles.shuffleBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            handleClear();
            onShuffle();
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.shuffleIcon}>🔀</Text>
        </TouchableOpacity>

        {/* Letter Nodes */}
        {nodePositions.map((pos, idx) => {
          const isSelected = selectedIndices.includes(idx);
          const letter = letters[idx];

          return (
            <TouchableOpacity
              key={idx}
              style={[
                styles.letterNode,
                {
                  left: pos.x - LETTER_SIZE / 2,
                  top: pos.y - LETTER_SIZE / 2,
                },
                isSelected && styles.letterNodeSelected,
              ]}
              onPress={() => handleLetterPress(idx)}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={
                  isSelected
                    ? ['#00F0FF', '#7928CA']
                    : ['#222B48', '#141A2E']
                }
                style={styles.letterGradient}
              >
                <Text
                  style={[
                    styles.letterText,
                    isSelected && styles.letterTextSelected,
                  ]}
                >
                  {letter}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },
  previewContainer: {
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  previewPill: {
    backgroundColor: '#00F0FF',
    paddingHorizontal: 22,
    paddingVertical: 7,
    borderRadius: 20,
    shadowColor: '#00F0FF',
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 8,
  },
  previewText: {
    color: '#0A0E1A',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 3,
  },
  clearBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  clearBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  submitBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10B981',
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },
  submitBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  previewPlaceholder: {
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  placeholderText: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 12,
    fontWeight: 'bold',
  },
  wheelBox: {
    width: WHEEL_SIZE,
    height: WHEEL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  wheelDisc: {
    position: 'absolute',
    width: WHEEL_SIZE,
    height: WHEEL_SIZE,
    borderRadius: WHEEL_SIZE / 2,
    backgroundColor: 'rgba(15, 20, 36, 0.88)',
    borderWidth: 2,
    borderColor: 'rgba(0, 240, 255, 0.25)',
    shadowColor: '#00F0FF',
    shadowOpacity: 0.25,
    shadowRadius: 16,
  },
  traceLine: {
    position: 'absolute',
    height: 6,
    backgroundColor: '#00F0FF',
    borderRadius: 3,
    shadowColor: '#00F0FF',
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 6,
  },
  shuffleBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  shuffleIcon: {
    fontSize: 20,
  },
  letterNode: {
    position: 'absolute',
    width: LETTER_SIZE,
    height: LETTER_SIZE,
    borderRadius: LETTER_SIZE / 2,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    zIndex: 10,
  },
  letterNodeSelected: {
    borderColor: '#00F0FF',
    transform: [{ scale: 1.12 }],
    shadowColor: '#00F0FF',
    shadowOpacity: 0.9,
    shadowRadius: 10,
    elevation: 8,
  },
  letterGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  letterText: {
    color: '#FFF',
    fontSize: 21,
    fontWeight: '900',
  },
  letterTextSelected: {
    color: '#FFF',
  },
});
