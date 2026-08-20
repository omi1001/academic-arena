import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import * as Notifications from 'expo-notifications';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useAuthStore } from '../stores/authStore';
import { useThemeStore } from '../stores/themeStore';
import { NotificationService } from '../lib/notificationService';
import { Colors } from '../constants/theme';

export default function RootLayout() {
  const router = useRouter();
  const { setFirebaseUser, setLoading, isLoading } = useAuthStore();
  const { loadStoredTheme, mode } = useThemeStore();

  useEffect(() => {
    loadStoredTheme().catch(() => {});
    NotificationService.initialize().catch(() => {});

    // Listen for notification taps
    const responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('[NOTIFICATIONS] User tapped notification:', response.notification.request.content.title);
      router.push('/(main)');
    });

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setLoading(false);
    });

    return () => {
      unsubscribe();
      responseListener.remove();
    };
  }, []);

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.dark.primary} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.dark.background },
          animation: 'slide_from_right',
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.dark.background,
  },
});
