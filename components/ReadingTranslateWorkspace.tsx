import React, { useState, useCallback, useEffect } from "react";
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
  Modal,
  Alert,
  useWindowDimensions,
} from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Speech from "expo-speech";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/src/context/ThemeContext";
import api from "../services/api";
import WordAnalysisModal from "./WordAnalysisModal";

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

interface ReadingVocabItem {
  term: string;
  pinyin: string;
  meaning: string;
  pos?: string;
  isRepeated: boolean;
  repeatCount: number;
  appearedIn: string[];
}

interface ReadingGrammarItem {
  pattern: string;
  meaning: string;
  explanation?: string;
  exampleInText?: string;
  exampleMeaning?: string;
}

interface ReadingPassageData {
  _id: string;
  title: string;
  content: string;
  pinyin: string;
  translation: string;
  vocabulary: ReadingVocabItem[];
  grammarPoints: ReadingGrammarItem[];
  createdAt?: string;
}

interface Props {
  showBackButton?: boolean;
}

export default function ReadingTranslateWorkspace({ showBackButton = false }: Props) {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWide = width >= 840;

  const routeParams = useLocalSearchParams<{
    prefillText?: string;
    prefillTitle?: string;
  }>();

  // Warm Paper & Ink palette (WCAG AA contrast for both light & dark)
  const palette = {
    bg: isDark ? "#161513" : "#F7F4EE",
    card: isDark ? "#1C1A18" : "#FDFBF7",
    raised: isDark ? "#262421" : "#EFE9DF",
    border: isDark ? "rgba(239, 233, 222, 0.1)" : "rgba(31, 27, 22, 0.1)",
    text: isDark ? "#EFE9DE" : "#1F1B16",
    secondary: isDark ? "#AAA398" : "#5E554A",
    muted: isDark ? "#8A847A" : "#7B7266",
    accent: isDark ? "#4CC38A" : "#0F766E",
    primaryBg: isDark ? "#EFE9DE" : "#0F766E",
    primaryInk: isDark ? "#161513" : "#FDFBF7",
    repeatRed: isDark ? "#E5484D" : "#B91C1C",
    repeatBg: isDark ? "rgba(229, 72, 77, 0.14)" : "rgba(185, 28, 28, 0.08)",
  };

  // Mặc định chia 3/7: Dịch nhanh (3) · Phân tích bài đọc (7)
  const [layoutMode, setLayoutMode] = useState<"split" | "translate" | "reading">("split");
  const [slowVoice, setSlowVoice] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // ===== KHUNG DỊCH (30%) =====
  const [translateInput, setTranslateInput] = useState("");
  const [direction, setDirection] = useState<"auto" | "zh-vi" | "vi-zh">("auto");
  const [translating, setTranslating] = useState(false);
  const [translateResult, setTranslateResult] = useState<TranslateResult | null>(null);
  const [savedKeywordsMap, setSavedKeywordsMap] = useState<Record<string, boolean>>({});

  // ===== KHUNG PHÂN TÍCH BÀI ĐỌC (70%) =====
  const [titleInput, setTitleInput] = useState("");
  const [contentInput, setContentInput] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [activePassage, setActivePassage] = useState<ReadingPassageData | null>(null);
  const [savedPassages, setSavedPassages] = useState<ReadingPassageData[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [showPinyin, setShowPinyin] = useState(true);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Chọn từ / ngữ pháp để lưu vào bài học
  const [selectedTerms, setSelectedTerms] = useState<Record<string, boolean>>({});
  const [selectedGrammars, setSelectedGrammars] = useState<Record<string, boolean>>({});
  const [saveDialogMode, setSaveDialogMode] = useState<"vocab" | "grammar" | null>(null);
  const [targetDeckTitle, setTargetDeckTitle] = useState("");
  const [existingDecks, setExistingDecks] = useState<Array<{ _id: string; title: string }>>([]);
  const [savingTarget, setSavingTarget] = useState(false);
  const [lastSavedGrammarTopic, setLastSavedGrammarTopic] = useState<{ topicId: string; title: string } | null>(null);

  // Xem phân tích 214 bộ thủ & mẹo nhớ (dùng chung)
  const [analysisWord, setAnalysisWord] = useState("");
  const [analysisDeckTitle, setAnalysisDeckTitle] = useState("Từ vựng đọc dịch");

  useEffect(() => {
    if (routeParams.prefillText) {
      setContentInput(String(routeParams.prefillText));
      if (routeParams.prefillTitle) {
        setTitleInput(String(routeParams.prefillTitle));
      }
      setActivePassage(null);
    }
  }, [routeParams.prefillText, routeParams.prefillTitle]);

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 2600);
  };

  const fetchSavedPassages = useCallback(async () => {
    setLoadingList(true);
    try {
      const [readingRes, listsRes] = await Promise.allSettled([
        api.get("/api/reading/list"),
        api.get("/api/vocab/lists"),
      ]);
      if (readingRes.status === "fulfilled" && readingRes.value.data?.success && Array.isArray(readingRes.value.data.data)) {
        setSavedPassages(readingRes.value.data.data);
      }
      if (listsRes.status === "fulfilled" && listsRes.value.data?.success && Array.isArray(listsRes.value.data.data)) {
        setExistingDecks(
          listsRes.value.data.data
            .filter((d: any) => d?._id && d?.title)
            .map((d: any) => ({ _id: d._id, title: d.title }))
        );
      }
    } catch {}
    finally {
      setLoadingList(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchSavedPassages();
    }, [fetchSavedPassages])
  );

  const readClipboard = async (): Promise<string> => {
    try {
      const txt = await Clipboard.getStringAsync();
      if (txt) return txt;
    } catch {}
    if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
      try {
        return await navigator.clipboard.readText();
      } catch {}
    }
    return "";
  };

  const handleCopy = async (text: string, label = "Đã sao chép") => {
    if (!text) return;
    try {
      await Clipboard.setStringAsync(text);
    } catch {
      if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(text);
        } catch {}
      }
    }
    showNotice(label);
  };

  const speak = (text: string, lang: "zh-TW" | "vi-VN" = "zh-TW") => {
    if (!text) return;
    Speech.stop();
    Speech.speak(text, { language: lang, rate: slowVoice ? 0.72 : 0.92 });
  };

  const buildVocabPayloadItem = (term: string, pinyin: string, meaning: string, pos = "noun") => {
    const cleanTerm = term.trim();
    const cleanPinyin = (pinyin || "").trim();
    const cleanMeaning = (meaning || "").trim();
    return {
      term: cleanTerm,
      reading: cleanPinyin || cleanTerm,
      meaning: cleanMeaning,
      def: JSON.stringify({
        reading: cleanPinyin || cleanTerm,
        pinyin: cleanPinyin,
        meaning: cleanMeaning,
        type: pos,
        level: "TOCFL",
      }),
    };
  };

  // ===== HÀNH ĐỘNG DỊCH =====
  const handleTranslate = async () => {
    const trimmed = translateInput.trim();
    if (!trimmed) {
      showNotice("Nhập hoặc dán nội dung cần dịch");
      return;
    }
    setTranslating(true);
    setSavedKeywordsMap({});
    try {
      const res = await api.post(
        "/api/audio/translate-text",
        { text: trimmed, direction },
        { timeout: 45000 }
      );
      if (res.data?.success && res.data?.data) {
        setTranslateResult(res.data.data);
      } else {
        showNotice(res.data?.error || "Không thể dịch lúc này");
      }
    } catch (e: any) {
      showNotice(e?.response?.data?.error || "Lỗi kết nối máy chủ");
    } finally {
      setTranslating(false);
    }
  };

  const handleSaveTranslatedWord = async (
    term: string,
    pinyin: string,
    meaning: string,
    deckName = "Từ vựng đọc dịch"
  ) => {
    const cleanTerm = term.trim();
    const cleanMeaning = (meaning || translateResult?.vietnameseText || "").trim();
    if (!cleanTerm) return;
    if (!cleanMeaning) {
      showNotice("Chưa có nghĩa tiếng Việt để lưu");
      return;
    }
    try {
      const res = await api.post("/api/vocab/save", {
        title: deckName,
        list: [buildVocabPayloadItem(cleanTerm, pinyin, cleanMeaning)],
      });
      if (res.data?.success) {
        setSavedKeywordsMap((prev) => ({ ...prev, [cleanTerm]: true }));
        fetchSavedPassages();
        showNotice(`Đã lưu "${cleanTerm}" (${cleanMeaning}) vào "${deckName}"`);
      }
    } catch {
      showNotice("Không thể lưu từ vựng");
    }
  };

  const handleSaveAllTranslatedKeywords = async () => {
    const kws = (translateResult?.keywords || []).filter((k) => k.term?.trim());
    if (kws.length === 0) return;
    try {
      const payload = kws.map((k) =>
        buildVocabPayloadItem(
          k.term,
          k.pinyin || "",
          k.meaning || translateResult?.vietnameseText || ""
        )
      );
      const res = await api.post("/api/vocab/save", {
        title: "Từ vựng đọc dịch",
        list: payload,
      });
      if (res.data?.success) {
        const nextMap: Record<string, boolean> = {};
        kws.forEach((k) => {
          nextMap[k.term.trim()] = true;
        });
        setSavedKeywordsMap((prev) => ({ ...prev, ...nextMap }));
        fetchSavedPassages();
        showNotice(`Đã lưu ${payload.length} từ kèm nghĩa Việt`);
      }
    } catch {
      showNotice("Không thể lưu danh sách từ");
    }
  };

  const handleSendToReading = (textToAnalyze?: string) => {
    const targetText = (textToAnalyze || translateResult?.chineseText || translateInput).trim();
    if (!targetText) return;
    setContentInput(targetText);
    if (layoutMode === "translate") setLayoutMode("split");
    handleAnalyze(targetText);
  };

  // ===== HÀNH ĐỘNG PHÂN TÍCH BÀI ĐỌC =====
  const handleAnalyze = async (overrideContent?: string) => {
    const clean = (overrideContent ?? contentInput).trim();
    if (!clean) {
      showNotice("Nhập hoặc dán nội dung bài đọc");
      return;
    }
    setAnalyzing(true);
    try {
      const res = await api.post(
        "/api/reading/analyze",
        { title: titleInput.trim(), content: clean },
        { timeout: 60000 }
      );
      if (res.data?.success && res.data?.data) {
        const doc: ReadingPassageData = res.data.data;
        setActivePassage(doc);
        setSelectedTerms({});
        setSelectedGrammars({});
        setLastSavedGrammarTopic(null);
        setTargetDeckTitle(doc.title || "Từ vựng bài đọc");
        fetchSavedPassages();
        showNotice(res.data.fromCache ? "Đã mở bài đọc đã lưu (0 token)" : "Đã phân tích và lưu bài đọc");
      } else {
        showNotice(res.data?.error || "Không thể phân tích bài đọc");
      }
    } catch (err: any) {
      showNotice(err?.response?.data?.error || "Lỗi kết nối máy chủ");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleOpenSavedPassage = async (item: ReadingPassageData) => {
    setShowHistoryModal(false);
    if (layoutMode === "translate") setLayoutMode("split");
    try {
      const res = await api.get(`/api/reading/${item._id}`);
      if (res.data?.success && res.data?.data) {
        const doc: ReadingPassageData = res.data.data;
        setActivePassage(doc);
        setTitleInput(doc.title);
        setContentInput(doc.content);
        setSelectedTerms({});
        setSelectedGrammars({});
        setLastSavedGrammarTopic(null);
        setTargetDeckTitle(doc.title || "Từ vựng bài đọc");
        return;
      }
    } catch {}
    setActivePassage(item);
  };

  const handleDeletePassage = async (id: string, title: string) => {
    const runDelete = async () => {
      try {
        await api.delete(`/api/reading/${id}`);
        setSavedPassages((prev) => prev.filter((p) => p._id !== id));
        if (activePassage?._id === id) setActivePassage(null);
        showNotice(`Đã xóa "${title}"`);
      } catch {
        showNotice("Không thể xóa bài đọc");
      }
    };

    if (Platform.OS === "web" && typeof window !== "undefined") {
      if (window.confirm(`Xóa bài đọc "${title}"?`)) await runDelete();
      return;
    }
    Alert.alert("Xóa bài đọc", `Bạn muốn xóa "${title}"?`, [
      { text: "Hủy", style: "cancel" },
      { text: "Xóa", style: "destructive", onPress: runDelete },
    ]);
  };

  const toggleSelectTerm = (term: string) => {
    setSelectedTerms((prev) => ({ ...prev, [term]: !prev[term] }));
  };

  const toggleSelectGrammar = (pattern: string) => {
    setSelectedGrammars((prev) => ({ ...prev, [pattern]: !prev[pattern] }));
  };

  const selectedVocabList = (activePassage?.vocabulary || []).filter((v) => selectedTerms[v.term]);
  const selectedGrammarList = (activePassage?.grammarPoints || []).filter((g) => selectedGrammars[g.pattern]);

  const mapReadingGrammarToPayload = (g: ReadingGrammarItem, topicName: string) => ({
    topicName,
    title: g.pattern,
    formula: g.pattern,
    meaning: g.explanation ? `${g.meaning}\n${g.explanation}` : g.meaning,
    examples: g.exampleInText ? [`${g.exampleInText} : ${g.exampleMeaning || ""}`] : [],
  });

  const handleSaveToTarget = async () => {
    const deckName = targetDeckTitle.trim() || activePassage?.title || "Từ vựng bài đọc";
    if (!saveDialogMode) return;

    setSavingTarget(true);
    try {
      if (saveDialogMode === "vocab") {
        const listToSave = selectedVocabList.length > 0 ? selectedVocabList : (activePassage?.vocabulary || []);
        if (listToSave.length === 0) return;

        const serialized = listToSave.map((v) =>
          buildVocabPayloadItem(v.term, v.pinyin || "", v.meaning || "", v.pos || "noun")
        );

        const res = await api.post("/api/vocab/save", {
          title: deckName,
          list: serialized,
        });
        if (res.data?.success) {
          setSaveDialogMode(null);
          setSelectedTerms({});
          fetchSavedPassages();
          showNotice(`Đã lưu ${listToSave.length} từ vào "${deckName}"`);
        }
      } else {
        const listToSave = selectedGrammarList.length > 0 ? selectedGrammarList : (activePassage?.grammarPoints || []);
        if (listToSave.length === 0) return;

        const res = await api.post("/api/vocab/add-grammar-upsert", {
          topicName: deckName,
          grammarPoints: listToSave.map((g) => mapReadingGrammarToPayload(g, deckName)),
        });
        if (res.data?.success) {
          setSaveDialogMode(null);
          setSelectedGrammars({});
          if (res.data?.topicId) {
            setLastSavedGrammarTopic({
              topicId: res.data.topicId,
              title: res.data.topicTitle || deckName,
            });
          }
          fetchSavedPassages();
          showNotice(`Đã lưu ${listToSave.length} ngữ pháp vào "${deckName}"`);
        }
      }
    } catch {
      showNotice(saveDialogMode === "vocab" ? "Không thể lưu từ vựng" : "Không thể lưu ngữ pháp");
    } finally {
      setSavingTarget(false);
    }
  };

  const saveSingleWordQuick = async (v: ReadingVocabItem) => {
    const deckName = activePassage?.title || "Từ vựng bài đọc";
    try {
      const res = await api.post("/api/vocab/save", {
        title: deckName,
        list: [buildVocabPayloadItem(v.term, v.pinyin || "", v.meaning || "", v.pos || "noun")],
      });
      if (res.data?.success) {
        showNotice(`Đã lưu "${v.term}" (${v.meaning}) vào "${deckName}"`);
      }
    } catch {
      showNotice("Không thể lưu từ");
    }
  };

  const saveSingleGrammarQuick = async (g: ReadingGrammarItem) => {
    const deckName = activePassage?.title || "Ngữ pháp bài đọc";
    try {
      const res = await api.post("/api/vocab/add-grammar-upsert", {
        topicName: deckName,
        grammarPoints: [mapReadingGrammarToPayload(g, deckName)],
      });
      if (res.data?.success) {
        if (res.data?.topicId) {
          setLastSavedGrammarTopic({
            topicId: res.data.topicId,
            title: res.data.topicTitle || deckName,
          });
        }
        showNotice(`Đã lưu "${g.pattern}" vào "${deckName}"`);
      }
    } catch {
      showNotice("Không thể lưu ngữ pháp");
    }
  };

  const openWordAnalysis = (word: string, deckTitle: string) => {
    setAnalysisDeckTitle(deckTitle);
    setAnalysisWord(word);
  };

  // Highlight chữ ký hiệu từ lặp: nét gạch chân + nền đỏ dịu ngay trên trang giấy bài đọc
  const renderHighlightedPassage = (passage: ReadingPassageData) => {
    const repeatedVocab = (passage.vocabulary || []).filter((v) => v.isRepeated && v.term);
    if (repeatedVocab.length === 0) {
      return <Text style={[styles.passageText, { color: palette.text }]}>{passage.content}</Text>;
    }

    const sortedTerms = Array.from(new Set(repeatedVocab.map((v) => v.term))).sort(
      (a, b) => b.length - a.length
    );
    const escaped = sortedTerms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const regex = new RegExp(`(${escaped.join("|")})`, "g");
    const parts = passage.content.split(regex);
    const vocabByTerm = new Map(repeatedVocab.map((v) => [v.term, v]));

    return (
      <Text style={[styles.passageText, { color: palette.text }]}>
        {parts.map((part, idx) => {
          const matched = vocabByTerm.get(part);
          if (matched) {
            return (
              <Text
                key={idx}
                onPress={() => openWordAnalysis(part, passage.title || "Từ vựng bài đọc")}
                style={{
                  color: palette.repeatRed,
                  backgroundColor: palette.repeatBg,
                  textDecorationLine: "underline",
                  fontWeight: "600",
                }}
              >
                {part}
              </Text>
            );
          }
          return <Text key={idx}>{part}</Text>;
        })}
      </Text>
    );
  };

  // ===== NỬA TRÁI / TRÊN (30%): DỊCH NHANH =====
  const renderTranslatePane = () => (
    <ScrollView
      style={styles.paneScroll}
      contentContainerStyle={styles.sidebarBody}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.paneHeaderRow}>
        <Text style={[styles.paneHeading, { color: palette.text }]}>Dịch nhanh</Text>
        <Text style={[styles.paneMeta, { color: palette.muted }]}>Trung ⇄ Việt</Text>
      </View>

      {/* Direction selector */}
      <View style={[styles.segmentedBox, { backgroundColor: palette.raised, borderColor: palette.border }]}>
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
                styles.segmentedItem,
                active && { backgroundColor: palette.card, borderColor: palette.border, borderWidth: 1 },
              ]}
            >
              <Text style={[styles.segmentedText, { color: active ? palette.text : palette.muted }]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Input box */}
      <View style={[styles.compactCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <View style={styles.rowBetween}>
          <Text style={[styles.fieldLabel, { color: palette.secondary }]}>Nội dung</Text>
          <View style={styles.rowGap8}>
            <TouchableOpacity
              onPress={async () => {
                const txt = await readClipboard();
                if (txt) {
                  setTranslateInput(txt);
                  showNotice("Đã dán vào khung dịch");
                }
              }}
              style={[styles.quietBtn, { backgroundColor: palette.raised, borderColor: palette.border }]}
            >
              <MaterialIcons name="content-paste" size={16} color={palette.secondary} />
              <Text style={[styles.quietBtnText, { color: palette.secondary }]}>Dán</Text>
            </TouchableOpacity>
            {!!translateInput && (
              <TouchableOpacity
                onPress={() => {
                  setTranslateInput("");
                  setTranslateResult(null);
                  Speech.stop();
                }}
                style={[styles.quietBtn, { backgroundColor: palette.raised, borderColor: palette.border }]}
              >
                <MaterialIcons name="close" size={16} color={palette.muted} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <TextInput
          multiline
          value={translateInput}
          onChangeText={setTranslateInput}
          placeholder="Nhập từ hoặc câu..."
          placeholderTextColor={palette.muted}
          style={[
            styles.inputArea,
            { minHeight: 88, color: palette.text, backgroundColor: palette.bg, borderColor: palette.border },
          ]}
        />

        <View style={styles.rowGap8}>
          <TouchableOpacity
            onPress={() => speak(translateInput, /[\u4e00-\u9fff]/.test(translateInput) ? "zh-TW" : "vi-VN")}
            disabled={!translateInput.trim()}
            style={[
              styles.quietBtn,
              {
                height: 40,
                paddingHorizontal: 12,
                backgroundColor: palette.raised,
                borderColor: palette.border,
                opacity: translateInput.trim() ? 1 : 0.4,
              },
            ]}
          >
            <MaterialIcons name="volume-up" size={16} color={palette.secondary} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleTranslate}
            disabled={translating || !translateInput.trim()}
            style={[
              styles.primaryBtn,
              {
                flex: 1,
                backgroundColor: translating || !translateInput.trim() ? palette.raised : palette.primaryBg,
                borderColor: palette.border,
              },
            ]}
          >
            {translating ? (
              <ActivityIndicator size="small" color={palette.primaryInk} />
            ) : (
              <Text
                style={[
                  styles.primaryBtnText,
                  { color: !translateInput.trim() ? palette.muted : palette.primaryInk },
                ]}
              >
                Dịch
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Kết quả dịch */}
      {translateResult && (
        <View style={styles.stack12}>
          <View style={[styles.compactCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <View style={[styles.rowBetween, { marginBottom: 8 }]}>
              <Text style={[styles.fieldLabel, { color: palette.secondary }]}>Bản dịch</Text>
              <View style={styles.rowGap8}>
                <TouchableOpacity
                  onPress={() => speak(translateResult.chineseText, "zh-TW")}
                  style={[styles.iconBox, { backgroundColor: palette.raised, borderColor: palette.border }]}
                >
                  <MaterialIcons name="volume-up" size={16} color={palette.secondary} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() =>
                    handleCopy(
                      `${translateResult.chineseText}\n${translateResult.pinyin}\n${translateResult.vietnameseText}`.trim()
                    )
                  }
                  style={[styles.iconBox, { backgroundColor: palette.raised, borderColor: palette.border }]}
                >
                  <MaterialIcons name="content-copy" size={16} color={palette.secondary} />
                </TouchableOpacity>
              </View>
            </View>

            <Text style={[styles.zhResult, { color: palette.text }]}>{translateResult.chineseText}</Text>
            {!!translateResult.pinyin && (
              <Text style={[styles.pinyinText, { color: palette.accent }]}>{translateResult.pinyin}</Text>
            )}
            <View style={[styles.divider, { backgroundColor: palette.border }]} />
            <Text style={[styles.viResult, { color: palette.text }]}>{translateResult.vietnameseText}</Text>

            <View style={[styles.rowGap8, { marginTop: 12, flexWrap: "wrap" }]}>
              <TouchableOpacity
                onPress={() =>
                  handleSaveTranslatedWord(
                    translateResult.chineseText,
                    translateResult.pinyin,
                    translateResult.vietnameseText
                  )
                }
                style={[styles.quietBtn, { backgroundColor: palette.raised, borderColor: palette.border }]}
              >
                <MaterialIcons
                  name={savedKeywordsMap[translateResult.chineseText] ? "check" : "bookmark-add"}
                  size={16}
                  color={palette.accent}
                />
                <Text style={[styles.quietBtnText, { color: palette.text }]}>
                  {savedKeywordsMap[translateResult.chineseText] ? "Đã lưu" : "Lưu"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleSendToReading(translateResult.chineseText)}
                style={[styles.quietBtn, { backgroundColor: palette.raised, borderColor: palette.border }]}
              >
                <MaterialIcons name="arrow-forward" size={16} color={palette.secondary} />
                <Text style={[styles.quietBtnText, { color: palette.text }]}>Sang bài đọc</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Tách từng câu (nếu nhiều câu) */}
          {Array.isArray(translateResult.sentences) && translateResult.sentences.length > 1 && (
            <View style={[styles.compactCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <Text style={[styles.fieldLabel, { color: palette.secondary, marginBottom: 8 }]}>
                Từng câu ({translateResult.sentences.length})
              </Text>
              {translateResult.sentences.map((s, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.listRow,
                    { borderTopColor: palette.border, borderTopWidth: idx === 0 ? 0 : 1 },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: palette.text }}>{s.text}</Text>
                    {!!s.pinyin && <Text style={{ fontSize: 12, color: palette.accent, marginTop: 2 }}>{s.pinyin}</Text>}
                    {!!s.meaningVi && (
                      <Text style={{ fontSize: 12, color: palette.secondary, marginTop: 2 }}>{s.meaningVi}</Text>
                    )}
                  </View>
                  <TouchableOpacity
                    onPress={() => handleSaveTranslatedWord(s.text, s.pinyin || "", s.meaningVi || "")}
                    style={[styles.iconBox, { backgroundColor: palette.raised, borderColor: palette.border }]}
                  >
                    <MaterialIcons
                      name={savedKeywordsMap[s.text] ? "check" : "bookmark-add"}
                      size={16}
                      color={palette.accent}
                    />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Từ khóa nổi bật (tối ưu cho cột 30%) */}
          {Array.isArray(translateResult.keywords) && translateResult.keywords.length > 0 && (
            <View style={[styles.compactCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <View style={[styles.rowBetween, { marginBottom: 8 }]}>
                <Text style={[styles.fieldLabel, { color: palette.secondary }]}>
                  Từ khóa ({translateResult.keywords.length})
                </Text>
                <TouchableOpacity
                  onPress={handleSaveAllTranslatedKeywords}
                  style={[styles.quietBtn, { backgroundColor: palette.raised, borderColor: palette.border }]}
                >
                  <MaterialIcons name="library-add" size={16} color={palette.accent} />
                  <Text style={[styles.quietBtnText, { color: palette.text }]}>Lưu hết</Text>
                </TouchableOpacity>
              </View>

              {translateResult.keywords.map((kw, idx) => {
                const displayMeaning = kw.meaning || translateResult.vietnameseText || "";
                const isSaved = !!savedKeywordsMap[kw.term];
                return (
                  <TouchableOpacity
                    key={idx}
                    activeOpacity={0.75}
                    onPress={() => openWordAnalysis(kw.term, "Từ vựng đọc dịch")}
                    style={[
                      styles.listRow,
                      { borderTopColor: palette.border, borderTopWidth: idx === 0 ? 0 : 1 },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
                        <Text style={{ fontSize: 16, fontWeight: "600", color: palette.text }}>{kw.term}</Text>
                        {!!kw.pinyin && (
                          <Text style={{ fontSize: 12, color: palette.accent, fontWeight: "500" }}>{kw.pinyin}</Text>
                        )}
                      </View>
                      <Text style={{ fontSize: 12, color: palette.secondary, marginTop: 2 }}>{displayMeaning}</Text>
                    </View>

                    <View style={styles.rowGap4}>
                      <TouchableOpacity
                        onPress={(e) => {
                          if ((e as any)?.stopPropagation) (e as any).stopPropagation();
                          openWordAnalysis(kw.term, "Từ vựng đọc dịch");
                        }}
                        style={[styles.iconBox, { backgroundColor: palette.raised, borderColor: palette.border }]}
                      >
                        <MaterialIcons name="extension" size={16} color={palette.secondary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={(e) => {
                          if ((e as any)?.stopPropagation) (e as any).stopPropagation();
                          handleSaveTranslatedWord(kw.term, kw.pinyin || "", displayMeaning);
                        }}
                        style={[
                          styles.iconBox,
                          {
                            backgroundColor: isSaved ? palette.accent : palette.raised,
                            borderColor: palette.border,
                          },
                        ]}
                      >
                        <MaterialIcons
                          name={isSaved ? "check" : "bookmark-add"}
                          size={16}
                          color={isSaved ? "#FFFFFF" : palette.accent}
                        />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );

  // ===== NỬA PHẢI / DƯỚI (70%): PHÂN TÍCH BÀI ĐỌC =====
  const renderReadingPane = () => (
    <ScrollView
      style={styles.paneScroll}
      contentContainerStyle={styles.mainBody}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.paneHeaderRow}>
        <Text style={[styles.paneHeading, { color: palette.text }]}>Phân tích bài đọc</Text>
        <Text style={[styles.paneMeta, { color: palette.muted }]}>
          Từ mới · Từ lặp · Ngữ pháp
        </Text>
      </View>

      {/* Form nhập bài đọc */}
      <View style={[styles.mainCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <TextInput
          value={titleInput}
          onChangeText={setTitleInput}
          placeholder="Tên bài đọc (tùy chọn)"
          placeholderTextColor={palette.muted}
          style={[
            styles.titleInput,
            { color: palette.text, backgroundColor: palette.bg, borderColor: palette.border },
          ]}
        />

        <View style={[styles.rowBetween, { marginBottom: 8 }]}>
          <Text style={[styles.fieldLabel, { color: palette.secondary }]}>Nội dung bài đọc</Text>
          <View style={styles.rowGap8}>
            <TouchableOpacity
              onPress={async () => {
                const txt = await readClipboard();
                if (txt) {
                  setContentInput(txt);
                  showNotice("Đã dán bài đọc");
                }
              }}
              style={[styles.quietBtn, { backgroundColor: palette.raised, borderColor: palette.border }]}
            >
              <MaterialIcons name="content-paste" size={16} color={palette.secondary} />
              <Text style={[styles.quietBtnText, { color: palette.secondary }]}>Dán</Text>
            </TouchableOpacity>
            {!!contentInput && (
              <TouchableOpacity
                onPress={() => {
                  setContentInput("");
                  setTitleInput("");
                  setActivePassage(null);
                }}
                style={[styles.quietBtn, { backgroundColor: palette.raised, borderColor: palette.border }]}
              >
                <MaterialIcons name="close" size={16} color={palette.muted} />
                <Text style={[styles.quietBtnText, { color: palette.muted }]}>Xóa</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <TextInput
          multiline
          value={contentInput}
          onChangeText={setContentInput}
          placeholder="Dán đoạn văn tiếng Trung vào đây hoặc bấm Sang bài đọc ở khung bên cạnh"
          placeholderTextColor={palette.muted}
          style={[
            styles.inputArea,
            { minHeight: 112, color: palette.text, backgroundColor: palette.bg, borderColor: palette.border },
          ]}
        />

        <TouchableOpacity
          onPress={() => handleAnalyze()}
          disabled={analyzing || !contentInput.trim()}
          style={[
            styles.primaryBtn,
            {
              backgroundColor: analyzing || !contentInput.trim() ? palette.raised : palette.primaryBg,
              borderColor: palette.border,
            },
          ]}
          activeOpacity={0.8}
        >
          {analyzing ? (
            <ActivityIndicator size="small" color={palette.primaryInk} />
          ) : (
            <>
              <MaterialIcons name="auto-stories" size={18} color={palette.primaryInk} />
              <Text
                style={[
                  styles.primaryBtnText,
                  { color: !contentInput.trim() ? palette.muted : palette.primaryInk },
                ]}
              >
                Phân tích bài đọc
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Kết quả phân tích (Moment chính của màn hình: Trang giấy bài đọc) */}
      {activePassage && (
        <View style={styles.stack16}>
          <View style={[styles.mainCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <View style={[styles.rowBetween, { marginBottom: 12, gap: 8 }]}>
              <Text style={[styles.passageTitle, { color: palette.text }]}>{activePassage.title}</Text>
              <View style={styles.rowGap8}>
                <TouchableOpacity
                  onPress={() => setShowPinyin(!showPinyin)}
                  style={[styles.quietBtn, { backgroundColor: palette.raised, borderColor: palette.border }]}
                >
                  <Text style={[styles.quietBtnText, { color: palette.secondary }]}>
                    {showPinyin ? "Ẩn Pinyin" : "Hiện Pinyin"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => speak(activePassage.content)}
                  style={[styles.quietBtn, { backgroundColor: palette.raised, borderColor: palette.border }]}
                >
                  <MaterialIcons name="volume-up" size={16} color={palette.accent} />
                  <Text style={[styles.quietBtnText, { color: palette.text }]}>Đọc</Text>
                </TouchableOpacity>
              </View>
            </View>

            {renderHighlightedPassage(activePassage)}

            {showPinyin && !!activePassage.pinyin && (
              <Text style={[styles.passagePinyin, { color: palette.secondary }]}>
                {activePassage.pinyin}
              </Text>
            )}

            {!!activePassage.translation && (
              <View style={[styles.translationBox, { backgroundColor: palette.raised }]}>
                <Text style={[styles.fieldLabel, { color: palette.muted, marginBottom: 4 }]}>Dịch nghĩa</Text>
                <Text style={[styles.translationText, { color: palette.text }]}>
                  {activePassage.translation}
                </Text>
              </View>
            )}
          </View>

          {/* Từ mới trong bài */}
          <View style={styles.stack12}>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={[styles.sectionTitle, { color: palette.text }]}>
                  Từ mới ({activePassage.vocabulary?.length || 0})
                </Text>
                <Text style={[styles.sectionHint, { color: palette.muted }]}>
                  Từ gạch đỏ lặp từ bài khác · Chạm để xem 214 bộ thủ
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setTargetDeckTitle(activePassage.title || "Từ vựng bài đọc");
                  setSaveDialogMode("vocab");
                }}
                style={[styles.primaryBtn, { height: 36, paddingHorizontal: 12, backgroundColor: palette.primaryBg }]}
              >
                <MaterialIcons name="style" size={16} color={palette.primaryInk} />
                <Text style={[styles.primaryBtnText, { fontSize: 12, color: palette.primaryInk }]}>
                  {selectedVocabList.length > 0 ? `Lưu ${selectedVocabList.length} từ` : "Lưu từ"}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.stack8}>
              {(activePassage.vocabulary || []).map((v, idx) => {
                const isSelected = !!selectedTerms[v.term];
                return (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => openWordAnalysis(v.term, activePassage.title || "Từ vựng bài đọc")}
                    activeOpacity={0.75}
                    style={[
                      styles.vocabCard,
                      {
                        backgroundColor: v.isRepeated ? palette.repeatBg : palette.card,
                        borderColor: v.isRepeated ? palette.repeatRed : palette.border,
                      },
                    ]}
                  >
                    <TouchableOpacity
                      onPress={(e) => {
                        if ((e as any)?.stopPropagation) (e as any).stopPropagation();
                        toggleSelectTerm(v.term);
                      }}
                      style={[
                        styles.checkbox,
                        {
                          borderColor: isSelected ? palette.accent : palette.border,
                          backgroundColor: isSelected ? palette.accent : "transparent",
                        },
                      ]}
                    >
                      {isSelected && <MaterialIcons name="check" size={14} color="#FFFFFF" />}
                    </TouchableOpacity>

                    <View style={{ flex: 1 }}>
                      <View style={styles.vocabTopRow}>
                        <Text
                          style={[
                            styles.vocabTerm,
                            { color: v.isRepeated ? palette.repeatRed : palette.text },
                          ]}
                        >
                          {v.term}
                        </Text>
                        {!!v.pinyin && (
                          <Text style={[styles.vocabPinyin, { color: palette.accent }]}>{v.pinyin}</Text>
                        )}
                        {!!v.pos && (
                          <Text style={[styles.vocabPos, { color: palette.muted }]}>{v.pos}</Text>
                        )}
                      </View>

                      <Text style={[styles.vocabMeaning, { color: palette.secondary }]}>{v.meaning}</Text>

                      {v.isRepeated && (
                        <Text style={[styles.repeatMetaText, { color: palette.repeatRed }]}>
                          Lặp {v.repeatCount} lần · {v.appearedIn?.slice(0, 2).join(", ")}
                        </Text>
                      )}
                    </View>

                    <View style={styles.rowGap8}>
                      <TouchableOpacity
                        onPress={(e) => {
                          if ((e as any)?.stopPropagation) (e as any).stopPropagation();
                          speak(v.term);
                        }}
                        style={[styles.iconBox, { backgroundColor: palette.raised, borderColor: palette.border }]}
                      >
                        <MaterialIcons name="volume-up" size={16} color={palette.secondary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={(e) => {
                          if ((e as any)?.stopPropagation) (e as any).stopPropagation();
                          saveSingleWordQuick(v);
                        }}
                        style={[styles.iconBox, { backgroundColor: palette.raised, borderColor: palette.border }]}
                      >
                        <MaterialIcons name="bookmark-add" size={16} color={palette.accent} />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Ngữ pháp trong bài */}
          {Array.isArray(activePassage.grammarPoints) && activePassage.grammarPoints.length > 0 && (
            <View style={styles.stack12}>
              <View style={styles.rowBetween}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={[styles.sectionTitle, { color: palette.text }]}>
                    Ngữ pháp trong bài ({activePassage.grammarPoints.length})
                  </Text>
                  <Text style={[styles.sectionHint, { color: palette.muted }]}>
                    Thêm vào bài học ngữ pháp để ôn tập
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setTargetDeckTitle(activePassage.title || "Ngữ pháp bài đọc");
                    setSaveDialogMode("grammar");
                  }}
                  style={[styles.primaryBtn, { height: 36, paddingHorizontal: 12, backgroundColor: palette.primaryBg }]}
                >
                  <MaterialIcons name="collections-bookmark" size={16} color={palette.primaryInk} />
                  <Text style={[styles.primaryBtnText, { fontSize: 12, color: palette.primaryInk }]}>
                    {selectedGrammarList.length > 0 ? `Lưu ${selectedGrammarList.length} mục` : "Lưu ngữ pháp"}
                  </Text>
                </TouchableOpacity>
              </View>

              {lastSavedGrammarTopic && (
                <TouchableOpacity
                  onPress={() =>
                    router.push(
                      `/study/grammar-viewer?topicId=${lastSavedGrammarTopic.topicId}&title=${encodeURIComponent(lastSavedGrammarTopic.title)}` as any
                    )
                  }
                  style={[
                    styles.compactCard,
                    styles.rowBetween,
                    { backgroundColor: palette.raised, borderColor: palette.border },
                  ]}
                  activeOpacity={0.75}
                >
                  <Text style={{ color: palette.accent, fontSize: 14, fontWeight: "600", flex: 1 }}>
                    Mở bài ngữ pháp "{lastSavedGrammarTopic.title}"
                  </Text>
                  <MaterialIcons name="arrow-forward" size={16} color={palette.accent} />
                </TouchableOpacity>
              )}

              <View style={styles.stack8}>
                {activePassage.grammarPoints.map((g, idx) => {
                  const isSelected = !!selectedGrammars[g.pattern];
                  return (
                    <View
                      key={idx}
                      style={[
                        styles.mainCard,
                        { backgroundColor: palette.card, borderColor: isSelected ? palette.accent : palette.border },
                      ]}
                    >
                      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                        <TouchableOpacity
                          onPress={() => toggleSelectGrammar(g.pattern)}
                          style={[
                            styles.checkbox,
                            {
                              marginTop: 4,
                              borderColor: isSelected ? palette.accent : palette.border,
                              backgroundColor: isSelected ? palette.accent : "transparent",
                            },
                          ]}
                        >
                          {isSelected && <MaterialIcons name="check" size={14} color="#FFFFFF" />}
                        </TouchableOpacity>

                        <View style={{ flex: 1 }}>
                          <Text style={[styles.grammarPattern, { color: palette.accent }]}>{g.pattern}</Text>
                          <Text style={[styles.grammarMeaning, { color: palette.text }]}>{g.meaning}</Text>
                          {!!g.explanation && (
                            <Text style={[styles.grammarExp, { color: palette.secondary }]}>{g.explanation}</Text>
                          )}
                          {!!g.exampleInText && (
                            <View style={[styles.exampleBox, { backgroundColor: palette.raised }]}>
                              <Text style={{ fontSize: 14, color: palette.text }}>{g.exampleInText}</Text>
                              {!!g.exampleMeaning && (
                                <Text style={{ fontSize: 12, color: palette.secondary, marginTop: 4 }}>
                                  {g.exampleMeaning}
                                </Text>
                              )}
                            </View>
                          )}
                        </View>

                        <TouchableOpacity
                          onPress={() => saveSingleGrammarQuick(g)}
                          style={[styles.iconBox, { backgroundColor: palette.raised, borderColor: palette.border }]}
                        >
                          <MaterialIcons name="bookmark-add" size={16} color={palette.accent} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );

  return (
    <View style={[styles.container, { backgroundColor: palette.bg }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* Header gọn & tĩnh theo chuẩn /unslop */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: palette.card,
            borderBottomColor: palette.border,
            paddingTop: insets.top > 0 ? insets.top + 8 : Platform.OS === "android" ? 40 : 12,
          },
        ]}
      >
        {showBackButton && (
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.iconBox, { backgroundColor: palette.raised, borderColor: palette.border, marginRight: 12 }]}
          >
            <MaterialIcons name="arrow-back" size={18} color={palette.text} />
          </TouchableOpacity>
        )}

        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: palette.text }]}>Đọc & Dịch</Text>
          <Text style={[styles.headerSub, { color: palette.muted }]} numberOfLines={1}>
            Dịch nhanh 3/7 và phân tích bài đọc
          </Text>
        </View>

        <View style={styles.rowGap8}>
          <TouchableOpacity
            onPress={() => setSlowVoice(!slowVoice)}
            style={[
              styles.quietBtn,
              {
                height: 36,
                backgroundColor: slowVoice ? palette.raised : "transparent",
                borderColor: palette.border,
              },
            ]}
          >
            <MaterialIcons name="speed" size={16} color={slowVoice ? palette.accent : palette.muted} />
            <Text style={[styles.quietBtnText, { color: slowVoice ? palette.text : palette.muted }]}>
              {slowVoice ? "0.75x" : "1.0x"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setShowHistoryModal(true)}
            style={[styles.quietBtn, { height: 36, backgroundColor: palette.raised, borderColor: palette.border }]}
            activeOpacity={0.7}
          >
            <MaterialIcons name="history" size={16} color={palette.secondary} />
            <Text style={[styles.quietBtnText, { color: palette.text, fontVariant: ["tabular-nums"] }]}>
              {savedPassages.length}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Thanh chọn bố cục */}
      <View style={[styles.toolbarBar, { backgroundColor: palette.card, borderBottomColor: palette.border }]}>
        <View style={[styles.segmentedBox, { backgroundColor: palette.raised, borderColor: palette.border }]}>
          {(
            [
              { key: "split", label: "Chia 3/7", icon: "vertical-split" },
              { key: "translate", label: "Dịch nhanh", icon: "translate" },
              { key: "reading", label: "Bài đọc", icon: "menu-book" },
            ] as const
          ).map((tab) => {
            const active = layoutMode === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setLayoutMode(tab.key)}
                style={[
                  styles.segmentedItem,
                  { flexDirection: "row", gap: 6 },
                  active && { backgroundColor: palette.card, borderColor: palette.border, borderWidth: 1 },
                ]}
              >
                <MaterialIcons name={tab.icon} size={16} color={active ? palette.accent : palette.muted} />
                <Text style={[styles.segmentedText, { color: active ? palette.text : palette.muted }]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* CHIA 3 / 7: Dịch (flex: 3) · Phân tích bài đọc (flex: 7) */}
      {layoutMode === "split" ? (
        <View style={[styles.splitContainer, { flexDirection: isWide ? "row" : "column" }]}>
          <View
            style={[
              styles.splitTranslatePane,
              isWide
                ? { borderRightWidth: 1, borderRightColor: palette.border }
                : { borderBottomWidth: 1, borderBottomColor: palette.border },
            ]}
          >
            {renderTranslatePane()}
          </View>
          <View style={styles.splitReadingPane}>{renderReadingPane()}</View>
        </View>
      ) : layoutMode === "translate" ? (
        <View style={{ flex: 1 }}>{renderTranslatePane()}</View>
      ) : (
        <View style={{ flex: 1 }}>{renderReadingPane()}</View>
      )}

      {/* Modal bài đọc đã lưu */}
      <Modal visible={showHistoryModal} animationType="slide" onRequestClose={() => setShowHistoryModal(false)}>
        <View style={[styles.container, { backgroundColor: palette.bg }]}>
          <View
            style={[
              styles.header,
              {
                backgroundColor: palette.card,
                borderBottomColor: palette.border,
                paddingTop: insets.top > 0 ? insets.top + 8 : Platform.OS === "android" ? 40 : 16,
              },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.headerTitle, { color: palette.text }]}>Bài đọc đã lưu</Text>
              <Text style={[styles.headerSub, { color: palette.muted }]}>
                Mở lại từ MongoDB · 0 token
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowHistoryModal(false)}
              style={[styles.iconBox, { backgroundColor: palette.raised, borderColor: palette.border }]}
            >
              <MaterialIcons name="close" size={18} color={palette.text} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
            {loadingList ? (
              <ActivityIndicator size="large" color={palette.accent} style={{ marginTop: 32 }} />
            ) : savedPassages.length === 0 ? (
              <Text style={{ color: palette.muted, textAlign: "center", marginTop: 40 }}>
                Chưa có bài đọc nào được lưu
              </Text>
            ) : (
              savedPassages.map((p) => (
                <TouchableOpacity
                  key={p._id}
                  onPress={() => handleOpenSavedPassage(p)}
                  style={[styles.mainCard, { backgroundColor: palette.card, borderColor: palette.border }]}
                >
                  <View style={styles.rowBetween}>
                    <Text style={[styles.passageTitle, { color: palette.text, flex: 1 }]}>{p.title}</Text>
                    <TouchableOpacity
                      onPress={(e) => {
                        if ((e as any)?.stopPropagation) (e as any).stopPropagation();
                        handleDeletePassage(p._id, p.title);
                      }}
                      style={[styles.iconBox, { backgroundColor: palette.raised, borderColor: palette.border }]}
                    >
                      <MaterialIcons name="delete-outline" size={16} color={palette.repeatRed} />
                    </TouchableOpacity>
                  </View>
                  <Text style={{ color: palette.secondary, fontSize: 14, marginTop: 8 }} numberOfLines={2}>
                    {p.content}
                  </Text>
                  <Text
                    style={{
                      color: palette.muted,
                      fontSize: 12,
                      marginTop: 8,
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    {p.vocabulary?.length || 0} từ mới · {p.grammarPoints?.length || 0} ngữ pháp
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Modal chọn tên bài lưu Từ vựng / Ngữ pháp */}
      <Modal visible={!!saveDialogMode} transparent animationType="fade" onRequestClose={() => setSaveDialogMode(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.saveDialog, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Text style={[styles.headerTitle, { color: palette.text }]}>
              {saveDialogMode === "grammar" ? "Lưu vào bài học ngữ pháp" : "Lưu vào Flashcard"}
            </Text>
            <Text style={{ fontSize: 14, color: palette.secondary, marginTop: 4, marginBottom: 12 }}>
              {saveDialogMode === "grammar"
                ? `Lưu ${selectedGrammarList.length > 0 ? selectedGrammarList.length : (activePassage?.grammarPoints?.length || 0)} cấu trúc ngữ pháp`
                : `Lưu ${selectedVocabList.length > 0 ? selectedVocabList.length : (activePassage?.vocabulary?.length || 0)} từ kèm nghĩa tiếng Việt`}
            </Text>
            <TextInput
              value={targetDeckTitle}
              onChangeText={setTargetDeckTitle}
              placeholder={saveDialogMode === "grammar" ? "Tên bài học ngữ pháp" : "Tên bài học Flashcard"}
              placeholderTextColor={palette.muted}
              style={[
                styles.titleInput,
                { color: palette.text, backgroundColor: palette.bg, borderColor: palette.border },
              ]}
            />
            {existingDecks.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                <View style={styles.rowGap8}>
                  {existingDecks.slice(0, 12).map((d) => {
                    const active = targetDeckTitle.trim().toLowerCase() === d.title.trim().toLowerCase();
                    return (
                      <TouchableOpacity
                        key={d._id}
                        onPress={() => setTargetDeckTitle(d.title)}
                        style={[
                          styles.quietBtn,
                          {
                            borderColor: active ? palette.accent : palette.border,
                            backgroundColor: active ? palette.raised : "transparent",
                          },
                        ]}
                      >
                        <Text style={[styles.quietBtnText, { color: active ? palette.accent : palette.secondary }]}>
                          {d.title}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            )}
            <View style={styles.rowGap8}>
              <TouchableOpacity
                onPress={() => setSaveDialogMode(null)}
                style={[
                  styles.dialogBtn,
                  { backgroundColor: palette.raised, borderColor: palette.border, borderWidth: 1 },
                ]}
              >
                <Text style={{ color: palette.text, fontWeight: "500", fontSize: 14 }}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveToTarget}
                disabled={savingTarget}
                style={[styles.dialogBtn, { backgroundColor: palette.primaryBg }]}
              >
                {savingTarget ? (
                  <ActivityIndicator size="small" color={palette.primaryInk} />
                ) : (
                  <Text style={{ color: palette.primaryInk, fontWeight: "600", fontSize: 14 }}>
                    {saveDialogMode === "grammar" ? "Lưu ngữ pháp" : "Lưu Flashcard"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal 214 bộ thủ dùng chung */}
      <WordAnalysisModal
        visible={!!analysisWord}
        word={analysisWord}
        defaultDeckTitle={analysisDeckTitle}
        onClose={() => setAnalysisWord("")}
      />

      {notice && (
        <View style={[styles.toast, { backgroundColor: isDark ? "#EFE9DE" : "#1F1B16" }]}>
          <MaterialIcons name="check-circle" size={16} color={isDark ? "#0F766E" : "#4CC38A"} />
          <Text style={[styles.toastText, { color: isDark ? "#161513" : "#FDFBF7" }]}>{notice}</Text>
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
  headerTitle: { fontSize: 18, fontWeight: "600" },
  headerSub: { fontSize: 12, marginTop: 2 },
  toolbarBar: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  segmentedBox: {
    flexDirection: "row",
    padding: 4,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
  },
  segmentedItem: {
    flex: 1,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentedText: { fontSize: 12, fontWeight: "500" },
  splitContainer: { flex: 1 },
  // 3/7 proportion split
  splitTranslatePane: { flex: 3, minHeight: 0 },
  splitReadingPane: { flex: 7, minHeight: 0 },
  paneScroll: { flex: 1 },
  sidebarBody: { padding: 16, paddingBottom: 64, gap: 12 },
  mainBody: { padding: 20, paddingBottom: 64, gap: 16 },
  paneHeaderRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  paneHeading: { fontSize: 16, fontWeight: "600" },
  paneMeta: { fontSize: 12, fontWeight: "400" },
  compactCard: { borderRadius: 12, borderWidth: 1, padding: 16 },
  mainCard: { borderRadius: 16, borderWidth: 1, padding: 20 },
  titleInput: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 40,
    fontSize: 14,
    marginBottom: 12,
  },
  inputArea: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
    fontSize: 14,
    textAlignVertical: "top",
    marginBottom: 12,
  },
  fieldLabel: { fontSize: 12, fontWeight: "500" },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowGap4: { flexDirection: "row", alignItems: "center", gap: 4 },
  rowGap8: { flexDirection: "row", alignItems: "center", gap: 8 },
  stack8: { gap: 8 },
  stack12: { gap: 12 },
  stack16: { gap: 16 },
  quietBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  quietBtnText: { fontSize: 12, fontWeight: "500" },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "transparent",
  },
  primaryBtnText: { fontSize: 14, fontWeight: "600" },
  zhResult: { fontSize: 18, fontWeight: "600", lineHeight: 28 },
  pinyinText: { fontSize: 14, marginTop: 4, fontWeight: "500" },
  divider: { height: 1, marginVertical: 12 },
  viResult: { fontSize: 14, lineHeight: 20 },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    gap: 8,
  },
  passageTitle: { fontSize: 16, fontWeight: "600", flex: 1 },
  passageText: { fontSize: 18, lineHeight: 28 },
  passagePinyin: { fontSize: 14, lineHeight: 20, marginTop: 12 },
  translationBox: { marginTop: 12, padding: 12, borderRadius: 12 },
  translationText: { fontSize: 14, lineHeight: 20 },
  sectionTitle: { fontSize: 16, fontWeight: "600" },
  sectionHint: { fontSize: 12, marginTop: 2 },
  vocabCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  vocabTopRow: { flexDirection: "row", alignItems: "baseline", gap: 8, flexWrap: "wrap" },
  vocabTerm: { fontSize: 18, fontWeight: "600" },
  vocabPinyin: { fontSize: 12, fontWeight: "500" },
  vocabPos: { fontSize: 12 },
  vocabMeaning: { fontSize: 14, marginTop: 4 },
  repeatMetaText: { fontSize: 12, fontWeight: "500", marginTop: 4, fontVariant: ["tabular-nums"] },
  grammarPattern: { fontSize: 16, fontWeight: "600" },
  grammarMeaning: { fontSize: 14, marginTop: 4, fontWeight: "500" },
  grammarExp: { fontSize: 14, marginTop: 4, lineHeight: 20 },
  exampleBox: { marginTop: 8, padding: 12, borderRadius: 8 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 20,
  },
  saveDialog: { borderRadius: 16, borderWidth: 1, padding: 20 },
  dialogBtn: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  toast: {
    position: "absolute",
    bottom: 24,
    alignSelf: "center",
    paddingHorizontal: 16,
    height: 40,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    zIndex: 999,
  },
  toastText: { fontSize: 14, fontWeight: "500" },
});
