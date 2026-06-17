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
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import * as Speech from "expo-speech";
import { LinearGradient } from "expo-linear-gradient";
import { Feather, Ionicons } from "@expo/vector-icons";
import api from "../../services/api";
import { useTheme } from "@/src/context/ThemeContext";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
} from "react-native-reanimated";
import { parseWord } from "../../src/utils/wordParser";

const { height } = Dimensions.get("window");

export default function CardViewer() {
  const { colors, isDark } = useTheme();
  const { topicId, title } = useLocalSearchParams();
  const router = useRouter();
  const [words, setWords] = useState<any[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  // Reanimated Y-axis flip value (0 for front, 180 for back)
  const rotate = useSharedValue(0);
  // Tactile press scale value
  const scale = useSharedValue(1);

  useEffect(() => {
    api
      .get("/api/vocab/lists")
      .then((res) => {
        const list = res.data.data.find((l: any) => l._id === topicId);
        if (list && list.words) setWords(list.words);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [topicId]);

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
    const cleanText = text
      .replace(/\s*\(.*?\)\s*/g, "")
      .split("/")[0]
      .trim();
    Speech.speak(cleanText, { language: "ja-JP", rate: 0.85 });
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
                          {parsed.jlpt || "N5"}
                        </Text>
                      </View>
                      <View style={[styles.badge, { borderColor: "rgba(77, 168, 255, 0.3)" }]}>
                        <Text style={[styles.badgeText, { color: colors.blue }]}>
                          {getWordTypeLabel(parsed.type).toUpperCase()}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <ScrollView
                    contentContainerStyle={styles.cardFrontScroll}
                    showsVerticalScrollIndicator={false}
                  >
                    {/* Kanji chính */}
                    <View style={styles.japaneseWrapper}>
                      <Text style={[styles.cardTextSolid, { color: colors.indigo }]}>
                        {parsed.word}
                      </Text>
                      {parsed.reading && parsed.reading !== parsed.word && (
                        <Text style={[styles.readingText, { color: colors.textMuted }]}>
                          {parsed.reading}
                        </Text>
                      )}
                    </View>

                    {/* Ví dụ tiếng Nhật (chỉ hiện phần JP) */}
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
                              {ex.jp}
                            </Text>
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
                  </View>

                  <ScrollView
                    contentContainerStyle={styles.cardBackScroll}
                    showsVerticalScrollIndicator={false}
                  >
                    {/* Kanji nhỏ nhắc lại */}
                    <Text style={[styles.backKanjiSmall, { color: colors.textMuted }]}>
                      {parsed.word}
                    </Text>

                    {/* Nghĩa chính */}
                    <Text style={[styles.cardTextDef, { color: colors.text }]}>
                      {parsed.meaning}
                    </Text>

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
                      {/* Speak Button */}
                      <Pressable
                        onPress={() => speak(wordParsed.word)}
                        style={({ pressed }) => [
                          styles.vocabItemActionBtn,
                          { backgroundColor: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.04)" },
                          pressed && { opacity: 0.7 }
                        ]}
                      >
                        <Feather name="volume-2" size={16} color={colors.indigo} />
                      </Pressable>
                    </View>
                  </View>

                  {/* Main Content: Split layout (Word on left, definition on right) */}
                  <View style={styles.vocabListItemMain}>
                    {/* Left Column: Japanese Word / Furigana */}
                    <View style={styles.vocabItemLeft}>
                      <Text style={[styles.vocabWordText, { color: colors.indigo }]}>
                        {wordParsed.word}
                      </Text>
                      {wordParsed.reading && wordParsed.reading !== wordParsed.word && (
                        <Text style={[styles.vocabReadingText, { color: colors.textMuted }]}>
                          {wordParsed.reading}
                        </Text>
                      )}
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
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
    width: 32,
    height: 32,
    borderRadius: 8,
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
});
