import React, { useEffect } from "react";
import { ThemeProvider } from "@/src/context/ThemeContext";
import { PinyinProvider } from "@/src/context/PinyinContext";
import { AuthProvider, useAuth } from "@/src/context/AuthContext";
import { Stack, useRouter, useSegments } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";

function AuthGate({ children }: { children: React.ReactNode }) {
  const { token, isLoading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) return;
    const isLoginPage = segments[0] === "login";

    if (!token && !isLoginPage) {
      router.replace("/login" as any);
    } else if (token && isLoginPage) {
      router.replace("/(tabs)" as any);
    }
  }, [token, segments, isLoading]);

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <PinyinProvider>
          <AuthProvider>
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
          </AuthProvider>
        </PinyinProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
