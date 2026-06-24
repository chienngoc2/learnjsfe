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
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface ChatInputProps {
  onSendText: (text: string) => void;
  onStartRecord: () => void;
  onStopRecord: () => void;
  isRecording: boolean;
  isLoading: boolean;
  isPlayingVoice?: boolean;
  onStopSpeaking?: () => void;
}

export default function ChatInput({
  onSendText,
  onStartRecord,
  onStopRecord,
  isRecording,
  isLoading,
  isPlayingVoice,
  onStopSpeaking,
}: ChatInputProps) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [inputText, setInputText] = useState("");

  const handleSend = () => {
    if (!inputText.trim()) return;
    onSendText(inputText);
    setInputText("");
  };

  // Unified mic button handler:
  // - If speaking → stop speaking
  // - If recording → stop recording
  // - Otherwise → start recording
  const handleMicPress = () => {
    if (isPlayingVoice && onStopSpeaking) {
      onStopSpeaking();
    } else if (isRecording) {
      onStopRecord();
    } else {
      onStartRecord();
    }
  };

  // Mic button visual state
  const micBg = isPlayingVoice
    ? "#8C5C38"
    : isRecording
    ? "#EF4444"
    : "#000000";
  const micBorder = isPlayingVoice
    ? "#CFAC62"
    : isRecording
    ? "#EF4444"
    : "#8C5C38";
  const micIcon = isPlayingVoice
    ? "volume-mute"
    : isRecording
    ? "stop"
    : "mic";
  const micColor = isPlayingVoice
    ? "#CFAC62"
    : isRecording
    ? "#FFFFFF"
    : colors.indigo;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: "rgba(0, 0, 0, 0.85)",
          borderTopColor: "#8C5C38",
          borderTopWidth: 1.5,
          paddingBottom: Math.max(12, insets.bottom),
        },
      ]}
    >
      {/* TEXT INPUT */}
      <View
        style={[
          styles.inputWrapper,
          {
            backgroundColor: "#151210",
            borderColor: "#8C5C38",
            borderWidth: 1.5,
          },
        ]}
      >
        <TextInput
          style={[styles.input, { color: "#F7E5C4" }]}
          value={inputText}
          onChangeText={setInputText}
          placeholder={
            isRecording ? "Đang lắng nghe..." : "Nhập tin nhắn..."
          }
          placeholderTextColor={isRecording ? "#EF4444" : "#A39185"}
          editable={!isLoading && !isRecording}
        />

        {/* Send button */}
        {inputText.trim().length > 0 && (
          <TouchableOpacity onPress={handleSend} style={styles.btnAction}>
            <MaterialIcons name="send" size={24} color={colors.indigo} />
          </TouchableOpacity>
        )}
      </View>

      {/* MIC / LOADING / STOP button — all unified into one */}
      <View style={styles.rightActions}>
        {isLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={colors.indigo} />
          </View>
        ) : (
          <TouchableOpacity
            onPress={handleMicPress}
            style={[
              styles.btnMic,
              {
                backgroundColor: micBg,
                borderColor: micBorder,
                borderWidth: 2,
              },
            ]}
            activeOpacity={0.7}
          >
            <MaterialIcons name={micIcon} size={24} color={micColor} />
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
