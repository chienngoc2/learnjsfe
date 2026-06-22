// File: app/luyen-tap/grammar.tsx

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
  Dimensions,
} from "react-native";
import { useRouter, Stack, useLocalSearchParams } from "expo-router";
import { MaterialIcons, Ionicons, Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Speech from "expo-speech";
import api from "../../services/api";
import { useTheme } from "@/src/context/ThemeContext";
import { useCultivationStore } from "../../store/useCultivationStore";

// IMPORT CÁC COMPONENT UI DÙNG CHUNG CỦA SẾP
import Button from "../../components/ui/Button";
import Header from "../../components/ui/Header";

const { width } = Dimensions.get("window");

interface GrammarPoint {
  _id: string;
  title: string;
  formula: string;
  meaning: string;
  examples: string[];
  belongingTopic?: string;
}

interface MatchCard {
  id: string;
  type: "jp" | "vn";
  text: string;
  pairId: number;
  matched: boolean;
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
  const params = useLocalSearchParams<{ title?: string; topicTitle?: string; mode?: string }>();
  const { addTuVi, addXP } = useCultivationStore();

  const [allGrammarPoints, setAllGrammarPoints] = useState<GrammarPoint[]>([]);
  const [selectedGrammar, setSelectedGrammar] = useState<GrammarPoint | null>(
    null,
  );
  const [loadingList, setLoadingList] = useState(true);
  const [loadingQuiz, setLoadingQuiz] = useState(false);

  // Chế độ luyện tập: choose (chọn chế độ), ai_translation (6 câu AI dịch/gõ), match (game ghép câu)
  const [practiceMode, setPracticeMode] = useState<"choose" | "ai_translation" | "match">("choose");

  // States cho Game Ghép Câu
  const [cardsJp, setCardsJp] = useState<MatchCard[]>([]);
  const [cardsVn, setCardsVn] = useState<MatchCard[]>([]);
  const [selectedCard, setSelectedCard] = useState<MatchCard | null>(null);
  const [errorIds, setErrorIds] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [moves, setMoves] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [totalPairs, setTotalPairs] = useState(0);

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

  const parseExample = (exampleStr: string) => {
    if (!exampleStr) return { jp: "", vn: "" };
    const colonIndex = exampleStr.indexOf(":");
    if (colonIndex === -1) {
      return { jp: exampleStr.trim(), vn: "" };
    }
    const jp = exampleStr.substring(0, colonIndex).trim();
    const vn = exampleStr.substring(colonIndex + 1).trim();
    return { jp, vn };
  };

  const speak = (text: string) => {
    const cleanText = text.replace(/\[.*?\]/g, "");
    Speech.speak(cleanText, { language: "ja-JP", rate: 0.85 });
  };

  const startPractice = (grammar: GrammarPoint) => {
    setSelectedGrammar(grammar);
    setPracticeMode("choose");
  };

  const startAiPractice = async (grammar: GrammarPoint) => {
    setSelectedGrammar(grammar);
    setPracticeMode("ai_translation");
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

  const startMatchPractice = (grammar: GrammarPoint) => {
    setSelectedGrammar(grammar);
    setPracticeMode("match");
    setIsFinished(false);
    setScore(0);
    setMoves(0);
    setSelectedCard(null);
    setErrorIds([]);

    const parsedPairs = (grammar.examples || [])
      .map((ex, idx) => {
        const { jp, vn } = parseExample(ex);
        return { jp, vn, pairId: idx };
      })
      .filter((p) => p.jp !== "" && p.vn !== "");

    if (parsedPairs.length === 0) {
      alert("Ngữ pháp này chưa có câu ví dụ để ghép sếp ơi!");
      setPracticeMode("choose");
      return;
    }

    // Pick max 5 random pairs
    const selectedPairs = parsedPairs.sort(() => Math.random() - 0.5).slice(0, 5);
    setTotalPairs(selectedPairs.length);

    const jpCards: MatchCard[] = selectedPairs.map((pair) => ({
      id: `jp-${pair.pairId}`,
      type: "jp",
      text: pair.jp,
      pairId: pair.pairId,
      matched: false,
    }));

    const vnCards: MatchCard[] = selectedPairs.map((pair) => ({
      id: `vn-${pair.pairId}`,
      type: "vn",
      text: pair.vn,
      pairId: pair.pairId,
      matched: false,
    }));

    setCardsJp(jpCards.sort(() => Math.random() - 0.5));
    setCardsVn(vnCards.sort(() => Math.random() - 0.5));
  };

  const handleCardClick = (card: MatchCard) => {
    if (card.matched || errorIds.length > 0) return;

    if (selectedCard?.id === card.id) {
      setSelectedCard(null);
      return;
    }

    if (!selectedCard) {
      setSelectedCard(card);
      return;
    }

    if (selectedCard.type === card.type) {
      setSelectedCard(card);
      return;
    }

    const c1 = selectedCard;
    const c2 = card;
    setMoves((prev) => prev + 1);

    if (c1.pairId === c2.pairId) {
      // SUCCESS MATCH!
      setCardsJp((prev) =>
        prev.map((c) => (c.id === c1.id || c.id === c2.id) ? { ...c, matched: true } : c)
      );
      setCardsVn((prev) =>
        prev.map((c) => (c.id === c1.id || c.id === c2.id) ? { ...c, matched: true } : c)
      );
      setSelectedCard(null);

      const jpText = c1.type === "jp" ? c1.text : c2.text;
      speak(jpText);

      setScore((s) => {
        const next = s + 1;
        if (next >= totalPairs) {
          // Finished Game
          const rewardTuViAmount = next * 5;
          const rewardXPAmount = next * 10;
          try {
            addTuVi(rewardTuViAmount);
            addXP(rewardXPAmount);
          } catch (e) {
            console.log("Error adding rewards:", e);
          }
          setIsFinished(true);
        }
        return next;
      });
    } else {
      // MISMATCH ERROR!
      setErrorIds([c1.id, c2.id]);
      setTimeout(() => {
        setErrorIds([]);
        setSelectedCard(null);
      }, 800);
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
              if (params.mode === "match") {
                startMatchPractice(matched);
              } else if (params.mode === "ai_translation") {
                startAiPractice(matched);
              } else {
                startPractice(matched);
              }
            }
          }
        }
      })
      .catch((err) => console.error("❌ Lỗi gọi API:", err))
      .finally(() => setLoadingList(false));
  }, [params.title, params.topicTitle, params.mode]);


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
          !selectedGrammar
            ? "Đại Thư Viện Ngữ Pháp"
            : practiceMode === "choose"
            ? "Lựa chọn Luyện tập"
            : practiceMode === "match"
            ? "Game Ghép Câu Ngữ Pháp"
            : "Thử Thách 6 Cấu Trúc ⚔️"
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
                    Bắt đầu Luyện tập 🚀
                  </Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>
      ) : practiceMode === "choose" ? (
        /* 🛑 TRẠNG THÁI 2: LỰA CHỌN CHẾ ĐỘ LUYỆN TẬP */
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
              Quay lại danh sách
            </Text>
          </TouchableOpacity>

          {/* Grammar Info Card */}
          <View
            style={[
              styles.grammarMenuCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                marginBottom: 24,
              },
            ]}
          >
            <Text style={[styles.menuTitle, { color: colors.text, fontSize: 22 }]}>
              {selectedGrammar.title}
            </Text>
            <View
              style={[
                styles.formulaContainer,
                { backgroundColor: isDark ? "#2C1A10" : "#FFF7ED", marginTop: 10 },
              ]}
            >
              <MaterialIcons
                name="lightbulb"
                size={20}
                color={colors.amber}
                style={{ marginRight: 8 }}
              />
              <Text style={[styles.menuFormula, { color: colors.amber, fontSize: 16 }]}>
                Cấu trúc: {selectedGrammar.formula || "Chưa có công thức"}
              </Text>
            </View>
            <Text style={[styles.menuMeaning, { color: colors.textMuted, fontSize: 15, marginTop: 10 }]}>
              Ý nghĩa: {selectedGrammar.meaning}
            </Text>
          </View>

          <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text, marginBottom: 16, letterSpacing: -0.5 }}>
            CHỌN CHẾ ĐỘ LUYỆN TẬP:
          </Text>

          {/* AI Quiz Mode Option Card */}
          <TouchableOpacity
            style={[
              styles.choiceCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
            onPress={() => startAiPractice(selectedGrammar)}
          >
            <LinearGradient
              colors={isDark ? ["#2C1A10", "#1E293B"] : ["#FFF7ED", "#FFFFFF"]}
              style={styles.choiceCardGradient}
            >
              <View style={styles.choiceHeaderRow}>
                <View style={[styles.choiceIconBg, { backgroundColor: "rgba(245, 158, 11, 0.15)" }]}>
                  <MaterialIcons name="bolt" size={28} color={colors.amber} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.choiceTitle, { color: colors.text }]}>
                    Luyện dịch AI ⚔️
                  </Text>
                  <Text style={[styles.choiceSub, { color: colors.textMuted }]}>
                    Dịch/Gõ 6 câu Việt-Nhật & Nhật-Việt
                  </Text>
                </View>
              </View>
              <Text style={[styles.choiceDesc, { color: colors.textMuted }]}>
                Thử thách dịch thuật 6 câu được tạo ngẫu nhiên, chấm điểm và nhận xét chi tiết bằng AI của hệ thống.
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Match Game Mode Option Card */}
          <TouchableOpacity
            style={[
              styles.choiceCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                marginTop: 16,
              },
            ]}
            onPress={() => startMatchPractice(selectedGrammar)}
          >
            <LinearGradient
              colors={isDark ? ["#1E1B4B", "#1E293B"] : ["#EEF2FF", "#FFFFFF"]}
              style={styles.choiceCardGradient}
            >
              <View style={styles.choiceHeaderRow}>
                <View style={[styles.choiceIconBg, { backgroundColor: "rgba(99, 102, 241, 0.15)" }]}>
                  <MaterialIcons name="videogame-asset" size={28} color={colors.indigo} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.choiceTitle, { color: colors.text }]}>
                    Game Ghép Câu 🎮
                  </Text>
                  <Text style={[styles.choiceSub, { color: colors.textMuted }]}>
                    Nối câu tiếng Nhật với bản dịch tiếng Việt
                  </Text>
                </View>
              </View>
              <Text style={[styles.choiceDesc, { color: colors.textMuted }]}>
                Phá trận đồ bằng cách nối câu ví dụ của cấu trúc ngữ pháp này với nghĩa tiếng Việt tương ứng.
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      ) : practiceMode === "match" ? (
        /* 🛑 TRẠNG THÁI 3: GAME GHÉP CÂU SONG SONG */
        <ScrollView
          contentContainerStyle={styles.scrollBody}
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity
            style={[
              styles.btnBackList,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
            onPress={() => setPracticeMode("choose")}
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
              Quay lại lựa chọn
            </Text>
          </TouchableOpacity>

          {!isFinished ? (
            <View style={{ width: "100%" }}>
              {/* Score Bento Box */}
              <View
                style={[
                  styles.resultBentoBox,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    marginBottom: 20,
                  },
                ]}
              >
                <View style={styles.resultBentoItem}>
                  <Text style={[styles.bentoBLabel, { color: colors.textMuted }]}>ĐÃ GHÉP</Text>
                  <Text style={[styles.bentoBVal, { color: colors.amber }]}>
                    {score} <Text style={{ fontSize: 16, color: colors.textMuted }}>/</Text> {totalPairs}
                  </Text>
                </View>

                <View style={[styles.resultBentoDivider, { backgroundColor: colors.border }]} />

                <View style={styles.resultBentoItem}>
                  <Text style={[styles.bentoBLabel, { color: colors.textMuted }]}>LƯỢT ĐI (MOVES)</Text>
                  <Text style={[styles.bentoBVal, { color: colors.indigo }]}>{moves}</Text>
                </View>
              </View>

              {/* Side-by-side Columns Row */}
              <View style={styles.matchGameColumnsRow}>
                {/* Left Column: Japanese Cards */}
                <View style={styles.matchGameColumn}>
                  <Text style={[styles.columnHeader, { color: colors.amber }]}>TIẾNG NHẬT</Text>
                  {cardsJp.map((c) => {
                    const isSelected = selectedCard?.id === c.id;
                    const isError = errorIds.includes(c.id);

                    let cardBg = colors.surface;
                    let cardBorder = colors.border;
                    let cardText = colors.text;

                    if (c.matched) {
                      return <View key={c.id} style={[styles.matchColCard, { opacity: 0 }]} />;
                    }

                    if (isSelected) {
                      cardBg = isDark ? "#2C1A10" : "#FFF7ED";
                      cardBorder = colors.amber;
                      cardText = colors.amber;
                    } else if (isError) {
                      cardBg = "rgba(239, 68, 68, 0.15)";
                      cardBorder = "#ef4444";
                      cardText = "#ef4444";
                    }

                    return (
                      <TouchableOpacity
                        key={c.id}
                        onPress={() => handleCardClick(c)}
                        style={[
                          styles.matchColCard,
                          {
                            backgroundColor: cardBg,
                            borderColor: cardBorder,
                          },
                        ]}
                      >
                        {c.text.includes("[") && c.text.includes("]") ? (
                          <FuriganaText
                            text={c.text}
                            baseSize={14}
                            color={cardText}
                            furiganaSize={10}
                          />
                        ) : (
                          <Text style={[styles.matchCardText, { color: cardText }]}>
                            {c.text}
                          </Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Right Column: Vietnamese Cards */}
                <View style={styles.matchGameColumn}>
                  <Text style={[styles.columnHeader, { color: colors.indigo }]}>BẢN DỊCH VIỆT</Text>
                  {cardsVn.map((c) => {
                    const isSelected = selectedCard?.id === c.id;
                    const isError = errorIds.includes(c.id);

                    let cardBg = colors.surface;
                    let cardBorder = colors.border;
                    let cardText = colors.text;

                    if (c.matched) {
                      return <View key={c.id} style={[styles.matchColCard, { opacity: 0 }]} />;
                    }

                    if (isSelected) {
                      cardBg = colors.indigoLight;
                      cardBorder = colors.indigo;
                      cardText = colors.indigo;
                    } else if (isError) {
                      cardBg = "rgba(239, 68, 68, 0.15)";
                      cardBorder = "#ef4444";
                      cardText = "#ef4444";
                    }

                    return (
                      <TouchableOpacity
                        key={c.id}
                        onPress={() => handleCardClick(c)}
                        style={[
                          styles.matchColCard,
                          {
                            backgroundColor: cardBg,
                            borderColor: cardBorder,
                          },
                        ]}
                      >
                        <Text style={[styles.matchCardText, { color: cardText, fontSize: 13 }]}>
                          {c.text}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>
          ) : (
            /* Results phase */
            <View style={[styles.centerBox, { paddingHorizontal: 24, paddingVertical: 40 }]}>
              <View style={[styles.emblemIconCircle, { backgroundColor: colors.indigoLight }]}>
                <Ionicons name="sparkles-outline" size={50} color={colors.indigo} />
              </View>

              <Text style={[styles.resultTitle, { color: colors.text }]}>GHÉP CÂU HOÀN THÀNH</Text>
              <Text style={[styles.resultSubtitle, { color: colors.textMuted }]}>
                Chúc mừng sếp đã ghép chuẩn toàn bộ ví dụ cấu trúc ngữ pháp!
              </Text>

              <View style={[styles.resultBentoBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.resultBentoItem}>
                  <Text style={[styles.bentoBLabel, { color: colors.textMuted }]}>SỐ LƯỢT GHÉP</Text>
                  <Text style={[styles.bentoBVal, { color: colors.indigo }]}>{moves}</Text>
                </View>

                <View style={[styles.resultBentoDivider, { backgroundColor: colors.border }]} />

                <View style={styles.resultBentoItem}>
                  <Text style={[styles.bentoBLabel, { color: colors.textMuted }]}>CẶP CÂU VÍ DỤ</Text>
                  <Text style={[styles.bentoBVal, { color: colors.indigo }]}>{totalPairs}</Text>
                </View>
              </View>

              <View style={[styles.rewardCard, { backgroundColor: colors.surface, borderColor: colors.indigo }]}>
                <Ionicons name="flash" size={18} color={colors.indigo} style={{ marginRight: 8 }} />
                <Text style={[styles.rewardCardText, { color: colors.text }]}>
                  Thu hoạch linh khí: <Text style={{ color: colors.indigo, fontWeight: "900" }}>+{totalPairs * 5}</Text> Tu Vi pháp lực!
                </Text>
              </View>

              <View style={styles.resultActions}>
                <TouchableOpacity
                  onPress={() => startMatchPractice(selectedGrammar)}
                  style={[
                    styles.btnResultAction,
                    {
                      backgroundColor: colors.indigo,
                    },
                  ]}
                >
                  <Text style={[styles.btnResultText, { color: "#FFF" }]}>THỬ THÁCH LẠI</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setPracticeMode("choose")}
                  style={[
                    styles.btnResultActionSecondary,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      marginTop: 12,
                    },
                  ]}
                >
                  <Text style={[styles.btnResultTextSecondary, { color: colors.text }]}>CHỌN CHẾ ĐỘ KHÁC</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
      ) : (
        /* 🛑 TRẠNG THÁI 4: PHÒNG GIẢI ĐỐ ĐÃ GỠ BỎ SCRAMBLE TỐI GIẢN */
        <ScrollView
          contentContainerStyle={styles.scrollBody}
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity
            style={[
              styles.btnBackList,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
            onPress={() => setPracticeMode("choose")}
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
              Quay lại lựa chọn
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
                  onPress={() => startAiPractice(selectedGrammar!)}
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

  // Chế độ lựa chọn & Game Ghép câu mới
  choiceCard: {
    borderRadius: 22,
    borderWidth: 1,
    overflow: "hidden",
  },
  choiceCardGradient: {
    padding: 20,
  },
  choiceHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  choiceIconBg: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  choiceTitle: {
    fontSize: 20,
    fontWeight: "900",
  },
  choiceSub: {
    fontSize: 13,
    fontWeight: "700",
    marginTop: 2,
  },
  choiceDesc: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },

  // Game Ghép câu
  matchGameColumnsRow: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    width: "100%",
    marginTop: 10,
  },
  matchGameColumn: {
    flex: 1,
    gap: 12,
  },
  columnHeader: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
    marginBottom: 4,
    textAlign: "center",
  },
  matchColCard: {
    width: "100%",
    minHeight: 90,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    padding: 10,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  matchCardText: {
    fontWeight: "800",
    textAlign: "center",
    fontSize: 14,
    lineHeight: 18,
  },

  // Màn hình kết quả game
  emblemIconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    alignSelf: "center",
  },
  resultTitle: {
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 1,
    textAlign: "center",
  },
  resultSubtitle: {
    fontSize: 13,
    fontWeight: "600",
    marginTop: 6,
    textAlign: "center",
    marginBottom: 30,
  },
  resultBentoBox: {
    width: "100%",
    borderRadius: 24,
    borderWidth: 1.5,
    flexDirection: "row",
    paddingVertical: 20,
  },
  resultBentoItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  resultBentoDivider: {
    width: 1.5,
    height: "100%",
  },
  bentoBLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 4,
  },
  bentoBVal: {
    fontSize: 24,
    fontWeight: "900",
  },
  rewardCard: {
    width: "100%",
    borderRadius: 20,
    borderWidth: 1.5,
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    marginTop: 20,
    marginBottom: 30,
  },
  rewardCardText: {
    fontSize: 13,
    fontWeight: "700",
    flex: 1,
  },
  resultActions: {
    width: "100%",
    gap: 12,
    marginTop: 10,
  },
  btnResultAction: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  btnResultText: {
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  btnResultActionSecondary: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  btnResultTextSecondary: {
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
});
