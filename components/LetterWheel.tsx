import React, { useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  PanResponder,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

interface LetterWheelProps {
  letters: string[];
  onWordSubmit: (word: string) => void;
  onShuffle: () => void;
}

const WHEEL_SIZE = 220;
const RADIUS = 75;
const LETTER_SIZE = 48;

export const LetterWheel: React.FC<LetterWheelProps> = ({
  letters,
  onWordSubmit,
  onShuffle,
}) => {
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const wheelLayoutRef = useRef<{ x: number; y: number; width: number; height: number }>({
    x: 0,
    y: 0,
    width: WHEEL_SIZE,
    height: WHEEL_SIZE,
  });

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

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        checkHit(locationX, locationY, []);
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        setSelectedIndices((prev) => {
          return checkHit(locationX, locationY, prev);
        });
      },
      onPanResponderRelease: () => {
        setSelectedIndices((finalIndices) => {
          if (finalIndices.length > 0) {
            const word = finalIndices.map((i) => letters[i] || '').join('');
            if (word.length >= 2) {
              onWordSubmit(word);
            }
          }
          return [];
        });
      },
      onPanResponderTerminate: () => {
        setSelectedIndices([]);
      },
    })
  ).current;

  const checkHit = (touchX: number, touchY: number, currentSelected: number[]): number[] => {
    for (let i = 0; i < nodePositions.length; i++) {
      const pos = nodePositions[i];
      const dist = Math.hypot(touchX - pos.x, touchY - pos.y);
      if (dist <= 30) {
        if (!currentSelected.includes(i)) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          return [...currentSelected, i];
        }
      }
    }
    return currentSelected;
  };

  return (
    <View style={styles.container}>
      {/* Current Word Preview Capsule */}
      <View style={styles.previewContainer}>
        {currentWord ? (
          <View style={styles.previewPill}>
            <Text style={styles.previewText}>{currentWord}</Text>
          </View>
        ) : (
          <View style={styles.previewPlaceholder}>
            <Text style={styles.placeholderText}>Swipe letters to form words</Text>
          </View>
        )}
      </View>

      {/* Circular Letter Wheel */}
      <View
        style={styles.wheelBox}
        onLayout={(e) => {
          wheelLayoutRef.current = e.nativeEvent.layout;
        }}
        {...panResponder.panHandlers}
      >
        {/* Wheel Background Disc */}
        <View style={styles.wheelDisc} />

        {/* Central Shuffle Button */}
        <TouchableOpacity
          style={styles.shuffleBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
            <View
              key={idx}
              style={[
                styles.letterNode,
                {
                  left: pos.x - LETTER_SIZE / 2,
                  top: pos.y - LETTER_SIZE / 2,
                },
                isSelected && styles.letterNodeSelected,
              ]}
              pointerEvents="none"
            >
              <LinearGradient
                colors={
                  isSelected
                    ? ['#00F0FF', '#7928CA']
                    : ['#1E2640', '#121829']
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
            </View>
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
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  previewPill: {
    backgroundColor: '#00F0FF',
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 22,
    shadowColor: '#00F0FF',
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 8,
  },
  previewText: {
    color: '#0A0E1A',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 4,
  },
  previewPlaceholder: {
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  placeholderText: {
    color: 'rgba(255, 255, 255, 0.4)',
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
    backgroundColor: 'rgba(18, 24, 41, 0.85)',
    borderWidth: 2,
    borderColor: 'rgba(0, 240, 255, 0.25)',
    shadowColor: '#00F0FF',
    shadowOpacity: 0.3,
    shadowRadius: 16,
  },
  shuffleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  shuffleIcon: {
    fontSize: 18,
  },
  letterNode: {
    position: 'absolute',
    width: LETTER_SIZE,
    height: LETTER_SIZE,
    borderRadius: LETTER_SIZE / 2,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  letterNodeSelected: {
    borderColor: '#00F0FF',
    transform: [{ scale: 1.15 }],
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
    fontSize: 20,
    fontWeight: '900',
  },
  letterTextSelected: {
    color: '#FFF',
  },
});
