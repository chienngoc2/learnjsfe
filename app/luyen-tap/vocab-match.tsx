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
import { Feather, Ionicons, MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Speech from "expo-speech";
import api from "../../services/api";
import { useTheme } from "@/src/context/ThemeContext";
import { usePinyin } from "@/src/context/PinyinContext";
import PinyinCheckbox from "../../components/ui/PinyinCheckbox";
import { useCultivationStore } from "../../store/useCultivationStore";
import { parseWord } from "../../src/utils/wordParser";

const { width } = Dimensions.get("window");

interface MatchCard {
  id: string;
  type: "hanzi" | "target";
  text: string;
  subText?: string;
  speechText: string;
  pairId: number;
  matched: boolean;
}

interface RawWord {
  word: string;
  pinyin?: string;
  meaning: string;
}

type MatchMode = "hanzi_vn" | "hanzi_pinyin" | "hanzi_pinyin_vn";
type SourceType = "db" | "master" | "custom_json";

export default function VocabMatchScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { hidePinyin } = usePinyin();
  const params = useLocalSearchParams<{ topicId?: string; listId?: string }>();
  
  // Cultivation store rewards
  const { addTuVi, addXP } = useCultivationStore();

  // Settings states
  const [sourceType, setSourceType] = useState<SourceType>("db");
  const [matchMode, setMatchMode] = useState<MatchMode>("hanzi_vn");
  const [pairLimit, setPairLimit] = useState<number>(6); // 4, 6, 8
  
  // Data lists
  const [vocabLists, setVocabLists] = useState<any[]>([]);
  const [selectedListIds, setSelectedListIds] = useState<string[]>([]);
  const [masterVocab, setMasterVocab] = useState<RawWord[]>([]);
  const [customJsonWords, setCustomJsonWords] = useState<RawWord[]>([]);
  const [customJsonFileName, setCustomJsonFileName] = useState<string>("");
  
  const [loadingLists, setLoadingLists] = useState(true);
  const PAGE_SIZE = 10;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Active game phase state
  const [isPlaying, setIsPlaying] = useState(false);
  const [cards, setCards] = useState<MatchCard[]>([]);
  const [selectedCard, setSelectedCard] = useState<MatchCard | null>(null);
  const [errorIds, setErrorIds] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [moves, setMoves] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [totalPairs, setTotalPairs] = useState(0);

  // 1. Fetch DB vocab lists & Master JSON on mount
  useEffect(() => {
    setLoadingLists(true);
    
    Promise.all([
      api.get("/api/vocab/lists").catch(() => ({ data: { success: false, data: [] } })),
      api.get("/api/vocab/master").catch(() => ({ data: { success: false, data: null } })),
    ])
      .then(([dbRes, masterRes]) => {
        if (dbRes.data && dbRes.data.success && dbRes.data.data) {
          const data = dbRes.data.data;
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

        if (masterRes.data && masterRes.data.success && masterRes.data.data) {
          const words = masterRes.data.data.words || [];
          setMasterVocab(words);
        }
      })
      .finally(() => {
        setLoadingLists(false);
        setVisibleCount(PAGE_SIZE);
      });
  }, [params.topicId, params.listId]);

  // Auto start if listId/topicId param is given
  useEffect(() => {
    const targetId = params.topicId || params.listId;
    if (targetId && vocabLists.length > 0 && selectedListIds.length > 0 && !isPlaying) {
      const matched = vocabLists.find((l: any) => l._id.toString() === targetId.toString());
      if (matched && selectedListIds.includes(matched._id)) {
        startMatchGameFromWords(extractWordsFromDecks([matched]));
      }
    }
  }, [vocabLists, selectedListIds, params.topicId, params.listId]);

  const extractWordsFromDecks = (decks: any[]): RawWord[] => {
    const list: RawWord[] = [];
    decks.forEach((deck) => {
      if (deck.words && deck.words.length > 0) {
        deck.words.forEach((w: any) => {
          const parsed = parseWord(w.term, w.def);
          list.push({
            word: parsed.word,
            pinyin: parsed.pinyin || parsed.reading || "",
            meaning: parsed.meaning,
          });
        });
      }
    });
    return list;
  };

  const handleToggleList = (id: string) => {
    setSelectedListIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Upload Custom JSON file on Web / Device
  const handleCustomJsonUpload = (event: any) => {
    const file = event.target?.files?.[0];
    if (!file) return;
    setCustomJsonFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text);
        const rawList = Array.isArray(parsed) ? parsed : (parsed.words || [parsed]);
        const cleanedList: RawWord[] = rawList.map((item: any) => ({
          word: item.word || item.term || "",
          pinyin: item.pinyin || item.reading || "",
          meaning: typeof item.meaning === "string" ? item.meaning : (item.def || ""),
        })).filter((w: RawWord) => w.word && w.meaning);

        if (cleanedList.length === 0) {
          alert("File JSON không chứa từ vựng hợp lệ (cần có word và meaning).");
          return;
        }

        setCustomJsonWords(cleanedList);
        setSourceType("custom_json");
      } catch (err) {
        alert("File JSON bị lỗi định dạng.");
      }
    };
    reader.readAsText(file);
  };

  const handleStartGame = () => {
    let sourceWords: RawWord[] = [];
    if (sourceType === "db") {
      const selectedDecks = vocabLists.filter((list) => selectedListIds.includes(list._id));
      sourceWords = extractWordsFromDecks(selectedDecks);
    } else if (sourceType === "master") {
      sourceWords = masterVocab;
    } else if (sourceType === "custom_json") {
      sourceWords = customJsonWords;
    }

    if (sourceWords.length === 0) {
      alert("Chưa có từ vựng nào trong nguồn đã chọn!");
      return;
    }

    startMatchGameFromWords(sourceWords);
  };

  const startMatchGameFromWords = (allWords: RawWord[]) => {
    // Pick random words for matching
    const sampleLimit = Math.min(pairLimit, allWords.length);
    const selectedPairs = allWords.sort(() => Math.random() - 0.5).slice(0, sampleLimit);
    setTotalPairs(selectedPairs.length);

    const listCards: MatchCard[] = [];
    selectedPairs.forEach((pair, i) => {
      // 1. Thẻ Chữ Hán
      let hanziCardText = pair.word;
      let hanziSubText = undefined;
      if (matchMode === "hanzi_pinyin_vn" && pair.pinyin) {
        hanziSubText = pair.pinyin;
      }

      listCards.push({
        id: `hanzi-${i}`,
        type: "hanzi",
        text: hanziCardText,
        subText: hanziSubText,
        speechText: pair.word,
        pairId: i,
        matched: false,
      });

      // 2. Thẻ Đích (Nghĩa hoặc Pinyin)
      let targetCardText = pair.meaning;
      if (matchMode === "hanzi_pinyin") {
        targetCardText = pair.pinyin || pair.meaning;
      }

      listCards.push({
        id: `target-${i}`,
        type: "target",
        text: targetCardText,
        speechText: pair.word,
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
      speak(card.speechText);
      return;
    }

    if (selectedCard.type === card.type) {
      setSelectedCard(card);
      speak(card.speechText);
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
      
      // Pronounce Chinese word with zh-TW
      speak(c1.speechText);

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
      }, 700);
    }
  };

  const speak = (text: string) => {
    Speech.speak(text, { language: "zh-TW", rate: 0.85 });
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

  // 1. CONFIGURATION & SETTINGS PHASE
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
              <Text style={[styles.headerTitle, { color: colors.text }]}>🎴 Game Ghép Thẻ Từ Vựng</Text>
              <Text style={[styles.headerSub, { color: colors.textMuted }]}>CẤU HÌNH THỬ THÁCH</Text>
            </View>
            <PinyinCheckbox compact />
          </View>

          <ScrollView
            style={{ flex: 1, paddingHorizontal: 20 }}
            contentContainerStyle={{ paddingBottom: 50 }}
            showsVerticalScrollIndicator={false}
          >
            {/* SOURCE SELECTOR */}
            <View style={styles.sectionContainer}>
              <Text style={[styles.sectionHeading, { color: colors.indigo }]}>1. NGUỒN TỪ VỰNG</Text>
              <View style={styles.sourceTabsRow}>
                <TouchableOpacity
                  style={[
                    styles.sourceTabBtn,
                    {
                      backgroundColor: sourceType === "db" ? colors.indigo : colors.surface,
                      borderColor: sourceType === "db" ? colors.indigo : colors.border,
                    },
                  ]}
                  onPress={() => setSourceType("db")}
                >
                  <MaterialIcons
                    name="folder"
                    size={16}
                    color={sourceType === "db" ? "#FFFFFF" : colors.text}
                  />
                  <Text
                    style={[
                      styles.sourceTabText,
                      { color: sourceType === "db" ? "#FFFFFF" : colors.text },
                    ]}
                  >
                    Kho bài học ({vocabLists.length})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.sourceTabBtn,
                    {
                      backgroundColor: sourceType === "master" ? colors.indigo : colors.surface,
                      borderColor: sourceType === "master" ? colors.indigo : colors.border,
                    },
                  ]}
                  onPress={() => setSourceType("master")}
                >
                  <MaterialIcons
                    name="auto-stories"
                    size={16}
                    color={sourceType === "master" ? "#FFFFFF" : colors.text}
                  />
                  <Text
                    style={[
                      styles.sourceTabText,
                      { color: sourceType === "master" ? "#FFFFFF" : colors.text },
                    ]}
                  >
                    Kho Master ({masterVocab.length || 533})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.sourceTabBtn,
                    {
                      backgroundColor: sourceType === "custom_json" ? colors.indigo : colors.surface,
                      borderColor: sourceType === "custom_json" ? colors.indigo : colors.border,
                    },
                  ]}
                  onPress={() => {
                    if (Platform.OS === "web") {
                      document.getElementById("match-json-upload")?.click();
                    }
                  }}
                >
                  <MaterialIcons
                    name="upload-file"
                    size={16}
                    color={sourceType === "custom_json" ? "#FFFFFF" : colors.text}
                  />
                  <Text
                    style={[
                      styles.sourceTabText,
                      { color: sourceType === "custom_json" ? "#FFFFFF" : colors.text },
                    ]}
                  >
                    {customJsonWords.length > 0 ? `File (${customJsonWords.length})` : "Tải JSON lên"}
                  </Text>
                </TouchableOpacity>
              </View>

              {Platform.OS === "web" && (
                <input
                  id="match-json-upload"
                  type="file"
                  accept=".json"
                  onChange={handleCustomJsonUpload}
                  style={{ display: "none" }}
                />
              )}

              {/* Detail selection when sourceType is db */}
              {sourceType === "db" && (
                <View style={[styles.listGrid, { marginTop: 12 }]}>
                  {vocabLists.slice(0, visibleCount).map((list) => {
                    const isSelected = selectedListIds.includes(list._id);
                    return (
                      <Pressable
                        key={list._id}
                        onPress={() => handleToggleList(list._id)}
                        style={({ pressed }) => [
                          styles.listCardItem,
                          {
                            backgroundColor: isSelected ? (isDark ? "#1E293B" : "#EFF6FF") : colors.surface,
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
                                isSelected && { color: colors.indigo, fontWeight: "700" },
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
                    >
                      <Text style={[styles.loadMoreText, { color: colors.indigo }]}>
                        Xem thêm ({vocabLists.length - visibleCount} bài còn lại)
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {sourceType === "master" && (
                <View style={[styles.infoBanner, { backgroundColor: isDark ? "#1E293B" : "#F0FDF4", borderColor: "#10B981" }]}>
                  <MaterialIcons name="verified" size={20} color="#10B981" />
                  <Text style={[styles.infoBannerText, { color: isDark ? "#6EE7B7" : "#065F46" }]}>
                    Đang sử dụng kho từ vựng chuẩn Giáo trình Đương Đại ({masterVocab.length || 533} từ). Mỗi ván sẽ chọn ngẫu nhiên các từ để thử thách bạn!
                  </Text>
                </View>
              )}

              {sourceType === "custom_json" && (
                <View style={[styles.infoBanner, { backgroundColor: isDark ? "#1E293B" : "#EFF6FF", borderColor: colors.indigo }]}>
                  <MaterialIcons name="file-present" size={20} color={colors.indigo} />
                  <Text style={[styles.infoBannerText, { color: colors.indigo }]}>
                    {customJsonWords.length > 0
                      ? `Đã nạp file "${customJsonFileName || 'JSON'}" với ${customJsonWords.length} từ vựng.`
                      : "Chưa chọn file JSON nào. Hãy bấm 'Tải JSON lên' để chọn file."}
                  </Text>
                </View>
              )}
            </View>

            {/* 2. MATCH MODE SELECTOR */}
            <View style={styles.sectionContainer}>
              <Text style={[styles.sectionHeading, { color: colors.indigo }]}>2. CHẾ ĐỘ GHÉP THẺ</Text>
              <View style={styles.modeGrid}>
                <TouchableOpacity
                  style={[
                    styles.modeCard,
                    {
                      backgroundColor: matchMode === "hanzi_vn" ? (isDark ? "#1E293B" : "#EFF6FF") : colors.surface,
                      borderColor: matchMode === "hanzi_vn" ? colors.indigo : colors.border,
                    },
                  ]}
                  onPress={() => setMatchMode("hanzi_vn")}
                >
                  <Text style={[styles.modeCardTitle, { color: matchMode === "hanzi_vn" ? colors.indigo : colors.text }]}>
                    🔤 Hán tự ↔ Nghĩa Việt
                  </Text>
                  <Text style={[styles.modeCardDesc, { color: colors.textMuted }]}>
                    Ví dụ: 謝謝 ↔ Cảm ơn
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.modeCard,
                    {
                      backgroundColor: matchMode === "hanzi_pinyin" ? (isDark ? "#1E293B" : "#EFF6FF") : colors.surface,
                      borderColor: matchMode === "hanzi_pinyin" ? colors.indigo : colors.border,
                    },
                  ]}
                  onPress={() => setMatchMode("hanzi_pinyin")}
                >
                  <Text style={[styles.modeCardTitle, { color: matchMode === "hanzi_pinyin" ? colors.indigo : colors.text }]}>
                    🗣️ Hán tự ↔ Pinyin
                  </Text>
                  <Text style={[styles.modeCardDesc, { color: colors.textMuted }]}>
                    Ví dụ: 謝謝 ↔ xièxiè
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.modeCard,
                    {
                      backgroundColor: matchMode === "hanzi_pinyin_vn" ? (isDark ? "#1E293B" : "#EFF6FF") : colors.surface,
                      borderColor: matchMode === "hanzi_pinyin_vn" ? colors.indigo : colors.border,
                    },
                  ]}
                  onPress={() => setMatchMode("hanzi_pinyin_vn")}
                >
                  <Text style={[styles.modeCardTitle, { color: matchMode === "hanzi_pinyin_vn" ? colors.indigo : colors.text }]}>
                    💡 Hán tự + Pinyin ↔ Nghĩa
                  </Text>
                  <Text style={[styles.modeCardDesc, { color: colors.textMuted }]}>
                    Dành cho người mới học
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* 3. PAIR LIMIT SELECTOR */}
            <View style={styles.sectionContainer}>
              <Text style={[styles.sectionHeading, { color: colors.indigo }]}>3. SỐ CẶP THẺ MỖI VÁN</Text>
              <View style={styles.limitRow}>
                {[4, 6, 8, 10].map((num) => (
                  <TouchableOpacity
                    key={num}
                    style={[
                      styles.limitBtn,
                      {
                        backgroundColor: pairLimit === num ? colors.indigo : colors.surface,
                        borderColor: pairLimit === num ? colors.indigo : colors.border,
                      },
                    ]}
                    onPress={() => setPairLimit(num)}
                  >
                    <Text
                      style={[
                        styles.limitBtnText,
                        { color: pairLimit === num ? "#FFFFFF" : colors.text },
                      ]}
                    >
                      {num} Cặp ({num * 2} Thẻ)
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* START BUTTON */}
            <Pressable
              onPress={handleStartGame}
              style={({ pressed }) => [
                styles.btnStart,
                {
                  backgroundColor: colors.indigo,
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                },
              ]}
            >
              <Ionicons name="play" size={20} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.btnStartText}>BẮT ĐẦU VÁN GHÉP</Text>
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
              <Text style={[styles.headerTitle, { color: colors.text }]}>Ghép Thẻ Từ Vựng</Text>
              <Text style={[styles.headerSub, { color: colors.indigo }]}>
                GHÉP ĐÚNG: {score}/{totalPairs}  •  LƯỢT THỬ: {moves}
              </Text>
            </View>
            <PinyinCheckbox compact />
          </View>

          <View style={styles.gameArea}>
            <View style={styles.gridCards}>
              {cards.map((c) => {
                const isSelected = selectedCard?.id === c.id;
                const isError = errorIds.includes(c.id);

                let cardBg = isDark ? "#1E293B" : "#FFFFFF";
                let cardBorder = isDark ? "#334155" : "#E2E8F0";
                let cardTextColor = colors.text;

                if (c.matched) {
                  return <View key={c.id} style={[styles.cardItem, { opacity: 0, pointerEvents: "none" }]} />;
                }

                if (isSelected) {
                  cardBg = isDark ? "#1E3A8A" : "#DBEAFE";
                  cardBorder = colors.indigo;
                  cardTextColor = colors.indigo;
                } else if (isError) {
                  cardBg = isDark ? "#451A1A" : "#FEE2E2";
                  cardBorder = "#EF4444";
                  cardTextColor = "#EF4444";
                }

                const isChinese = c.type === "hanzi";
                const isLongText = c.text.length > 8;

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
                        {
                          color: cardTextColor,
                          fontSize: isChinese ? 22 : isLongText ? 13 : 15,
                          fontWeight: isChinese ? "800" : "600",
                        },
                      ]}
                      numberOfLines={3}
                    >
                      {c.text}
                    </Text>
                    {!hidePinyin && c.subText ? (
                      <Text style={[styles.cardSubText, { color: isSelected ? colors.indigo : colors.textMuted }]}>
                        {c.subText}
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  // 3. RESULTS & VICTORY PHASE
  if (isFinished) {
    const rewardTuViGained = totalPairs * 5;
    const rewardXPGained = totalPairs * 10;

    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: bgColors[0] }]}>
        <LinearGradient colors={bgColors} style={styles.container}>
          <Stack.Screen options={{ headerShown: false }} />

          <View style={[styles.center, { paddingHorizontal: 24 }]}>
            {/* Victory Badge */}
            <View style={[styles.emblemIconCircle, { backgroundColor: isDark ? "#1E3A8A" : "#DBEAFE" }]}>
              <Ionicons name="trophy" size={54} color={colors.indigo} />
            </View>

            <Text style={[styles.resultTitle, { color: colors.text }]}>HOÀN THÀNH XUẤT SẮC!</Text>
            <Text style={[styles.resultSubtitle, { color: colors.textMuted }]}>
              Bạn đã ghép chính xác toàn bộ {totalPairs} cặp từ vựng!
            </Text>

            {/* Score Bento Box */}
            <View style={[styles.resultBentoBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.resultBentoItem}>
                <Text style={[styles.bentoBLabel, { color: colors.textMuted }]}>SỐ LƯỢT THỬ</Text>
                <Text style={[styles.bentoBVal, { color: colors.indigo }]}>{moves}</Text>
              </View>

              <View style={[styles.resultBentoDivider, { backgroundColor: colors.border }]} />

              <View style={styles.resultBentoItem}>
                <Text style={[styles.bentoBLabel, { color: colors.textMuted }]}>CẶP GHÉP ĐÚNG</Text>
                <Text style={[styles.bentoBVal, { color: colors.indigo }]}>{totalPairs}</Text>
              </View>
            </View>

            {/* Rewards Card */}
            <View style={[styles.rewardCard, { backgroundColor: colors.surface, borderColor: colors.indigo }]}>
              <Ionicons name="sparkles" size={20} color={colors.indigo} style={{ marginRight: 8 }} />
              <Text style={[styles.rewardCardText, { color: colors.text }]}>
                Phần thưởng: <Text style={{ color: colors.indigo, fontWeight: "900" }}>+{rewardTuViGained} Tu vi</Text> và +{rewardXPGained} XP!
              </Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.resultActions}>
              <Pressable
                onPress={handleStartGame}
                style={({ pressed }) => [
                  styles.btnResultPrimary,
                  { backgroundColor: colors.indigo, transform: [{ scale: pressed ? 0.98 : 1 }] },
                ]}
              >
                <Ionicons name="reload" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.btnResultPrimaryText}>Chơi lại ván mới</Text>
              </Pressable>

              <Pressable
                onPress={() => setIsPlaying(false)}
                style={({ pressed }) => [
                  styles.btnResultSecondary,
                  { backgroundColor: colors.surface, borderColor: colors.border, transform: [{ scale: pressed ? 0.98 : 1 }] },
                ]}
              >
                <Text style={[styles.btnResultSecondaryText, { color: colors.text }]}>Đổi cấu hình</Text>
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
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  btnIconHeader: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleWrap: {
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
  },
  headerSub: {
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
    letterSpacing: 0.5,
  },
  sectionContainer: {
    marginTop: 18,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  sourceTabsRow: {
    flexDirection: "row",
    gap: 8,
  },
  sourceTabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
  },
  sourceTabText: {
    fontSize: 12,
    fontWeight: "700",
  },
  listGrid: {
    gap: 8,
  },
  listCardItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  listCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  listCardTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  listCardCount: {
    fontSize: 12,
    marginTop: 2,
  },
  loadMoreBtn: {
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    marginTop: 4,
  },
  loadMoreText: {
    fontSize: 13,
    fontWeight: "600",
  },
  infoBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 10,
    gap: 8,
  },
  infoBannerText: {
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  modeGrid: {
    gap: 8,
  },
  modeCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  modeCardTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  modeCardDesc: {
    fontSize: 12,
    marginTop: 3,
  },
  limitRow: {
    flexDirection: "row",
    gap: 8,
  },
  limitBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  limitBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },
  btnStart: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 24,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  btnStartText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  gameArea: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: "center",
  },
  gridCards: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 10,
    maxWidth: 600,
    alignSelf: "center",
    width: "100%",
  },
  cardItem: {
    width: "46%",
    minHeight: 88,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 10,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  cardItemText: {
    textAlign: "center",
  },
  cardSubText: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 3,
  },
  emblemIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  resultTitle: {
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center",
  },
  resultSubtitle: {
    fontSize: 14,
    textAlign: "center",
    marginTop: 6,
    marginBottom: 20,
  },
  resultBentoBox: {
    flexDirection: "row",
    width: "100%",
    maxWidth: 320,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 16,
    marginBottom: 14,
  },
  resultBentoItem: {
    flex: 1,
    alignItems: "center",
  },
  resultBentoDivider: {
    width: 1,
  },
  bentoBLabel: {
    fontSize: 11,
    fontWeight: "700",
  },
  bentoBVal: {
    fontSize: 26,
    fontWeight: "900",
    marginTop: 4,
  },
  rewardCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    maxWidth: 320,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
  },
  rewardCardText: {
    fontSize: 13,
    fontWeight: "600",
  },
  resultActions: {
    width: "100%",
    maxWidth: 320,
    gap: 10,
  },
  btnResultPrimary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
    borderRadius: 12,
  },
  btnResultPrimaryText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  btnResultSecondary: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
  },
  btnResultSecondaryText: {
    fontSize: 14,
    fontWeight: "700",
  },
});
