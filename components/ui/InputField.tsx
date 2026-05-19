import { useTheme } from "@/src/context/ThemeContext";
import React from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";


export default function InputField({
  label,
  highlight = false,
  style,
  ...props
}: any) {
  const { colors } = useTheme(); // 🚀 Lấy màu động

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
      <View
        style={[
          styles.inputWrapper,
          {
            backgroundColor: highlight ? colors.amberLight : colors.surface,
            borderColor: highlight ? colors.amber : colors.border,
          },
        ]}
      >
        <TextInput
          style={[styles.input, { color: colors.text }, style]}
          placeholderTextColor={colors.textMuted}
          {...props}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 12 },
  label: { fontSize: 13, fontWeight: "700", marginBottom: 6 },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  input: { flex: 1, paddingVertical: 10, fontSize: 15 },
});
