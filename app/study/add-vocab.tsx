import React, { useState, useEffect, useRef } from "react";
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
  KeyboardAvoidingView,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import api from "../../services/api";
import { parseWord } from "../../src/utils/wordParser";

// IMPORT CÁC COMPONENT UI DÙNG CHUNG CỦA SẾP
import Button from "../../components/ui/Button";
import InputField from "../../components/ui/InputField";
import Toast from "../../components/ui/Toast";
import Header from "../../components/ui/Header";
import { useTheme } from "@/src/context/ThemeContext";

interface WordItem {
  term: string;
  def: string;
  reading?: string;
  type?: string;
  jlpt?: string;
  examples?: any[];
  audio?: string;
  tags?: string[];
  notes?: string;
  te?: string;
  ta?: string;
  nai?: string;
  ru?: string;
  masu?: string;
}

export default function AddVocabScreen() {
  const { colors, isDark } = useTheme();
  const { editId } = useLocalSearchParams<{ editId: string }>();
  const router = useRouter();

  const [currentEditId, setCurrentEditId] = useState<string | null>(null);
  const [title, setTitle] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"manual" | "bulk" | "json">("manual");
  const [words, setWords] = useState<WordItem[]>([{ term: "", def: "" }]);
  const [bulkText, setBulkText] = useState<string>("");
  const [jsonText, setJsonText] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [fetchingOldData, setFetchingOldData] = useState<boolean>(false);

  // 🚀 State lưu trữ danh sách các chủ đề từ vựng cũ từ DB về máy
  const [existingTopics, setExistingTopics] = useState<string[]>([]);

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
    }, 3000);
  };

  // Fetch toàn bộ chủ đề cũ để chuẩn bị dữ liệu cho bộ lọc gợi ý
  useEffect(() => {
    if (!editId) {
      const fetchExistingTopics = async () => {
        try {
          const res = await api.get("/api/vocab/lists");
          if (res.data.success && res.data.data) {
            const titles = res.data.data.map((item: any) => item.title);
            const uniqueTitles = Array.from(new Set(titles)).filter(
              (t) => t,
            ) as string[];
            setExistingTopics(uniqueTitles);
          }
        } catch (error) {
          console.log("Lỗi tải danh sách chủ đề gợi ý:", error);
        }
      };
      fetchExistingTopics();
    }
  }, [editId]);

  useEffect(() => {
    if (editId) {
      setCurrentEditId(editId);
      setFetchingOldData(true);
      api
        .get(`/api/vocab/list/${editId}`)
        .then((res) => {
          if (res.data.success) {
            const { title, words: oldWords } = res.data.data;
            setTitle(title);

            // Sử dụng parseWord để hiển thị nghĩa tiếng Việt sạch sẽ lên UI
            const parsedWords = (oldWords || []).map((w: any) => {
              const parsed = parseWord(w.term, w.def);
              return {
                term: w.term,
                def: parsed.meaning, // Chỉ lấy phần nghĩa
                reading: parsed.reading,
                type: parsed.type,
                jlpt: parsed.jlpt,
                examples: parsed.examples,
                audio: parsed.audio,
                tags: parsed.tags,
                notes: parsed.notes,
              };
            });
            setWords(parsedWords.length > 0 ? parsedWords : [{ term: "", def: "" }]);

            if (parsedWords && parsedWords.length > 0) {
              const formattedText = parsedWords
                .map((w: WordItem) => `${w.term} : ${w.def}`)
                .join("\n");
              setBulkText(formattedText);
            }
          }
          setFetchingOldData(false);
        })
        .catch(() => {
          triggerToast("error", "Lỗi tải dữ liệu cũ.");
          setFetchingOldData(false);
        });
    }
  }, [editId]);

  const handleWordChange = (
    index: number,
    field: keyof WordItem,
    value: string,
  ) => {
    const updatedWords = [...words];
    updatedWords[index][field] = value as any;
    setWords(updatedWords);
  };
  const addWordRow = () => setWords([...words, { term: "", def: "" }]);
  const removeWordRow = (index: number) => {
    if (words.length > 1) setWords(words.filter((_, i) => i !== index));
  };

  const parseJsonText = (text: string): WordItem[] => {
    const trimmed = text.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      const list = Array.isArray(parsed) ? parsed : [parsed];
      return list.map((item: any) => {
        if (item.word !== undefined) {
          return {
            term: String(item.word),
            def: typeof item.meaning === "string" ? item.meaning : String(item.meaning || ""),
            reading: item.reading || item.word || "",
            type: item.type || "noun",
            jlpt: item.jlpt || "N5",
            examples: item.examples || [],
            audio: item.audio || "",
            tags: item.tags || [],
            notes: item.notes || "",
            te: item.te || item.conjugations?.te || "",
            ta: item.ta || item.conjugations?.ta || "",
            nai: item.nai || item.conjugations?.nai || "",
            ru: item.ru || item.conjugations?.ru || "",
            masu: item.masu || item.conjugations?.masu || "",
          };
        }
        if (item.term !== undefined && item.def !== undefined) {
          return {
            term: String(item.term),
            def: typeof item.def === "object" ? JSON.stringify(item.def) : String(item.def),
            reading: item.reading,
            type: item.type,
            jlpt: item.jlpt,
            examples: item.examples,
            audio: item.audio,
            tags: item.tags,
            notes: item.notes,
            te: item.te || item.conjugations?.te || "",
            ta: item.ta || item.conjugations?.ta || "",
            nai: item.nai || item.conjugations?.nai || "",
            ru: item.ru || item.conjugations?.ru || "",
            masu: item.masu || item.conjugations?.masu || "",
          };
        }
        return null;
      }).filter((w: any) => w !== null && w.term) as WordItem[];
    } catch (e) {
      return [];
    }
  };

  const parseBulkText = (text: string): WordItem[] => {
    const lines = text.split("\n");
    const parsedList: WordItem[] = [];
    lines.forEach((line) => {
      if (!line.trim()) return;
      let separator = ":";
      if (!line.includes(":") && line.includes("-")) separator = "-";
      const parts = line.split(separator);
      if (parts.length >= 2) {
        const term = parts[0].trim();
        const def = parts.slice(1).join(separator).trim();
        if (term && def) parsedList.push({ term, def });
      }
    });
    return parsedList;
  };

  const previewCount = activeTab === "manual"
    ? words.length
    : activeTab === "bulk"
      ? parseBulkText(bulkText).length
      : parseJsonText(jsonText).length;

  const handleSubmit = async () => {
    if (!title.trim()) {
      triggerToast("error", "Vui lòng nhập tên bài học sếp ơi!");
      return;
    }

    let finalWordsList: WordItem[] = [];
    if (activeTab === "bulk") {
      finalWordsList = parseBulkText(bulkText);
      if (finalWordsList.length === 0) {
        triggerToast("error", "Cấu trúc nhập chưa đúng hoặc trống!");
        return;
      }
    } else if (activeTab === "json") {
      finalWordsList = parseJsonText(jsonText);
      if (finalWordsList.length === 0) {
        triggerToast("error", "Dữ liệu JSON trống hoặc không hợp lệ!");
        return;
      }
    } else {
      const hasEmptyField = words.some((w) => !w.term.trim() || !w.def.trim());
      if (hasEmptyField) {
        triggerToast("error", "Sếp đang bỏ trống từ vựng hoặc ý nghĩa!");
        return;
      }
      finalWordsList = words;
    }

    // Chuẩn hóa và đóng gói JSON def trước khi gửi lên API
    const serializedList = finalWordsList.map((w: any) => ({
      term: w.term.trim(),
      def: JSON.stringify({
        reading: w.reading || w.term || "",
        meaning: w.def.trim(),
        type: w.type || "noun",
        jlpt: w.jlpt || "N5",
        examples: w.examples || [],
        audio: w.audio || "",
        tags: w.tags || [],
        notes: w.notes || "",
        te: w.te || "",
        ta: w.ta || "",
        nai: w.nai || "",
        ru: w.ru || "",
        masu: w.masu || "",
      }),
    }));

    setLoading(true);
    try {
      let response;
      if (currentEditId) {
        response = await api.put(`/api/vocab/update/${currentEditId}`, {
          title,
          list: serializedList,
        });
      } else {
        response = await api.post("/api/vocab/save", {
          title,
          list: serializedList,
        });
      }

      if (response.data.success) {
        triggerToast(
          "success",
          currentEditId
            ? "🎉 Đã cập nhật bài học thành công!"
            : `🎉 Đã lưu bài học thành công!`,
        );
        if (currentEditId) {
          setTimeout(() => router.back(), 1500);
        } else {
          setTitle("");
          setWords([{ term: "", def: "" }]);
          setBulkText("");
          setJsonText("");
        }
      } else {
        triggerToast("error", response.data.error || "Gặp lỗi khi lưu.");
      }
    } catch (error) {
      triggerToast("error", "Lỗi kết nối mạng tới Backend.");
    } finally {
      setLoading(false);
    }
  };

  const handleChangeTab = (nextTab: "manual" | "bulk" | "json") => {
    if (nextTab === "bulk") {
      const formattedText = words
        .map((w: WordItem) => `${w.term} : ${w.def}`)
        .join("\n");
      setBulkText(formattedText);
    } else if (nextTab === "json") {
      const jsonList = words.map(w => ({
        word: w.term,
        reading: w.reading || w.term,
        meaning: w.def,
        type: w.type || "noun",
        jlpt: w.jlpt || "N5",
        examples: w.examples || [],
        tags: w.tags || [],
        notes: w.notes || "",
        te: w.te || "",
        ta: w.ta || "",
        nai: w.nai || "",
        ru: w.ru || "",
        masu: w.masu || ""
      }));
      setJsonText(JSON.stringify(jsonList, null, 2));
    } else if (nextTab === "manual") {
      if (activeTab === "bulk") {
        const parsed = parseBulkText(bulkText);
        if (parsed.length > 0) setWords(parsed);
      } else if (activeTab === "json") {
        const parsed = parseJsonText(jsonText);
        if (parsed.length > 0) setWords(parsed);
      }
    }
    setActiveTab(nextTab);
  };

  if (fetchingOldData) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator size="large" color={colors.amber} />
      </View>
    );
  }

  // 🚀 VỊ TRÍ 3 ĐÃ THÊM: Logic Fuzzy Search lọc cụm từ tương ứng
  const currentQuery = title.trim().toLowerCase();
  const filteredTopics = existingTopics.filter((topic) =>
    topic.toLowerCase().includes(currentQuery),
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ headerShown: false }} />
      <Toast toast={toast} slideAnim={slideAnim} />
      <Header
        title={currentEditId ? "✍️ Chỉnh Sửa Bài Học" : "📚 Tạo Bài Học Mới"}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={styles.container}
          contentContainerStyle={{ paddingBottom: 50 }}
          showsVerticalScrollIndicator={false}
        >
        {/* THẺ TÊN CHỦ ĐỀ */}
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          {/* 🚀 VỊ TRÍ 4 ĐÃ THÊM: Hiển thị giao diện các Chip chủ đề gợi ý lướt ngang */}
          {!currentEditId && filteredTopics.length > 0 && (
            <View style={{ marginBottom: 12 }}>
              <Text
                style={[
                  styles.label,
                  { color: colors.textMuted, marginTop: 0 },
                ]}
              >
                Chủ đề gợi ý gần giống:
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.suggestionContainer}
              >
                {filteredTopics.map((topic, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[
                      styles.suggestionChip,
                      {
                        backgroundColor: isDark ? "#2C1A10" : "#FFEDD5",
                        borderColor: isDark ? "#45230F" : "#FDBA74",
                      },
                    ]}
                    onPress={() => setTitle(topic)}
                  >
                    <Text
                      style={[
                        styles.suggestionText,
                        { color: isDark ? "#FDBA74" : "#C2410C" },
                      ]}
                    >
                      {topic}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          <InputField
            label="Tên bài học / Chủ đề"
            iconName="subtitles"
            value={title}
            onChangeText={setTitle}
            placeholder="Ví dụ: Bài 6. Trong nhà"
          />
        </View>

        <View
          style={[
            styles.tabContainer,
            { backgroundColor: isDark ? "#1E293B" : "#E2E8F0" },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === "manual" && { backgroundColor: colors.surface },
            ]}
            onPress={() => handleChangeTab("manual")}
          >
            <Text
              style={[
                styles.tabText,
                { color: activeTab === "manual" ? colors.text : colors.textMuted },
              ]}
            >
              ✍️ Nhập
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === "bulk" && { backgroundColor: colors.surface },
            ]}
            onPress={() => handleChangeTab("bulk")}
          >
            <Text
              style={[
                styles.tabText,
                { color: activeTab === "bulk" ? colors.text : colors.textMuted },
              ]}
            >
              📋 Hàng loạt
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === "json" && { backgroundColor: colors.surface },
            ]}
            onPress={() => handleChangeTab("json")}
          >
            <Text
              style={[
                styles.tabText,
                { color: activeTab === "json" ? colors.text : colors.textMuted },
              ]}
            >
              📄 JSON
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.badgeRow}>
          <View
            style={[
              styles.countBadge,
              { backgroundColor: isDark ? "#2E2A47" : "#E0E7FF" },
            ]}
          >
            <Text
              style={[
                styles.countBadgeText,
                { color: isDark ? "#A5B4FC" : "#4F46E5" },
              ]}
            >
              📊 Ghi nhận: {previewCount} từ
            </Text>
          </View>
        </View>

        {activeTab === "manual" && (
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            {words.map((word, index) => (
              <View key={index} style={styles.wordRow}>
                <View
                  style={[
                    styles.rowIndexCircle,
                    { backgroundColor: isDark ? "#334155" : "#F1F5F9" },
                  ]}
                >
                  <Text style={[styles.rowNumber, { color: colors.textMuted }]}>
                    {index + 1}
                  </Text>
                </View>
                <TextInput
                  style={[
                    styles.rowInput,
                    {
                      marginRight: 4,
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                  value={word.term}
                  onChangeText={(text) => handleWordChange(index, "term", text)}
                  placeholder="Từ vựng"
                  placeholderTextColor={colors.textMuted}
                />
                <TextInput
                  style={[
                    styles.rowInput,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                  value={word.def}
                  onChangeText={(text) => handleWordChange(index, "def", text)}
                  placeholder="Ý nghĩa"
                  placeholderTextColor={colors.textMuted}
                />
                <TouchableOpacity
                  onPress={() => removeWordRow(index)}
                  disabled={words.length === 1}
                  style={[
                    styles.btnMiniDelete,
                    { backgroundColor: isDark ? "#451A1A" : "#FEF2F2" },
                    words.length === 1 && { opacity: 0.3 },
                  ]}
                >
                  <MaterialIcons
                    name="delete-outline"
                    size={20}
                    color={isDark ? "#F87171" : "#EF4444"}
                  />
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity
              style={[
                styles.btnDashed,
                {
                  backgroundColor: colors.amberLight,
                  borderColor: colors.amber,
                },
              ]}
              onPress={addWordRow}
            >
              <MaterialIcons name="add" size={18} color={colors.amber} />
              <Text style={[styles.btnDashedText, { color: colors.amber }]}>
                Thêm từ mới
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {activeTab === "bulk" && (
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <View
              style={[
                styles.hintBox,
                {
                  backgroundColor: isDark ? "#281E45" : "#F5F3FF",
                  borderColor: isDark ? "#4338CA" : "#DDD6FE",
                },
              ]}
            >
              <Text
                style={[
                  styles.hintText,
                  { color: isDark ? "#C7D2FE" : "#5B21B6" },
                ]}
              >
                Phân tách bằng dấu hai chấm (:). Ví dụ: たべる : Ăn
              </Text>
            </View>
            <TextInput
              style={[
                styles.textArea,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              value={bulkText}
              onChangeText={setBulkText}
              placeholder="Dán danh sách từ vựng vào đây..."
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={8}
              textAlignVertical="top"
            />
          </View>
        )}

        {activeTab === "json" && (
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <View
              style={[
                styles.hintBox,
                {
                  backgroundColor: isDark ? "#281E45" : "#F5F3FF",
                  borderColor: isDark ? "#4338CA" : "#DDD6FE",
                },
              ]}
            >
              <Text
                style={[
                  styles.hintText,
                  { color: isDark ? "#C7D2FE" : "#5B21B6" },
                ]}
              >
                Dán chuỗi mảng JSON từ vựng đúng định dạng chứa word, reading, meaning.
              </Text>
            </View>
            <TextInput
              style={[
                styles.textArea,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              value={jsonText}
              onChangeText={setJsonText}
              placeholder='[\n  {\n    "word": "食べる",\n    "reading": "たべる",\n    "meaning": "ăn",\n    "type": "verb",\n    "te": "食べて",\n    "ta": "食べた",\n    "nai": "食べない",\n    "ru": "食べる",\n    "masu": "食べます",\n    "examples": [\n      {\n        "jp": "りんごを食べる。",\n        "vn": "Ăn quả táo."\n      }\n    ]\n  }\n]'
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={10}
              textAlignVertical="top"
            />
          </View>
        )}

        <Button
          title={currentEditId ? "Cập nhật bài học" : "Lưu danh sách"}
          loading={loading}
          type="amber"
          size="small"
          onPress={handleSubmit}
        />
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  wordRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  rowIndexCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  rowNumber: { fontSize: 11, fontWeight: "700" },
  rowInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  btnMiniDelete: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 4,
  },
  btnDashed: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderStyle: "dashed",
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 6,
  },
  btnDashedText: { fontWeight: "700", fontSize: 14, marginLeft: 4 },
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
  tabText: { fontSize: 14, fontWeight: "600" },
  badgeRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 10,
  },
  countBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  countBadgeText: { fontSize: 12, fontWeight: "700" },
  hintBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
    borderWidth: 1,
  },
  hintText: { flex: 1, fontSize: 13, lineHeight: 18 },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    minHeight: 180,
  },

  // 🚀 VỊ TRÍ 5 ĐÃ THÊM: Các dòng Style mới phục vụ hiển thị Chip gợi ý
  label: { fontSize: 13, fontWeight: "700", marginBottom: 6, marginTop: 12 },
  suggestionContainer: { flexDirection: "row", marginBottom: 4, marginTop: 2 },
  suggestionChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
  },
  suggestionText: { fontSize: 13, fontWeight: "600" },
});
