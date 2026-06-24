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
            backgroundColor: '#000000',
            borderColor: isDark ? '#CFAC62' : '#8B6914',
            shadowColor: isDark ? '#CFAC62' : '#8B6914',
          },
        ]}
      >
        <MaterialIcons name="add" size={20} color={isDark ? '#CFAC62' : '#8B6914'} />
      </View>
    </TouchableOpacity>
  );
}

export default function TabLayout() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const tabBarHeight = Platform.OS === 'ios' ? 60 + insets.bottom : 60;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.indigo,
        tabBarInactiveTintColor: colors.textMuted,
        headerShown: false,
        tabBarStyle: {
          height: tabBarHeight,
          paddingBottom: Platform.OS === 'ios' ? Math.max(insets.bottom, 10) : 10,
          backgroundColor: isDark ? '#0E0C0A' : '#FAF7F2',
          borderTopColor: isDark ? '#CFAC6230' : '#B8860B20',
          borderTopWidth: 1,
        },
      }}
    >
      {/* Tab 1 — Trang chủ */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Trang chủ',
          tabBarIcon: ({ color }) => <MaterialIcons name="dashboard" size={22} color={color} />,
        }}
      />

      {/* Tab 2 — Emma AI Chat */}
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Emma',
          tabBarIcon: ({ color }) => <MaterialIcons name="chat" size={22} color={color} />,
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
          tabBarIcon: ({ color }) => <MaterialIcons name="style" size={22} color={color} />,
        }}
      />

      {/* Tab 5 — Cá nhân (profile) */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Cá nhân',
          tabBarIcon: ({ color }) => <MaterialIcons name="person" size={22} color={color} />,
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
    marginTop: -18,       // Nổi lên trên đường kẻ tab bar
  },
  fabBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.35,
        shadowRadius: 6,
      },
      android: { elevation: 6 },
    }),
  },
});