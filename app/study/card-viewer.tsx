import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  Dimensions,
  ActivityIndicator,
  SafeAreaView,
  Pressable,
  Platform,
  ScrollView,
  TouchableOpacity,
  Modal,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import * as Speech from "expo-speech";
import { LinearGradient } from "expo-linear-gradient";
import { Feather, Ionicons, MaterialIcons } from "@expo/vector-icons";
import api from "../../services/api";
import { useTheme } from "@/src/context/ThemeContext";
import { usePinyin } from "@/src/context/PinyinContext";
import { usePriority } from "@/src/context/PriorityContext";
import { PriorityButton } from "@/src/components/PriorityButton";
import PinyinCheckbox from "../../components/ui/PinyinCheckbox";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
} from "react-native-reanimated";
import { parseWord } from "../../src/utils/wordParser";
import StrokeOrderPractice from "../../components/StrokeOrderPractice";
import masterData from "@/assets/data/vocab_master.json";
import { SINO_VIETNAMESE_DICT } from "./kanji-search";

export interface VocabBankItem {
  word: string;
  pinyin?: string;
  meaning: string;
  level?: string;
  topicTitle?: string;
}

export type ExploreItem =
  | { type: "char"; char: string }
  | { type: "word"; word: VocabBankItem };

const { height } = Dimensions.get("window");

export default function CardViewer() {
  const { colors, isDark } = useTheme();
  const { hidePinyin } = usePinyin();
  const { topicId, title, mode } = useLocalSearchParams<{ topicId?: string; title?: string; mode?: string }>();
  const router = useRouter();
  const [words, setWords] = useState<any[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  // ⭐ Global Priority review integration
  const isPriorityMode = mode === "priority" || title === "Ưu Tiên Ôn Tập";
  const {
    prioritySet,
    priorityWords: globalPriorityWords,
    priorityTopics: globalPriorityTopics,
    refreshPriority,
  } = usePriority();

  const [allPriorityWords, setAllPriorityWords] = useState<any[]>([]);
  const [priorityTopics, setPriorityTopics] = useState<string[]>([]);
  const [selectedFilterTopic, setSelectedFilterTopic] = useState<string>("all");
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // 🌟 Toàn bộ kho từ vựng (1141 từ Master TOCFL + từ các bài học server)
  const [allVocabWords, setAllVocabWords] = useState<VocabBankItem[]>(() => {
    const master = (masterData as any).words || [];
    return master.map((w: any) => ({
      word: w.word,
      pinyin: w.pinyin,
      meaning: w.meaning,
      level: w.level || "TOCFL A1-A2",
    }));
  });

  // 🧭 Stack điều hướng khám phá chữ và từ liên quan
  const [exploreStack, setExploreStack] = useState<ExploreItem[]>([]);

  // Tự động kéo bổ sung từ vựng từ server để kho từ vựng phong phú nhất
  useEffect(() => {
    api
      .get("/api/vocab/lists")
      .then((res) => {
        if (res.data?.success && Array.isArray(res.data.data)) {
          const listWords: VocabBankItem[] = [];
          res.data.data.forEach((list: any) => {
            (list.words || []).forEach((w: any) => {
              if (w.term) {
                const parsedItem = parseWord(w.term, w.def || w.meaning || "");
                listWords.push({
                  word: parsedItem.word,
                  pinyin: parsedItem.pinyin || parsedItem.reading || "",
                  meaning: parsedItem.meaning || "",
                  level: list.title || "Bài học",
                });
              }
            });
          });
          setAllVocabWords((prev) => {
            const seen = new Set(prev.map((item) => item.word));
            const fresh = listWords.filter((cw) => !seen.has(cw.word));
            return [...prev, ...fresh];
          });
        }
      })
      .catch(() => {});
  }, []);

  const openCharDetail = (char: string) => {
    setExploreStack([{ type: "char", char }]);
  };

  const pushExplore = (item: ExploreItem) => {
    setExploreStack((prev) => [...prev, item]);
  };

  const popExplore = () => {
    setExploreStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : []));
  };

  const closeExplore = () => {
    setExploreStack([]);
  };

  const jumpExplore = (targetIdx: number) => {
    setExploreStack((prev) => prev.slice(0, targetIdx + 1));
  };

  const getChineseChars = (text: string): string[] => {
    if (!text) return [];
    return text.split("").filter((ch) => /[\u4e00-\u9fff\u3400-\u4dbf]/.test(ch));
  };

  const getCharInfo = (ch: string) => {
    const dict = SINO_VIETNAMESE_DICT[ch];
    if (dict) {
      return {
        char: ch,
        hanviet: dict.hanviet || "",
        meaning: dict.meaning || "",
        pinyin: dict.pinyin || "",
      };
    }
    const match = allVocabWords.find((w) => w.word === ch);
    return {
      char: ch,
      hanviet: match?.meaning ? match.meaning.split(/[,;]/)[0] : "Hán tự",
      meaning: match?.meaning || "Chữ Hán Phồn Thể",
      pinyin: match?.pinyin || "",
    };
  };

  const getRelatedWordsForChar = (ch: string): VocabBankItem[] => {
    if (!ch) return [];
    const list = allVocabWords.filter((w) => w.word && w.word.includes(ch));
    const seen = new Set<string>();
    const unique = list.filter((w) => {
      if (seen.has(w.word)) return false;
      seen.add(w.word);
      return true;
    });

    return unique.sort((a, b) => {
      if (a.word === ch && b.word !== ch) return 1;
      if (b.word === ch && a.word !== ch) return -1;
      const aStarts = a.word.startsWith(ch);
      const bStarts = b.word.startsWith(ch);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return a.word.length - b.word.length;
    });
  };

  const getRelatedWordsForCompound = (compound: string): VocabBankItem[] => {
    if (!compound) return [];
    const list = allVocabWords.filter(
      (w) => w.word && w.word !== compound && w.word.includes(compound)
    );
    const seen = new Set<string>();
    return list.filter((w) => {
      if (seen.has(w.word)) return false;
      seen.add(w.word);
      return true;
    });
  };

  // Reanimated Y-axis flip value (0 for front, 180 for back)
  const rotate = useSharedValue(0);
  // Tactile press scale value
  const scale = useSharedValue(1);

  // Load danh sách từ vựng
  useEffect(() => {
    if (isPriorityMode) {
      const list = globalPriorityWords || [];
      setAllPriorityWords(list);
      setPriorityTopics(globalPriorityTopics || []);
      if (selectedFilterTopic === "all") {
        setWords(list);
      } else {
        setWords(list.filter((w) => (w.topicTitle || "Khác") === selectedFilterTopic));
      }
      setLoading(false);
      // Đồng bộ trong nền
      refreshPriority();
    } else {
      setLoading(true);
      api
        .get("/api/vocab/lists")
        .then((listRes) => {
          if (listRes.data.success) {
            const list = listRes.data.data.find((l: any) => l._id === topicId);
            if (list && list.words) setWords(list.words);
          }
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [topicId, isPriorityMode]);

  // Tự động đồng bộ từ vựng khi danh sách ưu tiên toàn cục thay đổi mà KHÔNG cần reload trang
  useEffect(() => {
    if (isPriorityMode) {
      setAllPriorityWords(globalPriorityWords);
      setPriorityTopics(globalPriorityTopics);
      if (selectedFilterTopic === "all") {
        setWords(globalPriorityWords);
      } else {
        setWords(
          globalPriorityWords.filter(
            (w) => (w.topicTitle || "Khác") === selectedFilterTopic
          )
        );
      }
    }
  }, [isPriorityMode, globalPriorityWords, globalPriorityTopics, selectedFilterTopic]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  const handleFilterTopic = (t: string) => {
    setSelectedFilterTopic(t);
    setIndex(0);
    rotate.value = 0;
    if (t === "all") {
      setWords(allPriorityWords);
    } else {
      setWords(allPriorityWords.filter((w) => (w.topicTitle || "Khác") === t));
    }
  };

  const handleFlip = () => {
    rotate.value = withTiming(rotate.value === 0 ? 180 : 0, { duration: 400 });
  };

  const onPressIn = () => {
    scale.value = withTiming(0.96, { duration: 150 });
  };

  const onPressOut = () => {
    scale.value = withTiming(1, { duration: 150 });
  };

  const frontAnimatedStyle = useAnimatedStyle(() => {
    const spin = interpolate(rotate.value, [0, 180], [0, 180]);
    return {
      transform: [
        { rotateY: `${spin}deg` },
        { scale: scale.value }
      ],
      opacity: rotate.value > 90 ? 0 : 1,
      zIndex: rotate.value > 90 ? 1 : 2,
    };
  });

  const backAnimatedStyle = useAnimatedStyle(() => {
    const spin = interpolate(rotate.value, [0, 180], [180, 360]);
    return {
      transform: [
        { rotateY: `${spin}deg` },
        { scale: scale.value }
      ],
      opacity: rotate.value < 90 ? 0 : 1,
      zIndex: rotate.value > 90 ? 2 : 1,
    };
  });

  const nextCard = () => {
    if (index < words.length - 1) {
      const isCurrentlyFlipped = rotate.value !== 0;
      if (isCurrentlyFlipped) {
        rotate.value = withTiming(0, { duration: 250 });
      }
      setTimeout(() => setIndex(index + 1), isCurrentlyFlipped ? 250 : 0);
    }
  };

  const prevCard = () => {
    if (index > 0) {
      const isCurrentlyFlipped = rotate.value !== 0;
      if (isCurrentlyFlipped) {
        rotate.value = withTiming(0, { duration: 250 });
      }
      setTimeout(() => setIndex(index - 1), isCurrentlyFlipped ? 250 : 0);
    }
  };

  const speak = (text: string) => {
    if (!text) return;
    const cleanText = text.replace(/[\(\)\[\]（）]/g, "").trim();
    Speech.speak(cleanText, { language: "zh-TW", rate: 0.85 });
  };

  if (loading) {
    return (
      <View
        style={[
          styles.loadingContainer,
          { backgroundColor: colors.background },
        ]}
      >
        <ActivityIndicator size="large" color={colors.indigo} />
      </View>
    );
  }

  if (words.length === 0) {
    return (
      <View
        style={[
          styles.loadingContainer,
          { backgroundColor: colors.background },
        ]}
      >
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>
          Chưa có từ vựng nào sếp ơi.
        </Text>
        <Pressable
          style={({ pressed }) => [
            styles.btnBackEmpty, 
            { backgroundColor: colors.indigo, transform: [{ scale: pressed ? 0.95 : 1 }] }
          ]}
          onPress={() => router.back()}
        >
          <Text style={styles.btnBackText}>Quay lại</Text>
        </Pressable>
      </View>
    );
  }

  const currentWord = words[index];
  const parsed = parseWord(
    currentWord?.term ?? currentWord?.word ?? "", 
    currentWord?.def ?? currentWord?.definition ?? currentWord ?? ""
  );
  const progressPercent = ((index + 1) / words.length) * 100;

  const getWordTypeLabel = (type: string) => {
    const lower = (type || "").toLowerCase();
    if (lower === "noun" || lower === "n") return "Danh Từ";
    if (lower === "verb" || lower === "v") return "Động Từ";
    if (lower === "adjective" || lower === "adj") return "Tính Từ";
    if (lower === "adverb" || lower === "adv") return "Trạng Từ";
    if (lower === "particle") return "Trợ Từ";
    return type || "Chưa rõ";
  };

  const bgColors: readonly [string, string, ...string[]] = isDark 
    ? ["#050814", "#0a0e1c"] 
    : ["#f5edd6", "#fcf8ed"];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: bgColors[0] }]}>
      <LinearGradient colors={bgColors} style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />

        {/* 1. CUSTOM HEADER */}
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
            <Text
              style={[styles.headerTitle, { color: colors.text }]}
              numberOfLines={1}
            >
              {title}
            </Text>
            <Text style={[styles.headerSub, { color: colors.textMuted }]}>
              {words.length} CỔ TỰ TINH HOA
            </Text>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <PinyinCheckbox compact />
            <Pressable
              style={({ pressed }) => [
                styles.btnIconHeader,
                { 
                  backgroundColor: colors.surface, 
                  borderColor: colors.border,
                  transform: [{ scale: pressed ? 0.95 : 1 }]
                },
              ]}
              onPress={() =>
                router.push({
                  pathname: "/study/kanji-search",
                  params: {
                    topicId: String(topicId),
                    title: String(title),
                    word: parsed.word,
                  },
                })
              }
            >
              <Feather name="edit-3" size={18} color={colors.emerald} />
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.btnIconHeader,
                { 
                  backgroundColor: colors.surface, 
                  borderColor: colors.border,
                  transform: [{ scale: pressed ? 0.95 : 1 }]
                },
              ]}
              onPress={() => speak(parsed.word)}
            >
              <Feather name="volume-2" size={20} color={colors.indigo} />
            </Pressable>
          </View>
        </View>

        {/* TOAST MESSAGE */}
        {toastMsg && (
          <View style={[styles.toastBanner, { backgroundColor: isDark ? "#1E293B" : "#FEF3C7", borderColor: "#F59E0B" }]}>
            <Ionicons name="sparkles" size={16} color="#F59E0B" />
            <Text style={[styles.toastText, { color: isDark ? "#FDE68A" : "#92400E" }]}>
              {toastMsg}
            </Text>
          </View>
        )}

        {/* 📚 BỘ LỌC THEO BÀI HỌC CHO MỤC ƯU TIÊN */}
        {isPriorityMode && (
          <View style={styles.filterSection}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
              <Pressable
                style={[
                  styles.filterChip,
                  selectedFilterTopic === "all"
                    ? { backgroundColor: "#F59E0B", borderColor: "#F59E0B" }
                    : { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
                onPress={() => handleFilterTopic("all")}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    { color: selectedFilterTopic === "all" ? "#FFFFFF" : colors.text },
                  ]}
                >
                  Tất cả ({allPriorityWords.length})
                </Text>
              </Pressable>
              {priorityTopics.map((top) => {
                const count = allPriorityWords.filter((w) => (w.topicTitle || "Khác") === top).length;
                const isSel = selectedFilterTopic === top;
                return (
                  <Pressable
                    key={top}
                    style={[
                      styles.filterChip,
                      isSel
                        ? { backgroundColor: "#F59E0B", borderColor: "#F59E0B" }
                        : { backgroundColor: colors.surface, borderColor: colors.border },
                    ]}
                    onPress={() => handleFilterTopic(top)}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        { color: isSel ? "#FFFFFF" : colors.text },
                      ]}
                    >
                      {top} ({count})
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}

        {words.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIconWrap, { backgroundColor: isDark ? "#1E293B" : "#FEF3C7" }]}>
              <Ionicons name="star" size={42} color="#F59E0B" />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              Chưa có từ vựng ưu tiên nào
            </Text>
            <Text style={[styles.emptyDesc, { color: colors.textMuted }]}>
              Khi làm bài trắc nghiệm ghi nhớ hoặc xem flashcard, hãy tích ⭐ hoặc trả lời sai để từ tự động vào đây ôn tập nhé!
            </Text>
            <Pressable
              style={[styles.btnEmptyBack, { backgroundColor: colors.indigo }]}
              onPress={() => router.back()}
            >
              <Text style={styles.btnEmptyBackText}>Quay lại</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
            {/* 2. PROGRESS BAR */}
            <View style={styles.progressSection}>
              <View style={styles.progressHeader}>
                <Text style={[styles.progressLabel, { color: colors.textMuted }]}>
                  TIẾN TRÌNH LUYỆN TẬP
                </Text>
                <Text style={[styles.progressCounter, { color: colors.indigo }]}>
                  {String(index + 1).padStart(2, "0")} <Text style={{ color: colors.textMuted }}>/</Text> {String(words.length).padStart(2, "0")}
                </Text>
              </View>
              <View
                style={[
                  styles.progressBarBg,
                  { backgroundColor: isDark ? "#1E293B" : "#E2E8F0" },
                ]}
              >
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${progressPercent}%`, backgroundColor: colors.indigo },
                  ]}
                />
              </View>
            </View>

            {/* 3. FLASHCARD CONTAINER */}
            <View style={styles.cardWrapper}>
              <Pressable
                onPressIn={onPressIn}
                onPressOut={onPressOut}
                onPress={handleFlip}
                style={styles.flipTouchable}
              >
                <View style={{ flex: 1, position: "relative" }}>
                  {/* MẶT TRƯỚC: TIẾNG NHẬT - KANJI, READING, VÍ DỤ */}
                  <Animated.View
                    style={[
                      styles.flashcardBox,
                      frontAnimatedStyle,
                      {
                        backgroundColor: colors.surface,
                        borderColor: isDark ? "rgba(245, 199, 107, 0.2)" : "rgba(176, 130, 46, 0.25)",
                      },
                    ]}
                  >
                    <View style={styles.cardHeader}>
                      <View style={styles.badgeRow}>
                        <View style={[styles.badge, { borderColor: "rgba(124, 92, 255, 0.3)" }]}>
                          <Text style={[styles.badgeText, { color: colors.purple }]}>
                            {parsed.level || parsed.jlpt || "TOCFL A1"}
                          </Text>
                        </View>
                        <View style={[styles.badge, { borderColor: "rgba(77, 168, 255, 0.3)" }]}>
                          <Text style={[styles.badgeText, { color: colors.blue }]}>
                            {getWordTypeLabel(parsed.type).toUpperCase()}
                          </Text>
                        </View>
                      </View>

                      {/* ⭐ NÚT ĐÁNH DẤU ƯU TIÊN DẠNG BUTTON SANG TRỌNG */}
                      <PriorityButton
                        word={parsed.word}
                        reading={parsed.reading || parsed.pinyin}
                        pinyin={parsed.pinyin}
                        meaning={parsed.meaning}
                        topicTitle={
                          isPriorityMode
                            ? ((words[index] as any)?.topicTitle || (parsed as any).topicTitle || undefined)
                            : (title && title !== "Ưu Tiên Ôn Tập" ? String(title) : undefined)
                        }
                        topicId={
                          isPriorityMode
                            ? ((words[index] as any)?.topicId || (parsed as any).topicId || undefined)
                            : (topicId ? String(topicId) : undefined)
                        }
                        variant="button"
                        onToggle={(active) => {
                          showToast(
                            active
                              ? `⭐ Đã thêm "${parsed.word}" vào Ưu Tiên Ôn Tập`
                              : `Đã bỏ ưu tiên cho "${parsed.word}"`
                          );
                        }}
                      />
                    </View>

                  <ScrollView
                    contentContainerStyle={styles.cardFrontScroll}
                    showsVerticalScrollIndicator={false}
                  >
                    {/* Chữ Hán Phồn Thể chính: bấm vào chữ nào phát âm chữ đó */}
                    <View style={styles.japaneseWrapper}>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", alignItems: "center" }}>
                        {parsed.word.split("").map((ch: string, cIdx: number) => (
                          <TouchableOpacity
                            key={cIdx}
                            activeOpacity={0.6}
                            onPress={(e) => {
                              if ((e as any)?.stopPropagation) (e as any).stopPropagation();
                              speak(ch);
                            }}
                          >
                            <Text style={[styles.cardTextSolid, { color: colors.indigo }]}>
                              {ch}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      {!hidePinyin && (parsed.pinyin ? (
                        <Text style={[styles.readingText, { color: colors.indigo }]}>
                          {parsed.pinyin}
                        </Text>
                      ) : parsed.reading && parsed.reading !== parsed.word ? (
                        <Text style={[styles.readingText, { color: colors.textMuted }]}>
                          {parsed.reading}
                        </Text>
                      ) : null)}
                      {!hidePinyin && parsed.zhuyin ? (
                        <Text style={[{ fontSize: 13, color: colors.amber, marginTop: 2, fontWeight: "600" }]}>
                          ({parsed.zhuyin})
                        </Text>
                      ) : null}
                    </View>

                    {/* 🔤 MẤY CÁI CONTAINER PHÍA DƯỚI CÓ TỪNG CHỮ + MŨI TÊN TỪNG CHỮ */}
                    {getChineseChars(parsed.word).length > 0 && (
                      <View style={styles.charContainerSection}>
                        <View style={styles.charSectionHeader}>
                          <Feather name="layers" size={13} color={colors.indigo} />
                          <Text style={[styles.charSectionTitle, { color: colors.indigo }]}>
                            TỪNG CHỮ (BẤM XEM NÉT & TỪ LIÊN QUAN)
                          </Text>
                        </View>
                        <View style={styles.charCardsRow}>
                          {getChineseChars(parsed.word).map((ch, cIdx) => {
                            const info = getCharInfo(ch);
                            return (
                              <TouchableOpacity
                                key={cIdx}
                                style={[
                                  styles.charBoxItem,
                                  {
                                    backgroundColor: isDark ? "rgba(255, 255, 255, 0.04)" : "#F8FAFC",
                                    borderColor: isDark ? "rgba(207, 172, 98, 0.35)" : "rgba(176, 130, 46, 0.3)",
                                  },
                                ]}
                                activeOpacity={0.7}
                                onPress={(e) => {
                                  if ((e as any)?.stopPropagation) (e as any).stopPropagation();
                                  speak(ch);
                                  openCharDetail(ch);
                                }}
                              >
                                <View style={styles.charBoxContent}>
                                  <Text style={[styles.charBoxChar, { color: colors.indigo }]}>
                                    {ch}
                                  </Text>
                                  <View style={styles.charBoxInfo}>
                                    <View style={styles.charBoxPillRow}>
                                      {info.pinyin ? (
                                        <View style={[styles.charPill, { backgroundColor: isDark ? "#2C1A10" : "#FEF3C7" }]}>
                                          <Text style={[styles.charPillText, { color: colors.amber }]}>
                                            {info.pinyin}
                                          </Text>
                                        </View>
                                      ) : null}
                                      {info.hanviet ? (
                                        <View style={[styles.charPill, { backgroundColor: isDark ? "#1E293B" : "#EEF2FF" }]}>
                                          <Text style={[styles.charPillText, { color: colors.indigo }]}>
                                            {info.hanviet}
                                          </Text>
                                        </View>
                                      ) : null}
                                    </View>
                                    {info.meaning ? (
                                      <Text style={[styles.charBoxMeaning, { color: colors.textMuted }]} numberOfLines={1}>
                                        {info.meaning}
                                      </Text>
                                    ) : null}
                                  </View>
                                </View>

                                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                  {/* LOA PHÁT ÂM RIÊNG TỪNG CHỮ */}
                                  <TouchableOpacity
                                    onPress={(e) => {
                                      if ((e as any)?.stopPropagation) (e as any).stopPropagation();
                                      speak(ch);
                                    }}
                                    style={[styles.charAudioBtnMini, { borderColor: colors.border }]}
                                    hitSlop={6}
                                  >
                                    <Feather name="volume-2" size={13} color={colors.indigo} />
                                  </TouchableOpacity>

                                  {/* MŨI TÊN TỪNG CHỮ */}
                                  <View style={[styles.charArrowIconWrap, { backgroundColor: colors.indigo }]}>
                                    <Feather name="arrow-right" size={13} color="#FFFFFF" />
                                  </View>
                                </View>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    )}

                    {/* Ví dụ mẫu */}
                    {parsed.examples && parsed.examples.length > 0 && (
                      <View style={styles.detailsSection}>
                        <View style={styles.sectionHeaderRow}>
                          <Feather name="book-open" size={14} color={colors.indigo} style={{ marginRight: 6 }} />
                          <Text style={[styles.sectionTitle, { color: colors.indigo }]}>
                            CÂU VÍ DỤ
                          </Text>
                        </View>
                        {parsed.examples.slice(0, 2).map((ex, idx) => (
                          <View key={idx} style={[styles.exampleItem, { borderLeftColor: colors.indigo }]}>
                            <Text style={[styles.exampleJp, { color: colors.text }]}>
                              {ex.cn || ex.jp}
                            </Text>
                            {!hidePinyin && ex.pinyin ? (
                              <Text style={{ fontSize: 12, color: colors.indigo, marginTop: 2 }}>
                                {ex.pinyin}
                              </Text>
                            ) : null}
                          </View>
                        ))}
                      </View>
                    )}
                  </ScrollView>

                  <View style={styles.cardFooter}>
                    <View style={styles.tapToFlipRow}>
                      <Feather name="refresh-cw" size={12} color={colors.textMuted} style={{ marginRight: 6 }} />
                      <Text style={[styles.tapToFlip, { color: colors.textMuted }]}>
                        Chạm để xem nghĩa tiếng Việt
                      </Text>
                    </View>
                  </View>
                </Animated.View>

                {/* MẶT SAU: NGHĨA TIẾNG VIỆT */}
                <Animated.View
                  style={[
                    styles.flashcardBox,
                    styles.flashcardBoxBack,
                    backAnimatedStyle,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.indigo,
                    },
                  ]}
                >
                  <View style={styles.cardHeader}>
                    <Text style={[styles.cardHeaderTag, { color: colors.indigo }]}>
                      Ý NGHĨA TIẾNG VIỆT
                    </Text>

                    {/* ⭐ NÚT ĐÁNH DẤU ƯU TIÊN DẠNG BUTTON SANG TRỌNG */}
                    <PriorityButton
                      word={parsed.word}
                      reading={parsed.reading || parsed.pinyin}
                      pinyin={parsed.pinyin}
                      meaning={parsed.meaning}
                      topicTitle={
                        isPriorityMode
                          ? ((words[index] as any)?.topicTitle || (parsed as any).topicTitle || undefined)
                          : (title && title !== "Ưu Tiên Ôn Tập" ? String(title) : undefined)
                      }
                      topicId={
                        isPriorityMode
                          ? ((words[index] as any)?.topicId || (parsed as any).topicId || undefined)
                          : (topicId ? String(topicId) : undefined)
                      }
                      variant="button"
                      onToggle={(active) => {
                        showToast(
                          active
                            ? `⭐ Đã thêm "${parsed.word}" vào Ưu Tiên Ôn Tập`
                            : `Đã bỏ ưu tiên cho "${parsed.word}"`
                        );
                      }}
                    />
                  </View>

                  <ScrollView
                    contentContainerStyle={styles.cardBackScroll}
                    showsVerticalScrollIndicator={false}
                  >
                    {/* Kanji nhỏ nhắc lại: Bấm chữ nào phát âm chữ đó */}
                    <View style={{ flexDirection: "row", justifyContent: "center", flexWrap: "wrap", marginBottom: 12 }}>
                      {parsed.word.split("").map((ch: string, cIdx: number) => (
                        <TouchableOpacity
                          key={cIdx}
                          activeOpacity={0.6}
                          onPress={(e) => {
                            if ((e as any)?.stopPropagation) (e as any).stopPropagation();
                            speak(ch);
                          }}
                        >
                          <Text style={[styles.backKanjiSmall, { color: colors.textMuted }]}>
                            {ch}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Nghĩa chính */}
                    <Text style={[styles.cardTextDef, { color: colors.text }]}>
                      {parsed.meaning}
                    </Text>

                    {/* 🔤 MẤY CÁI CONTAINER PHÍA DƯỚI CÓ TỪNG CHỮ + MŨI TÊN TỪNG CHỮ */}
                    {getChineseChars(parsed.word).length > 0 && (
                      <View style={[styles.charContainerSection, { marginTop: 12 }]}>
                        <View style={styles.charSectionHeader}>
                          <Feather name="layers" size={13} color={colors.indigo} />
                          <Text style={[styles.charSectionTitle, { color: colors.indigo }]}>
                            TỪNG CHỮ (BẤM XEM NÉT & TỪ LIÊN QUAN)
                          </Text>
                        </View>
                        <View style={styles.charCardsRow}>
                          {getChineseChars(parsed.word).map((ch, cIdx) => {
                            const info = getCharInfo(ch);
                            return (
                              <TouchableOpacity
                                key={cIdx}
                                style={[
                                  styles.charBoxItem,
                                  {
                                    backgroundColor: isDark ? "#121824" : "#F8FAFC",
                                    borderColor: isDark ? "rgba(207, 172, 98, 0.35)" : "rgba(176, 130, 46, 0.3)",
                                  },
                                ]}
                                activeOpacity={0.7}
                                onPress={(e) => {
                                  if ((e as any)?.stopPropagation) (e as any).stopPropagation();
                                  speak(ch);
                                  openCharDetail(ch);
                                }}
                              >
                                <View style={styles.charBoxContent}>
                                  <Text style={[styles.charBoxChar, { color: colors.indigo }]}>
                                    {ch}
                                  </Text>
                                  <View style={styles.charBoxInfo}>
                                    <View style={styles.charBoxPillRow}>
                                      {info.pinyin ? (
                                        <View style={[styles.charPill, { backgroundColor: isDark ? "#2C1A10" : "#FEF3C7" }]}>
                                          <Text style={[styles.charPillText, { color: colors.amber }]}>
                                            {info.pinyin}
                                          </Text>
                                        </View>
                                      ) : null}
                                      {info.hanviet ? (
                                        <View style={[styles.charPill, { backgroundColor: isDark ? "#1E293B" : "#EEF2FF" }]}>
                                          <Text style={[styles.charPillText, { color: colors.indigo }]}>
                                            {info.hanviet}
                                          </Text>
                                        </View>
                                      ) : null}
                                    </View>
                                    {info.meaning ? (
                                      <Text style={[styles.charBoxMeaning, { color: colors.textMuted }]} numberOfLines={1}>
                                        {info.meaning}
                                      </Text>
                                    ) : null}
                                  </View>
                                </View>

                                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                  {/* LOA PHÁT ÂM RIÊNG TỪNG CHỮ */}
                                  <TouchableOpacity
                                    onPress={(e) => {
                                      if ((e as any)?.stopPropagation) (e as any).stopPropagation();
                                      speak(ch);
                                    }}
                                    style={[styles.charAudioBtnMini, { borderColor: colors.border }]}
                                    hitSlop={6}
                                  >
                                    <Feather name="volume-2" size={13} color={colors.indigo} />
                                  </TouchableOpacity>

                                  {/* MŨI TÊN TỪNG CHỮ */}
                                  <View style={[styles.charArrowIconWrap, { backgroundColor: colors.indigo }]}>
                                    <Feather name="arrow-right" size={13} color="#FFFFFF" />
                                  </View>
                                </View>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    )}

                    {/* BẢNG CHIA THỂ ĐỘNG TỪ */}
                    {((parsed.type || "").toLowerCase().includes("verb") || 
                      !!(parsed.te || parsed.ta || parsed.nai || parsed.ru || parsed.masu)) && (
                      <View style={[
                        styles.conjugationCard, 
                        { 
                          backgroundColor: isDark ? "#121824" : "#F0F4F8", 
                          borderColor: isDark ? "rgba(77, 168, 255, 0.2)" : "rgba(77, 168, 255, 0.15)" 
                        }
                      ]}>
                        <View style={styles.notesHeader}>
                          <Feather name="layers" size={12} color={colors.blue} style={{ marginRight: 4 }} />
                          <Text style={[styles.notesTitle, { color: colors.blue }]}>CÁCH CHIA THỂ ĐỘNG TỪ</Text>
                        </View>
                        
                        <View style={styles.conjGrid}>
                          <View style={styles.conjRow}>
                            <Text style={[styles.conjLabel, { color: colors.textMuted }]}>Từ điển (-ru):</Text>
                            <Text style={[styles.conjValue, { color: colors.text }]}>{parsed.ru || parsed.word || "-"}</Text>
                          </View>
                          <View style={styles.conjRow}>
                            <Text style={[styles.conjLabel, { color: colors.textMuted }]}>Lịch sự (-masu):</Text>
                            <Text style={[styles.conjValue, { color: colors.text }]}>{parsed.masu || "-"}</Text>
                          </View>
                          <View style={styles.conjRow}>
                            <Text style={[styles.conjLabel, { color: colors.textMuted }]}>Phủ định (-nai):</Text>
                            <Text style={[styles.conjValue, { color: colors.text }]}>{parsed.nai || "-"}</Text>
                          </View>
                          <View style={styles.conjRow}>
                            <Text style={[styles.conjLabel, { color: colors.textMuted }]}>Liên kết (-te):</Text>
                            <Text style={[styles.conjValue, { color: colors.text }]}>{parsed.te || "-"}</Text>
                          </View>
                          <View style={styles.conjRow}>
                            <Text style={[styles.conjLabel, { color: colors.textMuted }]}>Quá khứ (-ta):</Text>
                            <Text style={[styles.conjValue, { color: colors.text }]}>{parsed.ta || "-"}</Text>
                          </View>
                        </View>
                      </View>
                    )}

                    {/* Ví dụ đầy đủ JP + VN */}
                    {parsed.examples && parsed.examples.length > 0 && (
                      <View style={styles.backExamplesSection}>
                        {parsed.examples.slice(0, 2).map((ex, idx) => (
                          <View key={idx} style={[styles.exampleItem, { borderLeftColor: colors.blue }]}>
                            <Text style={[styles.exampleJp, { color: colors.text }]}>
                              {ex.jp}
                            </Text>
                            <View style={styles.translateRow}>
                              <Feather name="arrow-right" size={10} color={colors.textMuted} style={{ marginRight: 4, marginTop: 4 }} />
                              <Text style={[styles.exampleVn, { color: colors.textMuted }]}>
                                {ex.vn}
                              </Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    )}

                    {parsed.notes ? (
                      <View style={[styles.notesSection, { borderColor: isDark ? "rgba(124, 92, 255, 0.15)" : "rgba(124, 92, 255, 0.1)" }]}>
                        <View style={styles.notesHeader}>
                          <Ionicons name="sparkles" size={12} color={colors.purple} style={{ marginRight: 4 }} />
                          <Text style={[styles.notesTitle, { color: colors.purple }]}>GHI CHÚ</Text>
                        </View>
                        <Text style={[styles.notesText, { color: colors.textMuted }]}>
                          {parsed.notes}
                        </Text>
                      </View>
                    ) : null}
                  </ScrollView>

                  <View style={[styles.cardFooter, { marginTop: 10 }]}>
                    <View style={styles.tapToFlipRow}>
                      <Feather name="refresh-cw" size={12} color={colors.textMuted} style={{ marginRight: 6 }} />
                      <Text style={[styles.tapToFlip, { color: colors.textMuted }]}>
                        Chạm để lật lại mặt trước
                      </Text>
                    </View>
                  </View>
                </Animated.View>
              </View>
            </Pressable>
          </View>

          {/* 4. BOTTOM CONTROLS */}
          <View style={styles.bottomControls}>
            <View
              style={[
                styles.pillContainer,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              {/* Nút Lùi */}
              <Pressable
                style={({ pressed }) => [
                  styles.navBtn,
                  index === 0 && { opacity: 0.25 },
                  pressed && index > 0 && { transform: [{ scale: 0.85 }] }
                ]}
                onPress={prevCard}
                disabled={index === 0}
              >
                <Feather
                  name="chevron-left"
                  size={24}
                  color={colors.text}
                />
              </Pressable>

              {/* Nút Phát âm */}
              <Pressable
                style={({ pressed }) => [
                  styles.playBtn,
                  { 
                    backgroundColor: colors.indigo, 
                    shadowColor: colors.indigo,
                    transform: [{ scale: pressed ? 0.92 : 1 }]
                  },
                ]}
                onPress={() => speak(parsed.word)}
              >
                <Feather name="volume-2" size={24} color="#050814" />
              </Pressable>

              {/* Nút Tiến */}
              <Pressable
                style={({ pressed }) => [
                  styles.navBtn,
                  index === words.length - 1 && { opacity: 0.25 },
                  pressed && index < words.length - 1 && { transform: [{ scale: 0.85 }] }
                ]}
                onPress={nextCard}
                disabled={index === words.length - 1}
              >
                <Feather
                  name="arrow-right"
                  size={24}
                  color={colors.text}
                />
              </Pressable>
            </View>
          </View>

          {/* 5. QUIZLET-STYLE VOCABULARY LIST */}
          <View style={styles.vocabListSection}>
            <Text style={[styles.vocabSectionTitle, { color: colors.text }]}>
              Từ vựng trong bài ({words.length})
            </Text>
            
            {words.map((w, idx) => {
              const wordParsed = parseWord(w.term, w.def);
              const isVerbWord = (wordParsed.type || "").toLowerCase().includes("verb") || 
                !!(wordParsed.te || wordParsed.ta || wordParsed.nai || wordParsed.ru || wordParsed.masu);
              
              return (
                <View 
                  key={idx} 
                  style={[
                    styles.vocabListItemCard, 
                    { 
                      backgroundColor: colors.surface, 
                      borderColor: colors.border 
                    }
                  ]}
                >
                  {/* Header row: Index & Action buttons */}
                  <View style={styles.vocabListItemHeader}>
                    <Text style={[styles.vocabIndexText, { color: colors.textMuted }]}>
                      #{idx + 1}
                    </Text>
                    <View style={styles.vocabItemActionGroup}>
                      {/* ⭐ Nút Lưu Ưu Tiên dạng button viên thuốc sang trọng, bấm tức thì 0ms */}
                      <PriorityButton
                        word={wordParsed.word}
                        reading={wordParsed.reading || wordParsed.pinyin}
                        pinyin={wordParsed.pinyin}
                        meaning={wordParsed.meaning}
                        topicTitle={
                          isPriorityMode
                            ? ((w as any).topicTitle || (wordParsed as any).topicTitle || undefined)
                            : (title && title !== "Ưu Tiên Ôn Tập" ? String(title) : undefined)
                        }
                        topicId={
                          isPriorityMode
                            ? ((w as any).topicId || (wordParsed as any).topicId || undefined)
                            : (topicId ? String(topicId) : undefined)
                        }
                        variant="pill"
                        onToggle={(active) => {
                          showToast(
                            active
                              ? `⭐ Đã thêm "${wordParsed.word}" vào Ưu Tiên Ôn Tập`
                              : `Đã bỏ ưu tiên cho "${wordParsed.word}"`
                          );
                        }}
                      />

                      {/* Nút Loa Phát Âm */}
                      <Pressable
                        onPress={() => speak(wordParsed.word)}
                        style={({ pressed }) => [
                          styles.vocabItemActionBtn,
                          {
                            backgroundColor: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.04)",
                            borderColor: isDark ? "#334155" : "#E2E8F0",
                            borderWidth: 1,
                            transform: [{ scale: pressed ? 0.88 : 1 }],
                          },
                        ]}
                        hitSlop={6}
                      >
                        <Feather name="volume-2" size={16} color={colors.indigo} />
                      </Pressable>
                    </View>
                  </View>

                  {/* Main Content: Split layout (Word on left, definition on right) */}
                  <View style={styles.vocabListItemMain}>
                    {/* Left Column: Japanese Word / Furigana */}
                    <View style={styles.vocabItemLeft}>
                      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                        {wordParsed.word.split("").map((ch: string, cIdx: number) => (
                          <TouchableOpacity
                            key={cIdx}
                            activeOpacity={0.6}
                            onPress={() => speak(ch)}
                          >
                            <Text style={[styles.vocabWordText, { color: colors.indigo }]}>
                              {ch}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      {!hidePinyin && (wordParsed.pinyin ? (
                        <Text style={[styles.vocabReadingText, { color: colors.amber }]}>
                          {wordParsed.pinyin}
                        </Text>
                      ) : wordParsed.reading && wordParsed.reading !== wordParsed.word ? (
                        <Text style={[styles.vocabReadingText, { color: colors.textMuted }]}>
                          {wordParsed.reading}
                        </Text>
                      ) : null)}
                      {wordParsed.jlpt && (
                        <View style={[styles.vocabJlptBadge, { borderColor: "rgba(124, 92, 255, 0.2)" }]}>
                          <Text style={[styles.vocabJlptText, { color: colors.purple }]}>
                            {wordParsed.jlpt}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Divider line between left & right columns */}
                    <View style={[styles.vocabItemColDivider, { backgroundColor: colors.border }]} />

                    {/* Right Column: Definition */}
                    <View style={styles.vocabItemRight}>
                      <Text style={[styles.vocabDefText, { color: colors.text }]}>
                        {wordParsed.meaning}
                      </Text>
                      
                      {wordParsed.notes ? (
                        <Text style={[styles.vocabNotesText, { color: colors.textMuted }]}>
                          {wordParsed.notes}
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  {/* Chi tiết từng chữ trong list item */}
                  {getChineseChars(wordParsed.word).length > 0 && (
                    <View style={styles.listCharChipsRow}>
                      <Text style={[styles.listCharChipsLabel, { color: colors.textMuted }]}>
                        Từng chữ:
                      </Text>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, flex: 1 }}>
                        {getChineseChars(wordParsed.word).map((ch, ci) => {
                          const info = getCharInfo(ch);
                          return (
                            <TouchableOpacity
                              key={ci}
                              onPress={() => {
                                speak(ch);
                                openCharDetail(ch);
                              }}
                              style={[
                                styles.listCharChip,
                                {
                                  backgroundColor: isDark ? "rgba(255, 255, 255, 0.05)" : "#F1F5F9",
                                  borderColor: colors.border,
                                },
                              ]}
                              activeOpacity={0.7}
                            >
                              <Text style={[styles.listCharChipText, { color: colors.indigo }]}>{ch}</Text>
                              {info.pinyin ? (
                                <Text style={[styles.listCharChipPinyin, { color: colors.amber }]}>
                                  {info.pinyin}
                                </Text>
                              ) : null}
                              <Feather name="arrow-right" size={11} color={colors.indigo} style={{ marginLeft: 2 }} />
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  )}

                  {/* Conjugation section if verb */}
                  {isVerbWord && (
                    <View style={[
                      styles.vocabItemConjBox, 
                      { 
                        backgroundColor: isDark ? "#121824" : "#F0F4F8",
                        borderColor: colors.border
                      }
                    ]}>
                      <Text style={[styles.vocabConjTitle, { color: colors.blue }]}>CÁCH CHIA THỂ ĐỘNG TỪ</Text>
                      <View style={styles.vocabConjBadgesRow}>
                        {wordParsed.ru || wordParsed.word ? (
                          <View style={[styles.vocabConjBadge, { backgroundColor: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.04)" }]}>
                            <Text style={[styles.vocabConjBadgeLabel, { color: colors.textMuted }]}>Từ điển (-ru)</Text>
                            <Text style={[styles.vocabConjBadgeValue, { color: colors.text }]}>{wordParsed.ru || wordParsed.word}</Text>
                          </View>
                        ) : null}
                        {wordParsed.masu ? (
                          <View style={[styles.vocabConjBadge, { backgroundColor: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.04)" }]}>
                            <Text style={[styles.vocabConjBadgeLabel, { color: colors.textMuted }]}>Lịch sự (-masu)</Text>
                            <Text style={[styles.vocabConjBadgeValue, { color: colors.text }]}>{wordParsed.masu}</Text>
                          </View>
                        ) : null}
                        {wordParsed.te ? (
                          <View style={[styles.vocabConjBadge, { backgroundColor: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.04)" }]}>
                            <Text style={[styles.vocabConjBadgeLabel, { color: colors.textMuted }]}>Liên kết (-te)</Text>
                            <Text style={[styles.vocabConjBadgeValue, { color: colors.text }]}>{wordParsed.te}</Text>
                          </View>
                        ) : null}
                        {wordParsed.ta ? (
                          <View style={[styles.vocabConjBadge, { backgroundColor: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.04)" }]}>
                            <Text style={[styles.vocabConjBadgeLabel, { color: colors.textMuted }]}>Quá khứ (-ta)</Text>
                            <Text style={[styles.vocabConjBadgeValue, { color: colors.text }]}>{wordParsed.ta}</Text>
                          </View>
                        ) : null}
                        {wordParsed.nai ? (
                          <View style={[styles.vocabConjBadge, { backgroundColor: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.04)" }]}>
                            <Text style={[styles.vocabConjBadgeLabel, { color: colors.textMuted }]}>Phủ định (-nai)</Text>
                            <Text style={[styles.vocabConjBadgeValue, { color: colors.text }]}>{wordParsed.nai}</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}
      {/* 🧭 MODAL KHÁM PHÁ CÁCH VIẾT VÀ CÁC TỪ LIÊN QUAN (EXPLORE VOCAB MODAL) */}
      <Modal
        visible={exploreStack.length > 0}
        animationType="slide"
        transparent={false}
        onRequestClose={closeExplore}
      >
        <SafeAreaView style={[styles.modalSafeArea, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
            <View style={styles.modalHeaderLeft}>
              {exploreStack.length > 1 ? (
                <TouchableOpacity onPress={popExplore} style={[styles.modalBackBtn, { borderColor: colors.border }]} activeOpacity={0.7}>
                  <Feather name="arrow-left" size={18} color={colors.text} />
                  <Text style={[styles.modalBackText, { color: colors.text }]}>Quay lại</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.modalHeaderTitleGroup}>
                  <MaterialIcons name="explore" size={20} color={colors.indigo} />
                  <Text style={[styles.modalHeaderTitle, { color: colors.text }]}>
                    Tra Cứu & Khám Phá
                  </Text>
                </View>
              )}
            </View>

            <TouchableOpacity onPress={closeExplore} style={[styles.modalCloseBtn, { borderColor: colors.border }]} activeOpacity={0.7}>
              <Feather name="x" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Breadcrumb path */}
          {exploreStack.length > 0 && (
            <View style={[styles.breadcrumbContainer, { backgroundColor: isDark ? "#0A0E1A" : "#F1F5F9", borderBottomColor: colors.border }]}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.breadcrumbScroll}>
                {exploreStack.map((item, bIdx) => {
                  const isCurrent = bIdx === exploreStack.length - 1;
                  const label = item.type === "char" ? `Chữ 【 ${item.char} 】` : item.word.word;
                  return (
                    <View key={bIdx} style={styles.breadcrumbItemWrap}>
                      <TouchableOpacity
                        onPress={() => jumpExplore(bIdx)}
                        disabled={isCurrent}
                        style={[
                          styles.breadcrumbChip,
                          isCurrent
                            ? { backgroundColor: colors.indigo, borderColor: colors.indigo }
                            : { backgroundColor: colors.surface, borderColor: colors.border },
                        ]}
                      >
                        <Text style={[styles.breadcrumbText, { color: isCurrent ? "#FFFFFF" : colors.textMuted }]}>
                          {label}
                        </Text>
                      </TouchableOpacity>
                      {!isCurrent && (
                        <Feather name="chevron-right" size={14} color={colors.textMuted} style={{ marginHorizontal: 4 }} />
                      )}
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Modal Body */}
          {exploreStack.length > 0 && (() => {
            const activeItem = exploreStack[exploreStack.length - 1];
            if (activeItem.type === "char") {
              const ch = activeItem.char;
              const info = getCharInfo(ch);
              const related = getRelatedWordsForChar(ch);

              return (
                <ScrollView
                  style={{ flex: 1 }}
                  contentContainerStyle={styles.modalContentScroll}
                  showsVerticalScrollIndicator={false}
                >
                  {/* Character Hero Card */}
                  <View style={[styles.charHeroCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.charHeroTop}>
                      <Text style={[styles.charHeroBig, { color: colors.text }]}>{ch}</Text>
                      <View style={styles.charHeroMeta}>
                        <View style={styles.charHeroPillRow}>
                          {info.pinyin ? (
                            <View style={[styles.heroBadge, { backgroundColor: isDark ? "#2C1A10" : "#FEF3C7" }]}>
                              <Text style={[styles.heroBadgeText, { color: colors.amber }]}>
                                Pinyin: {info.pinyin}
                              </Text>
                            </View>
                          ) : null}
                          {info.hanviet ? (
                            <View style={[styles.heroBadge, { backgroundColor: isDark ? "#121824" : "#EEF2FF" }]}>
                              <Text style={[styles.heroBadgeText, { color: colors.indigo }]}>
                                Hán-Việt: {info.hanviet}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={[styles.charHeroMeaning, { color: colors.text }]}>
                          {info.meaning || "Chữ Hán Phồn Thể"}
                        </Text>
                      </View>

                      <TouchableOpacity
                        onPress={() => speak(ch)}
                        style={[styles.charHeroAudioBtn, { backgroundColor: colors.indigo }]}
                        activeOpacity={0.8}
                      >
                        <Feather name="volume-2" size={20} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* ✍️ CÁCH VIẾT TỪNG NÉT (HANZI WRITER) */}
                  <View style={[styles.strokeSectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.sectionHeaderLine}>
                      <Feather name="edit-3" size={16} color={colors.indigo} />
                      <Text style={[styles.sectionHeading, { color: colors.text }]}>
                        CÁCH VIẾT CHỮ "【 {ch} 】"
                      </Text>
                    </View>
                    <Text style={[styles.sectionSubtext, { color: colors.textMuted }]}>
                      Mô phỏng nét bút chuẩn, thứ tự viết (Stroke Order) & tập tô theo nét mờ
                    </Text>
                    <View style={styles.strokeCenterWrapper}>
                      <StrokeOrderPractice
                        character={ch}
                        pinyin={info.pinyin}
                        vietnameseReading={info.hanviet}
                        size={160}
                      />
                    </View>
                  </View>

                  {/* 📚 CÁC TỪ LIÊN QUAN TRONG KHO CÓ CHỨA CHỮ NÀY */}
                  <View style={styles.relatedSectionWrap}>
                    <View style={styles.sectionHeaderLine}>
                      <Feather name="book" size={16} color={colors.indigo} />
                      <Text style={[styles.sectionHeading, { color: colors.text }]}>
                        TỪ LIÊN QUAN CÓ CHỨA CHỮ "【 {ch} 】" ({related.length})
                      </Text>
                    </View>
                    <Text style={[styles.sectionSubtext, { color: colors.textMuted }]}>
                      Trích từ kho từ vựng TOCFL A1/A2 và các bài học của bạn
                    </Text>

                    {related.length === 0 ? (
                      <View style={[styles.emptyRelBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <Feather name="info" size={24} color={colors.textMuted} />
                        <Text style={[styles.emptyRelText, { color: colors.textMuted }]}>
                          Chưa có từ ghép nào khác trong kho chứa chữ "{ch}".
                        </Text>
                      </View>
                    ) : (
                      <View style={{ marginTop: 10, gap: 10 }}>
                        {related.map((relItem, rIdx) => (
                          <TouchableOpacity
                            key={rIdx}
                            style={[styles.relCardItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
                            activeOpacity={0.7}
                            onPress={() => pushExplore({ type: "word", word: relItem })}
                          >
                            <View style={{ flex: 1, paddingRight: 8 }}>
                              <View style={styles.relCardTopRow}>
                                <View style={{ flexDirection: "row", alignItems: "center" }}>
                                  {relItem.word.split("").map((c: string, ci: number) => (
                                    <TouchableOpacity
                                      key={ci}
                                      onPress={(e) => {
                                        if ((e as any)?.stopPropagation) (e as any).stopPropagation();
                                        speak(c);
                                      }}
                                      activeOpacity={0.6}
                                    >
                                      <Text style={[styles.relCardWord, { color: colors.indigo }]}>{c}</Text>
                                    </TouchableOpacity>
                                  ))}
                                </View>
                                {relItem.pinyin ? (
                                  <Text style={[styles.relCardPinyin, { color: colors.amber }]}>
                                    {relItem.pinyin}
                                  </Text>
                                ) : null}
                                {relItem.level ? (
                                  <View style={[styles.relCardLevelBadge, { borderColor: "rgba(124, 92, 255, 0.3)" }]}>
                                    <Text style={[styles.relCardLevelText, { color: colors.purple }]}>
                                      {relItem.level}
                                    </Text>
                                  </View>
                                ) : null}
                              </View>
                              <Text style={[styles.relCardMeaning, { color: colors.text }]} numberOfLines={2}>
                                {relItem.meaning}
                              </Text>
                            </View>

                            <View style={styles.relCardRightActions}>
                              <TouchableOpacity
                                onPress={(e) => {
                                  if ((e as any)?.stopPropagation) (e as any).stopPropagation();
                                  speak(relItem.word);
                                }}
                                style={[styles.relAudioBtn, { borderColor: colors.border }]}
                                hitSlop={6}
                              >
                                <Feather name="volume-2" size={16} color={colors.indigo} />
                              </TouchableOpacity>

                              <View style={[styles.relArrowBtn, { backgroundColor: colors.indigo }]}>
                                <Feather name="arrow-right" size={13} color="#FFFFFF" />
                              </View>
                            </View>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                </ScrollView>
              );
            } else {
              // Word detail
              const w = activeItem.word;
              const wordChars = getChineseChars(w.word);
              const compounds = getRelatedWordsForCompound(w.word);

              return (
                <ScrollView
                  style={{ flex: 1 }}
                  contentContainerStyle={styles.modalContentScroll}
                  showsVerticalScrollIndicator={false}
                >
                  {/* Word Hero Card */}
                  <View style={[styles.wordHeroCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.wordHeroTopRow}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                          {w.word.split("").map((ch: string, cIdx: number) => (
                            <TouchableOpacity
                              key={cIdx}
                              activeOpacity={0.6}
                              onPress={(e) => {
                                if ((e as any)?.stopPropagation) (e as any).stopPropagation();
                                speak(ch);
                              }}
                            >
                              <Text style={[styles.wordHeroText, { color: colors.indigo }]}>
                                {ch}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                        {w.pinyin ? (
                          <Text style={[styles.wordHeroPinyin, { color: colors.amber }]}>
                            {w.pinyin}
                          </Text>
                        ) : null}
                      </View>
                      <TouchableOpacity
                        onPress={() => speak(w.word)}
                        style={[styles.wordHeroAudioBtn, { backgroundColor: colors.indigo }]}
                        activeOpacity={0.8}
                      >
                        <Feather name="volume-2" size={22} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>

                    <View style={[styles.wordHeroDefBox, { backgroundColor: isDark ? "#120E08" : "#F8F6F0" }]}>
                      <Text style={[styles.wordHeroDefText, { color: colors.text }]}>
                        {w.meaning}
                      </Text>
                    </View>
                  </View>

                  {/* 🔤 PHÂN TÍCH TỪNG CHỮ CỦA TỪ NÀY (BẤM TIẾP ĐỂ XEM NÉT & TỪ LIÊN QUAN) */}
                  {wordChars.length > 0 && (
                    <View style={styles.subCharsSection}>
                      <View style={styles.sectionHeaderLine}>
                        <Feather name="layers" size={16} color={colors.indigo} />
                        <Text style={[styles.sectionHeading, { color: colors.text }]}>
                          PHÂN TÍCH TỪNG CHỮ CỦA "{w.word}"
                        </Text>
                      </View>
                      <Text style={[styles.sectionSubtext, { color: colors.textMuted }]}>
                        Bấm vào từng chữ để xem cách viết và khám phá các từ liên quan khác
                      </Text>

                      <View style={{ marginTop: 10, gap: 8 }}>
                        {wordChars.map((charItem, ci) => {
                          const charInfo = getCharInfo(charItem);
                          return (
                            <TouchableOpacity
                              key={ci}
                              style={[styles.charBoxItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
                              activeOpacity={0.7}
                              onPress={() => pushExplore({ type: "char", char: charItem })}
                            >
                              <View style={styles.charBoxContent}>
                                <Text style={[styles.charBoxChar, { color: colors.indigo }]}>
                                  {charItem}
                                </Text>
                                <View style={styles.charBoxInfo}>
                                  <View style={styles.charBoxPillRow}>
                                    {charInfo.pinyin ? (
                                      <View style={[styles.charPill, { backgroundColor: isDark ? "#2C1A10" : "#FEF3C7" }]}>
                                        <Text style={[styles.charPillText, { color: colors.amber }]}>
                                          {charInfo.pinyin}
                                        </Text>
                                      </View>
                                    ) : null}
                                    {charInfo.hanviet ? (
                                      <View style={[styles.charPill, { backgroundColor: isDark ? "#121824" : "#EEF2FF" }]}>
                                        <Text style={[styles.charPillText, { color: colors.indigo }]}>
                                          {charInfo.hanviet}
                                        </Text>
                                      </View>
                                    ) : null}
                                  </View>
                                  {charInfo.meaning ? (
                                    <Text style={[styles.charBoxMeaning, { color: colors.textMuted }]} numberOfLines={1}>
                                      {charInfo.meaning}
                                    </Text>
                                  ) : null}
                                </View>
                              </View>

                              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                <TouchableOpacity
                                  onPress={(e) => {
                                    if ((e as any)?.stopPropagation) (e as any).stopPropagation();
                                    speak(charItem);
                                  }}
                                  style={[styles.charAudioBtnMini, { borderColor: colors.border }]}
                                  hitSlop={6}
                                >
                                  <Feather name="volume-2" size={13} color={colors.indigo} />
                                </TouchableOpacity>

                                <View style={[styles.charArrowIconWrap, { backgroundColor: colors.indigo }]}>
                                  <Feather name="arrow-right" size={13} color="#FFFFFF" />
                                </View>
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  )}

                  {/* 📚 CÁC TỪ GHÉP KHÁC CÓ CHỨA CỤM NÀY */}
                  {compounds.length > 0 && (
                    <View style={[styles.relatedSectionWrap, { marginTop: 18 }]}>
                      <View style={styles.sectionHeaderLine}>
                        <Feather name="link" size={16} color={colors.indigo} />
                        <Text style={[styles.sectionHeading, { color: colors.text }]}>
                          CÁC TỪ GHÉP KHÁC CÓ CHỨA "{w.word}" ({compounds.length})
                        </Text>
                      </View>

                      <View style={{ marginTop: 10, gap: 10 }}>
                        {compounds.map((cmpItem, cpIdx) => (
                          <TouchableOpacity
                            key={cpIdx}
                            style={[styles.relCardItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
                            activeOpacity={0.7}
                            onPress={() => pushExplore({ type: "word", word: cmpItem })}
                          >
                            <View style={{ flex: 1, paddingRight: 8 }}>
                              <View style={styles.relCardTopRow}>
                                <Text style={[styles.relCardWord, { color: colors.indigo }]}>
                                  {cmpItem.word}
                                </Text>
                                {cmpItem.pinyin ? (
                                  <Text style={[styles.relCardPinyin, { color: colors.amber }]}>
                                    {cmpItem.pinyin}
                                  </Text>
                                ) : null}
                              </View>
                              <Text style={[styles.relCardMeaning, { color: colors.text }]} numberOfLines={2}>
                                {cmpItem.meaning}
                              </Text>
                            </View>

                            <View style={styles.relCardRightActions}>
                              <TouchableOpacity
                                onPress={(e) => {
                                  if ((e as any)?.stopPropagation) (e as any).stopPropagation();
                                  speak(cmpItem.word);
                                }}
                                style={[styles.relAudioBtn, { borderColor: colors.border }]}
                                hitSlop={6}
                              >
                                <Feather name="volume-2" size={16} color={colors.indigo} />
                              </TouchableOpacity>
                              <View style={[styles.relArrowBtn, { backgroundColor: colors.indigo }]}>
                                <Feather name="arrow-right" size={13} color="#FFFFFF" />
                              </View>
                            </View>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}
                </ScrollView>
              );
            }
          })()}
        </SafeAreaView>
      </Modal>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  toastBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  toastText: {
    fontSize: 13,
    fontWeight: "700",
    flex: 1,
  },
  filterSection: {
    marginVertical: 8,
  },
  filterScroll: {
    paddingHorizontal: 20,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: "700",
  },
  priorityStarBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  priorityStarBtnText: {
    fontSize: 11,
    fontWeight: "700",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  btnEmptyBack: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
  },
  btnEmptyBackText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  safeArea: { flex: 1 },
  container: { flex: 1 },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 20,
  },
  btnBackEmpty: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  btnBackText: { color: "#050814", fontWeight: "bold" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 15,
  },
  btnIconHeader: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  headerTitleWrap: { flex: 1, alignItems: "center", paddingHorizontal: 10 },
  headerTitle: { fontSize: 16, fontWeight: "800", letterSpacing: 0.5 },
  headerSub: {
    fontSize: 10,
    fontWeight: "800",
    marginTop: 2,
    letterSpacing: 1.5,
  },
  progressSection: { paddingHorizontal: 20, paddingBottom: 15 },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  progressLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 1.5 },
  progressCounter: { 
    fontSize: 12, 
    fontWeight: "700",
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  progressBarBg: {
    height: 4,
    width: "100%",
    borderRadius: 10,
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 10,
  },
  cardWrapper: {
    width: "100%",
    paddingHorizontal: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  flipTouchable: { width: "100%", height: height * 0.52 },
  flashcardBox: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    borderRadius: 28,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
    borderWidth: 1.5,
    backfaceVisibility: "hidden",
    justifyContent: "space-between",
  },
  flashcardBoxBack: {
    backfaceVisibility: "hidden",
  },
  cardHeader: {
    alignItems: "center",
    width: "100%",
    paddingBottom: 10,
  },
  cardHeaderTag: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2.5,
  },
  cardFrontScroll: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 10,
  },
  cardBackScroll: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 10,
  },
  cardTextDef: {
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
    lineHeight: 34,
    letterSpacing: 0.2,
    marginBottom: 8,
  },
  cardTextSolid: {
    fontSize: 36,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: 0.5,
  },
  japaneseWrapper: {
    alignItems: "center",
    marginBottom: 16,
  },
  readingText: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 8,
    letterSpacing: 2,
  },
  cardFooter: {
    alignItems: "center",
    width: "100%",
    paddingTop: 10,
  },
  badgeRow: {
    flexDirection: "row",
    gap: 8,
  },
  badge: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: "transparent",
  },
  badgeText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
  },
  tapToFlipRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  tapToFlip: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  detailsSection: {
    width: "100%",
    borderTopWidth: 1,
    borderTopColor: "rgba(245, 199, 107, 0.1)",
    paddingTop: 16,
    marginTop: 16,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  exampleItem: {
    marginBottom: 12,
    paddingLeft: 12,
    borderLeftWidth: 1.5,
  },
  exampleJp: {
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 22,
  },
  exampleVn: {
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
  },
  translateRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 2,
  },
  backKanjiSmall: {
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 6,
    letterSpacing: 1,
  },
  backExamplesSection: {
    width: "100%",
    borderTopWidth: 1,
    borderTopColor: "rgba(245, 199, 107, 0.1)",
    paddingTop: 16,
    marginTop: 16,
  },
  notesSection: {
    width: "100%",
    marginTop: 16,
    padding: 12,
    borderWidth: 1,
    borderRadius: 16,
    backgroundColor: "rgba(124, 92, 255, 0.04)",
  },
  notesHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  notesTitle: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  notesText: {
    fontSize: 11,
    lineHeight: 18,
  },
  bottomControls: { 
    paddingBottom: height * 0.05, 
    paddingTop: 20, 
    alignItems: "center" 
  },
  pillContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 50,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 18,
    elevation: 6,
    borderWidth: 1,
  },
  navBtn: { padding: 12 },
  playBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  conjugationCard: {
    width: "100%",
    marginTop: 16,
    padding: 12,
    borderWidth: 1,
    borderRadius: 16,
  },
  conjGrid: {
    marginTop: 8,
    gap: 6,
  },
  conjRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 2,
  },
  conjLabel: {
    fontSize: 12,
    fontWeight: "700",
  },
  conjValue: {
    fontSize: 13,
    fontWeight: "800",
  },
  vocabListSection: {
    paddingHorizontal: 20,
    marginTop: 30,
    width: "100%",
  },
  vocabSectionTitle: {
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  vocabListItemCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 18,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.02,
    shadowRadius: 10,
    elevation: 2,
  },
  vocabListItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
    paddingBottom: 8,
  },
  vocabIndexText: {
    fontSize: 12,
    fontWeight: "800",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  vocabItemActionGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  vocabItemActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  vocabListItemMain: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  vocabItemLeft: {
    flex: 1.2,
    alignItems: "flex-start",
  },
  vocabWordText: {
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
  vocabReadingText: {
    fontSize: 13,
    fontWeight: "700",
    marginTop: 4,
    letterSpacing: 0.5,
  },
  vocabJlptBadge: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 8,
  },
  vocabJlptText: {
    fontSize: 9,
    fontWeight: "800",
  },
  vocabItemColDivider: {
    width: 1,
    alignSelf: "stretch",
    opacity: 0.3,
  },
  vocabItemRight: {
    flex: 1.5,
    alignItems: "flex-start",
  },
  vocabDefText: {
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 22,
  },
  vocabNotesText: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
  },
  vocabItemConjBox: {
    marginTop: 14,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    width: "100%",
  },
  vocabConjTitle: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 8,
  },
  vocabConjBadgesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  vocabConjBadge: {
    flexDirection: "column",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    minWidth: 50,
  },
  vocabConjBadgeLabel: {
    fontSize: 8,
    fontWeight: "800",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  vocabConjBadgeValue: {
    fontSize: 11,
    fontWeight: "800",
  },
  // 🔤 Character breakdown container in card
  charContainerSection: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(150, 150, 150, 0.2)",
    width: "100%",
  },
  charSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  charSectionTitle: {
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  charCardsRow: {
    gap: 8,
  },
  charBoxItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  charBoxContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 8,
  },
  charBoxChar: {
    fontSize: 24,
    fontWeight: "800",
    width: 32,
    textAlign: "center",
  },
  charBoxInfo: {
    flex: 1,
    marginLeft: 10,
  },
  charBoxPillRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  charPill: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 5,
  },
  charPillText: {
    fontSize: 11,
    fontWeight: "700",
  },
  charBoxMeaning: {
    fontSize: 12,
  },
  charArrowIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  charAudioBtnMini: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  // List item mini chips
  listCharChipsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: "rgba(150, 150, 150, 0.2)",
    gap: 6,
  },
  listCharChipsLabel: {
    fontSize: 11,
    fontWeight: "600",
  },
  listCharChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  listCharChipText: {
    fontSize: 13,
    fontWeight: "800",
  },
  listCharChipPinyin: {
    fontSize: 10,
    fontWeight: "600",
  },
  // Modal styles
  modalSafeArea: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  modalHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  modalBackBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  modalBackText: {
    fontSize: 13,
    fontWeight: "700",
  },
  modalHeaderTitleGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  modalHeaderTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  breadcrumbContainer: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  breadcrumbScroll: {
    flexDirection: "row",
    alignItems: "center",
  },
  breadcrumbItemWrap: {
    flexDirection: "row",
    alignItems: "center",
  },
  breadcrumbChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  breadcrumbText: {
    fontSize: 12,
    fontWeight: "700",
  },
  modalContentScroll: {
    padding: 16,
    paddingBottom: 40,
  },
  charHeroCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
  },
  charHeroTop: {
    flexDirection: "row",
    alignItems: "center",
  },
  charHeroBig: {
    fontSize: 44,
    fontWeight: "900",
    width: 56,
    textAlign: "center",
  },
  charHeroMeta: {
    flex: 1,
    marginLeft: 14,
  },
  charHeroPillRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
    marginBottom: 6,
  },
  heroBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  heroBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  charHeroMeaning: {
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
  },
  charHeroAudioBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
  },
  strokeSectionCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
  },
  sectionHeaderLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  sectionSubtext: {
    fontSize: 12,
    marginBottom: 10,
    lineHeight: 17,
  },
  strokeCenterWrapper: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 6,
  },
  relatedSectionWrap: {
    marginTop: 4,
  },
  emptyRelBox: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    gap: 8,
  },
  emptyRelText: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  relCardItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  relCardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 4,
  },
  relCardWord: {
    fontSize: 17,
    fontWeight: "800",
  },
  relCardPinyin: {
    fontSize: 12.5,
    fontWeight: "600",
  },
  relCardLevelBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  relCardLevelText: {
    fontSize: 10,
    fontWeight: "700",
  },
  relCardMeaning: {
    fontSize: 13,
    lineHeight: 19,
  },
  relCardRightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginLeft: 6,
  },
  relAudioBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  relArrowBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  wordHeroCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
  },
  wordHeroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  wordHeroText: {
    fontSize: 32,
    fontWeight: "900",
  },
  wordHeroPinyin: {
    fontSize: 15,
    fontWeight: "700",
    marginTop: 2,
  },
  wordHeroAudioBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },
  wordHeroDefBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
  },
  wordHeroDefText: {
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 22,
  },
  subCharsSection: {
    marginTop: 6,
  },
});
