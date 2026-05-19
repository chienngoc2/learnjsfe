import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  SafeAreaView,
  Animated,
  Pressable,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import * as Speech from "expo-speech";
import api from "../../services/api";
import { useTheme } from "@/src/context/ThemeContext";


const { width, height } = Dimensions.get("window");

export default function CardViewer() {
  const { colors, isDark } = useTheme(); // 🚀 ĐÃ TÍCH HỢP: Lấy màu động từ hệ thống
  const { topicId, title } = useLocalSearchParams();
  const router = useRouter();
  const [isBackHovered, setIsBackHovered] = useState(false);
  const [words, setWords] = useState<any[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  // Animation lật thẻ
  const [isFlipped, setIsFlipped] = useState(false);
  const flipAnim = useRef(new Animated.Value(0)).current;

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

  // Xử lý Lật thẻ
  const handleFlip = () => {
    Animated.timing(flipAnim, {
      toValue: isFlipped ? 0 : 180,
      duration: 320, // Tăng nhẹ một chút cho đầm tay
      useNativeDriver: true,
    }).start(() => setIsFlipped(!isFlipped));
  };

  const frontInterpolate = flipAnim.interpolate({
    inputRange: [0, 180],
    outputRange: ["0deg", "180deg"],
  });
  const backInterpolate = flipAnim.interpolate({
    inputRange: [0, 180],
    outputRange: ["180deg", "360deg"],
  });

  const frontAnimatedStyle = { transform: [{ rotateY: frontInterpolate }] };
  const backAnimatedStyle = {
    transform: [{ rotateY: backInterpolate }],
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  };

  // Xử lý chuyển câu (Tự động úp thẻ lại mặt trước)
  const nextCard = () => {
    if (index < words.length - 1) {
      if (isFlipped) handleFlip();
      setTimeout(() => setIndex(index + 1), isFlipped ? 320 : 0);
    }
  };

  const prevCard = () => {
    if (index > 0) {
      if (isFlipped) handleFlip();
      setTimeout(() => setIndex(index - 1), isFlipped ? 320 : 0);
    }
  };

  const speak = (text: string) => {
    const cleanText = text
      .replace(/\s*\(.*?\)\s*/g, "")
      .split("/")[0]
      .trim();
    Speech.speak(cleanText, { language: "ja-JP", rate: 0.85 });
  };

  if (loading)
    return (
      <View
        style={[
          styles.loadingContainer,
          { backgroundColor: colors.background },
        ]}
      >
        <ActivityIndicator size="large" color={colors.amber} />
      </View>
    );

  if (words.length === 0)
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
          style={[styles.btnBackEmpty, { backgroundColor: colors.amber }]}
          onPress={() => router.back()}
        >
          <Text style={styles.btnBackText}>Quay lại</Text>
        </TouchableOpacity>
      </View>
    );

  const progressPercent = ((index + 1) / words.length) * 100;

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* THẦN CHÚ ẨN HEADER MẶC ĐỊNH */}
        <Stack.Screen options={{ headerShown: false }} />

        {/* 1. CUSTOM HEADER ĐỒNG BỘ THEME */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            onHoverIn={() => setIsBackHovered(true)}
            onHoverOut={() => setIsBackHovered(false)}
            style={({ pressed }) => [
              styles.btnIconHeader,
              { backgroundColor: colors.surface, borderColor: colors.border },
              (isBackHovered || pressed) && {
                backgroundColor: colors.amberLight,
                borderColor: colors.amber,
                shadowColor: colors.amber,
              },
            ]}
          >
            {({ pressed }) => (
              <MaterialIcons
                name="arrow-back-ios"
                size={20}
                color={
                  isBackHovered || pressed ? colors.amber : colors.textMuted
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
              {words.length} thẻ từ vựng
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.btnIconHeader,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
            onPress={() => speak(words[index].term)}
          >
            <MaterialIcons name="headset" size={22} color={colors.amber} />
          </TouchableOpacity>
        </View>

        {/* 2. PROGRESS BAR ĐỘNG (Cam Hổ Phách rực rỡ) */}
        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={[styles.progressLabel, { color: colors.textMuted }]}>
              TIẾN ĐỘ ÔN TẬP
            </Text>
            <Text style={[styles.progressCounter, { color: colors.amber }]}>
              {index + 1} / {words.length}
            </Text>
          </View>
          <View
            style={[
              styles.progressBarBg,
              { backgroundColor: isDark ? "#334155" : "#E2E8F0" },
            ]}
          >
            <View
              style={[
                styles.progressBarFill,
                { width: `${progressPercent}%`, backgroundColor: colors.amber },
              ]}
            />
          </View>
        </View>

        {/* 3. VÙNG HIỂN THỊ THẺ FLASHCARD */}
        <View style={styles.cardWrapper}>
          <TouchableOpacity
            activeOpacity={1}
            onPress={handleFlip}
            style={styles.flipTouchable}
          >
            {/* MẶT TRƯỚC (Nghĩa Tiếng Việt) - Ăn theo màu Surface động */}
            <Animated.View
              style={[
                styles.flashcardBox,
                { backgroundColor: colors.surface, borderColor: colors.border },
                frontAnimatedStyle,
              ]}
            >
              <Text
                style={[
                  styles.cardTextTransparent,
                  { color: colors.amber + "CC" },
                ]}
              >
                {words[index].def}
              </Text>
            </Animated.View>

            {/* MẶT SAU (Từ Tiếng Nhật) - Khối màu hổ phách chuyên dụng */}
            <Animated.View
              style={[
                styles.flashcardBox,
                styles.flashcardBoxBack,
                {
                  backgroundColor: colors.amberLight,
                  borderColor: colors.amber + "40",
                },
                backAnimatedStyle as any,
              ]}
            >
              <Text style={[styles.cardTextSolid, { color: colors.amber }]}>
                {words[index].term}
              </Text>
            </Animated.View>
          </TouchableOpacity>
        </View>

        {/* 4. THANH ĐIỀU HƯỚNG GOM GỌN (Công thái học cao cấp) */}
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
                  index === 0 ? (isDark ? "#334155" : "#CBD5E1") : colors.text
                }
              />
            </TouchableOpacity>

            {/* Nút Phát âm (Cam Hổ Phách rực rỡ ở tâm điểm) */}
            <TouchableOpacity
              style={[
                styles.playBtn,
                { backgroundColor: colors.amber, shadowColor: colors.amber },
              ]}
              onPress={() => speak(words[index].term)}
              activeOpacity={0.7}
            >
              <MaterialIcons name="volume-up" size={28} color="#FFF" />
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
                      ? "#334155"
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
  btnBackText: { color: "#FFF", fontWeight: "bold" },

  // === CUSTOM HEADER ===
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

  // === PROGRESS BAR ===
  progressSection: { paddingHorizontal: 20, paddingBottom: 30 },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  progressLabel: { fontSize: 12, fontWeight: "800" },
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

  // === CARD VIEW DESIGN ===
  cardWrapper: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  flipTouchable: { width: "100%", height: height * 0.45 },
  flashcardBox: {
    width: "100%",
    height: "100%",
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 4,
    borderWidth: 1,
    backfaceVisibility: "hidden",
  },
  flashcardBoxBack: {
    borderWidth: 1,
  },
  cardTextTransparent: {
    fontSize: 36,
    fontWeight: "800",
    textAlign: "center",
  },
  cardTextSolid: {
    fontSize: 42,
    fontWeight: "800",
    textAlign: "center",
  },

  // === BOTTOM NAVIGATION PILL ===
  bottomControls: { paddingBottom: 40, alignItems: "center" },
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
    shadowOpacity: 0.08,
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
