import { useTheme } from "@/src/context/ThemeContext";
import React from "react";
import { StyleSheet, View, Text } from "react-native";


interface ChatBubbleProps {
  message: string;
  role: "user" | "bot";
}

export default function ChatBubble({ message, role }: ChatBubbleProps) {
  const { colors } = useTheme(); // 🚀 ĐÓN NHẬN BỘ MÀU ĐỘNG TỪ ĐẠI NÃO
  const isUser = role === "user";

  return (
    <View
      style={[
        styles.bubbleContainer,
        isUser ? styles.userAlign : styles.botAlign,
      ]}
    >
      <View
        style={[
          styles.bubble,
          {
            // 🔥 Tin nhắn User ăn màu cam hổ phách, Bot ăn màu Surface động
            backgroundColor: isUser ? colors.amber : colors.surface,
            borderColor: isUser ? colors.amber : colors.border,
            borderBottomRightRadius: isUser ? 4 : 20,
            borderBottomLeftRadius: isUser ? 20 : 4,
          },
        ]}
      >
        <Text
          style={[
            styles.messageText,
            {
              // 🔥 Chữ User màu trắng cho nổi bật, chữ Bot đổi động theo theme sáng/tối
              color: isUser ? "#FFFFFF" : colors.text,
            },
          ]}
        >
          {message}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bubbleContainer: {
    width: "100%",
    marginVertical: 6,
    flexDirection: "row",
  },
  userAlign: {
    justifyContent: "flex-end",
  },
  botAlign: {
    justifyContent: "flex-start",
  },
  bubble: {
    maxWidth: "75%",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    // Đổ bóng nhẹ cho tin nhắn nhìn cao cấp
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "500",
  },
});
