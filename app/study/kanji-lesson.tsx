import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Animated,
  Alert,
  TextInput,
  Modal,
  Platform,
  Dimensions,
} from "react-native";
import { WebView } from "react-native-webview";
import { MaterialIcons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import * as Speech from "expo-speech";
import api from "../../services/api";
import Toast from "../../components/ui/Toast";
import Header from "../../components/ui/Header";
import { useTheme } from "@/src/context/ThemeContext";

const { width } = Dimensions.get("window");
const ExpoWebView = WebView as any;

// ============================================================
// INTERFACES
// ============================================================
interface ExampleWord {
  word: string;
  reading: string;
  meaning: string;
}

interface KanjiItem {
  _id: string;
  character: string;
  meaning: string;
  onyomi: string;
  kunyomi: string;
  vietnamese_reading: string;
  level: string;
  lessonGroup?: string;
  components?: string[];
  story?: string;
  stroke_order?: string[];
  onyomi_examples?: ExampleWord[];
  kunyomi_examples?: ExampleWord[];
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const LIMIT = 50;

export default function KanjiLessonScreen() {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const { group } = useLocalSearchParams<{ group: string }>();

  const isUnnamed = group === "__unnamed__";
  const displayTitle = isUnnamed ? "Chưa phân loại" : (group || "Bài học");

  const [kanjiList, setKanjiList] = useState<KanjiItem[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [animationKey, setAnimationKey] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);

  // MODAL EDIT
  const [editModal, setEditModal] = useState(false);
  const [editForm, setEditForm] = useState<Partial<KanjiItem>>({});
  const [saving, setSaving] = useState(false);

  // TOAST
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const slideAnim = useRef(new Animated.Value(-100)).current;

  // CARD SLIDE ANIMATION
  const cardSlideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // CARD FLIP ANIMATION (Reanimated is heavy, so we use standard Animated.timing)
  const flipAnimValue = useRef(new Animated.Value(0)).current;

  const triggerToast = (type: "success" | "error", text: string) => {
    setToast({ type, text });
    Animated.timing(slideAnim, { toValue: 40, duration: 400, useNativeDriver: true }).start();
    setTimeout(() => {
      Animated.timing(slideAnim, { toValue: -100, duration: 400, useNativeDriver: true })
        .start(() => setToast(null));
    }, 3500);
  };

  const fetchKanji = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { limit: LIMIT, page: 1 };
      if (isUnnamed) {
        params.group = "";
      } else {
        params.group = group;
      }

      const res = await api.get("/api/kanji/all", { params });
      if (res.data.success) {
        setKanjiList(res.data.data);
        setPagination(res.data.pagination);
        setCurrentIndex(0);
        setIsFlipped(false);
        setIsBookmarked(false);
        setAnimationKey((k) => k + 1);
      }
    } catch {
      triggerToast("error", "Lỗi kết nối server!");
    } finally {
      setLoading(false);
    }
  }, [group]);

  useEffect(() => {
    fetchKanji();
  }, [fetchKanji]);

  // TTS PRONUNCIATION
  const speakKanji = (char: string) => {
    if (!char) return;
    Speech.speak(char, { language: "ja" });
  };

  // FLIP CARD INTERACTION
  const toggleFlip = () => {
    if (isFlipped) {
      Animated.timing(flipAnimValue, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => setIsFlipped(false));
    } else {
      Animated.timing(flipAnimValue, {
        toValue: 180,
        duration: 300,
        useNativeDriver: true,
      }).start(() => setIsFlipped(true));
    }
  };

  // NAVIGATE NEXT/PREV
  const nextCard = () => {
    if (currentIndex < kanjiList.length - 1) {
      animateCardTransition("next", () => {
        setCurrentIndex((prev) => prev + 1);
        setIsFlipped(false);
        flipAnimValue.setValue(0);
        setAnimationKey((k) => k + 1);
      });
    } else {
      triggerToast("success", "🎉 Bạn đã hoàn thành bài học này!");
    }
  };

  const prevCard = () => {
    if (currentIndex > 0) {
      animateCardTransition("prev", () => {
        setCurrentIndex((prev) => prev - 1);
        setIsFlipped(false);
        flipAnimValue.setValue(0);
        setAnimationKey((k) => k + 1);
      });
    }
  };

  const animateCardTransition = (direction: "next" | "prev", callback: () => void) => {
    const toValue = direction === "next" ? -width : width;
    
    Animated.parallel([
      Animated.timing(cardSlideAnim, {
        toValue,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      })
    ]).start(() => {
      callback();
      cardSlideAnim.setValue(direction === "next" ? width : -width);
      Animated.parallel([
        Animated.timing(cardSlideAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        })
      ]).start();
    });
  };

  // DELETE KANJI
  const handleDelete = (kanji: KanjiItem) => {
    Alert.alert(
      "Xác nhận xóa",
      `Bạn có chắc muốn xóa Kanji "${kanji.character}" (${kanji.vietnamese_reading}) không?`,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Xóa",
          style: "destructive",
          onPress: async () => {
            try {
              const res = await api.delete(`/api/kanji/delete/${kanji._id}`);
              if (res.data.success) {
                triggerToast("success", `🗑️ Đã xóa "${kanji.character}"!`);
                const newList = kanjiList.filter((k) => k._id !== kanji._id);
                setKanjiList(newList);
                setCurrentIndex((prev) => Math.max(0, Math.min(prev, newList.length - 1)));
                setIsFlipped(false);
                flipAnimValue.setValue(0);
              } else {
                triggerToast("error", res.data.message || "Xóa thất bại.");
              }
            } catch {
              triggerToast("error", "Lỗi kết nối khi xóa!");
            }
          },
        },
      ],
    );
  };

  // OPEN EDIT
  const openEditModal = (kanji: KanjiItem) => {
    setEditForm({ ...kanji });
    setEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editForm._id) return;
    setSaving(true);
    try {
      const res = await api.put(`/api/kanji/update/${editForm._id}`, {
        character: editForm.character,
        meaning: editForm.meaning,
        onyomi: editForm.onyomi,
        kunyomi: editForm.kunyomi,
        vietnamese_reading: editForm.vietnamese_reading,
        level: editForm.level,
        lessonGroup: editForm.lessonGroup,
        components: editForm.components,
        story: editForm.story,
      });

      if (res.data.success) {
        const updated = res.data.data;
        setKanjiList((prev) => prev.map((k) => (k._id === updated._id ? { ...k, ...updated } : k)));
        triggerToast("success", `✅ Đã cập nhật Kanji "${updated.character}"!`);
        setEditModal(false);
      } else {
        triggerToast("error", res.data.message || "Cập nhật thất bại.");
      }
    } catch {
      triggerToast("error", "Lỗi kết nối khi lưu!");
    } finally {
      setSaving(false);
    }
  };

  const generateStrokeHtml = (char: string) => {
    const strokeColor = isDark ? "#F59E0B" : "#4F46E5";
    const outlineColor = isDark ? "#334155" : "#E2E8F0";
    return `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<script src="https://cdn.jsdelivr.net/npm/hanzi-writer@3.5/dist/hanzi-writer.min.js"></script>
<style>
  body{margin:0;padding:0;display:flex;justify-content:center;align-items:center;
    background:transparent;height:100vh;overflow:hidden;}
  #kb{width:150px;height:150px;}
</style>
</head><body>
<div id="kb"></div>
<script>
  var w=HanziWriter.create('kb','${char}',{
    width:150,height:150,padding:4,
    strokeAnimationSpeed:1.0,delayBetweenStrokes:200,
    strokeColor:'${strokeColor}',outlineColor:'${outlineColor}',
    radicalColor:'#EF4444',showOutline:true
  });
  w.animateCharacter();
</script>
</body></html>`;
  };

  // Card Rotate Styles for 3D Flip
  const frontInterpolate = flipAnimValue.interpolate({
    inputRange: [0, 180],
    outputRange: ["0deg", "180deg"],
  });
  const backInterpolate = flipAnimValue.interpolate({
    inputRange: [0, 180],
    outputRange: ["180deg", "360deg"],
  });

  const frontAnimatedStyle = {
    transform: [{ rotateY: frontInterpolate }],
  };
  const backAnimatedStyle = {
    transform: [{ rotateY: backInterpolate }],
  };

  const currentKanji = kanjiList[currentIndex] || null;
  const progressPercent = kanjiList.length > 0 ? ((currentIndex + 1) / kanjiList.length) * 100 : 0;

  if (loading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Header title={displayTitle} />
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={colors.indigo} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>Đang tải Kanji...</Text>
        </View>
      </View>
    );
  }

  return (
    <LinearGradient
      colors={isDark ? ["#0F172A", "#1E1B4B"] : ["#EEF2FF", "#C7D2FE"]}
      style={styles.container}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <Toast toast={toast} slideAnim={slideAnim} />

      {/* ================= TOP HEADER BAR ================= */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={[styles.topBarBtn, { backgroundColor: colors.surface + "80" }]}
          onPress={() => router.back()}
          activeOpacity={0.8}
        >
          <MaterialIcons name="arrow-back-ios" size={18} color={colors.text} style={{ marginLeft: 4 }} />
        </TouchableOpacity>

        {/* Card indicator pill */}
        <View style={[styles.progressPill, { backgroundColor: colors.surface }]}>
          <Text style={[styles.progressPillText, { color: colors.indigo }]}>
            {kanjiList.length > 0 ? `${currentIndex + 1}/${kanjiList.length}` : "0/0"}
          </Text>
        </View>

        <View style={styles.topBarRight}>
          <TouchableOpacity
            style={[styles.topBarBtn, { backgroundColor: colors.surface + "80", marginRight: 10 }]}
            onPress={() => currentKanji && openEditModal(currentKanji)}
            activeOpacity={0.8}
          >
            <MaterialIcons name="settings" size={20} color={colors.text} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.topBarBtn, { backgroundColor: colors.surface + "80" }]}
            onPress={() => currentKanji && handleDelete(currentKanji)}
            activeOpacity={0.8}
          >
            <MaterialIcons name="delete" size={20} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>

      {/* ================= PROGRESS BAR AT TOP ================= */}
      <View style={styles.progressBarWrapper}>
        <View style={[styles.progressBarBg, { backgroundColor: "rgba(255,255,255,0.3)" }]}>
          <View style={[styles.progressBarFill, { backgroundColor: colors.indigo, width: `${progressPercent}%` }]} />
        </View>
      </View>

      {/* ================= STACKED CARD VIEW DECK ================= */}
      <View style={styles.deckContainer}>
        {kanjiList.length === 0 ? (
          <View style={[styles.cardSurface, styles.emptyCard, { backgroundColor: colors.surface }]}>
            <MaterialIcons name="inbox" size={56} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Bài học trống</Text>
            <Text style={[styles.emptyDesc, { color: colors.textMuted }]}>
              Chưa có Kanji nào trong bài học này.
            </Text>
          </View>
        ) : currentKanji ? (
          <View style={styles.stackWrapper}>
            {/* Fake Card 3 (Bottom-most) */}
            <View style={[styles.fakeCardBack, styles.fakeCardBottom, { backgroundColor: colors.surface, opacity: 0.4 }]} />

            {/* Fake Card 2 (Middle) */}
            <View style={[styles.fakeCardBack, styles.fakeCardMiddle, { backgroundColor: colors.surface, opacity: 0.75 }]} />

            {/* Active Card with animations */}
            <Animated.View
              style={[
                styles.activeCardContainer,
                {
                  transform: [{ translateX: cardSlideAnim }],
                  opacity: fadeAnim,
                },
              ]}
            >
              <TouchableOpacity activeOpacity={0.99} onPress={toggleFlip} style={styles.cardTouchArea}>
                
                {/* ── MẶT TRƯỚC (FRONT) ── */}
                <Animated.View
                  style={[
                    styles.cardSurface,
                    frontAnimatedStyle,
                    { backgroundColor: colors.surface, backfaceVisibility: "hidden" },
                  ]}
                >
                  <View style={styles.cardHeader}>
                    <View style={[styles.faceBadge, { backgroundColor: "#E0E7FF" }]}>
                      <Text style={[styles.faceBadgeText, { color: colors.indigo }]}>MẶT TRƯỚC</Text>
                    </View>
                    <TouchableOpacity onPress={() => setIsBookmarked(!isBookmarked)} activeOpacity={0.7}>
                      <MaterialIcons
                        name={isBookmarked ? "star" : "star-border"}
                        size={26}
                        color={isBookmarked ? "#F59E0B" : colors.textMuted}
                      />
                    </TouchableOpacity>
                  </View>

                  {/* Speaker Pronunciation */}
                  <TouchableOpacity
                    style={[styles.speakerBtn, { backgroundColor: colors.indigo + "15" }]}
                    onPress={() => speakKanji(currentKanji.character)}
                    activeOpacity={0.8}
                  >
                    <MaterialIcons name="volume-up" size={24} color={colors.indigo} />
                  </TouchableOpacity>

                  {/* Center Word Display */}
                  <View style={styles.centerDisplay}>
                    <Text style={[styles.bigKanjiChar, { color: "#1E1B4B" }]}>
                      {currentKanji.character}
                    </Text>
                    <Text style={[styles.bigReading, { color: colors.textMuted }]}>
                      /{currentKanji.vietnamese_reading}/
                    </Text>
                  </View>

                  {/* Flip Prompt Footer */}
                  <View style={styles.cardFooter}>
                    <MaterialIcons name="loop" size={16} color={colors.textMuted} style={{ marginRight: 6 }} />
                    <Text style={[styles.footerPromptText, { color: colors.textMuted }]}>
                      Nhấn vào thẻ để lật
                    </Text>
                  </View>
                </Animated.View>

                {/* ── MẶT SAU (BACK) ── */}
                <Animated.View
                  style={[
                    styles.cardSurface,
                    styles.cardSurfaceBack,
                    backAnimatedStyle,
                    { backgroundColor: colors.surface, backfaceVisibility: "hidden" },
                  ]}
                >
                  <View style={styles.cardHeader}>
                    <View style={[styles.faceBadge, { backgroundColor: "#ECFDF5" }]}>
                      <Text style={[styles.faceBadgeText, { color: "#10B981" }]}>MẶT SAU</Text>
                    </View>
                    <View style={[styles.levelBadge, { backgroundColor: colors.indigo + "15" }]}>
                      <Text style={[styles.levelBadgeText, { color: colors.indigo }]}>{currentKanji.level}</Text>
                    </View>
                  </View>

                  <ScrollView style={styles.backScrollView} showsVerticalScrollIndicator={false}>
                    {/* Hán Việt & Nghĩa */}
                    <View style={styles.backTitleRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.backMeaning, { color: colors.text }]}>
                          {currentKanji.meaning}
                        </Text>
                        <Text style={[styles.backHanViet, { color: colors.indigo }]}>
                          Âm Hán: {currentKanji.vietnamese_reading}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={[styles.speakerBtnBack, { backgroundColor: colors.indigo + "15" }]}
                        onPress={() => speakKanji(currentKanji.character)}
                        activeOpacity={0.8}
                      >
                        <MaterialIcons name="volume-up" size={18} color={colors.indigo} />
                      </TouchableOpacity>
                    </View>

                    {/* Onyomi & Kunyomi */}
                    <View style={styles.backYomiBlock}>
                      <View style={[styles.yomiRow, { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                        <Text style={[styles.yomiLabel, { color: colors.textMuted }]}>Âm ON (Onyomi):</Text>
                        <Text style={[styles.yomiValue, { color: colors.text }]}>{currentKanji.onyomi || "—"}</Text>
                      </View>
                      <View style={styles.yomiRow}>
                        <Text style={[styles.yomiLabel, { color: colors.textMuted }]}>Âm KUN (Kunyomi):</Text>
                        <Text style={[styles.yomiValue, { color: colors.text }]}>{currentKanji.kunyomi || "—"}</Text>
                      </View>
                    </View>

                    {/* Nét vẽ & Bộ thủ */}
                    <View style={styles.rowDetails}>
                      {/* Stroke Webview Box */}
                      <View style={styles.leftStrokeCol}>
                        <Text style={[styles.sectionTitleLabel, { color: colors.textMuted }]}>NÉT VẼ HOẠT HỌA</Text>
                        <View style={[styles.strokeWebViewBox, { borderColor: colors.border }]}>
                          {Platform.OS === "web" ? (
                            <iframe
                              key={`${currentKanji._id}-${animationKey}`}
                              srcDoc={generateStrokeHtml(currentKanji.character)}
                              style={{ width: "150px", height: "150px", border: "none" }}
                            />
                          ) : (
                            <ExpoWebView
                              key={`${currentKanji._id}-${animationKey}`}
                              originWhitelist={["*"]}
                              source={{ html: generateStrokeHtml(currentKanji.character) }}
                              style={{ width: 150, height: 150, backgroundColor: "transparent" }}
                              scrollEnabled={false}
                              javaScriptEnabled
                            />
                          )}
                        </View>
                        <TouchableOpacity
                          style={[styles.replayBtn, { backgroundColor: colors.border }]}
                          onPress={() => setAnimationKey((k) => k + 1)}
                        >
                          <MaterialIcons name="replay" size={12} color={colors.text} />
                          <Text style={[styles.replayText, { color: colors.text }]}>Vẽ lại</Text>
                        </TouchableOpacity>
                      </View>

                      {/* Bộ thủ components */}
                      {currentKanji.components && currentKanji.components.length > 0 && (
                        <View style={styles.rightCompCol}>
                          <Text style={[styles.sectionTitleLabel, { color: colors.textMuted }]}>BỘ THỦ</Text>
                          <View style={styles.componentsRow}>
                            {currentKanji.components.map((c, i) => (
                              <View key={i} style={[styles.compBadge, { backgroundColor: colors.border }]}>
                                <Text style={[styles.compText, { color: colors.text }]}>{c}</Text>
                              </View>
                            ))}
                          </View>
                        </View>
                      )}
                    </View>

                    {/* Memory story */}
                    {!!currentKanji.story && (
                      <View style={[styles.backStoryBox, { backgroundColor: colors.indigo + "08", borderColor: colors.indigo + "20" }]}>
                        <Text style={[styles.sectionTitleLabel, { color: colors.indigo, marginBottom: 4 }]}>💡 MẸO GHI NHỚ</Text>
                        <Text style={[styles.storyText, { color: colors.text }]}>
                          {currentKanji.story}
                        </Text>
                      </View>
                    )}

                    {/* Examples ON */}
                    {currentKanji.onyomi_examples && currentKanji.onyomi_examples.length > 0 && (
                      <View style={[styles.examplesSection, { borderLeftColor: "#3B82F6" }]}>
                        <Text style={styles.examplesSecTitle}>Ví dụ âm ON</Text>
                        {currentKanji.onyomi_examples.map((ex, i) => (
                          <View key={i} style={styles.exampleWordItem}>
                            <Text style={[styles.exWordText, { color: colors.text }]}>
                              {ex.word} <Text style={{ color: "#3B82F6", fontWeight: "600" }}>({ex.reading})</Text>
                            </Text>
                            <Text style={[styles.exWordMeaning, { color: colors.textMuted }]}>{ex.meaning}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Examples KUN */}
                    {currentKanji.kunyomi_examples && currentKanji.kunyomi_examples.length > 0 && (
                      <View style={[styles.examplesSection, { borderLeftColor: "#10B981" }]}>
                        <Text style={styles.examplesSecTitle}>Ví dụ âm KUN</Text>
                        {currentKanji.kunyomi_examples.map((ex, i) => (
                          <View key={i} style={styles.exampleWordItem}>
                            <Text style={[styles.exWordText, { color: colors.text }]}>
                              {ex.word} <Text style={{ color: "#10B981", fontWeight: "600" }}>({ex.reading})</Text>
                            </Text>
                            <Text style={[styles.exWordMeaning, { color: colors.textMuted }]}>{ex.meaning}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </ScrollView>
                </Animated.View>

              </TouchableOpacity>
            </Animated.View>
          </View>
        ) : null}
      </View>

      {/* ================= BOTTOM ACTION CONTROL ROW ================= */}
      {kanjiList.length > 0 && currentKanji && (
        <View style={styles.bottomControlRow}>
          {/* Chưa thuộc button */}
          <View style={styles.controlBtnWrapper}>
            <TouchableOpacity
              style={[styles.roundControlBtn, styles.redControlBtn, { backgroundColor: colors.surface }]}
              onPress={nextCard}
              activeOpacity={0.8}
            >
              <MaterialIcons name="reply" size={24} color="#EF4444" style={{ transform: [{ scaleX: -1 }] }} />
            </TouchableOpacity>
            <Text style={[styles.controlBtnLabel, { color: isDark ? colors.textMuted : "#475569" }]}>Chưa thuộc</Text>
          </View>

          {/* Flip / Rotation central button */}
          <View style={styles.controlBtnWrapper}>
            <TouchableOpacity
              style={[styles.roundControlBtn, styles.blueCentralBtn, { backgroundColor: colors.indigo }]}
              onPress={toggleFlip}
              activeOpacity={0.8}
            >
              <MaterialIcons name="autorenew" size={32} color="#FFF" />
            </TouchableOpacity>
            <Text style={[styles.controlBtnLabel, { color: colors.indigo, fontWeight: "800" }]}>Lật thẻ</Text>
          </View>

          {/* Đã thuộc button */}
          <View style={styles.controlBtnWrapper}>
            <TouchableOpacity
              style={[styles.roundControlBtn, styles.greenControlBtn, { backgroundColor: colors.surface }]}
              onPress={nextCard}
              activeOpacity={0.8}
            >
              <MaterialIcons name="check" size={26} color="#10B981" />
            </TouchableOpacity>
            <Text style={[styles.controlBtnLabel, { color: isDark ? colors.textMuted : "#475569" }]}>Đã thuộc</Text>
          </View>
        </View>
      )}

      {/* ================= MODAL CHÌNH SỬA KANJI ================= */}
      <Modal
        visible={editModal}
        animationType="slide"
        transparent
        onRequestClose={() => setEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>✏️ Chỉnh sửa Kanji</Text>
              <TouchableOpacity onPress={() => setEditModal(false)}>
                <MaterialIcons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.editLabel, { color: colors.textMuted }]}>Chữ Kanji</Text>
              <TextInput
                style={[styles.editInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text, fontSize: 22, textAlign: "center" }]}
                value={editForm.character}
                onChangeText={(t) => setEditForm((p) => ({ ...p, character: t }))}
                maxLength={3}
              />

              <Text style={[styles.editLabel, { color: colors.textMuted }]}>Ý nghĩa</Text>
              <TextInput
                style={[styles.editInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                value={editForm.meaning}
                onChangeText={(t) => setEditForm((p) => ({ ...p, meaning: t }))}
              />

              <Text style={[styles.editLabel, { color: colors.textMuted }]}>Âm Hán Việt</Text>
              <TextInput
                style={[styles.editInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                value={editForm.vietnamese_reading}
                onChangeText={(t) => setEditForm((p) => ({ ...p, vietnamese_reading: t }))}
              />

              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.editLabel, { color: colors.textMuted }]}>Âm ON</Text>
                  <TextInput
                    style={[styles.editInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                    value={editForm.onyomi}
                    onChangeText={(t) => setEditForm((p) => ({ ...p, onyomi: t }))}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.editLabel, { color: colors.textMuted }]}>Âm KUN</Text>
                  <TextInput
                    style={[styles.editInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                    value={editForm.kunyomi}
                    onChangeText={(t) => setEditForm((p) => ({ ...p, kunyomi: t }))}
                  />
                </View>
              </View>

              <Text style={[styles.editLabel, { color: colors.textMuted }]}>Cấp độ</Text>
              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                {["N5", "N4", "N3", "N2", "N1"].map((lv) => (
                  <TouchableOpacity
                    key={lv}
                    style={[
                      styles.editLevelChip,
                      {
                        backgroundColor: editForm.level === lv ? colors.indigo : isDark ? "#334155" : "#F1F5F9",
                        borderColor: editForm.level === lv ? colors.indigo : colors.border,
                      },
                    ]}
                    onPress={() => setEditForm((p) => ({ ...p, level: lv }))}
                  >
                    <Text style={{ color: editForm.level === lv ? "#FFF" : colors.textMuted, fontWeight: "700" }}>
                      {lv}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.editLabel, { color: colors.textMuted }]}>Bài học / Nhóm</Text>
              <TextInput
                style={[styles.editInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                value={editForm.lessonGroup}
                onChangeText={(t) => setEditForm((p) => ({ ...p, lessonGroup: t }))}
              />

              <Text style={[styles.editLabel, { color: colors.textMuted }]}>Bộ thủ (cách nhau dấu phẩy)</Text>
              <TextInput
                style={[styles.editInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                value={(editForm.components || []).join(", ")}
                onChangeText={(t) =>
                  setEditForm((p) => ({
                    ...p,
                    components: t.split(",").map((s) => s.trim()).filter(Boolean),
                  }))
                }
              />

              <Text style={[styles.editLabel, { color: colors.textMuted }]}>Câu chuyện / Mẹo nhớ</Text>
              <TextInput
                style={[styles.editInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text, minHeight: 80, textAlignVertical: "top" }]}
                value={editForm.story}
                onChangeText={(t) => setEditForm((p) => ({ ...p, story: t }))}
                multiline
                numberOfLines={4}
              />

              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: colors.indigo, opacity: saving ? 0.6 : 1 }]}
                onPress={handleSaveEdit}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <MaterialIcons name="save" size={18} color="#FFF" />
                    <Text style={styles.saveBtnText}>Lưu thay đổi</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    flex: 1,
  },
  centerBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: "500",
  },

  // TOP HEADER BAR
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginTop: Platform.OS === "android" ? 50 : 25,
    height: 50,
  },
  topBarBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
      },
      android: { elevation: 2 },
    }),
  },
  progressPill: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
      },
      android: { elevation: 2 },
    }),
  },
  progressPillText: {
    fontSize: 14,
    fontWeight: "900",
  },
  topBarRight: {
    flexDirection: "row",
  },

  // LINEAR PROGRESS BAR AT TOP
  progressBarWrapper: {
    paddingHorizontal: 24,
    marginVertical: 12,
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 3,
  },

  // DECK CONTAINER
  deckContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },
  stackWrapper: {
    width: width - 48,
    height: "85%",
    position: "relative",
    alignItems: "center",
  },

  // FAKE STACK CARDS
  fakeCardBack: {
    position: "absolute",
    borderRadius: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 2,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.02)",
  },
  fakeCardBottom: {
    width: width - 80,
    height: "96%",
    bottom: 0,
    transform: [{ scale: 0.9 }],
  },
  fakeCardMiddle: {
    width: width - 64,
    height: "97%",
    bottom: 15,
    transform: [{ scale: 0.95 }],
  },

  // ACTIVE MAIN CARD
  activeCardContainer: {
    width: "100%",
    height: "95%",
    position: "absolute",
    top: 0,
  },
  cardTouchArea: {
    width: "100%",
    height: "100%",
  },
  cardSurface: {
    width: "100%",
    height: "100%",
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.04)",
    shadowColor: "#1E1B4B",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 5,
    justifyContent: "space-between",
  },
  cardSurfaceBack: {
    position: "absolute",
    top: 0,
    left: 0,
  },

  // CARD CARD DETAILS
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    height: 32,
  },
  faceBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  faceBadgeText: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  levelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  levelBadgeText: {
    fontSize: 11,
    fontWeight: "800",
  },
  speakerBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "flex-start",
    marginTop: 15,
  },
  centerDisplay: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    marginTop: -20,
  },
  bigKanjiChar: {
    fontSize: 78,
    fontWeight: "900",
  },
  bigReading: {
    fontSize: 20,
    fontWeight: "700",
    marginTop: 14,
    letterSpacing: 0.5,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.03)",
  },
  footerPromptText: {
    fontSize: 12,
    fontWeight: "700",
  },

  // BACK CARD DETAIL
  backScrollView: {
    flex: 1,
    marginTop: 14,
  },
  backTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  backMeaning: {
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 28,
  },
  backHanViet: {
    fontSize: 14,
    fontWeight: "800",
    marginTop: 4,
  },
  speakerBtnBack: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  backYomiBlock: {
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.04)",
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.01)",
    marginBottom: 16,
  },
  yomiRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 12,
  },
  yomiLabel: {
    fontSize: 12,
    fontWeight: "700",
  },
  yomiValue: {
    fontSize: 13,
    fontWeight: "800",
    flex: 1,
    textAlign: "right",
    paddingLeft: 10,
  },

  // ROW DETAILS
  rowDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
    gap: 12,
  },
  leftStrokeCol: {
    flex: 1,
    alignItems: "center",
  },
  rightCompCol: {
    flex: 1,
  },
  sectionTitleLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  strokeWebViewBox: {
    width: 150,
    height: 150,
    borderRadius: 16,
    borderWidth: 2,
    overflow: "hidden",
  },
  replayBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    marginTop: 6,
    gap: 4,
  },
  replayText: {
    fontSize: 11,
    fontWeight: "700",
  },
  componentsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  compBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  compText: {
    fontSize: 13,
    fontWeight: "800",
  },

  // BACK STORY
  backStoryBox: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    marginBottom: 16,
  },
  storyText: {
    fontSize: 12.5,
    lineHeight: 18,
    fontStyle: "italic",
  },

  // EXAMPLES SECTION
  examplesSection: {
    borderLeftWidth: 4,
    paddingLeft: 10,
    marginVertical: 10,
  },
  examplesSecTitle: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    marginBottom: 8,
    color: "#64748B",
  },
  exampleWordItem: {
    marginBottom: 8,
  },
  exWordText: {
    fontSize: 14,
    fontWeight: "700",
  },
  exWordMeaning: {
    fontSize: 12,
    marginTop: 2,
  },

  // BOTTOM CONTROLS
  bottomControlRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 35,
    height: 80,
  },
  controlBtnWrapper: {
    alignItems: "center",
    gap: 6,
  },
  roundControlBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.4)",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.08,
        shadowRadius: 5,
      },
      android: { elevation: 3 },
    }),
  },
  redControlBtn: {
    borderColor: "rgba(239, 68, 68, 0.15)",
  },
  greenControlBtn: {
    borderColor: "rgba(16, 185, 129, 0.15)",
  },
  blueCentralBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderColor: "transparent",
    ...Platform.select({
      ios: {
        shadowColor: "#4F46E5",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      android: { elevation: 5 },
    }),
  },
  controlBtnLabel: {
    fontSize: 11,
    fontWeight: "700",
  },

  // EMPTY STUFF
  emptyCard: {
    justifyContent: "center",
    alignItems: "center",
    height: 300,
    width: width - 48,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 22,
  },

  // MODAL
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalBox: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  editLabel: {
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 6,
    marginTop: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  editInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    marginBottom: 2,
  },
  editLevelChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1.5,
  },
  saveBtn: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 20,
    marginBottom: 8,
    gap: 8,
  },
  saveBtnText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "800",
  },
});
