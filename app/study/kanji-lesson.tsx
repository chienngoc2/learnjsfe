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
} from "react-native";
import { WebView } from "react-native-webview";
import { MaterialIcons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import api from "../../services/api";
import Toast from "../../components/ui/Toast";
import Header from "../../components/ui/Header";
import { useTheme } from "@/src/context/ThemeContext";

const ExpoWebView = WebView as any;

// ============================================================
// INTERFACES
// ============================================================
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
  example_words?: { word: string; reading: string; meaning: string }[];
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const LIMIT = 50;

// ============================================================
// COMPONENT CHÍNH: CHI TIẾT TỪNG KANJI TRONG BÀI HỌC
// ============================================================
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

  // MODAL EDIT
  const [editModal, setEditModal] = useState(false);
  const [editForm, setEditForm] = useState<Partial<KanjiItem>>({});
  const [saving, setSaving] = useState(false);

  // TOAST
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const slideAnim = useRef(new Animated.Value(-100)).current;

  // CARD ANIMATION
  const cardAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const triggerToast = (type: "success" | "error", text: string) => {
    setToast({ type, text });
    Animated.timing(slideAnim, { toValue: 40, duration: 400, useNativeDriver: true }).start();
    setTimeout(() => {
      Animated.timing(slideAnim, { toValue: -100, duration: 400, useNativeDriver: true })
        .start(() => setToast(null));
    }, 3500);
  };

  // ============================================================
  // FETCH KANJI CỦA NHÓM NÀY
  // ============================================================
  const fetchKanji = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { limit: LIMIT, page: 1 };
      if (isUnnamed) {
        params.group = ""; // backend sẽ lọc empty string
      } else {
        params.group = group;
      }

      const res = await api.get("/api/kanji/all", { params });
      if (res.data.success) {
        setKanjiList(res.data.data);
        setPagination(res.data.pagination);
        setCurrentIndex(0);
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

  // ============================================================
  // ĐIỀU HƯỚNG NEXT / PREV (với animation slide)
  // ============================================================
  const navigateKanji = (direction: "next" | "prev") => {
    const newIndex =
      direction === "next"
        ? Math.min(currentIndex + 1, kanjiList.length - 1)
        : Math.max(currentIndex - 1, 0);

    if (newIndex === currentIndex) return;

    // Slide + fade animation
    Animated.parallel([
      Animated.sequence([
        Animated.timing(cardAnim, {
          toValue: direction === "next" ? -40 : 40,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(cardAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 0.3, duration: 100, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]),
    ]).start();

    setCurrentIndex(newIndex);
    setAnimationKey((k) => k + 1);
  };

  // ============================================================
  // XÓA KANJI
  // ============================================================
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

  // ============================================================
  // EDIT MODAL
  // ============================================================
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

  // ============================================================
  // HTML NÉT VẼ HOẠT HỌA
  // ============================================================
  const generateStrokeHtml = (char: string) => {
    const strokeColor = isDark ? "#F59E0B" : "#1E293B";
    const outlineColor = isDark ? "#334155" : "#E2E8F0";
    return `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<script src="https://cdn.jsdelivr.net/npm/hanzi-writer@3.5/dist/hanzi-writer.min.js"></script>
<style>
  body{margin:0;padding:0;display:flex;justify-content:center;align-items:center;
    background:transparent;height:100vh;overflow:hidden;}
  #kb{width:160px;height:160px;}
</style>
</head><body>
<div id="kb"></div>
<script>
  var w=HanziWriter.create('kb','${char}',{
    width:160,height:160,padding:4,
    strokeAnimationSpeed:1.0,delayBetweenStrokes:200,
    strokeColor:'${strokeColor}',outlineColor:'${outlineColor}',
    radicalColor:'#EF4444',showOutline:true
  });
  w.animateCharacter();
</script>
</body></html>`;
  };

  // ============================================================
  // RENDER
  // ============================================================
  const currentKanji = kanjiList[currentIndex] || null;

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Header title={displayTitle} />
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={colors.amber} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>Đang tải Kanji...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <Toast toast={toast} slideAnim={slideAnim} />

      {/* HEADER với tiêu đề bài học */}
      <Header
        title={`📖 ${displayTitle}`}
        rightAction={
          kanjiList.length > 0 ? (
            <View style={[styles.totalBadge, { backgroundColor: isDark ? "#2D1A10" : "#FEF3C7" }]}>
              <Text style={[styles.totalBadgeText, { color: colors.amber }]}>
                {kanjiList.length} chữ
              </Text>
            </View>
          ) : (
            <View style={{ width: 60 }} />
          )
        }
      />

      {/* PROGRESS BAR */}
      {kanjiList.length > 0 && (
        <View style={styles.progressSection}>
          <View style={[styles.progressBarBg, { backgroundColor: isDark ? "#334155" : "#E2E8F0" }]}>
            <Animated.View
              style={[
                styles.progressBarFill,
                {
                  backgroundColor: colors.amber,
                  width: `${((currentIndex + 1) / kanjiList.length) * 100}%`,
                },
              ]}
            />
          </View>
          <Text style={[styles.progressText, { color: colors.textMuted }]}>
            {currentIndex + 1} / {kanjiList.length}
          </Text>
        </View>
      )}

      {/* NỘI DUNG */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {kanjiList.length === 0 ? (
          <View style={styles.emptyBox}>
            <MaterialIcons name="inbox" size={56} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Bài học trống</Text>
            <Text style={[styles.emptyDesc, { color: colors.textMuted }]}>
              Chưa có Kanji nào trong bài học này.
            </Text>
          </View>
        ) : currentKanji ? (
          <Animated.View
            style={{
              transform: [{ translateX: cardAnim }],
              opacity: fadeAnim,
            }}
          >
            {/* ===== THẺ KANJI CHÍNH ===== */}
            <View style={[styles.mainCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>

              {/* HEADER THẺ: Level badge + Edit/Delete */}
              <View style={styles.cardTopRow}>
                <View style={[styles.levelBadge, { backgroundColor: isDark ? "#1E3A5F" : "#DBEAFE" }]}>
                  <Text style={[styles.levelBadgeText, { color: isDark ? "#93C5FD" : "#1D4ED8" }]}>
                    {currentKanji.level}
                  </Text>
                </View>
                <View style={styles.actionBtns}>
                  <TouchableOpacity
                    style={[styles.iconBtn, { backgroundColor: isDark ? "#1C2A3A" : "#EFF6FF" }]}
                    onPress={() => openEditModal(currentKanji)}
                  >
                    <MaterialIcons name="edit" size={18} color={isDark ? "#60A5FA" : "#2563EB"} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.iconBtn, { backgroundColor: isDark ? "#3A1C1C" : "#FFF0F0" }]}
                    onPress={() => handleDelete(currentKanji)}
                  >
                    <MaterialIcons name="delete-outline" size={18} color={isDark ? "#F87171" : "#DC2626"} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* LAYOUT: INFO TRÁI + Ô VUÔNG NÉT VẼ PHẢI */}
              <View style={styles.rowLayout}>
                {/* THÔNG TIN BÊN TRÁI */}
                <View style={styles.leftBlock}>
                  <Text style={[styles.hanVietText, { color: colors.amber }]}>
                    {currentKanji.vietnamese_reading}
                  </Text>
                  <Text style={[styles.meaningText, { color: colors.text }]}>
                    {currentKanji.meaning}
                  </Text>
                  <View style={styles.yomiStack}>
                    <View style={[styles.yomiBadge, { backgroundColor: isDark ? "#1A2E1A" : "#F0FDF4" }]}>
                      <Text style={[styles.yomiLabel, { color: isDark ? "#86EFAC" : "#166534" }]}>ON</Text>
                      <Text style={[styles.yomiValue, { color: colors.text }]}>{currentKanji.onyomi || "—"}</Text>
                    </View>
                    <View style={[styles.yomiBadge, { backgroundColor: isDark ? "#1A2035" : "#F5F3FF" }]}>
                      <Text style={[styles.yomiLabel, { color: isDark ? "#C4B5FD" : "#7C3AED" }]}>KUN</Text>
                      <Text style={[styles.yomiValue, { color: colors.text }]}>{currentKanji.kunyomi || "—"}</Text>
                    </View>
                  </View>
                </View>

                {/* Ô VUÔNG HOẠT HỌA BÊN PHẢI */}
                <View style={styles.rightBlock}>
                  <View
                    style={[
                      styles.webViewBox,
                      { borderColor: colors.amber, backgroundColor: isDark ? "#1E293B" : "#FFFBEB" },
                    ]}
                  >
                    {Platform.OS === "web" ? (
                      <iframe
                        key={`${currentKanji._id}-${animationKey}`}
                        srcDoc={generateStrokeHtml(currentKanji.character)}
                        style={{ width: "160px", height: "160px", border: "none", backgroundColor: "transparent" }}
                      />
                    ) : (
                      <ExpoWebView
                        key={`${currentKanji._id}-${animationKey}`}
                        originWhitelist={["*"]}
                        source={{ html: generateStrokeHtml(currentKanji.character) }}
                        style={{ width: 160, height: 160, backgroundColor: "transparent" }}
                        scrollEnabled={false}
                        javaScriptEnabled
                      />
                    )}
                  </View>
                  <TouchableOpacity
                    style={[styles.replayBtn, { backgroundColor: isDark ? "#2D1A10" : "#FEF3C7" }]}
                    onPress={() => setAnimationKey((k) => k + 1)}
                  >
                    <MaterialIcons name="replay" size={14} color={colors.amber} />
                    <Text style={[styles.replayText, { color: colors.amber }]}>Xem lại</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* BỘ THỦ */}
              {currentKanji.components && currentKanji.components.length > 0 && (
                <>
                  <View style={[styles.divider, { backgroundColor: colors.border }]} />
                  <View>
                    <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>🧩 Bộ thủ:</Text>
                    <View style={styles.compChipRow}>
                      {currentKanji.components.map((c, i) => (
                        <View
                          key={i}
                          style={[styles.compChip, { backgroundColor: isDark ? "#2C1A10" : "#FEF3C7", borderColor: colors.amber }]}
                        >
                          <Text style={[styles.compChipText, { color: colors.amber }]}>{c}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </>
              )}

              {/* CÂU CHUYỆN GHI NHỚ */}
              {!!currentKanji.story && (
                <>
                  <View style={[styles.divider, { backgroundColor: colors.border }]} />
                  <View style={[styles.storyBox, { backgroundColor: isDark ? "#1A2035" : "#F5F3FF", borderColor: isDark ? "#3B2E6E" : "#DDD6FE" }]}>
                    <MaterialIcons name="auto-stories" size={16} color={isDark ? "#C4B5FD" : "#7C3AED"} style={{ marginRight: 8 }} />
                    <Text style={[styles.storyText, { color: isDark ? "#C4B5FD" : "#5B21B6", flex: 1 }]}>
                      {currentKanji.story}
                    </Text>
                  </View>
                </>
              )}

              {/* TỪ VỰNG VÍ DỤ */}
              {currentKanji.example_words && currentKanji.example_words.length > 0 && (
                <>
                  <View style={[styles.divider, { backgroundColor: colors.border }]} />
                  <Text style={[styles.sectionLabel, { color: colors.textMuted, marginBottom: 10 }]}>
                    ⭐ Từ vựng ví dụ:
                  </Text>
                  {currentKanji.example_words.map((ex, i) => (
                    <View key={i} style={[styles.exRow, { backgroundColor: colors.background }]}>
                      <MaterialIcons name="star" size={14} color={colors.amber} style={{ marginRight: 8 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.exWord, { color: colors.text }]}>
                          {ex.word}{" "}
                          <Text style={{ color: colors.textMuted, fontWeight: "400" }}>({ex.reading})</Text>
                        </Text>
                        <Text style={[styles.exMeaning, { color: colors.textMuted }]}>{ex.meaning}</Text>
                      </View>
                    </View>
                  ))}
                </>
              )}
            </View>

            {/* ===== NÚT ĐIỀU HƯỚNG PREV / NEXT ===== */}
            <View style={styles.navRow}>
              <TouchableOpacity
                style={[
                  styles.navBtn,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    opacity: currentIndex === 0 ? 0.35 : 1,
                  },
                ]}
                onPress={() => navigateKanji("prev")}
                disabled={currentIndex === 0}
              >
                <MaterialIcons name="arrow-back-ios" size={20} color={colors.amber} />
                <Text style={[styles.navBtnText, { color: colors.text }]}>Trước</Text>
              </TouchableOpacity>

              {/* INDEX PILL */}
              <View style={[styles.indexPill, { backgroundColor: isDark ? "#1E293B" : "#F8FAFC" }]}>
                <Text style={[styles.indexPillText, { color: colors.amber }]}>
                  {currentIndex + 1} / {kanjiList.length}
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.navBtn,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    opacity: currentIndex === kanjiList.length - 1 ? 0.35 : 1,
                  },
                ]}
                onPress={() => navigateKanji("next")}
                disabled={currentIndex === kanjiList.length - 1}
              >
                <Text style={[styles.navBtnText, { color: colors.text }]}>Tiếp</Text>
                <MaterialIcons name="arrow-forward-ios" size={20} color={colors.amber} />
              </TouchableOpacity>
            </View>

            {/* HOÀN THÀNH BÀI HỌC */}
            {currentIndex === kanjiList.length - 1 && (
              <View
                style={[
                  styles.finishBanner,
                  { backgroundColor: isDark ? "#1A2E1A" : "#F0FDF4", borderColor: isDark ? "#15532D" : "#BBF7D0" },
                ]}
              >
                <MaterialIcons name="celebration" size={22} color={isDark ? "#86EFAC" : "#16A34A"} />
                <Text style={[styles.finishText, { color: isDark ? "#86EFAC" : "#16A34A" }]}>
                  🎉 Bạn đã xem hết bài học này!
                </Text>
                <TouchableOpacity onPress={() => router.back()}>
                  <Text style={[styles.finishBack, { color: isDark ? "#86EFAC" : "#16A34A" }]}>
                    ← Quay lại
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </Animated.View>
        ) : null}
      </ScrollView>

      {/* ================================================
          MODAL CHỈNH SỬA KANJI
          ================================================ */}
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
              {/* CHỮ KANJI */}
              <Text style={[styles.editLabel, { color: colors.textMuted }]}>Chữ Kanji</Text>
              <TextInput
                style={[styles.editInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text, fontSize: 24, textAlign: "center" }]}
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

              {/* CẤP ĐỘ */}
              <Text style={[styles.editLabel, { color: colors.textMuted }]}>Cấp độ</Text>
              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                {["N5", "N4", "N3", "N2", "N1"].map((lv) => (
                  <TouchableOpacity
                    key={lv}
                    style={[
                      styles.editLevelChip,
                      {
                        backgroundColor: editForm.level === lv ? colors.amber : isDark ? "#334155" : "#F1F5F9",
                        borderColor: editForm.level === lv ? colors.amber : colors.border,
                      },
                    ]}
                    onPress={() => setEditForm((p) => ({ ...p, level: lv }))}
                  >
                    <Text style={{ color: editForm.level === lv ? "#FFF" : colors.textMuted, fontWeight: "700", fontSize: 13 }}>
                      {lv}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* BÀI HỌC / NHÓM */}
              <Text style={[styles.editLabel, { color: colors.textMuted }]}>Bài học / Nhóm</Text>
              <TextInput
                style={[styles.editInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                value={editForm.lessonGroup}
                onChangeText={(t) => setEditForm((p) => ({ ...p, lessonGroup: t }))}
                placeholder="VD: Bài 1 - Số đếm"
                placeholderTextColor={colors.textMuted}
              />

              {/* BỘ THỦ */}
              <Text style={[styles.editLabel, { color: colors.textMuted }]}>Bộ thủ (phân cách dấu phẩy)</Text>
              <TextInput
                style={[styles.editInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                value={(editForm.components || []).join(", ")}
                onChangeText={(t) =>
                  setEditForm((p) => ({
                    ...p,
                    components: t.split(",").map((s) => s.trim()).filter(Boolean),
                  }))
                }
                placeholder="一, 冂, 工"
                placeholderTextColor={colors.textMuted}
              />

              {/* CÂU CHUYỆN */}
              <Text style={[styles.editLabel, { color: colors.textMuted }]}>Câu chuyện / Mẹo nhớ</Text>
              <TextInput
                style={[styles.editInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text, minHeight: 80, textAlignVertical: "top" }]}
                value={editForm.story}
                onChangeText={(t) => setEditForm((p) => ({ ...p, story: t }))}
                multiline
                numberOfLines={4}
              />

              {/* NÚT LƯU */}
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: colors.amber, opacity: saving ? 0.6 : 1 }]}
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
    </View>
  );
}

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
  container: { flex: 1 },
  centerBox: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { marginTop: 12, fontSize: 14, fontWeight: "500" },

  totalBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 },
  totalBadgeText: { fontSize: 13, fontWeight: "800" },

  progressSection: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 6,
  },
  progressBarBg: { height: 5, borderRadius: 5, overflow: "hidden" },
  progressBarFill: { height: 5, borderRadius: 5 },
  progressText: { fontSize: 12, fontWeight: "600", textAlign: "right" },

  // MAIN CARD
  mainCard: {
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    marginBottom: 16,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 4,
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  levelBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10 },
  levelBadgeText: { fontSize: 12, fontWeight: "800" },
  actionBtns: { flexDirection: "row", gap: 10 },
  iconBtn: { width: 38, height: 38, borderRadius: 10, justifyContent: "center", alignItems: "center" },

  rowLayout: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  leftBlock: { flex: 1, paddingRight: 14 },
  hanVietText: { fontSize: 26, fontWeight: "900", marginBottom: 4 },
  meaningText: { fontSize: 16, fontWeight: "600", lineHeight: 22, marginBottom: 12 },
  yomiStack: { gap: 8 },
  yomiBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, gap: 6 },
  yomiLabel: { fontSize: 11, fontWeight: "800" },
  yomiValue: { fontSize: 13, fontWeight: "500", flex: 1 },

  rightBlock: { alignItems: "center" },
  webViewBox: { width: 160, height: 160, borderRadius: 16, borderWidth: 2, overflow: "hidden" },
  replayBtn: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, marginTop: 8, gap: 4 },
  replayText: { fontSize: 12, fontWeight: "700" },

  divider: { height: 1, marginVertical: 14 },
  sectionLabel: { fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  compChipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  compChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, borderWidth: 1 },
  compChipText: { fontSize: 14, fontWeight: "800" },
  storyBox: { flexDirection: "row", alignItems: "flex-start", padding: 12, borderRadius: 12, borderWidth: 1 },
  storyText: { fontSize: 13, lineHeight: 20, fontStyle: "italic" },
  exRow: { flexDirection: "row", alignItems: "flex-start", padding: 10, borderRadius: 10, marginBottom: 6 },
  exWord: { fontSize: 15, fontWeight: "700" },
  exMeaning: { fontSize: 12, marginTop: 2 },

  // NAV
  navRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  navBtn: { flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingVertical: 12, borderRadius: 14, borderWidth: 1, gap: 6 },
  navBtnText: { fontSize: 14, fontWeight: "700" },
  indexPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  indexPillText: { fontSize: 14, fontWeight: "800" },

  // FINISH BANNER
  finishBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
    flexWrap: "wrap",
    marginBottom: 16,
  },
  finishText: { flex: 1, fontSize: 14, fontWeight: "700" },
  finishBack: { fontSize: 13, fontWeight: "700", textDecorationLine: "underline" },

  // EMPTY
  emptyBox: { alignItems: "center", paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: "800", marginTop: 16, marginBottom: 8 },
  emptyDesc: { fontSize: 14, textAlign: "center", lineHeight: 22 },

  // MODAL
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  modalBox: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: "90%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: "800" },
  editLabel: { fontSize: 12, fontWeight: "700", marginBottom: 6, marginTop: 12, textTransform: "uppercase", letterSpacing: 0.5 },
  editInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, marginBottom: 2 },
  editLevelChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, borderWidth: 1.5 },
  saveBtn: { flexDirection: "row", justifyContent: "center", alignItems: "center", paddingVertical: 14, borderRadius: 14, marginTop: 20, marginBottom: 8, gap: 8 },
  saveBtnText: { color: "#FFF", fontSize: 15, fontWeight: "800" },
});
