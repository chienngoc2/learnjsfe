import React from "react";
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from "react-native";

interface ButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  type?: "primary" | "secondary" | "amber"; // Các loại màu nút sếp muốn
  size?: "small" | "normal";
  style?: StyleProp<ViewStyle>;
}

export default function Button({
  title,
  onPress,
  loading = false,
  type = "primary",
  size = "normal",
  style,
}: ButtonProps) {
  return (
    <TouchableOpacity
      style={[
        styles.btn,
        styles[type],
        size === "small" && styles.small,
        style,
      ]}
      onPress={onPress}
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator color="#FFF" size="small" />
      ) : (
        <Text style={[styles.btnText, size === "small" && styles.smallText]}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    elevation: 3,
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  primary: { backgroundColor: "#F97316", shadowColor: "#F97316" }, // Cam gốc
  secondary: { backgroundColor: "#0369A1", shadowColor: "#0369A1" }, // Xanh dương
  amber: { backgroundColor: "#D97706", shadowColor: "#D97706" }, // Cam hổ phách sếp vừa chọn
  small: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    alignSelf: "flex-end", // Tự chạy qua phải
  },
  btnText: { color: "#FFF", fontWeight: "800", fontSize: 16 },
  smallText: { fontSize: 14, fontWeight: "700" },
});
