import React from "react";
import { StyleSheet, TouchableOpacity, Text, View, StyleProp, ViewStyle } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { usePinyin } from "@/src/context/PinyinContext";
import { useTheme } from "@/src/context/ThemeContext";

interface PinyinCheckboxProps {
  label?: string;
  size?: number;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

export default function PinyinCheckbox({
  label = "Ẩn Pinyin",
  size = 17,
  compact = false,
  style,
}: PinyinCheckboxProps) {
  const { hidePinyin, toggleHidePinyin } = usePinyin();
  const { colors, isDark } = useTheme();

  return (
    <TouchableOpacity
      style={[
        styles.checkboxWrap,
        {
          backgroundColor: hidePinyin
            ? isDark
              ? "#2C1B10"
              : "#FEF3C7"
            : isDark
            ? "#1E293B"
            : "#F1F5F9",
          borderColor: hidePinyin ? colors.amber : colors.border,
        },
        compact && styles.compactWrap,
        style,
      ]}
      onPress={toggleHidePinyin}
      activeOpacity={0.7}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: hidePinyin }}
      accessibilityLabel={label}
    >
      <MaterialIcons
        name={hidePinyin ? "check-box" : "check-box-outline-blank"}
        size={size}
        color={hidePinyin ? colors.amber : colors.textMuted}
      />
      <Text
        style={[
          styles.label,
          {
            color: hidePinyin
              ? isDark
                ? "#FDE68A"
                : "#B45309"
              : colors.textMuted,
            fontSize: compact ? 11 : 12,
            fontWeight: hidePinyin ? "700" : "600",
          },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  checkboxWrap: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  compactWrap: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 3,
  },
  label: {
    userSelect: "none",
  },
});
