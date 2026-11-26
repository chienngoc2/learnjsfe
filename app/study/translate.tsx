import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  StatusBar,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Speech from "expo-speech";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/src/context/ThemeContext";
import api from "../../services/api";

interface TranslatedSentence {
  text: string;
  pinyin?: string;
  meaningVi?: string;
}

interface TranslatedKeyword {
  term: string;
  pinyin?: string;
  meaning: string;
}

interface TranslateResult {
  detectedLang: "zh" | "vi";
  chineseText: string;
  pinyin: string;
  vietnameseText: string;
  sentences: TranslatedSentence[];
  keywords: TranslatedKeyword[];
}

export default function TranslateScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  const [inputText, setInputText] = useState("");
  const [direction, setDirection] = useState<"auto" | "zh-vi" | "vi-zh">("auto");
  const [loading, setLoading] = useState(false);
  const [slowVoice, setSlowVoice] = useState(false);
  const [result, setResult] = useState<TranslateResult | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 2400);
  };

  const handlePaste = async () => {
    try {
      const pasted = await Clipboard.getStringAsync();
      if (pasted) {
        setInputText(pasted);
        showNotice("Đã dán từ bộ nhớ tạm");
        return;
      }
    } catch (e) {}
    if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
      try {
        const pasted = await navigator.clipboard.readText();
        if (pasted) {
          setInputText(pasted);
          showNotice("Đã dán từ bộ nhớ tạm");
        }
      } catch (e) {}
    }
  };

  const handleCopy = async (text: string, label = "Đã sao chép") => {
    if (!text) return;
    try {
      await Clipboard.setStringAsync(text);
    } catch (e) {
      if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(text);
        } catch (err) {}
      }
    }
    showNotice(label);
  };

  const speakText = (text: string, lang: "zh-TW" | "vi-VN" = "zh-TW") => {
    if (!text) return;
    Speech.stop();
    Speech.speak(text, {
      language: lang,
      rate: slowVoice ? 0.72 : 0.95,
      pitch: 1.0,
    });
  };

  const handleTranslate = async () => {
    const trimmed = inputText.trim();
    if (!trimmed) {
      showNotice("Vui lòng nhập hoặc dán nội dung");
      return;
    }
    setLoading(true);
    try {
      const res = await api.post("/api/audio/translate-text", {
        text: trimmed,
        direction,
      });
      if (res.data?.success && res.data?.data) {
        setResult(res.data.data);
      } else {
        showNotice(res.data?.error || "Không thể dịch lúc này");
      }
    } catch (e: any) {
      showNotice(e?.response?.data?.error || "Lỗi kết nối máy chủ");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveKeyword = async (kw: TranslatedKeyword) => {
    try {
      const res = await api.post("/api/vocab/save", {
        title: "Từ vựng đọc dịch",
        list: [
          {
            term: kw.term,
            def: JSON.stringify({
              reading: kw.pinyin || kw.term,
              pinyin: kw.pinyin || "",
              meaning: kw.meaning,
              type: "noun",
              level: "TOCFL",
            }),
          },
        ],
      });
      if (res.data?.success) {
        showNotice(`Đã lưu "${kw.term}" vào bài "Từ vựng đọc dịch"`);
      }
    } catch (e) {
      showNotice("Không thể lưu từ vựng");
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
            paddingTop: insets.top > 0 ? insets.top + 8 : Platform.OS === "android" ? 40 : 16,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.iconBtn, { borderColor: colors.border }]}
          activeOpacity={0.7}
        >
          <MaterialIcons name="arrow-back" size={20} color={colors.text} />
        </TouchableOpacity>

        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Đọc & Dịch nhanh</Text>
          <Text style={[styles.headerSub, { color: colors.textMuted }]}>
            Dán từ, câu hoặc đoạn văn Trung · Việt
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => setSlowVoice(!slowVoice)}
          style={[
            styles.rateBtn,
            {
              borderColor: slowVoice ? "#10B981" : colors.border,
              backgroundColor: slowVoice ? "rgba(16, 185, 129, 0.12)" : colors.background,
            },
          ]}
        >
          <MaterialIcons name="speed" size={16} color={slowVoice ? "#10B981" : colors.textMuted} />
          <Text style={{ fontSize: 12, fontWeight: "600", color: slowVoice ? "#10B981" : colors.textMuted }}>
            {slowVoice ? "0.75x" : "1.0x"}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 80 }} showsVerticalScrollIndicator={false}>
        {/* Direction Switcher */}
        <View style={[styles.dirRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {(
            [
              { key: "auto", label: "Tự động" },
              { key: "zh-vi", label: "Trung → Việt" },
              { key: "vi-zh", label: "Việt → Trung" },
            ] as const
          ).map((item) => {
            const active = direction === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                onPress={() => setDirection(item.key)}
                style={[
                  styles.dirTab,
                  active && { backgroundColor: "#10B981" },
                ]}
              >
                <Text style={{ fontSize: 13, fontWeight: "600", color: active ? "#FFFFFF" : colors.textMuted }}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Input Box */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.cardTopRow}>
            <Text style={[styles.cardLabel, { color: colors.textMuted }]}>Nội dung gốc</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity onPress={handlePaste} style={[styles.smallBtn, { borderColor: colors.border }]}>
                <MaterialIcons name="content-paste" size={14} color={colors.text} />
                <Text style={[styles.smallBtnText, { color: colors.text }]}>Dán</Text>
              </TouchableOpacity>
              {!!inputText && (
                <TouchableOpacity
                  onPress={() => {
                    setInputText("");
                    setResult(null);
                    Speech.stop();
                  }}
                  style={[styles.smallBtn, { borderColor: colors.border }]}
                >
                  <MaterialIcons name="close" size={14} color={colors.textMuted} />
                  <Text style={[styles.smallBtnText, { color: colors.textMuted }]}>Xóa</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <TextInput
            multiline
            value={inputText}
            onChangeText={setInputText}
            placeholder="Dán từ vựng, câu hội thoại hoặc cả đoạn văn vào đây..."
            placeholderTextColor={colors.textMuted}
            style={[styles.textArea, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
          />

          <View style={styles.inputFooter}>
            <TouchableOpacity
              onPress={() => speakText(inputText, /[\u4e00-\u9fff]/.test(inputText) ? "zh-TW" : "vi-VN")}
              disabled={!inputText.trim()}
              style={[styles.smallBtn, { borderColor: colors.border, opacity: inputText.trim() ? 1 : 0.4 }]}
            >
              <MaterialIcons name="volume-up" size={16} color={colors.text} />
              <Text style={[styles.smallBtnText, { color: colors.text }]}>Đọc bản gốc</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleTranslate}
              disabled={loading || !inputText.trim()}
              style={[
                styles.translateBtn,
                { backgroundColor: loading || !inputText.trim() ? colors.border : "#10B981" },
              ]}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <MaterialIcons name="translate" size={18} color="#FFFFFF" />
                  <Text style={styles.translateBtnText}>Dịch & Phân tích</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Result Box */}
        {result && (
          <View style={{ gap: 12, marginTop: 12 }}>
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: "#10B981" }]}>
              <View style={styles.cardTopRow}>
                <Text style={[styles.cardLabel, { color: "#10B981" }]}>Kết quả dịch</Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <TouchableOpacity
                    onPress={() => speakText(result.chineseText, "zh-TW")}
                    style={[styles.smallBtn, { borderColor: colors.border }]}
                  >
                    <MaterialIcons name="volume-up" size={15} color="#10B981" />
                    <Text style={[styles.smallBtnText, { color: "#10B981" }]}>Đọc tiếng Trung</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() =>
                      handleCopy(
                        `${result.chineseText}\n${result.pinyin}\n${result.vietnameseText}`.trim(),
                        "Đã sao chép bản dịch"
                      )
                    }
                    style={[styles.smallBtn, { borderColor: colors.border }]}
                  >
                    <MaterialIcons name="content-copy" size={14} color={colors.text} />
                    <Text style={[styles.smallBtnText, { color: colors.text }]}>Copy</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={[styles.zhResult, { color: colors.text }]}>{result.chineseText}</Text>
              {!!result.pinyin && (
                <Text style={[styles.pinyinResult, { color: "#10B981" }]}>{result.pinyin}</Text>
              )}
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <Text style={[styles.viResult, { color: colors.text }]}>{result.vietnameseText}</Text>
            </View>

            {/* Sentences Breakdown */}
            {Array.isArray(result.sentences) && result.sentences.length > 1 && (
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.cardLabel, { color: colors.textMuted, marginBottom: 8 }]}>
                  Tách từng câu ({result.sentences.length})
                </Text>
                {result.sentences.map((s, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.sentenceItem,
                      { borderTopColor: colors.border, borderTopWidth: idx === 0 ? 0 : 1 },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, fontWeight: "600", color: colors.text }}>{s.text}</Text>
                      {!!s.pinyin && (
                        <Text style={{ fontSize: 13, color: "#10B981", marginTop: 2 }}>{s.pinyin}</Text>
                      )}
                      {!!s.meaningVi && (
                        <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 2 }}>{s.meaningVi}</Text>
                      )}
                    </View>
                    <View style={{ flexDirection: "row", gap: 6, marginLeft: 8 }}>
                      <TouchableOpacity
                        onPress={() => speakText(s.text, "zh-TW")}
                        style={[styles.miniIconBtn, { borderColor: colors.border }]}
                      >
                        <MaterialIcons name="volume-up" size={16} color="#10B981" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleCopy(`${s.text}\n${s.pinyin || ""}\n${s.meaningVi || ""}`.trim())}
                        style={[styles.miniIconBtn, { borderColor: colors.border }]}
                      >
                        <MaterialIcons name="content-copy" size={15} color={colors.textMuted} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Key Vocab Quick Save */}
            {Array.isArray(result.keywords) && result.keywords.length > 0 && (
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.cardLabel, { color: colors.textMuted, marginBottom: 8 }]}>
                  Từ vựng nổi bật (chạm + để lưu)
                </Text>
                {result.keywords.map((kw, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.kwRow,
                      { borderTopColor: colors.border, borderTopWidth: idx === 0 ? 0 : 1 },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: "600", color: colors.text }}>
                        {kw.term} <Text style={{ fontSize: 13, color: "#10B981", fontWeight: "400" }}>{kw.pinyin}</Text>
                      </Text>
                      <Text style={{ fontSize: 13, color: colors.textMuted }}>{kw.meaning}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleSaveKeyword(kw)}
                      style={[styles.smallBtn, { borderColor: "#10B981" }]}
                    >
                      <MaterialIcons name="add" size={16} color="#10B981" />
                      <Text style={[styles.smallBtnText, { color: "#10B981" }]}>Lưu từ</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {notice && (
        <View style={styles.toast}>
          <MaterialIcons name="check-circle" size={16} color="#10B981" />
          <Text style={styles.toastText}>{notice}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 17, fontWeight: "600" },
  headerSub: { fontSize: 12, marginTop: 2 },
  rateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  dirRow: {
    flexDirection: "row",
    padding: 4,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    gap: 4,
  },
  dirTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  cardLabel: { fontSize: 12, fontWeight: "600" },
  smallBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  smallBtnText: { fontSize: 12, fontWeight: "600" },
  textArea: {
    minHeight: 112,
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    fontSize: 15,
    textAlignVertical: "top",
  },
  inputFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
  },
  translateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  translateBtnText: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" },
  zhResult: { fontSize: 20, fontWeight: "600", lineHeight: 30 },
  pinyinResult: { fontSize: 14, marginTop: 4 },
  divider: { height: 1, marginVertical: 12 },
  viResult: { fontSize: 15, lineHeight: 22 },
  sentenceItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  miniIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  kwRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  toast: {
    position: "absolute",
    bottom: 24,
    alignSelf: "center",
    backgroundColor: "#111827",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  toastText: { color: "#FFFFFF", fontSize: 13, fontWeight: "600" },
});
