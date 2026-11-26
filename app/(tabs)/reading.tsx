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
} from "react-native";
import { useFocusEffect, Stack, useLocalSearchParams, useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Speech from "expo-speech";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/src/context/ThemeContext";
import api from "../../services/api";
import WordAnalysisModal from "../../components/WordAnalysisModal";

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

export default function ReadingScreen() {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const routeParams = useLocalSearchParams<{ prefillText?: string; prefillTitle?: string }>();

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

  // Xem phân tích 214 bộ thủ & AI
  const [analysisWord, setAnalysisWord] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

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
    } catch (e) {}
    finally {
      setLoadingList(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchSavedPassages();
    }, [fetchSavedPassages])
  );

  const handlePaste = async () => {
    try {
      const txt = await Clipboard.getStringAsync();
      if (txt) {
        setContentInput(txt);
        showNotice("Đã dán bài đọc");
        return;
      }
    } catch (e) {}
    if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
      try {
        const txt = await navigator.clipboard.readText();
        if (txt) {
          setContentInput(txt);
          showNotice("Đã dán bài đọc");
        }
      } catch (e) {}
    }
  };

  const handleAnalyze = async () => {
    const clean = contentInput.trim();
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
    } catch (e) {}
    setActivePassage(item);
  };

  const handleDeletePassage = async (id: string, title: string) => {
    const runDelete = async () => {
      try {
        await api.delete(`/api/reading/${id}`);
        setSavedPassages((prev) => prev.filter((p) => p._id !== id));
        if (activePassage?._id === id) setActivePassage(null);
        showNotice(`Đã xóa "${title}"`);
      } catch (e) {
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
    examples: g.exampleInText
      ? [`${g.exampleInText} : ${g.exampleMeaning || ""}`]
      : [],
  });

  const handleSaveToTarget = async () => {
    const deckName = targetDeckTitle.trim() || activePassage?.title || "Từ vựng bài đọc";
    if (!saveDialogMode) return;

    setSavingTarget(true);
    try {
      if (saveDialogMode === "vocab") {
        const listToSave = selectedVocabList.length > 0 ? selectedVocabList : (activePassage?.vocabulary || []);
        if (listToSave.length === 0) return;

        const serialized = listToSave.map((v) => ({
          term: v.term,
          def: JSON.stringify({
            reading: v.pinyin || v.term,
            pinyin: v.pinyin || "",
            meaning: v.meaning,
            type: v.pos || "noun",
            level: "TOCFL",
          }),
        }));

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
    } catch (e) {
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
        list: [
          {
            term: v.term,
            def: JSON.stringify({
              reading: v.pinyin || v.term,
              pinyin: v.pinyin || "",
              meaning: v.meaning,
              type: v.pos || "noun",
              level: "TOCFL",
            }),
          },
        ],
      });
      if (res.data?.success) {
        showNotice(`Đã lưu "${v.term}" vào Flashcard "${deckName}"`);
      }
    } catch (e) {
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
    } catch (e) {
      showNotice("Không thể lưu ngữ pháp");
    }
  };

  const speak = (text: string) => {
    if (!text) return;
    Speech.stop();
    Speech.speak(text, { language: "zh-TW", rate: 0.88 });
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
                onPress={() => setAnalysisWord(part)}
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

  return (
    <View style={[styles.container, { backgroundColor: palette.bg }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* Header */}
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
          <Text style={[styles.headerTitle, { color: palette.text }]}>Bài đọc</Text>
          <Text style={[styles.headerSub, { color: palette.muted }]}>
            Phân tích từ mới, từ lặp lại & ngữ pháp
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => setShowHistoryModal(true)}
          style={[styles.historyBtn, { backgroundColor: palette.raised, borderColor: palette.border }]}
          activeOpacity={0.7}
        >
          <MaterialIcons name="history" size={18} color={palette.text} />
          <Text style={[styles.historyBtnText, { color: palette.text }]}>
            Đã lưu ({savedPassages.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
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
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity onPress={handlePaste} style={[styles.miniBtn, { borderColor: palette.border }]}>
                <MaterialIcons name="content-paste" size={14} color={palette.text} />
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
                  <MaterialIcons name="close" size={14} color={palette.muted} />
                  <Text style={[styles.miniBtnText, { color: palette.muted }]}>Xóa</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <TextInput
            multiline
            value={contentInput}
            onChangeText={setContentInput}
            placeholder="Dán đoạn văn hoặc bài đọc tiếng Trung vào đây..."
            placeholderTextColor={palette.muted}
            style={[styles.contentArea, { color: palette.text, backgroundColor: palette.bg, borderColor: palette.border }]}
          />

          <TouchableOpacity
            onPress={handleAnalyze}
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
                <MaterialIcons name="auto-stories" size={18} color="#FFFFFF" />
                <Text style={styles.primaryBtnText}>Phân tích & Lưu bài đọc</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Kết quả phân tích */}
        {activePassage && (
          <View style={{ gap: 16 }}>
            {/* Nội dung bài đọc + Dịch */}
            <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <View style={styles.passageHeader}>
                <Text style={[styles.passageTitle, { color: palette.text }]}>{activePassage.title}</Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
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
                <View>
                  <Text style={[styles.sectionTitle, { color: palette.text }]}>
                    Từ mới ({activePassage.vocabulary?.length || 0})
                  </Text>
                  <Text style={[styles.sectionHint, { color: palette.muted }]}>
                    Từ màu đỏ đã lặp lại ở bài khác · Chạm từ để xem bộ thủ
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
                    onPress={() => setAnalysisWord(v.term)}
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
                : `Sẽ lưu ${selectedVocabList.length > 0 ? selectedVocabList.length : (activePassage?.vocabulary?.length || 0)} từ. Trùng tên bài cũ sẽ tự gộp chung.`}
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
        defaultDeckTitle={activePassage?.title || "Từ vựng bài đọc"}
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
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, fontWeight: "600" },
  headerSub: { fontSize: 12, marginTop: 2 },
  historyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  historyBtnText: { fontSize: 12, fontWeight: "600" },
  scrollBody: { padding: 16, paddingBottom: 80, gap: 16 },
  card: { borderRadius: 14, borderWidth: 1, padding: 16 },
  titleInput: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 12,
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
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  miniBtnText: { fontSize: 12, fontWeight: "500" },
  contentArea: {
    minHeight: 120,
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    fontSize: 15,
    textAlignVertical: "top",
    marginBottom: 12,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
  },
  primaryBtnText: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" },
  passageHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    gap: 8,
  },
  passageTitle: { fontSize: 16, fontWeight: "600", flex: 1 },
  passageText: { fontSize: 17, lineHeight: 28 },
  passagePinyin: { fontSize: 13.5, lineHeight: 20, marginTop: 10 },
  translationBox: { marginTop: 12, padding: 12, borderRadius: 10 },
  translationText: { fontSize: 14, lineHeight: 22 },
  sectionBlock: { gap: 8 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  sectionTitle: { fontSize: 15, fontWeight: "600" },
  sectionHint: { fontSize: 12, marginTop: 2 },
  saveFlashcardBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  vocabCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  vocabTopRow: { flexDirection: "row", alignItems: "baseline", gap: 8, flexWrap: "wrap" },
  vocabTerm: { fontSize: 18, fontWeight: "600" },
  vocabPinyin: { fontSize: 13, fontWeight: "500" },
  vocabPos: { fontSize: 12 },
  vocabMeaning: { fontSize: 13.5, marginTop: 2 },
  repeatBadgeText: { fontSize: 12, fontWeight: "600", marginTop: 4 },
  miniIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  grammarPattern: { fontSize: 15, fontWeight: "600" },
  grammarMeaning: { fontSize: 14, marginTop: 4, fontWeight: "500" },
  grammarExp: { fontSize: 13, marginTop: 4, lineHeight: 19 },
  exampleBox: { marginTop: 8, padding: 10, borderRadius: 8 },
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
  },
  toastText: { color: "#FFFFFF", fontSize: 13, fontWeight: "600" },
});
