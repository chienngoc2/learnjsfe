import React, { useState, useRef, useEffect } from "react";
import {
  StyleSheet,
  View,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Audio } from "expo-av";
import { Stack } from "expo-router";
import api from "../../services/api";

// IMPORT COMPONENT UI
import ChatBubble from "@/components/ui/vocal/chat/ChatBubble";
import VoiceIndicator from "@/components/ui/vocal/chat/VoiceIndicator";
import ChatInput from "@/components/ui/vocal/chat/ChatInput";
import Header from "../../components/ui/Header";
import { useTheme } from "@/src/context/ThemeContext";


export default function ChatScreen() {
  const { colors } = useTheme();
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const currentSoundRef = useRef<Audio.Sound | null>(null);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    (async () => {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
    })();

    return () => {
      if (currentSoundRef.current) {
        currentSoundRef.current.unloadAsync();
      }
    };
  }, []);

  const playAudioSegments = async (audioSegments: string[]) => {
    for (const base64Data of audioSegments) {
      try {
        const { sound } = await Audio.Sound.createAsync(
          { uri: base64Data },
          { shouldPlay: true },
        );
        currentSoundRef.current = sound;
        await new Promise((resolve) =>
          sound.setOnPlaybackStatusUpdate((status: any) => {
            if (status.didJustFinish) resolve(true);
          }),
        );
        await sound.unloadAsync();
        currentSoundRef.current = null;
      } catch (error) {
        console.error(error);
      }
    }
  };

  const startRecording = async () => {
    try {
      setIsRecording(true);
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      setRecording(recording);
    } catch (err) {
      setIsRecording(false);
    }
  };

  const stopRecording = async () => {
    try {
      setIsRecording(false);
      if (!recording) return;
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      if (uri) sendAudio(uri);
      setRecording(null);
    } catch (err) {
      console.error(err);
    }
  };

  const sendAudio = async (uri: string) => {
    setLoading(true);
    const formData = new FormData();
    // @ts-ignore
    formData.append("audio", { uri, name: "voice.m4a", type: "audio/m4a" });

    try {
      const response = await api.post("/api/chat/transcribe", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      handleChat(response.data.text);
    } catch (err) {
      alert("Server không nghe rõ sếp nói gì!");
    } finally {
      setLoading(false);
    }
  };

  // 🚀 LOGIC CHAT CHÍNH: Đã sửa định dạng Payload gửi lên Backend
  const handleChat = async (text: string) => {
    if (!text.trim()) return;

    // 1. Đẩy tin nhắn của User vào giao diện hiển thị trước
    setMessages((prev) => [
      ...prev,
      { id: Date.now().toString(), text, role: "user" },
    ]);
    setLoading(true);

    try {
      // 2. Định dạng lại toàn bộ lịch sử + câu tin nhắn mới để Backend gửi thẳng cho AI LLaMA
      const historyPayload = [
        ...messages.map((m) => ({
          role: m.role === "user" ? "user" : "assistant", // Đổi chữ 'bot' ở App thành 'assistant' chuẩn OpenAI
          content: m.text, // Đổi chữ 'text' thành 'content'
        })),
        { role: "user", content: text }, // Đính kèm luôn câu tin nhắn vừa gõ
      ];

      // 3. Gửi chuẩn object { messages: [ ... ] } lên Server
      const response = await api.post("/api/chat/chat", {
        messages: historyPayload,
      });

      // 4. Nhận phản hồi từ Sensei AI và hiển thị lên màn hình
      if (response.data.success) {
        const botMsg = {
          id: (Date.now() + 1).toString(),
          text: response.data.reply,
          role: "bot",
        };
        setMessages((prev) => [...prev, botMsg]);

        if (response.data.audioSegments) {
          playAudioSegments(response.data.audioSegments);
        }
      }
    } catch (err) {
      console.error("Lỗi gọi API Chat:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <Header title="Luyện Hội Thoại AI 🤖" />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined} // 🚀 ĐÃ FIX: Android dùng undefined tránh lỗi nhảy double thanh input
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        {/* 🚀 ĐÃ FIX: Thêm style={{ flex: 1 }} để FlatList đẩy ô nhập xuống đáy */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ChatBubble message={item.text} role={item.role} />
          )}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 15 }}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: true })
          }
        />

        <VoiceIndicator isRecording={isRecording} />

        <ChatInput
          onSendText={handleChat}
          onStartRecord={startRecording}
          onStopRecord={stopRecording}
          isRecording={isRecording}
          isLoading={loading}
        />
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({ container: { flex: 1 } });
