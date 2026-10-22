import React, { memo, useCallback } from "react";
import {
  Pressable,
  Text,
  StyleSheet,
  ViewStyle,
  StyleProp,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/src/context/ThemeContext";
import { usePriority, PriorityWordInput } from "@/src/context/PriorityContext";

export interface PriorityButtonProps {
  /** Từ vựng cần ghim ưu tiên */
  word: string;
  reading?: string;
  pinyin?: string;
  meaning?: string;
  topicTitle?: string;
  topicId?: string;
  /** Kiểu dáng hiển thị của button:
   * - "button": Nút đầy đủ kích thước có chữ và icon (rất rõ ràng, sang trọng)
   * - "pill": Nút viên thuốc gọn gàng có icon + chữ (tối ưu cho danh sách hàng ngang)
   * - "icon": Nút khối bấm 3D chỉ icon (khi không gian hẹp)
   */
  variant?: "button" | "pill" | "icon";
  /** Nhãn tùy chỉnh khi đang ở trạng thái ưu tiên */
  activeLabel?: string;
  /** Nhãn tùy chỉnh khi chưa ưu tiên */
  inactiveLabel?: string;
  /** Callback sau khi bấm */
  onToggle?: (isNowPriority: boolean) => void;
  /** Custom style bổ sung */
  style?: StyleProp<ViewStyle>;
  /** Kích thước icon */
  iconSize?: number;
}

function PriorityButtonComponent({
  word,
  reading,
  pinyin,
  meaning,
  topicTitle,
  topicId,
  variant = "button",
  activeLabel,
  inactiveLabel,
  onToggle,
  style,
  iconSize,
}: PriorityButtonProps) {
  const { colors, isDark } = useTheme();
  const { isPriority: checkPriority, togglePriority } = usePriority();

  const term = (word || "").trim();
  const active = checkPriority(term);

  const handlePress = useCallback(async () => {
    if (!term) return;
    const input: PriorityWordInput = {
      term,
      word: term,
      reading: reading || pinyin,
      pinyin: pinyin || reading,
      meaning,
      topicTitle,
      topicId,
    };
    const newState = await togglePriority(input);
    if (onToggle) {
      onToggle(newState);
    }
  }, [term, reading, pinyin, meaning, topicTitle, topicId, togglePriority, onToggle]);

  // Kích thước icon theo variant
  const actualIconSize =
    iconSize || (variant === "pill" ? 14 : variant === "icon" ? 18 : 16);

  // Nhãn hiển thị
  const labelText = active
    ? activeLabel || (variant === "pill" ? "Ưu tiên" : "⭐ Ưu tiên")
    : inactiveLabel || (variant === "pill" ? "+ Ưu tiên" : "Lưu ưu tiên");

  // Màu sắc chủ đạo (Vàng hoàng kim nổi bật khi Active, xám sang trọng khi Inactive)
  const activeBg = isDark ? "rgba(245, 158, 11, 0.22)" : "#FEF3C7";
  const activeBorder = "#F59E0B";
  const activeColor = isDark ? "#FBBF24" : "#D97706";

  const inactiveBg = isDark ? "#1E293B" : "#F1F5F9";
  const inactiveBorder = isDark ? "#334155" : "#CBD5E1";
  const inactiveColor = isDark ? "#94A3B8" : "#64748B";

  const currentBg = active ? activeBg : inactiveBg;
  const currentBorder = active ? activeBorder : inactiveBorder;
  const currentColor = active ? activeColor : inactiveColor;

  if (variant === "icon") {
    return (
      <Pressable
        onPress={handlePress}
        hitSlop={8}
        style={({ pressed }) => [
          styles.iconBtn,
          {
            backgroundColor: currentBg,
            borderColor: currentBorder,
            transform: [{ scale: pressed ? 0.90 : 1 }],
          },
          style,
        ]}
      >
        <Ionicons
          name={active ? "star" : "star-outline"}
          size={actualIconSize}
          color={active ? "#F59E0B" : currentColor}
        />
      </Pressable>
    );
  }

  if (variant === "pill") {
    return (
      <Pressable
        onPress={handlePress}
        hitSlop={6}
        style={({ pressed }) => [
          styles.pillBtn,
          {
            backgroundColor: currentBg,
            borderColor: currentBorder,
            transform: [{ scale: pressed ? 0.92 : 1 }],
          },
          style,
        ]}
      >
        <Ionicons
          name={active ? "star" : "star-outline"}
          size={actualIconSize}
          color={active ? "#F59E0B" : currentColor}
        />
        <Text
          style={[
            styles.pillText,
            { color: currentColor, fontWeight: active ? "800" : "700" },
          ]}
        >
          {labelText}
        </Text>
      </Pressable>
    );
  }

  // Variant "button" mặc định - Nút bấm lớn, hoàn chỉnh và sang trọng
  return (
    <Pressable
      onPress={handlePress}
      hitSlop={6}
      style={({ pressed }) => [
        styles.fullBtn,
        {
          backgroundColor: currentBg,
          borderColor: currentBorder,
          transform: [{ scale: pressed ? 0.92 : 1 }],
        },
        style,
      ]}
    >
      <Ionicons
        name={active ? "star" : "star-outline"}
        size={actualIconSize}
        color={active ? "#F59E0B" : currentColor}
      />
      <Text
        style={[
          styles.fullBtnText,
          { color: currentColor, fontWeight: active ? "800" : "700" },
        ]}
      >
        {labelText}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fullBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 6,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
      },
      android: {
        elevation: 1.5,
      },
    }),
  },
  fullBtnText: {
    fontSize: 13,
    letterSpacing: 0.2,
  },
  pillBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1.2,
    gap: 4,
  },
  pillText: {
    fontSize: 11,
    letterSpacing: 0.1,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1.2,
    alignItems: "center",
    justifyContent: "center",
  },
});

export const PriorityButton = memo(PriorityButtonComponent);
export default PriorityButton;
