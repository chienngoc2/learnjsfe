import { useTheme } from "@/src/context/ThemeContext";
import React, { useEffect, useRef } from "react";
import { StyleSheet, View, Text, Animated } from "react-native";

interface ChatBubbleProps {
  message: string;
  role: "user" | "bot";
}

export default function ChatBubble({ message, role }: ChatBubbleProps) {
  const { colors, isDark } = useTheme();
  const isUser = role === "user";

  // Hoạt ảnh xuất hiện mượt mà (Fade-in và Slide-up từ phía dưới lên)
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(15)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        speed: 12,
        bounciness: 4,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.bubbleContainer,
        isUser ? styles.userAlign : styles.botAlign,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: isUser ? "rgba(223, 206, 186, 0.95)" : "rgba(253, 251, 247, 0.95)",
            borderColor: isUser ? "rgba(180, 160, 140, 0.8)" : "rgba(220, 215, 205, 0.8)",
            borderBottomRightRadius: isUser ? 4 : 18,
            borderBottomLeftRadius: isUser ? 18 : 4,
          },
        ]}
      >
        <Text
          style={[
            styles.messageText,
            {
              color: "#3F2E23", // Cozy cocoa dark brown for comfortable readability
            },
          ]}
        >
          {message}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bubbleContainer: {
    width: "100%",
    marginVertical: 4,
    flexDirection: "row",
  },
  userAlign: {
    justifyContent: "flex-end",
  },
  botAlign: {
    justifyContent: "flex-start",
  },
  bubble: {
    maxWidth: "80%",
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 18,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1.5,
  },
  messageText: {
    fontSize: 14.5,
    lineHeight: 21,
    fontWeight: "500",
  },
});
