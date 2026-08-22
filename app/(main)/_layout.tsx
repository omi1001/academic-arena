import { Tabs, Redirect } from 'expo-router';
import { Text, StyleSheet, View, Platform } from 'react-native';
import { useAuthStore } from '../../stores/authStore';
import { useThemeStore } from '../../stores/themeStore';
import { Colors } from '../../constants/theme';

function TabIcon({ name, focused, color }: { name: string; focused: boolean; color?: any }) {
  return (
    <View style={styles.tabIconContainer}>
      <Text style={[styles.tabIcon, focused && styles.tabIconActive]}>
        {name}
      </Text>
      {focused && <View style={[styles.activeDot, { backgroundColor: color || '#00F0FF' }]} />}
    </View>
  );
}

export default function MainLayout() {
  const { isAuthenticated, isLoading } = useAuthStore();
  const { getColors, mode } = useThemeStore();
  const colors = getColors();

  if (isLoading) return null;

  if (!isAuthenticated) {
    return <Redirect href="/(auth)" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: [
          styles.tabBar,
          {
            backgroundColor: mode === 'dark' ? 'rgba(15, 20, 36, 0.94)' : 'rgba(255, 255, 255, 0.94)',
            borderTopColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
          },
        ],
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name="🏠" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: 'Squad',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name="👥" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{
          title: 'Arena',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name="🏆" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name="👤" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="game"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="help"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    borderTopWidth: 1,
    height: Platform.OS === 'ios' ? 84 : 64,
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
    paddingTop: 6,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  tabIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 28,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
    marginTop: 2,
  },
  tabIcon: {
    fontSize: 19,
    opacity: 0.45,
  },
  tabIconActive: {
    opacity: 1,
    transform: [{ scale: 1.12 }],
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
  },
});
