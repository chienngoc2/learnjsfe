import React from 'react';
import { Tabs } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
// import { useColorScheme } from 'react-native'; // Gọi trực tiếp từ react-native nếu muốn dùng hệ thống

export default function TabLayout() {
  // Fix cứng 'light' để tránh lỗi file Colors và focus vào code logic trước sếp nhé
  const colorScheme = 'light'; 

  return (
    <Tabs
      screenOptions={{
        // Màu xanh thương hiệu của AI Sensei
        tabBarActiveTintColor: '#007AFF', 
        tabBarInactiveTintColor: '#8E8E93',
        headerShown: true, // Hiện tiêu đề màn hình
        tabBarStyle: {
          height: 60,
          paddingBottom: 10,
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