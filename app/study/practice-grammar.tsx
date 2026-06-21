// File: app/study/practice-grammar.tsx

import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Platform,
} from "react-native";
import { useRouter, Stack, useLocalSearchParams } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import api from "../../services/api";
import { useTheme } from "@/src/context/ThemeContext";

// IMPORT CÁC COMPONENT UI DÙNG CHUNG CỦA SẾP
import Button from "../../components/ui/Button";
import Header from "../../components/ui/Header";

interface GrammarPoint {
  _id: string;
  title: string;
  formula: string;
  meaning: string;
  examples: string[];
  belongingTopic?: string;
}

// 🚀 CẬP NHẬT: Đã gỡ bỏ scramble và mảng từ xáo trộn
interface QuizQuestion {
  type: "type_jp" | "translate_vi";
  question: string;
  correctAnswer: string;
  correctAnswerFurigana?: string;
  hint: string;
}

interface FeedbackResult {
  score: number;
  correct: boolean;
  explanation: string;
}

// Sub-component hiển thị Furigana (Giữ nguyên vì tính năng này quá xịn)
function FuriganaText({
  text,
  baseSize = 18,
  furiganaSize = 11,
  color = "#000",
}: any) {
  if (!text) return null;
  const parts = text.split(/([^\s[\]]+\[[^[\]]+\])/g);
  return (
    <View style={styles.furiganaRow}>
      {parts.map((part: string, idx: number) => {
        if (!part) return null;
        const match = part.match(/^([^\s[\]]+)\[([^[\]]+)\]$/);
        if (match) {
          return (
            <View key={idx} style={styles.rubyContainer}>
              <Text
                style={[
                  styles.rubyText,
                  {
                    fontSize: furiganaSize,
                    color: color === "#FFF" ? "#E2E8F0" : "#64748B",
                  },
                ]}
              >
                {match[2]}
              </Text>
              <Text
                style={[styles.baseText, { fontSize: baseSize, color: color }]}
              >
                {match[1]}
              </Text>
            </View>
          );
        } else {
          return (
            <Text
              key={idx}
              style={[styles.plainText, { fontSize: baseSize, color: color }]}
            >
              {part}
            </Text>
          );
        }
      })}
    </View>
  );
}

export default function PracticeGrammarScreen() {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ title?: string; topicTitle?: string }>();

  const [allGrammarPoints, setAllGrammarPoints] = useState<GrammarPoint[]>([]);
  const [selectedGrammar, setSelectedGrammar] = useState<GrammarPoint | null>(
    null,
  );
  const [loadingList, setLoadingList] = useState(true);
  const [loadingQuiz, setLoadingQuiz] = useState(false);

  // 🚀 TỐI ƯU HÓA STATE: Chỉ còn lưu Câu hỏi, Câu trả lời người dùng và Bảng điểm (xóa sạch mảng xếp chữ)
  const [currentQuizzes, setCurrentQuizzes] = useState<QuizQuestion[]>([]);
  const [userAnswers, setUserAnswers] = useState<string[]>(
    new Array(6).fill(""),
  );
  const [feedbacks, setFeedbacks] = useState<(FeedbackResult | null)[]>(
    new Array(6).fill(null),
  );
  const [gradingStates, setGradingStates] = useState<boolean[]>(
    new Array(6).fill(false),
  );

  const startPractice = async (grammar: GrammarPoint) => {
    setSelectedGrammar(grammar);
    setLoadingQuiz(true);

    setUserAnswers(new Array(6).fill(""));
    setFeedbacks(new Array(6).fill(null));
    setGradingStates(new Array(6).fill(false));

    // 🚀 CHIA LẠI CẤU TRÚC 6 CÂU: 3 câu Dịch Việt -> Nhật, 3 câu Dịch Nhật -> Việt
    const targetTypes: ("type_jp" | "translate_vi")[] = [
      "type_jp",
      "type_jp",
      "type_jp",
      "translate_vi",
      "translate_vi",
      "translate_vi",
    ];

    try {
      const requests = targetTypes.map((type) =>
        api.post("/api/chat/generate-direct-grammar-quiz", {
          title: grammar.title,
          formula: grammar.formula,
          meaning: grammar.meaning,
          type: type,
        }),
      );

      const responses = await Promise.all(requests);
      const questionsData: QuizQuestion[] = responses.map((res) => {
        if (typeof res.data.reply === "string") {
          const cleaned = res.data.reply.replace(/```json\n|\n```|```/g, "").trim();
          return JSON.parse(cleaned);
        }
        return res.data.reply;
      });

      setCurrentQuizzes(questionsData);
    } catch (error) {
      console.error("Lỗi bốc set 6 câu hỏi từ Groq AI:", error);
    } finally {
      setLoadingQuiz(false);
    }
  };

  useEffect(() => {
    setLoadingList(true);
    api
      .get("/api/vocab/all-grammar-points")
      .then((res) => {
        if (res.data.success && Array.isArray(res.data.data)) {
          setAllGrammarPoints(res.data.data);
          
          if (params.title || params.topicTitle) {
            const matched = res.data.data.find((item: any) => 
              (params.title && item.title?.toLowerCase().includes(params.title.toLowerCase())) ||
              (params.topicTitle && item.belongingTopic?.toLowerCase().includes(params.topicTitle.toLowerCase()))
            );
            if (matched) {
              startPractice(matched);
            }
          }
        }
      })
      .catch((err) => console.error("❌ Lỗi gọi API:", err))
      .finally(() => setLoadingList(false));
  }, [params.title, params.topicTitle]);


  const submitIndividualAnswer = async (quizIdx: number) => {
    const currentQuiz = currentQuizzes[quizIdx];
    if (!currentQuiz || gradingStates[quizIdx]) return;

    const updatedGrading = [...gradingStates];
    updatedGrading[quizIdx] = true;
    setGradingStates(updatedGrading);

    // Lấy Text người dùng gõ
    const rawAnswer = userAnswers[quizIdx].trim();
    const finalAnswer = rawAnswer.replace(/\[.*?\]|\s+/g, "");

    try {
      const res = await api.post("/api/chat/chat", {
        messages: [
          {
            role: "user",
            content: `Bạn là một Sensei tiếng Nhật cực kỳ thông minh và linh hoạt. Hãy chấm điểm công tâm:
            - Đề bài: ${currentQuiz.question}
            - Đáp án chuẩn mẫu: ${currentQuiz.correctAnswer}
            - Câu học viên làm: ${finalAnswer}
            
            🔥 QUY TẮC CHẤM ĐIỂM SỐNG CÒN (CẤM VI PHẠM):
            1. LINH HOẠT CẤU TRÚC: Tiếng Nhật có nhiều cách diễn đạt. Ví dụ "muốn đi xem phim" có thể là えいがをみたい (muốn xem) hoặc えいがをみにいきたい (muốn đi xem). Cả 2 đều ĐÚNG. TUYỆT ĐỐI KHÔNG trừ điểm nếu học viên dùng cấu trúc đồng nghĩa tự nhiên.
            2. PHÂN BIỆT LỖI ĐÁNH MÁY (TYPO): Nếu học viên gõ "こばん" (thiếu chữ ん của こんばん) hoặc "えが" (thiếu chữ い của えいが), hãy hiểu đó là LỖI ĐÁNH MÁY (Typo). Hãy nhẹ nhàng chỉ ra lỗi sai chính tả này, CHỨ KHÔNG ĐƯỢC mắng họ là sai từ vựng hoàn toàn.
            3. TRỪ ĐIỂM HỢP LÝ: 
               - Sai cấu trúc ngữ pháp cốt lõi hoàn toàn (< 50 điểm).
               - Đúng ngữ pháp nhưng dính lỗi đánh máy typo hoặc sai trợ từ (như え/に/を) -> Cho 70 - 85 điểm.
               - Khớp hoàn toàn hoặc đồng nghĩa chuẩn xác -> 100 điểm.
            
            Trả về CHỈ một chuỗi JSON thuần (không bọc markdown): 
            { "score": 75, "correct": false, "explanation": "Nhận xét đúng trọng tâm, chỉ ra lỗi chính tả nếu có bằng tiếng Việt." }`,
          },
        ], // Đóng mảng messages
      }); // Đóng data gửi đi

      if (res.data.success && res.data.reply) {
        const cleanJsonString = res.data.reply
          .replace(/```json\n|\n```|```/g, "")
          .trim();
        const updatedFeedbacks = [...feedbacks];
        updatedFeedbacks[quizIdx] = JSON.parse(cleanJsonString);
        setFeedbacks(updatedFeedbacks);
      }
    } catch (error) {
      console.error(`Lỗi chấm câu #${quizIdx + 1}:`, error);
    } finally {
      const finalGrading = [...gradingStates];
      finalGrading[quizIdx] = false;
      setGradingStates(finalGrading);
    }
  };

  if (loadingList)
    return (
      <View style={[styles.centerBox, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.amber} />
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>
          Đang đồng bộ tổng kho ngữ pháp sếp ơi...
        </Text>
      </View>
    );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <Header
        title={
          selectedGrammar ? "Thử Thách 6 Cấu Trúc ⚔️" : "Đại Thư Viện Ngữ Pháp"
        }
      />

      {/* 🛑 TRẠNG THÁI 1: DANH SÁCH MASTER */}
      {!selectedGrammar ? (
        <ScrollView
          contentContainerStyle={styles.scrollBody}
          showsVerticalScrollIndicator={false}
        >
          {allGrammarPoints.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              Hệ thống trống trơn sếp ơi! 📭
            </Text>
          ) : (
            allGrammarPoints.map((item, idx) => (
              <View
                key={item._id || idx}
                style={[
                  styles.grammarMenuCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View style={styles.menuCardHeader}>
                  <View
                    style={[
                      styles.topicTag,
                      { backgroundColor: isDark ? "#1E293B" : "#F1F5F9" },
                    ]}
                  >
                    <Text
                      style={[styles.topicTagText, { color: colors.textMuted }]}
                      numberOfLines={1}
                    >
                      📁 {item.belongingTopic || "Chủ đề chung"}
                    </Text>
                  </View>
                  <Text style={[styles.menuTitle, { color: colors.text }]}>
                    {item.title}
                  </Text>
                </View>

                <View
                  style={[
                    styles.formulaContainer,
                    { backgroundColor: isDark ? "#2C1A10" : "#FFF7ED" },
                  ]}
                >
                  <MaterialIcons
                    name="lightbulb"
                    size={22}
                    color={colors.amber}
                    style={{ marginRight: 8 }}
                  />
                  <Text style={[styles.menuFormula, { color: colors.amber }]}>
                    Cấu trúc: {item.formula || "Chưa có công thức"}
                  </Text>
                </View>

                <View style={styles.infoRowStacked}>
                  <Text style={[styles.infoLabel, { color: colors.text }]}>
                    🎯 Ý nghĩa & Cách dùng:
                  </Text>
                  <Text
                    style={[
                      styles.menuMeaning,
                      { color: isDark ? "#CBD5E1" : "#475569" },
                    ]}
                  >
                    {item.meaning}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[
                    styles.btnActionPractice,
                    { backgroundColor: colors.amber },
                  ]}
                  onPress={() => startPractice(item)}
                >
                  <MaterialIcons name="bolt" size={16} color="#FFF" />
                  <Text style={styles.btnActionPracticeText}>
                    Luyện 6 câu Gõ/Dịch 🚀
                  </Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>
      ) : (
        /* 🛑 TRẠNG THÁI 2: PHÒNG GIẢI ĐỐ ĐÃ GỠ BỎ SCRAMBLE TỐI GIẢN */
        <ScrollView
          contentContainerStyle={styles.scrollBody}
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity
            style={[
              styles.btnBackList,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
            onPress={() => setSelectedGrammar(null)}
          >
            <MaterialIcons
              name="keyboard-arrow-left"
              size={24}
              color={colors.text}
            />
            <Text
              style={{
                color: colors.text,
                fontWeight: "800",
                fontSize: 16,
                marginLeft: 4,
              }}
            >
              Thoát phòng thi
            </Text>
          </TouchableOpacity>

          {loadingQuiz ? (
            <View style={styles.innerLoading}>
              <ActivityIndicator size="large" color={colors.amber} />
              <Text style={[styles.loadingText, { color: colors.textMuted }]}>
                Groq đang lập trình biên soạn 6 câu hỏi Dịch/Gõ thuần túy cho
                sếp...
              </Text>
            </View>
          ) : (
            <View style={{ gap: 24 }}>
              {currentQuizzes.map((quiz, quizIdx) => (
                <View
                  key={quizIdx}
                  style={[
                    styles.quizCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: feedbacks[quizIdx]
                        ? feedbacks[quizIdx]?.correct
                          ? "#10B981"
                          : colors.error
                        : colors.border,
                    },
                  ]}
                >
                  {/* Header thẻ câu hỏi */}
                  <View style={styles.quizCardHeaderRow}>
                    <View
                      style={[
                        styles.indexBadge,
                        { backgroundColor: colors.amber },
                      ]}
                    >
                      <Text style={styles.indexBadgeText}>
                        Câu {quizIdx + 1}/6
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.typeBadge,
                        { backgroundColor: isDark ? "#45230F" : "#FFF7ED" },
                      ]}
                    >
                      <Text
                        style={[styles.typeBadgeText, { color: colors.amber }]}
                      >
                        {quiz.type === "type_jp" && "✍️ VIỆT -> NHẬT"}
                        {quiz.type === "translate_vi" && "🇻🇳 NHẬT -> VIỆT"}
                      </Text>
                    </View>
                  </View>

                  {/* ĐỀ BÀI */}
                  <View style={{ marginBottom: 8 }}>
                    {quiz.question.includes("[") &&
                    quiz.question.includes("]") ? (
                      <FuriganaText
                        text={quiz.question}
                        baseSize={22}
                        color={colors.text}
                      />
                    ) : (
                      <Text
                        style={[styles.questionText, { color: colors.text }]}
                      >
                        {quiz.question}
                      </Text>
                    )}
                  </View>

                  <Text style={[styles.hintText, { color: colors.textMuted }]}>
                    💡 Gợi ý: {quiz.hint}
                  </Text>

                  {/* VÙNG NHẬP LIỆU LÀM BÀI CHỈ CÒN GÕ TEXT CHUYÊN NGHIỆP */}
                  {!feedbacks[quizIdx] && (
                    <View style={{ marginTop: 12 }}>
                      <TextInput
                        style={[
                          styles.inputBox,
                          {
                            backgroundColor: colors.background,
                            borderColor: colors.border,
                            color: colors.text,
                          },
                        ]}
                        value={userAnswers[quizIdx]}
                        onChangeText={(text) => {
                          const updatedAnws = [...userAnswers];
                          updatedAnws[quizIdx] = text;
                          setUserAnswers(updatedAnws);
                        }}
                        placeholder={
                          quiz.type === "type_jp"
                            ? "Gõ câu tiếng Nhật vào đây..."
                            : "Dịch nghĩa tiếng Việt vào đây..."
                        }
                        placeholderTextColor={colors.textMuted}
                        multiline
                      />
                    </View>
                  )}

                  {/* KHỐI HIỂN THỊ PHẢN HỒI CHẤM ĐIỂM */}
                  {feedbacks[quizIdx] && (
                    <View
                      style={[
                        styles.individualFeedbackBox,
                        { backgroundColor: isDark ? "#0F172A" : "#F8FAFC" },
                      ]}
                    >
                      <Text
                        style={[
                          styles.individualScoreText,
                          {
                            color: feedbacks[quizIdx]?.correct
                              ? "#10B981"
                              : "#EF4444",
                          },
                        ]}
                      >
                        💯 Điểm đạt: {feedbacks[quizIdx]?.score}/100 -{" "}
                        {feedbacks[quizIdx]?.correct
                          ? "Chính Xác 🎉"
                          : "Cần lưu ý ❌"}
                      </Text>

                      <View
                        style={[
                          styles.userAnswerWrapper,
                          {
                            backgroundColor: colors.background,
                            borderColor: colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={{
                            fontSize: 14,
                            fontWeight: "800",
                            color: colors.textMuted,
                            marginBottom: 4,
                          }}
                        >
                          ✍️ Bài làm của sếp:
                        </Text>
                        <Text
                          style={{
                            fontSize: 18,
                            fontWeight: "700",
                            color: colors.text,
                          }}
                        >
                          {userAnswers[quizIdx]?.trim() || "(Để trống)"}
                        </Text>
                      </View>

                      <View style={styles.correctFuriWrapper}>
                        <Text
                          style={{
                            fontSize: 14,
                            fontWeight: "800",
                            color: colors.amber,
                            marginBottom: 4,
                          }}
                        >
                          🎯 Đáp án mẫu:
                        </Text>
                        <FuriganaText
                          text={
                            quiz.correctAnswerFurigana || quiz.correctAnswer
                          }
                          baseSize={18}
                          color={colors.amber}
                          furiganaSize={11}
                        />
                      </View>

                      <Text
                        style={[
                          styles.explanationText,
                          { color: colors.textMuted },
                        ]}
                      >
                        📝 Phân tích: {feedbacks[quizIdx]?.explanation}
                      </Text>
                    </View>
                  )}

                  {/* NÚT AI CHẤM ĐIỂM */}
                  {!feedbacks[quizIdx] && (
                    <View style={styles.actionRightWrapper}>
                      <TouchableOpacity
                        style={[
                          styles.btnActionGradeSingle,
                          { backgroundColor: colors.amber },
                        ]}
                        onPress={() => submitIndividualAnswer(quizIdx)}
                        disabled={gradingStates[quizIdx]}
                      >
                        {gradingStates[quizIdx] ? (
                          <ActivityIndicator size="small" color="#FFF" />
                        ) : (
                          <>
                            <MaterialIcons
                              name="analytics"
                              size={16}
                              color="#FFF"
                            />
                            <Text style={styles.btnActionGradeSingleText}>
                              AI Chấm Điểm
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))}

              <View style={styles.continueButtonContainer}>
                <Button
                  title="Tiếp tục làm set câu hỏi mới 🚀"
                  type="amber"
                  onPress={() => startPractice(selectedGrammar!)}
                />
              </View>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  scrollBody: { padding: 16, paddingBottom: 60 },
  innerLoading: { alignItems: "center", paddingTop: 80 },
  loadingText: {
    marginTop: 14,
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  emptyText: {
    textAlign: "center",
    marginTop: 40,
    fontSize: 16,
    fontWeight: "600",
  },

  grammarMenuCard: {
    padding: 20,
    borderRadius: 22,
    borderWidth: 1,
    marginBottom: 16,
  },
  menuCardHeader: { flexDirection: "column-reverse", gap: 6, marginBottom: 14 },
  topicTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  topicTagText: { fontSize: 13, fontWeight: "700" },
  menuTitle: { fontSize: 26, fontWeight: "900", letterSpacing: -0.5 },
  formulaContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 14,
  },
  menuFormula: { fontSize: 18, fontWeight: "800", flex: 1 },
  infoRowStacked: { marginBottom: 14 },
  infoLabel: { fontSize: 16, fontWeight: "800", marginBottom: 6 },
  menuMeaning: { fontSize: 18, lineHeight: 26, fontWeight: "600" },
  btnActionPractice: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 6,
    alignSelf: "flex-end",
    marginTop: 4,
  },
  btnActionPracticeText: { color: "#FFF", fontWeight: "800", fontSize: 14 },

  btnBackList: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    alignSelf: "flex-start",
    marginBottom: 20,
  },
  quizCard: { borderRadius: 24, padding: 20, borderWidth: 2, marginBottom: 4 },
  quizCardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  indexBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  indexBadgeText: { color: "#FFF", fontWeight: "900", fontSize: 13 },
  typeBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8 },
  typeBadgeText: { fontSize: 12, fontWeight: "900" },
  questionText: {
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 32,
    marginBottom: 8,
  },
  hintText: {
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 24,
    marginBottom: 4,
  },

  // Input Box xịn sò
  inputBox: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    fontSize: 18,
    fontWeight: "600",
    minHeight: 110,
    marginTop: 10,
  },

  furiganaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-end",
  },
  rubyContainer: {
    alignItems: "center",
    justifyContent: "flex-end",
    paddingHorizontal: 1,
  },
  rubyText: { fontWeight: "700", marginBottom: 1, textAlign: "center" },
  baseText: { fontWeight: "900" },
  plainText: { fontWeight: "700", paddingBottom: 1 },

  actionRightWrapper: { width: "100%", alignItems: "flex-end", marginTop: 18 },
  btnActionGradeSingle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 10,
    gap: 6,
  },
  btnActionGradeSingleText: { color: "#FFF", fontWeight: "900", fontSize: 14 },

  individualFeedbackBox: {
    padding: 16,
    borderRadius: 16,
    marginTop: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  individualScoreText: { fontSize: 17, fontWeight: "900" },
  userAnswerWrapper: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 6,
  },
  correctFuriWrapper: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FDE68A",
    backgroundColor: "rgba(253, 230, 138, 0.1)",
    marginVertical: 4,
  },
  explanationText: { fontSize: 15, lineHeight: 22, fontWeight: "600" },

  continueButtonContainer: { marginTop: 16, marginBottom: 30, width: "100%" },
});
