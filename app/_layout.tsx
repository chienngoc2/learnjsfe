import { ThemeProvider } from "@/src/context/ThemeContext";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <Stack>
          {/* 1. Màn hình chứa 3 cái Tabs (Trang chủ, Chat, Học tập) */}
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

          {/* 2. Màn hình chọn bài học (Flashcard) */}
          <Stack.Screen name="study/flashcard" options={{ headerShown: false }} />

          {/* 3. Màn hình chi tiết lật thẻ (Card Viewer) - ĐỂ Ở ĐÂY MỚI CHUẨN */}
          <Stack.Screen
            name="study/card-viewer"
            options={{
              headerShown: false, // Nút back cho iOS
            }}
          />
          <Stack.Screen
            name="study/practice-typing"
            options={{
              headerShown: false, // Nút back cho iOS
            }}
          />
          <Stack.Screen
            name="study/add-vocab"
            options={{
              headerShown: false,
            }}
          />
        </Stack>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

