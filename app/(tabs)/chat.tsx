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
  ScrollView,
  Alert,
} from "react-native";
import { Audio } from "expo-av";
import { Stack, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialIcons, Ionicons, Feather } from "@expo/vector-icons";
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
  const isFocused = useIsFocused();
  const [username, setUsername] = useState("Học viên");
  const [avatarUser, setAvatarUser] = useState("");
  const [avatarBot, setAvatarBot] = useState("");

  useEffect(() => {
    if (isFocused) {
      (async () => {
        const userStr = await AsyncStorage.getItem("user");
        if (userStr) {
          try {
            const userObj = JSON.parse(userStr);
            if (userObj?.username) setUsername(userObj.username);
          } catch (e) {}
        }
        const au = await AsyncStorage.getItem("avatar_user");
        const ab = await AsyncStorage.getItem("avatar_bot");
        if (au) setAvatarUser(au);
        if (ab) setAvatarBot(ab);
      })();
    }
  }, [isFocused]);
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
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const stopAudioRequestRef = useRef(false);

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

      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Quyền truy cập Microphone",
          "Ứng dụng cần quyền sử dụng microphone để ghi âm giọng nói khi trò chuyện với AI. Vui lòng cấp quyền trong cài đặt thiết bị."
        );
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false, // Default to false for main speaker playback
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        playThroughEarpieceAndroid: false,
      });
    })();

    return () => {
      if (currentSoundRef.current) {
        currentSoundRef.current.unloadAsync();
      }
    };
  }, []);

  const stopBotSpeaking = async () => {
    stopAudioRequestRef.current = true;
    setIsPlayingVoice(false);
    if (voiceChatMode) setVoiceChatStatus("idle");
    try {
      if (currentSoundRef.current) {
        await currentSoundRef.current.stopAsync();
        await currentSoundRef.current.unloadAsync();
      }
    } catch (e) {
      console.log("Error stopping bot speaking:", e);
    }
    currentSoundRef.current = null;
  };

  const playAudioSegments = async (audioSegments: string[]) => {
    stopAudioRequestRef.current = false;
    setIsPlayingVoice(true);
    for (const base64Data of audioSegments) {
      if (stopAudioRequestRef.current) break;
      try {
        const { sound } = await Audio.Sound.createAsync(
          { uri: base64Data },
          { shouldPlay: true }
        );
        currentSoundRef.current = sound;
        
        if (stopAudioRequestRef.current) {
          await sound.unloadAsync();
          break;
        }

        await new Promise((resolve) =>
          sound.setOnPlaybackStatusUpdate((status: any) => {
            if (status.didJustFinish || stopAudioRequestRef.current) resolve(true);
          })
        );
        await sound.unloadAsync();
        currentSoundRef.current = null;
      } catch (error) {
        console.error(error);
      }
    }
    setIsPlayingVoice(false);
    if (voiceChatMode) setVoiceChatStatus("idle");
  };

  const startRecording = async () => {
    try {
      setIsRecording(true);
      if (voiceChatMode) setVoiceChatStatus("recording");

      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Quyền truy cập Microphone",
          "Ứng dụng cần quyền sử dụng microphone để ghi âm giọng nói. Vui lòng cấp quyền trong cài đặt thiết bị."
        );
        setIsRecording(false);
        if (voiceChatMode) setVoiceChatStatus("idle");
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        playThroughEarpieceAndroid: false,
      });

      if (recording) {
        try {
          await recording.stopAndUnloadAsync();
        } catch (e) {}
      }

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(newRecording);
    } catch (err) {
      console.error("Lỗi bắt đầu ghi âm:", err);
      setIsRecording(false);
      if (voiceChatMode) setVoiceChatStatus("idle");
      Alert.alert(
        "Lỗi Microphone",
        "Không thể bắt đầu ghi âm. Hãy kiểm tra cài đặt quyền micro trong điện thoại."
      );
    }
  };

  const stopRecording = async () => {
    try {
      setIsRecording(false);
      if (!recording) return;
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        playThroughEarpieceAndroid: false,
      });

      if (uri) sendAudio(uri);
      setRecording(null);
    } catch (err) {
      console.error("Lỗi dừng ghi âm:", err);
      if (voiceChatMode) setVoiceChatStatus("idle");
      Alert.alert("Lỗi Ghi Âm", "Không thể dừng và lưu đoạn ghi âm.");
    }
  };

  const sendAudio = async (uri: string) => {
    setLoading(true);
    if (voiceChatMode) setVoiceChatStatus("transcribing");
    const formData = new FormData();
    
    if (Platform.OS === "web") {
      try {
        const response = await fetch(uri);
        const blob = await response.blob();
        formData.append("audio", blob, "voice.webm");
      } catch (err) {
        console.error("Lỗi chuyển đổi âm thanh trên Web:", err);
        // Fallback
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
          navigation: response.data.navigation, // Lưu lại metadata điều hướng để hiện nút bấm ngữ cảnh
        };
        setMessages((prev) => [...prev, botMsg]);

        if (response.data.usage) {
          const prompt = response.data.usage.prompt_tokens || 0;
          const completion = response.data.usage.completion_tokens || 0;
          addTokens(prompt, completion);
        }

        // --- XỬ LÝ ĐIỀU HƯỚNG TỰ ĐỘNG SAU KHI NÓI XONG ---
        let audioPromise = Promise.resolve();
        if (response.data.audioSegments && response.data.audioSegments.length > 0) {
          if (voiceChatMode) setVoiceChatStatus("speaking");
          audioPromise = playAudioSegments(response.data.audioSegments);
        }

        if (response.data.navigation) {
          const nav = response.data.navigation;
          const executeNavigation = () => {
            const { tab, game, mode, listId, topicTitle } = nav;
            if (tab === "match") {
              if (game === "grammar_match") {
                router.push({ pathname: "/luyen-tap/grammar", params: { topicTitle, mode: "match" } } as any);
              } else if (game === "vocab_match" || game === "match" || game === "memory") {
                router.push({ pathname: "/luyen-tap/vocab-match", params: { topicId: listId } } as any);
              } else if (game === "tower") {
                router.push({ pathname: "/luyen-tap/quiz", params: { topicId: listId } } as any);
              } else if (game === "missing") {
                router.push({ pathname: "/luyen-tap/typing", params: { topicId: listId } } as any);
              } else {
                router.push({ pathname: "/luyen-tap/conjugation", params: { topicId: listId } } as any);
              }
            } else if (tab === "add-grammar") {
              router.push("/study/add-grammar" as any);
            } else if (tab === "grammar-viewer") {
              router.push("/study/grammar-viewer" as any);
            } else if (tab === "add-vocab") {
              router.push("/study/add-vocab" as any);
            } else if (tab === "vocab") {
              router.push("/vocab" as any);
            } else if (tab === "grammar") {
              router.push({ pathname: "/luyen-tap/grammar", params: { topicTitle } } as any);
            } else if (tab === "flashcards" || tab === "study") {
              if (listId) {
                router.push({ pathname: "/study/card-viewer", params: { topicId: listId } } as any);
              } else {
                router.push("/study/flashcard" as any);
              }
            } else if (tab === "quiz") {
              if (mode === "grammar") {
                router.push({ pathname: "/luyen-tap/grammar", params: { topicTitle, mode: "ai_translation" } } as any);
              } else {
                router.push({ pathname: "/luyen-tap/quiz", params: { topicId: listId } } as any);
              }
            } else if (tab === "write") {
              router.push("/study/add-kanji" as any);
            } else if (tab === "overview") {
              router.push("/" as any);
            } else if (tab === "statistics" || tab === "profile" || tab === "achievements") {
              router.push("/profile" as any);
            } else {
              router.push(`/${tab}` as any);
            }
          };

          // Chờ âm thanh chạy xong, sau đó trễ một chút mới chuyển trang
          await audioPromise;
          setTimeout(executeNavigation, response.data.audioSegments?.length > 0 ? 1000 : 2000);
        } else {
          await audioPromise;
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
    stopBotSpeaking();
    setVoiceChatMode(!voiceChatMode);
    setVoiceChatStatus("idle");
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <Header title="Trò chuyện AI" />

      {/* SHIBA AI SENSEI AVATAR HEADER CARD */}
      <View style={[styles.masterCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Image
          source={{ uri: avatarBot || "https://i.pinimg.com/1200x/c0/b4/1c/c0b41c041088fcfb97d76bfd703c47ac.jpg" }}
          style={[styles.masterAvatar, { borderColor: colors.indigo }]}
        />
        <View style={styles.masterInfo}>
          <Text style={[styles.masterName, { color: colors.text }]}>Shiba (AI Sensei)</Text>
          <Text style={[styles.masterTitle, { color: colors.indigo }]}>【 Trợ lý tiếng Nhật 】</Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: "#10B981" }]} />
            <Text style={[styles.statusText, { color: colors.textMuted }]}>Đang hoạt động</Text>
          </View>
        </View>
      </View>

      {/* CONTROL BAR */}
      <View style={[styles.controlBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Text style={[styles.tokenText, { color: colors.textMuted }]}>
          Token tiêu thụ: <Text style={{ fontWeight: "bold", color: colors.indigo }}>{tokensUsed.total}</Text> (Prompt: {tokensUsed.prompt} | Rep: {tokensUsed.completion})
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          {isPlayingVoice && (
            <TouchableOpacity onPress={stopBotSpeaking} style={[styles.stopVoiceBtn, { backgroundColor: isDark ? "#451A1A" : "#FEE2E2" }]} activeOpacity={0.7}>
              <Ionicons name="volume-mute" size={14} color="#EF4444" style={{ marginRight: 4 }} />
              <Text style={{ color: "#EF4444", fontSize: 11, fontWeight: "800" }}>Dừng nói</Text>
            </TouchableOpacity>
          )}
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
              renderItem={({ item }) => {
                const isBot = item.role === "bot";
                const nav = item.navigation;

                const getNavLabel = (navData: any) => {
                  const { tab, game, mode } = navData;
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
                  if (tab === "flashcards" || tab === "study") return "Xem thẻ Flashcard 🎴";
                  if (tab === "quiz") {
                    if (mode === "grammar") return "Luyện dịch Ngữ pháp ✍️";
                    return "Trắc Nghiệm ⚡";
                  }
                  if (tab === "write") return "Tập viết Kanji ✍️";
                  if (tab === "overview") return "Về Trang Chủ 🏠";
                  if (tab === "statistics" || tab === "profile" || tab === "achievements") return "Xem Cá Nhân 👤";
                  return "Đi đến trang ➔";
                };

                const handleNavPress = (navData: any) => {
                  const { tab, game, mode, listId, topicTitle } = navData;
                  if (tab === "match") {
                    if (game === "grammar_match") {
                      router.push({ pathname: "/luyen-tap/grammar", params: { topicTitle, mode: "match" } } as any);
                    } else if (game === "vocab_match" || game === "match" || game === "memory") {
                      router.push({ pathname: "/luyen-tap/vocab-match", params: { topicId: listId } } as any);
                    } else if (game === "tower") {
                      router.push({ pathname: "/luyen-tap/quiz", params: { topicId: listId } } as any);
                    } else if (game === "missing") {
                      router.push({ pathname: "/luyen-tap/typing", params: { topicId: listId } } as any);
                    } else {
                      router.push({ pathname: "/luyen-tap/conjugation", params: { topicId: listId } } as any);
                    }
                  } else if (tab === "add-grammar") {
                    router.push("/study/add-grammar" as any);
                  } else if (tab === "grammar-viewer") {
                    router.push("/study/grammar-viewer" as any);
                  } else if (tab === "add-vocab") {
                    router.push("/study/add-vocab" as any);
                  } else if (tab === "vocab") {
                    router.push("/vocab" as any);
                  } else if (tab === "grammar") {
                    router.push({ pathname: "/luyen-tap/grammar", params: { topicTitle } } as any);
                  } else if (tab === "flashcards" || tab === "study") {
                    if (listId) {
                      router.push({ pathname: "/study/card-viewer", params: { topicId: listId } } as any);
                    } else {
                      router.push("/study/flashcard" as any);
                    }
                  } else if (tab === "quiz") {
                    if (mode === "grammar") {
                      router.push({ pathname: "/luyen-tap/grammar", params: { topicTitle, mode: "ai_translation" } } as any);
                    } else {
                      router.push({ pathname: "/luyen-tap/quiz", params: { topicId: listId } } as any);
                    }
                  } else if (tab === "write") {
                    router.push("/study/add-kanji" as any);
                  } else if (tab === "overview") {
                    router.push("/" as any);
                  } else if (tab === "statistics" || tab === "profile" || tab === "achievements") {
                    router.push("/profile" as any);
                  } else {
                    router.push(`/${tab}` as any);
                  }
                };

                return (
                  <View style={{ marginBottom: 12 }}>
                    <ChatBubble message={item.text} role={item.role === "user" ? "user" : "bot"} />
                    {isBot && nav && (
                      <Animated.View entering={FadeInDown.delay(100).duration(300)} style={styles.contextNavContainer}>
                        <TouchableOpacity
                          style={[styles.contextNavBtn, { backgroundColor: colors.indigoLight, borderColor: colors.indigo }]}
                          onPress={() => handleNavPress(nav)}
                          activeOpacity={0.75}
                        >
                          <Ionicons name="navigate-circle-outline" size={16} color={colors.indigo} />
                          <Text style={[styles.contextNavText, { color: colors.indigo }]}>
                            {getNavLabel(nav)}
                          </Text>
                          <MaterialIcons name="chevron-right" size={14} color={colors.indigo} />
                        </TouchableOpacity>
                      </Animated.View>
                    )}
                  </View>
                );
              }}
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
                } else if (voiceChatStatus === "speaking") {
                  stopBotSpeaking();
                }
              }}
              disabled={voiceChatStatus !== "idle" && voiceChatStatus !== "recording" && voiceChatStatus !== "speaking"}
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
            <Text style={{ color: colors.textMuted, fontWeight: "600", fontSize: 13 }}>Quay lại giao diện chat</Text>
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
  stopVoiceBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#EF4444",
  },
});
