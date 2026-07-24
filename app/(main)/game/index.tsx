import { useEffect, useState, useRef } from 'react';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { View, Text, StyleSheet, Animated, Easing, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Gradients } from '../../../constants/theme';
import { MAX_HEARTS } from '../../../constants/config';
import { BouncyButton } from '../../../components/BouncyButton';
import api from '../../../lib/api';

interface PacketInfo {
  packet: number;
  totalQuestions: number;
  chapters: string[];
}

export default function GameSetupScreen() {
  const router = useRouter();
  const { class: classStr, subject } = useLocalSearchParams<{
    class: string;
    subject: string;
  }>();

  const [packets, setPackets] = useState<PacketInfo[]>([]);
  const [selectedPacket, setSelectedPacket] = useState<number>(1);
  const [loadingPackets, setLoadingPackets] = useState<boolean>(true);

  // ─── Animations ───
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const cardScaleAnim = useRef(new Animated.Value(0.9)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(cardScaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 80,
        useNativeDriver: true,
      }),
    ]).start();

    // Floating emoji animation
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -8,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    floatLoop.start();
    return () => floatLoop.stop();
  }, []);

  useEffect(() => {
    fetchPackets();
  }, [classStr, subject]);

  const fetchPackets = async () => {
    try {
      setLoadingPackets(true);
      const res = await api.get('/questions/packets', {
        params: { class: classStr, subject },
      });
      if (res.data && res.data.length > 0) {
        setPackets(res.data);
        setSelectedPacket(res.data[0].packet);
      } else {
        // Fallback default 5 packets if API doesn't return
        const fallback = Array.from({ length: 5 }, (_, i) => ({
          packet: i + 1,
          totalQuestions: 10,
          chapters: [],
        }));
        setPackets(fallback);
      }
    } catch (e) {
      console.warn('Failed to fetch packets:', e);
      // Fallback
      const fallback = Array.from({ length: 5 }, (_, i) => ({
        packet: i + 1,
        totalQuestions: 10,
        chapters: [],
      }));
      setPackets(fallback);
    } finally {
      setLoadingPackets(false);
    }
  };

  const handleStart = () => {
    const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    router.replace({
      pathname: '/(main)/game/[runId]',
      params: {
        runId,
        class: classStr,
        subject,
        packet: selectedPacket.toString(),
      },
    });
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: Colors.dark.background },
          headerTintColor: Colors.dark.text,
          title: '',
        }}
      />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            styles.animatedWrapper,
            {
              opacity: fadeAnim,
              transform: [{ scale: cardScaleAnim }],
            },
          ]}
        >
          {/* Floating Glow Header Icon */}
          <Animated.View
            style={[
              styles.emojiContainer,
              { transform: [{ translateY: floatAnim }] },
            ]}
          >
            <Text style={styles.subjectEmoji}>
              {subject === 'Mathematics'
                ? '📐'
                : subject === 'Science'
                  ? '🔬'
                  : subject === 'English'
                    ? '📖'
                    : '🌍'}
            </Text>
          </Animated.View>

          <Text style={styles.subjectName}>{subject}</Text>
          <View style={styles.classBadge}>
            <Text style={styles.className}>CLASS {classStr} ARENA</Text>
          </View>

          {/* ─── Question Packet Selector Section ─── */}
          <View style={styles.packetSection}>
            <Text style={styles.sectionHeader}>SELECT QUESTION PACKET</Text>
            <Text style={styles.packetSubtext}>
              Questions are grouped into packets so you never see repeated questions!
            </Text>

            <View style={styles.packetGrid}>
              {packets.map((p) => {
                const isSelected = selectedPacket === p.packet;
                return (
                  <BouncyButton
                    key={p.packet}
                    style={[styles.packetCard, isSelected && styles.packetCardSelected]}
                    onPress={() => setSelectedPacket(p.packet)}
                  >
                    {isSelected ? (
                      <LinearGradient
                        colors={Gradients.primary}
                        style={styles.packetGradient}
                      >
                        <Text style={styles.packetNumberSelected}>
                          📦 PACKET {p.packet}
                        </Text>
                        <Text style={styles.packetCountSelected}>
                          {p.totalQuestions} Questions
                        </Text>
                      </LinearGradient>
                    ) : (
                      <View style={styles.packetInner}>
                        <Text style={styles.packetNumber}>
                          📦 PACKET {p.packet}
                        </Text>
                        <Text style={styles.packetCount}>
                          {p.totalQuestions} Questions
                        </Text>
                      </View>
                    )}
                  </BouncyButton>
                );
              })}
            </View>
          </View>

          {/* Info Card */}
          <LinearGradient colors={['#161B33', '#0F1224']} style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>SELECTED PACKET</Text>
              <Text style={styles.infoValueHighlight}>Packet {selectedPacket}</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>RUN LIVES</Text>
              <View style={styles.heartsPreview}>
                {Array.from({ length: MAX_HEARTS }).map((_, i) => (
                  <Text key={i} style={styles.heartIcon}>
                    ❤️
                  </Text>
                ))}
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>DIFFICULTY</Text>
              <Text style={styles.infoValue}>Scales Lv 1 ➔ 10</Text>
            </View>
          </LinearGradient>

          <Text style={styles.rules}>
            🎯 Answer fast to level up difficulty & multiplier. When a packet ends, the next packet begins seamlessly!
          </Text>

          <BouncyButton style={styles.startBtnWrapper} onPress={handleStart}>
            <LinearGradient
              colors={Gradients.primary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.startButton}
            >
              <Text style={styles.startButtonText}>⚡ LAUNCH PACKET {selectedPacket} ⚡</Text>
            </LinearGradient>
          </BouncyButton>
        </Animated.View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  container: {
    padding: 24,
    paddingBottom: 40,
    alignItems: 'center',
  },
  animatedWrapper: {
    width: '100%',
    alignItems: 'center',
  },
  emojiContainer: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: Colors.dark.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.dark.cyan,
    marginBottom: 12,
    elevation: 10,
    shadowColor: Colors.dark.cyanGlow,
    shadowRadius: 15,
    shadowOpacity: 0.6,
  },
  subjectEmoji: {
    fontSize: 48,
  },
  subjectName: {
    fontSize: 26,
    fontWeight: 'bold',
    color: Colors.dark.text,
    textAlign: 'center',
  },
  classBadge: {
    backgroundColor: 'rgba(5, 213, 230, 0.12)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 6,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.dark.cyan,
  },
  className: {
    fontSize: 12,
    color: Colors.dark.cyan,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  packetSection: {
    width: '100%',
    marginBottom: 24,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.dark.cyan,
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  packetSubtext: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    marginBottom: 14,
  },
  packetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  packetCard: {
    width: '48%',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.surface,
  },
  packetCardSelected: {
    borderColor: 'transparent',
  },
  packetGradient: {
    padding: 12,
    alignItems: 'center',
  },
  packetInner: {
    padding: 12,
    alignItems: 'center',
  },
  packetNumber: {
    fontSize: 13,
    fontWeight: 'bold',
    color: Colors.dark.textMuted,
  },
  packetNumberSelected: {
    fontSize: 13,
    fontWeight: 'bold',
    color: Colors.dark.text,
  },
  packetCount: {
    fontSize: 11,
    color: Colors.dark.textMuted,
    marginTop: 2,
  },
  packetCountSelected: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 2,
    fontWeight: '600',
  },
  infoCard: {
    width: '100%',
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    gap: 10,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 11,
    color: Colors.dark.textMuted,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 13,
    color: Colors.dark.text,
    fontWeight: 'bold',
  },
  infoValueHighlight: {
    fontSize: 14,
    color: Colors.dark.cyan,
    fontWeight: 'bold',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.dark.border,
  },
  heartsPreview: {
    flexDirection: 'row',
    gap: 4,
  },
  heartIcon: {
    fontSize: 16,
  },
  rules: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  startBtnWrapper: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  startButton: {
    paddingVertical: 18,
    alignItems: 'center',
    borderRadius: 16,
  },
  startButtonText: {
    color: Colors.dark.text,
    fontSize: 15,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
});
