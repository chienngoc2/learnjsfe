import React, { useState, useRef, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Platform,
  Animated,
  KeyboardAvoidingView,
  TextInput,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import api from "../../services/api";
import { useTheme } from "@/src/context/ThemeContext";

// IMPORT ĐẦY ĐỦ CÁC COMPONENT UI DÙNG CHUNG Chuẩn TS
import Button from "../../components/ui/Button";
import InputField from "../../components/ui/InputField";
import Toast from "../../components/ui/Toast";
import Header from "../../components/ui/Header";

interface GrammarItem {
  topicName: string;
  title: string;
  formula: string;
  meaning: string;
  examples: string[];
}

export default function AddGrammarScreen() {
  const { colors, isDark } = useTheme();
  const params = useLocalSearchParams();
  const router = useRouter();

  const topicId = params.topicId as string;
  const currentTitle = params.currentTitle as string;
  const grammarId = params.grammarId as string;

  const isEditMode = !!grammarId;

  const [loading, setLoading] = useState(false);
  const [existingTopics, setExistingTopics] = useState<string[]>([]);

  // Khởi tạo state dạng mảng examples
  const getInitialExamples = (): string[] => {
    if (params.examples) {
      try {
        const parsed = JSON.parse(params.examples as string);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        // ignore
      }
    }
    if (params.example) return [params.example as string];
    return [""];
  };

  const [grammarList, setGrammarList] = useState<GrammarItem[]>([
    {
      topicName: (params.topicName as string) || currentTitle || "",
      title: (params.title as string) || "",
      formula: (params.formula as string) || "",
      meaning: (params.meaning as string) || "",
      examples: getInitialExamples(),
    },
  ]);
  const [activeTab, setActiveTab] = useState<"manual" | "json">("manual");
  const [jsonText, setJsonText] = useState<string>("");

  const [toast, setToast] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const slideAnim = useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    if (!isEditMode) {
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
          console.log("Lỗi gợi ý:", error);
        }
      };
      fetchExistingTopics();
    }
  }, [isEditMode]);

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

  const handleChange = (
    index: number,
    field: keyof Omit<GrammarItem, "examples">,
    value: string,
  ) => {
    const updated = [...grammarList];
    updated[index][field] = value;
    if (field === "topicName" && index === 0) {
      updated.forEach((item) => (item.topicName = value));
    }
    setGrammarList(updated);
  };

  const handleExampleChange = (
    blockIndex: number,
    exampleIndex: number,
    value: string,
  ) => {
    const updated = [...grammarList];
    updated[blockIndex].examples[exampleIndex] = value;
    setGrammarList(updated);
  };

  const addExampleRow = (blockIndex: number) => {
    const updated = [...grammarList];
    updated[blockIndex].examples.push("");
    setGrammarList(updated);
  };

  const removeExampleRow = (blockIndex: number, exampleIndex: number) => {
    const updated = [...grammarList];
    if (updated[blockIndex].examples.length > 1) {
      updated[blockIndex].examples = updated[blockIndex].examples.filter(
        (_, i) => i !== exampleIndex,
      );
      setGrammarList(updated);
    }
  };

  const addGrammarBlock = () => {
    const defaultTopicName = grammarList[0]?.topicName || "";
    setGrammarList([
      ...grammarList,
      {
        topicName: defaultTopicName,
        title: "",
        formula: "",
        meaning: "",
        examples: [""],
      },
    ]);
  };

  const removeGrammarBlock = (index: number) => {
    if (grammarList.length > 1)
      setGrammarList(grammarList.filter((_, i) => i !== index));
  };

  const parseJsonText = (text: string): GrammarItem[] => {
    const trimmed = text.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      const list = Array.isArray(parsed) ? parsed : [parsed];
      return list.map((item: any) => {
        const defaultTopicName = grammarList[0]?.topicName || currentTitle || "";
        return {
          topicName: item.topicName || defaultTopicName,
          title: item.title || "",
          formula: item.formula || "",
          meaning: item.meaning || "",
          examples: Array.isArray(item.examples)
            ? item.examples.map((ex: any) => {
                if (typeof ex === "string") return ex;
                if (ex && typeof ex === "object") {
                  return `${ex.jp || ""} : ${ex.vn || ""}`;
                }
                return String(ex);
              })
            : item.examples
            ? [
                typeof item.examples === "object"
                  ? `${item.examples.jp || ""} : ${item.examples.vn || ""}`
                  : String(item.examples),
              ]
            : [""],
        };
      }).filter((g: any) => g.title && g.meaning);
    } catch (e) {
      return [];
    }
  };

  const handleChangeTab = (nextTab: "manual" | "json") => {
    if (nextTab === "json") {
      const formatted = grammarList.map(g => ({
        topicName: g.topicName,
        title: g.title,
        formula: g.formula,
        meaning: g.meaning,
        examples: g.examples.filter(ex => ex.trim() !== "")
      }));
      setJsonText(JSON.stringify(formatted, null, 2));
    } else if (nextTab === "manual") {
      const parsed = parseJsonText(jsonText);
      if (parsed.length > 0) {
        setGrammarList(parsed);
      }
    }
    setActiveTab(nextTab);
  };

  const handleSubmit = async () => {
    let finalGrammarList: GrammarItem[] = [];
    if (activeTab === "json") {
      finalGrammarList = parseJsonText(jsonText);
      if (finalGrammarList.length === 0) {
        triggerToast("error", "Dữ liệu JSON trống hoặc không hợp lệ!");
        return;
      }
    } else {
      const hasEmpty = grammarList.some(
        (g) => !g.topicName.trim() || !g.title.trim() || !g.meaning.trim(),
      );
      if (hasEmpty) {
        triggerToast(
          "error",
          "Sếp vui lòng điền đầy đủ Tên bài, Tên cấu trúc và Ý nghĩa nhé!",
        );
        return;
      }
      finalGrammarList = grammarList;
    }

    const cleanGrammarList = finalGrammarList.map((item) => ({
      ...item,
      examples: item.examples
        .map((ex: any) => {
          if (typeof ex === "string") return ex;
          if (ex && typeof ex === "object") {
            return `${ex.jp || ""} : ${ex.vn || ""}`;
          }
          return String(ex);
        })
        .filter((ex) => ex.trim() !== ""),
    }));

    setLoading(true);
    try {
      if (isEditMode) {
        const payload = cleanGrammarList[0];
        const res = await api.put(
          `/api/vocab/update-grammar/${topicId}/${grammarId}`,
          payload,
        );

        if (res.data.success) {
          triggerToast("success", "🎉 Đã cập nhật ngữ pháp thành công!");
          setTimeout(() => router.back(), 1500);
        }
      } else {
        const targetTopicName = cleanGrammarList[0].topicName.trim();
        const res = await api.post(`/api/vocab/add-grammar-upsert`, {
          topicName: targetTopicName,
          grammarPoints: cleanGrammarList,
        });

        if (res.data.success) {
          triggerToast("success", "🎉 Đã lưu tài liệu ngữ pháp thành công!");
          setTimeout(() => router.back(), 1500);
        }
      }
    } catch (error) {
      const err = error as any;
      const errorMsg =
        err.response?.data?.message || "Không thể kết nối Backend.";
      triggerToast("error", errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <Toast toast={toast} slideAnim={slideAnim} />

      <Header
        title={isEditMode ? "✏️ Sửa Cấu Trúc" : "✍️ Biên Soạn Tài Liệu"}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={{ flex: 1, padding: 16 }}
          contentContainerStyle={{ paddingBottom: 60 }}
          showsVerticalScrollIndicator={false}
        >
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
              ✍️ Nhập thủ công
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
              📄 Import JSON
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === "manual" && (
          <>
            {grammarList.map((item, index) => {
              // 🚀 BỘ LỌC ĐỘNG (FUZZY SEARCH CHUẨN ĐÉT TẠI ĐÂY)
              const currentQuery = item.topicName.trim().toLowerCase();
              const filteredTopics = existingTopics.filter((topic) =>
                topic.toLowerCase().includes(currentQuery),
              );

              return (
                <View
                  key={index}
                  style={[
                    styles.grammarCard,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  <View style={styles.cardHeader}>
                    <Text
                      style={[
                        styles.badge,
                        {
                          backgroundColor: isDark ? "#45230F" : "#FFF7ED",
                          color: colors.amber,
                        },
                      ]}
                    >
                      {isEditMode
                        ? "Đang chỉnh sửa"
                        : `Tài liệu cấu trúc #${index + 1}`}
                    </Text>
                    {!isEditMode && (
                      <TouchableOpacity
                        onPress={() => removeGrammarBlock(index)}
                        disabled={grammarList.length === 1}
                        style={grammarList.length === 1 && { opacity: 0.3 }}
                      >
                        <MaterialIcons
                          name="delete"
                          size={22}
                          color={isDark ? "#F87171" : "#EF4444"}
                        />
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* 🚀 thanh gợi ý */}
                  {!isEditMode && index === 0 && filteredTopics.length > 0 && (
                    <View>
                      <Text style={[styles.label, { color: colors.textMuted }]}>
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
                            onPress={() => handleChange(index, "topicName", topic)}
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
                    iconName="folder-open"
                    value={item.topicName}
                    onChangeText={(text: string) => handleChange(index, "topicName", text)}
                    placeholder="Ví dụ: Bài 8 - Động từ thao tác"
                  />

                  <InputField
                    label="Tên cấu trúc ngữ pháp"
                    value={item.title}
                    onChangeText={(text: string) => handleChange(index, "title", text)}
                    placeholder="VD: Cấu trúc nhờ vả V-te"
                  />

                  <InputField
                    label="Công thức áp dụng"
                    highlight
                    iconName="functions"
                    value={item.formula}
                    onChangeText={(text: string) => handleChange(index, "formula", text)}
                    placeholder="VD: V-て + ください"
                  />

                  <InputField
                    label="Ý nghĩa & Ngữ cảnh dùng"
                    value={item.meaning}
                    onChangeText={(text: string) => handleChange(index, "meaning", text)}
                    multiline
                    style={styles.textArea}
                    placeholder="Dùng để yêu cầu người khác làm gì một cách lịch sự..."
                  />

                  <View style={styles.exampleHeaderRow}>
                    <Text
                      style={[
                        styles.label,
                        { color: colors.textMuted, marginTop: 0 },
                      ]}
                    >
                      Danh sách ví dụ mẫu:
                    </Text>
                  </View>

                  {item.examples.map((ex, exIndex) => (
                    <View key={exIndex} style={styles.exampleRow}>
                      <View style={{ flex: 1 }}>
                        <InputField
                          label={`Ví dụ #${exIndex + 1}`}
                          value={ex}
                          onChangeText={(text: string) =>
                            handleExampleChange(index, exIndex, text)
                          }
                          multiline
                          style={styles.textArea}
                          placeholder="VD: ここに入ってください (Hãy vào đây)"
                        />
                      </View>
                      {item.examples.length > 1 && (
                        <TouchableOpacity
                          style={[
                            styles.btnMiniDelete,
                            { backgroundColor: isDark ? "#451A1A" : "#FEF2F2" },
                          ]}
                          onPress={() => removeExampleRow(index, exIndex)}
                        >
                          <MaterialIcons
                            name="remove-circle-outline"
                            size={20}
                            color={isDark ? "#F87171" : "#EF4444"}
                          />
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}

                  <TouchableOpacity
                    style={[
                      styles.btnInnerAddExample,
                      { borderColor: colors.amber },
                    ]}
                    onPress={() => addExampleRow(index)}
                  >
                    <MaterialIcons name="add" size={16} color={colors.amber} />
                    <Text
                      style={[
                        styles.btnInnerAddExampleText,
                        { color: colors.amber },
                      ]}
                    >
                      Thêm ví dụ mẫu
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}

            {!isEditMode && (
              <TouchableOpacity
                style={[
                  styles.btnAddBlock,
                  { backgroundColor: colors.amberLight, borderColor: colors.amber },
                ]}
                onPress={addGrammarBlock}
              >
                <MaterialIcons
                  name="add-circle-outline"
                  size={20}
                  color={colors.amber}
                />
                <Text style={[styles.btnAddBlockText, { color: colors.amber }]}>
                  Thêm cấu trúc khác
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {activeTab === "json" && (
          <View style={[styles.grammarCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View
              style={[
                styles.hintBox,
                {
                  backgroundColor: isDark ? "#281E45" : "#F5F3FF",
                  borderColor: isDark ? "#4338CA" : "#DDD6FE",
                  padding: 12,
                  borderRadius: 12,
                  marginBottom: 14,
                  borderWidth: 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.hintText,
                  { color: isDark ? "#C7D2FE" : "#5B21B6", fontSize: 13, lineHeight: 18 },
                ]}
              >
                Dán chuỗi mảng JSON ngữ pháp đúng định dạng chứa topicName, title, formula, meaning, examples (mảng chuỗi).
              </Text>
            </View>
            <TextInput
              style={[
                styles.textArea,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  color: colors.text,
                  minHeight: 200,
                  borderRadius: 12,
                  borderWidth: 1,
                  padding: 14,
                  fontSize: 14,
                  textAlignVertical: "top",
                },
              ]}
              value={jsonText}
              onChangeText={setJsonText}
              placeholder='[{"topicName": "Bài 8", "title": "〜てください", "formula": "V-て + ください", "meaning": "Hãy làm V", "examples": ["câu ví dụ 1", "câu ví dụ 2"]}]'
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={10}
            />
          </View>
        )}

        <Button
          title={isEditMode ? "Lưu Thay Đổi" : "Lưu Lên Hệ Thống"}
          type="amber"
          size="small"
          loading={loading}
          onPress={handleSubmit}
        />
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  grammarCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    fontWeight: "700",
    fontSize: 13,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 6,
    marginTop: 12,
  },
  textArea: {
    height: 70,
    textAlignVertical: "top",
  },
  btnAddBlock: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    marginBottom: 24,
  },
  btnAddBlockText: {
    fontWeight: "700",
    marginLeft: 8,
    fontSize: 15,
  },
  suggestionContainer: { flexDirection: "row", marginBottom: 10, marginTop: 4 },
  suggestionChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
  },
  suggestionText: { fontSize: 13, fontWeight: "600" },
  exampleHeaderRow: {
    marginTop: 16,
    marginBottom: 6,
  },
  exampleRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 4,
    gap: 6,
  },
  btnMiniDelete: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  btnInnerAddExample: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderStyle: "dashed",
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: 6,
    marginBottom: 12,
  },
  btnInnerAddExampleText: {
    fontWeight: "700",
    fontSize: 13,
    marginLeft: 4,
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
  tabText: { fontSize: 13, fontWeight: "600" },
  hintBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
    borderWidth: 1,
  },
  hintText: { flex: 1, fontSize: 13, lineHeight: 18 },
});
