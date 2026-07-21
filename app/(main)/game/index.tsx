import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../../../constants/theme';
import { MAX_HEARTS } from '../../../constants/config';

export default function GameSetupScreen() {
  const router = useRouter();
  const { class: classStr, subject } = useLocalSearchParams<{
    class: string;
    subject: string;
  }>();

  const handleStart = () => {
    const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    router.replace({
      pathname: '/(main)/game/[runId]',
      params: {
        runId,
        class: classStr,
        subject,
      },
    });
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: true, headerStyle: { backgroundColor: Colors.dark.background }, headerTintColor: Colors.dark.text, title: '' }} />
      <View style={styles.container}>
        <Text style={styles.subjectEmoji}>
          {subject === 'Mathematics'
            ? '📐'
            : subject === 'Science'
              ? '🔬'
              : subject === 'English'
                ? '📖'
                : '🌍'}
        </Text>
        <Text style={styles.subjectName}>{subject}</Text>
        <Text style={styles.className}>Class {classStr}</Text>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Hearts</Text>
            <View style={styles.heartsPreview}>
              {Array.from({ length: MAX_HEARTS }).map((_, i) => (
                <Text key={i} style={styles.heartIcon}>
                  ❤️
                </Text>
              ))}
            </View>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Difficulty</Text>
            <Text style={styles.infoValue}>Starts at 1, scales to 10</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Speed Bonus</Text>
            <Text style={styles.infoValue}>Up to 1.5x EXP</Text>
          </View>
        </View>

        <Text style={styles.rules}>
          Answer correctly to climb difficulty. 3 wrong and it's game over.
        </Text>

        <TouchableOpacity style={styles.startButton} onPress={handleStart}>
          <Text style={styles.startButtonText}>Begin Run</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  subjectEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  subjectName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.dark.text,
  },
  className: {
    fontSize: 16,
    color: Colors.dark.textMuted,
    marginTop: 4,
    marginBottom: 40,
  },
  infoCard: {
    width: '100%',
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    gap: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 15,
    color: Colors.dark.textMuted,
  },
  infoValue: {
    fontSize: 15,
    color: Colors.dark.text,
    fontWeight: '600',
  },
  heartsPreview: {
    flexDirection: 'row',
    gap: 4,
  },
  heartIcon: {
    fontSize: 18,
  },
  rules: {
    fontSize: 14,
    color: Colors.dark.textMuted,
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 20,
  },
  startButton: {
    backgroundColor: Colors.dark.primary,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 64,
  },
  startButtonText: {
    color: Colors.dark.text,
    fontSize: 20,
    fontWeight: 'bold',
  },
});
