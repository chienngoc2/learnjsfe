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
} from "react-native";
import { useRouter, Stack } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { Audio } from "expo-av";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/src/context/ThemeContext";
import { transcribeMp3File } from "../../services/aiService";

interface Segment {
  id: number;
  start: number;
  end: number;
  startFormatted: string;
  endFormatted: string;
  text: string;
}

interface ScriptResult {
  fileName: string;
  fileSize: number;
  duration: number;
  fullText: string;
  segments: Segment[];
  totalSegments: number;
  language: string;
}

export default function AudioScriptScreen() {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // File state
  const [selectedFile, setSelectedFile] = useState<{
    uri: string;
    name: string;
    size?: number;
    mimeType?: string;
  } | null>(null);

  // Audio player state
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(0);

  // Transcribe state
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScriptResult | null>(null);
  const [activeTab, setActiveTab] = useState<"segments" | "fullText">("segments");
  const [copiedNotice, setCopiedNotice] = useState(false);

  // Cleanup sound khi unmount
  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync().catch(() => {});
      }
    };
  }, [sound]);

  // Chọn file âm thanh từ điện thoại
  const handlePickDocument = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ["audio/*"],
        copyToCacheDirectory: true,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        const asset = res.assets[0];

        // Dừng và giải phóng audio cũ nếu đang phát
        if (sound) {
          await sound.unloadAsync();
          setSound(null);
          setIsPlaying(false);
          setPlaybackPosition(0);
        }

        setSelectedFile({
          uri: asset.uri,
          name: asset.name,
          size: asset.size,
          mimeType: asset.mimeType || "audio/mpeg",
        });
        setResult(null);

        // Khởi tạo audio player cho file mới
        try {
          const { sound: newSound, status } = await Audio.Sound.createAsync(
            { uri: asset.uri },
            { shouldPlay: false },
            onPlaybackStatusUpdate
          );
          setSound(newSound);
          if (status.isLoaded && status.durationMillis) {
            setPlaybackDuration(status.durationMillis / 1000);
          }
        } catch (e) {
          console.warn("Không thể tải bản xem trước âm thanh:", e);
        }
      }
    } catch (err: any) {
      Alert.alert("Lỗi", "Không thể chọn file âm thanh: " + (err.message || ""));
    }
  };

  const onPlaybackStatusUpdate = (status: any) => {
    if (status.isLoaded) {
      setPlaybackPosition(status.positionMillis / 1000);
      if (status.durationMillis) {
        setPlaybackDuration(status.durationMillis / 1000);
      }
      setIsPlaying(status.isPlaying);
      if (status.didJustFinish) {
        setIsPlaying(false);
        setPlaybackPosition(0);
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

  const seekToTime = async (seconds: number) => {
    if (!sound) return;
    try {
      await sound.setPositionAsync(Math.max(0, seconds * 1000));
      await sound.playAsync();
      setIsPlaying(true);
    } catch (e) {
      console.warn("Lỗi seek audio:", e);
    }
  };

  // Thực hiện bóc Script qua Whisper Local trên Backend (0 token, 0 Groq)
  const handleStartTranscribe = async () => {
    if (!selectedFile) {
      Alert.alert("Thông báo", "Vui lòng chọn file MP3 hoặc Audio trước khi thực hiện.");
      return;
    }

    try {
      setLoading(true);
      const res = await transcribeMp3File({
        uri: selectedFile.uri,
        name: selectedFile.name,
        type: selectedFile.mimeType || "audio/mpeg",
        language: "chinese",
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

  // Chia sẻ hoặc sao chép script
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
            <Text style={styles.freeBadgeText}>100% Miễn Phí · 0 Token</Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => {
            Alert.alert(
              "Về tính năng này",
              "Chức năng sử dụng mô hình Whisper AI xử lý trực tiếp trên máy chủ. Bạn có thể tải lên các file MP3 bài nghe hội thoại, podcast tiếng Trung và lấy toàn bộ văn bản cùng mốc thời gian (timestamp) hoàn toàn miễn phí mà không tốn token AI."
            );
          }}
          style={[styles.infoBtn, { borderColor: colors.border }]}
          activeOpacity={0.7}
        >
          <MaterialIcons name="help-outline" size={20} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
      >
        {/* ─── UPLOAD / FILE PICKER CARD ─── */}
        <Animated.View entering={FadeInDown.duration(400)}>
          {!selectedFile ? (
            <TouchableOpacity
              onPress={handlePickDocument}
              activeOpacity={0.8}
              style={[
                styles.uploadCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: isDark ? "rgba(207, 172, 98, 0.4)" : "rgba(139, 105, 20, 0.3)",
                },
              ]}
            >
              <View style={[styles.uploadIconWrap, { backgroundColor: isDark ? "#1C1408" : "#FEF3C7" }]}>
                <MaterialIcons name="audiotrack" size={36} color={colors.amber || "#CFAC62"} />
              </View>
              <Text style={[styles.uploadTitle, { color: colors.text }]}>Chọn file MP3 hoặc Audio</Text>
              <Text style={[styles.uploadSub, { color: colors.textMuted }]}>
                Hỗ trợ .mp3, .m4a, .wav, .aac (Dưới 50MB)
              </Text>
              <View style={[styles.uploadActionBtn, { backgroundColor: colors.indigo || "#4F46E5" }]}>
                <MaterialIcons name="file-upload" size={18} color="#FFFFFF" />
                <Text style={styles.uploadActionBtnText}>Tải file từ thiết bị</Text>
              </View>
            </TouchableOpacity>
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
                    {formatFileSize(selectedFile.size)} · Tiếng Trung (繁體/簡體)
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

              {/* Mini Audio Player */}
              <View style={[styles.playerContainer, { backgroundColor: isDark ? "#120E08" : "#F8F6F0" }]}>
                <TouchableOpacity
                  onPress={togglePlayPause}
                  style={[styles.playPauseBtn, { backgroundColor: colors.indigo || "#4F46E5" }]}
                  activeOpacity={0.8}
                >
                  <MaterialIcons
                    name={isPlaying ? "pause" : "play-arrow"}
                    size={22}
                    color="#FFFFFF"
                  />
                </TouchableOpacity>
                <View style={{ flex: 1, marginHorizontal: 12 }}>
                  <View style={styles.timeRow}>
                    <Text style={[styles.timeText, { color: colors.textMuted }]}>
                      {formatDisplayTime(playbackPosition)}
                    </Text>
                    <Text style={[styles.timeText, { color: colors.textMuted }]}>
                      {formatDisplayTime(playbackDuration)}
                    </Text>
                  </View>
                  <View style={styles.progressBg}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          backgroundColor: colors.indigo || "#4F46E5",
                          width: `${playbackDuration > 0 ? Math.min(100, (playbackPosition / playbackDuration) * 100) : 0}%`,
                        },
                      ]}
                    />
                  </View>
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
                        Đang nhận diện giọng nói (Whisper)...
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.loadingRow}>
                      <MaterialIcons name="transcribe" size={20} color="#FFFFFF" />
                      <Text style={styles.transcribeBtnText}>Bắt đầu bóc Script</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
            </View>
          )}
        </Animated.View>

        {/* ─── LOADING ANIMATION CARD ─── */}
        {loading && (
          <Animated.View entering={FadeInDown.duration(400)} style={{ marginTop: 16 }}>
            <View
              style={[
                styles.processingCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <ActivityIndicator size="large" color={colors.amber || "#CFAC62"} />
              <Text style={[styles.processingTitle, { color: colors.text }]}>
                Đang chuyển đổi âm thanh & nhận dạng
              </Text>
              <Text style={[styles.processingDesc, { color: colors.textMuted }]}>
                Mô hình Whisper AI chạy trực tiếp 100% nội bộ trên Server. Quá trình bóc script có thể mất từ 10 - 30 giây tuỳ theo độ dài file.
              </Text>
            </View>
          </Animated.View>
        )}

        {/* ─── RESULT VIEW ─── */}
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
                <Text style={[styles.statVal, { color: colors.text }]}>
                  {formatDisplayTime(result.duration)}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Thời lượng</Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
              <View style={styles.statCol}>
                <Text style={[styles.statVal, { color: colors.text }]}>
                  {result.totalSegments}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Số phân đoạn</Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
              <View style={styles.statCol}>
                <Text style={[styles.statVal, { color: colors.text }]}>
                  {result.fullText.length}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Ký tự Hán</Text>
              </View>
            </View>

            {/* Segment / Fulltext Toggle */}
            <View style={styles.tabToggleRow}>
              <TouchableOpacity
                onPress={() => setActiveTab("segments")}
                style={[
                  styles.tabToggleBtn,
                  activeTab === "segments" && [
                    styles.tabToggleActive,
                    { backgroundColor: colors.surface, borderColor: colors.indigo },
                  ],
                ]}
                activeOpacity={0.8}
              >
                <MaterialIcons
                  name="format-list-bulleted"
                  size={18}
                  color={activeTab === "segments" ? colors.indigo : colors.textMuted}
                />
                <Text
                  style={[
                    styles.tabToggleText,
                    {
                      color: activeTab === "segments" ? colors.indigo : colors.textMuted,
                      fontWeight: activeTab === "segments" ? "700" : "500",
                    },
                  ]}
                >
                  Từng câu ({result.segments.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setActiveTab("fullText")}
                style={[
                  styles.tabToggleBtn,
                  activeTab === "fullText" && [
                    styles.tabToggleActive,
                    { backgroundColor: colors.surface, borderColor: colors.indigo },
                  ],
                ]}
                activeOpacity={0.8}
              >
                <MaterialIcons
                  name="subject"
                  size={18}
                  color={activeTab === "fullText" ? colors.indigo : colors.textMuted}
                />
                <Text
                  style={[
                    styles.tabToggleText,
                    {
                      color: activeTab === "fullText" ? colors.indigo : colors.textMuted,
                      fontWeight: activeTab === "fullText" ? "700" : "500",
                    },
                  ]}
                >
                  Toàn bộ văn bản
                </Text>
              </TouchableOpacity>
            </View>

            {/* Tab 1: Segments List */}
            {activeTab === "segments" && (
              <View style={{ marginTop: 12 }}>
                {result.segments.map((item, idx) => (
                  <View
                    key={item.id ?? idx}
                    style={[
                      styles.segmentCard,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <View style={styles.segmentTopRow}>
                      <TouchableOpacity
                        onPress={() => seekToTime(item.start)}
                        style={[styles.timestampBadge, { backgroundColor: isDark ? "#1C1408" : "#FEF3C7" }]}
                        activeOpacity={0.7}
                      >
                        <MaterialIcons name="play-circle-outline" size={14} color={colors.amber || "#CFAC62"} />
                        <Text style={[styles.timestampText, { color: colors.amber || "#CFAC62" }]}>
                          {item.startFormatted} - {item.endFormatted}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => handleShareOrCopy(item.text)}
                        style={styles.copySingleBtn}
                        activeOpacity={0.6}
                      >
                        <MaterialIcons name="content-copy" size={16} color={colors.textMuted} />
                      </TouchableOpacity>
                    </View>

                    <Text style={[styles.segmentText, { color: colors.text }]}>
                      {item.text}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Tab 2: Full Text View */}
            {activeTab === "fullText" && (
              <View
                style={[
                  styles.fullTextCard,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <View style={styles.fullTextHeader}>
                  <Text style={[styles.fullTextTitle, { color: colors.textMuted }]}>
                    NỘI DUNG SCRIPT
                  </Text>
                  <TouchableOpacity
                    onPress={() => handleShareOrCopy(result.fullText)}
                    style={[styles.copyAllBtn, { backgroundColor: colors.indigo || "#4F46E5" }]}
                    activeOpacity={0.8}
                  >
                    <MaterialIcons name="share" size={16} color="#FFFFFF" />
                    <Text style={styles.copyAllBtnText}>Chia sẻ / Sao chép</Text>
                  </TouchableOpacity>
                </View>
                <Text style={[styles.fullTextBody, { color: colors.text }]} selectable>
                  {result.fullText}
                </Text>
              </View>
            )}

            {/* Action Bottom Buttons */}
            <View style={styles.actionBottomRow}>
              <TouchableOpacity
                onPress={() => handleShareOrCopy(result.fullText)}
                style={[
                  styles.bottomActionBtn,
                  { backgroundColor: colors.indigo || "#4F46E5", flex: 1 },
                ]}
                activeOpacity={0.8}
              >
                <MaterialIcons name="content-copy" size={18} color="#FFFFFF" />
                <Text style={styles.bottomActionText}>Sao chép tất cả</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setResult(null);
                  setSelectedFile(null);
                  if (sound) sound.unloadAsync();
                  setSound(null);
                }}
                style={[
                  styles.bottomActionBtn,
                  { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, marginLeft: 10 },
                ]}
                activeOpacity={0.8}
              >
                <MaterialIcons name="refresh" size={18} color={colors.text} />
                <Text style={[styles.bottomActionText, { color: colors.text }]}>Bóc file khác</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}
      </ScrollView>

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
  infoBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  uploadCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    borderStyle: "dashed",
    paddingVertical: 36,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  uploadIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  uploadTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 6,
  },
  uploadSub: {
    fontSize: 13,
    textAlign: "center",
    marginBottom: 20,
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
    borderRadius: 12,
  },
  playPauseBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  timeText: {
    fontSize: 11,
    fontWeight: "500",
  },
  progressBg: {
    height: 4,
    backgroundColor: "rgba(150, 150, 150, 0.25)",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
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
  tabToggleRow: {
    flexDirection: "row",
    marginTop: 16,
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
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  segmentTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
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
  segmentText: {
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 0.2,
  },
  fullTextCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginTop: 12,
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
  },
  bottomActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  bottomActionText: {
    color: "#FFFFFF",
    fontSize: 14,
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
});
