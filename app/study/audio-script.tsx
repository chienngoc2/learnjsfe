import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  StatusBar,
  Share,
  LayoutChangeEvent,
  Modal,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { Audio } from "expo-av";
import * as Speech from "expo-speech";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/src/context/ThemeContext";
import { transcribeMp3File } from "../../services/aiService";

const SAVED_LESSONS_STORAGE_KEY = "@ai_sensei_saved_audio_lessons_v1";

interface Segment {
  id: number;
  start: number;
  end: number;
  startFormatted: string;
  endFormatted: string;
  text: string;
  pinyin?: string;
  meaningVi?: string;
}

interface ScriptResult {
  fileName: string;
  fileSize: number;
  duration: number;
  fullText: string;
  fullTranslation?: string;
  segments: Segment[];
  totalSegments: number;
  language: string;
}

interface SavedAudioLesson {
  id: string;
  title: string;
  savedAt: string;
  duration: number;
  fileUri: string;
  fullText: string;
  fullTranslation?: string;
  segments: Segment[];
  totalSegments: number;
}

export default function AudioScriptScreen() {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);
  const segmentPositions = useRef<{ [key: number]: number }>({});

  // File state
  const [selectedFile, setSelectedFile] = useState<{
    uri: string;
    name: string;
    size?: number;
    mimeType?: string;
    file?: any;
  } | null>(null);

  // Drag & drop state for Web
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Audio player state
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(0);
  const [trackWidth, setTrackWidth] = useState(0);

  // Transcribe state
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScriptResult | null>(null);
  const [activeTab, setActiveTab] = useState<"segments" | "fullText">("segments");
  const [showPinyin, setShowPinyin] = useState(true);
  const [showMeaning, setShowMeaning] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const [copiedNotice, setCopiedNotice] = useState(false);

  // Phát từng câu & lặp lại
  const [activePlayingSegmentId, setActivePlayingSegmentId] = useState<number | null>(null);
  const [loopingSegmentId, setLoopingSegmentId] = useState<number | null>(null);
  const lastActiveIdRef = useRef<number | null>(null);
  const segmentTimerRef = useRef<any>(null);

  // Thư viện bài nghe đã lưu
  const [savedLessons, setSavedLessons] = useState<SavedAudioLesson[]>([]);
  const [showLibraryModal, setShowLibraryModal] = useState(false);

  // Load danh sách bài nghe đã lưu khi mở trang
  useEffect(() => {
    loadSavedLessons();
  }, []);

  const loadSavedLessons = async () => {
    try {
      const raw = await AsyncStorage.getItem(SAVED_LESSONS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setSavedLessons(parsed);
        }
      }
    } catch (err) {
      console.warn("Lỗi đọc bài nghe đã lưu:", err);
    }
  };

  // Cleanup sound khi unmount
  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync().catch(() => {});
      }
      if (segmentTimerRef.current) {
        clearTimeout(segmentTimerRef.current);
      }
      Speech.stop();
    };
  }, [sound]);

  // Phát riêng câu này từ file âm thanh gốc (từ start đến end)
  const playSegmentOnly = async (item: Segment) => {
    if (!sound) return;

    if (segmentTimerRef.current) {
      clearTimeout(segmentTimerRef.current);
    }

    if (activePlayingSegmentId === item.id && isPlaying) {
      await sound.pauseAsync();
      setIsPlaying(false);
      setActivePlayingSegmentId(null);
      return;
    }

    try {
      Speech.stop();
      setActivePlayingSegmentId(item.id);
      await sound.setPositionAsync(Math.max(0, item.start * 1000));
      await sound.playAsync();
      setIsPlaying(true);

      const durationMs = Math.max(600, (item.end - item.start) * 1000);
      segmentTimerRef.current = setTimeout(async () => {
        try {
          if (loopingSegmentId === item.id) {
            playSegmentOnly(item);
          } else {
            await sound.pauseAsync();
            setIsPlaying(false);
            setActivePlayingSegmentId(null);
          }
        } catch (e) {}
      }, durationMs);
    } catch (err: any) {
      console.warn("Lỗi phát từng câu:", err);
    }
  };

  // Đọc câu bằng giọng AI chuẩn tiếng Trung (TTS)
  const speakSentence = (text: string) => {
    try {
      if (sound && isPlaying) {
        sound.pauseAsync();
        setIsPlaying(false);
        setActivePlayingSegmentId(null);
      }
      Speech.stop();
      Speech.speak(text, {
        language: "zh-TW",
        rate: 0.85,
        pitch: 1.0,
      });
    } catch (e) {
      console.warn("TTS error:", e);
    }
  };

  // Thiết lập audio file và khởi tạo trình phát
  const setupAudio = async (uri: string, name: string, size?: number, mimeType?: string, fileObj?: any) => {
    try {
      if (sound) {
        await sound.unloadAsync();
        setSound(null);
        setIsPlaying(false);
        setPlaybackPosition(0);
      }

      setSelectedFile({
        uri,
        name,
        size,
        mimeType: mimeType || "audio/mpeg",
        file: fileObj || null,
      });

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });

      const { sound: newSound, status } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: false, progressUpdateIntervalMillis: 80 },
        onPlaybackStatusUpdate
      );

      setSound(newSound);
      if (status.isLoaded && status.durationMillis) {
        setPlaybackDuration(status.durationMillis / 1000);
      }
    } catch (err: any) {
      console.warn("Lỗi khởi tạo audio:", err);
    }
  };

  // Chọn file âm thanh qua DocumentPicker
  const handlePickDocument = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ["audio/*"],
        copyToCacheDirectory: true,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        const asset = res.assets[0];
        setResult(null);
        await setupAudio(
          asset.uri,
          asset.name,
          asset.size,
          asset.mimeType || "audio/mpeg",
          (asset as any).file || null
        );
      }
    } catch (err: any) {
      Alert.alert("Lỗi", "Không thể chọn file âm thanh: " + (err.message || ""));
    }
  };

  // Xử lý kéo thả file MP3 (Web HTML5 Drag & Drop)
  const handleDragOver = (e: any) => {
    if (e.preventDefault) e.preventDefault();
    if (e.stopPropagation) e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: any) => {
    if (e.preventDefault) e.preventDefault();
    if (e.stopPropagation) e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = async (e: any) => {
    if (e.preventDefault) e.preventDefault();
    if (e.stopPropagation) e.stopPropagation();
    setIsDraggingOver(false);

    try {
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        const file = files[0];
        const isAudio =
          file.type.startsWith("audio/") ||
          /\.(mp3|m4a|wav|aac|ogg|flac|webm)$/i.test(file.name);

        if (!isAudio) {
          Alert.alert("Định dạng không hỗ trợ", "Vui lòng chỉ thả file âm thanh (MP3, M4A, WAV, AAC, v.v.).");
          return;
        }

        setResult(null);
        const objectUrl = URL.createObjectURL(file);
        await setupAudio(objectUrl, file.name, file.size, file.type || "audio/mpeg", file);
      }
    } catch (err: any) {
      console.error("Lỗi thả file:", err);
    }
  };

  // Cập nhật trạng thái phát âm thanh & Tự động cuộn theo câu đang nói
  const onPlaybackStatusUpdate = (status: any) => {
    if (status.isLoaded) {
      const currentPos = status.positionMillis / 1000;
      setPlaybackPosition(currentPos);
      if (status.durationMillis) {
        setPlaybackDuration(status.durationMillis / 1000);
      }
      setIsPlaying(status.isPlaying);

      if (status.didJustFinish) {
        setIsPlaying(false);
        setPlaybackPosition(0);
      }

      if (status.isPlaying && result?.segments && autoScroll) {
        const activeSeg = result.segments.find(
          (seg) => currentPos >= seg.start && currentPos <= seg.end
        );

        if (activeSeg && activeSeg.id !== lastActiveIdRef.current) {
          lastActiveIdRef.current = activeSeg.id;
          const targetY = segmentPositions.current[activeSeg.id];
          if (typeof targetY === "number" && scrollViewRef.current) {
            scrollViewRef.current.scrollTo({ y: Math.max(0, targetY - 120), animated: true });
          }
        }
      }
    }
  };

  const togglePlayPause = async () => {
    if (!sound) return;
    try {
      if (isPlaying) {
        await sound.pauseAsync();
      } else {
        await sound.playAsync();
      }
    } catch (e) {
      console.warn("Lỗi phát audio:", e);
    }
  };

  // Tua đoạn âm thanh đến giây cụ thể
  const seekToTime = async (seconds: number) => {
    if (!sound) return;
    try {
      const clampedSeconds = Math.max(0, Math.min(seconds, playbackDuration));
      await sound.setPositionAsync(clampedSeconds * 1000);
      setPlaybackPosition(clampedSeconds);
      if (!isPlaying) {
        await sound.playAsync();
        setIsPlaying(true);
      }
    } catch (e) {
      console.warn("Lỗi seek audio:", e);
    }
  };

  // Tua qua lại nhanh +/- 5 giây
  const skipTime = async (deltaSeconds: number) => {
    if (!sound) return;
    seekToTime(playbackPosition + deltaSeconds);
  };

  // Xử lý click/tua trên thanh timeline bằng chuột
  const handleTimelinePress = (e: any) => {
    if (!playbackDuration || trackWidth <= 0) return;
    const locationX = e.nativeEvent?.locationX ?? 0;
    const ratio = Math.max(0, Math.min(1, locationX / trackWidth));
    const targetSeconds = ratio * playbackDuration;
    seekToTime(targetSeconds);
  };

  // Thực hiện bóc Script qua Backend (0 token, 0 Groq)
  const handleStartTranscribe = async () => {
    if (!selectedFile) {
      Alert.alert("Thông báo", "Vui lòng chọn hoặc kéo thả file MP3 trước khi thực hiện.");
      return;
    }

    try {
      setLoading(true);
      const res = await transcribeMp3File({
        uri: selectedFile.uri,
        name: selectedFile.name,
        type: selectedFile.mimeType || "audio/mpeg",
        language: "chinese",
        file: selectedFile.file,
      });

      if (res && res.success && res.data) {
        setResult(res.data);
      } else {
        Alert.alert("Lỗi", res?.error || "Không thể bóc script từ file âm thanh.");
      }
    } catch (err: any) {
      const errMsg = err?.response?.data?.error || err.message || "Lỗi mạng hoặc server không phản hồi.";
      Alert.alert("Thất bại", errMsg);
    } finally {
      setLoading(false);
    }
  };

  // 💾 LƯU LẠI BÀI NGHE VÀO THƯ VIỆN ĐỂ NGHE LẠI SAU NÀY
  const handleSaveLesson = async () => {
    if (!result || !selectedFile) {
      Alert.alert("Thông báo", "Chưa có nội dung script để lưu.");
      return;
    }

    try {
      const lessonTitle = selectedFile.name.replace(/\.[^/.]+$/, "") || "Bài nghe tiếng Trung";
      const now = new Date();
      const formattedDate = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()} ${now.getHours()}:${now.getMinutes() < 10 ? "0" + now.getMinutes() : now.getMinutes()}`;

      const newLesson: SavedAudioLesson = {
        id: `audio_lesson_${Date.now()}`,
        title: lessonTitle,
        savedAt: formattedDate,
        duration: result.duration,
        fileUri: selectedFile.uri,
        fullText: result.fullText,
        fullTranslation: result.fullTranslation,
        segments: result.segments,
        totalSegments: result.totalSegments,
      };

      const updated = [newLesson, ...savedLessons.filter((l) => l.title !== lessonTitle)];
      await AsyncStorage.setItem(SAVED_LESSONS_STORAGE_KEY, JSON.stringify(updated));
      setSavedLessons(updated);

      Alert.alert(
        "Đã lưu thành công! 🎉",
        `Bài nghe "${lessonTitle}" đã được lưu vào Thư viện. Bạn có thể mở lại nghe bất kỳ lúc nào!`
      );
    } catch (err: any) {
      Alert.alert("Lỗi", "Không thể lưu bài nghe: " + (err.message || ""));
    }
  };

  // 🗑️ XÓA ĐOẠN ÂM THANH / BÀI NGHE KHÔNG CẦN THIẾT
  const handleDeleteLesson = (id: string, title: string) => {
    Alert.alert(
      "Xác nhận xóa bài nghe",
      `Bạn có chắc chắn muốn xóa bài nghe "${title}" khỏi thư viện không?`,
      [
        { text: "Hủy bỏ", style: "cancel" },
        {
          text: "Xóa vĩnh viễn",
          style: "destructive",
          onPress: async () => {
            try {
              const updated = savedLessons.filter((l) => l.id !== id);
              await AsyncStorage.setItem(SAVED_LESSONS_STORAGE_KEY, JSON.stringify(updated));
              setSavedLessons(updated);
            } catch (e) {
              console.warn("Lỗi xóa bài nghe:", e);
            }
          },
        },
      ]
    );
  };

  // ✂️ XÓA ĐOẠN / CÂU ÂM THANH KHÔNG CẦN KHỎI SCRIPT
  const handleDeleteSegment = (segmentId: number) => {
    if (!result) return;
    const filtered = result.segments.filter((s) => s.id !== segmentId);
    setResult({
      ...result,
      segments: filtered,
      totalSegments: filtered.length,
    });
  };

  // 🎧 MỞ LẠI BÀI NGHE ĐÃ LƯU
  const handleOpenLesson = async (lesson: SavedAudioLesson) => {
    setShowLibraryModal(false);
    setResult({
      fileName: lesson.title,
      fileSize: 0,
      duration: lesson.duration,
      fullText: lesson.fullText,
      fullTranslation: lesson.fullTranslation,
      segments: lesson.segments,
      totalSegments: lesson.totalSegments,
      language: "chinese",
    });

    await setupAudio(lesson.fileUri, lesson.title);
    setActiveTab("segments");
  };

  const handleShareOrCopy = async (text: string) => {
    try {
      await Share.share({
        message: text,
        title: "Script bài nghe tiếng Trung",
      });
      setCopiedNotice(true);
      setTimeout(() => setCopiedNotice(false), 2500);
    } catch (e) {}
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "0 MB";
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  const formatDisplayTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m < 10 ? "0" + m : m}:${s < 10 ? "0" + s : s}`;
  };

  const onSegmentLayout = (id: number, event: LayoutChangeEvent) => {
    segmentPositions.current[id] = event.nativeEvent.layout.y;
  };

  const isCurrentLessonSaved =
    result &&
    selectedFile &&
    savedLessons.some((l) => l.title === selectedFile.name.replace(/\.[^/.]+$/, ""));

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* ─── HEADER ─── */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
            paddingTop: insets.top > 0 ? insets.top + 8 : (Platform.OS === "android" ? 44 : 20),
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backBtn, { borderColor: colors.border }]}
          activeOpacity={0.7}
        >
          <MaterialIcons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Bóc Script MP3</Text>
          <View style={styles.freeBadge}>
            <View style={styles.greenDot} />
            <Text style={styles.freeBadgeText}>Karaoke chữ xanh lá · Song ngữ Trung - Việt</Text>
          </View>
        </View>

        {/* Nút mở thư viện bài nghe đã lưu */}
        <TouchableOpacity
          onPress={() => setShowLibraryModal(true)}
          style={[styles.libraryBtn, { borderColor: colors.border }]}
          activeOpacity={0.7}
        >
          <MaterialIcons name="folder-special" size={20} color={colors.amber || "#CFAC62"} />
          {savedLessons.length > 0 && (
            <View style={styles.libraryBadge}>
              <Text style={styles.libraryBadgeText}>{savedLessons.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 130 }}
      >
        {/* ─── 1/ VÙNG KÉO THẢ FILE MP3 (DRAG & DROP ZONE) ─── */}
        <Animated.View entering={FadeInDown.duration(400)}>
          {!selectedFile ? (
            <View
              {...({
                onDragOver: handleDragOver,
                onDragEnter: handleDragOver,
                onDragLeave: handleDragLeave,
                onDrop: handleDrop,
              } as any)}
              style={[
                styles.uploadCard,
                {
                  backgroundColor: isDraggingOver
                    ? (isDark ? "rgba(16, 185, 129, 0.15)" : "#ECFDF5")
                    : colors.surface,
                  borderColor: isDraggingOver
                    ? "#10B981"
                    : (isDark ? "rgba(207, 172, 98, 0.4)" : "rgba(139, 105, 20, 0.3)"),
                },
              ]}
            >
              <TouchableOpacity
                onPress={handlePickDocument}
                activeOpacity={0.8}
                style={{ alignItems: "center", width: "100%" }}
              >
                <View
                  style={[
                    styles.uploadIconWrap,
                    {
                      backgroundColor: isDraggingOver
                        ? "#10B981"
                        : (isDark ? "#1C1408" : "#FEF3C7"),
                    },
                  ]}
                >
                  <MaterialIcons
                    name={isDraggingOver ? "file-download" : "audiotrack"}
                    size={38}
                    color={isDraggingOver ? "#FFFFFF" : (colors.amber || "#CFAC62")}
                  />
                </View>

                <Text style={[styles.uploadTitle, { color: isDraggingOver ? "#10B981" : colors.text }]}>
                  {isDraggingOver ? "Thả file MP3 vào đây ngay!" : "Kéo thả hoặc Chọn file MP3"}
                </Text>

                <Text style={[styles.uploadSub, { color: colors.textMuted }]}>
                  {Platform.OS === "web"
                    ? "Kéo thả file MP3/M4A từ máy tính vào vùng này, hoặc bấm để chọn tệp"
                    : "Chạm để chọn file MP3, M4A, WAV từ thiết bị (Tối đa 50MB)"}
                </Text>

                <View style={[styles.uploadActionBtn, { backgroundColor: colors.indigo || "#4F46E5" }]}>
                  <MaterialIcons name="file-upload" size={18} color="#FFFFFF" />
                  <Text style={styles.uploadActionBtnText}>Chọn từ thiết bị</Text>
                </View>

                {savedLessons.length > 0 && (
                  <TouchableOpacity
                    onPress={() => setShowLibraryModal(true)}
                    style={styles.openLibraryQuickBtn}
                    activeOpacity={0.7}
                  >
                    <MaterialIcons name="history" size={16} color={colors.amber || "#CFAC62"} />
                    <Text style={[styles.openLibraryQuickText, { color: colors.amber || "#CFAC62" }]}>
                      Xem {savedLessons.length} bài nghe đã lưu trong thư viện
                    </Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View
              style={[
                styles.fileSelectedCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View style={styles.fileInfoRow}>
                <View style={[styles.fileIconSmall, { backgroundColor: isDark ? "#1C1408" : "#FEF3C7" }]}>
                  <MaterialIcons name="audio-file" size={26} color={colors.amber || "#CFAC62"} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.fileName, { color: colors.text }]} numberOfLines={1}>
                    {selectedFile.name}
                  </Text>
                  <Text style={[styles.fileMeta, { color: colors.textMuted }]}>
                    {formatFileSize(selectedFile.size)} · Tiếng Trung Phồn Thể
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={handlePickDocument}
                  style={[styles.changeFileBtn, { borderColor: colors.border }]}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="swap-horiz" size={18} color={colors.indigo} />
                  <Text style={[styles.changeFileText, { color: colors.indigo }]}>Đổi file</Text>
                </TouchableOpacity>
              </View>

              {/* ─── 2/ TRÌNH PHÁT VÀ THANH TUA ÂM THANH BẰNG CHUỘT (SEEKABLE SCRUBBER) ─── */}
              <View style={[styles.playerContainer, { backgroundColor: isDark ? "#120E08" : "#F8F6F0" }]}>
                {/* Nút lùi 5s */}
                <TouchableOpacity
                  onPress={() => skipTime(-5)}
                  style={[styles.skipBtn, { borderColor: colors.border }]}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="replay-5" size={20} color={colors.text} />
                </TouchableOpacity>

                {/* Nút Play/Pause chính */}
                <TouchableOpacity
                  onPress={togglePlayPause}
                  style={[styles.playPauseBtn, { backgroundColor: colors.indigo || "#4F46E5" }]}
                  activeOpacity={0.8}
                >
                  <MaterialIcons
                    name={isPlaying ? "pause" : "play-arrow"}
                    size={24}
                    color="#FFFFFF"
                  />
                </TouchableOpacity>

                {/* Nút tiến 5s */}
                <TouchableOpacity
                  onPress={() => skipTime(5)}
                  style={[styles.skipBtn, { borderColor: colors.border }]}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="forward-5" size={20} color={colors.text} />
                </TouchableOpacity>

                {/* Thanh tua âm thanh tương tác bằng chuột/chạm */}
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <View style={styles.timeRow}>
                    <Text style={[styles.timeText, { color: "#10B981", fontWeight: "700" }]}>
                      {formatDisplayTime(playbackPosition)}
                    </Text>
                    <Text style={[styles.timeText, { color: colors.textMuted }]}>
                      {formatDisplayTime(playbackDuration)}
                    </Text>
                  </View>

                  {/* Vùng bấm tua chuột */}
                  <TouchableOpacity
                    activeOpacity={1}
                    onPress={handleTimelinePress}
                    onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
                    style={styles.timelineHitArea}
                  >
                    <View style={styles.progressBg}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            backgroundColor: "#10B981",
                            width: `${playbackDuration > 0 ? Math.min(100, (playbackPosition / playbackDuration) * 100) : 0}%`,
                          },
                        ]}
                      />
                      {/* Scrubber Thumb (nút tròn báo vị trí hiện tại) */}
                      <View
                        style={[
                          styles.scrubberThumb,
                          {
                            left: `${playbackDuration > 0 ? Math.min(98, (playbackPosition / playbackDuration) * 100) : 0}%`,
                          },
                        ]}
                      />
                    </View>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Action Button: Bóc script */}
              {!result && (
                <TouchableOpacity
                  onPress={handleStartTranscribe}
                  disabled={loading}
                  activeOpacity={0.8}
                  style={[
                    styles.transcribeBtn,
                    {
                      backgroundColor: loading
                        ? colors.border
                        : (colors.indigo || "#4F46E5"),
                    },
                  ]}
                >
                  {loading ? (
                    <View style={styles.loadingRow}>
                      <ActivityIndicator size="small" color="#FFFFFF" />
                      <Text style={styles.transcribeBtnText}>
                        Đang trích xuất tiếng Trung & dịch tiếng Việt...
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.loadingRow}>
                      <MaterialIcons name="transcribe" size={20} color="#FFFFFF" />
                      <Text style={styles.transcribeBtnText}>Bắt đầu bóc Script & Dịch song ngữ</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
            </View>
          )}
        </Animated.View>

        {/* ─── LOADING STATE ─── */}
        {loading && (
          <Animated.View entering={FadeInDown.duration(400)} style={{ marginTop: 16 }}>
            <View
              style={[
                styles.processingCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <ActivityIndicator size="large" color="#10B981" />
              <Text style={[styles.processingTitle, { color: colors.text }]}>
                Đang nhận dạng tiếng Trung & sinh bản dịch tiếng Việt
              </Text>
              <Text style={[styles.processingDesc, { color: colors.textMuted }]}>
                Hệ thống đang gắn mốc thời gian (timestamp) cho từng câu và dịch nghĩa tương ứng theo thời gian thực...
              </Text>
            </View>
          </Animated.View>
        )}

        {/* ─── KẾT QUẢ SCRIPT SONG NGỮ & KARAOKE HIGHLIGHT ─── */}
        {result && (
          <Animated.View entering={FadeInDown.duration(500)} style={{ marginTop: 20 }}>
            {/* Stats Bar */}
            <View
              style={[
                styles.resultStatsBar,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View style={styles.statCol}>
                <Text style={[styles.statVal, { color: "#10B981" }]}>
                  {formatDisplayTime(result.duration)}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Thời lượng</Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
              <View style={styles.statCol}>
                <Text style={[styles.statVal, { color: colors.text }]}>
                  {result.totalSegments}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Số câu</Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
              <View style={styles.statCol}>
                <Text style={[styles.statVal, { color: colors.amber || "#CFAC62" }]}>
                  Song ngữ
                </Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Trung - Việt</Text>
              </View>
            </View>

            {/* Điều khiển hiển thị & Tự động cuộn */}
            <View style={styles.controlsRow}>
              <TouchableOpacity
                onPress={() => setShowPinyin(!showPinyin)}
                style={[
                  styles.filterPill,
                  showPinyin && { backgroundColor: isDark ? "#1C1408" : "#FEF3C7", borderColor: colors.amber },
                ]}
                activeOpacity={0.7}
              >
                <MaterialIcons
                  name={showPinyin ? "visibility" : "visibility-off"}
                  size={15}
                  color={showPinyin ? (colors.amber || "#CFAC62") : colors.textMuted}
                />
                <Text
                  style={[
                    styles.filterPillText,
                    { color: showPinyin ? (colors.amber || "#CFAC62") : colors.textMuted },
                  ]}
                >
                  Pinyin
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setShowMeaning(!showMeaning)}
                style={[
                  styles.filterPill,
                  showMeaning && { backgroundColor: isDark ? "rgba(16, 185, 129, 0.15)" : "#ECFDF5", borderColor: "#10B981" },
                ]}
                activeOpacity={0.7}
              >
                <MaterialIcons
                  name={showMeaning ? "translate" : "language"}
                  size={15}
                  color={showMeaning ? "#10B981" : colors.textMuted}
                />
                <Text
                  style={[
                    styles.filterPillText,
                    { color: showMeaning ? "#10B981" : colors.textMuted },
                  ]}
                >
                  Dịch tiếng Việt
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setAutoScroll(!autoScroll)}
                style={[
                  styles.filterPill,
                  autoScroll && { backgroundColor: isDark ? "#12142A" : "#EEF2FF", borderColor: colors.indigo },
                ]}
                activeOpacity={0.7}
              >
                <MaterialIcons
                  name={autoScroll ? "sync" : "sync-disabled"}
                  size={15}
                  color={autoScroll ? (colors.indigo || "#4F46E5") : colors.textMuted}
                />
                <Text
                  style={[
                    styles.filterPillText,
                    { color: autoScroll ? (colors.indigo || "#4F46E5") : colors.textMuted },
                  ]}
                >
                  Cuộn theo câu
                </Text>
              </TouchableOpacity>
            </View>

            {/* Segment / Fulltext Toggle */}
            <View style={styles.tabToggleRow}>
              <TouchableOpacity
                onPress={() => setActiveTab("segments")}
                style={[
                  styles.tabToggleBtn,
                  activeTab === "segments" && [
                    styles.tabToggleActive,
                    { backgroundColor: colors.surface, borderColor: "#10B981" },
                  ],
                ]}
                activeOpacity={0.8}
              >
                <MaterialIcons
                  name="subtitles"
                  size={18}
                  color={activeTab === "segments" ? "#10B981" : colors.textMuted}
                />
                <Text
                  style={[
                    styles.tabToggleText,
                    {
                      color: activeTab === "segments" ? "#10B981" : colors.textMuted,
                      fontWeight: activeTab === "segments" ? "700" : "500",
                    },
                  ]}
                >
                  Karaoke từng câu ({result.segments.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setActiveTab("fullText")}
                style={[
                  styles.tabToggleBtn,
                  activeTab === "fullText" && [
                    styles.tabToggleActive,
                    { backgroundColor: colors.surface, borderColor: "#10B981" },
                  ],
                ]}
                activeOpacity={0.8}
              >
                <MaterialIcons
                  name="menu-book"
                  size={18}
                  color={activeTab === "fullText" ? "#10B981" : colors.textMuted}
                />
                <Text
                  style={[
                    styles.tabToggleText,
                    {
                      color: activeTab === "fullText" ? "#10B981" : colors.textMuted,
                      fontWeight: activeTab === "fullText" ? "700" : "500",
                    },
                  ]}
                >
                  Toàn bộ văn bản
                </Text>
              </TouchableOpacity>
            </View>

            {/* ─── DANH SÁCH TỪNG CÂU + DỊCH TIẾNG VIỆT + Ô XANH LÁ CHỈ RÕ TỪNG CHỮ ─── */}
            {activeTab === "segments" && (
              <View style={{ marginTop: 12 }}>
                {result.segments.map((item, idx) => {
                  const isCurrent =
                    playbackPosition >= item.start &&
                    playbackPosition < item.end &&
                    (isPlaying || playbackPosition > 0);

                  const isCurrentSegmentPlaying = activePlayingSegmentId === item.id && isPlaying;

                  // Tính toán vị trí ký tự đang được đọc trong câu
                  const chars = Array.from(item.text);
                  const segDuration = Math.max(0.1, item.end - item.start);
                  const elapsed = Math.max(0, playbackPosition - item.start);
                  const progressRatio = Math.min(1, Math.max(0, elapsed / segDuration));
                  const activeCharIndex = Math.min(chars.length - 1, Math.floor(progressRatio * chars.length));
                  const activeChar = isCurrent ? chars[activeCharIndex] : "";

                  return (
                    <TouchableOpacity
                      key={item.id ?? idx}
                      activeOpacity={0.85}
                      onLayout={(e) => onSegmentLayout(item.id ?? idx, e)}
                      onPress={() => seekToTime(item.start)}
                      style={[
                        styles.segmentCard,
                        {
                          backgroundColor: isCurrent
                            ? (isDark ? "rgba(16, 185, 129, 0.16)" : "#F0FDF4")
                            : colors.surface,
                          borderColor: isCurrent
                            ? "#10B981"
                            : colors.border,
                          borderWidth: isCurrent ? 2 : 1,
                        },
                      ]}
                    >
                      <View style={styles.segmentTopRow}>
                        <View style={styles.segmentActionsLeft}>
                          {/* Timestamp badge */}
                          <View
                            style={[
                              styles.timestampBadge,
                              {
                                backgroundColor: isCurrent
                                  ? "#10B981"
                                  : (isDark ? "#1C1408" : "#FEF3C7"),
                              },
                            ]}
                          >
                            <MaterialIcons
                              name={isCurrent ? "volume-up" : "access-time"}
                              size={12}
                              color={isCurrent ? "#FFFFFF" : (colors.amber || "#CFAC62")}
                            />
                            <Text
                              style={[
                                styles.timestampText,
                                { color: isCurrent ? "#FFFFFF" : (colors.amber || "#CFAC62") },
                              ]}
                            >
                              {item.startFormatted} - {item.endFormatted}
                            </Text>
                          </View>

                          {/* 🔊 NÚT PHÁT NGHE CÂU NÀY TỪ AUDIO GỐC */}
                          <TouchableOpacity
                            onPress={(e) => {
                              if (e.stopPropagation) e.stopPropagation();
                              playSegmentOnly(item);
                            }}
                            style={[
                              styles.actionPillBtn,
                              {
                                backgroundColor: isCurrentSegmentPlaying
                                  ? "#10B981"
                                  : (isDark ? "rgba(16, 185, 129, 0.15)" : "#ECFDF5"),
                                borderColor: isCurrentSegmentPlaying
                                  ? "#10B981"
                                  : "rgba(16, 185, 129, 0.4)",
                              },
                            ]}
                            activeOpacity={0.7}
                          >
                            <MaterialIcons
                              name={isCurrentSegmentPlaying ? "pause" : "play-arrow"}
                              size={14}
                              color={isCurrentSegmentPlaying ? "#FFFFFF" : "#10B981"}
                            />
                            <Text
                              style={[
                                styles.actionPillText,
                                { color: isCurrentSegmentPlaying ? "#FFFFFF" : "#10B981" },
                              ]}
                            >
                              {isCurrentSegmentPlaying ? "Đang phát" : "Nghe câu"}
                            </Text>
                          </TouchableOpacity>

                          {/* 🗣️ NÚT ĐỌC BẰNG GIỌNG AI (TTS) */}
                          <TouchableOpacity
                            onPress={(e) => {
                              if (e.stopPropagation) e.stopPropagation();
                              speakSentence(item.text);
                            }}
                            style={[
                              styles.actionPillBtn,
                              {
                                backgroundColor: isDark ? "rgba(79, 70, 229, 0.15)" : "#EEF2FF",
                                borderColor: "rgba(79, 70, 229, 0.35)",
                              },
                            ]}
                            activeOpacity={0.7}
                          >
                            <MaterialIcons
                              name="record-voice-over"
                              size={13}
                              color={colors.indigo || "#4F46E5"}
                            />
                            <Text
                              style={[
                                styles.actionPillText,
                                { color: colors.indigo || "#4F46E5" },
                              ]}
                            >
                              Đọc AI
                            </Text>
                          </TouchableOpacity>

                          {/* 🔁 NÚT LẶP CÂU NÀY */}
                          <TouchableOpacity
                            onPress={(e) => {
                              if (e.stopPropagation) e.stopPropagation();
                              if (loopingSegmentId === item.id) {
                                setLoopingSegmentId(null);
                              } else {
                                setLoopingSegmentId(item.id);
                                playSegmentOnly(item);
                              }
                            }}
                            style={[
                              styles.actionIconBtn,
                              {
                                backgroundColor: loopingSegmentId === item.id
                                  ? "rgba(16, 185, 129, 0.25)"
                                  : "transparent",
                                borderColor: loopingSegmentId === item.id ? "#10B981" : colors.border,
                              },
                            ]}
                            activeOpacity={0.7}
                          >
                            <MaterialIcons
                              name="repeat"
                              size={14}
                              color={loopingSegmentId === item.id ? "#10B981" : colors.textMuted}
                            />
                          </TouchableOpacity>
                        </View>

                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <TouchableOpacity
                            onPress={() => handleShareOrCopy(`${item.text}\n${item.pinyin || ""}\n${item.meaningVi || ""}`)}
                            style={styles.copySingleBtn}
                            activeOpacity={0.6}
                          >
                            <MaterialIcons name="content-copy" size={16} color={colors.textMuted} />
                          </TouchableOpacity>

                          <TouchableOpacity
                            onPress={(e) => {
                              if (e.stopPropagation) e.stopPropagation();
                              handleDeleteSegment(item.id);
                            }}
                            style={styles.deleteSingleSegmentBtn}
                            activeOpacity={0.6}
                          >
                            <MaterialIcons name="close" size={16} color={colors.textMuted} />
                          </TouchableOpacity>
                        </View>
                      </View>

                      {/* 🟢 Ô XANH LÁ HIỆN ĐANG NÓI Ở CHỮ NÀO (LIVE CALLOUT) */}
                      {isCurrent && !!activeChar && (
                        <View style={styles.activeCharCallout}>
                          <View style={styles.pulsingDot} />
                          <Text style={styles.activeCharCalloutLabel}>Đang nói chữ:</Text>
                          <View style={styles.activeCharBadge}>
                            <Text style={styles.activeCharBadgeText}>{activeChar}</Text>
                          </View>
                        </View>
                      )}

                      {/* 🟢 CHỮ TIẾNG TRUNG: TỪNG CHỮ CÓ Ô XANH LÁ DI CHUYỂN THEO THỜI GIAN THỰC */}
                      <View style={styles.karaokeTextWrap}>
                        {chars.map((char, charIdx) => {
                          const isThisChar = isCurrent && charIdx === activeCharIndex;
                          const isSpoken = isCurrent && charIdx < activeCharIndex;

                          return (
                            <View
                              key={charIdx}
                              style={[
                                styles.charBox,
                                isThisChar && styles.activeCharBoxHighlight,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.segmentCharText,
                                  {
                                    color: isThisChar
                                      ? "#FFFFFF"
                                      : isSpoken
                                      ? (isDark ? "#34D399" : "#059669")
                                      : colors.text,
                                    fontWeight: isThisChar ? "900" : isSpoken ? "800" : "600",
                                  },
                                ]}
                              >
                                {char}
                              </Text>
                            </View>
                          );
                        })}
                      </View>

                      {/* PINYIN (Bính âm có dấu) */}
                      {showPinyin && !!item.pinyin && (
                        <Text
                          style={[
                            styles.segmentPinyin,
                            {
                              color: isCurrent
                                ? (isDark ? "#6EE7B7" : "#059669")
                                : (colors.amber || "#CFAC62"),
                            },
                          ]}
                        >
                          {item.pinyin}
                        </Text>
                      )}

                      {/* DỊCH TIẾNG VIỆT BÊN DƯỚI TỪNG CÂU */}
                      {showMeaning && (
                        <View style={[styles.meaningContainer, { borderTopColor: isCurrent ? "rgba(16, 185, 129, 0.25)" : colors.border }]}>
                          <View style={styles.meaningRow}>
                            <Text style={styles.vnFlag}>🇻🇳</Text>
                            <Text
                              style={[
                                styles.segmentMeaning,
                                {
                                  color: isCurrent
                                    ? (isDark ? "#A7F3D0" : "#065F46")
                                    : (isDark ? "#D1D5DB" : "#4B5563"),
                                  fontWeight: isCurrent ? "600" : "400",
                                },
                              ]}
                            >
                              {item.meaningVi || "Chưa có bản dịch."}
                            </Text>
                          </View>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Tab 2: Toàn bộ văn bản */}
            {activeTab === "fullText" && (
              <View style={{ marginTop: 12 }}>
                {/* Bản gốc tiếng Trung */}
                <View
                  style={[
                    styles.fullTextCard,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  <View style={styles.fullTextHeader}>
                    <Text style={[styles.fullTextTitle, { color: colors.textMuted }]}>
                      BẢN GỐC TIẾNG TRUNG (PHỒN THỂ)
                    </Text>
                    <TouchableOpacity
                      onPress={() => handleShareOrCopy(result.fullText)}
                      style={[styles.copyAllBtn, { backgroundColor: colors.indigo || "#4F46E5" }]}
                      activeOpacity={0.8}
                    >
                      <MaterialIcons name="content-copy" size={15} color="#FFFFFF" />
                      <Text style={styles.copyAllBtnText}>Sao chép</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={[styles.fullTextBody, { color: colors.text }]} selectable>
                    {result.fullText}
                  </Text>
                </View>

                {/* Bản dịch tiếng Việt toàn bài */}
                {result.fullTranslation && (
                  <View
                    style={[
                      styles.fullTextCard,
                      { backgroundColor: colors.surface, borderColor: colors.border, marginTop: 14 },
                    ]}
                  >
                    <View style={styles.fullTextHeader}>
                      <Text style={[styles.fullTextTitle, { color: "#10B981" }]}>
                        BẢN DỊCH TIẾNG VIỆT TOÀN BÀI
                      </Text>
                      <TouchableOpacity
                        onPress={() => handleShareOrCopy(result.fullTranslation || "")}
                        style={[styles.copyAllBtn, { backgroundColor: "#10B981" }]}
                        activeOpacity={0.8}
                      >
                        <MaterialIcons name="content-copy" size={15} color="#FFFFFF" />
                        <Text style={styles.copyAllBtnText}>Sao chép</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={[styles.fullTextBody, { color: isDark ? "#D1D5DB" : "#374151" }]} selectable>
                      {result.fullTranslation}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* 💾 DÒNG NÚT THAO TÁC DƯỚI CÙNG (LƯU BÀI NGHE / CHIA SẺ) */}
            <View style={styles.actionBottomRow}>
              {/* Nút lưu bài nghe */}
              <TouchableOpacity
                onPress={handleSaveLesson}
                style={[
                  styles.bottomActionBtn,
                  {
                    backgroundColor: isCurrentLessonSaved ? (isDark ? "#1C1408" : "#FEF3C7") : "#F59E0B",
                    borderColor: isCurrentLessonSaved ? colors.amber : "transparent",
                    borderWidth: isCurrentLessonSaved ? 1 : 0,
                    marginRight: 8,
                  },
                ]}
                activeOpacity={0.8}
              >
                <MaterialIcons
                  name={isCurrentLessonSaved ? "bookmark" : "bookmark-add"}
                  size={18}
                  color={isCurrentLessonSaved ? (colors.amber || "#CFAC62") : "#FFFFFF"}
                />
                <Text
                  style={[
                    styles.bottomActionText,
                    { color: isCurrentLessonSaved ? (colors.amber || "#CFAC62") : "#FFFFFF" },
                  ]}
                >
                  {isCurrentLessonSaved ? "Đã lưu vào thư viện" : "Lưu bài nghe"}
                </Text>
              </TouchableOpacity>

              {/* Nút chia sẻ song ngữ */}
              <TouchableOpacity
                onPress={() => {
                  const combined = result.segments
                    .map((s) => `[${s.startFormatted}] ${s.text}\n(${s.pinyin || ""})\n🇻🇳 ${s.meaningVi || ""}`)
                    .join("\n\n");
                  handleShareOrCopy(combined);
                }}
                style={[
                  styles.bottomActionBtn,
                  { backgroundColor: "#10B981", flex: 1 },
                ]}
                activeOpacity={0.8}
              >
                <MaterialIcons name="share" size={18} color="#FFFFFF" />
                <Text style={styles.bottomActionText}>Chia sẻ</Text>
              </TouchableOpacity>

              {/* Nút bóc file khác */}
              <TouchableOpacity
                onPress={() => {
                  setResult(null);
                  setSelectedFile(null);
                  if (sound) sound.unloadAsync();
                  setSound(null);
                }}
                style={[
                  styles.bottomActionBtn,
                  { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, marginLeft: 8 },
                ]}
                activeOpacity={0.8}
              >
                <MaterialIcons name="refresh" size={18} color={colors.text} />
                <Text style={[styles.bottomActionText, { color: colors.text }]}>Đổi file</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}
      </ScrollView>

      {/* ─── MODAL THƯ VIỆN BÀI NGHE ĐÃ LƯU (XEM LẠI & XÓA ĐOẠN KHÔNG CẦN) ─── */}
      <Modal
        visible={showLibraryModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowLibraryModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View
            style={[
              styles.modalHeader,
              {
                backgroundColor: colors.surface,
                borderBottomColor: colors.border,
                paddingTop: insets.top > 0 ? insets.top + 8 : (Platform.OS === "android" ? 44 : 20),
              },
            ]}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <MaterialIcons name="folder-special" size={24} color={colors.amber || "#CFAC62"} />
              <View>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Thư viện bài nghe</Text>
                <Text style={[styles.modalSubtitle, { color: colors.textMuted }]}>
                  {savedLessons.length} bài nghe đã lưu
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => setShowLibraryModal(false)}
              style={[styles.closeModalBtn, { borderColor: colors.border }]}
              activeOpacity={0.7}
            >
              <MaterialIcons name="close" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
            {savedLessons.length === 0 ? (
              <View style={styles.emptyLibraryContainer}>
                <MaterialIcons name="folder-open" size={64} color={colors.textMuted} />
                <Text style={[styles.emptyLibraryTitle, { color: colors.text }]}>
                  Thư viện chưa có bài nghe nào
                </Text>
                <Text style={[styles.emptyLibrarySub, { color: colors.textMuted }]}>
                  Sau khi bóc script một file MP3, bạn hãy bấm nút "Lưu bài nghe" để lưu lại vào đây và nghe lại bất kỳ lúc nào.
                </Text>
              </View>
            ) : (
              savedLessons.map((lesson) => (
                <View
                  key={lesson.id}
                  style={[
                    styles.savedLessonCard,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  <View style={styles.savedLessonHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.savedLessonTitle, { color: colors.text }]}>
                        {lesson.title}
                      </Text>
                      <View style={styles.savedLessonMetaRow}>
                        <Text style={[styles.savedLessonMeta, { color: colors.textMuted }]}>
                          🕒 {formatDisplayTime(lesson.duration)} · {lesson.totalSegments || lesson.segments?.length} câu · {lesson.savedAt}
                        </Text>
                      </View>
                    </View>

                    {/* NÚT XÓA BÀI NGHE */}
                    <TouchableOpacity
                      onPress={() => handleDeleteLesson(lesson.id, lesson.title)}
                      style={styles.deleteLessonBtn}
                      activeOpacity={0.7}
                    >
                      <MaterialIcons name="delete-outline" size={20} color="#EF4444" />
                    </TouchableOpacity>
                  </View>

                  {/* Xem trước câu đầu tiên */}
                  {lesson.segments && lesson.segments.length > 0 && (
                    <View style={[styles.previewBox, { backgroundColor: isDark ? "#120E08" : "#F8F6F0" }]}>
                      <Text style={[styles.previewTextZh, { color: colors.text }]} numberOfLines={1}>
                        {lesson.segments[0].text}
                      </Text>
                      {!!lesson.segments[0].meaningVi && (
                        <Text style={[styles.previewTextVi, { color: colors.textMuted }]} numberOfLines={1}>
                          🇻🇳 {lesson.segments[0].meaningVi}
                        </Text>
                      )}
                    </View>
                  )}

                  {/* Nút mở bài nghe */}
                  <TouchableOpacity
                    onPress={() => handleOpenLesson(lesson)}
                    style={[styles.openLessonBtn, { backgroundColor: "#10B981" }]}
                    activeOpacity={0.8}
                  >
                    <MaterialIcons name="play-arrow" size={18} color="#FFFFFF" />
                    <Text style={styles.openLessonBtnText}>Mở bài nghe & Karaoke</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Copy notification toast */}
      {copiedNotice && (
        <Animated.View entering={FadeIn.duration(200)} style={styles.toastWrap}>
          <View style={styles.toast}>
            <MaterialIcons name="check-circle" size={18} color="#10B981" />
            <Text style={styles.toastText}>Đã mở hộp thoại sao chép/chia sẻ!</Text>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 0.5,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleWrap: {
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  freeBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10B981",
    marginRight: 5,
  },
  freeBadgeText: {
    fontSize: 11,
    color: "#10B981",
    fontWeight: "600",
  },
  libraryBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  libraryBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#10B981",
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  libraryBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },
  uploadCard: {
    borderRadius: 18,
    borderWidth: 2,
    borderStyle: "dashed",
    paddingVertical: 36,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  } as any,
  uploadIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  uploadTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 6,
    textAlign: "center",
  },
  uploadSub: {
    fontSize: 13,
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 18,
    maxWidth: 320,
  },
  uploadActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 24,
    gap: 8,
  },
  uploadActionBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  openLibraryQuickBtn: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 18,
    gap: 6,
  },
  openLibraryQuickText: {
    fontSize: 12.5,
    fontWeight: "600",
  },
  fileSelectedCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  fileInfoRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  fileIconSmall: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  fileName: {
    fontSize: 15,
    fontWeight: "700",
  },
  fileMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  changeFileBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 1,
    gap: 4,
  },
  changeFileText: {
    fontSize: 12,
    fontWeight: "600",
  },
  playerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
    padding: 12,
    borderRadius: 14,
  },
  skipBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 3,
  },
  playPauseBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  timeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  timelineHitArea: {
    paddingVertical: 8,
    cursor: "pointer",
  } as any,
  progressBg: {
    height: 6,
    backgroundColor: "rgba(150, 150, 150, 0.25)",
    borderRadius: 3,
    position: "relative",
    justifyContent: "center",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  scrubberThumb: {
    position: "absolute",
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#10B981",
    marginLeft: -6,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    elevation: 2,
  },
  transcribeBtn: {
    marginTop: 16,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  transcribeBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  processingCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  processingTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginTop: 14,
    textAlign: "center",
  },
  processingDesc: {
    fontSize: 12,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18,
    maxWidth: 320,
  },
  resultStatsBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  statCol: {
    alignItems: "center",
    flex: 1,
  },
  statVal: {
    fontSize: 17,
    fontWeight: "800",
  },
  statLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 24,
  },
  controlsRow: {
    flexDirection: "row",
    marginTop: 12,
    gap: 8,
    flexWrap: "wrap",
  },
  filterPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(150, 150, 150, 0.3)",
    gap: 4,
  },
  filterPillText: {
    fontSize: 11.5,
    fontWeight: "600",
  },
  tabToggleRow: {
    flexDirection: "row",
    marginTop: 12,
    gap: 10,
  },
  tabToggleBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
    backgroundColor: "transparent",
  },
  tabToggleActive: {
    borderWidth: 1.5,
  },
  tabToggleText: {
    fontSize: 13,
  },
  segmentCard: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    cursor: "pointer",
  } as any,
  segmentTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  segmentActionsLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
    flex: 1,
    marginRight: 8,
  },
  actionPillBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 14,
    borderWidth: 1,
    gap: 3.5,
  },
  actionPillText: {
    fontSize: 11,
    fontWeight: "700",
  },
  actionIconBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  timestampBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  timestampText: {
    fontSize: 11.5,
    fontWeight: "700",
  },
  copySingleBtn: {
    padding: 4,
  },
  deleteSingleSegmentBtn: {
    padding: 4,
    borderRadius: 6,
  },
  // 🟢 Ô XANH LÁ HIỆN ĐANG NÓI Ở CHỮ NÀO
  activeCharCallout: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    borderColor: "#10B981",
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginBottom: 8,
    gap: 5,
  },
  pulsingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10B981",
  },
  activeCharCalloutLabel: {
    fontSize: 11,
    color: "#10B981",
    fontWeight: "700",
  },
  activeCharBadge: {
    backgroundColor: "#10B981",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  activeCharBadgeText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },
  karaokeTextWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
  },
  charBox: {
    paddingHorizontal: 1,
    paddingVertical: 1,
    borderRadius: 5,
    marginVertical: 1,
  },
  activeCharBoxHighlight: {
    backgroundColor: "#10B981",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 6,
    elevation: 3,
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
  segmentCharText: {
    fontSize: 18,
    lineHeight: 28,
  },
  segmentPinyin: {
    fontSize: 13,
    marginTop: 4,
    letterSpacing: 0.3,
  },
  meaningContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 0.5,
  },
  meaningRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },
  vnFlag: {
    fontSize: 13,
    marginTop: 1,
  },
  segmentMeaning: {
    fontSize: 13.5,
    lineHeight: 20,
    flex: 1,
  },
  fullTextCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
  },
  fullTextHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  fullTextTitle: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  copyAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    gap: 4,
  },
  copyAllBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  fullTextBody: {
    fontSize: 16,
    lineHeight: 26,
    letterSpacing: 0.2,
  },
  actionBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
    gap: 6,
  },
  bottomActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 14,
    gap: 6,
  },
  bottomActionText: {
    fontSize: 13.5,
    fontWeight: "700",
  },
  toastWrap: {
    position: "absolute",
    bottom: 30,
    left: 20,
    right: 20,
    alignItems: "center",
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1F2937",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    gap: 8,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  toastText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  // Modal Thư viện đã lưu
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 0.5,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  modalSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  closeModalBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyLibraryContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
    paddingHorizontal: 24,
  },
  emptyLibraryTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 16,
    textAlign: "center",
  },
  emptyLibrarySub: {
    fontSize: 13,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 18,
  },
  savedLessonCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
  },
  savedLessonHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  savedLessonTitle: {
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22,
  },
  savedLessonMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  savedLessonMeta: {
    fontSize: 12,
  },
  deleteLessonBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    marginLeft: 8,
  },
  previewBox: {
    padding: 10,
    borderRadius: 10,
    marginTop: 10,
  },
  previewTextZh: {
    fontSize: 14,
    fontWeight: "600",
  },
  previewTextVi: {
    fontSize: 12.5,
    marginTop: 3,
  },
  openLessonBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 12,
    gap: 6,
  },
  openLessonBtnText: {
    color: "#FFFFFF",
    fontSize: 13.5,
    fontWeight: "700",
  },
});
