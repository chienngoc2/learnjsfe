import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  Pressable,
  Platform,
  Dimensions,
  TouchableOpacity,
  Animated,
} from "react-native";
import { useRouter, Stack, useLocalSearchParams } from "expo-router";
import { Feather, Ionicons, MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Speech from "expo-speech";
import api from "../../services/api";
import { useTheme } from "@/src/context/ThemeContext";
import { usePinyin } from "@/src/context/PinyinContext";
import { usePriority } from "@/src/context/PriorityContext";
import PinyinCheckbox from "../../components/ui/PinyinCheckbox";
import { useCultivationStore } from "../../store/useCultivationStore";
import { parseWord } from "../../src/utils/wordParser";

const { width } = Dimensions.get("window");

export interface RawWord {
  word: string;
  pinyin?: string;
  meaning: string;
  deckTitle?: string;
  deckId?: string;
}

export interface MatchCard {
  id: string;
  type: "hanzi" | "target";
  text: string;
  subText?: string;
  speechText: string;
  pairId: number;
  matched: boolean;
  isFlipped: boolean;
  rawWord: RawWord;
}

export interface GameMistake {
  word: string;
  pinyin?: string;
  meaning: string;
  lessonTitle: string;
  lessonId?: string;
}

type MatchMode = "hanzi_vn" | "hanzi_pinyin" | "hanzi_pinyin_vn";
type SourceType = "db" | "priority" | "master" | "custom_json";
type GameplayStyle = "speed" | "memory" | "rush";

const PAGE_SIZE = 12;

export default function VocabMatchScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { hidePinyin } = usePinyin();
  const { addPriority } = usePriority();
  const params = useLocalSearchParams<{ topicId?: string; listId?: string }>();

  // Cultivation store rewards
  const { addTuVi, addXP } = useCultivationStore();

  // Settings states
  const [sourceType, setSourceType] = useState<SourceType>("db");
  const [gameplayStyle, setGameplayStyle] = useState<GameplayStyle>("speed");
  const [matchMode, setMatchMode] = useState<MatchMode>("hanzi_vn");
  const [pairLimit, setPairLimit] = useState<number>(6); // 4, 6, 8, 10

  // Data lists
  const [vocabLists, setVocabLists] = useState<any[]>([]);
  const [selectedListIds, setSelectedListIds] = useState<string[]>([]);
  const [masterVocab, setMasterVocab] = useState<RawWord[]>([]);
  const [customJsonWords, setCustomJsonWords] = useState<RawWord[]>([]);
  const [customJsonFileName, setCustomJsonFileName] = useState<string>("");

  // Priority review info from server
  const [priorityInfo, setPriorityInfo] = useState<{
    count: number;
    words: any[];
    topics: string[];
  }>({ count: 0, words: [], topics: [] });

  const [loadingLists, setLoadingLists] = useState(true);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Active game phase state
  const [isPlaying, setIsPlaying] = useState(false);
  const [cards, setCards] = useState<MatchCard[]>([]);
  const [selectedCard, setSelectedCard] = useState<MatchCard | null>(null);
  const [errorIds, setErrorIds] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [moves, setMoves] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [totalPairs, setTotalPairs] = useState(0);

  // Timer & Survival Rush states
  const [timeLeft, setTimeLeft] = useState<number>(45);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Mistakes tracking for current game
  const [mistakesList, setMistakesList] = useState<GameMistake[]>([]);

  // 🔁 Queue chứa các từ làm sai để đưa về cuối game cho làm lại
  const [retryQueue, setRetryQueue] = useState<RawWord[]>([]);
  const retryQueueRef = useRef<RawWord[]>([]);
  const [isRetryRound, setIsRetryRound] = useState(false);
  const [masteredRetriedCount, setMasteredRetriedCount] = useState(0);

  // Floating notification toast
  const [toastText, setToastText] = useState<string | null>(null);
  const toastFadeAnim = useRef(new Animated.Value(0)).current;

  // 1. Fetch DB vocab lists, Master JSON, & Priority list on mount
  useEffect(() => {
    setLoadingLists(true);

    Promise.all([
      api.get("/api/vocab/lists").catch(() => ({ data: { success: false, data: [] } })),
      api.get("/api/vocab/master").catch(() => ({ data: { success: false, data: null } })),
      api.get("/api/vocab/priority/list").catch(() => ({ data: { success: false, count: 0, words: [], topics: [] } })),
    ])
      .then(([dbRes, masterRes, priorityRes]) => {
        if (dbRes.data && dbRes.data.success && dbRes.data.data) {
          const data = dbRes.data.data;
          setVocabLists(data);

          const targetId = params.topicId || params.listId;
          if (targetId) {
            const matched = data.find((l: any) => l._id.toString() === targetId.toString());
            if (matched) {
              setSelectedListIds([matched._id]);
            } else if (data.length > 0) {
              setSelectedListIds([data[0]._id]);
            }
          } else if (data.length > 0) {
            setSelectedListIds([data[0]._id]);
          }
        }

        if (masterRes.data && masterRes.data.success && masterRes.data.data) {
          const rawM = masterRes.data.data.words || [];
          const cleanedM: RawWord[] = rawM.map((w: any) => ({
            word: w.word || w.term || "",
            pinyin: w.pinyin || w.reading || "",
            meaning: w.meaning || w.def || "",
            deckTitle: "Giáo Trình Đương Đại",
          }));
          setMasterVocab(cleanedM);
        }

        if (priorityRes.data && priorityRes.data.success) {
          setPriorityInfo(priorityRes.data);
        }
      })
      .finally(() => {
        setLoadingLists(false);
        setVisibleCount(PAGE_SIZE);
      });
  }, [params.topicId, params.listId]);

  // Auto start if listId/topicId param is given
  useEffect(() => {
    const targetId = params.topicId || params.listId;
    if (targetId && vocabLists.length > 0 && selectedListIds.length > 0 && !isPlaying) {
      const matched = vocabLists.find((l: any) => l._id.toString() === targetId.toString());
      if (matched && selectedListIds.includes(matched._id)) {
        startMatchGameFromWords(extractWordsFromDecks([matched]));
      }
    }
  }, [vocabLists, selectedListIds, params.topicId, params.listId]);

  // Clean timer on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, []);

  // Timer runner during active game
  useEffect(() => {
    if (isPlaying && !isFinished) {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

      timerIntervalRef.current = setInterval(() => {
        setElapsedTime((prev) => prev + 1);

        if (gameplayStyle === "rush") {
          setTimeLeft((prev) => {
            if (prev <= 1) {
              if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
              handleGameOverTimeRush();
              return 0;
            }
            return prev - 1;
          });
        }
      }, 1000);
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [isPlaying, isFinished, gameplayStyle]);

  const handleGameOverTimeRush = () => {
    setIsFinished(true);
    triggerFloatingToast("⏰ Hết giờ! Ván đấu sinh tồn kết thúc.");
  };

  const triggerFloatingToast = (msg: string) => {
    setToastText(msg);
    toastFadeAnim.setValue(0);
    Animated.timing(toastFadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: Platform.OS !== "web",
    }).start(() => {
      setTimeout(() => {
        Animated.timing(toastFadeAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: Platform.OS !== "web",
        }).start(() => setToastText(null));
      }, 2500);
    });
  };

  // Convert Vocab Decks into RawWords with deck title attached
  const extractWordsFromDecks = (decks: any[]): RawWord[] => {
    const list: RawWord[] = [];
    decks.forEach((deck) => {
      if (deck.words && deck.words.length > 0) {
        deck.words.forEach((w: any) => {
          const parsed = parseWord(w.term, w.def);
          list.push({
            word: parsed.word,
            pinyin: parsed.pinyin || parsed.reading || "",
            meaning: parsed.meaning,
            deckTitle: deck.title || "Bài học",
            deckId: deck._id ? String(deck._id) : undefined,
          });
        });
      }
    });
    return list;
  };

  // Extract RawWords from Priority Review
  const extractWordsFromPriority = (): RawWord[] => {
    return (priorityInfo.words || []).map((w: any) => {
      const parsed = parseWord(w.term, w.def);
      return {
        word: parsed.word,
        pinyin: parsed.pinyin || parsed.reading || w.reading || "",
        meaning: parsed.meaning || w.meaning || "",
        deckTitle: w.topicTitle || "Ưu Tiên Ôn Tập",
        deckId: w.topicId,
      };
    });
  };

  const handleToggleList = (id: string) => {
    setSelectedListIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllLists = () => {
    if (selectedListIds.length === vocabLists.length) {
      setSelectedListIds([]);
    } else {
      setSelectedListIds(vocabLists.map((l) => l._id));
    }
  };

  // Upload Custom JSON file on Web / Device
  const handleCustomJsonUpload = (event: any) => {
    const file = event.target?.files?.[0];
    if (!file) return;
    setCustomJsonFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text);
        const rawList = Array.isArray(parsed) ? parsed : (parsed.words || [parsed]);
        const cleanedList: RawWord[] = rawList
          .map((item: any) => ({
            word: item.word || item.term || "",
            pinyin: item.pinyin || item.reading || "",
            meaning: typeof item.meaning === "string" ? item.meaning : (item.def || ""),
            deckTitle: item.topicTitle || file.name.replace(".json", ""),
          }))
          .filter((w: RawWord) => w.word && w.meaning);

        if (cleanedList.length === 0) {
          alert("File JSON không chứa từ vựng hợp lệ (cần có word và meaning).");
          return;
        }

        setCustomJsonWords(cleanedList);
        setSourceType("custom_json");
      } catch {
        alert("File JSON bị lỗi định dạng.");
      }
    };
    reader.readAsText(file);
  };

  // START GAME LOGIC
  const handleStartGame = () => {
    let sourceWords: RawWord[] = [];
    if (sourceType === "priority") {
      sourceWords = extractWordsFromPriority();
    } else if (sourceType === "db") {
      const selectedDecks = vocabLists.filter((list) => selectedListIds.includes(list._id));
      sourceWords = extractWordsFromDecks(selectedDecks);
    } else if (sourceType === "master") {
      sourceWords = masterVocab;
    } else if (sourceType === "custom_json") {
      sourceWords = customJsonWords;
    }

    if (sourceWords.length === 0) {
      alert("Chưa có từ vựng nào trong nguồn đã chọn!");
      return;
    }

    startMatchGameFromWords(sourceWords);
  };

  // START MATCH WITH SPECIFIC WORD POOL (hỗ trợ đưa từ sai về cuối game làm lại)
  const startMatchGameFromWords = (allWords: RawWord[], isRetryRoundMode: boolean = false) => {
    const sampleLimit = isRetryRoundMode ? allWords.length : Math.min(pairLimit, allWords.length);
    const selectedPairs = isRetryRoundMode
      ? [...allWords].sort(() => Math.random() - 0.5)
      : [...allWords].sort(() => Math.random() - 0.5).slice(0, sampleLimit);
    setTotalPairs(selectedPairs.length);

    const listCards: MatchCard[] = [];
    selectedPairs.forEach((pair, i) => {
      // 1. Thẻ Chữ Hán
      const hanziCardText = pair.word;
      let hanziSubText = undefined;
      if (matchMode === "hanzi_pinyin_vn" && pair.pinyin) {
        hanziSubText = pair.pinyin;
      }

      listCards.push({
        id: `hanzi-${i}`,
        type: "hanzi",
        text: hanziCardText,
        subText: hanziSubText,
        speechText: pair.word,
        pairId: i,
        matched: false,
        isFlipped: gameplayStyle === "memory" ? false : true,
        rawWord: pair,
      });

      // 2. Thẻ Đích (Nghĩa hoặc Pinyin)
      let targetCardText = pair.meaning;
      if (matchMode === "hanzi_pinyin") {
        targetCardText = pair.pinyin || pair.meaning;
      }

      listCards.push({
        id: `target-${i}`,
        type: "target",
        text: targetCardText,
        speechText: pair.word,
        pairId: i,
        matched: false,
        isFlipped: gameplayStyle === "memory" ? false : true,
        rawWord: pair,
      });
    });

    setCards(listCards.sort(() => Math.random() - 0.5));
    setSelectedCard(null);
    setErrorIds([]);
    setScore(0);
    setCombo(0);
    if (!isRetryRoundMode) {
      setMoves(0);
      setMaxCombo(0);
      setElapsedTime(0);
      setMistakesList([]);
      retryQueueRef.current = [];
      setRetryQueue([]);
      setIsRetryRound(false);
      setMasteredRetriedCount(0);
    } else {
      setIsRetryRound(true);
    }
    setTimeLeft(gameplayStyle === "rush" ? Math.min(60, selectedPairs.length * 7) : 45);
    setIsFinished(false);
    setIsPlaying(true);
  };

  // Record wrong answer to priority list & mistakes state
  const recordMistake = (wordObj: RawWord) => {
    if (!wordObj || !wordObj.word) return;

    // Add to in-game mistakes list (prevent dupes)
    setMistakesList((prev) => {
      const exists = prev.some((m) => m.word === wordObj.word);
      if (exists) return prev;
      return [
        ...prev,
        {
          word: wordObj.word,
          pinyin: wordObj.pinyin,
          meaning: wordObj.meaning,
          lessonTitle: wordObj.deckTitle || "Bài học",
          lessonId: wordObj.deckId,
        },
      ];
    });

    // 🚀 LƯU VÀO MỤC TỪ VỰNG ƯU TIÊN THEO BÀI ĐÓ (Tự động cập nhật 0ms & server sync)
    addPriority({
      term: wordObj.word,
      word: wordObj.word,
      reading: wordObj.pinyin,
      meaning: wordObj.meaning,
      topicTitle: wordObj.deckTitle && wordObj.deckTitle !== "Khác" ? wordObj.deckTitle : undefined,
      topicId: wordObj.deckId,
    })
      .then(() => {
        const lesson = wordObj.deckTitle || "Bài học";
        triggerFloatingToast(`⭐ Đã lưu "${wordObj.word}" vào Ưu Tiên Ôn Tập (${lesson})`);
      })
      .catch((err) => console.log("Lỗi auto add priority:", err));
  };

  // Retrying only words that were mistaken in this match
  const handleRetryMistakesOnly = () => {
    if (mistakesList.length === 0) return;
    const retryWords: RawWord[] = mistakesList.map((m) => ({
      word: m.word,
      pinyin: m.pinyin,
      meaning: m.meaning,
      deckTitle: m.lessonTitle,
      deckId: m.lessonId,
    }));
    startMatchGameFromWords(retryWords);
  };

  // CARD CLICK LOGIC
  const handleCardClick = (card: MatchCard) => {
    if (card.matched || errorIds.length > 0) return;

    // In memory flip mode, flip the card open
    if (gameplayStyle === "memory" && !card.isFlipped) {
      setCards((prev) =>
        prev.map((c) => (c.id === card.id ? { ...c, isFlipped: true } : c))
      );
    }

    if (selectedCard?.id === card.id) {
      // Unselect same card
      setSelectedCard(null);
      if (gameplayStyle === "memory") {
        setCards((prev) =>
          prev.map((c) => (c.id === card.id ? { ...c, isFlipped: false } : c))
        );
      }
      return;
    }

    if (!selectedCard) {
      setSelectedCard(card);
      speak(card.speechText);
      return;
    }

    if (selectedCard.type === card.type) {
      // Swapping selected card of same type
      const prevSelected = selectedCard;
      setSelectedCard(card);
      speak(card.speechText);
      if (gameplayStyle === "memory" && prevSelected.id !== card.id) {
        setCards((prev) =>
          prev.map((c) => (c.id === prevSelected.id ? { ...c, isFlipped: false } : c))
        );
      }
      return;
    }

    const c1 = selectedCard;
    const c2 = card;
    setMoves((prev) => prev + 1);

    if (c1.pairId === c2.pairId) {
      // ================= MATCHED CORRECTLY =================
      setCards((prev) =>
        prev.map((c) => (c.id === c1.id || c.id === c2.id ? { ...c, matched: true, isFlipped: true } : c))
      );
      setSelectedCard(null);
      speak(c1.speechText);

      // Combo update
      setCombo((prevC) => {
        const nextC = prevC + 1;
        setMaxCombo((m) => Math.max(m, nextC));
        return nextC;
      });

      // Bonus time in Rush mode
      if (gameplayStyle === "rush") {
        setTimeLeft((t) => t + 3);
      }

      setScore((s) => {
        const next = s + 1;
        if (next >= totalPairs) {
          // 🔁 KIỂM TRA: CÓ TỪ NÀO GHÉP SAI CẦN ĐƯA VỀ CUỐI GAME ĐỂ LÀM LẠI KHÔNG?
          if (retryQueueRef.current.length > 0) {
            const wordsToRetry = [...retryQueueRef.current];
            retryQueueRef.current = [];
            setRetryQueue([]);
            setMasteredRetriedCount((prev) => prev + wordsToRetry.length);
            triggerFloatingToast(`🔁 VÒNG CUỐI: Đưa ${wordsToRetry.length} từ vừa sai ra làm lại!`);
            setTimeout(() => {
              startMatchGameFromWords(wordsToRetry, true);
            }, 600);
            return next;
          }

          // 🎉 ĐÃ HOÀN THÀNH TOÀN BỘ GAME (HẾT TỪ SAI)!
          const totalMasteredPairs = next + masteredRetriedCount;
          const rewardTuVi = totalMasteredPairs * 5 + maxCombo * 2;
          const rewardXP = totalMasteredPairs * 10 + maxCombo * 4;
          addTuVi(rewardTuVi);
          addXP(rewardXP);
          setIsFinished(true);
        }
        return next;
      });
    } else {
      // ================= MISMATCH / WRONG MATCH =================
      setErrorIds([c1.id, c2.id]);
      setCombo(0); // Reset combo

      // Penalty time in rush mode
      if (gameplayStyle === "rush") {
        setTimeLeft((t) => Math.max(0, t - 2));
      }

      // Record mistake & auto-save to priority review for that lesson
      const failedRawWord = c1.type === "hanzi" ? c1.rawWord : c2.rawWord;
      recordMistake(failedRawWord);

      // 🔁 ĐƯA TỪ SAI VỀ CUỐI GAME ĐỂ BẮT BUỘC LÀM LẠI:
      if (!retryQueueRef.current.some((w) => w.word === failedRawWord.word)) {
        retryQueueRef.current.push(failedRawWord);
        setRetryQueue([...retryQueueRef.current]);
      }

      setTimeout(() => {
        setErrorIds([]);
        setSelectedCard(null);
        if (gameplayStyle === "memory") {
          setCards((prev) =>
            prev.map((c) =>
              c.id === c1.id || c.id === c2.id ? { ...c, isFlipped: false } : c
            )
          );
        }
      }, 750);
    }
  };

  const speak = (text: string) => {
    Speech.speak(text, { language: "zh-TW", rate: 0.85 });
  };

  const bgColors: readonly [string, string, ...string[]] = isDark
    ? ["#050814", "#0a0e1c"]
    : ["#f5edd6", "#fcf8ed"];

  // Group mistakes by lesson for results view
  const groupedMistakes = mistakesList.reduce<Record<string, GameMistake[]>>((acc, m) => {
    const key = m.lessonTitle || "Bài học";
    if (!acc[key]) acc[key] = [];
    acc[key].push(m);
    return acc;
  }, {});

  if (loadingLists) {
    return (
      <View style={[styles.center, { backgroundColor: bgColors[0] }]}>
        <ActivityIndicator size="large" color={colors.indigo} />
      </View>
    );
  }

  // =========================================================================
  // 1. CONFIGURATION & SETTINGS PHASE
  // =========================================================================
  if (!isPlaying) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: bgColors[0] }]}>
        <LinearGradient colors={bgColors} style={styles.container}>
          <Stack.Screen options={{ headerShown: false }} />

          {/* Header */}
          <View style={styles.header}>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [
                styles.btnIconHeader,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  transform: [{ scale: pressed ? 0.95 : 1 }],
                },
              ]}
            >
              <Feather name="chevron-left" size={20} color={colors.text} />
            </Pressable>
            <View style={styles.headerTitleWrap}>
              <Text style={[styles.headerTitle, { color: colors.text }]}>🎴 Đấu Trường Ghép Từ Vựng</Text>
              <Text style={[styles.headerSub, { color: colors.indigo }]}>GAME LUYỆN PHẢN XẠ & BẮT TỪ SAI</Text>
            </View>
            <PinyinCheckbox compact />
          </View>

          <ScrollView
            style={{ flex: 1, paddingHorizontal: 20 }}
            contentContainerStyle={{ paddingBottom: 50 }}
            showsVerticalScrollIndicator={false}
          >
            {/* 0. GAMEPLAY STYLE SELECTOR */}
            <View style={styles.sectionContainer}>
              <Text style={[styles.sectionHeading, { color: colors.indigo }]}>1. PHONG CÁCH CHƠI GAME</Text>
              <View style={styles.styleCardsRow}>
                <TouchableOpacity
                  style={[
                    styles.styleCard,
                    {
                      backgroundColor: gameplayStyle === "speed" ? (isDark ? "#1E293B" : "#EEF2FF") : colors.surface,
                      borderColor: gameplayStyle === "speed" ? colors.indigo : colors.border,
                    },
                  ]}
                  onPress={() => setGameplayStyle("speed")}
                >
                  <Text style={styles.styleCardIcon}>🎴</Text>
                  <Text style={[styles.styleCardTitle, { color: gameplayStyle === "speed" ? colors.indigo : colors.text }]}>
                    Ghép Tốc Độ
                  </Text>
                  <Text style={[styles.styleCardDesc, { color: colors.textMuted }]}>
                    Thẻ mở sẵn, tích chuỗi Combo 🔥
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.styleCard,
                    {
                      backgroundColor: gameplayStyle === "memory" ? (isDark ? "#1E293B" : "#EEF2FF") : colors.surface,
                      borderColor: gameplayStyle === "memory" ? colors.indigo : colors.border,
                    },
                  ]}
                  onPress={() => setGameplayStyle("memory")}
                >
                  <Text style={styles.styleCardIcon}>🧠</Text>
                  <Text style={[styles.styleCardTitle, { color: gameplayStyle === "memory" ? colors.indigo : colors.text }]}>
                    Lật Thẻ Trí Nhớ
                  </Text>
                  <Text style={[styles.styleCardDesc, { color: colors.textMuted }]}>
                    Thẻ úp mặt, luyện nhớ vị trí chữ
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.styleCard,
                    {
                      backgroundColor: gameplayStyle === "rush" ? (isDark ? "#3A1A1A" : "#FEF2F2") : colors.surface,
                      borderColor: gameplayStyle === "rush" ? "#EF4444" : colors.border,
                    },
                  ]}
                  onPress={() => setGameplayStyle("rush")}
                >
                  <Text style={styles.styleCardIcon}>⚡</Text>
                  <Text style={[styles.styleCardTitle, { color: gameplayStyle === "rush" ? "#EF4444" : colors.text }]}>
                    Sinh Tồn 45s
                  </Text>
                  <Text style={[styles.styleCardDesc, { color: colors.textMuted }]}>
                    Đúng +3s, sai bị trừ -2s
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* 1. SOURCE SELECTOR */}
            <View style={styles.sectionContainer}>
              <Text style={[styles.sectionHeading, { color: colors.indigo }]}>2. NGUỒN TỪ VỰNG</Text>

              {/* ⭐ PINNED PRIORITY OPTION */}
              <TouchableOpacity
                style={[
                  styles.prioritySourceBanner,
                  {
                    backgroundColor: sourceType === "priority" ? (isDark ? "#3D2409" : "#FEF3C7") : colors.surface,
                    borderColor: sourceType === "priority" ? "#F59E0B" : colors.border,
                  },
                ]}
                onPress={() => setSourceType("priority")}
                activeOpacity={0.8}
              >
                <View style={styles.priorityBannerLeft}>
                  <View style={[styles.priorityStarIcon, { backgroundColor: "#F59E0B" }]}>
                    <MaterialIcons name="star" size={20} color="#FFFFFF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={[styles.priorityBannerTitle, { color: isDark ? "#FDE68A" : "#92400E" }]}>
                        Mục Ưu Tiên Ôn Tập
                      </Text>
                      <View style={[styles.priorityBadgeCount, { backgroundColor: "#F59E0B" }]}>
                        <Text style={styles.priorityBadgeCountText}>{priorityInfo.count} từ</Text>
                      </View>
                    </View>
                    <Text style={[styles.priorityBannerSub, { color: colors.textMuted }]}>
                      {priorityInfo.count > 0
                        ? `Luyện các từ bạn hay sai từ ${priorityInfo.topics.length} bài học`
                        : "Chưa có từ ưu tiên nào (tự động thêm khi chơi sai)"}
                    </Text>
                  </View>
                </View>
                <Ionicons
                  name={sourceType === "priority" ? "radio-button-on" : "radio-button-off"}
                  size={22}
                  color={sourceType === "priority" ? "#F59E0B" : colors.textMuted}
                />
              </TouchableOpacity>

              {/* Source Tabs */}
              <View style={styles.sourceTabsRow}>
                <TouchableOpacity
                  style={[
                    styles.sourceTabBtn,
                    {
                      backgroundColor: sourceType === "db" ? colors.indigo : colors.surface,
                      borderColor: sourceType === "db" ? colors.indigo : colors.border,
                    },
                  ]}
                  onPress={() => setSourceType("db")}
                >
                  <MaterialIcons name="folder" size={16} color={sourceType === "db" ? "#FFFFFF" : colors.text} />
                  <Text style={[styles.sourceTabText, { color: sourceType === "db" ? "#FFFFFF" : colors.text }]}>
                    Kho bài học ({vocabLists.length})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.sourceTabBtn,
                    {
                      backgroundColor: sourceType === "master" ? colors.indigo : colors.surface,
                      borderColor: sourceType === "master" ? colors.indigo : colors.border,
                    },
                  ]}
                  onPress={() => setSourceType("master")}
                >
                  <MaterialIcons name="auto-stories" size={16} color={sourceType === "master" ? "#FFFFFF" : colors.text} />
                  <Text style={[styles.sourceTabText, { color: sourceType === "master" ? "#FFFFFF" : colors.text }]}>
                    Kho Master ({masterVocab.length || 533})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.sourceTabBtn,
                    {
                      backgroundColor: sourceType === "custom_json" ? colors.indigo : colors.surface,
                      borderColor: sourceType === "custom_json" ? colors.indigo : colors.border,
                    },
                  ]}
                  onPress={() => {
                    if (Platform.OS === "web") {
                      document.getElementById("match-json-upload")?.click();
                    }
                  }}
                >
                  <MaterialIcons name="upload-file" size={16} color={sourceType === "custom_json" ? "#FFFFFF" : colors.text} />
                  <Text style={[styles.sourceTabText, { color: sourceType === "custom_json" ? "#FFFFFF" : colors.text }]}>
                    {customJsonWords.length > 0 ? `File (${customJsonWords.length})` : "Tải JSON lên"}
                  </Text>
                </TouchableOpacity>
              </View>

              {Platform.OS === "web" && (
                <input
                  id="match-json-upload"
                  type="file"
                  accept=".json"
                  onChange={handleCustomJsonUpload}
                  style={{ display: "none" }}
                />
              )}

              {/* DB Lists Selection */}
              {sourceType === "db" && (
                <View style={[styles.listGrid, { marginTop: 12 }]}>
                  <View style={styles.listHeaderActionsRow}>
                    <Text style={[styles.listSelectedCountText, { color: colors.textMuted }]}>
                      Đã chọn {selectedListIds.length}/{vocabLists.length} bài
                    </Text>
                    <TouchableOpacity onPress={handleSelectAllLists}>
                      <Text style={[styles.selectAllLink, { color: colors.indigo }]}>
                        {selectedListIds.length === vocabLists.length ? "Bỏ chọn tất cả" : "Chọn tất cả"}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {vocabLists.slice(0, visibleCount).map((list) => {
                    const isSelected = selectedListIds.includes(list._id);
                    return (
                      <Pressable
                        key={list._id}
                        onPress={() => handleToggleList(list._id)}
                        style={({ pressed }) => [
                          styles.listCardItem,
                          {
                            backgroundColor: isSelected ? (isDark ? "#1E293B" : "#EFF6FF") : colors.surface,
                            borderColor: isSelected ? colors.indigo : colors.border,
                            transform: [{ scale: pressed ? 0.98 : 1 }],
                          },
                        ]}
                      >
                        <View style={styles.listCardLeft}>
                          <Ionicons
                            name={isSelected ? "checkbox" : "square-outline"}
                            size={20}
                            color={isSelected ? colors.indigo : colors.textMuted}
                            style={{ marginRight: 10 }}
                          />
                          <View style={{ flex: 1 }}>
                            <Text
                              style={[
                                styles.listCardTitle,
                                { color: colors.text },
                                isSelected && { color: colors.indigo, fontWeight: "700" },
                              ]}
                              numberOfLines={1}
                            >
                              {list.title}
                            </Text>
                            <Text style={[styles.listCardCount, { color: colors.textMuted }]}>
                              {list.words ? list.words.length : 0} từ vựng
                            </Text>
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}
                  {visibleCount < vocabLists.length && (
                    <TouchableOpacity
                      style={[
                        styles.loadMoreBtn,
                        { backgroundColor: colors.surface, borderColor: colors.border },
                      ]}
                      onPress={() => setVisibleCount((c) => c + PAGE_SIZE)}
                    >
                      <Text style={[styles.loadMoreText, { color: colors.indigo }]}>
                        Xem thêm ({vocabLists.length - visibleCount} bài còn lại)
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>

            {/* 2. MATCH MODE SELECTOR */}
            <View style={styles.sectionContainer}>
              <Text style={[styles.sectionHeading, { color: colors.indigo }]}>3. CHẾ ĐỘ GHÉP THẺ</Text>
              <View style={styles.modeGrid}>
                <TouchableOpacity
                  style={[
                    styles.modeCard,
                    {
                      backgroundColor: matchMode === "hanzi_vn" ? (isDark ? "#1E293B" : "#EFF6FF") : colors.surface,
                      borderColor: matchMode === "hanzi_vn" ? colors.indigo : colors.border,
                    },
                  ]}
                  onPress={() => setMatchMode("hanzi_vn")}
                >
                  <Text style={[styles.modeCardTitle, { color: matchMode === "hanzi_vn" ? colors.indigo : colors.text }]}>
                    🔤 Hán tự ↔ Nghĩa Việt
                  </Text>
                  <Text style={[styles.modeCardDesc, { color: colors.textMuted }]}>
                    Ví dụ: 謝謝 ↔ Cảm ơn
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.modeCard,
                    {
                      backgroundColor: matchMode === "hanzi_pinyin" ? (isDark ? "#1E293B" : "#EFF6FF") : colors.surface,
                      borderColor: matchMode === "hanzi_pinyin" ? colors.indigo : colors.border,
                    },
                  ]}
                  onPress={() => setMatchMode("hanzi_pinyin")}
                >
                  <Text style={[styles.modeCardTitle, { color: matchMode === "hanzi_pinyin" ? colors.indigo : colors.text }]}>
                    🗣️ Hán tự ↔ Pinyin
                  </Text>
                  <Text style={[styles.modeCardDesc, { color: colors.textMuted }]}>
                    Ví dụ: 謝謝 ↔ xièxiè
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.modeCard,
                    {
                      backgroundColor: matchMode === "hanzi_pinyin_vn" ? (isDark ? "#1E293B" : "#EFF6FF") : colors.surface,
                      borderColor: matchMode === "hanzi_pinyin_vn" ? colors.indigo : colors.border,
                    },
                  ]}
                  onPress={() => setMatchMode("hanzi_pinyin_vn")}
                >
                  <Text style={[styles.modeCardTitle, { color: matchMode === "hanzi_pinyin_vn" ? colors.indigo : colors.text }]}>
                    💡 Hán tự + Pinyin ↔ Nghĩa
                  </Text>
                  <Text style={[styles.modeCardDesc, { color: colors.textMuted }]}>
                    Dành cho người mới học
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* 3. PAIR LIMIT SELECTOR */}
            <View style={styles.sectionContainer}>
              <Text style={[styles.sectionHeading, { color: colors.indigo }]}>4. SỐ CẶP THẺ MỖI VÁN</Text>
              <View style={styles.limitRow}>
                {[4, 6, 8, 10].map((num) => (
                  <TouchableOpacity
                    key={num}
                    style={[
                      styles.limitBtn,
                      {
                        backgroundColor: pairLimit === num ? colors.indigo : colors.surface,
                        borderColor: pairLimit === num ? colors.indigo : colors.border,
                      },
                    ]}
                    onPress={() => setPairLimit(num)}
                  >
                    <Text style={[styles.limitBtnText, { color: pairLimit === num ? "#FFFFFF" : colors.text }]}>
                      {num} cặp ({num * 2} ô)
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* START BUTTON */}
            <Pressable
              onPress={handleStartGame}
              style={({ pressed }) => [
                styles.btnStart,
                {
                  backgroundColor: colors.indigo,
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                },
              ]}
            >
              <Ionicons name="play" size={20} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.btnStartText}>BẮT ĐẦU VÁN ĐẤU</Text>
            </Pressable>
          </ScrollView>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  // =========================================================================
  // 2. ACTIVE MATCH PLAYING PHASE
  // =========================================================================
  if (isPlaying && !isFinished) {
    const isRushMode = gameplayStyle === "rush";
    const isTimeDanger = isRushMode && timeLeft <= 10;

    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: bgColors[0] }]}>
        <LinearGradient colors={bgColors} style={styles.container}>
          <Stack.Screen options={{ headerShown: false }} />

          {/* HUD Header */}
          <View style={styles.header}>
            <Pressable
              onPress={() => setIsPlaying(false)}
              style={({ pressed }) => [
                styles.btnIconHeader,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  transform: [{ scale: pressed ? 0.95 : 1 }],
                },
              ]}
            >
              <Feather name="x" size={20} color={colors.text} />
            </Pressable>

            <View style={styles.headerTitleWrap}>
              <Text style={[styles.headerTitle, { color: colors.text }]}>
                {gameplayStyle === "speed" ? "🎴 Ghép Tốc Độ" : gameplayStyle === "memory" ? "🧠 Lật Thẻ Trí Nhớ" : "⚡ Sinh Tồn 45s"}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
                {isRetryRound ? (
                  <View style={[styles.retryRoundBadge, { backgroundColor: "#F59E0B" }]}>
                    <Ionicons name="refresh" size={11} color="#FFFFFF" style={{ marginRight: 3 }} />
                    <Text style={styles.retryRoundBadgeText}>LÀM LẠI TỪ SAI ({score}/{totalPairs})</Text>
                  </View>
                ) : (
                  <>
                    <Text style={[styles.headerSub, { color: colors.indigo }]}>
                      ĐÚNG: {score}/{totalPairs} • THỬ: {moves}
                    </Text>
                    {retryQueue.length > 0 && (
                      <View style={[styles.queueCountBadge, { backgroundColor: isDark ? "#3D2409" : "#FEF3C7" }]}>
                        <Text style={styles.queueCountText}>
                          🔁 {retryQueue.length} từ sẽ làm lại
                        </Text>
                      </View>
                    )}
                  </>
                )}
                {combo >= 2 && (
                  <View style={[styles.comboBadge, { backgroundColor: "#EF4444" }]}>
                    <Text style={styles.comboBadgeText}>🔥 x{combo}</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Time Indicator */}
            {isRushMode ? (
              <View style={[styles.rushTimerBadge, { backgroundColor: isTimeDanger ? "#EF4444" : colors.indigo }]}>
                <Ionicons name="timer" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                <Text style={styles.rushTimerText}>{timeLeft}s</Text>
              </View>
            ) : (
              <PinyinCheckbox compact />
            )}
          </View>

          {/* Floating Toast notification when wrong word is auto-added to priority */}
          {toastText && (
            <Animated.View style={[styles.floatingToastWrap, { opacity: toastFadeAnim }]}>
              <View style={[styles.floatingToastBox, { backgroundColor: isDark ? "#1C1917" : "#FFFBEB", borderColor: "#F59E0B" }]}>
                <MaterialIcons name="auto-awesome" size={16} color="#F59E0B" style={{ marginRight: 6 }} />
                <Text style={[styles.floatingToastText, { color: isDark ? "#FDE68A" : "#92400E" }]} numberOfLines={2}>
                  {toastText}
                </Text>
              </View>
            </Animated.View>
          )}

          {/* Card Grid Area */}
          <View style={styles.gameArea}>
            <View style={styles.gridCards}>
              {cards.map((c) => {
                const isSelected = selectedCard?.id === c.id;
                const isError = errorIds.includes(c.id);
                const isMemory = gameplayStyle === "memory";
                const isHiddenFace = isMemory && !c.isFlipped && !c.matched;

                let cardBg = isDark ? "#1E293B" : "#FFFFFF";
                let cardBorder = isDark ? "#334155" : "#E2E8F0";
                let cardTextColor = colors.text;

                if (c.matched) {
                  return (
                    <View
                      key={c.id}
                      style={[
                        styles.cardItem,
                        {
                          opacity: 0.15,
                          backgroundColor: isDark ? "#064E3B" : "#ECFDF5",
                          borderColor: "#10B981",
                        },
                      ]}
                    >
                      <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                    </View>
                  );
                }

                if (isSelected) {
                  cardBg = isDark ? "#1E3A8A" : "#DBEAFE";
                  cardBorder = colors.indigo;
                  cardTextColor = colors.indigo;
                } else if (isError) {
                  cardBg = isDark ? "#451A1A" : "#FEE2E2";
                  cardBorder = "#EF4444";
                  cardTextColor = "#EF4444";
                } else if (isHiddenFace) {
                  cardBg = isDark ? "#181E2E" : "#E2E8F0";
                  cardBorder = isDark ? "#334155" : "#CBD5E1";
                }

                const isChinese = c.type === "hanzi";
                const isLongText = c.text.length > 8;

                return (
                  <Pressable
                    key={c.id}
                    onPress={() => handleCardClick(c)}
                    style={({ pressed }) => [
                      styles.cardItem,
                      {
                        backgroundColor: cardBg,
                        borderColor: cardBorder,
                        transform: [{ scale: pressed ? 0.95 : 1 }],
                      },
                    ]}
                  >
                    {isHiddenFace ? (
                      <View style={{ alignItems: "center", justifyContent: "center" }}>
                        <Text style={{ fontSize: 24, opacity: 0.7 }}>🎴</Text>
                        <Text style={{ fontSize: 9, color: colors.textMuted, marginTop: 2 }}>Chạm để lật</Text>
                      </View>
                    ) : (
                      <>
                        <Text
                          style={[
                            styles.cardItemText,
                            {
                              color: cardTextColor,
                              fontSize: isChinese ? 22 : isLongText ? 13 : 15,
                              fontWeight: isChinese ? "800" : "600",
                            },
                          ]}
                          numberOfLines={3}
                        >
                          {c.text}
                        </Text>
                        {!hidePinyin && c.subText ? (
                          <Text style={[styles.cardSubText, { color: isSelected ? colors.indigo : colors.textMuted }]}>
                            {c.subText}
                          </Text>
                        ) : null}
                      </>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  // =========================================================================
  // 3. RESULTS & VICTORY PHASE (KÈM BẢNG TỪ SAI ĐÃ LƯU ƯU TIÊN)
  // =========================================================================
  if (isFinished) {
    const rewardTuViGained = score * 5 + maxCombo * 2;
    const rewardXPGained = score * 10 + maxCombo * 4;
    const accuracy = moves > 0 ? Math.round((score / moves) * 100) : 100;

    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: bgColors[0] }]}>
        <LinearGradient colors={bgColors} style={styles.container}>
          <Stack.Screen options={{ headerShown: false }} />

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[styles.center, { paddingHorizontal: 20, paddingVertical: 30 }]}
            showsVerticalScrollIndicator={false}
          >
            {/* Victory Badge */}
            <View style={[styles.emblemIconCircle, { backgroundColor: isDark ? "#1E3A8A" : "#DBEAFE" }]}>
              <Ionicons name="trophy" size={54} color={colors.indigo} />
            </View>

            <Text style={[styles.resultTitle, { color: colors.text }]}>
              {score >= totalPairs ? "HOÀN THÀNH XUẤT SẮC!" : "KẾT THÚC VÁN ĐẤU!"}
            </Text>
            <Text style={[styles.resultSubtitle, { color: colors.textMuted }]}>
              Ghép đúng {score}/{totalPairs} cặp từ • Thời gian: {elapsedTime}s
            </Text>

            {masteredRetriedCount > 0 && (
              <View style={[styles.masteredRetryBox, { backgroundColor: isDark ? "#064E3B" : "#ECFDF5", borderColor: "#10B981" }]}>
                <Ionicons name="checkmark-done-circle" size={18} color="#10B981" style={{ marginRight: 6 }} />
                <Text style={[styles.masteredRetryText, { color: isDark ? "#86EFAC" : "#065F46" }]}>
                  Đã làm lại thành công {masteredRetriedCount} từ từng ghép sai ở vòng cuối ván đấu!
                </Text>
              </View>
            )}

            {/* Score Bento Box */}
            <View style={[styles.resultBentoBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.resultBentoItem}>
                <Text style={[styles.bentoBLabel, { color: colors.textMuted }]}>LƯỢT THỬ</Text>
                <Text style={[styles.bentoBVal, { color: colors.text }]}>{moves}</Text>
              </View>

              <View style={[styles.resultBentoDivider, { backgroundColor: colors.border }]} />

              <View style={styles.resultBentoItem}>
                <Text style={[styles.bentoBLabel, { color: colors.textMuted }]}>ĐỘ CHÍNH XÁC</Text>
                <Text style={[styles.bentoBVal, { color: colors.indigo }]}>{accuracy}%</Text>
              </View>

              <View style={[styles.resultBentoDivider, { backgroundColor: colors.border }]} />

              <View style={styles.resultBentoItem}>
                <Text style={[styles.bentoBLabel, { color: colors.textMuted }]}>COMBO CAO</Text>
                <Text style={[styles.bentoBVal, { color: "#EF4444" }]}>🔥 x{maxCombo}</Text>
              </View>
            </View>

            {/* Rewards Card */}
            <View style={[styles.rewardCard, { backgroundColor: colors.surface, borderColor: colors.indigo }]}>
              <Ionicons name="sparkles" size={20} color={colors.indigo} style={{ marginRight: 8 }} />
              <Text style={[styles.rewardCardText, { color: colors.text }]}>
                Phần thưởng: <Text style={{ color: colors.indigo, fontWeight: "900" }}>+{rewardTuViGained} Tu vi</Text> và +{rewardXPGained} XP!
              </Text>
            </View>

            {/* ⭐ KHU VỰC ĐẶC BIỆT: DANH SÁCH TỪ LÀM SAI ĐÃ TỰ ĐỘNG BỎ VÀO ƯU TIÊN BÀI ĐÓ */}
            {mistakesList.length > 0 && (
              <View style={[styles.mistakesSection, { backgroundColor: isDark ? "#1C1917" : "#FFFBEB", borderColor: isDark ? "#78350F" : "#FDE68A" }]}>
                <View style={styles.mistakesHeaderRow}>
                  <MaterialIcons name="auto-awesome" size={20} color="#F59E0B" />
                  <Text style={[styles.mistakesHeading, { color: isDark ? "#FDE68A" : "#92400E" }]}>
                    TỰ ĐỘNG LƯU {mistakesList.length} TỪ VÀO MỤC ÔN TẬP
                  </Text>
                </View>

                <Text style={[styles.mistakesSubText, { color: isDark ? "#D6D3D1" : "#78350F" }]}>
                  Các từ bạn ghép sai đã được hệ thống phân loại chính xác vào danh sách ưu tiên của từng bài học tương ứng:
                </Text>

                {Object.entries(groupedMistakes).map(([lesson, wordsList]) => (
                  <View key={lesson} style={styles.mistakeLessonGroupWrap}>
                    <View style={[styles.mistakeLessonBadge, { backgroundColor: "#F59E0B" }]}>
                      <Text style={styles.mistakeLessonBadgeText}>📚 {lesson}</Text>
                    </View>
                    <View style={styles.mistakeWordsGrid}>
                      {wordsList.map((m, idx) => (
                        <View
                          key={idx}
                          style={[
                            styles.mistakeWordChip,
                            { backgroundColor: isDark ? "#292524" : "#FFFFFF", borderColor: isDark ? "#44403C" : "#FDE68A" },
                          ]}
                        >
                          <Text style={[styles.mistakeWordTerm, { color: isDark ? "#FDE68A" : "#92400E" }]}>{m.word}</Text>
                          {m.pinyin ? <Text style={styles.mistakeWordPinyin}>[{m.pinyin}]</Text> : null}
                          <Text style={[styles.mistakeWordMeaning, { color: colors.text }]}>{m.meaning}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ))}

                {/* 2 Nút hành động trực tiếp cho từ sai */}
                <View style={styles.mistakeActionsRow}>
                  <TouchableOpacity
                    style={[styles.btnRetryMistakes, { backgroundColor: "#F59E0B" }]}
                    onPress={handleRetryMistakesOnly}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="flash" size={17} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.btnRetryMistakesText}>Chơi lại riêng các từ sai này ({mistakesList.length})</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.btnOpenPriorityFlashcard, { backgroundColor: isDark ? "#292524" : "#FEF3C7", borderColor: "#F59E0B" }]}
                    onPress={() => router.push({ pathname: "/study/card-viewer", params: { mode: "priority", title: "Ưu Tiên Ôn Tập" } })}
                    activeOpacity={0.8}
                  >
                    <MaterialIcons name="style" size={17} color={isDark ? "#FDE68A" : "#B45309"} style={{ marginRight: 6 }} />
                    <Text style={[styles.btnOpenPriorityFlashcardText, { color: isDark ? "#FDE68A" : "#B45309" }]}>
                      Mở Flashcard Ôn Tập
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* General Action Buttons */}
            <View style={styles.resultActions}>
              <Pressable
                onPress={handleStartGame}
                style={({ pressed }) => [
                  styles.btnResultPrimary,
                  { backgroundColor: colors.indigo, transform: [{ scale: pressed ? 0.98 : 1 }] },
                ]}
              >
                <Ionicons name="reload" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.btnResultPrimaryText}>Chơi lại ván mới</Text>
              </Pressable>

              <Pressable
                onPress={() => setIsPlaying(false)}
                style={({ pressed }) => [
                  styles.btnResultSecondary,
                  { backgroundColor: colors.surface, borderColor: colors.border, transform: [{ scale: pressed ? 0.98 : 1 }] },
                ]}
              >
                <Text style={[styles.btnResultSecondaryText, { color: colors.text }]}>Đổi cấu hình</Text>
              </Pressable>
            </View>
          </ScrollView>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  center: {
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
  },
  btnIconHeader: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  headerSub: {
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
  },
  comboBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  comboBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "900",
  },
  retryRoundBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  retryRoundBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "900",
  },
  queueCountBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  queueCountText: {
    color: "#D97706",
    fontSize: 10,
    fontWeight: "800",
  },
  rushTimerBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  rushTimerText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },
  floatingToastWrap: {
    position: "absolute",
    top: 68,
    left: 20,
    right: 20,
    zIndex: 999,
    alignItems: "center",
  },
  floatingToastBox: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1.5,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  floatingToastText: {
    fontSize: 12,
    fontWeight: "700",
  },
  sectionContainer: {
    marginBottom: 20,
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
    marginBottom: 10,
    textTransform: "uppercase",
  },
  styleCardsRow: {
    flexDirection: "row",
    gap: 8,
  },
  styleCard: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: "center",
  },
  styleCardIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  styleCardTitle: {
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 2,
  },
  styleCardDesc: {
    fontSize: 9,
    textAlign: "center",
  },
  prioritySourceBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: 12,
  },
  priorityBannerLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  priorityStarIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  priorityBannerTitle: {
    fontSize: 14,
    fontWeight: "800",
  },
  priorityBadgeCount: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  priorityBadgeCountText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },
  priorityBannerSub: {
    fontSize: 11,
    marginTop: 2,
  },
  sourceTabsRow: {
    flexDirection: "row",
    gap: 8,
  },
  sourceTabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 9,
    paddingHorizontal: 6,
    borderRadius: 10,
    borderWidth: 1,
    gap: 5,
  },
  sourceTabText: {
    fontSize: 11,
    fontWeight: "700",
  },
  listHeaderActionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  listSelectedCountText: {
    fontSize: 12,
    fontWeight: "600",
  },
  selectAllLink: {
    fontSize: 12,
    fontWeight: "700",
  },
  listGrid: {
    gap: 8,
  },
  listCardItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  listCardLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  listCardTitle: {
    fontSize: 13,
    fontWeight: "600",
  },
  listCardCount: {
    fontSize: 11,
    marginTop: 2,
  },
  loadMoreBtn: {
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    marginTop: 4,
  },
  loadMoreText: {
    fontSize: 12,
    fontWeight: "700",
  },
  modeGrid: {
    gap: 8,
  },
  modeCard: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  modeCardTitle: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 2,
  },
  modeCardDesc: {
    fontSize: 11,
  },
  limitRow: {
    flexDirection: "row",
    gap: 8,
  },
  limitBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
  },
  limitBtnText: {
    fontSize: 11,
    fontWeight: "700",
  },
  btnStart: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 10,
    marginBottom: 30,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  btnStartText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  gameArea: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: "center",
  },
  gridCards: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 10,
    maxWidth: 600,
    alignSelf: "center",
    width: "100%",
  },
  cardItem: {
    width: "46%",
    minHeight: 88,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 10,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  cardItemText: {
    textAlign: "center",
  },
  cardSubText: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 3,
  },
  emblemIconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  resultTitle: {
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center",
  },
  resultSubtitle: {
    fontSize: 13,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 18,
  },
  resultBentoBox: {
    flexDirection: "row",
    width: "100%",
    maxWidth: 360,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 14,
    marginBottom: 12,
  },
  resultBentoItem: {
    flex: 1,
    alignItems: "center",
  },
  resultBentoDivider: {
    width: 1,
  },
  bentoBLabel: {
    fontSize: 10,
    fontWeight: "700",
  },
  bentoBVal: {
    fontSize: 22,
    fontWeight: "900",
    marginTop: 4,
  },
  masteredRetryBox: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    maxWidth: 360,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  masteredRetryText: {
    fontSize: 12,
    fontWeight: "700",
    flex: 1,
  },
  rewardCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    maxWidth: 360,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  rewardCardText: {
    fontSize: 12,
    fontWeight: "600",
  },
  mistakesSection: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 14,
    marginBottom: 20,
  },
  mistakesHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  mistakesHeading: {
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.3,
  },
  mistakesSubText: {
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 12,
  },
  mistakeLessonGroupWrap: {
    marginBottom: 10,
  },
  mistakeLessonBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginBottom: 6,
  },
  mistakeLessonBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },
  mistakeWordsGrid: {
    gap: 6,
  },
  mistakeWordChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  mistakeWordTerm: {
    fontSize: 14,
    fontWeight: "800",
  },
  mistakeWordPinyin: {
    fontSize: 11,
    color: "#D97706",
    fontWeight: "600",
  },
  mistakeWordMeaning: {
    fontSize: 12,
    flex: 1,
  },
  mistakeActionsRow: {
    marginTop: 10,
    gap: 8,
  },
  btnRetryMistakes: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
    borderRadius: 10,
  },
  btnRetryMistakesText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  btnOpenPriorityFlashcard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  btnOpenPriorityFlashcardText: {
    fontSize: 13,
    fontWeight: "700",
  },
  resultActions: {
    width: "100%",
    maxWidth: 360,
    gap: 8,
    marginTop: 6,
  },
  btnResultPrimary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
    borderRadius: 12,
  },
  btnResultPrimaryText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  btnResultSecondary: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  btnResultSecondaryText: {
    fontSize: 13,
    fontWeight: "700",
  },
});
