import React from 'react';
import { Tabs } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Platform, TouchableOpacity, View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/context/ThemeContext';
import { useRouter } from 'expo-router';

// Center (+) FAB — renders in place of tab slot 3
function CenterFabButton({ onPress }: { onPress: () => void }) {
  const { isDark } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.82}
      style={styles.fabWrapper}
    >
      <View
        style={[
          styles.fabBtn,
          {
            backgroundColor: isDark ? '#1C160E' : '#FFFFFF',
            borderColor: isDark ? 'rgba(207, 172, 98, 0.35)' : 'rgba(139, 105, 20, 0.25)',
            shadowColor: isDark ? '#CFAC62' : '#8B6914',
          },
        ]}
      >
        <MaterialIcons name="add" size={18} color={isDark ? '#CFAC62' : '#8B6914'} />
      </View>
    </TouchableOpacity>
  );
}

export default function TabLayout() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const tabBarHeight = Platform.OS === 'ios' ? 52 + insets.bottom : 52;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.indigo,
        tabBarInactiveTintColor: colors.textMuted,
        headerShown: false,
        tabBarStyle: {
          height: tabBarHeight,
          backgroundColor: isDark ? 'rgba(14, 12, 10, 0.94)' : 'rgba(250, 247, 242, 0.94)',
          borderTopColor: isDark ? 'rgba(207, 172, 98, 0.12)' : 'rgba(139, 105, 20, 0.08)',
          borderTopWidth: 0.5,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          elevation: 5,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: isDark ? 0.12 : 0.04,
          shadowRadius: 8,
        },
        tabBarLabelStyle: {
          fontSize: 9.5,
          fontWeight: '600',
          marginBottom: Platform.OS === 'ios' ? 0 : 4,
        },
        tabBarIconStyle: {
          marginTop: 4,
        },
      }}
    >
      {/* Tab 1 — Trang chủ */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Trang chủ',
          tabBarIcon: ({ color }) => <MaterialIcons name="dashboard" size={20} color={color} />,
        }}
      />

      {/* Tab 2 — Emma AI Chat */}
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Emma',
          tabBarIcon: ({ color }) => <MaterialIcons name="chat" size={20} color={color} />,
        }}
      />

      {/* Tab 3 — CENTER (+) FAB → navigates to Add Vocab */}
      <Tabs.Screen
        name="add"
        options={{
          title: '',
          tabBarIcon: () => null,
          tabBarLabel: () => null,
          tabBarButton: () => (
            <CenterFabButton onPress={() => router.push('/study/add-vocab' as any)} />
          ),
        }}
      />

      {/* Tab 4 — Học tập (vocab/study hub) */}
      <Tabs.Screen
        name="vocab"
        options={{
          title: 'Học tập',
          tabBarIcon: ({ color }) => <MaterialIcons name="style" size={20} color={color} />,
        }}
      />

      {/* Tab 5 — Cá nhân (profile) */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Cá nhân',
          tabBarIcon: ({ color }) => <MaterialIcons name="person" size={20} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  fabWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: { elevation: 4 },
    }),
  },
});