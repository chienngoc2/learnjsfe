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
  Alert,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import api from "../../services/api";
import Button from "../../components/ui/Button";
import Toast from "../../components/ui/Toast";
import Header from "../../components/ui/Header";
import { useTheme } from "@/src/context/ThemeContext";

// ============================================================
// INTERFACE KHỚP CHUẨN VỚI BACKEND
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
  lessonGroup?: string; // Tên bài học
}

const LEVEL_OPTIONS = ["N5", "N4", "N3", "N2", "N1"];

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

  // STATE CHẾ ĐỘ: Nhập thủ công | Dán JSON hàng loạt
  const [isBulkMode, setIsBulkMode] = useState(false);

  // STATE FORM THỦ CÔNG
  const [form, setForm] = useState<KanjiItem>({ ...EMPTY_FORM });
  const [componentInput, setComponentInput] = useState(""); // Nhập từng component

  // STATE BULK JSON
  const [bulkText, setBulkText] = useState("");
  const [previewCount, setPreviewCount] = useState(0);
  const [parseError, setParseError] = useState("");

  // LOADING
  const [loading, setLoading] = useState(false);

  // TOAST
  const [toast, setToast] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const slideAnim = useRef(new Animated.Value(-100)).current;

  const triggerToast = (type: "success" | "error", text: string) => {
    setToast({ type, text });
    Animated.timing(slideAnim, {
      toValue: 40,
      duration: 400,
      useNativeDriver: true,
    }).start();
    setTimeout(() => {
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 400,
        useNativeDriver: true,
      }).start(() => setToast(null));
    }, 3500);
  };

  // ============================================================
  // PARSE JSON BULK
  // ============================================================
  const parseBulkJson = (text: string): KanjiItem[] | null => {
    try {
      setParseError("");
      const trimmed = text.trim();
      if (!trimmed) return null;

      let parsed: any;
      // Thử parse trực tiếp (mảng) hoặc object đơn
      if (trimmed.startsWith("[")) {
        parsed = JSON.parse(trimmed);
      } else if (trimmed.startsWith("{")) {
        parsed = [JSON.parse(trimmed)];
      } else {
        throw new Error("Định dạng không hợp lệ, cần là JSON Array [] hoặc Object {}");
      }

      if (!Array.isArray(parsed)) throw new Error("JSON phải là mảng []");
      setPreviewCount(parsed.length);
      return parsed;
    } catch (e: any) {
      setParseError(e.message || "JSON không hợp lệ");
      setPreviewCount(0);
      return null;
    }
  };

  const handleBulkTextChange = (text: string) => {
    setBulkText(text);
    parseBulkJson(text);
  };

  // ============================================================
  // FORM HANDLERS
  // ============================================================
  const setField = (key: keyof KanjiItem, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const addComponent = () => {
    const c = componentInput.trim();
    if (!c) return;
    setForm((prev) => ({
      ...prev,
      components: [...(prev.components || []), c],
    }));
    setComponentInput("");
  };

  const removeComponent = (index: number) => {
    setForm((prev) => ({
      ...prev,
      components: (prev.components || []).filter((_, i) => i !== index),
    }));
  };

  // ============================================================
  // SUBMIT THỦ CÔNG
  // ============================================================
  const handleSubmitManual = async () => {
    if (!form.character.trim()) {
      triggerToast("error", "Vui lòng nhập chữ Kanji!");
      return;
    }
    if (!form.meaning.trim()) {
      triggerToast("error", "Vui lòng nhập ý nghĩa!");
      return;
    }
    if (!form.vietnamese_reading.trim()) {
      triggerToast("error", "Vui lòng nhập âm Hán Việt!");
      return;
    }

    setLoading(true);
    try {
      const response = await api.post("/api/kanji/add", {
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

      if (response.data.success) {
        triggerToast("success", `🎉 Đã thêm Kanji "${form.character}" thành công!`);
        setForm({ ...EMPTY_FORM });
        setComponentInput("");
      } else {
        triggerToast("error", response.data.message || "Lỗi khi lưu Kanji.");
      }
    } catch (error: any) {
      const msg = error?.response?.data?.message || "Lỗi kết nối Backend!";
      triggerToast("error", msg);
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // SUBMIT BULK JSON
  // ============================================================
  const handleSubmitBulk = async () => {
    const items = parseBulkJson(bulkText);
    if (!items || items.length === 0) {
      triggerToast("error", "JSON trống hoặc không hợp lệ sếp ơi!");
      return;
    }

    setLoading(true);
    try {
      const response = await api.post("/api/kanji/bulk-add", { items });
      if (response.data.success) {
        const d = response.data.data;
        triggerToast(
          "success",
          `✅ Thêm mới: ${d.success} | Bỏ qua: ${d.skipped} | Lỗi: ${d.errors.length}`,
        );
        if (d.errors.length > 0) {
          console.warn("Bulk errors:", d.errors);
        }
        setBulkText("");
        setPreviewCount(0);
      } else {
        triggerToast("error", response.data.message || "Bulk insert thất bại.");
      }
    } catch (error: any) {
      triggerToast("error", "Lỗi kết nối Backend!");
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ headerShown: false }} />
      <Toast toast={toast} slideAnim={slideAnim} />
      <Header title="✍️ Thêm Kanji Mới" />

      {/* TAB SWITCH */}
      <View
        style={[
          styles.tabContainer,
          { backgroundColor: isDark ? "#1E293B" : "#E2E8F0", margin: 16, marginBottom: 0 },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.tabButton,
            !isBulkMode && { backgroundColor: colors.surface },
          ]}
          onPress={() => setIsBulkMode(false)}
        >
          <Text style={[styles.tabText, { color: !isBulkMode ? colors.text : colors.textMuted }]}>
            ✍️ Nhập thủ công
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tabButton,
            isBulkMode && { backgroundColor: colors.surface },
          ]}
          onPress={() => setIsBulkMode(true)}
        >
          <Text style={[styles.tabText, { color: isBulkMode ? colors.text : colors.textMuted }]}>
            📋 Dán JSON hàng loạt
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >
        {!isBulkMode ? (
          /* ============================
             CHẾ ĐỘ NHẬP THỦ CÔNG
             ============================ */
          <>
            {/* THẺ THÔNG TIN CƠ BẢN */}
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <Text style={[styles.sectionTitle, { color: colors.amber }]}>
                📝 Thông tin cơ bản
              </Text>

              {/* KANJI CHARACTER */}
              <Text style={[styles.label, { color: colors.textMuted }]}>
                Chữ Kanji *
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text, fontSize: 28, textAlign: "center", height: 70 }]}
                value={form.character}
                onChangeText={(t) => setField("character", t)}
                placeholder="一"
                placeholderTextColor={colors.textMuted}
                maxLength={3}
              />

              {/* MEANING */}
              <Text style={[styles.label, { color: colors.textMuted }]}>Ý nghĩa *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                value={form.meaning}
                onChangeText={(t) => setField("meaning", t)}
                placeholder="Một, Thứ nhất"
                placeholderTextColor={colors.textMuted}
              />

              {/* ÂM HÁN VIỆT */}
              <Text style={[styles.label, { color: colors.textMuted }]}>Âm Hán Việt *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                value={form.vietnamese_reading}
                onChangeText={(t) => setField("vietnamese_reading", t)}
                placeholder="NHẤT"
                placeholderTextColor={colors.textMuted}
              />

              {/* ÂM ON & KUN (2 cột) */}
              <View style={styles.rowTwo}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={[styles.label, { color: colors.textMuted }]}>Âm ON (音読み)</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                    value={form.onyomi}
                    onChangeText={(t) => setField("onyomi", t)}
                    placeholder="いち、いつ"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { color: colors.textMuted }]}>Âm KUN (訓読み)</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                    value={form.kunyomi}
                    onChangeText={(t) => setField("kunyomi", t)}
                    placeholder="ひと、ひと-つ"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              </View>

              {/* CẤP ĐỘ */}
              <Text style={[styles.label, { color: colors.textMuted }]}>Cấp độ JLPT *</Text>
              <View style={styles.levelRow}>
                {LEVEL_OPTIONS.map((lv) => (
                  <TouchableOpacity
                    key={lv}
                    style={[
                      styles.levelChip,
                      {
                        backgroundColor:
                          form.level === lv
                            ? colors.amber
                            : isDark
                            ? "#334155"
                            : "#F1F5F9",
                        borderColor:
                          form.level === lv ? colors.amber : colors.border,
                      },
                    ]}
                    onPress={() => setField("level", lv)}
                  >
                    <Text
                      style={[
                        styles.levelChipText,
                        {
                          color:
                            form.level === lv ? "#FFF" : colors.textMuted,
                          fontWeight: form.level === lv ? "800" : "600",
                        },
                      ]}
                    >
                      {lv}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* TÊN BÀI HỌC / NHÓM */}
              <Text style={[styles.label, { color: colors.textMuted }]}>Bài học / Nhóm</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                value={form.lessonGroup}
                onChangeText={(t) => setField("lessonGroup", t)}
                placeholder="VD: Bài 1 - Số đếm, N5 Cơ bản"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            {/* THẺ THÀNH PHẦN & CÂU CHUYỆN */}
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <Text style={[styles.sectionTitle, { color: colors.amber }]}>
                🧩 Bộ thủ & Câu chuyện ghi nhớ
              </Text>

              {/* COMPONENTS */}
              <Text style={[styles.label, { color: colors.textMuted }]}>
                Bộ thủ / Thành phần
              </Text>
              <View style={styles.componentInputRow}>
                <TextInput
                  style={[
                    styles.input,
                    { flex: 1, marginRight: 8, backgroundColor: colors.background, borderColor: colors.border, color: colors.text },
                  ]}
                  value={componentInput}
                  onChangeText={setComponentInput}
                  placeholder="Nhập bộ thủ rồi bấm +"
                  placeholderTextColor={colors.textMuted}
                  onSubmitEditing={addComponent}
                />
                <TouchableOpacity
                  style={[styles.btnAddComp, { backgroundColor: colors.amber }]}
                  onPress={addComponent}
                >
                  <MaterialIcons name="add" size={22} color="#FFF" />
                </TouchableOpacity>
              </View>

              {/* CHIPS BỘ THỦ */}
              {(form.components || []).length > 0 && (
                <View style={styles.chipRow}>
                  {(form.components || []).map((comp, i) => (
                    <TouchableOpacity
                      key={i}
                      style={[
                        styles.compChip,
                        { backgroundColor: isDark ? "#2C1A10" : "#FEF3C7", borderColor: colors.amber },
                      ]}
                      onPress={() => removeComponent(i)}
                    >
                      <Text style={[styles.compChipText, { color: colors.amber }]}>
                        {comp}
                      </Text>
                      <MaterialIcons name="close" size={14} color={colors.amber} style={{ marginLeft: 4 }} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* STORY */}
              <Text style={[styles.label, { color: colors.textMuted }]}>
                Câu chuyện / Mẹo nhớ
              </Text>
              <TextInput
                style={[
                  styles.textArea,
                  { backgroundColor: colors.background, borderColor: colors.border, color: colors.text },
                ]}
                value={form.story}
                onChangeText={(t) => setField("story", t)}
                placeholder="Ví dụ: Một nét ngang duy nhất giống số 1..."
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            <Button
              title="💾 Lưu Kanji"
              loading={loading}
              type="amber"
              size="small"
              onPress={handleSubmitManual}
            />
          </>
        ) : (
          /* ============================
             CHẾ ĐỘ DÁN JSON HÀNG LOẠT
             ============================ */
          <>
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <Text style={[styles.sectionTitle, { color: colors.amber }]}>
                📋 Dán JSON hàng loạt
              </Text>

              {/* HINT BOX */}
              <View
                style={[
                  styles.hintBox,
                  {
                    backgroundColor: isDark ? "#1E2A45" : "#EFF6FF",
                    borderColor: isDark ? "#3B5998" : "#BFDBFE",
                  },
                ]}
              >
                <MaterialIcons name="info-outline" size={16} color={isDark ? "#93C5FD" : "#3B82F6"} style={{ marginRight: 8, marginTop: 1 }} />
                <Text style={[styles.hintText, { color: isDark ? "#93C5FD" : "#1D4ED8", flex: 1 }]}>
                  Dán mảng JSON hoặc object đơn. Mỗi item cần có: {"\n"}
                  character, meaning, vietnamese_reading, level (N5–N1)
                </Text>
              </View>

              {/* EXAMPLE */}
              <View
                style={[
                  styles.exampleBox,
                  { backgroundColor: isDark ? "#0F1A14" : "#F0FDF4", borderColor: isDark ? "#1A4030" : "#BBF7D0" },
                ]}
              >
                <Text style={[styles.exampleCode, { color: isDark ? "#86EFAC" : "#166534" }]}>
                  {`[{\n  "character": "一",\n  "meaning": "Một",\n  "onyomi": "いち",\n  "kunyomi": "ひと",\n  "vietnamese_reading": "NHẤT",\n  "level": "N5",\n  "lessonGroup": "Bài 1 - Số đếm",\n  "components": ["一"],\n  "story": "Một nét ngang"\n}]`}
                </Text>
              </View>

              {/* TEXTAREA NHẬP JSON */}
              <TextInput
                style={[
                  styles.textArea,
                  styles.jsonTextArea,
                  { backgroundColor: colors.background, borderColor: parseError ? "#EF4444" : colors.border, color: colors.text },
                ]}
                value={bulkText}
                onChangeText={handleBulkTextChange}
                placeholder={`[\n  {\n    "character": "一",\n    ...\n  }\n]`}
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={12}
                textAlignVertical="top"
                autoCapitalize="none"
                autoCorrect={false}
              />

              {/* ERROR PARSE */}
              {parseError !== "" && (
                <View style={styles.errorRow}>
                  <MaterialIcons name="error-outline" size={16} color="#EF4444" />
                  <Text style={styles.errorText}>{parseError}</Text>
                </View>
              )}

              {/* BADGE ĐẾM */}
              {previewCount > 0 && (
                <View
                  style={[
                    styles.countBadge,
                    { backgroundColor: isDark ? "#2E2A47" : "#E0E7FF" },
                  ]}
                >
                  <MaterialIcons name="check-circle" size={16} color={isDark ? "#A5B4FC" : "#4F46E5"} />
                  <Text style={[styles.countBadgeText, { color: isDark ? "#A5B4FC" : "#4F46E5" }]}>
                    Phát hiện {previewCount} Kanji sẵn sàng import
                  </Text>
                </View>
              )}
            </View>

            <Button
              title={`📦 Import ${previewCount > 0 ? previewCount + " Kanji" : "hàng loạt"}`}
              loading={loading}
              type="amber"
              size="small"
              onPress={handleSubmitBulk}
            />
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 14,
    letterSpacing: -0.3,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
    marginTop: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 2,
  },
  rowTwo: {
    flexDirection: "row",
    marginTop: 4,
  },
  levelRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
    marginBottom: 4,
    flexWrap: "wrap",
  },
  levelChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  levelChipText: {
    fontSize: 13,
  },
  componentInputRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    marginTop: 2,
  },
  btnAddComp: {
    width: 46,
    height: 46,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  compChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  compChipText: {
    fontSize: 14,
    fontWeight: "700",
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    minHeight: 100,
    marginTop: 4,
  },
  jsonTextArea: {
    minHeight: 220,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 13,
  },
  tabContainer: {
    flexDirection: "row",
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10,
  },
  tabText: { fontSize: 13, fontWeight: "700" },
  hintBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  hintText: { fontSize: 12, lineHeight: 18 },
  exampleBox: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
  },
  exampleCode: { fontSize: 12, lineHeight: 18, fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    gap: 6,
  },
  errorText: { color: "#EF4444", fontSize: 12, fontWeight: "600", flex: 1 },
  countBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 12,
    alignSelf: "flex-start",
  },
  countBadgeText: { fontSize: 13, fontWeight: "700" },
});
