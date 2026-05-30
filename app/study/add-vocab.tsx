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
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import api from "../../services/api";

// IMPORT CÁC COMPONENT UI DÙNG CHUNG CỦA SẾP
import Button from "../../components/ui/Button";
import InputField from "../../components/ui/InputField";
import Toast from "../../components/ui/Toast";
import Header from "../../components/ui/Header";
import { useTheme } from "@/src/context/ThemeContext";

interface WordItem {
  term: string;
  def: string;
}

export default function AddVocabScreen() {
  const { colors, isDark } = useTheme();
  const { editId } = useLocalSearchParams<{ editId: string }>();
  const router = useRouter();

  const [currentEditId, setCurrentEditId] = useState<string | null>(null);
  const [title, setTitle] = useState<string>("");
  const [isBulkMode, setIsBulkMode] = useState<boolean>(false);
  const [words, setWords] = useState<WordItem[]>([{ term: "", def: "" }]);
  const [bulkText, setBulkText] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [fetchingOldData, setFetchingOldData] = useState<boolean>(false);

  // 🚀 VỊ TRÍ 1 ĐÃ THÊM: State lưu trữ danh sách các chủ đề từ vựng cũ từ DB về máy
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

  // 🚀 VỊ TRÍ 2 ĐÃ THÊM: Fetch toàn bộ chủ đề cũ để chuẩn bị dữ liệu cho bộ lọc gợi ý
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
            setWords(oldWords || [{ term: "", def: "" }]);

            if (oldWords && oldWords.length > 0) {
              const formattedText = oldWords
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
    updatedWords[index][field] = value;
    setWords(updatedWords);
  };
  const addWordRow = () => setWords([...words, { term: "", def: "" }]);
  const removeWordRow = (index: number) => {
    if (words.length > 1) setWords(words.filter((_, i) => i !== index));
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

  const previewCount = isBulkMode
    ? parseBulkText(bulkText).length
    : words.length;

  const handleSubmit = async () => {
    if (!title.trim()) {
      triggerToast("error", "Vui lòng nhập tên bài học sếp ơi!");
      return;
    }

    let finalWordsList: WordItem[] = [];
    if (isBulkMode) {
      finalWordsList = parseBulkText(bulkText);
      if (finalWordsList.length === 0) {
        triggerToast("error", "Cấu trúc nhập chưa đúng hoặc trống!");
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

    setLoading(true);
    try {
      let response;
      if (currentEditId) {
        response = await api.put(`/api/vocab/update/${currentEditId}`, {
          title,
          list: finalWordsList,
        });
      } else {
        response = await api.post("/api/vocab/save", {
          title,
          list: finalWordsList,
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

  const handleToggleTab = (toBulk: boolean) => {
    if (toBulk) {
      const formattedText = words
        .map((w: WordItem) => `${w.term} : ${w.def}`)
        .join("\n");
      setBulkText(formattedText);
    } else {
      const parsed = parseBulkText(bulkText);
      if (parsed.length > 0) setWords(parsed);
    }
    setIsBulkMode(toBulk);
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
              !isBulkMode && { backgroundColor: colors.surface },
            ]}
            onPress={() => handleToggleTab(false)}
          >
            <Text
              style={[
                styles.tabText,
                { color: !isBulkMode ? colors.text : colors.textMuted },
              ]}
            >
              ✍️ Nhập thủ công
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tabButton,
              isBulkMode && { backgroundColor: colors.surface },
            ]}
            onPress={() => handleToggleTab(true)}
          >
            <Text
              style={[
                styles.tabText,
                { color: isBulkMode ? colors.text : colors.textMuted },
              ]}
            >
              📋 Dán hàng loạt
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

        {!isBulkMode ? (
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
        ) : (
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

        <Button
          title={currentEditId ? "Cập nhật bài học" : "Lưu danh sách"}
          loading={loading}
          type="amber"
          size="small"
          onPress={handleSubmit}
        />
      </ScrollView>
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
  btnMiniDelete: { padding: 8, marginLeft: 4, borderRadius: 8 },
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
