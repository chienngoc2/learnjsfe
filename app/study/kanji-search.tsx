import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Keyboard,
  Platform,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import * as Speech from "expo-speech";
import { useTheme } from "@/src/context/ThemeContext";
import Header from "../../components/ui/Header";
import api from "@/services/api";
import HandwritingCanvas from "../../components/HandwritingCanvas";
import StrokeOrderPractice from "../../components/StrokeOrderPractice";

interface ExampleWord {
  word: string;
  reading: string;
  meaning: string;
}

interface KanjiData {
  _id?: string;
  character: string;
  meaning: string;
  pinyin?: string;
  zhuyin?: string;
  onyomi?: string;
  kunyomi?: string;
  vietnamese_reading: string;
  level: string;
  stroke_order?: string[];
  example_words?: ExampleWord[];
  story?: string;
  components?: string[];
}

export default function KanjiSearchScreen() {
  const { colors, isDark } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const [inputMode, setInputMode] = useState<"keyboard" | "handwriting">("handwriting");
  const [selectedKanji, setSelectedKanji] = useState<KanjiData | null>(null);
  const [loading, setLoading] = useState(false);

  const performSearch = async (queryText: string) => {
    Keyboard.dismiss();
    const query = queryText.trim();
    if (!query) return;

    setLoading(true);
    try {
      const response = await api.get(`/api/kanji/search`, {
        params: { q: query },
      });

      if (response.data && response.data.success && response.data.data) {
        setSelectedKanji(response.data.data);
      } else {
        // Fallback: Cho phép luyện viết ngay với chữ người dùng nhập/vẽ
        const isSingleChineseChar = /[\u4e00-\u9fff\u3400-\u4dbf]/.test(query);
        if (isSingleChineseChar) {
          setSelectedKanji({
            character: query[0],
            meaning: "Chữ Hán Phồn Thể (Tự do luyện tập)",
            vietnamese_reading: "Đang cập nhật",
            pinyin: "",
            level: "Phồn Thể",
            example_words: [],
          });
        } else {
          setSelectedKanji(null);
        }
      }
    } catch (error) {
      console.warn("API Search Error:", error);
      // Fallback nếu server chưa có data
      const isSingleChineseChar = /[\u4e00-\u9fff\u3400-\u4dbf]/.test(query);
      if (isSingleChineseChar) {
        setSelectedKanji({
          character: query[0],
          meaning: "Chữ Hán Phồn Thể (Tự do luyện tập)",
          vietnamese_reading: "Tự do",
          pinyin: "",
          level: "Phồn Thể",
          example_words: [],
        });
      } else {
        setSelectedKanji(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSelectHandwrittenChar = (char: string) => {
    setSearchQuery(char);
    performSearch(char);
  };

  const playPronunciation = (text: string) => {
    Speech.speak(text, {
      language: "zh-TW",
      rate: 0.9,
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <Header title="✍️ Tra cứu & Luyện viết Chữ Hán" />

      {/* Mode Selector Tabs (Bàn phím vs Viết tay vào ô) */}
      <View style={styles.modeTabsRow}>
        <TouchableOpacity
          style={[
            styles.modeTab,
            inputMode === "handwriting" && {
              backgroundColor: colors.indigo,
              borderColor: colors.indigo,
            },
            inputMode !== "handwriting" && {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
          onPress={() => setInputMode("handwriting")}
        >
          <MaterialIcons
            name="gesture"
            size={18}
            color={inputMode === "handwriting" ? "#FFFFFF" : colors.text}
          />
          <Text
            style={[
              styles.modeTabText,
              { color: inputMode === "handwriting" ? "#FFFFFF" : colors.text },
            ]}
          >
            Viết tay nhận diện
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.modeTab,
            inputMode === "keyboard" && {
              backgroundColor: colors.indigo,
              borderColor: colors.indigo,
            },
            inputMode !== "keyboard" && {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
          onPress={() => setInputMode("keyboard")}
        >
          <MaterialIcons
            name="keyboard"
            size={18}
            color={inputMode === "keyboard" ? "#FFFFFF" : colors.text}
          />
          <Text
            style={[
              styles.modeTabText,
              { color: inputMode === "keyboard" ? "#FFFFFF" : colors.text },
            ]}
          >
            Nhập bàn phím
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 60 }}
      >
        {/* INPUT: BÀN PHÍM */}
        {inputMode === "keyboard" ? (
          <View style={styles.searchSection}>
            <View
              style={[
                styles.searchContainer,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <MaterialIcons
                name="search"
                size={22}
                color={colors.textMuted}
                style={styles.searchIcon}
              />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder="Nhập Chữ Hán, Pinyin, Hán Việt..."
                placeholderTextColor={colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={() => performSearch(searchQuery)}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery("")}>
                  <MaterialIcons name="clear" size={20} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              style={[styles.btnSearch, { backgroundColor: colors.indigo }]}
              onPress={() => performSearch(searchQuery)}
            >
              <Text style={styles.btnSearchText}>Tra cứu</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* INPUT: VIẾT TAY NHẬN DIỆN */
          <View style={styles.handwritingSection}>
            <HandwritingCanvas onSelectCharacter={handleSelectHandwrittenChar} />
          </View>
        )}

        {/* KẾT QUẢ TRA CỨU & KHU VỰC LUYỆN VIẾT THEO NÉT MỜ */}
        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={colors.indigo} />
            <Text style={[styles.loadingText, { color: colors.textMuted }]}>
              Đang tra cứu từ điển Hán tự...
            </Text>
          </View>
        ) : selectedKanji ? (
          <View
            style={[
              styles.resultCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            {/* Header info */}
            <View style={styles.cardHeader}>
              <View>
                <View style={styles.titleRow}>
                  <Text style={[styles.hanVietText, { color: colors.indigo }]}>
                    {selectedKanji.vietnamese_reading || selectedKanji.character}
                  </Text>
                  <View
                    style={[
                      styles.levelBadge,
                      { backgroundColor: isDark ? "#1E293B" : "#EEF2F6" },
                    ]}
                  >
                    <Text style={[styles.levelText, { color: colors.indigo }]}>
                      {selectedKanji.level || "TOCFL"}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.meaningText, { color: colors.text }]}>
                  {selectedKanji.meaning}
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.audioBtn, { backgroundColor: isDark ? "#1E293B" : "#EFF6FF" }]}
                onPress={() => playPronunciation(selectedKanji.character)}
              >
                <MaterialIcons name="volume-up" size={24} color={colors.indigo} />
              </TouchableOpacity>
            </View>

            {/* Khối Luyện viết theo nét mờ trực quan */}
            <View style={[styles.practiceWrap, { borderColor: colors.border }]}>
              <View style={styles.practiceHeader}>
                <MaterialIcons name="border-color" size={18} color={colors.indigo} />
                <Text style={[styles.practiceTitle, { color: colors.text }]}>
                  Luyện viết theo nét mờ (Stroke Order)
                </Text>
              </View>
              <StrokeOrderPractice
                character={selectedKanji.character}
                pinyin={selectedKanji.pinyin || selectedKanji.onyomi}
                zhuyin={selectedKanji.zhuyin}
                vietnameseReading={selectedKanji.vietnamese_reading}
                size={260}
              />
            </View>

            {/* Thông tin mở rộng: Pinyin, Zhuyin, Bộ thủ, Mẹo nhớ */}
            <View style={styles.detailGrid}>
              {(selectedKanji.pinyin || selectedKanji.onyomi) && (
                <View style={[styles.detailItem, { backgroundColor: colors.background }]}>
                  <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Pinyin (Bính âm):</Text>
                  <Text style={[styles.detailValue, { color: colors.indigo }]}>
                    {selectedKanji.pinyin || selectedKanji.onyomi}
                  </Text>
                </View>
              )}

              {selectedKanji.zhuyin && (
                <View style={[styles.detailItem, { backgroundColor: colors.background }]}>
                  <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Zhuyin (Chú âm):</Text>
                  <Text style={[styles.detailValue, { color: colors.amber }]}>
                    {selectedKanji.zhuyin}
                  </Text>
                </View>
              )}

              {selectedKanji.story ? (
                <View style={[styles.storyBox, { backgroundColor: colors.background }]}>
                  <Text style={[styles.detailLabel, { color: colors.textMuted }]}>💡 Mẹo ghi nhớ / Chiết tự:</Text>
                  <Text style={[styles.storyText, { color: colors.text }]}>
                    {selectedKanji.story}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Từ ghép ví dụ */}
            <View style={styles.examplesSection}>
              <Text style={[styles.examplesHeading, { color: colors.textMuted }]}>
                Từ ghép ví dụ:
              </Text>
              {selectedKanji.example_words && selectedKanji.example_words.length > 0 ? (
                selectedKanji.example_words.map((ex, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.exampleItem,
                      { backgroundColor: colors.background, borderColor: colors.border },
                    ]}
                  >
                    <TouchableOpacity
                      style={styles.speakerMini}
                      onPress={() => playPronunciation(ex.word)}
                    >
                      <MaterialIcons name="volume-up" size={16} color={colors.indigo} />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.exampleWord, { color: colors.text }]}>
                        {ex.word}{" "}
                        <Text style={{ fontWeight: "400", color: colors.indigo, fontSize: 13 }}>
                          [{ex.reading}]
                        </Text>
                      </Text>
                      <Text style={[styles.exampleMeaning, { color: colors.textMuted }]}>
                        {ex.meaning}
                      </Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={{ color: colors.textMuted, fontSize: 13, fontStyle: "italic" }}>
                  Chưa có từ ghép mẫu cho chữ này.
                </Text>
              )}
            </View>
          </View>
        ) : (
          <View style={styles.centerBox}>
            <MaterialIcons name="draw" size={48} color={colors.textMuted} />
            <Text style={[styles.emptyHint, { color: colors.textMuted }]}>
              {searchQuery
                ? "Không tìm thấy chữ này trong từ điển. Hãy vẽ tay hoặc chọn chữ khác nhé!"
                : "Vẽ chữ Hán vào ô trên hoặc nhập từ khóa để tra cứu và luyện viết!"}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  modeTabsRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 12,
  },
  modeTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  modeTabText: {
    fontSize: 13,
    fontWeight: "700",
  },
  searchSection: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginBottom: 14,
    gap: 8,
  },
  searchContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14 },
  btnSearch: {
    paddingHorizontal: 18,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  btnSearchText: { color: "#FFF", fontWeight: "700", fontSize: 14 },
  handwritingSection: {
    paddingHorizontal: 16,
  },
  resultCard: {
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  hanVietText: {
    fontSize: 22,
    fontWeight: "800",
  },
  levelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  levelText: {
    fontSize: 11,
    fontWeight: "700",
  },
  meaningText: {
    fontSize: 15,
    fontWeight: "600",
  },
  audioBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  practiceWrap: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    paddingVertical: 14,
    marginVertical: 10,
  },
  practiceHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginBottom: 6,
  },
  practiceTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  detailGrid: {
    gap: 8,
    marginVertical: 10,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 10,
    borderRadius: 10,
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  detailValue: {
    fontSize: 14,
    fontWeight: "700",
  },
  storyBox: {
    padding: 10,
    borderRadius: 10,
    gap: 4,
  },
  storyText: {
    fontSize: 13,
    lineHeight: 18,
  },
  examplesSection: {
    marginTop: 10,
  },
  examplesHeading: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
  },
  exampleItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 6,
    gap: 10,
  },
  speakerMini: {
    padding: 4,
  },
  exampleWord: {
    fontSize: 15,
    fontWeight: "700",
  },
  exampleMeaning: {
    fontSize: 13,
    marginTop: 2,
  },
  centerBox: {
    alignItems: "center",
    marginTop: 40,
    justifyContent: "center",
    paddingHorizontal: 30,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: "500",
  },
  emptyHint: {
    marginTop: 10,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
});
