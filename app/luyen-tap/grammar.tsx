// File: app/luyen-tap/grammar.tsx

import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  Dimensions,
  SafeAreaView,
} from "react-native";
import { useRouter, Stack, useLocalSearchParams } from "expo-router";
import { MaterialIcons, Ionicons, Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Speech from "expo-speech";
import api from "../../services/api";
import { useTheme } from "@/src/context/ThemeContext";
import { useCultivationStore } from "../../store/useCultivationStore";

const { width } = Dimensions.get("window");

interface GrammarPoint {
  _id: string;
  title: string;
  formula: string;
  meaning: string;
  examples: string[];
}

interface TopicList {
  _id: string;
  title: string;
  grammarPoints: GrammarPoint[];
}

interface MatchCard {
  id: string;
  type: "jp" | "vn";
  text: string;
  pairId: number;
  matched: boolean;
}

// Sub-component hiển thị Furigana
function FuriganaText({
  text,
  baseSize = 14,
  furiganaSize = 10,
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

const parseExample = (exampleStr: any) => {
  if (!exampleStr) return { jp: "", vn: "" };
  if (typeof exampleStr === "object") {
    return { jp: exampleStr.jp || "", vn: exampleStr.vn || "" };
  }
  let colonIndex = exampleStr.indexOf(":");
  if (colonIndex === -1) {
    colonIndex = exampleStr.indexOf("：");
  }
  if (colonIndex === -1) {
    return { jp: exampleStr.trim(), vn: "" };
  }
  const jp = exampleStr.substring(0, colonIndex).trim();
  const vn = exampleStr.substring(colonIndex + 1).trim();
  return { jp, vn };
};

const getFontSizeForText = (text: string, type: "jp" | "vn") => {
  const len = text.length;
  if (type === "jp") {
    if (len > 35) return 14;
    if (len > 22) return 15;
    return 16;
  } else {
    if (len > 45) return 13;
    if (len > 28) return 14;
    return 15;
  }
};

export default function PracticeGrammarScreen() {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ topicId?: string; listId?: string; topicTitle?: string; title?: string }>();
  const { addTuVi, addXP } = useCultivationStore();

  const [topics, setTopics] = useState<TopicList[]>([]);
  const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const PAGE_SIZE = 10;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Active game states
  const [isPlaying, setIsPlaying] = useState(false);
  const [cardsJp, setCardsJp] = useState<MatchCard[]>([]);
  const [cardsVn, setCardsVn] = useState<MatchCard[]>([]);
  const [selectedCard, setSelectedCard] = useState<MatchCard | null>(null);
  const [errorIds, setErrorIds] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [moves, setMoves] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [totalPairs, setTotalPairs] = useState(0);

  // Fetch topics and grammar points together, then map them
  useEffect(() => {
    setLoading(true);
    const fetchLists = api.get("/api/vocab/lists");
    const fetchGrammars = api.get("/api/vocab/all-grammar-points").catch(() => ({ data: { success: false, data: [] } }));

    Promise.all([fetchLists, fetchGrammars])
      .then(([listsRes, grammarsRes]) => {
        if (listsRes.data.success && listsRes.data.data) {
          const lists = listsRes.data.data;
          const grammars = (grammarsRes.data.success && grammarsRes.data.data) ? grammarsRes.data.data : [];

          // Map grammar points to their respective lists
          const listsWithGrammar = lists.map((list: any) => {
            const gps = grammars.filter((g: any) => g.topicId && g.topicId.toString() === list._id.toString());
            return {
              ...list,
              grammarPoints: gps
            };
          }).filter((list: any) => list.grammarPoints && list.grammarPoints.length > 0);

          setTopics(listsWithGrammar);

          // Auto-select topic
          const targetId = params.topicId || params.listId;
          const targetTitle = params.topicTitle || params.title;
          
          let preSelectedId: string | null = null;
          if (targetId) {
            const matched = listsWithGrammar.find((l: any) => l._id.toString() === targetId.toString());
            if (matched) preSelectedId = matched._id;
          } else if (targetTitle) {
            const matched = listsWithGrammar.find((l: any) => 
              l.title.toLowerCase().includes(targetTitle.toLowerCase())
            );
            if (matched) preSelectedId = matched._id;
          }

          if (preSelectedId) {
            setSelectedTopicIds([preSelectedId]);
          } else if (listsWithGrammar.length > 0) {
            setSelectedTopicIds([listsWithGrammar[0]._id]);
          }
        }
      })
      .catch((err) => console.error("Lỗi lấy danh sách chủ đề:", err))
      .finally(() => {
        setLoading(false);
        setVisibleCount(PAGE_SIZE);
      });
  }, [params.topicId, params.listId, params.topicTitle, params.title]);

  // Handle auto-start game if redirected from other screens
  useEffect(() => {
    if (topics.length > 0 && selectedTopicIds.length > 0 && !isPlaying) {
      const hasParam = params.topicId || params.listId || params.topicTitle || params.title;
      if (hasParam) {
        const selectedDecks = topics.filter((t) => selectedTopicIds.includes(t._id));
        if (selectedDecks.length > 0) {
          startMatchGame(selectedDecks);
        }
      }
    }
  }, [topics, selectedTopicIds]);

  const toggleTopicSelection = (id: string) => {
    setSelectedTopicIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const speak = (text: string) => {
    const cleanText = text.replace(/\[.*?\]/g, "");
    Speech.speak(cleanText, { language: "ja-JP", rate: 0.85 });
  };

  const stopSpeaking = async () => {
    try {
      await Speech.stop();
    } catch (e) {
      console.log("Error stopping speech:", e);
    }
  };

  const startMatchGame = (selectedDecks: TopicList[]) => {
    const allPairs: { vn: string; meaning: string }[] = [];
    
    selectedDecks.forEach((deck) => {
      if (deck.grammarPoints && deck.grammarPoints.length > 0) {
        deck.grammarPoints.forEach((gp) => {
          if (gp.examples && gp.examples.length > 0 && gp.meaning) {
            gp.examples.forEach((ex) => {
              const { vn } = parseExample(ex);
              if (vn !== "") {
                allPairs.push({ vn, meaning: gp.meaning });
              }
            });
          }
        });
      }
    });

    if (allPairs.length === 0) {
      alert("Các chủ đề được chọn chưa có câu ví dụ để ghép bạn nhé!");
      return;
    }

    // Shuffle and pick unique meanings to avoid ambiguity
    const uniqueMeaningPairs: { vn: string; meaning: string }[] = [];
    const seenMeanings = new Set<string>();
    
    const shuffledPairs = allPairs.sort(() => Math.random() - 0.5);
    
    for (const pair of shuffledPairs) {
      if (!seenMeanings.has(pair.meaning)) {
        seenMeanings.add(pair.meaning);
        uniqueMeaningPairs.push(pair);
        if (uniqueMeaningPairs.length >= 5) break;
      }
    }

    const selectedPairs = uniqueMeaningPairs;
    setTotalPairs(selectedPairs.length);

    const jpCards: MatchCard[] = selectedPairs.map((pair, idx) => ({
      id: `jp-${idx}`,
      type: "jp",
      text: pair.meaning,
      pairId: idx,
      matched: false,
    }));

    const vnCards: MatchCard[] = selectedPairs.map((pair, idx) => ({
      id: `vn-${idx}`,
      type: "vn",
      text: pair.vn,
      pairId: idx,
      matched: false,
    }));

    setCardsJp(jpCards.sort(() => Math.random() - 0.5));
    setCardsVn(vnCards.sort(() => Math.random() - 0.5));
    setSelectedCard(null);
    setErrorIds([]);
    setScore(0);
    setMoves(0);
    setIsFinished(false);
    setIsPlaying(true);
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

  const handleStartButtonPress = () => {
    if (selectedTopicIds.length === 0) return;
    const selectedDecks = topics.filter((t) => selectedTopicIds.includes(t._id));
    startMatchGame(selectedDecks);
  };

  const bgColors: readonly [string, string, ...string[]] = isDark 
    ? ["#050814", "#0a0e1c"] 
    : ["#f5edd6", "#fcf8ed"];

  if (loading) {
    return (
      <View style={[styles.centerBox, { backgroundColor: bgColors[0] }]}>
        <ActivityIndicator size="large" color={colors.indigo} />
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>
          Đang chuẩn bị câu hỏi ghép ngữ pháp...
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: bgColors[0] }]}>
      <LinearGradient colors={bgColors} style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />

        {/* 1. CONFIGURATION PHASE */}
        {!isPlaying && (
          <View style={{ flex: 1 }}>
            <View style={styles.header}>
              <TouchableOpacity
                onPress={() => router.back()}
                style={[
                  styles.btnIconHeader,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <Feather name="chevron-left" size={20} color={colors.text} />
              </TouchableOpacity>
              <View style={styles.headerTitleWrap}>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Game Ghép Ngữ Pháp</Text>
                <Text style={[styles.headerSub, { color: colors.textMuted }]}>CẤU HÌNH THỬ THÁCH</Text>
              </View>
              <View style={{ width: 42 }} />
            </View>

            <ScrollView
              style={{ flex: 1, paddingHorizontal: 20 }}
              contentContainerStyle={{ paddingBottom: 40 }}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.sectionContainer}>
                <Text style={[styles.sectionHeading, { color: colors.indigo }]}>CHỌN CHỦ ĐỀ LUYỆN TẬP</Text>
                
                {topics.length === 0 ? (
                  <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                    Chưa có bài học chứa cấu trúc ngữ pháp nào bạn nhé! 📭
                  </Text>
                ) : (
                  <View style={styles.listGrid}>
                    {topics.slice(0, visibleCount).map((topic) => {
                      const isSelected = selectedTopicIds.includes(topic._id);
                      return (
                        <TouchableOpacity
                          key={topic._id}
                          onPress={() => toggleTopicSelection(topic._id)}
                          style={[
                            styles.listCardItem,
                            {
                              backgroundColor: isSelected ? colors.indigoLight : colors.surface,
                              borderColor: isSelected ? colors.indigo : colors.border,
                            },
                          ]}
                        >
                          <View style={styles.listCardLeft}>
                            <Ionicons
                              name={isSelected ? "checkbox" : "square-outline"}
                              size={20}
                              color={isSelected ? colors.indigo : colors.textMuted}
                              style={{ marginRight: 10 }}
                            />
                            <View style={{ flex: 1 }}>
                              <Text
                                style={[
                                  styles.listCardTitle,
                                  { color: colors.text },
                                  isSelected && { color: colors.indigo },
                                ]}
                                numberOfLines={1}
                              >
                                {topic.title}
                              </Text>
                              <Text style={[styles.listCardCount, { color: colors.textMuted }]}>
                                {topic.grammarPoints ? topic.grammarPoints.length : 0} cấu trúc ngữ pháp
                              </Text>
                            </View>
                          </View>
                        </TouchableOpacity>
                      );
                    })}

                    {visibleCount < topics.length && (
                      <TouchableOpacity
                        style={[
                          styles.loadMoreBtn,
                          { backgroundColor: colors.surface, borderColor: colors.border },
                        ]}
                        onPress={() => setVisibleCount((c) => c + PAGE_SIZE)}
                        activeOpacity={0.75}
                      >
                        <Text style={[styles.loadMoreText, { color: colors.indigo }]}>
                          Xem thêm ({topics.length - visibleCount} chủ đề còn lại)
                        </Text>
                        <Feather name="chevron-down" size={20} color={colors.indigo} />
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>

              <TouchableOpacity
                onPress={handleStartButtonPress}
                disabled={selectedTopicIds.length === 0}
                style={[
                  styles.btnStart,
                  {
                    backgroundColor: "#000000",
                    borderColor: "#8C5C38",
                    borderWidth: 2,
                    opacity: selectedTopicIds.length === 0 ? 0.5 : 1,
                  },
                ]}
              >
                <Text style={[styles.btnStartText, { color: colors.indigo }]}>BẮT ĐẦU LUYỆN TẬP 🎮</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        )}

        {/* 2. PLAYING PHASE */}
        {isPlaying && !isFinished && (
          <View style={{ flex: 1 }}>
            {/* Playing Header */}
            <View style={styles.header}>
              <TouchableOpacity
                onPress={() => {
                  stopSpeaking();
                  setIsPlaying(false);
                }}
                style={[
                  styles.btnIconHeader,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <Feather name="x" size={20} color={colors.text} />
              </TouchableOpacity>
              <View style={styles.headerTitleWrap}>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Luyện Ghép Ngữ Pháp</Text>
                <Text style={[styles.headerSub, { color: colors.textMuted }]}>
                  ĐÃ GHÉP: {score} <Text style={{ color: colors.textMuted }}>/</Text> {totalPairs} | LƯỢT ĐI: {moves}
                </Text>
              </View>
              
              {/* Sticky Stop voice button right on the header */}
              <TouchableOpacity
                onPress={stopSpeaking}
                style={[
                  styles.btnIconHeader,
                  { backgroundColor: isDark ? "#2A1414" : "#FEF2F2", borderColor: isDark ? "#451A1A" : "#FEE2E2" },
                ]}
              >
                <Ionicons name="volume-mute" size={18} color="#EF4444" />
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={styles.scrollBody}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.matchGameColumnsRow}>
                {/* Left Column: Grammar Meaning Cards */}
                <View style={styles.matchGameColumn}>
                  <Text style={[styles.columnHeader, { color: colors.amber }]}>Ý NGHĨA NGỮ PHÁP</Text>
                  {cardsJp.map((c) => {
                    const isSelected = selectedCard?.id === c.id;
                    const isError = errorIds.includes(c.id);

                    let cardBg = "#000000";
                    let cardBorder = "#8C5C38";
                    let cardText = "#F7E5C4";

                    if (c.matched) {
                      return <View key={c.id} style={[styles.matchColCard, { opacity: 0 }]} />;
                    }

                    if (isSelected) {
                      cardBg = "#2C1A10";
                      cardBorder = "#CFAC62";
                      cardText = "#CFAC62";
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
                            baseSize={getFontSizeForText(c.text, "jp")}
                            color={cardText}
                            furiganaSize={Math.max(8, getFontSizeForText(c.text, "jp") - 3)}
                          />
                        ) : (
                          <Text style={[styles.matchCardText, { color: cardText, fontSize: getFontSizeForText(c.text, "jp") }]}>
                            {c.text}
                          </Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Right Column: Vietnamese Example Cards */}
                <View style={styles.matchGameColumn}>
                  <Text style={[styles.columnHeader, { color: colors.indigo }]}>VÍ DỤ TIẾNG VIỆT</Text>
                  {cardsVn.map((c) => {
                    const isSelected = selectedCard?.id === c.id;
                    const isError = errorIds.includes(c.id);

                    let cardBg = "#000000";
                    let cardBorder = "#8C5C38";
                    let cardText = "#F7E5C4";

                    if (c.matched) {
                      return <View key={c.id} style={[styles.matchColCard, { opacity: 0 }]} />;
                    }

                    if (isSelected) {
                      cardBg = "#2C1A10";
                      cardBorder = "#CFAC62";
                      cardText = "#CFAC62";
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
                        <Text style={[styles.matchCardText, { color: cardText, fontSize: getFontSizeForText(c.text, "vn") }]}>
                          {c.text}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </ScrollView>
          </View>
        )}

        {/* 3. RESULTS PHASE */}
        {isPlaying && isFinished && (
          <View style={[styles.centerBox, { paddingHorizontal: 24, justifyContent: "center" }]}>
            <View style={[styles.emblemIconCircle, { backgroundColor: colors.indigoLight }]}>
              <Ionicons name="sparkles-outline" size={50} color={colors.indigo} />
            </View>

            <Text style={[styles.resultTitle, { color: colors.text }]}>BÀI TẬP HOÀN THÀNH</Text>
            <Text style={[styles.resultSubtitle, { color: colors.textMuted }]}>
              Chúc mừng bạn đã ghép chính xác toàn bộ câu ví dụ ngữ pháp!
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
              <Ionicons name="sparkles" size={18} color={colors.indigo} style={{ marginRight: 8 }} />
              <Text style={[styles.rewardCardText, { color: colors.text }]}>
                Điểm tích lũy: <Text style={{ color: colors.indigo, fontWeight: "900" }}>+{totalPairs * 10}</Text> XP và +{totalPairs * 5} Điểm kinh nghiệm!
              </Text>
            </View>

            <View style={styles.resultActions}>
              <TouchableOpacity
                onPress={() => {
                  const selectedDecks = topics.filter((t) => selectedTopicIds.includes(t._id));
                  startMatchGame(selectedDecks);
                }}
                style={[
                  styles.btnResultAction,
                  {
                    backgroundColor: "#000000",
                    borderColor: "#8C5C38",
                    borderWidth: 2,
                  },
                ]}
              >
                <Text style={[styles.btnResultText, { color: colors.indigo }]}>THỬ THÁCH LẠI</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setIsFinished(false);
                  setIsPlaying(false);
                }}
                style={[
                  styles.btnResultActionSecondary,
                  {
                    backgroundColor: "#000000",
                    borderColor: "#8C5C38",
                    borderWidth: 2,
                  },
                ]}
              >
                <Text style={[styles.btnResultTextSecondary, { color: colors.indigo }]}>CHỌN CHỦ ĐỀ KHÁC</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  centerBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  scrollBody: { padding: 16, paddingBottom: 60 },
  loadingText: {
    marginTop: 14,
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? 50 : 20,
    paddingBottom: 15,
  },
  btnIconHeader: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  headerSub: {
    fontSize: 10,
    fontWeight: "800",
    marginTop: 2,
    letterSpacing: 1,
  },
  sectionContainer: {
    marginTop: 20,
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
    marginTop: 20,
  },
  listGrid: {
    gap: 12,
  },
  listCardItem: {
    padding: 16,
    borderRadius: 18,
    borderWidth: 1.5,
  },
  listCardLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  listCardTitle: {
    fontSize: 14,
    fontWeight: "800",
  },
  listCardCount: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
  btnStart: {
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 35,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  btnStartText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#050814",
    letterSpacing: 1,
  },
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
    minHeight: 88,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginVertical: 4,
    elevation: 1.5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  matchCardText: {
    fontWeight: "800",
    textAlign: "center",
    lineHeight: 18,
  },
  furiganaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-end",
    justifyContent: "center",
  },
  rubyContainer: {
    alignItems: "center",
    justifyContent: "flex-end",
    paddingHorizontal: 1,
  },
  rubyText: { fontWeight: "700", marginBottom: 1, textAlign: "center" },
  baseText: { fontWeight: "900" },
  plainText: { fontWeight: "700", paddingBottom: 1 },

  // Emblem and results
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
    marginBottom: 20,
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
    marginBottom: 35,
  },
  rewardCardText: {
    fontSize: 13,
    fontWeight: "700",
    flex: 1,
  },
  resultActions: {
    width: "100%",
    gap: 12,
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
  loadMoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 10,
    gap: 8,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.02,
        shadowRadius: 4,
      },
      android: { elevation: 1 },
    }),
  },
  loadMoreText: {
    fontSize: 14,
    fontWeight: "700",
  },
});
