import React from 'react';
import { Tabs } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/context/ThemeContext';

export default function TabLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.indigo, 
        tabBarInactiveTintColor: colors.textMuted,
        headerShown: false, // Hủy header mặc định để dùng Custom Header đồng bộ
        tabBarStyle: {
          height: Platform.OS === 'ios' ? 60 + insets.bottom : 60,
          paddingBottom: Platform.OS === 'ios' ? Math.max(insets.bottom, 10) : 10,
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
        },
      }}>
      
      {/* 1. Màn hình Dashboard (index.tsx) */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Trang chủ',
          tabBarIcon: ({ color }) => <MaterialIcons name="dashboard" size={28} color={color} />,
        }}
      />

      {/* 2. Màn hình Chat AI (chat.tsx) */}
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Sensei Chat',
          tabBarIcon: ({ color }) => <MaterialIcons name="chat" size={28} color={color} />,
        }}
      />

      {/* 3. Màn hình Học từ vựng (vocab.tsx) */}
      <Tabs.Screen
        name="vocab"
        options={{
          title: 'Học tập',
          tabBarIcon: ({ color }) => <MaterialIcons name="style" size={28} color={color} />,
        }}
      />

      {/* 4. Màn hình Cá nhân (profile.tsx) */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Cá nhân',
          tabBarIcon: ({ color }) => <MaterialIcons name="person" size={28} color={color} />,
        }}
      />
    </Tabs>
  );
}