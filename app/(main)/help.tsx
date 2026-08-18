import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Linking,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';
import { useThemeStore } from '../../stores/themeStore';
import { ThemedBackground } from '../../components/ThemedBackground';

const DEVELOPER_EMAIL = 'monusingh2646@gmail.com';

export default function HelpSupportScreen() {
  const router = useRouter();
  const { firebaseUser } = useAuthStore();
  const { getColors, mode } = useThemeStore();
  const colors = getColors();

  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!subject.trim() || !message.trim()) {
      Alert.alert('Error', 'Please fill in both subject and message.');
      return;
    }

    setSending(true);
    try {
      const body = `Hi Monu,\n\n${message.trim()}\n\n---\nFrom: ${firebaseUser?.displayName || 'User'} (${firebaseUser?.email || 'unknown'})\nApp: Academic Arena`;

      const url = `mailto:${DEVELOPER_EMAIL}?subject=${encodeURIComponent('Academic Arena: ' + subject.trim())}&body=${encodeURIComponent(body)}`;

      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
        Alert.alert('Sent', 'Thanks for your feedback! Your email app has opened.');
        setSubject('');
        setMessage('');
      } else {
        Alert.alert('Error', 'No email app found. Please install Gmail or another email app.');
      }
    } catch (e) {
      Alert.alert('Error', 'Could not open email app.');
    } finally {
      setSending(false);
    }
  };

  return (
    <ThemedBackground>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={[styles.backText, { color: colors.primary }]}>← Back</Text>
          </TouchableOpacity>

          <Text style={[styles.title, { color: colors.text }]}>Help & Support</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Found a bug or have a suggestion? Let us know!
          </Text>

          <View style={styles.form}>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              placeholder="Subject (e.g., Bug Report, Suggestion)"
              placeholderTextColor={colors.textMuted}
              value={subject}
              onChangeText={setSubject}
            />

            <TextInput
              style={[
                styles.input,
                styles.messageInput,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              placeholder="Describe your issue or suggestion in detail..."
              placeholderTextColor={colors.textMuted}
              value={message}
              onChangeText={setMessage}
              multiline
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[
                styles.sendButton,
                { backgroundColor: colors.primary },
                sending && styles.sendButtonDisabled,
              ]}
              onPress={handleSend}
              disabled={sending}
            >
              <Text style={styles.sendButtonText}>
                {sending ? 'Opening Email...' : 'Send Feedback'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.infoSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.infoTitle, { color: colors.text }]}>Other ways to reach us</Text>
            <TouchableOpacity
              onPress={() => Linking.openURL(`mailto:${DEVELOPER_EMAIL}`)}
            >
              <Text style={[styles.infoLink, { color: colors.primary }]}>{DEVELOPER_EMAIL}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    padding: 24,
    paddingTop: 60,
    paddingBottom: 100,
  },
  backBtn: {
    marginBottom: 16,
  },
  backText: {
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    marginBottom: 32,
  },
  form: {
    gap: 14,
    marginBottom: 40,
  },
  input: {
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
  },
  messageInput: {
    height: 140,
  },
  sendButton: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  infoSection: {
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    alignItems: 'center',
  },
  infoTitle: {
    fontSize: 14,
    marginBottom: 6,
  },
  infoLink: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});
