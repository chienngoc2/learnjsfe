import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  Pressable,
  Platform,
  Dimensions,
  TouchableOpacity,
} from "react-native";
import { useRouter, Stack, useLocalSearchParams } from "expo-router";
import { Feather, Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Speech from "expo-speech";
import api from "../../services/api";
import { useTheme } from "@/src/context/ThemeContext";
import { useCultivationStore } from "../../store/useCultivationStore";
import { parseWord } from "../../src/utils/wordParser";

const { width } = Dimensions.get("window");

interface MatchCard {
  id: string;
  type: "jp" | "vn";
  text: string;
  pairId: number;
  matched: boolean;
}

export default function VocabMatchScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const params = useLocalSearchParams<{ topicId?: string; listId?: string }>();
  
  // Cultivation store rewards
  const { addTuVi, addXP } = useCultivationStore();

  // States
  const [isPlaying, setIsPlaying] = useState(false);
  const [vocabLists, setVocabLists] = useState<any[]>([]);
  const [selectedListIds, setSelectedListIds] = useState<string[]>([]);
  const [loadingLists, setLoadingLists] = useState(true);
  const PAGE_SIZE = 10;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Active match phase state
  const [cards, setCards] = useState<MatchCard[]>([]);
  const [selectedCard, setSelectedCard] = useState<MatchCard | null>(null);
  const [errorIds, setErrorIds] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [moves, setMoves] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [totalPairs, setTotalPairs] = useState(0);

  useEffect(() => {
    setLoadingLists(true);
    
    api.get("/api/vocab/lists")
      .then((res) => {
        if (res.data.success && res.data.data) {
          const data = res.data.data;
          setVocabLists(data);
          
          const targetId = params.topicId || params.listId;
          if (targetId) {
            const matched = data.find((l: any) => l._id.toString() === targetId.toString());
            if (matched) {
              setSelectedListIds([matched._id]);
            } else if (data.length > 0) {
              setSelectedListIds([data[0]._id]);
            }
          } else if (data.length > 0) {
            setSelectedListIds([data[0]._id]);
          }
        }
        setLoadingLists(false);
        setVisibleCount(PAGE_SIZE);
      })
      .catch((err) => {
        console.error("Lỗi lấy danh sách:", err);
        setLoadingLists(false);
      });
  }, [params.topicId, params.listId]);

  // Auto start if listId or topicId param exists
  useEffect(() => {
    const targetId = params.topicId || params.listId;
    if (targetId && vocabLists.length > 0 && selectedListIds.length > 0 && !isPlaying) {
      const matched = vocabLists.find((l: any) => l._id.toString() === targetId.toString());
      if (matched && selectedListIds.includes(matched._id)) {
        startMatchGame([matched]);
      }
    }
  }, [vocabLists, selectedListIds, params.topicId, params.listId]);

  const handleToggleList = (id: string) => {
    setSelectedListIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleStartMatch = () => {
    if (selectedListIds.length === 0) return;
    const selectedDecks = vocabLists.filter((list) =>
      selectedListIds.includes(list._id)
    );
    startMatchGame(selectedDecks);
  };

  const startMatchGame = (selectedDecks: any[]) => {
    // Collect all words from selected lists
    const allWords: any[] = [];
    selectedDecks.forEach((deck) => {
      if (deck.words && deck.words.length > 0) {
        deck.words.forEach((w: any) => {
          const parsed = parseWord(w.term, w.def);
          allWords.push({
            word: parsed.word,
            reading: parsed.reading || parsed.word,
            meaning: parsed.meaning,
          });
        });
      }
    });

    if (allWords.length === 0) {
      alert("Bài học được chọn chưa có từ vựng nào bạn nhé!");
      return;
    }

    // Pick 6 random words for matching (12 cards total)
    const selectedPairs = allWords.sort(() => Math.random() - 0.5).slice(0, 6);
    setTotalPairs(selectedPairs.length);

    const listCards: MatchCard[] = [];
    selectedPairs.forEach((pair, i) => {
      listCards.push({
        id: `jp-${i}`,
        type: "jp",
        text: pair.word,
        pairId: i,
        matched: false,
      });
      listCards.push({
        id: `vn-${i}`,
        type: "vn",
        text: pair.meaning,
        pairId: i,
        matched: false,
      });
    });

    setCards(listCards.sort(() => Math.random() - 0.5));
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
      setCards((prev) =>
        prev.map((c) => (c.id === c1.id || c.id === c2.id) ? { ...c, matched: true } : c)
      );
      setSelectedCard(null);
      
      // Pronounce Japanese word
      const jpText = c1.type === "jp" ? c1.text : c2.text;
      speak(jpText);

      setScore((s) => {
        const next = s + 1;
        if (next >= totalPairs) {
          // Finished Game
          const rewardTuViAmount = next * 5;
          const rewardXPAmount = next * 10;
          addTuVi(rewardTuViAmount);
          addXP(rewardXPAmount);
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

  const speak = (text: string) => {
    Speech.speak(text, { language: "ja-JP", rate: 0.85 });
  };

  const bgColors: readonly [string, string, ...string[]] = isDark 
    ? ["#050814", "#0a0e1c"] 
    : ["#f5edd6", "#fcf8ed"];

  if (loadingLists) {
    return (
      <View style={[styles.center, { backgroundColor: bgColors[0] }]}>
        <ActivityIndicator size="large" color={colors.indigo} />
      </View>
    );
  }

  // 1. SETTINGS / CONFIG PHASE RENDER
  if (!isPlaying) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: bgColors[0] }]}>
        <LinearGradient colors={bgColors} style={styles.container}>
          <Stack.Screen options={{ headerShown: false }} />

          {/* Header */}
          <View style={styles.header}>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [
                styles.btnIconHeader,
                { 
                  backgroundColor: colors.surface, 
                  borderColor: colors.border,
                  transform: [{ scale: pressed ? 0.95 : 1 }]
                },
              ]}
            >
              <Feather name="chevron-left" size={20} color={colors.text} />
            </Pressable>
            <View style={styles.headerTitleWrap}>
              <Text style={[styles.headerTitle, { color: colors.text }]}>Game Ghép Từ Vựng</Text>
              <Text style={[styles.headerSub, { color: colors.textMuted }]}>CẤU HÌNH THỬ THÁCH</Text>
            </View>
            <View style={{ width: 42 }} />
          </View>

          <ScrollView
            style={{ flex: 1, paddingHorizontal: 20 }}
            contentContainerStyle={{ paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Choose Lessons Section */}
            <View style={styles.sectionContainer}>
              <Text style={[styles.sectionHeading, { color: colors.indigo }]}>CHỌN BÀI LUYỆN TẬP</Text>
              {vocabLists.length === 0 ? (
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                  Chưa có bài học nào. Bạn cần tạo bài trước nha!
                </Text>
              ) : (
                <View style={styles.listGrid}>
                  {vocabLists.slice(0, visibleCount).map((list) => {
                    const isSelected = selectedListIds.includes(list._id);
                    return (
                      <Pressable
                        key={list._id}
                        onPress={() => handleToggleList(list._id)}
                        style={({ pressed }) => [
                          styles.listCardItem,
                          {
                            backgroundColor: isSelected ? colors.indigoLight : colors.surface,
                            borderColor: isSelected ? colors.indigo : colors.border,
                            transform: [{ scale: pressed ? 0.98 : 1 }],
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
                              {list.title}
                            </Text>
                            <Text style={[styles.listCardCount, { color: colors.textMuted }]}>
                              {list.words ? list.words.length : 0} từ vựng
                            </Text>
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}

                  {visibleCount < vocabLists.length && (
                    <TouchableOpacity
                      style={[
                        styles.loadMoreBtn,
                        { backgroundColor: colors.surface, borderColor: colors.border },
                      ]}
                      onPress={() => setVisibleCount((c) => c + PAGE_SIZE)}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.loadMoreText, { color: colors.indigo }]}>
                        Xem thêm ({vocabLists.length - visibleCount} bài học còn lại)
                      </Text>
                      <Feather name="chevron-down" size={20} color={colors.indigo} />
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>

            {/* Start Button */}
            <Pressable
              onPress={handleStartMatch}
              disabled={selectedListIds.length === 0}
              style={({ pressed }) => [
                styles.btnStart,
                {
                  backgroundColor: "#000000",
                  borderColor: "#8C5C38",
                  borderWidth: 2,
                  opacity: selectedListIds.length === 0 ? 0.5 : 1,
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                },
              ]}
            >
              <Text style={[styles.btnStartText, { color: colors.indigo }]}>BẮT ĐẦU LUYỆN TẬP</Text>
            </Pressable>
          </ScrollView>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  // 2. ACTIVE MATCH PLAYING PHASE
  if (isPlaying && !isFinished) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: bgColors[0] }]}>
        <LinearGradient colors={bgColors} style={styles.container}>
          <Stack.Screen options={{ headerShown: false }} />

          {/* Header */}
          <View style={styles.header}>
            <Pressable
              onPress={() => setIsPlaying(false)}
              style={({ pressed }) => [
                styles.btnIconHeader,
                { 
                  backgroundColor: colors.surface, 
                  borderColor: colors.border,
                  transform: [{ scale: pressed ? 0.95 : 1 }]
                },
              ]}
            >
              <Feather name="x" size={20} color={colors.text} />
            </Pressable>
            <View style={styles.headerTitleWrap}>
              <Text style={[styles.headerTitle, { color: colors.text }]}>Luyện Ghép Từ Vựng</Text>
              <Text style={[styles.headerSub, { color: colors.textMuted }]}>
                ĐÃ GHÉP: {score} <Text style={{ color: colors.textMuted }}>/</Text> {totalPairs} | MOVES: {moves}
              </Text>
            </View>
            <View style={{ width: 42 }} />
          </View>

          <View style={styles.gameArea}>
            <View style={styles.gridCards}>
              {cards.map((c) => {
                const isSelected = selectedCard?.id === c.id;
                const isError = errorIds.includes(c.id);

                let cardBg = "#000000";
                let cardBorder = "#8C5C38";
                let cardText = "#F7E5C4";

                if (c.matched) {
                  // Hide or make fully transparent/non-interactive
                  return <View key={c.id} style={[styles.cardItem, { opacity: 0 }]} />;
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
                  <Pressable
                    key={c.id}
                    onPress={() => handleCardClick(c)}
                    style={({ pressed }) => [
                      styles.cardItem,
                      {
                        backgroundColor: cardBg,
                        borderColor: cardBorder,
                        transform: [{ scale: pressed ? 0.96 : 1 }],
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.cardItemText,
                        { color: cardText, fontSize: c.type === "jp" ? 18 : 15 },
                      ]}
                      numberOfLines={3}
                    >
                      {c.text}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  // 3. RESULTS DISPLAY
  if (isFinished) {
    const rewardTuViGained = totalPairs * 5;

    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: bgColors[0] }]}>
        <LinearGradient colors={bgColors} style={styles.container}>
          <Stack.Screen options={{ headerShown: false }} />

          <View style={[styles.center, { paddingHorizontal: 24 }]}>
            {/* Success Emblem Banner */}
            <View style={[styles.emblemIconCircle, { backgroundColor: colors.indigoLight }]}>
              <Ionicons name="sparkles-outline" size={50} color={colors.indigo} />
            </View>

            <Text style={[styles.resultTitle, { color: colors.text }]}>BÀI TẬP HOÀN THÀNH</Text>
            <Text style={[styles.resultSubtitle, { color: colors.textMuted }]}>
              Chúc mừng bạn đã ghép chính xác toàn bộ thẻ từ vựng!
            </Text>

            {/* Score Bento Box */}
            <View style={[styles.resultBentoBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.resultBentoItem}>
                <Text style={[styles.bentoBLabel, { color: colors.textMuted }]}>SỐ LƯỢT GHÉP</Text>
                <Text style={[styles.bentoBVal, { color: colors.indigo }]}>{moves}</Text>
              </View>

              <View style={[styles.resultBentoDivider, { backgroundColor: colors.border }]} />

              <View style={styles.resultBentoItem}>
                <Text style={[styles.bentoBLabel, { color: colors.textMuted }]}>CẶP TỪ VỰNG</Text>
                <Text style={[styles.bentoBVal, { color: colors.indigo }]}>{totalPairs}</Text>
              </View>
            </View>

            {/* Rewards Card */}
            {rewardTuViGained > 0 ? (
              <View style={[styles.rewardCard, { backgroundColor: colors.surface, borderColor: colors.indigo }]}>
                <Ionicons name="sparkles" size={18} color={colors.indigo} style={{ marginRight: 8 }} />
                <Text style={[styles.rewardCardText, { color: colors.text }]}>
                  Điểm tích lũy: <Text style={{ color: colors.indigo, fontWeight: "900" }}>+{rewardTuViGained}</Text> XP và +{totalPairs * 10} kinh nghiệm!
                </Text>
              </View>
            ) : null}

            {/* Action Buttons */}
            <View style={styles.resultActions}>
              <Pressable
                onPress={() => startMatchGame(vocabLists.filter((list) => selectedListIds.includes(list._id)))}
                style={({ pressed }) => [
                  styles.btnResultAction,
                  {
                    backgroundColor: "#000000",
                    borderColor: "#8C5C38",
                    borderWidth: 2,
                    transform: [{ scale: pressed ? 0.98 : 1 }],
                  },
                ]}
              >
                <Text style={[styles.btnResultText, { color: colors.indigo }]}>THỬ THÁCH LẠI</Text>
              </Pressable>

              <Pressable
                onPress={() => setIsPlaying(false)}
                style={({ pressed }) => [
                  styles.btnResultActionSecondary,
                  {
                    backgroundColor: "#000000",
                    borderColor: "#8C5C38",
                    borderWidth: 2,
                    transform: [{ scale: pressed ? 0.98 : 1 }],
                  },
                ]}
              >
                <Text style={[styles.btnResultTextSecondary, { color: colors.indigo }]}>VỀ TRANG CHỦ</Text>
              </Pressable>
            </View>
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
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
  gameArea: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 20,
    justifyContent: "center",
  },
  gridCards: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10,
  },
  cardItem: {
    width: (width - 32 - 10) / 2, // 2 columns layout
    minHeight: 76,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginVertical: 4,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  cardItemText: {
    fontWeight: "800",
    textAlign: "center",
    lineHeight: 18,
  },
  emblemIconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
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
