import React from "react";
import { View, Text, Pressable, StyleSheet, TouchableOpacity } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/context/ThemeContext";


interface HeaderProps {
  title: string;
  rightAction?: React.ReactNode;
}

export default function Header({ title, rightAction }: HeaderProps) {
  const router = useRouter();
  const { colors, isDark, toggleTheme } = useTheme(); // 🚀 Lấy màu và hàm đổi theme

  return (
    // 🔥 Thay thế background cứng thành màu động colors.background
    <View
      style={[
        styles.customHeader,
        { backgroundColor: colors.background, borderColor: colors.border },
      ]}
    >
      <Pressable onPress={() => router.back()} style={styles.btnBackHeader}>
        <MaterialIcons
          name="arrow-back-ios"
          size={20}
          color={colors.amber}
          style={{ marginLeft: 6 }}
        />
      </Pressable>

      <Text style={[styles.headerTitle, { color: colors.text }]}>{title}</Text>

      {/* Hành động phải: Nếu ko truyền nút "+" thì cho hiện nút đổi nhanh Dark Mode cực ngầu */}
      {rightAction ? (
        rightAction
      ) : (
        <TouchableOpacity onPress={toggleTheme} style={styles.btnThemeToggle}>
          <MaterialIcons
            name={isDark ? "wb-sunny" : "nights-stay"}
            size={22}
            color={colors.textMuted}
          />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  customHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 15,
    zIndex: 10,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
    flex: 1,
  },
  btnBackHeader: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
  },
  btnThemeToggle: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
});
