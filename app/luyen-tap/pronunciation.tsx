// File: app/luyen-tap/pronunciation.tsx

import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  Dimensions,
  Alert,
  TextInput,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import { MaterialIcons, Ionicons, Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Speech from "expo-speech";
import { Audio } from "expo-av";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
} from "react-native-reanimated";
import api from "../../services/api";
import { evaluatePronunciation } from "../../services/aiService";
import { useTheme } from "@/src/context/ThemeContext";
import { useCultivationStore } from "../../store/useCultivationStore";
import { SafeAreaView } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");

interface PracticeItem {
  id: string;
  traditional: string; // Chữ Hán Phồn Thể
  pinyin: string; // Phiên âm Pinyin
  zhuyin: string; // Chú âm Zhuyin
  hanviet: string; // Âm Hán Việt
  meaning: string; // Nghĩa tiếng Việt
  level: string; // TOCFL Level
  category: string;
}

const SAMPLE_PRONUNCIATION_DATA: PracticeItem[] = [
  {
    id: "p1",
    traditional: "你好！很高興認識你。",
    pinyin: "Nǐ hǎo! Hěn gāoxìng rènshì nǐ.",
    zhuyin: "ㄋㄧˇ ㄏㄠˇ！ㄏㄣˇ ㄍㄠ ㄒㄧㄥˋ ㄖㄣˋ ㄕˋ ㄋㄧˇ。",
    hanviet: "Nhĩ hảo! Hẩn cao hứng nhận thức nhĩ.",
    meaning: "Xin chào! Rất vui được làm quen với bạn.",
    level: "TOCFL A1",
    category: "Chào hỏi",
  },
  {
    id: "p2",
    traditional: "請問這個多少錢？",
    pinyin: "Qǐngwèn zhège duōshǎo qián?",
    zhuyin: "ㄑㄧㄥˇ ㄨㄣˋ ㄓㄜˋ ˙ㄍㄜ ㄉㄨㄛ ㄕㄠˇ ㄑㄧㄢˊ？",
    hanviet: "Thỉnh vấn giá cá đa thiểu tiền?",
    meaning: "Xin hỏi cái này giá bao nhiêu tiền?",
    level: "TOCFL A1",
    category: "Mua sắm",
  },
  {
    id: "p3",
    traditional: "我想喝一杯珍珠奶茶，半糖微冰。",
    pinyin: "Wǒ xiǎng hē yībēi zhēnzhū nǎichá, bàn táng wēi bīng.",
    zhuyin: "ㄨㄛˇ ㄒㄧㄤˇ ㄏㄜ ㄧ ㄅㄟ ㄓㄣ ㄓㄨ ㄋㄞˇ ㄔㄚˊ，ㄅㄢˋ ㄊㄤˊ ㄨㄟ ㄅㄧㄥ。",
    hanviet: "Ngã tưởng hát nhất bôi trân châu nãi trà, bán đường vi băng.",
    meaning: "Tôi muốn uống một ly trà sữa trân châu, nửa đường ít đá.",
    level: "TOCFL A2",
    category: "Ẩm thực Đài Loan",
  },
  {
    id: "p4",
    traditional: "捷運站往哪裡走？",
    pinyin: "Jiéyùn zhàn wǎng nǎlǐ zǒu?",
    zhuyin: "ㄐㄧㄝˊ ㄩㄣˋ ㄓㄢˋ ㄨㄤˇ ㄋㄚˇ ㄌㄧˇ ㄗㄡˇ？",
    hanviet: "Tiệp vận trạm vãng nả lý tẩu?",
    meaning: "Ga tàu điện ngầm (MRT) đi hướng nào vậy?",
    level: "TOCFL A1",
    category: "Giao thông",
  },
  {
    id: "p5",
    traditional: "今天天氣真好，我們一起去夜市吧！",
    pinyin: "Jīntiān tiānqì zhēn hǎo, wǒmen yīqǐ qù yèshì ba!",
    zhuyin: "ㄐㄧㄣ ㄊㄧㄢ ㄊㄧㄢ ㄑㄧˋ ㄓㄣ ㄏㄠˇ，ㄨㄛˇ ˙ㄇㄣ ㄧ ㄑㄧˇ ㄑㄩˋ ㄧㄝˋ ㄕˋ ˙ㄅㄚ！",
    hanviet: "Kim thiên thiên khí chân hảo, ngã môn nhất khởi khứ dạ thị ba!",
    meaning: "Hôm nay thời tiết thật đẹp, chúng mình cùng đi chợ đêm nhé!",
    level: "TOCFL A2",
    category: "Đời sống",
  },
  {
    id: "p6",
    traditional: "謝謝您的幫忙，祝您今天過得愉快！",
    pinyin: "Xièxiè nín de bāngmáng, zhù nín jīntiān guò de yúkuài!",
    zhuyin: "ㄒㄧㄝˋ ㄒㄧㄝˋ ㄋㄧㄣˊ ˙ㄉㄜ ㄅㄤ ㄇㄤˊ，ㄓㄨˋ ㄋㄧㄣˊ ㄐㄧㄣ ㄊㄧㄢ ㄍㄨㄛˋ ˙ㄉㄜ ㄩˊ ㄎㄨㄞˋ！",
    hanviet: "Tạ tạ nẫm đích bang mang, chúc nẫm kim thiên quá đắc du khoái!",
    meaning: "Cảm ơn sự giúp đỡ của bạn, chúc bạn một ngày vui vẻ!",
    level: "TOCFL B1",
    category: "Giao tiếp lịch sự",
  },
];

const CATEGORIES = ["Tất cả", "Chào hỏi", "Mua sắm", "Ẩm thực Đài Loan", "Giao thông", "Đời sống", "Giao tiếp lịch sự", "Tự nhập"];

export default function PronunciationPracticeScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { addXP } = useCultivationStore();

  const [selectedCategory, setSelectedCategory] = useState("Tất cả");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [customText, setCustomText] = useState("");
  const [customPinyin, setCustomPinyin] = useState("");
  const [customMeaning, setCustomMeaning] = useState("");

  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState<any | null>(null);
  const [soundObject, setSoundObject] = useState<Audio.Sound | null>(null);

  const pulseScale = useSharedValue(1);

  const filteredItems =
    selectedCategory === "Tất cả"
      ? SAMPLE_PRONUNCIATION_DATA
      : selectedCategory === "Tự nhập"
      ? []
      : SAMPLE_PRONUNCIATION_DATA.filter((item) => item.category === selectedCategory);

  const currentItem =
    selectedCategory === "Tự nhập"
      ? {
          id: "custom",
          traditional: customText || "請輸入繁體中文句子",
          pinyin: customPinyin || "Qǐng shūrù...",
          zhuyin: "",
          hanviet: "",
          meaning: customMeaning || "Nhập câu tiếng Trung Phồn Thể để luyện phát âm",
          level: "Tự do",
          category: "Tự nhập",
        }
      : filteredItems[currentIndex] || SAMPLE_PRONUNCIATION_DATA[0];

  useEffect(() => {
    (async () => {
      try {
        await Audio.requestPermissionsAsync();
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });
      } catch (err) {}
    })();

    return () => {
      if (soundObject) soundObject.unloadAsync();
      if (recording) recording.stopAndUnloadAsync().catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (isRecording) {
      pulseScale.value = withRepeat(
        withSequence(withTiming(1.2, { duration: 500 }), withTiming(1, { duration: 500 })),
        -1,
        true
      );
    } else {
      pulseScale.value = withTiming(1, { duration: 200 });
    }
  }, [isRecording]);

  const recordPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  // Phát âm mẫu câu chuẩn zh-TW
  const playNativePronunciation = async () => {
    try {
      setIsPlayingAudio(true);
      if (evaluationResult?.audioReference) {
        if (soundObject) await soundObject.unloadAsync();
        const { sound } = await Audio.Sound.createAsync(
          { uri: evaluationResult.audioReference },
          { shouldPlay: true }
        );
        setSoundObject(sound);
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) setIsPlayingAudio(false);
        });
      } else {
        Speech.stop();
        Speech.speak(currentItem.traditional, {
          language: "zh-TW",
          rate: 0.85,
          onDone: () => setIsPlayingAudio(false),
          onError: () => setIsPlayingAudio(false),
        });
      }
    } catch (e) {
      console.error(e);
      setIsPlayingAudio(false);
    }
  };

  // Bắt đầu ghi âm
  const startRecording = async () => {
    try {
      setEvaluationResult(null);
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Quyền ghi âm", "Vui lòng cho phép truy cập Microphone để luyện phát âm.");
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(newRecording);
      setIsRecording(true);
    } catch (err: any) {
      Alert.alert("Lỗi", "Không thể bắt đầu ghi âm: " + err.message);
    }
  };

  // Dừng ghi âm và gửi lên AI chấm điểm
  const stopRecordingAndEvaluate = async () => {
    if (!recording) return;
    try {
      setIsRecording(false);
      setIsEvaluating(true);
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);

      if (!uri) {
        setIsEvaluating(false);
        return;
      }

      const res = await evaluatePronunciation({
        audioUri: uri,
        targetText: currentItem.traditional,
        pinyin: currentItem.pinyin,
        meaning: currentItem.meaning,
      });

      if (res.success && res.data) {
        setEvaluationResult(res.data);
        if (res.data.score >= 70) {
          addXP(res.data.score >= 90 ? 25 : 15);
        }
      }
    } catch (err: any) {
      Alert.alert("Lỗi thẩm định", "Không thể chấm điểm phát âm: " + (err.response?.data?.message || err.message));
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleNext = () => {
    setEvaluationResult(null);
    if (currentIndex < filteredItems.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setCurrentIndex(0);
    }
  };

  const handlePrev = () => {
    setEvaluationResult(null);
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    } else {
      setCurrentIndex(Math.max(0, filteredItems.length - 1));
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return ["#10B981", "#059669"];
    if (score >= 65) return ["#F59E0B", "#D97706"];
    return ["#EF4444", "#DC2626"];
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? "#0D1117" : "#F8FAFC" }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.iconButton, { backgroundColor: isDark ? "#1F2937" : "#FFFFFF" }]}
        >
          <MaterialIcons name="arrow-back" size={24} color={isDark ? "#F3F4F6" : "#1F2937"} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: isDark ? "#F9FAFB" : "#111827" }]}>
            Luyện Phát Âm AI
          </Text>
          <Text style={styles.headerSub}>Tiếng Trung Phồn Thể (繁體中文)</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Category selector */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                onPress={() => {
                  setSelectedCategory(cat);
                  setCurrentIndex(0);
                  setEvaluationResult(null);
                }}
                style={[
                  styles.categoryChip,
                  {
                    backgroundColor: isSelected
                      ? "#3B82F6"
                      : isDark
                      ? "#1E293B"
                      : "#E2E8F0",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.categoryText,
                    { color: isSelected ? "#FFFFFF" : isDark ? "#94A3B8" : "#475569" },
                  ]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {selectedCategory === "Tự nhập" && (
          <View style={[styles.customBox, { backgroundColor: isDark ? "#1E293B" : "#FFFFFF" }]}>
            <TextInput
              style={[styles.input, { color: isDark ? "#FFFFFF" : "#000" }]}
              placeholder="Nhập câu Phồn Thể (Ví dụ: 我喜歡學習繁體中文)"
              placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
              value={customText}
              onChangeText={setCustomText}
            />
            <TextInput
              style={[styles.input, { color: isDark ? "#FFFFFF" : "#000" }]}
              placeholder="Pinyin (tuỳ chọn): Wǒ xǐhuān xuéxí..."
              placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
              value={customPinyin}
              onChangeText={setCustomPinyin}
            />
            <TextInput
              style={[styles.input, { color: isDark ? "#FFFFFF" : "#000" }]}
              placeholder="Nghĩa tiếng Việt: Tôi thích học tiếng Trung phồn thể"
              placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
              value={customMeaning}
              onChangeText={setCustomMeaning}
            />
          </View>
        )}

        {/* Main Flashcard Display */}
        <Animated.View
          entering={FadeInDown.duration(400)}
          style={[styles.mainCard, { backgroundColor: isDark ? "#1E293B" : "#FFFFFF" }]}
        >
          <View style={styles.cardTopBadge}>
            <View style={styles.badgeLevel}>
              <Text style={styles.badgeLevelText}>{currentItem.level}</Text>
            </View>
            <Text style={[styles.counterText, { color: isDark ? "#94A3B8" : "#64748B" }]}>
              {selectedCategory !== "Tự nhập" ? `${currentIndex + 1} / ${filteredItems.length}` : "Tự do"}
            </Text>
          </View>

          {/* Traditional Chinese Characters */}
          <Text style={[styles.traditionalText, { color: isDark ? "#F8FAFC" : "#0F172A" }]}>
            {currentItem.traditional}
          </Text>

          {/* Pinyin */}
          <Text style={styles.pinyinText}>{currentItem.pinyin}</Text>

          {/* Zhuyin / Bopomofo */}
          {!!currentItem.zhuyin && (
            <View style={styles.zhuyinBadge}>
              <Text style={styles.zhuyinText}>{currentItem.zhuyin}</Text>
            </View>
          )}

          {/* Han Viet */}
          {!!currentItem.hanviet && (
            <Text style={[styles.hanvietText, { color: isDark ? "#CBD5E1" : "#475569" }]}>
              Âm Hán Việt: {currentItem.hanviet}
            </Text>
          )}

          {/* Meaning */}
          <View style={styles.meaningDivider} />
          <Text style={[styles.meaningText, { color: isDark ? "#94A3B8" : "#334155" }]}>
            {currentItem.meaning}
          </Text>

          {/* Native Audio Button */}
          <TouchableOpacity
            onPress={playNativePronunciation}
            disabled={isPlayingAudio}
            style={[styles.playNativeBtn, { backgroundColor: isDark ? "#334155" : "#EEF2F6" }]}
          >
            <Ionicons
              name={isPlayingAudio ? "volume-high" : "volume-medium-outline"}
              size={22}
              color="#3B82F6"
            />
            <Text style={styles.playNativeText}>
              {isPlayingAudio ? "Đang phát âm..." : "Nghe phát âm chuẩn (zh-TW)"}
            </Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Evaluation Result View */}
        {isEvaluating && (
          <View style={[styles.evaluatingBox, { backgroundColor: isDark ? "#1E293B" : "#FFFFFF" }]}>
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text style={[styles.evaluatingText, { color: isDark ? "#94A3B8" : "#475569" }]}>
              🤖 AI Sensei đang phân tích thanh điệu & phát âm...
            </Text>
          </View>
        )}

        {evaluationResult && !isEvaluating && (
          <Animated.View
            entering={FadeIn.duration(400)}
            style={[styles.resultCard, { backgroundColor: isDark ? "#1E293B" : "#FFFFFF" }]}
          >
            {/* Score circle */}
            <View style={styles.resultHeader}>
              <LinearGradient
                colors={getScoreColor(evaluationResult.score) as any}
                style={styles.scoreCircle}
              >
                <Text style={styles.scoreNumber}>{evaluationResult.score}</Text>
                <Text style={styles.scoreUnit}>Điểm</Text>
              </LinearGradient>

              <View style={styles.scoreStatus}>
                <Text style={[styles.scoreStatusTitle, { color: isDark ? "#F8FAFC" : "#0F172A" }]}>
                  {evaluationResult.score >= 85
                    ? "🎉 Phát âm rất chuẩn!"
                    : evaluationResult.score >= 65
                    ? "👍 Khá tốt, cần lưu ý thanh điệu"
                    : "💪 Cần luyện tập thêm"}
                </Text>
                <Text style={[styles.spokenText, { color: isDark ? "#94A3B8" : "#64748B" }]}>
                  Bạn đã đọc: "{evaluationResult.spokenText || "(Chưa rõ âm)"}"
                </Text>
              </View>
            </View>

            {/* AI Feedback */}
            <View style={[styles.feedbackBox, { backgroundColor: isDark ? "#0F172A" : "#F1F5F9" }]}>
              <View style={styles.feedbackTitleRow}>
                <MaterialIcons name="psychology" size={20} color="#3B82F6" />
                <Text style={styles.feedbackTitle}>Nhận xét của AI Sensei:</Text>
              </View>
              <Text style={[styles.feedbackContent, { color: isDark ? "#E2E8F0" : "#1E293B" }]}>
                {evaluationResult.phoneticFeedback}
              </Text>
            </View>

            {/* Character Analysis Badges */}
            {evaluationResult.charAnalysis && evaluationResult.charAnalysis.length > 0 && (
              <View style={styles.charAnalysisSection}>
                <Text style={[styles.sectionTitle, { color: isDark ? "#94A3B8" : "#475569" }]}>
                  Phân tích từng chữ:
                </Text>
                <View style={styles.charRow}>
                  {evaluationResult.charAnalysis.map((item: any, idx: number) => {
                    const isOk = item.status === "correct";
                    return (
                      <View
                        key={idx}
                        style={[
                          styles.charBadge,
                          {
                            borderColor: isOk ? "#10B981" : "#EF4444",
                            backgroundColor: isOk ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
                          },
                        ]}
                      >
                        <Text style={[styles.charText, { color: isDark ? "#FFFFFF" : "#000000" }]}>
                          {item.char}
                        </Text>
                        <Text style={styles.charPinyin}>{item.pinyin || ""}</Text>
                        <Ionicons
                          name={isOk ? "checkmark-circle" : "alert-circle"}
                          size={14}
                          color={isOk ? "#10B981" : "#EF4444"}
                        />
                      </View>
                    );
                  })}
                </View>
              </View>
            )}
          </Animated.View>
        )}

        {/* Recording Controls */}
        <View style={styles.actionControls}>
          <TouchableOpacity
            onPress={handlePrev}
            style={[styles.navBtn, { backgroundColor: isDark ? "#1E293B" : "#E2E8F0" }]}
          >
            <MaterialIcons name="chevron-left" size={32} color={isDark ? "#94A3B8" : "#475569"} />
          </TouchableOpacity>

          {/* Record Button with Pulse */}
          <Animated.View style={recordPulseStyle}>
            <TouchableOpacity
              onPress={isRecording ? stopRecordingAndEvaluate : startRecording}
              disabled={isEvaluating}
              style={[
                styles.recordButton,
                {
                  backgroundColor: isRecording ? "#EF4444" : "#3B82F6",
                },
              ]}
            >
              <MaterialIcons
                name={isRecording ? "stop" : "mic"}
                size={38}
                color="#FFFFFF"
              />
            </TouchableOpacity>
          </Animated.View>

          <TouchableOpacity
            onPress={handleNext}
            style={[styles.navBtn, { backgroundColor: isDark ? "#1E293B" : "#E2E8F0" }]}
          >
            <MaterialIcons name="chevron-right" size={32} color={isDark ? "#94A3B8" : "#475569"} />
          </TouchableOpacity>
        </View>

        <Text style={[styles.instructionHint, { color: isDark ? "#64748B" : "#94A3B8" }]}>
          {isRecording ? "🔴 Đang lắng nghe... Nhấn để kết thúc và chấm điểm" : "Nhấn Micro để đọc câu trên"}
        </Text>
      </ScrollView>
    </SafeAreaView>
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
    paddingVertical: 12,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  headerCenter: {
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  headerSub: {
    fontSize: 12,
    color: "#3B82F6",
    marginTop: 2,
    fontWeight: "500",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  categoryScroll: {
    marginVertical: 12,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: "600",
  },
  customBox: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    gap: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  mainCard: {
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    marginVertical: 8,
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  cardTopBadge: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    alignItems: "center",
    marginBottom: 16,
  },
  badgeLevel: {
    backgroundColor: "rgba(59, 130, 246, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeLevelText: {
    color: "#3B82F6",
    fontWeight: "700",
    fontSize: 12,
  },
  counterText: {
    fontSize: 13,
    fontWeight: "500",
  },
  traditionalText: {
    fontSize: 28,
    fontWeight: "800",
    textAlign: "center",
    lineHeight: 38,
    marginBottom: 8,
  },
  pinyinText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#3B82F6",
    textAlign: "center",
    marginBottom: 6,
  },
  zhuyinBadge: {
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 8,
  },
  zhuyinText: {
    fontSize: 13,
    color: "#D97706",
    fontWeight: "500",
    textAlign: "center",
  },
  hanvietText: {
    fontSize: 13,
    fontStyle: "italic",
    marginBottom: 10,
  },
  meaningDivider: {
    height: 1,
    backgroundColor: "#E2E8F0",
    width: "80%",
    marginVertical: 10,
  },
  meaningText: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 16,
  },
  playNativeBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
    gap: 8,
  },
  playNativeText: {
    fontSize: 13,
    color: "#3B82F6",
    fontWeight: "600",
  },
  evaluatingBox: {
    padding: 20,
    borderRadius: 16,
    alignItems: "center",
    marginVertical: 12,
    gap: 10,
  },
  evaluatingText: {
    fontSize: 14,
    fontWeight: "500",
  },
  resultCard: {
    borderRadius: 16,
    padding: 16,
    marginVertical: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    gap: 16,
  },
  scoreCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreNumber: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  scoreUnit: {
    fontSize: 10,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  scoreStatus: {
    flex: 1,
  },
  scoreStatusTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  spokenText: {
    fontSize: 13,
    fontStyle: "italic",
  },
  feedbackBox: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  feedbackTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  feedbackTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#3B82F6",
  },
  feedbackContent: {
    fontSize: 13,
    lineHeight: 20,
  },
  charAnalysisSection: {
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 8,
  },
  charRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  charBadge: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: "center",
    minWidth: 44,
  },
  charText: {
    fontSize: 16,
    fontWeight: "700",
  },
  charPinyin: {
    fontSize: 10,
    color: "#64748B",
    marginVertical: 2,
  },
  actionControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 28,
    marginTop: 20,
  },
  navBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  recordButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
    shadowColor: "#3B82F6",
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  instructionHint: {
    textAlign: "center",
    fontSize: 13,
    marginTop: 12,
    fontWeight: "500",
  },
});
