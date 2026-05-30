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
} from "react-native";

import { MaterialIcons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { useTheme } from "@/src/context/ThemeContext";
import Header from "../../components/ui/Header";
import api from "@/services/api";
import { WebView } from "react-native-webview";


// 1. Định nghĩa các Interface chuẩn khớp 100% với Backend TS
interface ExampleWord {
  word: string;
  reading: string;
  meaning: string;
}

interface KanjiData {
  _id: string;
  character: string;
  meaning: string;
  onyomi: string;
  kunyomi: string;
  vietnamese_reading: string; // Đồng bộ trường Âm Hán Việt mới
  level: string;
  stroke_order?: string[];
  example_words: ExampleWord[]; // Mảng object từ vựng ví dụ xịn sò
}

export default function KanjiSearchScreen() {
  const { colors, isDark } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedKanji, setSelectedKanji] = useState<KanjiData | null>(null);
  const [loading, setLoading] = useState(false);
  const [animationKey, setAnimationKey] = useState(0); // Dùng để reset ép WebView chạy lại hiệu ứng vẽ nét
   const ExpoWebView = WebView as any;
  // 🚀 LOGIC GỌI API THẬT KẾT NỐI BACKEND
  const handleSearch = async () => {
    Keyboard.dismiss();
    const query = searchQuery.trim();
    if (!query) return;

    setLoading(true);
    try {
      // Gọi lên router Backend: GET /api/kanji/search?q=...
      const response = await api.get(`/api/kanji/search`, {
        params: { q: query },
      });

      if (response.data.success && response.data.data) {
        setSelectedKanji(response.data.data);
        setAnimationKey((prev) => prev + 1); // Đổi key để ép WebView reset vẽ lại từ nét đầu tiên
      } else {
        setSelectedKanji(null);
      }
    } catch (error) {
      console.error("❌ Lỗi kết nối API Kanji:", error);
      setSelectedKanji(null);
    } finally {
      setLoading(false);
    }
  };

  // 🎨 SCRIPT HOẠT HỌA VẼ NÉT KANJI (Inject vào WebView)
  const generateStrokeAnimationHtml = (char: string) => {
    const strokeColor = isDark ? "#F59E0B" : "#4B5563"; // Màu Cam Amber nếu DarkMode, màu Xám nếu LightMode
    const outlineColor = isDark ? "#334155" : "#E5E7EB"; // Đường viền nét mờ làm nền phía sau

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <script src="https://cdn.jsdelivr.net/npm/hanzi-writer@3.5/dist/hanzi-writer.min.js"></script>
        <style>
          body {
            margin: 0; padding: 0; display: flex; justify-content: center;
            align-items: center; background-color: transparent; height: 100vh; overflow: hidden;
          }
          #kanji-box { width: 180px; height: 180px; }
        </style>
      </head>
      <body>
        <div id="kanji-box"></div>
        <script>
          var writer = HanziWriter.create('kanji-box', '${char}', {
            width: 180, height: 180, padding: 5,
            strokeAnimationSpeed: 1.2, delayBetweenStrokes: 150, 
            strokeColor: '${strokeColor}', outlineColor: '${outlineColor}',
            radicalColor: '#EF4444', // Nổi bật bộ thủ màu đỏ
            showOutline: true
          });
          writer.animateCharacter();
        </script>
      </body>
      </html>
    `;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <Header title="🉐 Tra Cứu Kanji" />

      {/* 🔍 THANH TÌM KIẾM THÔNG MINH */}
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
            placeholder="Nhập Kanji, Hán Việt hoặc Ý nghĩa..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <MaterialIcons name="clear" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[styles.btnSearch, { backgroundColor: colors.amber }]}
          onPress={handleSearch}
        >
          <Text style={styles.btnSearchText}>Tìm</Text>
        </TouchableOpacity>
      </View>

      {/* 📦 VÙNG HIỂN THỊ KẾT QUẢ ĐỘNG */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={colors.amber} />
            <Text style={[styles.loadingText, { color: colors.textMuted }]}>
              Đang lục lọi Database sếp ơi...
            </Text>
          </View>
        ) : selectedKanji ? (
          <View>
            {/* 🖌️ BOX 1: HOẠT HỌA VẼ NÉT (STOKE ANIMATION) */}
            <View
              style={[
                styles.animationCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View style={styles.webViewWrapper}>
                <ExpoWebView
                  key={animationKey}
                  originWhitelist={["*"]}
                  source={{
                    html: generateStrokeAnimationHtml(selectedKanji.character),
                  }}
                  style={{ backgroundColor: "transparent" }}
                  scrollEnabled={false}
                  javaScriptEnabled={true}
                />
              </View>

              <TouchableOpacity
                style={[
                  styles.btnReplay,
                  { backgroundColor: isDark ? "#2D1A10" : "#FEF3C7" },
                ]}
                onPress={() => setAnimationKey((prev) => prev + 1)}
              >
                <MaterialIcons
                  name="play-circle-outline"
                  size={16}
                  color={colors.amber}
                />
                <Text style={[styles.btnReplayText, { color: colors.amber }]}>
                  Xem lại nét vẽ
                </Text>
              </TouchableOpacity>
            </View>

            {/* 📑 BOX 2: CHI TIẾT THÔNG TIN CHỮ KANJI */}
            <View
              style={[
                styles.infoCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              {/* Hàng tiêu đề: Chữ to, Âm Hán Việt, Ý nghĩa, Cấp độ */}
              <View style={styles.titleRow}>
                <Text style={[styles.kanjiText, { color: colors.text }]}>
                  {selectedKanji.character}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.hanVietText, { color: colors.amber }]}>
                    {selectedKanji.vietnamese_reading}
                  </Text>
                  <Text style={[styles.meaningText, { color: colors.text }]}>
                    {selectedKanji.meaning}
                  </Text>
                </View>
                <View
                  style={[
                    styles.levelBadge,
                    { backgroundColor: isDark ? "#1E293B" : "#EEF2F6" },
                  ]}
                >
                  <Text style={[styles.levelText, { color: colors.text }]}>
                    {selectedKanji.level}
                  </Text>
                </View>
              </View>

              <View
                style={[styles.divider, { backgroundColor: colors.border }]}
              />

              {/* Chi tiết Âm On - Âm Kun */}
              <View style={styles.yomiRow}>
                <Text style={[styles.yomiLabel, { color: colors.textMuted }]}>
                  Âm ON (Onyomi):
                </Text>
                <Text style={[styles.yomiValue, { color: colors.text }]}>
                  {selectedKanji.onyomi || "---"}
                </Text>
              </View>

              <View style={styles.yomiRow}>
                <Text style={[styles.yomiLabel, { color: colors.textMuted }]}>
                  Âm KUN (Kunyomi):
                </Text>
                <Text style={[styles.yomiValue, { color: colors.text }]}>
                  {selectedKanji.kunyomi || "---"}
                </Text>
              </View>

              <View
                style={[styles.divider, { backgroundColor: colors.border }]}
              />

              {/* 🌟 BOX 3: VÒNG LẶP MAP DANH SÁCH TỪ VỰNG VÍ DỤ MẪU */}
              <Text
                style={[
                  styles.yomiLabel,
                  { color: colors.textMuted, marginBottom: 8 },
                ]}
              >
                Từ vựng ví dụ mẫu:
              </Text>

              {selectedKanji.example_words &&
              selectedKanji.example_words.length > 0 ? (
                selectedKanji.example_words.map((ex, i) => (
                  <View
                    key={i}
                    style={[
                      styles.exampleBox,
                      { backgroundColor: colors.background, marginBottom: 8 },
                    ]}
                  >
                    <MaterialIcons
                      name="star-outline"
                      size={18}
                      color={colors.amber}
                      style={{ marginRight: 6 }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[styles.exampleText, { color: colors.text }]}
                      >
                        {ex.word}{" "}
                        <Text
                          style={{ fontWeight: "400", color: colors.textMuted }}
                        >
                          ({ex.reading})
                        </Text>
                      </Text>
                      <Text
                        style={[
                          styles.exampleMeaning,
                          { color: colors.textMuted },
                        ]}
                      >
                        {ex.meaning}
                      </Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text
                  style={{
                    color: colors.textMuted,
                    fontSize: 13,
                    fontStyle: "italic",
                  }}
                >
                  Chưa có ví dụ mẫu cho chữ này.
                </Text>
              )}
            </View>
          </View>
        ) : (
          <View style={styles.centerBox}>
            <MaterialIcons
              name="find-in-page"
              size={48}
              color={colors.textMuted}
            />
            <Text
              style={{
                color: colors.textMuted,
                marginTop: 10,
                textAlign: "center",
                paddingHorizontal: 40,
              }}
            >
              {searchQuery
                ? "Không tìm thấy chữ này dưới DB rồi sếp ơi! 😢"
                : "Sếp hãy nhập từ khóa để dò tìm chữ Kanji nhé!"}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchSection: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginBottom: 16,
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
    paddingHorizontal: 20,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  btnSearchText: { color: "#FFF", fontWeight: "700", fontSize: 15 },
  animationCard: {
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    alignItems: "center",
    marginBottom: 16,
  },
  webViewWrapper: { width: 180, height: 180, overflow: "hidden" },
  btnReplay: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 14,
  },
  btnReplayText: { fontSize: 12, fontWeight: "700", marginLeft: 4 },
  infoCard: {
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  kanjiText: { fontSize: 48, fontWeight: "700" },
  hanVietText: { fontSize: 18, fontWeight: "800", marginBottom: 2 },
  meaningText: { fontSize: 14, fontWeight: "500", lineHeight: 18 },
  levelBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  levelText: { fontSize: 12, fontWeight: "700" },
  divider: { height: 1, marginVertical: 14 },
  yomiRow: { marginBottom: 10 },
  yomiLabel: { fontSize: 12, fontWeight: "600", marginBottom: 2 },
  yomiValue: { fontSize: 14, fontWeight: "700" },
  exampleBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 12,
    borderRadius: 10,
  },
  exampleText: { fontSize: 15, fontWeight: "700" },
  exampleMeaning: { fontSize: 13, marginTop: 2 },
  centerBox: { alignItems: "center", marginTop: 60, justifyContent: "center" },
  loadingText: { marginTop: 10, fontSize: 13, fontWeight: "500" },
});
