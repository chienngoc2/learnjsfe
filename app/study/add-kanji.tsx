import React, { useState, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Animated,
  Platform,
  ActivityIndicator,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import api from "../../services/api";
import Button from "../../components/ui/Button";
import Toast from "../../components/ui/Toast";
import Header from "../../components/ui/Header";
import { useTheme } from "@/src/context/ThemeContext";

// ============================================================
// INTERFACE
// ============================================================
interface KanjiItem {
  _id?: string;
  character: string;
  meaning: string;
  onyomi: string;
  kunyomi: string;
  vietnamese_reading: string;
  level: string;
  components?: string[];
  story?: string;
  lessonGroup?: string;
}

const LEVEL_OPTIONS = ["N5", "N4", "N3", "N2", "N1"];

const LEVEL_COLORS: Record<string, string> = {
  N5: "#10B981",
  N4: "#3B82F6",
  N3: "#F59E0B",
  N2: "#8B5CF6",
  N1: "#EF4444",
};

const EMPTY_FORM: KanjiItem = {
  character: "",
  meaning: "",
  onyomi: "",
  kunyomi: "",
  vietnamese_reading: "",
  level: "N5",
  components: [],
  story: "",
  lessonGroup: "",
};

// ============================================================
// COMPONENT CHÍNH
// ============================================================
export default function AddKanjiScreen() {
  const { colors, isDark } = useTheme();

  const [isBulkMode, setIsBulkMode] = useState(false);

  // === MANUAL FORM STATE ===
  const [form, setForm] = useState<KanjiItem>({ ...EMPTY_FORM });
  const [componentInput, setComponentInput] = useState("");

  // === BULK STATE ===
  const [bulkText, setBulkText] = useState("");
  const [bulkLessonGroup, setBulkLessonGroup] = useState("");
  const [bulkLevel, setBulkLevel] = useState("N5");
  const [previewCount, setPreviewCount] = useState(0);
  const [parseError, setParseError] = useState("");
  const [parsedItems, setParsedItems] = useState<KanjiItem[]>([]);

  // === LOADING ===
  const [loading, setLoading] = useState(false);

  // === RESULT STATS ===
  const [lastResult, setLastResult] = useState<{
    added: number;
    updated: number;
    errors: string[];
  } | null>(null);

  // === TOAST ===
  const [toast, setToast] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const slideAnim = useRef(new Animated.Value(-100)).current;

  const triggerToast = (type: "success" | "error", text: string) => {
    setToast({ type, text });
    Animated.timing(slideAnim, { toValue: 40, duration: 400, useNativeDriver: true }).start();
    setTimeout(() => {
      Animated.timing(slideAnim, { toValue: -100, duration: 400, useNativeDriver: true }).start(
        () => setToast(null),
      );
    }, 3500);
  };

  // ============================================================
  // PARSE JSON BULK
  // ============================================================
  const parseBulkJson = (text: string) => {
    try {
      setParseError("");
      const trimmed = text.trim();
      if (!trimmed) {
        setParsedItems([]);
        setPreviewCount(0);
        return [];
      }
      let parsed: any;
      if (trimmed.startsWith("[")) {
        parsed = JSON.parse(trimmed);
      } else if (trimmed.startsWith("{")) {
        parsed = [JSON.parse(trimmed)];
      } else {
        throw new Error("Cần là JSON Array [] hoặc Object {}");
      }
      if (!Array.isArray(parsed)) throw new Error("JSON phải là mảng []");
      setParsedItems(parsed);
      setPreviewCount(parsed.length);
      return parsed;
    } catch (e: any) {
      setParseError(e.message || "JSON không hợp lệ");
      setParsedItems([]);
      setPreviewCount(0);
      return [];
    }
  };

  const handleBulkTextChange = (text: string) => {
    setBulkText(text);
    parseBulkJson(text);
  };

  // ============================================================
  // FORM HELPERS
  // ============================================================
  const setField = (key: keyof KanjiItem, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const addComponent = () => {
    const c = componentInput.trim();
    if (!c) return;
    setForm((prev) => ({ ...prev, components: [...(prev.components || []), c] }));
    setComponentInput("");
  };

  const removeComponent = (index: number) =>
    setForm((prev) => ({
      ...prev,
      components: (prev.components || []).filter((_, i) => i !== index),
    }));

  // ============================================================
  // SUBMIT THỦ CÔNG
  // ============================================================
  const handleSubmitManual = async () => {
    if (!form.character.trim()) return triggerToast("error", "Vui lòng nhập chữ Kanji!");
    if (!form.meaning.trim()) return triggerToast("error", "Vui lòng nhập ý nghĩa!");
    if (!form.vietnamese_reading.trim()) return triggerToast("error", "Vui lòng nhập âm Hán Việt!");

    setLoading(true);
    try {
      const res = await api.post("/api/kanji/add", {
        character: form.character.trim(),
        meaning: form.meaning.trim(),
        onyomi: form.onyomi.trim(),
        kunyomi: form.kunyomi.trim(),
        vietnamese_reading: form.vietnamese_reading.trim(),
        level: form.level,
        components: form.components || [],
        story: form.story?.trim() || "",
        lessonGroup: form.lessonGroup?.trim() || "",
      });
      if (res.data.success) {
        triggerToast("success", `🎉 Đã lưu Kanji "${form.character}"!`);
        setForm({ ...EMPTY_FORM });
        setComponentInput("");
      } else {
        triggerToast("error", res.data.message || "Lỗi khi lưu Kanji.");
      }
    } catch (error: any) {
      triggerToast("error", error?.response?.data?.message || "Lỗi kết nối Backend!");
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // SUBMIT BULK
  // ============================================================
  const handleSubmitBulk = async () => {
    const items = parseBulkJson(bulkText);
    if (!items || items.length === 0) {
      triggerToast("error", "JSON trống hoặc không hợp lệ!");
      return;
    }
    setLoading(true);
    setLastResult(null);
    try {
      const res = await api.post("/api/kanji/bulk-add", {
        items,
        defaultLessonGroup: bulkLessonGroup.trim(),
        defaultLevel: bulkLevel,
      });
      if (res.data.success) {
        const d = res.data.data;
        setLastResult(d);
        triggerToast(
          "success",
          `✅ Thêm: ${d.added} | Cập nhật: ${d.updated} | Lỗi: ${d.errors.length}`,
        );
        setBulkText("");
        setParsedItems([]);
        setPreviewCount(0);
      } else {
        triggerToast("error", res.data.message || "Import thất bại.");
      }
    } catch {
      triggerToast("error", "Lỗi kết nối Backend!");
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // LEVEL CHIP COMPONENT
  // ============================================================
  const LevelChips = ({
    selected,
    onSelect,
  }: {
    selected: string;
    onSelect: (lv: string) => void;
  }) => (
    <View style={styles.levelRow}>
      {LEVEL_OPTIONS.map((lv) => {
        const isActive = selected === lv;
        const accent = LEVEL_COLORS[lv];
        return (
          <TouchableOpacity
            key={lv}
            style={[
              styles.levelChip,
              {
                backgroundColor: isActive ? accent : isDark ? "#1E293B" : "#F1F5F9",
                borderColor: isActive ? accent : colors.border,
                shadowColor: isActive ? accent : "transparent",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: isActive ? 0.4 : 0,
                shadowRadius: 8,
                elevation: isActive ? 4 : 0,
              },
            ]}
            onPress={() => onSelect(lv)}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.levelChipText,
                { color: isActive ? "#FFF" : colors.textMuted, fontWeight: isActive ? "800" : "600" },
              ]}
            >
              {lv}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ headerShown: false }} />
      <Toast toast={toast} slideAnim={slideAnim} />
      <Header title="✍️ Thêm Kanji Mới" />

      {/* ===== TAB SWITCHER XỊN SÒ ===== */}
      <View style={[styles.tabWrapper, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <View style={[styles.tabPill, { backgroundColor: isDark ? "#1E293B" : "#F1F5F9" }]}>
          {[
            { label: "✍️ Thủ công", value: false },
            { label: "📋 JSON hàng loạt", value: true },
          ].map(({ label, value }) => (
            <TouchableOpacity
              key={String(value)}
              style={[
                styles.tabBtn,
                isBulkMode === value && {
                  backgroundColor: colors.surface,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.08,
                  shadowRadius: 6,
                  elevation: 3,
                },
              ]}
              onPress={() => setIsBulkMode(value)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.tabBtnText,
                  { color: isBulkMode === value ? colors.text : colors.textMuted },
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ====================================================
            CHẾ ĐỘ NHẬP THỦ CÔNG
            ==================================================== */}
        {!isBulkMode ? (
          <>
            {/* CARD 1: THÔNG TIN CƠ BẢN */}
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {/* SECTION HEADER */}
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionIconBox, { backgroundColor: colors.amber + "20" }]}>
                  <MaterialIcons name="info" size={18} color={colors.amber} />
                </View>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Thông tin cơ bản</Text>
              </View>

              {/* KANJI CHARACTER — lớn và nổi bật */}
              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Chữ Kanji *</Text>
              <View style={[styles.kanjiInputWrapper, { borderColor: form.character ? colors.amber : colors.border, backgroundColor: colors.background }]}>
                <TextInput
                  style={[styles.kanjiInput, { color: colors.text }]}
                  value={form.character}
                  onChangeText={(t) => setField("character", t)}
                  placeholder="一"
                  placeholderTextColor={colors.textMuted + "80"}
                  maxLength={3}
                  textAlign="center"
                />
              </View>

              {/* 2 CỘT: Ý NGHĨA + ÂM HÁN VIỆT */}
              <View style={styles.twoCol}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Ý nghĩa *</Text>
                  <TextInput
                    style={[styles.fieldInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                    value={form.meaning}
                    onChangeText={(t) => setField("meaning", t)}
                    placeholder="Một, Thứ nhất"
                    placeholderTextColor={colors.textMuted + "80"}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Âm Hán Việt *</Text>
                  <TextInput
                    style={[styles.fieldInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                    value={form.vietnamese_reading}
                    onChangeText={(t) => setField("vietnamese_reading", t)}
                    placeholder="NHẤT"
                    placeholderTextColor={colors.textMuted + "80"}
                    autoCapitalize="characters"
                  />
                </View>
              </View>

              {/* ÂM ON + KUN */}
              <View style={styles.twoCol}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Âm ON 音</Text>
                  <TextInput
                    style={[styles.fieldInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                    value={form.onyomi}
                    onChangeText={(t) => setField("onyomi", t)}
                    placeholder="いち"
                    placeholderTextColor={colors.textMuted + "80"}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Âm KUN 訓</Text>
                  <TextInput
                    style={[styles.fieldInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                    value={form.kunyomi}
                    onChangeText={(t) => setField("kunyomi", t)}
                    placeholder="ひと"
                    placeholderTextColor={colors.textMuted + "80"}
                  />
                </View>
              </View>

              {/* CẤP ĐỘ */}
              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Cấp độ JLPT</Text>
              <LevelChips selected={form.level} onSelect={(lv) => setField("level", lv)} />

              {/* BÀI HỌC / NHÓM */}
              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Bài học / Nhóm</Text>
              <View style={[styles.iconInput, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <MaterialIcons name="folder-open" size={18} color={colors.textMuted} style={{ marginLeft: 12 }} />
                <TextInput
                  style={[styles.iconInputText, { color: colors.text }]}
                  value={form.lessonGroup}
                  onChangeText={(t) => setField("lessonGroup", t)}
                  placeholder="VD: Bài 1 - Số đếm"
                  placeholderTextColor={colors.textMuted + "80"}
                />
              </View>
            </View>

            {/* CARD 2: BỘ THỦ & CÂU CHUYỆN */}
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionIconBox, { backgroundColor: "#8B5CF620" }]}>
                  <MaterialIcons name="auto-stories" size={18} color="#8B5CF6" />
                </View>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Bộ thủ & Mẹo nhớ</Text>
              </View>

              {/* NHẬP BỘ THỦ */}
              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Bộ thủ / Thành phần</Text>
              <View style={styles.componentRow}>
                <View style={[styles.iconInput, { flex: 1, marginRight: 8, backgroundColor: colors.background, borderColor: colors.border }]}>
                  <MaterialIcons name="category" size={18} color={colors.textMuted} style={{ marginLeft: 12 }} />
                  <TextInput
                    style={[styles.iconInputText, { color: colors.text }]}
                    value={componentInput}
                    onChangeText={setComponentInput}
                    placeholder="Nhập bộ thủ rồi bấm +"
                    placeholderTextColor={colors.textMuted + "80"}
                    onSubmitEditing={addComponent}
                  />
                </View>
                <TouchableOpacity
                  style={[styles.addBtn, { backgroundColor: colors.amber }]}
                  onPress={addComponent}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="add" size={22} color="#FFF" />
                </TouchableOpacity>
              </View>

              {/* CHIP BỘ THỦ */}
              {(form.components || []).length > 0 && (
                <View style={styles.chipWrap}>
                  {(form.components || []).map((c, i) => (
                    <TouchableOpacity
                      key={i}
                      style={[styles.chip, { backgroundColor: colors.amber + "18", borderColor: colors.amber + "60" }]}
                      onPress={() => removeComponent(i)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.chipText, { color: colors.amber }]}>{c}</Text>
                      <MaterialIcons name="close" size={13} color={colors.amber} style={{ marginLeft: 3 }} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* CÂU CHUYỆN */}
              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Câu chuyện / Mẹo nhớ</Text>
              <TextInput
                style={[styles.textArea, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                value={form.story}
                onChangeText={(t) => setField("story", t)}
                placeholder="Ví dụ: Một nét ngang duy nhất như số 1..."
                placeholderTextColor={colors.textMuted + "80"}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            {/* NÚT LƯU */}
            <TouchableOpacity
              style={[styles.submitBtn, { opacity: loading ? 0.7 : 1 }]}
              onPress={handleSubmitManual}
              disabled={loading}
              activeOpacity={0.8}
            >
              <View style={[styles.submitGradient, { backgroundColor: colors.amber }]}>
                {loading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <MaterialIcons name="save" size={20} color="#FFF" />
                    <Text style={styles.submitBtnText}>Lưu Kanji</Text>
                  </>
                )}
              </View>
            </TouchableOpacity>
          </>
        ) : (
          /* ====================================================
              CHẾ ĐỘ DÁN JSON HÀNG LOẠT - REDESIGN
              ==================================================== */
          <>
            {/* CARD 1: CẤU HÌNH BÀI HỌC */}
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionIconBox, { backgroundColor: "#3B82F620" }]}>
                  <MaterialIcons name="folder-special" size={18} color="#3B82F6" />
                </View>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Gán bài học & Trình độ</Text>
              </View>

              <Text style={[styles.fieldSubtitle, { color: colors.textMuted }]}>
                Áp dụng cho toàn batch (item nào đã có sẵn trong JSON sẽ được ưu tiên)
              </Text>

              {/* TÊN BÀI HỌC */}
              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Tên bài học</Text>
              <View style={[styles.iconInput, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <MaterialIcons name="book" size={18} color="#3B82F6" style={{ marginLeft: 12 }} />
                <TextInput
                  style={[styles.iconInputText, { color: colors.text }]}
                  value={bulkLessonGroup}
                  onChangeText={setBulkLessonGroup}
                  placeholder="VD: Bài 1 - Số đếm, N5 Cơ bản"
                  placeholderTextColor={colors.textMuted + "80"}
                />
              </View>

              {/* TRÌNH ĐỘ MẶC ĐỊNH */}
              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Trình độ mặc định</Text>
              <LevelChips selected={bulkLevel} onSelect={setBulkLevel} />
            </View>

            {/* CARD 2: PASTE JSON */}
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionIconBox, { backgroundColor: "#10B98120" }]}>
                  <MaterialIcons name="data-array" size={18} color="#10B981" />
                </View>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Dán JSON Kanji</Text>
              </View>

              {/* INFO HINT */}
              <View style={[styles.infoBox, { backgroundColor: isDark ? "#1E2A45" : "#EFF6FF", borderColor: isDark ? "#3B5998" : "#BFDBFE" }]}>
                <MaterialIcons name="lightbulb" size={15} color={isDark ? "#93C5FD" : "#3B82F6"} style={{ marginRight: 8, marginTop: 1 }} />
                <Text style={[styles.infoText, { color: isDark ? "#93C5FD" : "#1D4ED8", flex: 1 }]}>
                  {"Kanji trùng sẽ được tự động cập nhật (upsert). Mỗi item cần: character, meaning, vietnamese_reading"}
                </Text>
              </View>

              {/* JSON EXAMPLE (có thể thu gọn) */}
              <View style={[styles.codeBox, { backgroundColor: isDark ? "#0D1B0F" : "#F0FDF4", borderColor: isDark ? "#1A4030" : "#86EFAC" }]}>
                <View style={styles.codeBoxHeader}>
                  <MaterialIcons name="code" size={14} color={isDark ? "#86EFAC" : "#16A34A"} />
                  <Text style={[styles.codeBoxLabel, { color: isDark ? "#86EFAC" : "#16A34A" }]}>Ví dụ định dạng JSON</Text>
                </View>
                <Text style={[styles.codeText, { color: isDark ? "#86EFAC" : "#166534" }]}>
                  {`[\n  {\n    "character": "一",\n    "meaning": "Một",\n    "onyomi": "いち",\n    "kunyomi": "ひと",\n    "vietnamese_reading": "NHẤT",\n    "level": "N5",\n    "lessonGroup": "Bài 1",\n    "components": ["一"],\n    "story": "Một nét ngang"\n  }\n]`}
                </Text>
              </View>

              {/* TEXTAREA DÁN JSON */}
              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Nội dung JSON</Text>
              <TextInput
                style={[
                  styles.textArea,
                  styles.jsonArea,
                  {
                    backgroundColor: colors.background,
                    borderColor: parseError ? "#EF4444" : previewCount > 0 ? "#10B981" : colors.border,
                    color: colors.text,
                  },
                ]}
                value={bulkText}
                onChangeText={handleBulkTextChange}
                placeholder={`[\n  {\n    "character": "一",\n    ...\n  }\n]`}
                placeholderTextColor={colors.textMuted + "60"}
                multiline
                numberOfLines={10}
                textAlignVertical="top"
                autoCapitalize="none"
                autoCorrect={false}
              />

              {/* STATUS ROW */}
              <View style={styles.statusRow}>
                {parseError ? (
                  <View style={[styles.statusBadge, { backgroundColor: "#FEF2F2", borderColor: "#FCA5A5" }]}>
                    <MaterialIcons name="error" size={14} color="#EF4444" />
                    <Text style={[styles.statusText, { color: "#DC2626" }]} numberOfLines={2}>
                      {parseError}
                    </Text>
                  </View>
                ) : previewCount > 0 ? (
                  <View style={[styles.statusBadge, { backgroundColor: isDark ? "#052E16" : "#F0FDF4", borderColor: isDark ? "#166534" : "#86EFAC" }]}>
                    <MaterialIcons name="check-circle" size={14} color="#10B981" />
                    <Text style={[styles.statusText, { color: isDark ? "#86EFAC" : "#166534" }]}>
                      Đọc được {previewCount} Kanji — sẵn sàng import
                    </Text>
                  </View>
                ) : (
                  <View style={[styles.statusBadge, { backgroundColor: isDark ? "#1E293B" : "#F8FAFC", borderColor: colors.border }]}>
                    <MaterialIcons name="info-outline" size={14} color={colors.textMuted} />
                    <Text style={[styles.statusText, { color: colors.textMuted }]}>
                      Dán JSON vào ô trên để bắt đầu
                    </Text>
                  </View>
                )}
              </View>

              {/* PREVIEW MINI CHARACTERS */}
              {parsedItems.length > 0 && (
                <View style={styles.previewSection}>
                  <Text style={[styles.previewLabel, { color: colors.textMuted }]}>Xem trước:</Text>
                  <View style={styles.previewCharRow}>
                    {parsedItems.slice(0, 10).map((item, i) => (
                      <View
                        key={i}
                        style={[
                          styles.previewChar,
                          { backgroundColor: colors.amber + "15", borderColor: colors.amber + "50" },
                        ]}
                      >
                        <Text style={[styles.previewCharText, { color: colors.amber }]}>
                          {item.character || "?"}
                        </Text>
                      </View>
                    ))}
                    {parsedItems.length > 10 && (
                      <View style={[styles.previewChar, { backgroundColor: colors.border, borderColor: colors.border }]}>
                        <Text style={[styles.previewCharText, { color: colors.textMuted, fontSize: 11 }]}>
                          +{parsedItems.length - 10}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              )}
            </View>

            {/* KẾT QUẢ IMPORT LẦN TRƯỚC */}
            {lastResult && (
              <View style={[styles.resultCard, { backgroundColor: isDark ? "#052E16" : "#F0FDF4", borderColor: isDark ? "#166534" : "#86EFAC" }]}>
                <Text style={[styles.resultTitle, { color: isDark ? "#86EFAC" : "#15803D" }]}>
                  📊 Kết quả import vừa xong
                </Text>
                <View style={styles.resultRow}>
                  <ResultStat icon="add-circle" label="Thêm mới" value={lastResult.added} color="#10B981" isDark={isDark} />
                  <ResultStat icon="update" label="Cập nhật" value={lastResult.updated} color="#3B82F6" isDark={isDark} />
                  <ResultStat icon="error" label="Lỗi" value={lastResult.errors.length} color="#EF4444" isDark={isDark} />
                </View>
              </View>
            )}

            {/* NÚT IMPORT */}
            <TouchableOpacity
              style={[styles.submitBtn, { opacity: loading || previewCount === 0 ? 0.5 : 1 }]}
              onPress={handleSubmitBulk}
              disabled={loading || previewCount === 0}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.submitGradient,
                  { backgroundColor: previewCount > 0 ? "#10B981" : colors.border },
                ]}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <MaterialIcons name="cloud-upload" size={20} color="#FFF" />
                    <Text style={styles.submitBtnText}>
                      {previewCount > 0 ? `Import ${previewCount} Kanji` : "Import hàng loạt"}
                    </Text>
                  </>
                )}
              </View>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ============================================================
// HELPER COMPONENT: Result Stat
// ============================================================
function ResultStat({
  icon,
  label,
  value,
  color,
  isDark,
}: {
  icon: any;
  label: string;
  value: number;
  color: string;
  isDark: boolean;
}) {
  return (
    <View style={resultStatStyles.item}>
      <MaterialIcons name={icon} size={22} color={color} />
      <Text style={[resultStatStyles.value, { color }]}>{value}</Text>
      <Text style={[resultStatStyles.label, { color: isDark ? "#86EFAC80" : "#15803D80" }]}>{label}</Text>
    </View>
  );
}

const resultStatStyles = StyleSheet.create({
  item: { flex: 1, alignItems: "center", gap: 4 },
  value: { fontSize: 22, fontWeight: "900" },
  label: { fontSize: 11, fontWeight: "600" },
});

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 60 },

  // TAB SWITCHER
  tabWrapper: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  tabPill: {
    flexDirection: "row",
    borderRadius: 14,
    padding: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10,
  },
  tabBtnText: { fontSize: 13, fontWeight: "700" },

  // CARD
  card: {
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
  },

  // SECTION HEADER
  sectionHeader: { flexDirection: "row", alignItems: "center", marginBottom: 18, gap: 10 },
  sectionIconBox: { width: 34, height: 34, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  sectionTitle: { fontSize: 15, fontWeight: "800", letterSpacing: -0.3 },

  // FIELD
  fieldLabel: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 14,
  },
  fieldSubtitle: { fontSize: 12, lineHeight: 17, marginBottom: 4, marginTop: -10 },
  fieldInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },

  // KANJI BIG INPUT
  kanjiInputWrapper: {
    borderWidth: 2,
    borderRadius: 16,
    height: 80,
    justifyContent: "center",
    alignItems: "center",
  },
  kanjiInput: {
    fontSize: 38,
    fontWeight: "700",
    height: 80,
    width: "100%",
    textAlign: "center",
  },

  // TWO COLUMN
  twoCol: { flexDirection: "row", marginTop: 0, gap: 8, marginBottom: 0 },

  // ICON INPUT
  iconInput: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 12, height: 48 },
  iconInputText: { flex: 1, paddingHorizontal: 10, fontSize: 14, height: 48 },

  // LEVEL CHIPS
  levelRow: { flexDirection: "row", gap: 8, marginBottom: 4, flexWrap: "wrap" },
  levelChip: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 24, borderWidth: 1.5 },
  levelChipText: { fontSize: 13 },

  // COMPONENT ROW
  componentRow: { flexDirection: "row", alignItems: "center" },
  addBtn: { width: 48, height: 48, borderRadius: 13, justifyContent: "center", alignItems: "center" },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10, marginBottom: 4 },
  chip: { flexDirection: "row", alignItems: "center", paddingHorizontal: 11, paddingVertical: 6, borderRadius: 14, borderWidth: 1 },
  chipText: { fontSize: 14, fontWeight: "700" },

  // TEXT AREA
  textArea: { borderWidth: 1, borderRadius: 14, padding: 14, fontSize: 14, minHeight: 100, marginTop: 2 },
  jsonArea: {
    minHeight: 200,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 12,
    lineHeight: 20,
  },

  // INFO BOX
  infoBox: { flexDirection: "row", alignItems: "flex-start", padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 4 },
  infoText: { fontSize: 12, lineHeight: 18 },

  // CODE BOX
  codeBox: { borderRadius: 12, borderWidth: 1, marginBottom: 4, overflow: "hidden" },
  codeBoxHeader: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 0 },
  codeBoxLabel: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  codeText: { fontFamily: Platform.OS === "ios" ? "Courier" : "monospace", fontSize: 11.5, lineHeight: 18, paddingHorizontal: 12, paddingBottom: 12 },

  // STATUS
  statusRow: { marginTop: 10 },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  statusText: { fontSize: 12, fontWeight: "600", flex: 1 },

  // PREVIEW
  previewSection: { marginTop: 12 },
  previewLabel: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  previewCharRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  previewChar: { width: 38, height: 38, borderRadius: 10, borderWidth: 1, justifyContent: "center", alignItems: "center" },
  previewCharText: { fontSize: 18, fontWeight: "700" },

  // RESULT CARD
  resultCard: { borderRadius: 16, padding: 16, borderWidth: 1, marginBottom: 16 },
  resultTitle: { fontSize: 13, fontWeight: "800", marginBottom: 14, textAlign: "center" },
  resultRow: { flexDirection: "row" },

  // SUBMIT BUTTON
  submitBtn: { borderRadius: 16, overflow: "hidden", marginBottom: 8 },
  submitGradient: { flexDirection: "row", justifyContent: "center", alignItems: "center", paddingVertical: 16, gap: 10 },
  submitBtnText: { color: "#FFF", fontSize: 16, fontWeight: "800", letterSpacing: 0.3 },
});
