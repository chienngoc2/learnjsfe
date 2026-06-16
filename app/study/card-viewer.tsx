import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  SafeAreaView,
  Pressable,
  Platform,
  ScrollView,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import * as Speech from "expo-speech";
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
  const [isBackHovered, setIsBackHovered] = useState(false);
  const [words, setWords] = useState<any[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  // Reanimated 3D flip value (0 for front, 180 for back)
  const rotate = useSharedValue(0);

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

  const frontAnimatedStyle = useAnimatedStyle(() => {
    const spin = interpolate(rotate.value, [0, 180], [0, 180]);
    return {
      transform: [{ rotateY: `${spin}deg` }],
      opacity: rotate.value > 90 ? 0 : 1,
      zIndex: rotate.value > 90 ? 1 : 2,
    };
  });

  const backAnimatedStyle = useAnimatedStyle(() => {
    const spin = interpolate(rotate.value, [0, 180], [180, 360]);
    return {
      transform: [{ rotateY: `${spin}deg` }],
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
        <TouchableOpacity
          style={[styles.btnBackEmpty, { backgroundColor: colors.indigo }]}
          onPress={() => router.back()}
        >
          <Text style={styles.btnBackText}>Quay lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const currentWord = words[index];
  const parsed = parseWord(currentWord?.term || "", currentWord?.def || "");
  const progressPercent = ((index + 1) / words.length) * 100;

  // Bản dịch loại từ sang Tiếng Việt dã sử Xianxia
  const getWordTypeLabel = (type: string) => {
    const lower = (type || "").toLowerCase();
    if (lower === "noun" || lower === "n") return "Danh Từ";
    if (lower === "verb" || lower === "v") return "Động Từ";
    if (lower === "adjective" || lower === "adj") return "Tính Từ";
    if (lower === "adverb" || lower === "adv") return "Trạng Từ";
    if (lower === "particle") return "Trợ Từ";
    return type || "Chưa rõ";
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />

        {/* 1. CUSTOM HEADER */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            onHoverIn={() => setIsBackHovered(true)}
            onHoverOut={() => setIsBackHovered(false)}
            style={({ pressed }) => [
              styles.btnIconHeader,
              { backgroundColor: colors.surface, borderColor: colors.border },
              (isBackHovered || pressed) && {
                backgroundColor: colors.indigoLight,
                borderColor: colors.indigo,
                shadowColor: colors.indigo,
              },
            ]}
          >
            {({ pressed }) => (
              <MaterialIcons
                name="arrow-back-ios"
                size={20}
                color={
                  isBackHovered || pressed ? colors.indigo : colors.textMuted
                }
                style={{ marginLeft: 6 }}
              />
            )}
          </Pressable>

          <View style={styles.headerTitleWrap}>
            <Text
              style={[styles.headerTitle, { color: colors.text }]}
              numberOfLines={1}
            >
              {title}
            </Text>
            <Text style={[styles.headerSub, { color: colors.textMuted }]}>
              {words.length} cổ tự tinh hoa
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.btnIconHeader,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
            onPress={() => speak(parsed.word)}
          >
            <MaterialIcons name="headset" size={22} color={colors.indigo} />
          </TouchableOpacity>
        </View>

        {/* 2. PROGRESS BAR */}
        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={[styles.progressLabel, { color: colors.textMuted }]}>
              LUYỆN TẬP PHÁP LỰC
            </Text>
            <Text style={[styles.progressCounter, { color: colors.indigo }]}>
              {index + 1} / {words.length}
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
          <TouchableOpacity
            activeOpacity={1}
            onPress={handleFlip}
            style={styles.flipTouchable}
          >
            <View style={{ flex: 1, position: "relative" }}>
              {/* MẶT TRƯỚC: NGHĨA TIẾNG VIỆT */}
              <Animated.View
                style={[
                  styles.flashcardBox,
                  frontAnimatedStyle,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.indigo + "40",
                  },
                ]}
              >
                <View style={styles.cardHeader}>
                  <Text style={[styles.cardHeaderTag, { color: colors.indigo }]}>
                    【 CỔ TỰ PHÁP NGHĨA 】
                  </Text>
                </View>

                <View style={styles.cardContent}>
                  <Text style={[styles.cardTextDef, { color: colors.text }]}>
                    {parsed.meaning}
                  </Text>
                </View>

                <View style={styles.cardFooter}>
                  <View style={styles.badgeRow}>
                    <View style={[styles.badge, { borderColor: colors.purple }]}>
                      <Text style={[styles.badgeText, { color: colors.purple }]}>
                        {parsed.jlpt}
                      </Text>
                    </View>
                    <View style={[styles.badge, { borderColor: colors.blue }]}>
                      <Text style={[styles.badgeText, { color: colors.blue }]}>
                        {getWordTypeLabel(parsed.type)}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.tapToFlip, { color: colors.textMuted }]}>
                    ⚡ Chạm để giải ấn linh tự
                  </Text>
                </View>
              </Animated.View>

              {/* MẶT SAU: TỪ TIẾNG NHẬT */}
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
                    【 CHÂN NGÔN GIẢI CHÚ 】
                  </Text>
                </View>

                <ScrollView
                  contentContainerStyle={styles.cardBackScroll}
                  showsVerticalScrollIndicator={false}
                >
                  <View style={styles.japaneseWrapper}>
                    <Text style={[styles.cardTextSolid, { color: colors.amber }]}>
                      {parsed.word}
                    </Text>
                    {parsed.reading && parsed.reading !== parsed.word && (
                      <Text style={[styles.readingText, { color: colors.textMuted }]}>
                        {parsed.reading}
                      </Text>
                    )}
                  </View>

                  {/* Ví dụ & Ghi chú */}
                  {parsed.examples && parsed.examples.length > 0 && (
                    <View style={styles.detailsSection}>
                      <Text style={[styles.sectionTitle, { color: colors.indigo }]}>
                        ✦ Minh Họa Trận Pháp
                      </Text>
                      {parsed.examples.map((ex, idx) => (
                        <View key={idx} style={styles.exampleItem}>
                          <Text style={[styles.exampleJp, { color: colors.text }]}>
                            {ex.jp}
                          </Text>
                          <Text style={[styles.exampleVn, { color: colors.textMuted }]}>
                            {ex.vn}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {parsed.notes ? (
                    <View style={[styles.notesSection, { borderColor: colors.purple + "40" }]}>
                      <Text style={[styles.notesText, { color: colors.textMuted }]}>
                        <Text style={{ color: colors.purple, fontWeight: "bold" }}>Ghi chú: </Text>
                        {parsed.notes}
                      </Text>
                    </View>
                  ) : null}
                </ScrollView>

                <View style={[styles.cardFooter, { marginTop: 10 }]}>
                  <Text style={[styles.tapToFlip, { color: colors.textMuted }]}>
                    ⚡ Chạm để phong ấn lại
                  </Text>
                </View>
              </Animated.View>
            </View>
          </TouchableOpacity>
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
            <TouchableOpacity
              style={styles.navBtn}
              onPress={prevCard}
              disabled={index === 0}
            >
              <MaterialIcons
                name="keyboard-arrow-left"
                size={32}
                color={
                  index === 0 ? (isDark ? "#1E293B" : "#CBD5E1") : colors.text
                }
              />
            </TouchableOpacity>

            {/* Nút Phát âm */}
            <TouchableOpacity
              style={[
                styles.playBtn,
                { backgroundColor: colors.indigo, shadowColor: colors.indigo },
              ]}
              onPress={() => speak(parsed.word)}
              activeOpacity={0.7}
            >
              <MaterialIcons name="volume-up" size={28} color="#050814" />
            </TouchableOpacity>

            {/* Nút Tiến */}
            <TouchableOpacity
              style={styles.navBtn}
              onPress={nextCard}
              disabled={index === words.length - 1}
            >
              <MaterialIcons
                name="keyboard-arrow-right"
                size={32}
                color={
                  index === words.length - 1
                    ? isDark
                      ? "#1E293B"
                      : "#CBD5E1"
                    : colors.text
                }
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>
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
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    ...Platform.select({ web: { transition: "all 0.2s ease" } }),
  },
  headerTitleWrap: { flex: 1, alignItems: "center", paddingHorizontal: 10 },
  headerTitle: { fontSize: 18, fontWeight: "800" },
  headerSub: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  progressSection: { paddingHorizontal: 20, paddingBottom: 15 },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  progressLabel: { fontSize: 12, fontWeight: "800", letterSpacing: 1 },
  progressCounter: { fontSize: 13, fontWeight: "800" },
  progressBarBg: {
    height: 6,
    width: "100%",
    borderRadius: 10,
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 10,
  },
  cardWrapper: {
    flex: 1,
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
    borderRadius: 24,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 6,
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
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2,
  },
  cardContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  cardBackScroll: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 10,
  },
  cardTextDef: {
    fontSize: 26,
    fontWeight: "800",
    textAlign: "center",
    lineHeight: 36,
  },
  cardTextSolid: {
    fontSize: 34,
    fontWeight: "800",
    textAlign: "center",
  },
  japaneseWrapper: {
    alignItems: "center",
    marginBottom: 20,
  },
  readingText: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 8,
    letterSpacing: 1,
  },
  cardFooter: {
    alignItems: "center",
    width: "100%",
    paddingTop: 10,
  },
  badgeRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  badge: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "transparent",
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "800",
  },
  tapToFlip: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  detailsSection: {
    width: "100%",
    borderTopWidth: 1,
    borderTopColor: "rgba(245, 199, 107, 0.15)",
    paddingTop: 15,
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 8,
  },
  exampleItem: {
    marginBottom: 10,
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: "#4DA8FF",
  },
  exampleJp: {
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
  },
  exampleVn: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 18,
  },
  notesSection: {
    width: "100%",
    marginTop: 10,
    padding: 10,
    borderWidth: 1,
    borderRadius: 12,
    backgroundColor: "rgba(124, 92, 255, 0.05)",
  },
  notesText: {
    fontSize: 12,
    lineHeight: 18,
  },
  bottomControls: { paddingBottom: height * 0.05, paddingTop: 20, alignItems: "center" },
  pillContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 50,
    paddingHorizontal: 15,
    paddingVertical: 10,
    gap: 25,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 5,
    borderWidth: 1,
  },
  navBtn: { padding: 10 },
  playBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    justifyContent: "center",
    alignItems: "center",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
});
