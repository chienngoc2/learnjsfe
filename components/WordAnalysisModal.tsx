import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import * as Speech from "expo-speech";
import { useTheme } from "@/src/context/ThemeContext";
import api from "../services/api";

interface RadicalBlock {
  radical: string;
  radicalId?: number;
  hanViet?: string;
  pinyin?: string;
  meaning?: string;
  color: string;
}

interface CharBreakdown {
  char: string;
  pinyin?: string;
  hanViet?: string;
  meaning?: string;
  radicals: RadicalBlock[];
  story?: string;
}

interface WordAnalysisData {
  word: string;
  pinyin?: string;
  hanviet?: string;
  meaning?: string;
  synonyms?: Array<{ word: string; pinyin?: string; meaning: string; difference?: string }>;
  usages?: Array<{
    pattern: string;
    meaning: string;
    exampleCn: string;
    examplePinyin: string;
    exampleVn: string;
  }>;
  characters?: CharBreakdown[];
  combinedStory?: string;
  fromCache?: boolean;
}

interface Props {
  visible: boolean;
  word: string;
  onClose: () => void;
}

export default function WordAnalysisModal({ visible, word, onClose }: Props) {
  const { isDark } = useTheme();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<WordAnalysisData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Palette trung tính ấm theo chuẩn /unslop (Warm ramp)
  const palette = {
    bg: isDark ? "#161513" : "#F7F4EE",
    card: isDark ? "#1C1A18" : "#FDFBF7",
    raised: isDark ? "#262421" : "#EFE9DF",
    border: isDark ? "rgba(239, 233, 222, 0.1)" : "rgba(31, 27, 22, 0.1)",
    text: isDark ? "#EFE9DE" : "#1F1B16",
    secondary: isDark ? "#AAA398" : "#5E554A",
    muted: isDark ? "#8A847A" : "#7B7266",
    accent: isDark ? "#4CC38A" : "#0F766E",
  };

  useEffect(() => {
    if (!visible || !word) return;
    let active = true;
    setLoading(true);
    setErrorMsg(null);
    setData(null);

    api
      .get(`/api/kanji/word-analysis?word=${encodeURIComponent(word)}`)
      .then((res) => {
        if (!active) return;
        if (res.data?.success && res.data?.data) {
          setData(res.data.data);
        } else {
          setErrorMsg("Không có dữ liệu phân tích cho từ này.");
        }
      })
      .catch((err: any) => {
        if (!active) return;
        setErrorMsg(err?.response?.data?.error || "Không thể kết nối máy chủ phân tích.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [visible, word]);

  const speak = (text: string) => {
    if (!text) return;
    Speech.stop();
    Speech.speak(text, { language: "zh-TW", rate: 0.85 });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: palette.bg, borderColor: palette.border }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: palette.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.headerTitle, { color: palette.text }]}>Phân tích từ vựng</Text>
              <Text style={[styles.headerMeta, { color: palette.muted }]}>
                {data?.fromCache ? "Đã lưu trên MongoDB · 0 token" : "Cấu tạo 214 bộ thủ & ngữ cảnh"}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: palette.raised, borderColor: palette.border }]}
              activeOpacity={0.7}
            >
              <MaterialIcons name="close" size={18} color={palette.text} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color={palette.accent} />
              <Text style={[styles.loadingText, { color: palette.secondary }]}>
                Đang tách bộ thủ & tổng hợp phân tích
              </Text>
            </View>
          ) : errorMsg ? (
            <View style={styles.centerBox}>
              <Text style={{ color: palette.secondary, fontSize: 14 }}>{errorMsg}</Text>
            </View>
          ) : data ? (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>
              {/* Word Hero */}
              <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
                <View style={styles.heroRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.heroWord, { color: palette.text }]}>{data.word}</Text>
                    <View style={styles.metaLine}>
                      {!!data.pinyin && (
                        <Text style={[styles.metaPinyin, { color: palette.accent }]}>{data.pinyin}</Text>
                      )}
                      {!!data.hanviet && (
                        <Text style={[styles.metaHanViet, { color: palette.muted }]}>
                          · {data.hanviet}
                        </Text>
                      )}
                    </View>
                    {!!data.meaning && (
                      <Text style={[styles.heroMeaning, { color: palette.secondary }]}>
                        {data.meaning}
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity
                    onPress={() => speak(data.word)}
                    style={[styles.speakBtn, { backgroundColor: palette.raised, borderColor: palette.border }]}
                    activeOpacity={0.7}
                  >
                    <MaterialIcons name="volume-up" size={20} color={palette.accent} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Radicals Breakdown per Character */}
              {(data.characters || []).length > 0 && (
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: palette.secondary }]}>
                    Cấu tạo 214 bộ thủ
                  </Text>
                  {(data.characters || []).map((ch, idx) => (
                    <View
                      key={idx}
                      style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}
                    >
                      <View style={styles.charTop}>
                        <Text style={[styles.charGlyph, { color: palette.text }]}>{ch.char}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.charSub, { color: palette.accent }]}>
                            {ch.pinyin || ""} {ch.hanViet ? `· ${ch.hanViet}` : ""}
                          </Text>
                          {!!ch.meaning && (
                            <Text style={[styles.charMean, { color: palette.secondary }]}>{ch.meaning}</Text>
                          )}
                        </View>
                        <TouchableOpacity
                          onPress={() => speak(ch.char)}
                          style={[styles.miniSpeak, { borderColor: palette.border }]}
                        >
                          <MaterialIcons name="volume-up" size={16} color={palette.muted} />
                        </TouchableOpacity>
                      </View>

                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
                        <View style={styles.radicalChain}>
                          {(ch.radicals || []).map((rad, rIdx) => (
                            <React.Fragment key={rIdx}>
                              <View
                                style={[
                                  styles.radicalBox,
                                  {
                                    borderColor: rad.color || palette.accent,
                                    backgroundColor: `${rad.color || palette.accent}14`,
                                  },
                                ]}
                              >
                                <Text style={[styles.radicalGlyph, { color: rad.color || palette.accent }]}>
                                  {rad.radical}
                                </Text>
                                {!!rad.hanViet && (
                                  <Text style={[styles.radicalHv, { color: palette.text }]}>{rad.hanViet}</Text>
                                )}
                                {!!rad.meaning && (
                                  <Text style={[styles.radicalMeaning, { color: palette.secondary }]} numberOfLines={2}>
                                    {rad.meaning}
                                  </Text>
                                )}
                              </View>

                              {rIdx < ch.radicals.length - 1 && (
                                <View style={styles.connectorWrap}>
                                  <View style={[styles.connectorLine, { backgroundColor: palette.border }]} />
                                  <View
                                    style={[
                                      styles.connectorDot,
                                      { backgroundColor: palette.raised, borderColor: palette.border },
                                    ]}
                                  >
                                    <Text style={{ fontSize: 12, fontWeight: "600", color: palette.muted }}>+</Text>
                                  </View>
                                  <View style={[styles.connectorLine, { backgroundColor: palette.border }]} />
                                </View>
                              )}
                            </React.Fragment>
                          ))}
                        </View>
                      </ScrollView>

                      {!!ch.story && (
                        <View style={[styles.storyBox, { backgroundColor: palette.raised, borderLeftColor: palette.accent }]}>
                          <Text style={[styles.storyLabel, { color: palette.accent }]}>Mẹo nhớ</Text>
                          <Text style={[styles.storyText, { color: palette.text }]}>{ch.story}</Text>
                        </View>
                      )}
                    </View>
                  ))}

                  {!!data.combinedStory && (data.characters || []).length > 1 && (
                    <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
                      <Text style={[styles.storyLabel, { color: palette.accent }]}>Liên kết cả từ</Text>
                      <Text style={[styles.storyText, { color: palette.text }]}>{data.combinedStory}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Usages */}
              {Array.isArray(data.usages) && data.usages.length > 0 && (
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: palette.secondary }]}>
                    Cách dùng phổ biến
                  </Text>
                  <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border, gap: 12 }]}>
                    {data.usages.map((u, i) => (
                      <View
                        key={i}
                        style={[i > 0 && { borderTopWidth: 1, borderTopColor: palette.border, paddingTop: 12 }]}
                      >
                        <Text style={[styles.usagePattern, { color: palette.accent }]}>{u.pattern}</Text>
                        <Text style={[styles.usageMeaning, { color: palette.secondary }]}>{u.meaning}</Text>
                        {!!u.exampleCn && (
                          <View style={[styles.exampleBox, { backgroundColor: palette.raised }]}>
                            <Text style={{ fontSize: 14, color: palette.text, fontWeight: "500" }}>
                              {u.exampleCn}
                            </Text>
                            {!!u.examplePinyin && (
                              <Text style={{ fontSize: 12, color: palette.muted, marginTop: 2 }}>
                                {u.examplePinyin}
                              </Text>
                            )}
                            {!!u.exampleVn && (
                              <Text style={{ fontSize: 13, color: palette.secondary, marginTop: 2 }}>
                                {u.exampleVn}
                              </Text>
                            )}
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Synonyms */}
              {Array.isArray(data.synonyms) && data.synonyms.length > 0 && (
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: palette.secondary }]}>
                    Từ đồng nghĩa & gần nghĩa
                  </Text>
                  <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border, gap: 12 }]}>
                    {data.synonyms.map((s, i) => (
                      <View
                        key={i}
                        style={[i > 0 && { borderTopWidth: 1, borderTopColor: palette.border, paddingTop: 12 }]}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <Text style={{ fontSize: 16, fontWeight: "600", color: palette.text }}>{s.word}</Text>
                          {!!s.pinyin && <Text style={{ fontSize: 13, color: palette.accent }}>{s.pinyin}</Text>}
                          <Text style={{ fontSize: 13, color: palette.secondary, flex: 1 }}>— {s.meaning}</Text>
                        </View>
                        {!!s.difference && (
                          <Text style={{ fontSize: 12.5, color: palette.muted, marginTop: 4 }}>{s.difference}</Text>
                        )}
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </ScrollView>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    maxHeight: "88%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 17, fontWeight: "600" },
  headerMeta: { fontSize: 12, marginTop: 2 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  centerBox: {
    paddingVertical: 48,
    alignItems: "center",
    gap: 12,
  },
  loadingText: { fontSize: 14 },
  scrollBody: { padding: 16, paddingBottom: 32, gap: 16 },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
  },
  heroRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  heroWord: { fontSize: 28, fontWeight: "600" },
  metaLine: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  metaPinyin: { fontSize: 14, fontWeight: "500" },
  metaHanViet: { fontSize: 13 },
  heroMeaning: { fontSize: 15, marginTop: 6, lineHeight: 22 },
  speakBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  section: { gap: 8 },
  sectionTitle: { fontSize: 13, fontWeight: "600", marginLeft: 4 },
  charTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  charGlyph: { fontSize: 28, fontWeight: "600" },
  charSub: { fontSize: 13, fontWeight: "500" },
  charMean: { fontSize: 13, marginTop: 2 },
  miniSpeak: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  radicalChain: { flexDirection: "row", alignItems: "center" },
  radicalBox: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "center",
    minWidth: 72,
  },
  radicalGlyph: { fontSize: 22, fontWeight: "600" },
  radicalHv: { fontSize: 12, fontWeight: "600", marginTop: 2 },
  radicalMeaning: { fontSize: 11, textAlign: "center", marginTop: 2 },
  connectorWrap: { flexDirection: "row", alignItems: "center", paddingHorizontal: 4 },
  connectorLine: { width: 8, height: 1.5 },
  connectorDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  storyBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    borderLeftWidth: 3,
  },
  storyLabel: { fontSize: 12, fontWeight: "600", marginBottom: 4 },
  storyText: { fontSize: 13.5, lineHeight: 20 },
  usagePattern: { fontSize: 14, fontWeight: "600" },
  usageMeaning: { fontSize: 13, marginTop: 2 },
  exampleBox: { marginTop: 8, padding: 10, borderRadius: 8 },
});
