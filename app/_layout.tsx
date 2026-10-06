import React, { useEffect, useState } from "react";
import { ThemeProvider } from "@/src/context/ThemeContext";
import { PinyinProvider } from "@/src/context/PinyinContext";
import { Stack, useRouter, useSegments } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";

function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        const isLoginPage = segments[0] === "login";

        if (!token && !isLoginPage) {
          router.replace("/login" as any);
        } else if (token && isLoginPage) {
          router.replace("/(tabs)" as any);
        }
      } catch (err) {
        console.warn("Auth check error:", err);
      }
    };

    checkAuth();
  }, [segments]);

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <PinyinProvider>
          <AuthGate>
          <Stack
            screenOptions={{
              headerShown: false,
              animation: "fade_from_bottom",
            }}
          >
            {/* Đăng nhập */}
            <Stack.Screen name="login" />

            {/* Bottom Tabs */}
            <Stack.Screen name="(tabs)" />

            {/* Học tập & Thẻ Flashcard */}
            <Stack.Screen name="study/flashcard" />
            <Stack.Screen name="study/card-viewer" />
            <Stack.Screen name="study/add-vocab" />
            <Stack.Screen name="study/custom-images" />
            <Stack.Screen name="study/kanji-search" />
            <Stack.Screen name="study/show-kanji" />
            <Stack.Screen name="study/kanji-lesson" />
            <Stack.Screen name="study/add-kanji" />
            <Stack.Screen name="study/add-grammar" />
            <Stack.Screen name="study/grammar-viewer" />

            {/* Luyện tập & Mini Games */}
            <Stack.Screen name="luyen-tap/typing" />
            <Stack.Screen name="luyen-tap/quiz" />
            <Stack.Screen name="luyen-tap/pronunciation" />
            <Stack.Screen name="luyen-tap/grammar" />
            <Stack.Screen name="luyen-tap/vocab-match" />
          </Stack>
        </AuthGate>
        </PinyinProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
