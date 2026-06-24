import React from 'react';
import { Tabs } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Platform, TouchableOpacity, View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/context/ThemeContext';
import { useRouter } from 'expo-router';

// Center (+) FAB button component for tab bar
function CenterFabButton({ onPress }: { onPress: () => void }) {
  const { colors, isDark } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
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
        <MaterialIcons name="add" size={24} color={isDark ? '#CFAC62' : '#8B6914'} />
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
      {/* 1. Dashboard */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Trang chủ',
          tabBarIcon: ({ color }) => <MaterialIcons name="dashboard" size={26} color={color} />,
        }}
      />

      {/* 2. Chat AI */}
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Sensei',
          tabBarIcon: ({ color }) => <MaterialIcons name="chat" size={26} color={color} />,
        }}
      />

      {/* 3. Center (+) FAB placeholder tab */}
      <Tabs.Screen
        name="vocab"
        options={{
          title: '',
          tabBarIcon: () => null,
          tabBarLabel: () => null,
          tabBarButton: () => (
            <CenterFabButton onPress={() => router.push('/study/add-vocab' as any)} />
          ),
        }}
      />

      {/* 4. Study */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Học tập',
          tabBarIcon: ({ color }) => <MaterialIcons name="style" size={26} color={color} />,
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
    paddingBottom: 4,
  },
  fabBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.45,
        shadowRadius: 8,
      },
      android: { elevation: 8 },
    }),
  },
});