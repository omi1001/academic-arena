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
  ScrollView,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { LinearGradient } from 'expo-linear-gradient';
import { auth } from '../../lib/firebase';
import api from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { useUserStore } from '../../stores/userStore';
import { Colors, Gradients } from '../../constants/theme';
import { BouncyButton } from '../../components/BouncyButton';

export default function SignupScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [selectedClass, setSelectedClass] = useState<9 | 10 | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    if (!email.trim() || !password.trim() || !displayName.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (!selectedClass) {
      Alert.alert('Error', 'Please select your class');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const credential = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      await updateProfile(credential.user, { displayName: displayName.trim() });

      // Save to backend MongoDB
      try {
        const res = await api.post('/auth/register', {
          name: displayName.trim(),
          email: email.trim(),
          class: selectedClass,
        });
        if (res.data?.user) {
          useUserStore.getState().setProfile(res.data.user);
        }
      } catch (e) {
        console.warn('Backend register failed:', e);
      }

      useAuthStore.getState().setFirebaseUser(auth.currentUser);

      router.replace('/(main)');
    } catch (error: any) {
      const message =
        error.code === 'auth/email-already-in-use'
          ? 'An account with this email already exists'
          : error.code === 'auth/invalid-email'
            ? 'Invalid email address'
            : error.code === 'auth/weak-password'
              ? 'Password is too weak'
              : 'Signup failed. Please try again.';
      Alert.alert('Signup Failed', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.inner}>
        <View style={styles.logoBadge}>
          <Text style={styles.logoEmoji}>🚀</Text>
        </View>

        <Text style={styles.title}>CREATE ACCOUNT</Text>
        <Text style={styles.subtitle}>Enter the Arena & Level Up</Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Display Name (e.g., Alex)"
            placeholderTextColor={Colors.dark.textMuted}
            value={displayName}
            onChangeText={setDisplayName}
            autoCapitalize="words"
          />

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

          <View style={styles.classRow}>
            <BouncyButton
              style={[styles.classOption, selectedClass === 9 && styles.classSelected]}
              onPress={() => setSelectedClass(9)}
            >
              <Text style={[styles.classText, selectedClass === 9 && styles.classTextSelected]}>
                CLASS 9
              </Text>
            </BouncyButton>
            <BouncyButton
              style={[styles.classOption, selectedClass === 10 && styles.classSelected]}
              onPress={() => setSelectedClass(10)}
            >
              <Text style={[styles.classText, selectedClass === 10 && styles.classTextSelected]}>
                CLASS 10
              </Text>
            </BouncyButton>
          </View>

          <TextInput
            style={styles.input}
            placeholder="Password (min 6 chars)"
            placeholderTextColor={Colors.dark.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TextInput
            style={styles.input}
            placeholder="Confirm Password"
            placeholderTextColor={Colors.dark.textMuted}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
          />

          <BouncyButton
            style={styles.buttonWrapper}
            onPress={handleSignup}
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
                <Text style={styles.buttonText}>CREATE ACCOUNT ➔</Text>
              )}
            </LinearGradient>
          </BouncyButton>

          <Link href="/(auth)" asChild>
            <TouchableOpacity style={styles.linkButton}>
              <Text style={styles.linkText}>
                Already have an account? <Text style={styles.linkBold}>Log In</Text>
              </Text>
            </TouchableOpacity>
          </Link>
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
  inner: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 40,
  },
  logoBadge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: Colors.dark.surface,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    borderWidth: 2,
    borderColor: Colors.dark.cyan,
    marginBottom: 14,
    elevation: 8,
    shadowColor: Colors.dark.cyanGlow,
    shadowRadius: 10,
    shadowOpacity: 0.5,
  },
  logoEmoji: {
    fontSize: 32,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: Colors.dark.text,
    textAlign: 'center',
    letterSpacing: 1.5,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.dark.textMuted,
    textAlign: 'center',
    marginBottom: 32,
    marginTop: 4,
  },
  form: {
    gap: 12,
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
  classRow: {
    flexDirection: 'row',
    gap: 12,
  },
  classOption: {
    flex: 1,
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.dark.border,
  },
  classSelected: {
    borderColor: Colors.dark.primary,
    backgroundColor: 'rgba(255, 42, 109, 0.15)',
  },
  classText: {
    color: Colors.dark.textMuted,
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  classTextSelected: {
    color: Colors.dark.primary,
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
    marginTop: 14,
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
