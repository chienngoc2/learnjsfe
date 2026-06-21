import React, { useState, useRef, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  ImageBackground,
} from "react-native";
import { Audio } from "expo-av";
import { Stack, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialIcons } from "@expo/vector-icons";
import api from "../../services/api";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  interpolate,
} from "react-native-reanimated";

// IMPORT COMPONENT UI & STORE
import ChatBubble from "@/components/ui/vocal/chat/ChatBubble";
import ChatInput from "@/components/ui/vocal/chat/ChatInput";
import Header from "../../components/ui/Header";
import { useTheme } from "@/src/context/ThemeContext";
import { useCultivationStore } from "../../store/useCultivationStore";

export default function ChatScreen() {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const currentSoundRef = useRef<Audio.Sound | null>(null);
  const flatListRef = useRef<FlatList>(null);

  // Zustand Store
  const { tokensUsed, addTokens, clearTokens } = useCultivationStore();

  // Voice Chat States
  const [voiceChatMode, setVoiceChatMode] = useState(false);
  const [voiceChatStatus, setVoiceChatStatus] = useState<
    "idle" | "recording" | "transcribing" | "thinking" | "speaking"
  >("idle");

  // Reanimated Shared Values for Ripples
  const pulse1 = useSharedValue(1);
  const pulse2 = useSharedValue(1);
  const orbScale = useSharedValue(1);

  // Trigger continuous ripples when in Voice Chat mode
  useEffect(() => {
    if (voiceChatMode) {
      pulse1.value = withRepeat(
        withTiming(2, { duration: 1600 }),
        -1,
        false
      );
      // Offset second pulse
      setTimeout(() => {
        pulse2.value = withRepeat(
          withTiming(2, { duration: 1600 }),
          -1,
          false
        );
      }, 800);
    } else {
      pulse1.value = 1;
      pulse2.value = 1;
    }
  }, [voiceChatMode]);

  // Animate orb size when recording or speaking
  useEffect(() => {
    if (voiceChatStatus === "recording") {
      orbScale.value = withRepeat(
        withSequence(
          withTiming(1.15, { duration: 600 }),
          withTiming(1.0, { duration: 600 })
        ),
        -1,
        true
      );
    } else if (voiceChatStatus === "speaking") {
      orbScale.value = withRepeat(
        withSequence(
          withTiming(1.1, { duration: 450 }),
          withTiming(0.95, { duration: 450 })
        ),
        -1,
        true
      );
    } else {
      orbScale.value = withTiming(1.0, { duration: 300 });
    }
  }, [voiceChatStatus]);

  const clearHistory = () => {
    setMessages([]);
    clearTokens();
  };

  useEffect(() => {
    (async () => {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login" as any);
        return;
      }

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
          { shouldPlay: true }
        );
        currentSoundRef.current = sound;
        await new Promise((resolve) =>
          sound.setOnPlaybackStatusUpdate((status: any) => {
            if (status.didJustFinish) resolve(true);
          })
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
      if (voiceChatMode) setVoiceChatStatus("recording");
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);
    } catch (err) {
      setIsRecording(false);
      if (voiceChatMode) setVoiceChatStatus("idle");
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
      if (voiceChatMode) setVoiceChatStatus("idle");
    }
  };

  const sendAudio = async (uri: string) => {
    setLoading(true);
    if (voiceChatMode) setVoiceChatStatus("transcribing");
    const formData = new FormData();
    // @ts-ignore
    formData.append("audio", { uri, name: "voice.m4a", type: "audio/m4a" });

    try {
      const response = await api.post("/api/chat/transcribe", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const recognizedText = response.data.text || "";
      if (voiceChatMode) setVoiceChatStatus("thinking");
      await handleChat(recognizedText);
    } catch (err) {
      alert("Kết nối máy chủ thất bại.");
      if (voiceChatMode) setVoiceChatStatus("idle");
    } finally {
      setLoading(false);
    }
  };

  const handleChat = async (text: string) => {
    if (!text.trim()) return;

    setMessages((prev) => [
      ...prev,
      { id: Date.now().toString(), text, role: "user" },
    ]);
    setLoading(true);
    if (voiceChatMode) setVoiceChatStatus("thinking");

    try {
      const historyPayload = [
        ...messages.map((m) => ({
          role: m.role === "user" ? "user" : "assistant",
          content: m.text,
        })),
        { role: "user", content: text },
      ];

      const response = await api.post("/api/chat/chat", {
        messages: historyPayload,
      });

      if (response.data.success) {
        const botMsg = {
          id: (Date.now() + 1).toString(),
          text: response.data.reply,
          role: "bot",
        };
        setMessages((prev) => [...prev, botMsg]);

        if (response.data.usage) {
          const prompt = response.data.usage.prompt_tokens || 0;
          const completion = response.data.usage.completion_tokens || 0;
          addTokens(prompt, completion);
        }

        // --- XỬ LÝ ĐIỀU HƯỚNG TỰ ĐỘNG BẰNG AI TRÊN MOBILE ---
        if (response.data.navigation) {
          const { tab, game, mode, listId, topicTitle } = response.data.navigation;
          setTimeout(() => {
            if (tab === "match") {
              // Trên mobile, Game Center tương ứng với các màn hình luyện tập trong thư mục study
              if (game === "grammar_match") {
                router.push({ pathname: "/study/practice-grammar", params: { topicTitle } } as any);
              } else if (game === "tower") {
                router.push({ pathname: "/study/practice-quiz", params: { topicId: listId } } as any);
              } else if (game === "missing") {
                router.push({ pathname: "/study/practice-typing", params: { topicId: listId } } as any);
              } else {
                router.push({ pathname: "/study/practice-conjugation", params: { topicId: listId } } as any);
              }
            } else if (tab === "vocab") {
              // Màn hình học tập (vocab) trên mobile
              router.push("/vocab" as any);
            } else if (tab === "grammar") {
              // Ngữ pháp trên mobile nằm trong practice-grammar (danh sách menu)
              router.push({ pathname: "/study/practice-grammar", params: { topicTitle } } as any);
            } else if (tab === "flashcards" || tab === "study") {
              if (listId) {
                router.push({ pathname: "/study/card-viewer", params: { topicId: listId } } as any);
              } else {
                router.push("/study/flashcard" as any);
              }
            } else if (tab === "quiz") {
              if (mode === "grammar") {
                router.push({ pathname: "/study/practice-grammar", params: { topicTitle } } as any);
              } else {
                router.push({ pathname: "/study/practice-quiz", params: { topicId: listId } } as any);
              }
            } else if (tab === "overview") {
              router.push("/" as any);
            } else if (tab === "statistics" || tab === "profile" || tab === "achievements") {
              router.push("/profile" as any);
            } else {
              router.push(`/${tab}` as any);
            }
          }, 1500); // Trễ 1.5s để học viên đọc xong phản hồi của AI
        }

        if (response.data.audioSegments) {
          if (voiceChatMode) setVoiceChatStatus("speaking");
          await playAudioSegments(response.data.audioSegments);
        }
      }
    } catch (err) {
      console.error("Lỗi gọi API Chat:", err);
    } finally {
      setLoading(false);
      if (voiceChatMode) setVoiceChatStatus("idle");
    }
  };

  // Reanimated Styles for Ripples
  const rippleStyle1 = useAnimatedStyle(() => {
    const scale = pulse1.value;
    const opacity = interpolate(scale, [1, 2], [0.5, 0]);
    return {
      transform: [{ scale }],
      opacity,
    };
  });

  const rippleStyle2 = useAnimatedStyle(() => {
    const scale = pulse2.value;
    const opacity = interpolate(scale, [1, 2], [0.5, 0]);
    return {
      transform: [{ scale }],
      opacity,
    };
  });

  const orbStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: orbScale.value }],
    };
  });

  const toggleVoiceMode = () => {
    // If speaking, stop playback
    if (currentSoundRef.current) {
      currentSoundRef.current.stopAsync();
    }
    setVoiceChatMode(!voiceChatMode);
    setVoiceChatStatus("idle");
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <Header title="Truyền Tin Điện" />

      {/* SENSEI AVATAR HEADER CARD */}
      <View style={[styles.masterCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Image
          source={require("../../assets/images/ai_master.png")}
          style={[styles.masterAvatar, { borderColor: colors.indigo }]}
        />
        <View style={styles.masterInfo}>
          <Text style={[styles.masterName, { color: colors.text }]}>Khương Tử Nha (AI Sensei)</Text>
          <Text style={[styles.masterTitle, { color: colors.indigo }]}>【 Hóa Thần Cảnh Linh Anh 】</Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: colors.blue }]} />
            <Text style={[styles.statusText, { color: colors.textMuted }]}>Tĩnh tọa truyền pháp</Text>
          </View>
        </View>
      </View>

      {/* CONTROL BAR */}
      <View style={[styles.controlBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Text style={[styles.tokenText, { color: colors.textMuted }]}>
          Linh lực tiêu hao: <Text style={{ fontWeight: "bold", color: colors.indigo }}>{tokensUsed.total}</Text> (Prompt: {tokensUsed.prompt} | Rep: {tokensUsed.completion})
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <TouchableOpacity onPress={toggleVoiceMode} style={styles.voiceToggleBtn} activeOpacity={0.7}>
            <MaterialIcons
              name={voiceChatMode ? "keyboard" : "keyboard-voice"}
              size={20}
              color={colors.indigo}
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={clearHistory} style={styles.clearBtn} activeOpacity={0.7}>
            <MaterialIcons name="delete-sweep" size={20} color={colors.error} />
          </TouchableOpacity>
        </View>
      </View>

      {!voiceChatMode ? (
        /* STANDARD CHAT VIEW WITH PARCHMENT SCROLL STYLE BACKGROUND */
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
        >
          <View style={styles.scrollBackground}>
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <ChatBubble message={item.text} role={item.role === "user" ? "user" : "bot"} />
              )}
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: 15, paddingBottom: 30 }}
              onContentSizeChange={() =>
                flatListRef.current?.scrollToEnd({ animated: true })
              }
            />
          </View>

          <ChatInput
            onSendText={handleChat}
            onStartRecord={startRecording}
            onStopRecord={stopRecording}
            isRecording={isRecording}
            isLoading={loading}
          />
        </KeyboardAvoidingView>
      ) : (
        /* PREMIUM VOICE CHAT MODE OVERLAY (KIM ĐAN CORE STYLE) */
        <View style={[styles.voiceOverlay, { backgroundColor: colors.background }]}>
          <Text style={[styles.voiceTitle, { color: colors.indigo }]}>Sensei Voice Portal</Text>
          
          <View style={styles.voiceCoreContainer}>
            {/* Ripples */}
            <Animated.View style={[styles.rippleRing, rippleStyle1, { borderColor: colors.indigo }]} />
            <Animated.View style={[styles.rippleRing, rippleStyle2, { borderColor: colors.indigo }]} />

            {/* Main Interactive Orb (Glowing Kim Đan) */}
            <TouchableOpacity
              onPress={() => {
                if (voiceChatStatus === "idle") {
                  startRecording();
                } else if (voiceChatStatus === "recording") {
                  stopRecording();
                }
              }}
              disabled={voiceChatStatus !== "idle" && voiceChatStatus !== "recording"}
              activeOpacity={0.85}
            >
              <Animated.View
                style={[
                  styles.mainOrb,
                  orbStyle,
                  {
                    backgroundColor:
                      voiceChatStatus === "recording"
                        ? colors.error
                        : voiceChatStatus === "speaking"
                        ? colors.indigo
                        : isDark
                        ? "#121824"
                        : "#FEF3C7",
                    borderColor: colors.indigo,
                    shadowColor: colors.indigo,
                  },
                ]}
              >
                {voiceChatStatus === "transcribing" || voiceChatStatus === "thinking" ? (
                  <ActivityIndicator size="large" color={colors.indigo} />
                ) : (
                  <MaterialIcons
                    name={
                      voiceChatStatus === "recording"
                        ? "stop"
                        : voiceChatStatus === "speaking"
                        ? "volume-up"
                        : "mic"
                    }
                    size={42}
                    color={
                      voiceChatStatus === "recording" || voiceChatStatus === "speaking"
                        ? "#050814"
                        : colors.indigo
                    }
                  />
                )}
              </Animated.View>
            </TouchableOpacity>
          </View>

          <Text style={[styles.voiceStatusText, { color: colors.text }]}>
            {voiceChatStatus === "idle" && "Chạm vào Kim Đan để đàm đạo"}
            {voiceChatStatus === "recording" && "Đang truyền đạt thần niệm..."}
            {voiceChatStatus === "transcribing" && "Đang giải mã thần niệm..."}
            {voiceChatStatus === "thinking" && "Sensei đang cân nhắc..."}
            {voiceChatStatus === "speaking" && "Sensei đang thuyết pháp..."}
          </Text>

          {messages.length > 0 && (
            <View style={[styles.voiceTranscriptContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.voiceTranscriptLabel, { color: colors.textMuted }]}>Thần Niệm Cuối Cùng</Text>
              <Text style={[styles.voiceTranscriptBody, { color: colors.text }]} numberOfLines={3}>
                {messages[messages.length - 1].text}
              </Text>
            </View>
          )}

          <TouchableOpacity onPress={toggleVoiceMode} style={[styles.exitVoiceBtn, { borderColor: colors.border }]} activeOpacity={0.7}>
            <Text style={{ color: colors.textMuted, fontWeight: "600", fontSize: 13 }}>Quay lại giao diện truyền tin</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  masterCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  masterAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
  },
  masterInfo: {
    marginLeft: 14,
    flex: 1,
  },
  masterName: {
    fontSize: 15,
    fontWeight: "800",
  },
  masterTitle: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
    letterSpacing: 0.5,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
  },
  controlBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    elevation: 1,
    marginTop: 10,
  },
  tokenText: {
    fontSize: 11,
    fontWeight: "500",
  },
  clearBtn: {
    padding: 6,
    borderRadius: 8,
  },
  voiceToggleBtn: {
    padding: 6,
    borderRadius: 8,
  },
  scrollBackground: {
    flex: 1,
    // Adds a subtle background look for a scroll parchment atmosphere
    backgroundColor: "transparent",
  },
  voiceOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  voiceTitle: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  voiceCoreContainer: {
    width: 240,
    height: 240,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  rippleRing: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
  },
  mainOrb: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 2.5,
    alignItems: "center",
    justifyContent: "center",
    elevation: 10,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  voiceStatusText: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 10,
  },
  voiceTranscriptContainer: {
    width: "100%",
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginVertical: 15,
  },
  voiceTranscriptLabel: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  voiceTranscriptBody: {
    fontSize: 13,
    lineHeight: 18,
  },
  exitVoiceBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
  },
});
