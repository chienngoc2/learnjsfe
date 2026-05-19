// src/context/ThemeContext.tsx
import React, { createContext, useContext, useState, useEffect } from "react";
import { useColorScheme } from "react-native";
import { themes } from "../constants/colors"; // Sếp check lại đường dẫn

type ThemeType = "light" | "dark";

interface ThemeContextProps {
  theme: ThemeType;
  isDark: boolean;
  colors: typeof themes.light;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextProps | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme(); // Lấy chế độ mặc định của máy (iOS/Android/Web)
  const [theme, setTheme] = useState<ThemeType>(systemScheme || "light");

  // Tự động đồng bộ nếu hệ thống điện thoại đổi chế độ sáng/tối
  useEffect(() => {
    if (systemScheme) setTheme(systemScheme);
  }, [systemScheme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  const colors = themes[theme];
  const isDark = theme === "dark";

  return (
    <ThemeContext.Provider value={{ theme, isDark, colors, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

// Hook ngắn gọn để các component con lôi ra xài
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context)
    throw new Error("useTheme phải được đặt trong ThemeProvider sếp ơi!");
  return context;
}
