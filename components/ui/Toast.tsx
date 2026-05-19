import React from "react";
import { Text, Animated, StyleSheet } from "react-native";

interface ToastProps {
  toast: { type: "success" | "error"; text: string } | null;
  slideAnim: Animated.Value;
}

export default function Toast({ toast, slideAnim }: ToastProps) {
  if (!toast) return null;

  return (
    <Animated.View
      style={[
        styles.toastContainer,
        toast.type === "success" ? styles.toastSuccess : styles.toastError,
        { transform: [{ translateY: slideAnim }] },
      ]}
    >
      <Text style={styles.toastText}>{toast.text}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toastContainer: {
    position: "absolute",
    top: 10,
    right: 16,
    padding: 12,
    borderRadius: 10,
    zIndex: 9999,
    borderWidth: 1,
  },
  toastSuccess: { borderColor: "#A7F3D0", backgroundColor: "#F0FDF4" },
  toastError: { borderColor: "#FCA5A5", backgroundColor: "#FEF2F2" },
  toastText: { fontWeight: "600", color: "#1E293B" },
});
