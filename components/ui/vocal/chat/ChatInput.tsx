import React, { useState } from "react";
import {
  StyleSheet,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useTheme } from "@/src/context/ThemeContext";

// 🚀 ĐÃ FIX ĐƯỜNG DẪN IMPORT CHUẨN: Lùi đúng 3 tầng từ (components/ui/vocal/chat) ra thư mục src/context
// Nếu file gốc của sếp nằm khác, sếp cứ gõ "@/" hoặc "../" để VSCode gợi ý đường dẫn chính xác tới "ThemeContext" nhé!


interface ChatInputProps {
  onSendText: (text: string) => void;
  onStartRecord: () => void;
  onStopRecord: () => void;
  isRecording: boolean;
  isLoading: boolean;
}

export default function ChatInput({
  onSendText,
  onStartRecord,
  onStopRecord,
  isRecording,
  isLoading,
}: ChatInputProps) {
  const { colors } = useTheme(); // 🚀 Nếu đường dẫn trên đúng, dòng này sẽ lấy được màu
  const [inputText, setInputText] = useState("");

  const handleSend = () => {
    if (!inputText.trim()) return;
    onSendText(inputText);
    setInputText("");
  };

  return (
    // 🚀 BAO BỌC NGOÀI CÙNG (Thanh chứa toàn bộ cụm nhập): Đổi sang màu Surface của Theme
    <View
      style={[
        styles.container,
        { backgroundColor: colors.surface, borderTopColor: colors.border },
      ]}
    >
      {/* 🚀 Ô TEXTINPUT (Khung trắng nhỏ nằm trong thanh): Đổi sang màu Background của Theme */}
      <View
        style={[
          styles.inputWrapper,
          { backgroundColor: colors.background, borderColor: colors.border },
        ]}
      >
        <TextInput
          style={[styles.input, { color: colors.text }]}
          value={inputText}
          onChangeText={setInputText}
          placeholder={
            isRecording ? "Đang lắng nghe sếp nói..." : "Nhập tin nhắn..."
          }
          placeholderTextColor={colors.textMuted}
          editable={!isLoading && !isRecording}
        />

        {/* Nút gửi tin nhắn chữ */}
        {inputText.trim().length > 0 && (
          <TouchableOpacity onPress={handleSend} style={styles.btnAction}>
            <MaterialIcons name="send" size={24} color={colors.indigo} />
          </TouchableOpacity>
        )}
      </View>

      {/* NÚT GHI ÂM / LOADING */}
      <View style={styles.rightActions}>
        {isLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={colors.indigo} />
          </View>
        ) : (
          <TouchableOpacity
            onPressIn={onStartRecord} // Nhấn giữ để ghi âm
            onPressOut={onStopRecord} // Thả ra để gửi đi
            style={[
              styles.btnMic,
              { backgroundColor: isRecording ? colors.error : colors.indigo },
            ]}
            activeOpacity={0.7}
          >
            <MaterialIcons
              name={isRecording ? "stop" : "mic"}
              size={26}
              color="#FFFFFF"
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    ...Platform.select({
      ios: { paddingBottom: 28 },
      android: { paddingBottom: 12 },
    }),
  },
  inputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 16,
    marginRight: 12,
    minHeight: 48,
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 8,
  },
  btnAction: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 6,
  },
  rightActions: {
    justifyContent: "center",
    alignItems: "center",
  },
  btnMic: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3.5,
  },
  loadingBox: {
    width: 48,
    height: 48,
    justifyContent: "center",
    alignItems: "center",
  },
});
