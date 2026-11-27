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
    view?: string;
  }>();

  // Warm paper palette theo chuẩn /unslop
  const palette = {
    bg: isDark ? "#161513" : "#F7F4EE",
    card: isDark ? "#1C1A18" : "#FDFBF7",
    raised: isDark ? "#262421" : "#EFE9DF",
    border: isDark ? "rgba(239, 233, 222, 0.1)" : "rgba(31, 27, 22, 0.1)",
    text: isDark ? "#EFE9DE" : "#1F1B16",
    secondary: isDark ? "#AAA398" : "#5E554A",
    muted: isDark ? "#8A847A" : "#7B7266",
    accent: isDark ? "#4CC38A" : "#0F766E",
    repeatRed: isDark ? "#E5484D" : "#DC2626",
    repeatBg: isDark ? "rgba(229, 72, 77, 0.14)" : "rgba(220, 38, 38, 0.08)",
  };

  // Layout chia 5/5 mặc định trên cả Desktop (trái/phải) và Mobile (trên/dưới)
  const [layoutMode, setLayoutMode] = useState<"split" | "translate" | "reading">("split");
  const [slowVoice, setSlowVoice] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // ===== TRẠNG THÁI DỊCH NHANH (NỬA TRÁI / TRÊN) =====
  const [translateInput, setTranslateInput] = useState("");
  const [direction, setDirection] = useState<"auto" | "zh-vi" | "vi-zh">("auto");
  const [translating, setTranslating] = useState(false);
  const [translateResult, setTranslateResult] = useState<TranslateResult | null>(null);
  const [savedKeywordsMap, setSavedKeywordsMap] = useState<Record<string, boolean>>({});

  // ===== TRẠNG THÁI PHÂN TÍCH BÀI ĐỌC (NỬA PHẢI / DƯỚI) =====
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

  // Xem phân tích 214 bộ thủ & AI (dùng chung cho cả 2 nửa màn hình)
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

  // Helper chuẩn hóa đóng gói từ kèm đầy đủ nghĩa tiếng Việt khi lưu vào Flashcard
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

  // ===== HÀNH ĐỘNG DỊCH NHANH =====
  const handleTranslate = async () => {
    const trimmed = translateInput.trim();
    if (!trimmed) {
      showNotice("Vui lòng nhập hoặc dán nội dung cần dịch");
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
        showNotice(`Đã lưu ${payload.length} từ kèm nghĩa Việt vào "Từ vựng đọc dịch"`);
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

  // ===== HÀNH ĐỘNG BÀI ĐỌC =====
  const handleAnalyze = async (overrideContent?: string) => {
    const clean = (overrideContent ?? contentInput).trim();
    if (!clean) {
      showNotice("Vui lòng nhập hoặc dán nội dung bài đọc");
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
          showNotice(`Đã lưu ${listToSave.length} từ vào Flashcard "${deckName}"`);
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
          showNotice(`Đã lưu ${listToSave.length} ngữ pháp vào bài "${deckName}"`);
        }
      }
    } catch {
      showNotice(saveDialogMode === "vocab" ? "Không thể lưu vào Flashcard" : "Không thể lưu ngữ pháp");
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
        showNotice(`Đã thêm "${g.pattern}" vào Ngữ pháp "${deckName}"`);
      }
    } catch {
      showNotice("Không thể lưu ngữ pháp");
    }
  };

  const openWordAnalysis = (word: string, deckTitle: string) => {
    setAnalysisDeckTitle(deckTitle);
    setAnalysisWord(word);
  };

  // Tô đỏ các từ lặp lại ngay trong đoạn văn bài đọc
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

  // ===== KHUNG NỬA 1: DỊCH NHANH =====
  const renderTranslatePane = () => (
    <ScrollView
      style={styles.paneScroll}
      contentContainerStyle={styles.paneBody}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.paneTitleRow}>
        <MaterialIcons name="translate" size={17} color={palette.accent} />
        <Text style={[styles.paneTitle, { color: palette.text }]}>Dịch nhanh Trung ⇄ Việt</Text>
      </View>

      {/* Direction Switcher */}
      <View style={[styles.dirRow, { backgroundColor: palette.card, borderColor: palette.border }]}>
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
              style={[styles.dirTab, active && { backgroundColor: palette.accent }]}
            >
              <Text style={{ fontSize: 12, fontWeight: "600", color: active ? "#FFFFFF" : palette.muted }}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Input Box */}
      <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <View style={styles.inputHeader}>
          <Text style={[styles.label, { color: palette.secondary }]}>Nội dung dịch</Text>
          <View style={{ flexDirection: "row", gap: 6 }}>
            <TouchableOpacity
              onPress={async () => {
                const txt = await readClipboard();
                if (txt) {
                  setTranslateInput(txt);
                  showNotice("Đã dán vào khung dịch");
                }
              }}
              style={[styles.miniBtn, { borderColor: palette.border }]}
            >
              <MaterialIcons name="content-paste" size={13} color={palette.text} />
              <Text style={[styles.miniBtnText, { color: palette.text }]}>Dán</Text>
            </TouchableOpacity>
            {!!translateInput && (
              <TouchableOpacity
                onPress={() => {
                  setTranslateInput("");
                  setTranslateResult(null);
                  Speech.stop();
                }}
                style={[styles.miniBtn, { borderColor: palette.border }]}
              >
                <MaterialIcons name="close" size={13} color={palette.muted} />
                <Text style={[styles.miniBtnText, { color: palette.muted }]}>Xóa</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <TextInput
          multiline
          value={translateInput}
          onChangeText={setTranslateInput}
          placeholder="Nhập hoặc dán từ, câu hoặc đoạn văn..."
          placeholderTextColor={palette.muted}
          style={[styles.contentArea, { minHeight: 90, color: palette.text, backgroundColor: palette.bg, borderColor: palette.border }]}
        />

        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity
            onPress={() => speak(translateInput, /[\u4e00-\u9fff]/.test(translateInput) ? "zh-TW" : "vi-VN")}
            disabled={!translateInput.trim()}
            style={[styles.miniBtn, { borderColor: palette.border, paddingHorizontal: 12, opacity: translateInput.trim() ? 1 : 0.4 }]}
          >
            <MaterialIcons name="volume-up" size={16} color={palette.text} />
            <Text style={[styles.miniBtnText, { color: palette.text }]}>Đọc</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleTranslate}
            disabled={translating || !translateInput.trim()}
            style={[
              styles.primaryBtn,
              { flex: 1, backgroundColor: translating || !translateInput.trim() ? palette.border : palette.accent },
            ]}
          >
            {translating ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <MaterialIcons name="translate" size={17} color="#FFFFFF" />
                <Text style={styles.primaryBtnText}>Dịch & Tách từ</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Kết quả dịch */}
      {translateResult && (
        <View style={{ gap: 12 }}>
          <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.accent }]}>
            <View style={[styles.inputHeader, { flexWrap: "wrap", gap: 6 }]}>
              <Text style={[styles.label, { color: palette.accent }]}>Kết quả dịch</Text>
              <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                <TouchableOpacity
                  onPress={() => speak(translateResult.chineseText, "zh-TW")}
                  style={[styles.miniBtn, { borderColor: palette.border }]}
                >
                  <MaterialIcons name="volume-up" size={14} color={palette.accent} />
                  <Text style={[styles.miniBtnText, { color: palette.accent }]}>Đọc</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() =>
                    handleSaveTranslatedWord(
                      translateResult.chineseText,
                      translateResult.pinyin,
                      translateResult.vietnameseText
                    )
                  }
                  style={[styles.miniBtn, { borderColor: palette.accent, backgroundColor: palette.raised }]}
                >
                  <MaterialIcons
                    name={savedKeywordsMap[translateResult.chineseText] ? "bookmark-added" : "bookmark-add"}
                    size={14}
                    color={palette.accent}
                  />
                  <Text style={[styles.miniBtnText, { color: palette.accent }]}>
                    {savedKeywordsMap[translateResult.chineseText] ? "Đã lưu" : "Lưu từ"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleSendToReading(translateResult.chineseText)}
                  style={[styles.miniBtn, { borderColor: palette.border, backgroundColor: palette.raised }]}
                >
                  <MaterialIcons name="arrow-forward" size={14} color={palette.text} />
                  <Text style={[styles.miniBtnText, { color: palette.text }]}>Sang Bài đọc</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() =>
                    handleCopy(
                      `${translateResult.chineseText}\n${translateResult.pinyin}\n${translateResult.vietnameseText}`.trim()
                    )
                  }
                  style={[styles.miniBtn, { borderColor: palette.border }]}
                >
                  <MaterialIcons name="content-copy" size={13} color={palette.muted} />
                </TouchableOpacity>
              </View>
            </View>

            <Text style={[styles.zhResult, { color: palette.text }]}>{translateResult.chineseText}</Text>
            {!!translateResult.pinyin && (
              <Text style={[styles.pinyinResult, { color: palette.accent }]}>{translateResult.pinyin}</Text>
            )}
            <View style={[styles.divider, { backgroundColor: palette.border }]} />
            <Text style={[styles.viResult, { color: palette.text }]}>{translateResult.vietnameseText}</Text>
          </View>

          {/* Tách từng câu */}
          {Array.isArray(translateResult.sentences) && translateResult.sentences.length > 1 && (
            <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <Text style={[styles.label, { color: palette.secondary, marginBottom: 6 }]}>
                Tách từng câu ({translateResult.sentences.length})
              </Text>
              {translateResult.sentences.map((s, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.sentenceItem,
                    { borderTopColor: palette.border, borderTopWidth: idx === 0 ? 0 : 1 },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: "600", color: palette.text }}>{s.text}</Text>
                    {!!s.pinyin && <Text style={{ fontSize: 12.5, color: palette.accent, marginTop: 2 }}>{s.pinyin}</Text>}
                    {!!s.meaningVi && <Text style={{ fontSize: 13, color: palette.secondary, marginTop: 2 }}>{s.meaningVi}</Text>}
                  </View>
                  <View style={{ flexDirection: "row", gap: 6, marginLeft: 8 }}>
                    <TouchableOpacity
                      onPress={() => speak(s.text, "zh-TW")}
                      style={[styles.miniIcon, { borderColor: palette.border }]}
                    >
                      <MaterialIcons name="volume-up" size={15} color={palette.accent} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleSaveTranslatedWord(s.text, s.pinyin || "", s.meaningVi || "")}
                      style={[styles.miniIcon, { borderColor: palette.border }]}
                    >
                      <MaterialIcons
                        name={savedKeywordsMap[s.text] ? "bookmark-added" : "bookmark-add"}
                        size={15}
                        color={palette.accent}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Từ vựng nổi bật (luôn lưu kèm nghĩa tiếng Việt) */}
          {Array.isArray(translateResult.keywords) && translateResult.keywords.length > 0 && (
            <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <View style={[styles.inputHeader, { marginBottom: 4 }]}>
                <Text style={[styles.label, { color: palette.secondary }]}>
                  Từ vựng nổi bật ({translateResult.keywords.length})
                </Text>
                <TouchableOpacity
                  onPress={handleSaveAllTranslatedKeywords}
                  style={[styles.miniBtn, { borderColor: palette.accent, backgroundColor: palette.raised }]}
                >
                  <MaterialIcons name="library-add" size={14} color={palette.accent} />
                  <Text style={[styles.miniBtnText, { color: palette.accent }]}>Lưu tất cả</Text>
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
                      styles.kwRow,
                      { borderTopColor: palette.border, borderTopWidth: idx === 0 ? 0 : 1, gap: 6 },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: "600", color: palette.text }}>
                        {kw.term}{" "}
                        {!!kw.pinyin && (
                          <Text style={{ fontSize: 13, color: palette.accent, fontWeight: "500" }}>
                            {kw.pinyin}
                          </Text>
                        )}
                      </Text>
                      <Text style={{ fontSize: 13, color: palette.secondary }}>{displayMeaning}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={(e) => {
                        if ((e as any)?.stopPropagation) (e as any).stopPropagation();
                        openWordAnalysis(kw.term, "Từ vựng đọc dịch");
                      }}
                      style={[styles.miniBtn, { borderColor: palette.border }]}
                    >
                      <MaterialIcons name="extension" size={14} color={palette.text} />
                      <Text style={[styles.miniBtnText, { color: palette.text }]}>Bộ thủ</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={(e) => {
                        if ((e as any)?.stopPropagation) (e as any).stopPropagation();
                        handleSaveTranslatedWord(kw.term, kw.pinyin || "", displayMeaning);
                      }}
                      style={[
                        styles.miniBtn,
                        {
                          borderColor: palette.accent,
                          backgroundColor: isSaved ? palette.accent : "transparent",
                        },
                      ]}
                    >
                      <MaterialIcons
                        name={isSaved ? "check" : "add"}
                        size={14}
                        color={isSaved ? "#FFFFFF" : palette.accent}
                      />
                      <Text style={[styles.miniBtnText, { color: isSaved ? "#FFFFFF" : palette.accent }]}>
                        {isSaved ? "Đã lưu" : "Lưu từ"}
                      </Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );

  // ===== KHUNG NỬA 2: PHÂN TÍCH BÀI ĐỌC =====
  const renderReadingPane = () => (
    <ScrollView
      style={styles.paneScroll}
      contentContainerStyle={styles.paneBody}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.paneTitleRow}>
        <MaterialIcons name="auto-stories" size={17} color={palette.accent} />
        <Text style={[styles.paneTitle, { color: palette.text }]}>Phân tích Bài đọc AI</Text>
      </View>

      {/* Form nhập bài đọc */}
      <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <TextInput
          value={titleInput}
          onChangeText={setTitleInput}
          placeholder="Tên bài đọc (tùy chọn)"
          placeholderTextColor={palette.muted}
          style={[styles.titleInput, { color: palette.text, backgroundColor: palette.bg, borderColor: palette.border }]}
        />

        <View style={styles.inputHeader}>
          <Text style={[styles.label, { color: palette.secondary }]}>Nội dung bài đọc</Text>
          <View style={{ flexDirection: "row", gap: 6 }}>
            <TouchableOpacity
              onPress={async () => {
                const txt = await readClipboard();
                if (txt) {
                  setContentInput(txt);
                  showNotice("Đã dán bài đọc");
                }
              }}
              style={[styles.miniBtn, { borderColor: palette.border }]}
            >
              <MaterialIcons name="content-paste" size={13} color={palette.text} />
              <Text style={[styles.miniBtnText, { color: palette.text }]}>Dán</Text>
            </TouchableOpacity>
            {!!contentInput && (
              <TouchableOpacity
                onPress={() => {
                  setContentInput("");
                  setTitleInput("");
                  setActivePassage(null);
                }}
                style={[styles.miniBtn, { borderColor: palette.border }]}
              >
                <MaterialIcons name="close" size={13} color={palette.muted} />
                <Text style={[styles.miniBtnText, { color: palette.muted }]}>Xóa</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <TextInput
          multiline
          value={contentInput}
          onChangeText={setContentInput}
          placeholder="Dán đoạn văn tiếng Trung vào đây hoặc bấm 'Sang Bài đọc' bên khung Dịch..."
          placeholderTextColor={palette.muted}
          style={[styles.contentArea, { color: palette.text, backgroundColor: palette.bg, borderColor: palette.border }]}
        />

        <TouchableOpacity
          onPress={() => handleAnalyze()}
          disabled={analyzing || !contentInput.trim()}
          style={[
            styles.primaryBtn,
            { backgroundColor: analyzing || !contentInput.trim() ? palette.border : palette.accent },
          ]}
          activeOpacity={0.8}
        >
          {analyzing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <MaterialIcons name="auto-stories" size={17} color="#FFFFFF" />
              <Text style={styles.primaryBtnText}>Phân tích & Lưu bài đọc</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Kết quả phân tích bài đọc */}
      {activePassage && (
        <View style={{ gap: 14 }}>
          <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <View style={styles.passageHeader}>
              <Text style={[styles.passageTitle, { color: palette.text }]}>{activePassage.title}</Text>
              <View style={{ flexDirection: "row", gap: 6 }}>
                <TouchableOpacity
                  onPress={() => setShowPinyin(!showPinyin)}
                  style={[styles.miniBtn, { borderColor: palette.border }]}
                >
                  <Text style={[styles.miniBtnText, { color: palette.secondary }]}>
                    {showPinyin ? "Ẩn Pinyin" : "Hiện Pinyin"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => speak(activePassage.content)}
                  style={[styles.miniBtn, { borderColor: palette.border }]}
                >
                  <MaterialIcons name="volume-up" size={15} color={palette.accent} />
                  <Text style={[styles.miniBtnText, { color: palette.accent }]}>Đọc bài</Text>
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
                <Text style={[styles.label, { color: palette.muted, marginBottom: 4 }]}>Dịch nghĩa</Text>
                <Text style={[styles.translationText, { color: palette.text }]}>
                  {activePassage.translation}
                </Text>
              </View>
            )}
          </View>

          {/* Từ mới trong bài */}
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeader}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={[styles.sectionTitle, { color: palette.text }]}>
                  Từ mới ({activePassage.vocabulary?.length || 0})
                </Text>
                <Text style={[styles.sectionHint, { color: palette.muted }]}>
                  Từ đỏ đã lặp lại · Chạm từ để xem bộ thủ
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setTargetDeckTitle(activePassage.title || "Từ vựng bài đọc");
                  setSaveDialogMode("vocab");
                }}
                style={[styles.saveFlashcardBtn, { backgroundColor: palette.accent }]}
              >
                <MaterialIcons name="style" size={15} color="#FFFFFF" />
                <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "600" }}>
                  {selectedVocabList.length > 0
                    ? `Lưu ${selectedVocabList.length} từ`
                    : "Lưu tất cả"}
                </Text>
              </TouchableOpacity>
            </View>

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
                      <Text style={[styles.repeatBadgeText, { color: palette.repeatRed }]}>
                        Lặp {v.repeatCount} lần · {v.appearedIn?.slice(0, 2).join(", ")}
                      </Text>
                    )}
                  </View>

                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <TouchableOpacity
                      onPress={(e) => {
                        if ((e as any)?.stopPropagation) (e as any).stopPropagation();
                        speak(v.term);
                      }}
                      style={[styles.miniIcon, { borderColor: palette.border }]}
                    >
                      <MaterialIcons name="volume-up" size={16} color={palette.muted} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={(e) => {
                        if ((e as any)?.stopPropagation) (e as any).stopPropagation();
                        saveSingleWordQuick(v);
                      }}
                      style={[styles.miniIcon, { borderColor: palette.border }]}
                    >
                      <MaterialIcons name="bookmark-add" size={16} color={palette.accent} />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Ngữ pháp trong bài */}
          {Array.isArray(activePassage.grammarPoints) && activePassage.grammarPoints.length > 0 && (
            <View style={styles.sectionBlock}>
              <View style={styles.sectionHeader}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={[styles.sectionTitle, { color: palette.text }]}>
                    Ngữ pháp trong bài ({activePassage.grammarPoints.length})
                  </Text>
                  <Text style={[styles.sectionHint, { color: palette.muted }]}>
                    Thêm vào bài học ngữ pháp để ôn tập & ghép câu
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setTargetDeckTitle(activePassage.title || "Ngữ pháp bài đọc");
                    setSaveDialogMode("grammar");
                  }}
                  style={[styles.saveFlashcardBtn, { backgroundColor: palette.accent }]}
                >
                  <MaterialIcons name="collections-bookmark" size={15} color="#FFFFFF" />
                  <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "600" }}>
                    {selectedGrammarList.length > 0
                      ? `Lưu ${selectedGrammarList.length} ngữ pháp`
                      : "Lưu ngữ pháp"}
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
                    styles.card,
                    {
                      backgroundColor: palette.raised,
                      borderColor: palette.accent,
                      paddingVertical: 10,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                    },
                  ]}
                  activeOpacity={0.75}
                >
                  <Text style={{ color: palette.accent, fontSize: 13, fontWeight: "600", flex: 1 }}>
                    Mở bài học ngữ pháp "{lastSavedGrammarTopic.title}"
                  </Text>
                  <MaterialIcons name="arrow-forward" size={18} color={palette.accent} />
                </TouchableOpacity>
              )}

              {activePassage.grammarPoints.map((g, idx) => {
                const isSelected = !!selectedGrammars[g.pattern];
                return (
                  <View
                    key={idx}
                    style={[styles.card, { backgroundColor: palette.card, borderColor: isSelected ? palette.accent : palette.border }]}
                  >
                    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                      <TouchableOpacity
                        onPress={() => toggleSelectGrammar(g.pattern)}
                        style={[
                          styles.checkbox,
                          {
                            marginTop: 2,
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
                              <Text style={{ fontSize: 13, color: palette.secondary, marginTop: 2 }}>
                                {g.exampleMeaning}
                              </Text>
                            )}
                          </View>
                        )}
                      </View>

                      <TouchableOpacity
                        onPress={() => saveSingleGrammarQuick(g)}
                        style={[styles.miniIcon, { borderColor: palette.border }]}
                      >
                        <MaterialIcons name="bookmark-add" size={16} color={palette.accent} />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );

  return (
    <View style={[styles.container, { backgroundColor: palette.bg }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* Header chung */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: palette.card,
            borderBottomColor: palette.border,
            paddingTop: insets.top > 0 ? insets.top + 8 : Platform.OS === "android" ? 40 : 14,
          },
        ]}
      >
        {showBackButton && (
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.miniIcon, { borderColor: palette.border, marginRight: 10, width: 34, height: 34 }]}
          >
            <MaterialIcons name="arrow-back" size={18} color={palette.text} />
          </TouchableOpacity>
        )}

        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: palette.text }]}>Đọc & Dịch · Bài đọc</Text>
          <Text style={[styles.headerSub, { color: palette.muted }]} numberOfLines={1}>
            Dịch nhanh 5/5 song song phân tích từ mới & ngữ pháp
          </Text>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <TouchableOpacity
            onPress={() => setSlowVoice(!slowVoice)}
            style={[
              styles.historyBtn,
              {
                backgroundColor: slowVoice ? palette.raised : "transparent",
                borderColor: slowVoice ? palette.accent : palette.border,
              },
            ]}
          >
            <MaterialIcons name="speed" size={15} color={slowVoice ? palette.accent : palette.muted} />
            <Text style={[styles.historyBtnText, { color: slowVoice ? palette.accent : palette.muted }]}>
              {slowVoice ? "0.75x" : "1.0x"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setShowHistoryModal(true)}
            style={[styles.historyBtn, { backgroundColor: palette.raised, borderColor: palette.border }]}
            activeOpacity={0.7}
          >
            <MaterialIcons name="history" size={16} color={palette.text} />
            <Text style={[styles.historyBtnText, { color: palette.text }]}>
              ({savedPassages.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Thanh chọn chế độ 5/5 hoặc phóng to từng khung */}
      <View style={[styles.splitToolbar, { backgroundColor: palette.card, borderBottomColor: palette.border }]}>
        {(
          [
            { key: "split", label: "Chia 5/5", icon: "vertical-split" },
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
                styles.splitTabBtn,
                active && { backgroundColor: palette.accent },
              ]}
            >
              <MaterialIcons name={tab.icon} size={15} color={active ? "#FFFFFF" : palette.secondary} />
              <Text style={{ fontSize: 12, fontWeight: "600", color: active ? "#FFFFFF" : palette.secondary }}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* NỘI DUNG CHÍNH: CHIA 5/5 */}
      {layoutMode === "split" ? (
        <View style={[styles.splitContainer, { flexDirection: isWide ? "row" : "column" }]}>
          <View
            style={[
              styles.splitHalf,
              isWide
                ? { borderRightWidth: 1, borderRightColor: palette.border }
                : { borderBottomWidth: 1, borderBottomColor: palette.border },
            ]}
          >
            {renderTranslatePane()}
          </View>
          <View style={styles.splitHalf}>{renderReadingPane()}</View>
        </View>
      ) : layoutMode === "translate" ? (
        <View style={{ flex: 1 }}>{renderTranslatePane()}</View>
      ) : (
        <View style={{ flex: 1 }}>{renderReadingPane()}</View>
      )}

      {/* Modal danh sách bài đọc đã lưu */}
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
                Mở lại từ MongoDB · không tốn token AI
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowHistoryModal(false)}
              style={[styles.miniIcon, { borderColor: palette.border, width: 36, height: 36 }]}
            >
              <MaterialIcons name="close" size={20} color={palette.text} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
            {loadingList ? (
              <ActivityIndicator size="large" color={palette.accent} style={{ marginTop: 32 }} />
            ) : savedPassages.length === 0 ? (
              <Text style={{ color: palette.muted, textAlign: "center", marginTop: 40 }}>
                Chưa có bài đọc nào được lưu.
              </Text>
            ) : (
              savedPassages.map((p) => (
                <TouchableOpacity
                  key={p._id}
                  onPress={() => handleOpenSavedPassage(p)}
                  style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text style={[styles.passageTitle, { color: palette.text, flex: 1 }]}>{p.title}</Text>
                    <TouchableOpacity
                      onPress={(e) => {
                        if ((e as any)?.stopPropagation) (e as any).stopPropagation();
                        handleDeletePassage(p._id, p.title);
                      }}
                      style={[styles.miniIcon, { borderColor: palette.border }]}
                    >
                      <MaterialIcons name="delete-outline" size={18} color={palette.repeatRed} />
                    </TouchableOpacity>
                  </View>
                  <Text style={{ color: palette.secondary, fontSize: 13, marginTop: 6 }} numberOfLines={2}>
                    {p.content}
                  </Text>
                  <Text style={{ color: palette.muted, fontSize: 12, marginTop: 8 }}>
                    {p.vocabulary?.length || 0} từ mới · {p.grammarPoints?.length || 0} ngữ pháp
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Modal chọn tên bài để lưu Từ vựng hoặc Ngữ pháp */}
      <Modal visible={!!saveDialogMode} transparent animationType="fade" onRequestClose={() => setSaveDialogMode(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.saveDialog, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Text style={[styles.headerTitle, { color: palette.text }]}>
              {saveDialogMode === "grammar" ? "Lưu vào Bài học Ngữ pháp" : "Lưu vào Flashcard"}
            </Text>
            <Text style={{ fontSize: 13, color: palette.secondary, marginTop: 4, marginBottom: 12 }}>
              {saveDialogMode === "grammar"
                ? `Sẽ lưu ${selectedGrammarList.length > 0 ? selectedGrammarList.length : (activePassage?.grammarPoints?.length || 0)} cấu trúc ngữ pháp. Trùng tên bài cũ sẽ tự gộp chung.`
                : `Sẽ lưu ${selectedVocabList.length > 0 ? selectedVocabList.length : (activePassage?.vocabulary?.length || 0)} từ kèm nghĩa tiếng Việt. Trùng tên bài cũ sẽ tự gộp chung.`}
            </Text>
            <TextInput
              value={targetDeckTitle}
              onChangeText={setTargetDeckTitle}
              placeholder={saveDialogMode === "grammar" ? "Nhập tên bài học ngữ pháp" : "Nhập tên bài học Flashcard"}
              placeholderTextColor={palette.muted}
              style={[styles.titleInput, { color: palette.text, backgroundColor: palette.bg, borderColor: palette.border }]}
            />
            {existingDecks.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  {existingDecks.slice(0, 12).map((d) => {
                    const active = targetDeckTitle.trim().toLowerCase() === d.title.trim().toLowerCase();
                    return (
                      <TouchableOpacity
                        key={d._id}
                        onPress={() => setTargetDeckTitle(d.title)}
                        style={[
                          styles.miniBtn,
                          {
                            borderColor: active ? palette.accent : palette.border,
                            backgroundColor: active ? palette.raised : "transparent",
                          },
                        ]}
                      >
                        <Text style={[styles.miniBtnText, { color: active ? palette.accent : palette.secondary }]}>
                          {d.title}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            )}
            <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
              <TouchableOpacity
                onPress={() => setSaveDialogMode(null)}
                style={[styles.dialogBtn, { backgroundColor: palette.raised, borderColor: palette.border, borderWidth: 1 }]}
              >
                <Text style={{ color: palette.text, fontWeight: "500" }}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveToTarget}
                disabled={savingTarget}
                style={[styles.dialogBtn, { backgroundColor: palette.accent }]}
              >
                {savingTarget ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={{ color: "#FFFFFF", fontWeight: "600" }}>
                    {saveDialogMode === "grammar" ? "Lưu Ngữ pháp" : "Lưu Flashcard"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal phân tích bộ thủ 214 + câu chuyện AI */}
      <WordAnalysisModal
        visible={!!analysisWord}
        word={analysisWord}
        defaultDeckTitle={analysisDeckTitle}
        onClose={() => setAnalysisWord("")}
      />

      {notice && (
        <View style={styles.toast}>
          <MaterialIcons name="check-circle" size={16} color="#4CC38A" />
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
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 17, fontWeight: "600" },
  headerSub: { fontSize: 11.5, marginTop: 2 },
  historyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  historyBtnText: { fontSize: 12, fontWeight: "600" },
  splitToolbar: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
    borderBottomWidth: 1,
  },
  splitTabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 7,
    borderRadius: 9,
  },
  splitContainer: { flex: 1 },
  splitHalf: { flex: 1, minHeight: 0 },
  paneScroll: { flex: 1 },
  paneBody: { padding: 14, paddingBottom: 60, gap: 12 },
  paneTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  paneTitle: { fontSize: 14, fontWeight: "600" },
  dirRow: {
    flexDirection: "row",
    padding: 4,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
  },
  dirTab: { flex: 1, paddingVertical: 6, borderRadius: 7, alignItems: "center" },
  card: { borderRadius: 14, borderWidth: 1, padding: 14 },
  titleInput: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    marginBottom: 10,
  },
  inputHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  label: { fontSize: 12, fontWeight: "600" },
  miniBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  miniBtnText: { fontSize: 12, fontWeight: "500" },
  contentArea: {
    minHeight: 105,
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    fontSize: 14.5,
    textAlignVertical: "top",
    marginBottom: 10,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 11,
    borderRadius: 10,
  },
  primaryBtnText: { color: "#FFFFFF", fontSize: 13.5, fontWeight: "600" },
  zhResult: { fontSize: 19, fontWeight: "600", lineHeight: 28 },
  pinyinResult: { fontSize: 13.5, marginTop: 4 },
  divider: { height: 1, marginVertical: 10 },
  viResult: { fontSize: 14.5, lineHeight: 21 },
  sentenceItem: { flexDirection: "row", alignItems: "center", paddingVertical: 8 },
  kwRow: { flexDirection: "row", alignItems: "center", paddingVertical: 9 },
  passageHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    gap: 8,
  },
  passageTitle: { fontSize: 15.5, fontWeight: "600", flex: 1 },
  passageText: { fontSize: 16, lineHeight: 26 },
  passagePinyin: { fontSize: 13, lineHeight: 19, marginTop: 8 },
  translationBox: { marginTop: 10, padding: 10, borderRadius: 10 },
  translationText: { fontSize: 13.5, lineHeight: 20 },
  sectionBlock: { gap: 8 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  sectionTitle: { fontSize: 14.5, fontWeight: "600" },
  sectionHint: { fontSize: 11.5, marginTop: 2 },
  saveFlashcardBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 9,
  },
  vocabCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 11,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  checkbox: {
    width: 21,
    height: 21,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  vocabTopRow: { flexDirection: "row", alignItems: "baseline", gap: 8, flexWrap: "wrap" },
  vocabTerm: { fontSize: 17, fontWeight: "600" },
  vocabPinyin: { fontSize: 12.5, fontWeight: "500" },
  vocabPos: { fontSize: 11.5 },
  vocabMeaning: { fontSize: 13, marginTop: 2 },
  repeatBadgeText: { fontSize: 11.5, fontWeight: "600", marginTop: 4 },
  miniIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  grammarPattern: { fontSize: 14.5, fontWeight: "600" },
  grammarMeaning: { fontSize: 13.5, marginTop: 4, fontWeight: "500" },
  grammarExp: { fontSize: 12.5, marginTop: 4, lineHeight: 18 },
  exampleBox: { marginTop: 8, padding: 9, borderRadius: 8 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 20,
  },
  saveDialog: { borderRadius: 16, borderWidth: 1, padding: 20 },
  dialogBtn: { flex: 1, paddingVertical: 11, borderRadius: 10, alignItems: "center" },
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
    zIndex: 999,
  },
  toastText: { color: "#FFFFFF", fontSize: 13, fontWeight: "600" },
});
