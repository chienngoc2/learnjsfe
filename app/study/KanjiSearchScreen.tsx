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
  Platform, // 🚀 Thêm Platform để tự động nhận diện thiết bị Web/Mobile
} from "react-native";
import { WebView } from "react-native-webview";
import { MaterialIcons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { useTheme } from "@/src/context/ThemeContext";
import Header from "../../components/ui/Header";
import api from "@/services/api"; // Giữ nguyên import service chuẩn của sếp

// 🚀 Đưa bùa chú ép kiểu TS ra ngoài để component chạy mượt hơn, tránh re-render thừa
const ExpoWebView = WebView as any;

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
  vietnamese_reading: string;
  level: string;
  stroke_order?: string[];
  example_words: ExampleWord[];
}

export default function KanjiSearchScreen() {
  const { colors, isDark } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedKanji, setSelectedKanji] = useState<KanjiData | null>(null);
  const [loading, setLoading] = useState(false);
  const [animationKey, setAnimationKey] = useState(0);

  // 🚀 LOGIC GỌI API KẾT NỐI BACKEND LOCAL / PRODUCTION
  const handleSearch = async () => {
    Keyboard.dismiss();
    const query = searchQuery.trim();
    if (!query) return;

    setLoading(true);
    try {
      const response = await api.get(`/api/kanji/search`, {
        params: { q: query },
      });

      if (response.data.success && response.data.data) {
        setSelectedKanji(response.data.data);
        setAnimationKey((prev) => prev + 1); // Reset lại key để ép chữ múa nét lại từ đầu
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

  // 🎨 SCRIPT HOẠT HỌA VẼ NÉT KANJI (Thu gọn kích thước xuống 130px cho vừa khít ô vuông bên phải)
  const generateStrokeAnimationHtml = (char: string) => {
    const strokeColor = isDark ? "#F59E0B" : "#4B5563";
    const outlineColor = isDark ? "#334155" : "#E5E7EB";

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
          #kanji-box { width: 130px; height: 130px; }
        </style>
      </head>
      <body>
        <div id="kanji-box"></div>
        <script>
          var writer = HanziWriter.create('kanji-box', '${char}', {
            width: 130, height: 130, padding: 2,
            strokeAnimationSpeed: 1.2, delayBetweenStrokes: 150, 
            strokeColor: '${strokeColor}', outlineColor: '${outlineColor}',
            radicalColor: '#EF4444',
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

      {/* 📦 VÙNG HIỂN THỊ KẾT QUẢ ĐỘNG (BẢN NEW UI: SIDE-BY-SIDE) */}
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
          <View
            style={[
              styles.mainCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            {/* 🔗 BỐ CỤC CHIA ĐÔI: BÊN TRÁI THÔNG TIN - BÊN PHẢI Ô CHỮ KANJI VẼ NÉT */}
            <View style={styles.rowLayout}>
              {/* 📑 BÊN TRÁI: CHI TIẾT ÂM NGHĨA */}
              <View style={styles.leftInfoBlock}>
                <View style={styles.titleInlineRow}>
                  <Text style={[styles.hanVietText, { color: colors.amber }]}>
                    {selectedKanji.vietnamese_reading}
                  </Text>
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

                <Text style={[styles.meaningText, { color: colors.text }]}>
                  {selectedKanji.meaning}
                </Text>

                <View style={styles.yomiContainer}>
                  <Text style={[styles.yomiItem, { color: colors.text }]}>
                    <Text
                      style={{ color: colors.textMuted, fontWeight: "600" }}
                    >
                      Âm ON:{" "}
                    </Text>
                    {selectedKanji.onyomi || "---"}
                  </Text>
                  <Text style={[styles.yomiItem, { color: colors.text }]}>
                    <Text
                      style={{ color: colors.textMuted, fontWeight: "600" }}
                    >
                      Âm KUN:{" "}
                    </Text>
                    {selectedKanji.kunyomi || "---"}
                  </Text>
                </View>
              </View>

              {/* 🖌️ BÊN PHẢI: Ô VUÔNG TẬP VIẾT & VẼ CHỮ KANJI */}
              <View style={styles.rightDrawBlock}>
                <View
                  style={[
                    styles.webViewWrapper,
                    { borderColor: colors.border },
                  ]}
                >
                  {Platform.OS === "web" ? (
                    <iframe
                      key={animationKey}
                      srcDoc={generateStrokeAnimationHtml(
                        selectedKanji.character,
                      )}
                      style={{
                        width: "130px",
                        height: "130px",
                        border: "none",
                        backgroundColor: "transparent",
                      }}
                    />
                  ) : (
                    <ExpoWebView
                      key={animationKey}
                      originWhitelist={["*"]}
                      source={{
                        html: generateStrokeAnimationHtml(
                          selectedKanji.character,
                        ),
                      }}
                      style={{ backgroundColor: "transparent" }}
                      scrollEnabled={false}
                      javaScriptEnabled={true}
                    />
                  )}
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
                    size={13}
                    color={colors.amber}
                  />
                  <Text style={[styles.btnReplayText, { color: colors.amber }]}>
                    Xem lại nét
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View
              style={[styles.divider, { backgroundColor: colors.border }]}
            />

            {/* 🌟 PHẦN DƯỚI: DANH SÁCH TỪ VỰNG VÍ DỤ MẪU (Bung rộng toàn màn hình) */}
            <Text style={[styles.exampleTitle, { color: colors.textMuted }]}>
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
                    <Text style={[styles.exampleText, { color: colors.text }]}>
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

  // 🆕 Hệ thống Style Layout Hàng ngang Mới Đét
  mainCard: {
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  rowLayout: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  leftInfoBlock: { flex: 1, paddingRight: 12 },
  titleInlineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  hanVietText: { fontSize: 24, fontWeight: "800" },
  levelBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  levelText: { fontSize: 11, fontWeight: "700" },
  meaningText: {
    fontSize: 15,
    fontWeight: "500",
    lineHeight: 20,
    marginBottom: 12,
  },
  yomiContainer: { gap: 4 },
  yomiItem: { fontSize: 13, fontWeight: "500" },

  // 🖌️ Khu vực cấu trúc ô vuông bên phải
  rightDrawBlock: { alignItems: "center" },
  webViewWrapper: {
    width: 130,
    height: 130,
    overflow: "hidden",
    borderRadius: 12,
    borderWidth: 1,
  },
  btnReplay: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    marginTop: 8,
  },
  btnReplayText: { fontSize: 11, fontWeight: "700", marginLeft: 4 },

  divider: { height: 1, marginVertical: 16 },
  exampleTitle: { fontSize: 13, fontWeight: "600", marginBottom: 10 },
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
