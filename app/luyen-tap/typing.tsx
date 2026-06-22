import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Animated,
  Dimensions,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import api from "../../services/api";
import { useTheme } from "../../src/context/ThemeContext";
import { parseWord } from "../../src/utils/wordParser";

interface WordItem {
  term: string;
  def: string;
  correctCount?: number;
}

export default function PracticeTypingScreen() {
  const { colors, isDark } = useTheme();
  const { topicId, title } = useLocalSearchParams<{ topicId: string; title: string }>();
  const router = useRouter();

  const [words, setWords] = useState<WordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userInput, setUserInput] = useState("");
  const [status, setStatus] = useState<"typing" | "correct" | "wrong">("typing");

  const [score, setScore] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [isReverseMode, setIsReverseMode] = useState(false);

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastAnim = useRef(new Animated.Value(-100)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Lưu thông tin bài "Cần ôn tập" tổng thể
  const [reviewListObj, setReviewListObj] = useState<any>(null);

  useEffect(() => {
    api.get("/api/vocab/lists").then((res) => {
      if (res.data.success) {
        const allLists = res.data.data;
        
        // Quét tìm bài "Cần ôn tập" cất vào state
        const foundReview = allLists.find((l: any) => l.title === "Cần ôn tập");
        setReviewListObj(foundReview);

        const targetList = allLists.find((l: any) => l._id === topicId);
        if (targetList && targetList.words.length > 0) {
          const preparedWords = targetList.words.map((w: any) => ({
            ...w,
            correctCount: w.correctCount || 0,
          }));
          
          if (targetList.title !== "Cần ôn tập") {
            preparedWords.sort(() => Math.random() - 0.5);
          }
          setWords(preparedWords);
        } else {
          setIsFinished(true);
        }
      }
      setLoading(false);
    });
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [topicId]);

  useEffect(() => {
    if (words.length > 0) {
      const percentage = (currentIndex / words.length) * 100;
      Animated.timing(progressAnim, {
        toValue: percentage,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
  }, [currentIndex, words.length]);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    Animated.timing(toastAnim, { toValue: 40, duration: 300, useNativeDriver: true }).start();
    setTimeout(() => {
      Animated.timing(toastAnim, { toValue: -100, duration: 300, useNativeDriver: true }).start(() =>
        setToastMsg(null)
      );
    }, 2500);
  };

  const getTargetAnswers = (rawAnswer: string) => {
    let validAnswers: string[] = [];
    if (!rawAnswer) return validAnswers;
    const normalizedStr = rawAnswer.replace(/（/g, "(").replace(/）/g, ")");
    const parts = normalizedStr.split("/");
    parts.forEach((part) => {
      const outside = part.replace(/\(.*?\)/g, "").trim().toLowerCase();
      if (outside) validAnswers.push(outside);
      const insideMatch = part.match(/\((.*?)\)/);
      if (insideMatch && insideMatch[1]) {
        insideMatch[1].split("/").forEach((ip) => {
          if (ip.trim()) validAnswers.push(ip.trim().toLowerCase());
        });
      }
    });
    return validAnswers;
  };

  const getCleanAnswer = () => {
    if (words.length === 0) return "";
    const currentWordObj = words[currentIndex];
    const parsed = parseWord(currentWordObj.term, currentWordObj.def);
    return isReverseMode ? parsed.meaning : parsed.word;
  };

  const handleHint = () => {
    if (words.length === 0) return;
    const currentWordObj = words[currentIndex];
    const parsed = parseWord(currentWordObj.term, currentWordObj.def);
    
    // Gợi ý từ câu trả lời
    const rawAnswer = isReverseMode ? parsed.meaning : parsed.word;
    const firstValidAnswer = getTargetAnswers(rawAnswer)[0] || rawAnswer;
    const revealCount = Math.max(1, Math.floor(firstValidAnswer.length / 2));
    triggerToast(`💡 Gợi ý: ${firstValidAnswer.substring(0, revealCount)} * * *`);
  };

  const moveToNextQuestion = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (currentIndex < words.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setUserInput("");
      setStatus("typing");
    } else {
      setIsFinished(true);
    }
  };

  const checkAnswer = () => {
    if (status !== "typing") {
      moveToNextQuestion();
      return;
    }
    if (!userInput.trim()) return;

    const currentWordObj = words[currentIndex];
    const parsed = parseWord(currentWordObj.term, currentWordObj.def);
    
    // Đống đáp án được chấp nhận
    let alternativeAnswers: string[] = [];
    if (isReverseMode) {
      // Hỏi Tiếng Nhật -> Gõ Tiếng Việt
      alternativeAnswers = getTargetAnswers(parsed.meaning);
    } else {
      // Hỏi Tiếng Việt -> Gõ Tiếng Nhật (Kanji hoặc Reading đều được)
      alternativeAnswers = [
        ...getTargetAnswers(parsed.word),
        ...getTargetAnswers(parsed.reading),
      ];
    }

    const cleanUser = userInput.replace(/　/g, " ").trim().toLowerCase();

    if (alternativeAnswers.includes(cleanUser) || cleanUser === getCleanAnswer().trim().toLowerCase()) {
      setStatus("correct");
      setScore((prev) => prev + 1);

      // Thao tác cày bài "Cần ôn tập"
      if (title === "Cần ôn tập" && reviewListObj) {
        const nextCount = (currentWordObj.correctCount || 0) + 1;
        currentWordObj.correctCount = nextCount;

        if (nextCount >= 10) {
          // Trục xuất từ ra khỏi mục ôn tập
          const filteredWords = reviewListObj.words.filter((w: any) => w.term !== currentWordObj.term);
          api.put(`/api/vocab/update/${reviewListObj._id}`, { title: "Cần ôn tập", list: filteredWords })
            .then(() => {
              setReviewListObj({ ...reviewListObj, words: filteredWords });
              triggerToast(`🎉 Thuần thục cực hạn! Đã gõ đúng 10 lần.`);
            });
        } else {
          const updatedReviewWords = reviewListObj.words.map((w: any) =>
            w.term === currentWordObj.term ? { ...w, correctCount: nextCount } : w
          );
          api.put(`/api/vocab/update/${reviewListObj._id}`, { title: "Cần ôn tập", list: updatedReviewWords })
            .then(() => setReviewListObj({ ...reviewListObj, words: updatedReviewWords }));
        }
      }
    } else {
      setStatus("wrong");

      // Gõ sai bài thường -> Auto copy sang bài "Cần ôn tập"
      if (title !== "Cần ôn tập" && reviewListObj) {
        const isAlreadyInReview = reviewListObj.words.some((w: any) => w.term === currentWordObj.term);
        
        if (!isAlreadyInReview) {
          const freshReviewWords = [
            ...reviewListObj.words,
            { term: currentWordObj.term, def: currentWordObj.def, correctCount: 0 },
          ];
          api.put(`/api/vocab/update/${reviewListObj._id}`, { title: "Cần ôn tập", list: freshReviewWords })
            .then(() => {
              setReviewListObj({ ...reviewListObj, words: freshReviewWords });
              triggerToast("⚠️ Lọt lưới! Đã khắc từ này vào mục 'Cần ôn tập'.");
            });
        }
      }
    }

    timerRef.current = setTimeout(() => {
      moveToNextQuestion();
    }, 2800);
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.indigo} />
      </View>
    );
  }

  if (isFinished) {
    const accuracy = Math.round((score / words.length) * 100) || 0;
    return (
      <SafeAreaView style={[styles.finishContainer, { backgroundColor: colors.background }]}>
        <Text style={styles.finishEmoji}>{accuracy >= 80 ? "🎉" : "💪"}</Text>
        <Text style={[styles.finishTitle, { color: colors.text }]}>Thanh Toán Trận Pháp!</Text>
        <Text style={[styles.finishSub, { color: colors.textMuted }]}>Độ chính xác: {accuracy}%</Text>
        <TouchableOpacity style={[styles.btnFinish, { backgroundColor: colors.indigo }]} onPress={() => router.back()}>
          <Text style={[styles.btnFinishText, { color: "#050814" }]}>Trở về Tàng Thư Các</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // Lấy câu hỏi hiện tại
  const currentWordObj = words[currentIndex];
  const parsed = parseWord(currentWordObj?.term || "", currentWordObj?.def || "");
  const currentQuestion = isReverseMode ? parsed.word : parsed.meaning;
  const currentAnswer = isReverseMode ? parsed.meaning : `${parsed.word}${parsed.reading && parsed.reading !== parsed.word ? ` (${parsed.reading})` : ""}`;
  const currentWordCorrectStreak = currentWordObj?.correctCount || 0;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      {toastMsg && (
        <Animated.View style={[styles.miniToast, { transform: [{ translateY: toastAnim }] }]}>
          <Text style={styles.miniToastText}>{toastMsg}</Text>
        </Animated.View>
      )}

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialIcons name="close" size={26} color={colors.textMuted} />
        </TouchableOpacity>
        <View style={[styles.progressTrack, { backgroundColor: isDark ? "#1E293B" : "#E2E8F0" }]}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                width: progressAnim.interpolate({
                  inputRange: [0, 100],
                  outputRange: ["0%", "100%"],
                }),
                backgroundColor: colors.indigo,
              },
            ]}
          />
        </View>
        <Text style={[styles.progressText, { color: colors.textMuted }]}>
          {currentIndex + 1}/{words.length}
        </Text>
      </View>

      {/* SWAP MODE BUTTON */}
      <View style={{ alignItems: "center", marginTop: 10 }}>
        <TouchableOpacity
          style={[styles.toggleModeBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => {
            setIsReverseMode(!isReverseMode);
            setUserInput("");
            setStatus("typing");
            if (timerRef.current) clearTimeout(timerRef.current);
          }}
        >
          <MaterialIcons name="swap-horiz" size={20} color={colors.indigo} />
          <Text style={[styles.toggleModeText, { color: colors.text }]}>
            {isReverseMode ? "Chế độ: Nhật ➔ Việt" : "Chế độ: Việt ➔ Nhật"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* MAIN QUESTION CARD */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.questionLabel, { color: colors.indigo }]}>
          {isReverseMode ? "Dịch sang Tiếng Việt" : "Dịch sang Tiếng Nhật"}
        </Text>
        
        <Text style={[styles.questionWord, { color: colors.text }, isReverseMode && { fontSize: 34 }]}>
          {currentQuestion}
        </Text>
        
        {isReverseMode && parsed.reading && parsed.reading !== parsed.word && (
          <Text style={[styles.readingHint, { color: colors.textMuted }]}>
            Cách đọc: {parsed.reading}
          </Text>
        )}

        {/* THUẦN THỤC CỰC HẠN */}
        {title === "Cần ôn tập" && (
          <View style={[styles.streakBadge, { backgroundColor: "rgba(245, 199, 107, 0.08)", borderColor: colors.indigo + "40" }]}>
            <Text style={[styles.streakBadgeText, { color: colors.indigo }]}>
              🔥 Độ thuần thục: {currentWordCorrectStreak}/10
            </Text>
          </View>
        )}
      </View>

      {/* TEXT INPUT ZONE */}
      <View style={styles.inputContainer}>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              color: colors.text,
            },
            status === "wrong" && [styles.inputWrong, { borderColor: colors.error, color: colors.error }],
            status === "correct" && [styles.inputCorrect, { borderColor: "#10B981", color: "#10B981" }],
          ]}
          value={userInput}
          onChangeText={(text) => {
            if (status !== "typing") {
              setStatus("typing");
              if (timerRef.current) clearTimeout(timerRef.current);
            }
            setUserInput(text);
          }}
          placeholder={isReverseMode ? "Gõ nghĩa Việt..." : "Gõ chữ Nhật (Kanji/Kana)..."}
          placeholderTextColor={colors.textMuted}
          autoFocus={true}
          autoCapitalize="none"
          editable={status === "typing"}
          blurOnSubmit={false}
          onSubmitEditing={checkAnswer}
        />
        {status === "typing" && (
          <TouchableOpacity
            style={[styles.hintBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={handleHint}
          >
            <MaterialIcons name="lightbulb-outline" size={16} color={colors.indigo} />
            <Text style={[styles.hintText, { color: colors.indigo }]}>Gợi ý</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* FOOTER ACTION BANNER */}
      <View style={styles.footer}>
        {status === "typing" ? (
          <TouchableOpacity
            style={[styles.btnCheck, { backgroundColor: colors.indigo }, !userInput.trim() && { backgroundColor: isDark ? "#1E293B" : "#CBD5E1" }]}
            onPress={checkAnswer}
            disabled={!userInput.trim()}
          >
            <Text style={[styles.btnCheckText, { color: !userInput.trim() ? colors.textMuted : "#050814" }]}>
              Kiểm tra
            </Text>
          </TouchableOpacity>
        ) : (
          <View
            style={[
              styles.floatingBanner,
              status === "correct"
                ? { backgroundColor: "rgba(16, 185, 129, 0.12)", borderColor: "#10B981" }
                : { backgroundColor: "rgba(239, 68, 68, 0.12)", borderColor: colors.error },
            ]}
          >
            <View style={styles.feedbackInfo}>
              <MaterialIcons
                name={status === "correct" ? "check-circle" : "cancel"}
                size={28}
                color={status === "correct" ? "#10B981" : colors.error}
              />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text
                  style={[
                    styles.feedbackTitle,
                    { color: status === "correct" ? "#10B981" : colors.error },
                  ]}
                >
                  {status === "correct" ? "Tuyệt vời!" : "Chưa chính xác!"}
                </Text>
                {status === "wrong" && (
                  <Text style={[styles.feedbackAnswer, { color: colors.text }]}>
                    Đáp án đúng: <Text style={{ fontWeight: "800", color: colors.indigo }}>{currentAnswer}</Text>
                  </Text>
                )}
              </View>
              <TouchableOpacity
                style={[
                  styles.btnNextMini,
                  { backgroundColor: status === "correct" ? "#10B981" : colors.error },
                ]}
                onPress={moveToNextQuestion}
              >
                <MaterialIcons name="arrow-forward" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  container: { flex: 1 },
  miniToast: {
    position: "absolute",
    top: 0,
    right: 16,
    backgroundColor: "#1E293B",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    zIndex: 9999,
  },
  miniToastText: { color: "#F5C76B", fontSize: 13, fontWeight: "700" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? 50 : 20,
    paddingBottom: 10,
    gap: 16,
  },
  progressTrack: { flex: 1, height: 10, borderRadius: 10, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 10 },
  progressText: { fontSize: 14, fontWeight: "700" },
  toggleModeBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1,
  },
  toggleModeText: { fontSize: 13, fontWeight: "700" },
  card: {
    marginHorizontal: 20,
    marginTop: 20,
    paddingVertical: 35,
    paddingHorizontal: 20,
    borderRadius: 24,
    alignItems: "center",
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 3,
  },
  questionLabel: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    marginBottom: 12,
    letterSpacing: 1,
  },
  questionWord: { fontSize: 26, fontWeight: "800", textAlign: "center" },
  readingHint: { fontSize: 14, fontWeight: "600", marginTop: 8 },
  streakBadge: {
    marginTop: 16,
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  streakBadgeText: { fontSize: 11, fontWeight: "800" },
  inputContainer: { paddingHorizontal: 20, marginTop: 30 },
  input: {
    borderWidth: 1.5,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
  },
  inputCorrect: { backgroundColor: "rgba(16, 185, 129, 0.05)" },
  inputWrong: { backgroundColor: "rgba(239, 68, 68, 0.05)" },
  hintBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-end",
    marginTop: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  hintText: { fontSize: 12, fontWeight: "800", marginLeft: 4 },
  footer: { position: "absolute", bottom: 40, left: 0, right: 0, paddingHorizontal: 20 },
  btnCheck: { paddingVertical: 16, borderRadius: 16, alignItems: "center" },
  btnCheckText: { fontSize: 15, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  floatingBanner: { padding: 16, borderRadius: 20, borderWidth: 1 },
  feedbackInfo: { flexDirection: "row", alignItems: "center" },
  feedbackTitle: { fontSize: 16, fontWeight: "800" },
  feedbackAnswer: { fontSize: 13, marginTop: 4 },
  btnNextMini: { width: 44, height: 44, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  finishContainer: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  finishEmoji: { fontSize: 70, marginBottom: 16 },
  finishTitle: { fontSize: 24, fontWeight: "800", marginBottom: 8 },
  finishSub: { fontSize: 15, fontWeight: "600", marginBottom: 24 },
  btnFinish: { paddingVertical: 14, paddingHorizontal: 32, borderRadius: 16 },
  btnFinishText: { fontSize: 15, fontWeight: "800" },
});