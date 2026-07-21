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
import { Colors } from '../../constants/theme';

const DEVELOPER_EMAIL = 'monusingh2646@gmail.com';

export default function HelpSupportScreen() {
  const router = useRouter();
  const { firebaseUser } = useAuthStore();
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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Help & Support</Text>
        <Text style={styles.subtitle}>
          Found a bug or have a suggestion? Let us know!
        </Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Subject (e.g., Bug Report, Suggestion)"
            placeholderTextColor={Colors.dark.textMuted}
            value={subject}
            onChangeText={setSubject}
          />

          <TextInput
            style={[styles.input, styles.messageInput]}
            placeholder="Describe your issue or suggestion in detail..."
            placeholderTextColor={Colors.dark.textMuted}
            value={message}
            onChangeText={setMessage}
            multiline
            textAlignVertical="top"
          />

          <TouchableOpacity
            style={[styles.sendButton, sending && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={sending}
          >
            <Text style={styles.sendButtonText}>
              {sending ? 'Opening Email...' : 'Send Feedback'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>Other ways to reach us</Text>
          <TouchableOpacity
            onPress={() => Linking.openURL(`mailto:${DEVELOPER_EMAIL}`)}
          >
            <Text style={styles.infoLink}>{DEVELOPER_EMAIL}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
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
    color: Colors.dark.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.dark.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.dark.textMuted,
    marginBottom: 32,
  },
  form: {
    gap: 14,
    marginBottom: 40,
  },
  input: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: Colors.dark.text,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  messageInput: {
    height: 160,
  },
  sendButton: {
    backgroundColor: Colors.dark.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendButtonText: {
    color: Colors.dark.text,
    fontSize: 18,
    fontWeight: 'bold',
  },
  infoSection: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  infoTitle: {
    fontSize: 14,
    color: Colors.dark.textMuted,
    marginBottom: 8,
  },
  infoLink: {
    color: Colors.dark.primary,
    fontSize: 16,
    fontWeight: '600',
  },
});
