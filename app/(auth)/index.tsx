import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { LinearGradient } from 'expo-linear-gradient';
import { auth } from '../../lib/firebase';
import api from '../../lib/api';
import { useUserStore } from '../../stores/userStore';
import { Colors, Gradients } from '../../constants/theme';
import { BouncyButton } from '../../components/BouncyButton';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Password reset modal states
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);

      // Fetch/sync user profile from backend
      try {
        const res = await api.get('/auth/profile');
        if (res.data?.user) {
          useUserStore.getState().setProfile(res.data.user);
        }
      } catch (e) {
        console.warn('Login profile sync failed:', e);
      }

      router.replace('/(main)');
    } catch (error: any) {
      const message =
        error.code === 'auth/user-not-found'
          ? 'No account found with this email'
          : error.code === 'auth/wrong-password'
            ? 'Incorrect password'
            : error.code === 'auth/invalid-email'
              ? 'Invalid email address'
              : 'Login failed. Please try again.';
      Alert.alert('Login Failed', message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenForgotModal = () => {
    setResetEmail(email.trim());
    setShowForgotModal(true);
  };

  const handleSendResetEmail = async () => {
    const targetEmail = resetEmail.trim();
    if (!targetEmail) {
      Alert.alert('Error', 'Please enter your registered email address.');
      return;
    }

    setResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, targetEmail);
      setShowForgotModal(false);
      Alert.alert(
        'Email Sent! 📩',
        `A password reset link has been sent to ${targetEmail}. Please check your inbox and spam folder.`
      );
    } catch (error: any) {
      const message =
        error.code === 'auth/user-not-found'
          ? 'No account found registered with this email.'
          : error.code === 'auth/invalid-email'
            ? 'Please enter a valid email address.'
            : error.message || 'Failed to send password reset email. Try again later.';
      Alert.alert('Reset Failed', message);
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        {/* Logo Badge */}
        <View style={styles.logoBadge}>
          <Text style={styles.logoEmoji}>⚔️</Text>
        </View>

        <Text style={styles.title}>ACADEMIC ARENA</Text>
        <Text style={styles.subtitle}>Level up your knowledge</Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Email Address"
            placeholderTextColor={Colors.dark.textMuted}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={Colors.dark.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity style={styles.forgotLink} onPress={handleOpenForgotModal}>
            <Text style={styles.forgotLinkText}>Forgot Password?</Text>
          </TouchableOpacity>

          <BouncyButton
            style={styles.buttonWrapper}
            onPress={handleLogin}
            disabled={loading}
          >
            <LinearGradient
              colors={Gradients.primary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.button, loading && styles.buttonDisabled]}
            >
              {loading ? (
                <ActivityIndicator color={Colors.dark.text} />
              ) : (
                <Text style={styles.buttonText}>LOG IN ➔</Text>
              )}
            </LinearGradient>
          </BouncyButton>

          <Link href="/(auth)/signup" asChild>
            <TouchableOpacity style={styles.linkButton}>
              <Text style={styles.linkText}>
                Don't have an account? <Text style={styles.linkBold}>Sign Up</Text>
              </Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>

      {/* Forgot Password Modal */}
      <Modal
        visible={showForgotModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowForgotModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalIcon}>🔑</Text>
            <Text style={styles.modalTitle}>RESET PASSWORD</Text>
            <Text style={styles.modalDescription}>
              Enter your registered email address and we'll send you a link to reset your password.
            </Text>

            <TextInput
              style={styles.modalInput}
              placeholder="Registered Email Address"
              placeholderTextColor={Colors.dark.textMuted}
              value={resetEmail}
              onChangeText={setResetEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <BouncyButton
              style={styles.resetButtonWrapper}
              onPress={handleSendResetEmail}
              disabled={resetLoading}
            >
              <LinearGradient
                colors={['#05D5E6', '#0072FF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.resetButton}
              >
                {resetLoading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.resetButtonText}>SEND RESET LINK 📩</Text>
                )}
              </LinearGradient>
            </BouncyButton>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowForgotModal(false)}
              disabled={resetLoading}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  logoBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.dark.surface,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    borderWidth: 2,
    borderColor: Colors.dark.primary,
    marginBottom: 16,
    elevation: 8,
    shadowColor: Colors.dark.primaryGlow,
    shadowRadius: 10,
    shadowOpacity: 0.5,
  },
  logoEmoji: {
    fontSize: 34,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.dark.text,
    textAlign: 'center',
    letterSpacing: 1.5,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.dark.textMuted,
    textAlign: 'center',
    marginBottom: 40,
    marginTop: 4,
  },
  form: {
    gap: 14,
  },
  input: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    padding: 16,
    fontSize: 15,
    color: Colors.dark.text,
    borderWidth: 1.5,
    borderColor: Colors.dark.border,
  },
  forgotLink: {
    alignSelf: 'flex-end',
    marginTop: -4,
    marginBottom: 4,
  },
  forgotLinkText: {
    color: Colors.dark.cyan,
    fontSize: 13,
    fontWeight: '600',
  },
  buttonWrapper: {
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 6,
  },
  button: {
    paddingVertical: 18,
    alignItems: 'center',
    borderRadius: 14,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  linkButton: {
    alignItems: 'center',
    marginTop: 16,
  },
  linkText: {
    color: Colors.dark.textMuted,
    fontSize: 14,
  },
  linkBold: {
    color: Colors.dark.primary,
    fontWeight: 'bold',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalContent: {
    width: '100%',
    backgroundColor: Colors.dark.surface,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.dark.border,
    elevation: 12,
  },
  modalIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.dark.text,
    marginBottom: 8,
    letterSpacing: 1,
  },
  modalDescription: {
    fontSize: 13,
    color: Colors.dark.textMuted,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },
  modalInput: {
    width: '100%',
    backgroundColor: '#0F1224',
    borderRadius: 14,
    padding: 16,
    fontSize: 15,
    color: Colors.dark.text,
    borderWidth: 1.5,
    borderColor: Colors.dark.border,
    marginBottom: 16,
  },
  resetButtonWrapper: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
  },
  resetButton: {
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 14,
  },
  resetButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  cancelButton: {
    marginTop: 14,
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  cancelButtonText: {
    color: Colors.dark.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
});
