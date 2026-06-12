import React from 'react';
import { Tabs } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabLayout() {
  // Fix cứng 'light' để tránh lỗi file Colors và focus vào code logic trước sếp nhé
  const colorScheme = 'light'; 
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        // Màu xanh thương hiệu của AI Sensei
        tabBarActiveTintColor: '#007AFF', 
        tabBarInactiveTintColor: '#8E8E93',
        headerShown: true, // Hiện tiêu đề màn hình
        tabBarStyle: {
          height: Platform.OS === 'ios' ? 60 + insets.bottom : 60,
          paddingBottom: Platform.OS === 'ios' ? Math.max(insets.bottom, 10) : 10,
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