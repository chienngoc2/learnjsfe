import { ThemeProvider } from "@/src/context/ThemeContext";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: "fade_from_bottom", // Hiệu ứng chuyển trang mượt mà từ dưới lên
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

          {/* Luyện tập & Mini Games */}
          <Stack.Screen name="luyen-tap/typing" />
          <Stack.Screen name="luyen-tap/quiz" />
          <Stack.Screen name="luyen-tap/conjugation" />
          <Stack.Screen name="luyen-tap/grammar" />
          <Stack.Screen name="luyen-tap/vocab-match" />
        </Stack>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
