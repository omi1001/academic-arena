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
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { signInWithEmailAndPassword } from 'firebase/auth';
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
});
