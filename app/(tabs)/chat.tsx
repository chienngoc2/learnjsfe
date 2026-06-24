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
  ImageBackground,
  Alert,
} from "react-native";
import { Audio } from "expo-av";
import { Stack, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialIcons, Ionicons } from "@expo/vector-icons";
import api from "../../services/api";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  interpolate,
  FadeInDown,
} from "react-native-reanimated";
import { useIsFocused } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import ChatBubble from "@/components/ui/vocal/chat/ChatBubble";
import ChatInput from "@/components/ui/vocal/chat/ChatInput";

import { useTheme } from "@/src/context/ThemeContext";
import { useCultivationStore } from "../../store/useCultivationStore";

export default function ChatScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [messages, setMessages] = useState<any[]>([]);
  const isFocused = useIsFocused();
  const [avatarBot, setAvatarBot] = useState("");

  useEffect(() => {
    if (isFocused) {
      (async () => {
        const ab = await AsyncStorage.getItem("avatar_bot");
        if (ab) setAvatarBot(ab);
      })();
    }
  }, [isFocused]);

  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const isPreparingRecording = useRef(false);
  const currentSoundRef = useRef<Audio.Sound | null>(null);
  const activeSoundResolveRef = useRef<(() => void) | null>(null);
  const flatListRef = useRef<FlatList>(null);

  const { addTokens, clearTokens } = useCultivationStore();

  // Voice mode — use ref to avoid stale closures inside async functions
  const [voiceChatMode, setVoiceChatMode] = useState(false);
  const voiceChatModeRef = useRef(false);
  const [voiceChatStatus, setVoiceChatStatus] = useState<
    "idle" | "recording" | "transcribing" | "thinking" | "speaking"
  >("idle");
  const voiceChatStatusRef = useRef<"idle" | "recording" | "transcribing" | "thinking" | "speaking">("idle");
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const stopAudioRequestRef = useRef(false);

  // Keep refs in sync
  const setVoiceChatModeSync = (val: boolean) => {
    voiceChatModeRef.current = val;
    setVoiceChatMode(val);
  };
  const setVoiceChatStatusSync = (val: typeof voiceChatStatus) => {
    voiceChatStatusRef.current = val;
    setVoiceChatStatus(val);
  };

  // Ripple animations
  const pulse1 = useSharedValue(1);
  const pulse2 = useSharedValue(1);
  const orbScale = useSharedValue(1);

  useEffect(() => {
    if (voiceChatMode) {
      pulse1.value = withRepeat(withTiming(2, { duration: 1600 }), -1, false);
      setTimeout(() => {
        pulse2.value = withRepeat(withTiming(2, { duration: 1600 }), -1, false);
      }, 800);
    } else {
      pulse1.value = withTiming(1, { duration: 300 });
      pulse2.value = withTiming(1, { duration: 300 });
    }
  }, [voiceChatMode]);

  useEffect(() => {
    if (voiceChatStatus === "recording") {
      orbScale.value = withRepeat(
        withSequence(
          withTiming(1.15, { duration: 600 }),
          withTiming(1.0, { duration: 600 })
        ),
        -1, true
      );
    } else if (voiceChatStatus === "speaking") {
      orbScale.value = withRepeat(
        withSequence(
          withTiming(1.1, { duration: 450 }),
          withTiming(0.95, { duration: 450 })
        ),
        -1, true
      );
    } else {
      orbScale.value = withTiming(1.0, { duration: 300 });
    }
  }, [voiceChatStatus]);

  // Setup audio permissions on mount
  useEffect(() => {
    (async () => {
      const token = await AsyncStorage.getItem("token");
      if (!token) { router.replace("/login" as any); return; }

      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Quyền Microphone", "Cần cấp quyền microphone để ghi âm giọng nói.");
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        playThroughEarpieceAndroid: false,
      });
    })();

    return () => {
      currentSoundRef.current?.unloadAsync();
      recordingRef.current?.stopAndUnloadAsync().catch(() => {});
    };
  }, []);

  // ─── STOP BOT SPEAKING ───────────────────────────────────────
  const stopBotSpeaking = async () => {
    stopAudioRequestRef.current = true;
    setIsPlayingVoice(false);
    setVoiceChatStatusSync("idle");
    if (activeSoundResolveRef.current) {
      activeSoundResolveRef.current();
      activeSoundResolveRef.current = null;
    }
    try {
      if (currentSoundRef.current) {
        await currentSoundRef.current.stopAsync();
        await currentSoundRef.current.unloadAsync();
      }
    } catch (e) {
      // ignore
    }
    currentSoundRef.current = null;
  };

  // ─── PLAY AUDIO SEGMENTS ─────────────────────────────────────
  const playAudioSegments = async (audioSegments: string[]) => {
    stopAudioRequestRef.current = false;
    setIsPlayingVoice(true);
    if (voiceChatModeRef.current) setVoiceChatStatusSync("speaking");

    for (const base64Data of audioSegments) {
      if (stopAudioRequestRef.current) break;
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          playThroughEarpieceAndroid: false,
        });
        const { sound } = await Audio.Sound.createAsync(
          { uri: base64Data },
          { shouldPlay: true }
        );
        currentSoundRef.current = sound;

        if (stopAudioRequestRef.current) {
          await sound.unloadAsync();
          break;
        }

        await new Promise<void>((resolve) => {
          activeSoundResolveRef.current = resolve;
          sound.setOnPlaybackStatusUpdate((status: any) => {
            if (status.didJustFinish || stopAudioRequestRef.current) {
              resolve();
            }
          });
        });
        activeSoundResolveRef.current = null;
        await sound.unloadAsync();
        currentSoundRef.current = null;
      } catch (error) {
        console.error("Audio playback error:", error);
      }
    }

    setIsPlayingVoice(false);
    if (voiceChatModeRef.current) setVoiceChatStatusSync("idle");
  };

  // ─── RECORDING ───────────────────────────────────────────────
  const startRecording = async () => {
    if (isRecording || recordingRef.current || isPreparingRecording.current) return;
    isPreparingRecording.current = true;
    try {
      setIsRecording(true);
      if (voiceChatModeRef.current) setVoiceChatStatusSync("recording");

      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Quyền Microphone", "Cần cấp quyền microphone để ghi âm.");
        setIsRecording(false);
        if (voiceChatModeRef.current) setVoiceChatStatusSync("idle");
        isPreparingRecording.current = false;
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        playThroughEarpieceAndroid: false,
      });

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = newRecording;
      isPreparingRecording.current = false;
    } catch (err) {
      console.error("Lỗi bắt đầu ghi âm:", err);
      recordingRef.current = null;
      setIsRecording(false);
      isPreparingRecording.current = false;
      if (voiceChatModeRef.current) setVoiceChatStatusSync("idle");
      Alert.alert("Lỗi Microphone", "Không thể bắt đầu ghi âm.");
    }
  };

  const stopRecording = async (discard = false) => {
    const currentRec = recordingRef.current;
    if (!currentRec) {
      setIsRecording(false);
      return;
    }
    try {
      setIsRecording(false);
      await currentRec.stopAndUnloadAsync();
      const uri = currentRec.getURI();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        playThroughEarpieceAndroid: false,
      });
      if (uri && !discard) sendAudio(uri);
    } catch (err) {
      console.error("Lỗi dừng ghi âm:", err);
      if (voiceChatModeRef.current) setVoiceChatStatusSync("idle");
    } finally {
      recordingRef.current = null;
    }
  };

  // ─── SEND AUDIO ──────────────────────────────────────────────
  const sendAudio = async (uri: string) => {
    setLoading(true);
    if (voiceChatModeRef.current) setVoiceChatStatusSync("transcribing");

    const formData = new FormData();

    if (Platform.OS === "web") {
      try {
        const res = await fetch(uri);
        const blob = await res.blob();
        const rawMime = blob.type || "";
        console.log("[Audio] MIME:", rawMime, "Size:", blob.size);

        if (blob.size < 200) {
          console.warn("Audio too small, skipping upload.");
          setLoading(false);
          if (voiceChatModeRef.current) setVoiceChatStatusSync("idle");
          return;
        }

        let ext = "webm";
        if (rawMime.includes("mp4") || rawMime.includes("m4a") || rawMime.includes("aac")) ext = "m4a";
        else if (rawMime.includes("wav")) ext = "wav";
        else if (rawMime.includes("mpeg") || rawMime.includes("mp3")) ext = "mp3";
        else if (rawMime.includes("ogg")) ext = "ogg";

        formData.append("audio", blob, `voice.${ext}`);
      } catch (err) {
        console.error("Web audio convert error:", err);
        // @ts-ignore
        formData.append("audio", { uri, name: "voice.webm", type: "audio/webm" });
      }
    } else {
      // Native iOS / Android
      // @ts-ignore
      formData.append("audio", { uri, name: "voice.m4a", type: "audio/m4a" });
    }

    try {
      const response = await api.post("/api/chat/transcribe", formData, {
        headers: {
          "Content-Type": Platform.OS === "web" ? undefined : "multipart/form-data",
        },
      });
      const recognizedText = response.data.text || "";
      if (voiceChatModeRef.current) setVoiceChatStatusSync("thinking");
      await handleChat(recognizedText);
    } catch (err: any) {
      console.error("Transcribe API error:", err?.response?.data || err.message);
      const serverMsg = err?.response?.data?.message || "Kết nối máy chủ thất bại.";
      Alert.alert("Lỗi", serverMsg);
      if (voiceChatModeRef.current) setVoiceChatStatusSync("idle");
    } finally {
      setLoading(false);
    }
  };

  // ─── HANDLE CHAT ─────────────────────────────────────────────
  const handleChat = async (text: string) => {
    if (!text.trim()) return;

    setMessages((prev) => [...prev, { id: Date.now().toString(), text, role: "user" }]);
    setLoading(true);
    if (voiceChatModeRef.current) setVoiceChatStatusSync("thinking");

    try {
      const historyPayload = [
        ...messages.map((m) => ({
          role: m.role === "user" ? "user" : "assistant",
          content: m.text,
        })),
        { role: "user", content: text },
      ];

      const response = await api.post("/api/chat/chat", { messages: historyPayload });

      if (response.data.success) {
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            text: response.data.reply,
            role: "bot",
            navigation: response.data.navigation,
          },
        ]);

        if (response.data.usage) {
          addTokens(
            response.data.usage.prompt_tokens || 0,
            response.data.usage.completion_tokens || 0
          );
        }

        // Play audio if returned
        let audioPromise = Promise.resolve<void>(undefined);
        if (response.data.audioSegments?.length > 0) {
          audioPromise = playAudioSegments(response.data.audioSegments);
        }

        // Navigation after audio
        if (response.data.navigation) {
          const nav = response.data.navigation;
          await audioPromise;
          setTimeout(() => executeNavigation(nav), response.data.audioSegments?.length > 0 ? 800 : 0);
        } else {
          await audioPromise;
        }
      }
    } catch (err) {
      console.error("Lỗi API Chat:", err);
    } finally {
      setLoading(false);
      if (voiceChatModeRef.current) setVoiceChatStatusSync("idle");
    }
  };

  // ─── NAVIGATION HELPER ───────────────────────────────────────
  const executeNavigation = (nav: any) => {
    const { tab, game, mode, listId, topicTitle } = nav;
    if (tab === "match") {
      if (game === "grammar_match") router.push({ pathname: "/luyen-tap/grammar", params: { topicTitle, mode: "match" } } as any);
      else if (game === "vocab_match" || game === "match" || game === "memory") router.push({ pathname: "/luyen-tap/vocab-match", params: { topicId: listId } } as any);
      else if (game === "tower") router.push({ pathname: "/luyen-tap/quiz", params: { topicId: listId } } as any);
      else if (game === "missing") router.push({ pathname: "/luyen-tap/typing", params: { topicId: listId } } as any);
      else router.push({ pathname: "/luyen-tap/conjugation", params: { topicId: listId } } as any);
    } else if (tab === "add-grammar") router.push("/study/add-grammar" as any);
    else if (tab === "grammar-viewer") router.push("/study/grammar-viewer" as any);
    else if (tab === "add-vocab") router.push("/study/add-vocab" as any);
    else if (tab === "vocab") router.push("/vocab" as any);
    else if (tab === "grammar") router.push({ pathname: "/luyen-tap/grammar", params: { topicTitle } } as any);
    else if (tab === "flashcards" || tab === "study") {
      if (listId) router.push({ pathname: "/study/card-viewer", params: { topicId: listId } } as any);
      else router.push("/study/flashcard" as any);
    } else if (tab === "quiz") {
      if (mode === "grammar") router.push({ pathname: "/luyen-tap/grammar", params: { topicTitle, mode: "ai_translation" } } as any);
      else router.push({ pathname: "/luyen-tap/quiz", params: { topicId: listId } } as any);
    } else if (tab === "write") router.push("/study/add-kanji" as any);
    else if (tab === "overview") router.push("/" as any);
    else if (tab === "statistics" || tab === "profile" || tab === "achievements") router.push("/profile" as any);
    else router.push(`/${tab}` as any);
  };

  const getNavLabel = (nav: any) => {
    const { tab, game, mode } = nav;
    if (tab === "match") {
      if (game === "grammar_match") return "Ghép Ngữ Pháp 📚";
      if (game === "vocab_match" || game === "match" || game === "memory") return "Ghép Từ Vựng 🎮";
      if (game === "tower") return "Trắc Nghiệm ⚡";
      if (game === "missing") return "Luyện Gõ Chữ ✍️";
      return "Chia Động Từ 🔄";
    }
    if (tab === "add-grammar") return "Thêm Ngữ Pháp ➕";
    if (tab === "grammar-viewer") return "Xem Ngữ Pháp 📖";
    if (tab === "add-vocab") return "Thêm Từ Vựng ➕";
    if (tab === "vocab") return "Học Từ Vựng 🎴";
    if (tab === "grammar") return "Học Ngữ Pháp 📚";
    if (tab === "flashcards" || tab === "study") return "Xem Flashcard 🎴";
    if (tab === "quiz") return mode === "grammar" ? "Luyện dịch Ngữ pháp ✍️" : "Trắc Nghiệm ⚡";
    if (tab === "write") return "Tập viết Kanji ✍️";
    if (tab === "overview") return "Về Trang Chủ 🏠";
    if (tab === "statistics" || tab === "profile" || tab === "achievements") return "Xem Cá Nhân 👤";
    return "Đi đến trang ➔";
  };

  // ─── ANIMATED STYLES ─────────────────────────────────────────
  const rippleStyle1 = useAnimatedStyle(() => {
    const scale = pulse1.value;
    return { transform: [{ scale }], opacity: interpolate(scale, [1, 2], [0.5, 0]) };
  });
  const rippleStyle2 = useAnimatedStyle(() => {
    const scale = pulse2.value;
    return { transform: [{ scale }], opacity: interpolate(scale, [1, 2], [0.5, 0]) };
  });
  const orbStyle = useAnimatedStyle(() => ({
    transform: [{ scale: orbScale.value }],
  }));

  const toggleVoiceMode = () => {
    stopBotSpeaking();
    if (recordingRef.current) {
      stopRecording(true);
    }
    setVoiceChatModeSync(!voiceChatModeRef.current);
    setVoiceChatStatusSync("idle");
  };

  // ─── RENDER ──────────────────────────────────────────────────
  return (
    <ImageBackground
      source={{ uri: "https://i.pinimg.com/736x/e1/83/e4/e183e45edeb5c15066999b80f6a37296.jpg" }}
      style={[styles.container, { paddingTop: insets.top }]}
      resizeMode="cover"
    >
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── STANDARD CHAT VIEW ── */}
      {!voiceChatMode ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
        >
          {/* Message List */}
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const isBot = item.role === "bot";
              const nav = item.navigation;
              return (
                <View style={{ marginBottom: 12 }}>
                  <ChatBubble
                    message={item.text}
                    role={item.role === "user" ? "user" : "bot"}
                    avatar={avatarBot || "https://i.pinimg.com/736x/80/90/c0/8090c0ecdcf5b7f59781fde477f956ad.jpg"}
                  />
                  {isBot && nav && (
                    <Animated.View entering={FadeInDown.delay(100).duration(300)} style={styles.contextNavContainer}>
                      <TouchableOpacity
                        style={[styles.contextNavBtn, { backgroundColor: "rgba(253,251,247,0.95)", borderColor: colors.indigo }]}
                        onPress={() => executeNavigation(nav)}
                        activeOpacity={0.75}
                      >
                        <Ionicons name="navigate-circle-outline" size={16} color={colors.indigo} />
                        <Text style={[styles.contextNavText, { color: colors.indigo }]}>{getNavLabel(nav)}</Text>
                        <MaterialIcons name="chevron-right" size={14} color={colors.indigo} />
                      </TouchableOpacity>
                    </Animated.View>
                  )}
                </View>
              );
            }}
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 15, paddingBottom: 30 }}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          />

          {/* Chat Input with voice toggle + clear icons inside */}
          <View style={[styles.inputArea, { backgroundColor: "rgba(0,0,0,0.85)", borderTopColor: "#8C5C38" }]}>

            <ChatInput
              onSendText={handleChat}
              onStartRecord={startRecording}
              onStopRecord={stopRecording}
              isRecording={isRecording}
              isLoading={loading}
              isPlayingVoice={isPlayingVoice}
              onStopSpeaking={stopBotSpeaking}
            />
          </View>
        </KeyboardAvoidingView>
      ) : (
        /* ── VOICE CHAT OVERLAY ── */
        <View style={[styles.voiceOverlay, { backgroundColor: isDark ? "rgba(5,4,3,0.97)" : "rgba(250,247,242,0.97)" }]}>
          {/* Close button top-right */}
          <TouchableOpacity onPress={toggleVoiceMode} style={[styles.voiceCloseBtn, { borderColor: colors.border }]} activeOpacity={0.7}>
            <MaterialIcons name="keyboard" size={20} color={colors.textMuted} />
            <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: "600", marginLeft: 4 }}>Chat</Text>
          </TouchableOpacity>

          <Text style={[styles.voiceTitle, { color: colors.indigo }]}>Emma Voice</Text>

          {/* Orb */}
          <View style={styles.voiceCoreContainer}>
            <Animated.View style={[styles.rippleRing, rippleStyle1, { borderColor: colors.indigo }]} />
            <Animated.View style={[styles.rippleRing, rippleStyle2, { borderColor: colors.indigo }]} />

            <TouchableOpacity
              onPress={() => {
                if (voiceChatStatus === "idle") startRecording();
                else if (voiceChatStatus === "recording") stopRecording();
                else if (voiceChatStatus === "speaking") stopBotSpeaking();
              }}
              disabled={voiceChatStatus === "transcribing" || voiceChatStatus === "thinking"}
              activeOpacity={0.85}
            >
              <Animated.View
                style={[
                  styles.mainOrb,
                  orbStyle,
                  {
                    backgroundColor:
                      voiceChatStatus === "recording" ? "#7B1111"
                      : voiceChatStatus === "speaking" ? "#1C1005"
                      : isDark ? "#121824" : "#FEF3C7",
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
                      voiceChatStatus === "recording" ? "stop"
                      : voiceChatStatus === "speaking" ? "volume-off"
                      : "mic"
                    }
                    size={44}
                    color={colors.indigo}
                  />
                )}
              </Animated.View>
            </TouchableOpacity>
          </View>

          <Text style={[styles.voiceStatusText, { color: colors.text }]}>
            {voiceChatStatus === "idle" && "Chạm để nói chuyện với Emma"}
            {voiceChatStatus === "recording" && "🔴 Đang ghi âm... (Chạm để dừng)"}
            {voiceChatStatus === "transcribing" && "✨ Đang nhận diện giọng nói..."}
            {voiceChatStatus === "thinking" && "🤔 Emma đang suy nghĩ..."}
            {voiceChatStatus === "speaking" && "🔊 Emma đang trả lời... (Chạm để dừng)"}
          </Text>

          {messages.length > 0 && (
            <View style={[styles.voiceTranscriptContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.voiceTranscriptLabel, { color: colors.textMuted }]}>Tin nhắn gần nhất</Text>
              <Text style={[styles.voiceTranscriptBody, { color: colors.text }]} numberOfLines={4}>
                {messages[messages.length - 1].text}
              </Text>
            </View>
          )}

          {/* Clear history in voice mode */}
          <TouchableOpacity onPress={() => { setMessages([]); clearTokens(); }} style={[styles.exitVoiceBtn, { borderColor: colors.border }]} activeOpacity={0.7}>
            <MaterialIcons name="delete-sweep" size={16} color={colors.error} />
            <Text style={{ color: colors.error, fontWeight: "600", fontSize: 12, marginLeft: 4 }}>Xoá lịch sử</Text>
          </TouchableOpacity>
        </View>
      )}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Input area with top micro-action row
  inputArea: {
    borderTopWidth: 1.5,
  },
  inputTopRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 2,
  },
  iconPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  iconPillLabel: {
    fontSize: 11,
    fontWeight: "700",
  },

  // Navigation context button (appears below bot messages)
  contextNavContainer: {
    alignSelf: "flex-start",
    marginLeft: 15,
    marginTop: 4,
    marginBottom: 4,
  },
  contextNavBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 6,
  },
  contextNavText: {
    fontSize: 12,
    fontWeight: "700",
  },

  // Voice Overlay
  voiceOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "space-evenly",
    paddingVertical: 30,
    paddingHorizontal: 24,
  },
  voiceCloseBtn: {
    flexDirection: "row",
    alignSelf: "flex-end",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
  },
  voiceTitle: {
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 3,
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
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 1.5,
  },
  mainOrb: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2.5,
    alignItems: "center",
    justifyContent: "center",
    elevation: 10,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
  },
  voiceStatusText: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 22,
  },
  voiceTranscriptContainer: {
    width: "100%",
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  voiceTranscriptLabel: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  voiceTranscriptBody: {
    fontSize: 13,
    lineHeight: 20,
  },
  exitVoiceBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
  },
});
