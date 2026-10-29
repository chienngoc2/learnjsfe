import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  StatusBar,
  Share,
  LayoutChangeEvent,
  Modal,
  TextInput,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { Audio } from "expo-av";
import * as Speech from "expo-speech";
import * as WebBrowser from "expo-web-browser";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/src/context/ThemeContext";
import {
  transcribeMp3File,
  fetchSavedAudioLessons,
  saveAudioLessonToCloud,
  deleteAudioLessonFromCloud,
  getFullAudioStreamUrl,
  getFullAudioDownloadUrl,
} from "../../services/aiService";
import api from "../../services/api";
import StrokeOrderPractice from "../../components/StrokeOrderPractice";
import { SINO_VIETNAMESE_DICT } from "./kanji-search";
import masterData from "@/assets/data/vocab_master.json";

const masterWords: Array<{ word: string; pinyin?: string; meaning: string; level?: string }> =
  (masterData as any).words || [];

const getCharInfo = (char: string) => {
  const cleanChar = char.trim();
  const dictItem = SINO_VIETNAMESE_DICT[cleanChar];
  const vocabItem = masterWords.find((w) => w.word === cleanChar);
  return {
    char: cleanChar,
    pinyin: dictItem?.pinyin || vocabItem?.pinyin || "",
    hanviet: dictItem?.hanviet || "",
    meaning: dictItem?.meaning || vocabItem?.meaning || "",
  };
};

const getRelatedWordsForChar = (char: string, limit = 16) => {
  const clean = char.trim();
  if (!clean) return [];
  return masterWords
    .filter((w) => w.word.includes(clean) && w.word !== clean)
    .slice(0, limit);
};

interface QuickCharTooltip {
  char: string;
  pinyin: string;
  hanviet: string;
  meaning: string;
  item: Segment;
  charIdx: number;
}

interface ExploreItem {
  word: string;
  pinyin?: string;
  hanviet?: string;
  meaning?: string;
  audioTimestamp?: number;
  lessonTitle?: string;
}

interface WordInsightData {
  word?: string;
  pinyin?: string;
  hanviet?: string;
  meaning?: string;
  synonyms?: Array<{ word: string; pinyin?: string; meaning: string; difference?: string }>;
  usages?: Array<{
    pattern: string;
    meaning?: string;
    explanation?: string;
    exampleCn?: string;
    examplePinyin?: string;
    exampleVn?: string;
    example?: string;
  }>;
  relatedWords?: Array<{ word: string; pinyin?: string; meaning: string }>;
}

const SAVED_LESSONS_STORAGE_KEY = "@ai_sensei_saved_audio_lessons_v1";

interface Segment {
  id: number;
  start: number;
  end: number;
  startFormatted: string;
  endFormatted: string;
  text: string;
  pinyin?: string;
  meaningVi?: string;
}

interface ScriptResult {
  lessonId?: string;
  fileId?: string;
  fileName: string;
  fileSize: number;
  duration: number;
  fullText: string;
  fullTranslation?: string;
  segments: Segment[];
  totalSegments: number;
  language: string;
  streamUrl?: string;
  downloadUrl?: string;
}

interface SavedAudioLesson {
  id: string;
  lessonId?: string;
  title: string;
  originalFileName?: string;
  savedAt: string;
  duration: number;
  fileSize?: number;
  fileUri: string;
  streamUrl?: string;
  downloadUrl?: string;
  gridFsFileId?: string;
  fullText: string;
  fullTranslation?: string;
  segments: Segment[];
  totalSegments: number;
}

import {
  DictationItem,
  parseSegmentsToDictationItems,
  formatSecs,
} from "../../src/utils/dictationParser";

export default function AudioScriptScreen() {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);
  const segmentPositions = useRef<{ [key: number]: number }>({});

  // File state
  const [selectedFile, setSelectedFile] = useState<{
    uri: string;
    name: string;
    size?: number;
    mimeType?: string;
    file?: any;
  } | null>(null);

  // Drag & drop state for Web
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Audio player state
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(0);
  const [trackWidth, setTrackWidth] = useState(0);
  const timelineRef = useRef<any>(null);
  const isSeekingRef = useRef<boolean>(false);

  // Transcribe state
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScriptResult | null>(null);
  const [activeTab, setActiveTab] = useState<"segments" | "dictation" | "fullText">("segments");
  const [showPinyin, setShowPinyin] = useState(true);
  const [showMeaning, setShowMeaning] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const [copiedNotice, setCopiedNotice] = useState(false);

  // ✍️ DICTATION (CHÉP CHÍNH TẢ) STATE
  const [currentDictIdx, setCurrentDictIdx] = useState(0);
  const [dictationInput, setDictationInput] = useState("");
  const [dictationStatus, setDictationStatus] = useState<"idle" | "correct" | "wrong" | "hint">("idle");
  const [solvedDictationItems, setSolvedDictationItems] = useState<Record<string, "correct" | "hint">>({});
  const [isSlowMode, setIsSlowMode] = useState(false);
  const [isLoopMode, setIsLoopMode] = useState(false);
  const [autoAdvance, setAutoAdvance] = useState(true);

  // Danh sách các câu chép chính tả phân tách theo dấu câu
  const dictationItems = useMemo(() => {
    if (!result?.segments || result.segments.length === 0) return [];
    return parseSegmentsToDictationItems(result.segments);
  }, [result?.segments]);

  const currentDictItem = dictationItems[currentDictIdx] || null;

  // Thống kê số câu đúng / xem gợi ý
  const correctCount = useMemo(() => {
    return Object.values(solvedDictationItems).filter((v) => v === "correct").length;
  }, [solvedDictationItems]);

  const hintCount = useMemo(() => {
    return Object.values(solvedDictationItems).filter((v) => v === "hint").length;
  }, [solvedDictationItems]);

  // Danh sách các ký tự để bấm điền nhanh (gồm ký tự câu + 2-3 chữ gây nhiễu)
  const characterOptions = useMemo(() => {
    if (!currentDictItem) return [];
    const targetChars = Array.from(currentDictItem.cleanText);
    const allChars = Array.from(new Set(Array.from(result?.fullText || ""))).filter(
      (c) => !targetChars.includes(c) && /[\u4e00-\u9fa5]/.test(c)
    );
    const distractors = allChars.slice(0, 3);
    const combined = [...targetChars, ...distractors];

    for (let i = combined.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [combined[i], combined[j]] = [combined[j], combined[i]];
    }
    return combined;
  }, [currentDictIdx, currentDictItem?.id, result?.fullText]);

  // Phát từng câu & lặp lại
  const [activePlayingSegmentId, setActivePlayingSegmentId] = useState<number | null>(null);
  const [loopingSegmentId, setLoopingSegmentId] = useState<number | null>(null);
  const lastActiveIdRef = useRef<number | null>(null);
  const segmentTimerRef = useRef<any>(null);

  // Thư viện bài nghe đã lưu
  const [savedLessons, setSavedLessons] = useState<SavedAudioLesson[]>([]);
  const [showLibraryModal, setShowLibraryModal] = useState(false);

  // ─── 🔍 TRA CỨU HÁN TỰ & TỪ VỰNG KHI HOLD / CLICK CHỮ ───
  const [hoveredChar, setHoveredChar] = useState<QuickCharTooltip | null>(null);
  const hoverTimeoutRef = useRef<any>(null);

  // Modal Khám phá từ vựng & Hán tự (hỗ trợ Breadcrumb Stack)
  const [exploreStack, setExploreStack] = useState<ExploreItem[]>([]);
  const [activePracticeCharIdx, setActivePracticeCharIdx] = useState(0);
  const [wordInsights, setWordInsights] = useState<WordInsightData | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);

  const activeExploreItem = exploreStack.length > 0 ? exploreStack[exploreStack.length - 1] : null;

  // Ký tự Hán tự hợp lệ của từ đang xem
  const activeHanziChars = useMemo(() => {
    if (!activeExploreItem?.word) return [];
    return Array.from(activeExploreItem.word).filter((c) => /[\u4e00-\u9fa5]/.test(c));
  }, [activeExploreItem?.word]);

  // Các từ ghép chứa từ đang xem
  const activeRelatedWords = useMemo(() => {
    if (!activeExploreItem?.word) return [];
    const directChar = activeExploreItem.word.trim();
    const offlineList = getRelatedWordsForChar(directChar, 18);
    const backendRelated = wordInsights?.relatedWords || [];
    const combined = [...offlineList];
    for (const b of backendRelated) {
      if (!combined.some((w) => w.word === b.word) && b.word !== directChar) {
        combined.push({
          word: b.word,
          pinyin: b.pinyin,
          meaning: b.meaning,
        });
      }
    }
    return combined;
  }, [activeExploreItem?.word, wordInsights?.relatedWords]);

  // Load danh sách bài nghe đã lưu khi mở trang
  useEffect(() => {
    loadSavedLessons();
  }, []);

  const loadSavedLessons = async () => {
    try {
      // 1. Tải nhanh từ AsyncStorage để hiển thị ngay lập tức
      const raw = await AsyncStorage.getItem(SAVED_LESSONS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSavedLessons(parsed);
        }
      }

      // 2. Tự động đồng bộ các bài nghe nhị phân từ MongoDB Atlas
      const cloudRes = await fetchSavedAudioLessons();
      if (cloudRes && cloudRes.success && Array.isArray(cloudRes.data)) {
        setSavedLessons(cloudRes.data);
        await AsyncStorage.setItem(SAVED_LESSONS_STORAGE_KEY, JSON.stringify(cloudRes.data));
      }
    } catch (err) {
      console.warn("Lỗi đọc bài nghe đã lưu:", err);
    }
  };

  // Cleanup sound khi unmount
  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync().catch(() => {});
      }
      if (segmentTimerRef.current) {
        clearTimeout(segmentTimerRef.current);
      }
      Speech.stop();
    };
  }, [sound]);

  // Phát riêng câu này từ file âm thanh gốc (từ start đến end)
  const playSegmentOnly = async (item: Segment) => {
    if (!sound) return;

    if (segmentTimerRef.current) {
      clearTimeout(segmentTimerRef.current);
    }

    if (activePlayingSegmentId === item.id && isPlaying) {
      await sound.pauseAsync();
      setIsPlaying(false);
      setActivePlayingSegmentId(null);
      return;
    }

    try {
      Speech.stop();
      setActivePlayingSegmentId(item.id);
      await sound.setPositionAsync(Math.max(0, item.start * 1000));
      await sound.playAsync();
      setIsPlaying(true);

      const durationMs = Math.max(600, (item.end - item.start) * 1000);
      segmentTimerRef.current = setTimeout(async () => {
        try {
          if (loopingSegmentId === item.id) {
            playSegmentOnly(item);
          } else {
            await sound.pauseAsync();
            setIsPlaying(false);
            setActivePlayingSegmentId(null);
          }
        } catch (e) {}
      }, durationMs);
    } catch (err: any) {
      console.warn("Lỗi phát từng câu:", err);
    }
  };

  // Đọc câu bằng giọng AI chuẩn tiếng Trung (TTS)
  const speakSentence = (text: string) => {
    try {
      if (sound && isPlaying) {
        sound.pauseAsync();
        setIsPlaying(false);
        setActivePlayingSegmentId(null);
      }
      Speech.stop();
      Speech.speak(text, {
        language: "zh-TW",
        rate: 0.85,
        pitch: 1.0,
      });
    } catch (e) {
      console.warn("TTS error:", e);
    }
  };

  // Tổng thời lượng chuẩn xác của bài nghe (tránh bị cắt cụt do stream buffer)
  const effectiveTotalDuration = useMemo(() => {
    const maxSegEnd = result?.segments?.length
      ? Math.max(...result.segments.map((s) => s.end || 0))
      : 0;
    return Math.max(playbackDuration || 0, result?.duration || 0, maxSegEnd || 0);
  }, [playbackDuration, result?.duration, result?.segments]);

  // Thiết lập audio file và khởi tạo trình phát
  const setupAudio = async (
    uri: string,
    name: string,
    size?: number,
    mimeType?: string,
    fileObj?: any,
    knownDuration?: number
  ) => {
    try {
      if (sound) {
        await sound.unloadAsync();
        setSound(null);
        setIsPlaying(false);
        setPlaybackPosition(0);
      }

      setCurrentDictIdx(0);
      setDictationInput("");
      setDictationStatus("idle");
      setSolvedDictationItems({});

      if (knownDuration && knownDuration > 0) {
        setPlaybackDuration(knownDuration);
      }

      setSelectedFile({
        uri,
        name,
        size,
        mimeType: mimeType || "audio/mpeg",
        file: fileObj || null,
      });

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });

      const { sound: newSound, status } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: false, progressUpdateIntervalMillis: 80 },
        onPlaybackStatusUpdate
      );

      setSound(newSound);
      if (status.isLoaded && status.durationMillis) {
        const durSec = status.durationMillis / 1000;
        setPlaybackDuration((prev) => Math.max(prev, durSec, knownDuration || 0));
      }
    } catch (err: any) {
      console.warn("Lỗi khởi tạo audio:", err);
    }
  };

  // Chọn file âm thanh qua DocumentPicker
  const handlePickDocument = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ["audio/*"],
        copyToCacheDirectory: true,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        const asset = res.assets[0];
        setResult(null);
        await setupAudio(
          asset.uri,
          asset.name,
          asset.size,
          asset.mimeType || "audio/mpeg",
          (asset as any).file || null
        );
      }
    } catch (err: any) {
      Alert.alert("Lỗi", "Không thể chọn file âm thanh: " + (err.message || ""));
    }
  };

  // Xử lý kéo thả file MP3 (Web HTML5 Drag & Drop)
  const handleDragOver = (e: any) => {
    if (e.preventDefault) e.preventDefault();
    if (e.stopPropagation) e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: any) => {
    if (e.preventDefault) e.preventDefault();
    if (e.stopPropagation) e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = async (e: any) => {
    if (e.preventDefault) e.preventDefault();
    if (e.stopPropagation) e.stopPropagation();
    setIsDraggingOver(false);

    try {
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        const file = files[0];
        const isAudio =
          file.type.startsWith("audio/") ||
          /\.(mp3|m4a|wav|aac|ogg|flac|webm)$/i.test(file.name);

        if (!isAudio) {
          Alert.alert("Định dạng không hỗ trợ", "Vui lòng chỉ thả file âm thanh (MP3, M4A, WAV, AAC, v.v.).");
          return;
        }

        setResult(null);
        const objectUrl = URL.createObjectURL(file);
        await setupAudio(objectUrl, file.name, file.size, file.type || "audio/mpeg", file);
      }
    } catch (err: any) {
      console.error("Lỗi thả file:", err);
    }
  };

  // Cập nhật trạng thái phát âm thanh & Tự động cuộn theo câu đang nói
  const onPlaybackStatusUpdate = (status: any) => {
    if (status.isLoaded) {
      if (!isSeekingRef.current) {
        const currentPos = status.positionMillis / 1000;
        setPlaybackPosition(currentPos);
      }
      if (status.durationMillis && status.durationMillis > 0) {
        const durSec = status.durationMillis / 1000;
        setPlaybackDuration((prev) => Math.max(prev, durSec, result?.duration || 0));
      }
      setIsPlaying(status.isPlaying);

      if (status.didJustFinish && !isSeekingRef.current) {
        const maxSegEnd = result?.segments?.length
          ? Math.max(...result.segments.map((s) => s.end || 0))
          : 0;
        const totalDur = Math.max(
          playbackDuration,
          result?.duration || 0,
          maxSegEnd,
          status.durationMillis ? status.durationMillis / 1000 : 0
        );
        const currentPos = status.positionMillis / 1000;

        // Chỉ kết thúc nếu thực sự đã phát tới cuối file âm thanh (cách đuôi < 1.5s)
        if (totalDur > 1.5 && currentPos >= totalDur - 1.5) {
          setIsPlaying(false);
          setActivePlayingSegmentId(null);
          setPlaybackPosition(0);
        }
      }

      if (status.isPlaying && result?.segments && autoScroll && !isSeekingRef.current) {
        const currentPos = status.positionMillis / 1000;
        const activeSeg = result.segments.find(
          (seg) => currentPos >= seg.start && currentPos <= seg.end
        );

        if (activeSeg && activeSeg.id !== lastActiveIdRef.current) {
          lastActiveIdRef.current = activeSeg.id;
          const targetY = segmentPositions.current[activeSeg.id];
          if (typeof targetY === "number" && scrollViewRef.current) {
            scrollViewRef.current.scrollTo({ y: Math.max(0, targetY - 120), animated: true });
          }
        }
      }
    }
  };

  const togglePlayPause = async () => {
    if (!sound) return;
    try {
      if (isPlaying) {
        await sound.pauseAsync();
      } else {
        await sound.playAsync();
      }
    } catch (e) {
      console.warn("Lỗi phát audio:", e);
    }
  };

  // Tua đoạn âm thanh đến giây cụ thể (chính xác, không bị giật reset hay cắt nửa bài)
  const seekToTime = async (seconds: number) => {
    if (!sound) return;
    try {
      if (segmentTimerRef.current) {
        clearTimeout(segmentTimerRef.current);
        segmentTimerRef.current = null;
      }
      setActivePlayingSegmentId(null);

      const totalDuration = effectiveTotalDuration;
      const clampedSeconds = Math.max(
        0,
        Math.min(seconds, totalDuration > 0 ? Math.max(0, totalDuration - 0.25) : seconds)
      );

      isSeekingRef.current = true;
      setPlaybackPosition(clampedSeconds);
      await sound.setPositionAsync(Math.floor(clampedSeconds * 1000));

      setTimeout(() => {
        isSeekingRef.current = false;
      }, 200);

      if (!isPlaying) {
        await sound.playAsync();
        setIsPlaying(true);
      }
    } catch (e) {
      isSeekingRef.current = false;
      console.warn("Lỗi seek audio:", e);
    }
  };

  // Tua qua lại nhanh +/- 5 giây
  const skipTime = async (deltaSeconds: number) => {
    if (!sound) return;
    seekToTime(playbackPosition + deltaSeconds);
  };

  // Xử lý click/tua trên thanh timeline bằng chuột hoặc chạm
  const handleTimelinePress = (e: any) => {
    const totalDuration = effectiveTotalDuration;
    if (!totalDuration || totalDuration <= 0) return;

    if (segmentTimerRef.current) {
      clearTimeout(segmentTimerRef.current);
      segmentTimerRef.current = null;
    }
    setActivePlayingSegmentId(null);
    setLoopingSegmentId(null);

    let ratio = 0;
    if (Platform.OS === "web" && timelineRef.current) {
      const node = timelineRef.current as any;
      const rect = node?.getBoundingClientRect ? node.getBoundingClientRect() : null;
      if (rect && rect.width > 0) {
        const clientX = e.nativeEvent?.clientX ?? e.clientX ?? (e.nativeEvent?.pageX ?? 0);
        const clickX = Math.max(0, Math.min(rect.width, clientX - rect.left));
        ratio = clickX / rect.width;
      } else if (trackWidth > 0) {
        const clickX = e.nativeEvent?.locationX ?? 0;
        ratio = Math.max(0, Math.min(1, clickX / trackWidth));
      }
    } else if (trackWidth > 0) {
      const clickX = e.nativeEvent?.locationX ?? 0;
      ratio = Math.max(0, Math.min(1, clickX / trackWidth));
    }

    const targetSeconds = Math.max(0, Math.min(Math.max(0, totalDuration - 0.25), ratio * totalDuration));
    seekToTime(targetSeconds);
  };

  // 🎵 BẤM VÀO CHỮ NÀO AUDIO PHÁT TỪ ĐÚNG VỊ TRÍ CHỮ ĐÓ
  const playFromChar = async (item: Segment, charIdx: number) => {
    const chars = Array.from(item.text);
    const segDuration = Math.max(0.1, item.end - item.start);
    const charStartTime = item.start + (charIdx / Math.max(1, chars.length)) * segDuration;

    if (sound) {
      Speech.stop();
      await seekToTime(charStartTime);
    } else {
      speakSentence(chars[charIdx]);
    }
  };

  // ─── 🔍 XỬ LÝ HOVER / HOLD CHUỘT VÀ CHI TIẾT TỪ VỰNG ───
  const handleCharHover = (char: string, item: Segment, charIdx: number) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    const info = getCharInfo(char);
    setHoveredChar({
      char,
      pinyin: info.pinyin,
      hanviet: info.hanviet,
      meaning: info.meaning || "Từ vựng tiếng Trung",
      item,
      charIdx,
    });
  };

  const handleCharLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredChar(null);
    }, 1200);
  };

  // Mở trang chi tiết từ vựng & Hán tự (Modal)
  const openWordDetail = (char: string, item?: Segment, charIdx?: number) => {
    setHoveredChar(null);
    const info = getCharInfo(char);
    let audioTimestamp: number | undefined = undefined;
    if (item) {
      const chars = Array.from(item.text);
      const segDuration = Math.max(0.1, item.end - item.start);
      audioTimestamp = item.start + ((charIdx ?? 0) / Math.max(1, chars.length)) * segDuration;
    }

    const initialItem: ExploreItem = {
      word: char,
      pinyin: info.pinyin,
      hanviet: info.hanviet,
      meaning: info.meaning,
      audioTimestamp,
      lessonTitle: result?.fileName || selectedFile?.name,
    };

    setActivePracticeCharIdx(0);
    setExploreStack([initialItem]);
    fetchInsights(char);
  };

  // Khám phá từ con (từ ghép, từ đồng nghĩa) trong Modal (push vào stack)
  const pushExploreWord = (word: string, pinyin?: string, meaning?: string) => {
    const info = getCharInfo(word);
    const newItem: ExploreItem = {
      word,
      pinyin: pinyin || info.pinyin,
      hanviet: info.hanviet,
      meaning: meaning || info.meaning,
    };
    setActivePracticeCharIdx(0);
    setExploreStack((prev) => [...prev, newItem]);
    fetchInsights(word);
  };

  // Quay lại từ trước trong stack
  const popExploreWord = () => {
    if (exploreStack.length <= 1) {
      closeWordDetail();
    } else {
      const nextStack = exploreStack.slice(0, exploreStack.length - 1);
      setExploreStack(nextStack);
      setActivePracticeCharIdx(0);
      const topWord = nextStack[nextStack.length - 1].word;
      fetchInsights(topWord);
    }
  };

  const closeWordDetail = () => {
    setExploreStack([]);
    setWordInsights(null);
    setActivePracticeCharIdx(0);
  };

  // Gọi backend API /api/kanji/insights để lấy từ đồng nghĩa, phân biệt và ngữ cảnh
  const fetchInsights = async (word: string) => {
    const cleanWord = word.trim();
    if (!cleanWord) return;
    setLoadingInsights(true);
    setWordInsights(null);
    try {
      const res = await api.get(`/kanji/insights?q=${encodeURIComponent(cleanWord)}`);
      if (res.data && res.data.success && res.data.data) {
        setWordInsights(res.data.data);
      }
    } catch (e) {
      console.warn("Lỗi tải insights từ backend:", e);
    } finally {
      setLoadingInsights(false);
    }
  };

  // ✍️ PHÁT ĐOẠN ÂM THANH RIÊNG CỦA CÂU CHÉP CHÍNH TẢ
  const playDictationSlice = async (item?: DictationItem | null, slow: boolean = isSlowMode) => {
    const targetItem = item || currentDictItem;
    if (!targetItem) return;
    try {
      if (segmentTimerRef.current) {
        clearTimeout(segmentTimerRef.current);
        segmentTimerRef.current = null;
      }
      Speech.stop();

      if (sound) {
        isSeekingRef.current = true;
        setPlaybackPosition(targetItem.start);
        await sound.setPositionAsync(Math.floor(targetItem.start * 1000));
        setTimeout(() => {
          isSeekingRef.current = false;
        }, 150);

        const playbackRate = slow ? 0.75 : 1.0;
        await sound.setRateAsync(playbackRate, true);
        await sound.playAsync();
        setIsPlaying(true);

        const durationMs = Math.max(500, Math.floor(((targetItem.end - targetItem.start) / playbackRate) * 1000));
        segmentTimerRef.current = setTimeout(async () => {
          try {
            if (isLoopMode) {
              playDictationSlice(targetItem, slow);
            } else {
              await sound.pauseAsync();
              setIsPlaying(false);
            }
          } catch (e) {}
        }, durationMs);
      } else {
        Speech.speak(targetItem.text, {
          language: "zh-TW",
          rate: slow ? 0.65 : 0.85,
        });
      }
    } catch (e) {
      console.warn("Lỗi phát audio slice dictation:", e);
    }
  };

  // ✍️ KIỂM TRA ĐÁP ÁN CHÉP CHÍNH TẢ
  const handleCheckDictation = () => {
    if (!currentDictItem) return;

    const userClean = dictationInput.replace(/[，,。\.！!？\?；;\s]/g, "").trim();
    const targetClean = currentDictItem.cleanText.replace(/[，,。\.！!？\?；;\s]/g, "").trim();

    if (userClean === targetClean && targetClean.length > 0) {
      setDictationStatus("correct");
      setSolvedDictationItems((prev) => ({
        ...prev,
        [currentDictItem.id]: prev[currentDictItem.id] || "correct",
      }));
      Speech.speak(currentDictItem.text, { language: "zh-TW", rate: 0.85 });

      if (autoAdvance && currentDictIdx < dictationItems.length - 1) {
        setTimeout(() => {
          handleNextDictationItem();
        }, 1500);
      }
    } else {
      setDictationStatus("wrong");
    }
  };

  // 💡 GỢI Ý XEM FULL CÂU
  const handleShowHint = () => {
    if (!currentDictItem) return;
    setDictationStatus("hint");
    setSolvedDictationItems((prev) => ({
      ...prev,
      [currentDictItem.id]: prev[currentDictItem.id] || "hint",
    }));
  };

  // 📝 TỰ ĐIỀN ĐÁP ÁN THEO GỢI Ý
  const handleFillDictationAnswer = () => {
    if (!currentDictItem) return;
    setDictationInput(currentDictItem.cleanText);
    setDictationStatus("correct");
    setSolvedDictationItems((prev) => ({
      ...prev,
      [currentDictItem.id]: prev[currentDictItem.id] || "hint",
    }));
  };

  // ➡️ CHUYỂN CÂU TIẾP THEO
  const handleNextDictationItem = () => {
    if (currentDictIdx < dictationItems.length - 1) {
      const nextIdx = currentDictIdx + 1;
      setCurrentDictIdx(nextIdx);
      setDictationInput("");
      setDictationStatus("idle");
      const nextItem = dictationItems[nextIdx];
      if (nextItem) {
        setTimeout(() => {
          playDictationSlice(nextItem, isSlowMode);
        }, 200);
      }
    }
  };

  // ⬅️ QUAY LẠI CÂU TRƯỚC
  const handlePrevDictationItem = () => {
    if (currentDictIdx > 0) {
      const prevIdx = currentDictIdx - 1;
      setCurrentDictIdx(prevIdx);
      setDictationInput("");
      setDictationStatus("idle");
      const prevItem = dictationItems[prevIdx];
      if (prevItem) {
        setTimeout(() => {
          playDictationSlice(prevItem, isSlowMode);
        }, 200);
      }
    }
  };

  // 🎯 CHỌN CÂU THEO SỐ THỨ TỰ
  const handleSelectDictationIndex = (idx: number) => {
    if (idx >= 0 && idx < dictationItems.length) {
      setCurrentDictIdx(idx);
      setDictationInput("");
      setDictationStatus("idle");
      const targetItem = dictationItems[idx];
      if (targetItem) {
        setTimeout(() => {
          playDictationSlice(targetItem, isSlowMode);
        }, 200);
      }
    }
  };

  // 🔄 CHUYỂN SANG TAB DICTATION
  const handleSwitchToDictation = () => {
    setActiveTab("dictation");
    if (dictationItems.length > 0) {
      const target = dictationItems[currentDictIdx] || dictationItems[0];
      setTimeout(() => {
        playDictationSlice(target, isSlowMode);
      }, 300);
    }
  };

  // Thực hiện bóc Script qua Backend (0 token, 0 Groq)
  const handleStartTranscribe = async () => {
    if (!selectedFile) {
      Alert.alert("Thông báo", "Vui lòng chọn hoặc kéo thả file MP3 trước khi thực hiện.");
      return;
    }

    try {
      setLoading(true);
      const res = await transcribeMp3File({
        uri: selectedFile.uri,
        name: selectedFile.name,
        type: selectedFile.mimeType || "audio/mpeg",
        language: "chinese",
        file: selectedFile.file,
      });

      if (res && res.success && res.data) {
        setResult(res.data);
        if (res.data.duration && res.data.duration > 0) {
          setPlaybackDuration((prev) => Math.max(prev, res.data.duration));
        }
      } else {
        Alert.alert("Lỗi", res?.error || "Không thể bóc script từ file âm thanh.");
      }
    } catch (err: any) {
      const errMsg = err?.response?.data?.error || err.message || "Lỗi mạng hoặc server không phản hồi.";
      Alert.alert("Thất bại", errMsg);
    } finally {
      setLoading(false);
    }
  };

  // 💾 LƯU LẠI BÀI NGHE VÀO MONGODB & THƯ VIỆN ĐỂ NGHE LẠI VĨNH VIỄN
  const handleSaveLesson = async () => {
    if (!result || !selectedFile) {
      Alert.alert("Thông báo", "Chưa có nội dung script để lưu.");
      return;
    }

    try {
      const lessonTitle = selectedFile.name.replace(/\.[^/.]+$/, "") || "Bài nghe tiếng Trung";
      const now = new Date();
      const formattedDate = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()} ${now.getHours()}:${now.getMinutes() < 10 ? "0" + now.getMinutes() : now.getMinutes()}`;

      // File ID từ GridFS (đã được lưu khi bóc script)
      const gridFsId = (result as any).fileId || (result as any).gridFsFileId || "";
      const streamUrl = (result as any).streamUrl
        ? getFullAudioStreamUrl((result as any).streamUrl)
        : getFullAudioStreamUrl(selectedFile.uri);

      // Lưu/Cập nhật lên MongoDB
      let cloudLessonId = (result as any).lessonId;
      if (!cloudLessonId && gridFsId) {
        try {
          const saveRes = await saveAudioLessonToCloud({
            gridFsFileId: gridFsId,
            title: lessonTitle,
            duration: result.duration,
            fileSize: result.fileSize,
            fullText: result.fullText,
            fullTranslation: result.fullTranslation,
            segments: result.segments,
          });
          if (saveRes && saveRes.success && saveRes.data) {
            cloudLessonId = saveRes.data._id;
          }
        } catch (e) {
          console.warn("Lưu bổ sung lên cloud:", e);
        }
      }

      const newLesson: SavedAudioLesson = {
        id: cloudLessonId || `audio_lesson_${Date.now()}`,
        lessonId: cloudLessonId,
        title: lessonTitle,
        originalFileName: selectedFile.name,
        savedAt: formattedDate,
        duration: result.duration,
        fileSize: result.fileSize,
        fileUri: streamUrl,
        streamUrl: streamUrl,
        downloadUrl: (result as any).downloadUrl ? getFullAudioDownloadUrl((result as any).downloadUrl) : "",
        gridFsFileId: gridFsId,
        fullText: result.fullText,
        fullTranslation: result.fullTranslation,
        segments: result.segments,
        totalSegments: result.totalSegments,
      };

      const updated = [newLesson, ...savedLessons.filter((l) => l.title !== lessonTitle && l.id !== newLesson.id)];
      await AsyncStorage.setItem(SAVED_LESSONS_STORAGE_KEY, JSON.stringify(updated));
      setSavedLessons(updated);

      Alert.alert(
        "Đã lưu thành công vào MongoDB! 🎉",
        `Bài nghe "${lessonTitle}" và dữ liệu nhị phân đã được lưu trên MongoDB Cloud. Bạn có thể mở lại nghe trên bất kỳ thiết bị nào!`
      );
    } catch (err: any) {
      Alert.alert("Lỗi", "Không thể lưu bài nghe: " + (err.message || ""));
    }
  };

  // 📥 TẢI FILE MP3 NHỊ PHÂN TỪ MONGODB VỀ MÁY
  const handleDownloadAudio = async (lesson: SavedAudioLesson) => {
    try {
      const fileId = lesson.gridFsFileId || (lesson as any).fileId || lesson.id;
      const downloadUrl = getFullAudioDownloadUrl(lesson.downloadUrl || fileId);

      if (Platform.OS === "web") {
        if (typeof window !== "undefined") {
          const a = document.createElement("a");
          a.href = downloadUrl;
          a.download = `${lesson.title}.mp3`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
      } else {
        await WebBrowser.openBrowserAsync(downloadUrl).catch(async () => {
          await Share.share({
            title: `Tải file: ${lesson.title}`,
            url: downloadUrl,
            message: `Tải file âm thanh: ${lesson.title} - ${downloadUrl}`,
          });
        });
      }
    } catch (e: any) {
      Alert.alert("Lỗi tải file", e.message || "Không thể tải file âm thanh.");
    }
  };

  // 🗑️ XÓA VĨNH VIỄN BÀI NGHE & FILE NHỊ PHÂN TRÊN MONGODB
  const handleDeleteLesson = (id: string, title: string) => {
    Alert.alert(
      "Xác nhận xóa vĩnh viễn",
      `Bạn có chắc chắn muốn xóa bài nghe "${title}"?\n\nThao tác này sẽ xóa vĩnh viễn cả bài học và file âm thanh nhị phân trên MongoDB Atlas.`,
      [
        { text: "Hủy bỏ", style: "cancel" },
        {
          text: "Xóa khỏi MongoDB",
          style: "destructive",
          onPress: async () => {
            try {
              // 1. Gọi API xóa triệt để bài học và file nhị phân trong MongoDB GridFS
              await deleteAudioLessonFromCloud(id);

              // 2. Cập nhật state và bộ nhớ đệm
              const updated = savedLessons.filter(
                (l) => l.id !== id && (l as any).lessonId !== id && (l as any).gridFsFileId !== id
              );
              await AsyncStorage.setItem(SAVED_LESSONS_STORAGE_KEY, JSON.stringify(updated));
              setSavedLessons(updated);

              Alert.alert(
                "Đã xóa thành công",
                `Bài nghe "${title}" và dữ liệu nhị phân đã được xóa vĩnh viễn khỏi MongoDB!`
              );
            } catch (e: any) {
              console.warn("Lỗi xóa bài nghe:", e);
              const updated = savedLessons.filter(
                (l) => l.id !== id && (l as any).lessonId !== id && (l as any).gridFsFileId !== id
              );
              await AsyncStorage.setItem(SAVED_LESSONS_STORAGE_KEY, JSON.stringify(updated));
              setSavedLessons(updated);
              Alert.alert("Đã xóa", `Đã xóa bài nghe khỏi danh sách.`);
            }
          },
        },
      ]
    );
  };

  // ✂️ XÓA ĐOẠN / CÂU ÂM THANH KHÔNG CẦN KHỎI SCRIPT
  const handleDeleteSegment = (segmentId: number) => {
    if (!result) return;
    const filtered = result.segments.filter((s) => s.id !== segmentId);
    setResult({
      ...result,
      segments: filtered,
      totalSegments: filtered.length,
    });
  };

  // 🎧 MỞ LẠI BÀI NGHE ĐÃ LƯU
  const handleOpenLesson = async (lesson: SavedAudioLesson) => {
    setShowLibraryModal(false);
    setResult({
      lessonId: lesson.lessonId || lesson.id,
      fileId: lesson.gridFsFileId,
      fileName: lesson.title,
      fileSize: lesson.fileSize || 0,
      duration: lesson.duration,
      fullText: lesson.fullText,
      fullTranslation: lesson.fullTranslation,
      segments: lesson.segments,
      totalSegments: lesson.totalSegments || lesson.segments?.length || 0,
      language: "chinese",
      streamUrl: lesson.streamUrl,
      downloadUrl: lesson.downloadUrl,
    });

    if (lesson.duration && lesson.duration > 0) {
      setPlaybackDuration(lesson.duration);
    }

    const persistentStreamUri = getFullAudioStreamUrl(lesson.streamUrl || lesson.gridFsFileId || lesson.fileUri);
    await setupAudio(persistentStreamUri, lesson.title, lesson.fileSize, undefined, undefined, lesson.duration);
    setActiveTab("segments");
  };

  const handleShareOrCopy = async (text: string) => {
    try {
      await Share.share({
        message: text,
        title: "Script bài nghe tiếng Trung",
      });
      setCopiedNotice(true);
      setTimeout(() => setCopiedNotice(false), 2500);
    } catch (e) {}
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "0 MB";
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  const formatDisplayTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m < 10 ? "0" + m : m}:${s < 10 ? "0" + s : s}`;
  };

  const onSegmentLayout = (id: number, event: LayoutChangeEvent) => {
    segmentPositions.current[id] = event.nativeEvent.layout.y;
  };

  const isCurrentLessonSaved =
    result &&
    selectedFile &&
    savedLessons.some((l) => l.title === selectedFile.name.replace(/\.[^/.]+$/, ""));

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* ─── HEADER ─── */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
            paddingTop: insets.top > 0 ? insets.top + 8 : (Platform.OS === "android" ? 44 : 20),
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backBtn, { borderColor: colors.border }]}
          activeOpacity={0.7}
        >
          <MaterialIcons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Bóc Script MP3</Text>
          <View style={styles.freeBadge}>
            <View style={styles.greenDot} />
            <Text style={styles.freeBadgeText}>Karaoke chữ xanh lá · Song ngữ Trung - Việt</Text>
          </View>
        </View>

        {/* Nút mở thư viện bài nghe đã lưu */}
        <TouchableOpacity
          onPress={() => setShowLibraryModal(true)}
          style={[styles.libraryBtn, { borderColor: colors.border }]}
          activeOpacity={0.7}
        >
          <MaterialIcons name="folder-special" size={20} color={colors.amber || "#CFAC62"} />
          {savedLessons.length > 0 && (
            <View style={styles.libraryBadge}>
              <Text style={styles.libraryBadgeText}>{savedLessons.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 130 }}
      >
        {/* ─── 1/ VÙNG KÉO THẢ FILE MP3 (DRAG & DROP ZONE) ─── */}
        <Animated.View entering={FadeInDown.duration(400)}>
          {!selectedFile ? (
            <View
              {...({
                onDragOver: handleDragOver,
                onDragEnter: handleDragOver,
                onDragLeave: handleDragLeave,
                onDrop: handleDrop,
              } as any)}
              style={[
                styles.uploadCard,
                {
                  backgroundColor: isDraggingOver
                    ? (isDark ? "rgba(16, 185, 129, 0.15)" : "#ECFDF5")
                    : colors.surface,
                  borderColor: isDraggingOver
                    ? "#10B981"
                    : (isDark ? "rgba(207, 172, 98, 0.4)" : "rgba(139, 105, 20, 0.3)"),
                },
              ]}
            >
              <TouchableOpacity
                onPress={handlePickDocument}
                activeOpacity={0.8}
                style={{ alignItems: "center", width: "100%" }}
              >
                <View
                  style={[
                    styles.uploadIconWrap,
                    {
                      backgroundColor: isDraggingOver
                        ? "#10B981"
                        : (isDark ? "#1C1408" : "#FEF3C7"),
                    },
                  ]}
                >
                  <MaterialIcons
                    name={isDraggingOver ? "file-download" : "audiotrack"}
                    size={38}
                    color={isDraggingOver ? "#FFFFFF" : (colors.amber || "#CFAC62")}
                  />
                </View>

                <Text style={[styles.uploadTitle, { color: isDraggingOver ? "#10B981" : colors.text }]}>
                  {isDraggingOver ? "Thả file MP3 vào đây ngay!" : "Kéo thả hoặc Chọn file MP3"}
                </Text>

                <Text style={[styles.uploadSub, { color: colors.textMuted }]}>
                  {Platform.OS === "web"
                    ? "Kéo thả file MP3/M4A từ máy tính vào vùng này, hoặc bấm để chọn tệp"
                    : "Chạm để chọn file MP3, M4A, WAV từ thiết bị (Tối đa 50MB)"}
                </Text>

                <View style={[styles.uploadActionBtn, { backgroundColor: colors.indigo || "#4F46E5" }]}>
                  <MaterialIcons name="file-upload" size={18} color="#FFFFFF" />
                  <Text style={styles.uploadActionBtnText}>Chọn từ thiết bị</Text>
                </View>

                {savedLessons.length > 0 && (
                  <TouchableOpacity
                    onPress={() => setShowLibraryModal(true)}
                    style={styles.openLibraryQuickBtn}
                    activeOpacity={0.7}
                  >
                    <MaterialIcons name="history" size={16} color={colors.amber || "#CFAC62"} />
                    <Text style={[styles.openLibraryQuickText, { color: colors.amber || "#CFAC62" }]}>
                      Xem {savedLessons.length} bài nghe đã lưu trong thư viện
                    </Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View
              style={[
                styles.fileSelectedCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View style={styles.fileInfoRow}>
                <View style={[styles.fileIconSmall, { backgroundColor: isDark ? "#1C1408" : "#FEF3C7" }]}>
                  <MaterialIcons name="audio-file" size={26} color={colors.amber || "#CFAC62"} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.fileName, { color: colors.text }]} numberOfLines={1}>
                    {selectedFile.name}
                  </Text>
                  <Text style={[styles.fileMeta, { color: colors.textMuted }]}>
                    {formatFileSize(selectedFile.size)} · Tiếng Trung Phồn Thể
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={handlePickDocument}
                  style={[styles.changeFileBtn, { borderColor: colors.border }]}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="swap-horiz" size={18} color={colors.indigo} />
                  <Text style={[styles.changeFileText, { color: colors.indigo }]}>Đổi file</Text>
                </TouchableOpacity>
              </View>

              {/* ─── 2/ TRÌNH PHÁT VÀ THANH TUA ÂM THANH BẰNG CHUỘT (SEEKABLE SCRUBBER) ─── */}
              <View style={[styles.playerContainer, { backgroundColor: isDark ? "#120E08" : "#F8F6F0" }]}>
                {/* Nút lùi 5s */}
                <TouchableOpacity
                  onPress={() => skipTime(-5)}
                  style={[styles.skipBtn, { borderColor: colors.border }]}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="replay-5" size={20} color={colors.text} />
                </TouchableOpacity>

                {/* Nút Play/Pause chính */}
                <TouchableOpacity
                  onPress={togglePlayPause}
                  style={[styles.playPauseBtn, { backgroundColor: colors.indigo || "#4F46E5" }]}
                  activeOpacity={0.8}
                >
                  <MaterialIcons
                    name={isPlaying ? "pause" : "play-arrow"}
                    size={24}
                    color="#FFFFFF"
                  />
                </TouchableOpacity>

                {/* Nút tiến 5s */}
                <TouchableOpacity
                  onPress={() => skipTime(5)}
                  style={[styles.skipBtn, { borderColor: colors.border }]}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="forward-5" size={20} color={colors.text} />
                </TouchableOpacity>

                  {/* Thanh tua âm thanh tương tác bằng chuột/chạm */}
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <View style={styles.timeRow}>
                    <Text style={[styles.timeText, { color: "#10B981", fontWeight: "700" }]}>
                      {formatDisplayTime(playbackPosition)}
                    </Text>
                    <Text style={[styles.timeText, { color: colors.textMuted }]}>
                      {formatDisplayTime(effectiveTotalDuration)}
                    </Text>
                  </View>

                  {/* Vùng bấm tua chuột */}
                  <TouchableOpacity
                    ref={timelineRef}
                    activeOpacity={1}
                    onPress={handleTimelinePress}
                    onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
                    style={styles.timelineHitArea}
                  >
                    <View pointerEvents="none" style={styles.progressBg}>
                      <View
                        pointerEvents="none"
                        style={[
                          styles.progressFill,
                          {
                            backgroundColor: "#10B981",
                            width: `${effectiveTotalDuration > 0 ? Math.min(100, Math.max(0, (playbackPosition / effectiveTotalDuration) * 100)) : 0}%`,
                          },
                        ]}
                      />
                      {/* Scrubber Thumb (nút tròn báo vị trí hiện tại) */}
                      <View
                        pointerEvents="none"
                        style={[
                          styles.scrubberThumb,
                          {
                            left: `${effectiveTotalDuration > 0 ? Math.min(98, Math.max(0, (playbackPosition / effectiveTotalDuration) * 100)) : 0}%`,
                          },
                        ]}
                      />
                    </View>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Action Button: Bóc script */}
              {!result && (
                <TouchableOpacity
                  onPress={handleStartTranscribe}
                  disabled={loading}
                  activeOpacity={0.8}
                  style={[
                    styles.transcribeBtn,
                    {
                      backgroundColor: loading
                        ? colors.border
                        : (colors.indigo || "#4F46E5"),
                    },
                  ]}
                >
                  {loading ? (
                    <View style={styles.loadingRow}>
                      <ActivityIndicator size="small" color="#FFFFFF" />
                      <Text style={styles.transcribeBtnText}>
                        Đang trích xuất tiếng Trung & dịch tiếng Việt...
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.loadingRow}>
                      <MaterialIcons name="transcribe" size={20} color="#FFFFFF" />
                      <Text style={styles.transcribeBtnText}>Bắt đầu bóc Script & Dịch song ngữ</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
            </View>
          )}
        </Animated.View>

        {/* ─── LOADING STATE ─── */}
        {loading && (
          <Animated.View entering={FadeInDown.duration(400)} style={{ marginTop: 16 }}>
            <View
              style={[
                styles.processingCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <ActivityIndicator size="large" color="#10B981" />
              <Text style={[styles.processingTitle, { color: colors.text }]}>
                Đang nhận dạng tiếng Trung & sinh bản dịch tiếng Việt
              </Text>
              <Text style={[styles.processingDesc, { color: colors.textMuted }]}>
                Hệ thống đang gắn mốc thời gian (timestamp) cho từng câu và dịch nghĩa tương ứng theo thời gian thực...
              </Text>
            </View>
          </Animated.View>
        )}

        {/* ─── KẾT QUẢ SCRIPT SONG NGỮ & KARAOKE HIGHLIGHT ─── */}
        {result && (
          <Animated.View entering={FadeInDown.duration(500)} style={{ marginTop: 20 }}>
            {/* Stats Bar */}
            <View
              style={[
                styles.resultStatsBar,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View style={styles.statCol}>
                <Text style={[styles.statVal, { color: "#10B981" }]}>
                  {formatDisplayTime(result.duration)}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Thời lượng</Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
              <View style={styles.statCol}>
                <Text style={[styles.statVal, { color: colors.text }]}>
                  {result.totalSegments}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Số câu</Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
              <View style={styles.statCol}>
                <Text style={[styles.statVal, { color: colors.amber || "#CFAC62" }]}>
                  Song ngữ
                </Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Trung - Việt</Text>
              </View>
            </View>

            {/* Điều khiển hiển thị & Tự động cuộn */}
            <View style={styles.controlsRow}>
              <TouchableOpacity
                onPress={() => setShowPinyin(!showPinyin)}
                style={[
                  styles.filterPill,
                  showPinyin && { backgroundColor: isDark ? "#1C1408" : "#FEF3C7", borderColor: colors.amber },
                ]}
                activeOpacity={0.7}
              >
                <MaterialIcons
                  name={showPinyin ? "visibility" : "visibility-off"}
                  size={15}
                  color={showPinyin ? (colors.amber || "#CFAC62") : colors.textMuted}
                />
                <Text
                  style={[
                    styles.filterPillText,
                    { color: showPinyin ? (colors.amber || "#CFAC62") : colors.textMuted },
                  ]}
                >
                  Pinyin
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setShowMeaning(!showMeaning)}
                style={[
                  styles.filterPill,
                  showMeaning && { backgroundColor: isDark ? "rgba(16, 185, 129, 0.15)" : "#ECFDF5", borderColor: "#10B981" },
                ]}
                activeOpacity={0.7}
              >
                <MaterialIcons
                  name={showMeaning ? "translate" : "language"}
                  size={15}
                  color={showMeaning ? "#10B981" : colors.textMuted}
                />
                <Text
                  style={[
                    styles.filterPillText,
                    { color: showMeaning ? "#10B981" : colors.textMuted },
                  ]}
                >
                  Dịch tiếng Việt
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setAutoScroll(!autoScroll)}
                style={[
                  styles.filterPill,
                  autoScroll && { backgroundColor: isDark ? "#12142A" : "#EEF2FF", borderColor: colors.indigo },
                ]}
                activeOpacity={0.7}
              >
                <MaterialIcons
                  name={autoScroll ? "sync" : "sync-disabled"}
                  size={15}
                  color={autoScroll ? (colors.indigo || "#4F46E5") : colors.textMuted}
                />
                <Text
                  style={[
                    styles.filterPillText,
                    { color: autoScroll ? (colors.indigo || "#4F46E5") : colors.textMuted },
                  ]}
                >
                  Cuộn theo câu
                </Text>
              </TouchableOpacity>
            </View>

            {/* Segment / Dictation / Fulltext Toggle */}
            <View style={styles.tabToggleRow}>
              <TouchableOpacity
                onPress={() => setActiveTab("segments")}
                style={[
                  styles.tabToggleBtn,
                  activeTab === "segments" && [
                    styles.tabToggleActive,
                    { backgroundColor: colors.surface, borderColor: "#10B981" },
                  ],
                ]}
                activeOpacity={0.8}
              >
                <MaterialIcons
                  name="subtitles"
                  size={16}
                  color={activeTab === "segments" ? "#10B981" : colors.textMuted}
                />
                <Text
                  style={[
                    styles.tabToggleText,
                    {
                      color: activeTab === "segments" ? "#10B981" : colors.textMuted,
                      fontWeight: activeTab === "segments" ? "700" : "500",
                    },
                  ]}
                  numberOfLines={1}
                >
                  Karaoke ({result.segments.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSwitchToDictation}
                style={[
                  styles.tabToggleBtn,
                  activeTab === "dictation" && [
                    styles.tabToggleActive,
                    { backgroundColor: colors.surface, borderColor: "#10B981" },
                  ],
                ]}
                activeOpacity={0.8}
              >
                <MaterialIcons
                  name="edit-note"
                  size={18}
                  color={activeTab === "dictation" ? "#10B981" : colors.textMuted}
                />
                <Text
                  style={[
                    styles.tabToggleText,
                    {
                      color: activeTab === "dictation" ? "#10B981" : colors.textMuted,
                      fontWeight: activeTab === "dictation" ? "700" : "500",
                    },
                  ]}
                  numberOfLines={1}
                >
                  Chép chính tả ({dictationItems.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setActiveTab("fullText")}
                style={[
                  styles.tabToggleBtn,
                  activeTab === "fullText" && [
                    styles.tabToggleActive,
                    { backgroundColor: colors.surface, borderColor: "#10B981" },
                  ],
                ]}
                activeOpacity={0.8}
              >
                <MaterialIcons
                  name="menu-book"
                  size={16}
                  color={activeTab === "fullText" ? "#10B981" : colors.textMuted}
                />
                <Text
                  style={[
                    styles.tabToggleText,
                    {
                      color: activeTab === "fullText" ? "#10B981" : colors.textMuted,
                      fontWeight: activeTab === "fullText" ? "700" : "500",
                    },
                  ]}
                  numberOfLines={1}
                >
                  Toàn văn
                </Text>
              </TouchableOpacity>
            </View>

            {/* ─── DANH SÁCH TỪNG CÂU + DỊCH TIẾNG VIỆT + Ô XANH LÁ CHỈ RÕ TỪNG CHỮ ─── */}
            {activeTab === "segments" && (
              <View style={{ marginTop: 12 }}>
                {result.segments.map((item, idx) => {
                  const isCurrent =
                    playbackPosition >= item.start &&
                    playbackPosition < item.end &&
                    (isPlaying || playbackPosition > 0);

                  const isCurrentSegmentPlaying = activePlayingSegmentId === item.id && isPlaying;

                  // Tính toán vị trí ký tự đang được đọc trong câu
                  const chars = Array.from(item.text);
                  const segDuration = Math.max(0.1, item.end - item.start);
                  const elapsed = Math.max(0, playbackPosition - item.start);
                  const progressRatio = Math.min(1, Math.max(0, elapsed / segDuration));
                  const activeCharIndex = Math.min(chars.length - 1, Math.floor(progressRatio * chars.length));
                  const activeChar = isCurrent ? chars[activeCharIndex] : "";

                  return (
                    <TouchableOpacity
                      key={item.id ?? idx}
                      activeOpacity={0.85}
                      onLayout={(e) => onSegmentLayout(item.id ?? idx, e)}
                      onPress={() => seekToTime(item.start)}
                      style={[
                        styles.segmentCard,
                        {
                          backgroundColor: isCurrent
                            ? (isDark ? "rgba(16, 185, 129, 0.16)" : "#F0FDF4")
                            : colors.surface,
                          borderColor: isCurrent
                            ? "#10B981"
                            : colors.border,
                          borderWidth: isCurrent ? 2 : 1,
                        },
                      ]}
                    >
                      <View style={styles.segmentTopRow}>
                        <View style={styles.segmentActionsLeft}>
                          {/* Timestamp badge */}
                          <View
                            style={[
                              styles.timestampBadge,
                              {
                                backgroundColor: isCurrent
                                  ? "#10B981"
                                  : (isDark ? "#1C1408" : "#FEF3C7"),
                              },
                            ]}
                          >
                            <MaterialIcons
                              name={isCurrent ? "volume-up" : "access-time"}
                              size={12}
                              color={isCurrent ? "#FFFFFF" : (colors.amber || "#CFAC62")}
                            />
                            <Text
                              style={[
                                styles.timestampText,
                                { color: isCurrent ? "#FFFFFF" : (colors.amber || "#CFAC62") },
                              ]}
                            >
                              {item.startFormatted} - {item.endFormatted}
                            </Text>
                          </View>

                          {/* 🔊 NÚT PHÁT NGHE CÂU NÀY TỪ AUDIO GỐC */}
                          <TouchableOpacity
                            onPress={(e) => {
                              if (e.stopPropagation) e.stopPropagation();
                              playSegmentOnly(item);
                            }}
                            style={[
                              styles.actionPillBtn,
                              {
                                backgroundColor: isCurrentSegmentPlaying
                                  ? "#10B981"
                                  : (isDark ? "rgba(16, 185, 129, 0.15)" : "#ECFDF5"),
                                borderColor: isCurrentSegmentPlaying
                                  ? "#10B981"
                                  : "rgba(16, 185, 129, 0.4)",
                              },
                            ]}
                            activeOpacity={0.7}
                          >
                            <MaterialIcons
                              name={isCurrentSegmentPlaying ? "pause" : "play-arrow"}
                              size={14}
                              color={isCurrentSegmentPlaying ? "#FFFFFF" : "#10B981"}
                            />
                            <Text
                              style={[
                                styles.actionPillText,
                                { color: isCurrentSegmentPlaying ? "#FFFFFF" : "#10B981" },
                              ]}
                            >
                              {isCurrentSegmentPlaying ? "Đang phát" : "Nghe câu"}
                            </Text>
                          </TouchableOpacity>

                          {/* 🗣️ NÚT ĐỌC BẰNG GIỌNG AI (TTS) */}
                          <TouchableOpacity
                            onPress={(e) => {
                              if (e.stopPropagation) e.stopPropagation();
                              speakSentence(item.text);
                            }}
                            style={[
                              styles.actionPillBtn,
                              {
                                backgroundColor: isDark ? "rgba(79, 70, 229, 0.15)" : "#EEF2FF",
                                borderColor: "rgba(79, 70, 229, 0.35)",
                              },
                            ]}
                            activeOpacity={0.7}
                          >
                            <MaterialIcons
                              name="record-voice-over"
                              size={13}
                              color={colors.indigo || "#4F46E5"}
                            />
                            <Text
                              style={[
                                styles.actionPillText,
                                { color: colors.indigo || "#4F46E5" },
                              ]}
                            >
                              Đọc AI
                            </Text>
                          </TouchableOpacity>

                          {/* 🔁 NÚT LẶP CÂU NÀY */}
                          <TouchableOpacity
                            onPress={(e) => {
                              if (e.stopPropagation) e.stopPropagation();
                              if (loopingSegmentId === item.id) {
                                setLoopingSegmentId(null);
                              } else {
                                setLoopingSegmentId(item.id);
                                playSegmentOnly(item);
                              }
                            }}
                            style={[
                              styles.actionIconBtn,
                              {
                                backgroundColor: loopingSegmentId === item.id
                                  ? "rgba(16, 185, 129, 0.25)"
                                  : "transparent",
                                borderColor: loopingSegmentId === item.id ? "#10B981" : colors.border,
                              },
                            ]}
                            activeOpacity={0.7}
                          >
                            <MaterialIcons
                              name="repeat"
                              size={14}
                              color={loopingSegmentId === item.id ? "#10B981" : colors.textMuted}
                            />
                          </TouchableOpacity>
                        </View>

                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <TouchableOpacity
                            onPress={() => handleShareOrCopy(`${item.text}\n${item.pinyin || ""}\n${item.meaningVi || ""}`)}
                            style={styles.copySingleBtn}
                            activeOpacity={0.6}
                          >
                            <MaterialIcons name="content-copy" size={16} color={colors.textMuted} />
                          </TouchableOpacity>

                          <TouchableOpacity
                            onPress={(e) => {
                              if (e.stopPropagation) e.stopPropagation();
                              handleDeleteSegment(item.id);
                            }}
                            style={styles.deleteSingleSegmentBtn}
                            activeOpacity={0.6}
                          >
                            <MaterialIcons name="close" size={16} color={colors.textMuted} />
                          </TouchableOpacity>
                        </View>
                      </View>

                      {/* 🟢 KHUNG TOOLTIP NỔI KHI HOVER / HOLD CHUỘT VÀO CHỮ */}
                      {hoveredChar && hoveredChar.item.id === item.id && (
                        <View
                          style={[
                            styles.charTooltipCard,
                            {
                              backgroundColor: isDark ? "#1C1917" : "#FFFFFF",
                              borderColor: colors.amber || "#F59E0B",
                            },
                          ]}
                        >
                          <View style={styles.charTooltipHeader}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                              <Text style={[styles.charTooltipChar, { color: colors.amber || "#F59E0B" }]}>
                                {hoveredChar.char}
                              </Text>
                              {!!hoveredChar.pinyin && (
                                <View style={styles.charTooltipPinyinBadge}>
                                  <Text style={styles.charTooltipPinyinText}>{hoveredChar.pinyin}</Text>
                                </View>
                              )}
                              {!!hoveredChar.hanviet && (
                                <Text style={[styles.charTooltipHanviet, { color: colors.textMuted }]}>
                                  [{hoveredChar.hanviet}]
                                </Text>
                              )}
                            </View>

                            <TouchableOpacity
                              onPress={() => setHoveredChar(null)}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              style={styles.charTooltipCloseBtn}
                            >
                              <MaterialIcons name="close" size={16} color={colors.textMuted} />
                            </TouchableOpacity>
                          </View>

                          <Text style={[styles.charTooltipMeaning, { color: colors.text }]}>
                            🇻🇳 {hoveredChar.meaning || "Từ vựng tiếng Trung"}
                          </Text>

                          <View style={styles.charTooltipActions}>
                            <TouchableOpacity
                              onPress={() => speakSentence(hoveredChar.char)}
                              style={[
                                styles.charTooltipActionBtn,
                                { backgroundColor: isDark ? "#292524" : "#F3F4F6" },
                              ]}
                            >
                              <MaterialIcons name="volume-up" size={14} color="#10B981" />
                              <Text style={[styles.charTooltipActionText, { color: colors.text }]}>Phát âm</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              onPress={() => playFromChar(hoveredChar.item, hoveredChar.charIdx)}
                              style={[
                                styles.charTooltipActionBtn,
                                { backgroundColor: isDark ? "#292524" : "#F3F4F6" },
                              ]}
                            >
                              <MaterialIcons name="play-circle-outline" size={14} color="#3B82F6" />
                              <Text style={[styles.charTooltipActionText, { color: colors.text }]}>
                                Nghe từ chữ này
                              </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              onPress={() => openWordDetail(hoveredChar.char, hoveredChar.item, hoveredChar.charIdx)}
                              style={[
                                styles.charTooltipActionBtn,
                                { backgroundColor: colors.amber || "#F59E0B" },
                              ]}
                            >
                              <MaterialIcons name="auto-stories" size={14} color="#FFFFFF" />
                              <Text style={[styles.charTooltipActionText, { color: "#FFFFFF", fontWeight: "700" }]}>
                                Chi tiết từ & Hán tự
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}

                      {/* 🟢 Ô XANH LÁ HIỆN ĐANG NÓI Ở CHỮ NÀO (LIVE CALLOUT) */}
                      {isCurrent && !!activeChar && (
                        <View style={styles.activeCharCallout}>
                          <View style={styles.pulsingDot} />
                          <Text style={styles.activeCharCalloutLabel}>Đang nói chữ:</Text>
                          <View style={styles.activeCharBadge}>
                            <Text style={styles.activeCharBadgeText}>{activeChar}</Text>
                          </View>
                        </View>
                      )}

                      {/* 🟢 CHỮ TIẾNG TRUNG: HOLD / HOVER XEM NGHĨA - BẤM MỞ TRANG CHI TIẾT */}
                      <View style={styles.karaokeTextWrap}>
                        {chars.map((char, charIdx) => {
                          const isThisChar = isCurrent && charIdx === activeCharIndex;
                          const isSpoken = isCurrent && charIdx < activeCharIndex;
                          const isHovered = hoveredChar?.item.id === item.id && hoveredChar?.charIdx === charIdx;

                          return (
                            <TouchableOpacity
                              key={charIdx}
                              activeOpacity={0.7}
                              onLongPress={() => handleCharHover(char, item, charIdx)}
                              delayLongPress={180}
                              onPress={(e) => {
                                if ((e as any)?.stopPropagation) (e as any).stopPropagation();
                                openWordDetail(char, item, charIdx);
                              }}
                              {...(Platform.OS === "web"
                                ? {
                                    onMouseEnter: () => handleCharHover(char, item, charIdx),
                                    onMouseLeave: handleCharLeave,
                                  }
                                : {})}
                              style={[
                                styles.charBox,
                                isThisChar && styles.activeCharBoxHighlight,
                                isHovered && styles.hoveredCharBoxHighlight,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.segmentCharText,
                                  {
                                    color: isThisChar
                                      ? "#FFFFFF"
                                      : isHovered
                                      ? (colors.amber || "#F59E0B")
                                      : isSpoken
                                      ? (isDark ? "#34D399" : "#059669")
                                      : colors.text,
                                    fontWeight: isThisChar || isHovered ? "900" : isSpoken ? "800" : "600",
                                  },
                                ]}
                              >
                                {char}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      {/* PINYIN (Bính âm có dấu) */}
                      {showPinyin && !!item.pinyin && (
                        <Text
                          style={[
                            styles.segmentPinyin,
                            {
                              color: isCurrent
                                ? (isDark ? "#6EE7B7" : "#059669")
                                : (colors.amber || "#CFAC62"),
                            },
                          ]}
                        >
                          {item.pinyin}
                        </Text>
                      )}

                      {/* DỊCH TIẾNG VIỆT BÊN DƯỚI TỪNG CÂU */}
                      {showMeaning && (
                        <View style={[styles.meaningContainer, { borderTopColor: isCurrent ? "rgba(16, 185, 129, 0.25)" : colors.border }]}>
                          <View style={styles.meaningRow}>
                            <Text style={styles.vnFlag}>🇻🇳</Text>
                            <Text
                              style={[
                                styles.segmentMeaning,
                                {
                                  color: isCurrent
                                    ? (isDark ? "#A7F3D0" : "#065F46")
                                    : (isDark ? "#D1D5DB" : "#4B5563"),
                                  fontWeight: isCurrent ? "600" : "400",
                                },
                              ]}
                            >
                              {item.meaningVi || "Chưa có bản dịch."}
                            </Text>
                          </View>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* ─── TAB 2: CHÉP CHÍNH TẢ (DICTATION) TỪNG CÂU TỪNG DẤU ─── */}
            {activeTab === "dictation" && (
              <View style={{ marginTop: 12 }}>
                {dictationItems.length === 0 ? (
                  <View style={[styles.dictationCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <MaterialIcons name="edit-note" size={32} color={colors.textMuted} />
                    <Text style={[styles.dictEmptyTitle, { color: colors.text }]}>
                      Chưa có câu nào để luyện chép chính tả
                    </Text>
                  </View>
                ) : (
                  <View>
                    {/* Header tiến độ & Chọn câu nhanh */}
                    <View style={[styles.dictHeaderCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                      <View style={styles.dictProgressRow}>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                            <MaterialIcons name="border-color" size={17} color="#10B981" />
                            <Text style={[styles.dictProgressTitle, { color: colors.text }]}>
                              Câu {currentDictIdx + 1} / {dictationItems.length}
                            </Text>
                          </View>
                          {/* Thanh tiến trình */}
                          <View style={styles.dictProgressBarBg}>
                            <View
                              style={[
                                styles.dictProgressBarFill,
                                {
                                  width: `${Math.min(100, ((currentDictIdx + 1) / dictationItems.length) * 100)}%`,
                                },
                              ]}
                            />
                          </View>
                        </View>

                        {/* Huy hiệu kết quả */}
                        <View style={styles.dictStatsChips}>
                          <View style={[styles.dictStatChip, { backgroundColor: isDark ? "#064E3B" : "#D1FAE5" }]}>
                            <Text style={[styles.dictStatChipText, { color: "#10B981" }]}>
                              ✅ {correctCount}
                            </Text>
                          </View>
                          <View style={[styles.dictStatChip, { backgroundColor: isDark ? "#451A03" : "#FEF3C7" }]}>
                            <Text style={[styles.dictStatChipText, { color: colors.amber || "#CFAC62" }]}>
                              💡 {hintCount}
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* Danh sách các câu cuộn ngang để nhảy nhanh */}
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.dictNumbersScroll}
                      >
                        {dictationItems.map((item, idx) => {
                          const isCurrent = idx === currentDictIdx;
                          const isSolved = solvedDictationItems[item.id] === "correct";
                          const isHinted = solvedDictationItems[item.id] === "hint";

                          return (
                            <TouchableOpacity
                              key={item.id}
                              onPress={() => handleSelectDictationIndex(idx)}
                              style={[
                                styles.dictNumChip,
                                {
                                  backgroundColor: isCurrent
                                    ? (colors.indigo || "#4F46E5")
                                    : isSolved
                                    ? "#10B981"
                                    : isHinted
                                    ? (colors.amber || "#F59E0B")
                                    : (isDark ? "rgba(255, 255, 255, 0.06)" : "#F1F5F9"),
                                  borderColor: isCurrent ? (colors.indigo || "#4F46E5") : colors.border,
                                },
                              ]}
                              activeOpacity={0.7}
                            >
                              <Text
                                style={[
                                  styles.dictNumChipText,
                                  {
                                    color: isCurrent || isSolved || isHinted ? "#FFFFFF" : colors.textMuted,
                                    fontWeight: isCurrent ? "800" : "600",
                                  },
                                ]}
                              >
                                {idx + 1}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>

                    {/* 🎧 THẺ CHÉP CHÍNH TẢ CHÍNH */}
                    {currentDictItem && (
                      <View style={[styles.dictationCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        {/* Audio Controls for this slice */}
                        <View style={styles.dictAudioHeaderRow}>
                          <View style={styles.dictTimestampBadge}>
                            <MaterialIcons name="timer" size={13} color="#10B981" />
                            <Text style={styles.dictTimestampText}>
                              {currentDictItem.startFormatted} - {currentDictItem.endFormatted}
                            </Text>
                          </View>

                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                            {/* Nút 0.75x chậm */}
                            <TouchableOpacity
                              onPress={() => {
                                const newSlow = !isSlowMode;
                                setIsSlowMode(newSlow);
                                playDictationSlice(currentDictItem, newSlow);
                              }}
                              style={[
                                styles.dictControlIconBtn,
                                {
                                  backgroundColor: isSlowMode ? "rgba(245, 158, 11, 0.2)" : "transparent",
                                  borderColor: isSlowMode ? "#F59E0B" : colors.border,
                                },
                              ]}
                              activeOpacity={0.7}
                            >
                              <Text style={[styles.dictControlIconText, { color: isSlowMode ? "#F59E0B" : colors.textMuted }]}>
                                0.75x
                              </Text>
                            </TouchableOpacity>

                            {/* Nút lặp lại */}
                            <TouchableOpacity
                              onPress={() => setIsLoopMode(!isLoopMode)}
                              style={[
                                styles.dictControlIconBtn,
                                {
                                  backgroundColor: isLoopMode ? "rgba(16, 185, 129, 0.2)" : "transparent",
                                  borderColor: isLoopMode ? "#10B981" : colors.border,
                                },
                              ]}
                              activeOpacity={0.7}
                            >
                              <MaterialIcons
                                name="repeat"
                                size={16}
                                color={isLoopMode ? "#10B981" : colors.textMuted}
                              />
                            </TouchableOpacity>
                          </View>
                        </View>

                        {/* Nút Play Hero câu này */}
                        <TouchableOpacity
                          onPress={() => playDictationSlice(currentDictItem, isSlowMode)}
                          style={[
                            styles.dictHeroPlayBtn,
                            {
                              backgroundColor: isDark ? "rgba(16, 185, 129, 0.15)" : "#ECFDF5",
                              borderColor: "#10B981",
                            },
                          ]}
                          activeOpacity={0.8}
                        >
                          <View style={styles.dictHeroPlayIconWrap}>
                            <MaterialIcons name="volume-up" size={24} color="#FFFFFF" />
                          </View>
                          <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={[styles.dictHeroPlayTitle, { color: isDark ? "#34D399" : "#059669" }]}>
                              {isPlaying ? "Đang phát đoạn này..." : "Nghe đoạn âm thanh câu này"}
                            </Text>
                            <Text style={[styles.dictHeroPlaySubtitle, { color: colors.textMuted }]}>
                              {currentDictItem.cleanText.length} chữ Hán · Dấu kết thúc: 【 {currentDictItem.punctuation || "Không dấu"} 】
                            </Text>
                          </View>
                        </TouchableOpacity>

                        {/* Ô xem trước từng ô chữ và dấu câu */}
                        <View style={styles.dictSlotsWrapper}>
                          <Text style={[styles.dictSlotsLabel, { color: colors.textMuted }]}>
                            Cấu trúc câu ({currentDictItem.cleanText.length} chữ Hán):
                          </Text>
                          <View style={styles.dictSlotsRow}>
                            {currentDictItem.cleanText.split("").map((ch, idx) => {
                              const userChars = dictationInput.replace(/[，,。\.！!？\?；;\s]/g, "");
                              const typedChar = userChars[idx];
                              const isFilled = !!typedChar;
                              const isCorrectStatus = dictationStatus === "correct" || dictationStatus === "hint";
                              const isWrongStatus = dictationStatus === "wrong";

                              return (
                                <View
                                  key={idx}
                                  style={[
                                    styles.dictSlotBox,
                                    {
                                      backgroundColor: isFilled
                                        ? (isDark ? "rgba(255, 255, 255, 0.06)" : "#F1F5F9")
                                        : (isDark ? "rgba(255, 255, 255, 0.02)" : "rgba(0, 0, 0, 0.02)"),
                                      borderColor: isCorrectStatus
                                        ? "#10B981"
                                        : isWrongStatus
                                        ? "#EF4444"
                                        : isFilled
                                        ? (colors.indigo || "#4F46E5")
                                        : colors.border,
                                    },
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.dictSlotText,
                                      {
                                        color: isCorrectStatus
                                          ? "#10B981"
                                          : isWrongStatus
                                          ? "#EF4444"
                                          : colors.text,
                                      },
                                    ]}
                                  >
                                    {isCorrectStatus ? ch : (typedChar || "_")}
                                  </Text>
                                </View>
                              );
                            })}

                            {/* Dấu câu tách biệt */}
                            {!!currentDictItem.punctuation && (
                              <View
                                style={[
                                  styles.dictPunctBadge,
                                  {
                                    backgroundColor: isDark ? "#2C1A10" : "#FEF3C7",
                                    borderColor: colors.amber || "#CFAC62",
                                  },
                                ]}
                              >
                                <Text style={[styles.dictPunctText, { color: colors.amber || "#CFAC62" }]}>
                                  {currentDictItem.punctuation}
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>

                        {/* Ô nhập chữ Hán TextInput */}
                        <View style={styles.dictInputWrap}>
                          <View
                            style={[
                              styles.dictInputBox,
                              {
                                backgroundColor: isDark ? "#0F172A" : "#FFFFFF",
                                borderColor: dictationStatus === "correct"
                                  ? "#10B981"
                                  : dictationStatus === "wrong"
                                  ? "#EF4444"
                                  : colors.border,
                              },
                            ]}
                          >
                            <TextInput
                              style={[styles.dictTextInput, { color: colors.text }]}
                              placeholder="Gõ hoặc chạm chữ bên dưới..."
                              placeholderTextColor={colors.textMuted}
                              value={dictationInput}
                              onChangeText={(val) => {
                                setDictationInput(val);
                                if (dictationStatus === "wrong") setDictationStatus("idle");
                              }}
                              autoCorrect={false}
                              autoCapitalize="none"
                              returnKeyType="done"
                              onSubmitEditing={handleCheckDictation}
                            />
                            {dictationInput.length > 0 && (
                              <TouchableOpacity
                                onPress={() => setDictationInput("")}
                                style={styles.dictClearBtn}
                                hitSlop={8}
                              >
                                <MaterialIcons name="close" size={18} color={colors.textMuted} />
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>

                        {/* Hàng phím ký tự gợi ý chạm nhanh */}
                        <View style={styles.dictChipsContainer}>
                          <View style={styles.dictChipsHeader}>
                            <Text style={[styles.dictChipsTitle, { color: colors.textMuted }]}>
                              Chạm chữ để điền nhanh:
                            </Text>
                            {dictationInput.length > 0 && (
                              <TouchableOpacity
                                onPress={() => setDictationInput((prev) => prev.slice(0, -1))}
                                style={[styles.dictBackspaceBtn, { borderColor: colors.border }]}
                                activeOpacity={0.7}
                              >
                                <MaterialIcons name="backspace" size={15} color={colors.textMuted} />
                                <Text style={[styles.dictBackspaceText, { color: colors.textMuted }]}>Xóa chữ</Text>
                              </TouchableOpacity>
                            )}
                          </View>

                          <View style={styles.dictChipsRow}>
                            {characterOptions.map((ch, cIdx) => (
                              <TouchableOpacity
                                key={cIdx}
                                onPress={() => {
                                  setDictationInput((prev) => prev + ch);
                                  if (dictationStatus === "wrong") setDictationStatus("idle");
                                }}
                                style={[
                                  styles.dictCharChip,
                                  {
                                    backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : "#F1F5F9",
                                    borderColor: colors.border,
                                  },
                                ]}
                                activeOpacity={0.6}
                              >
                                <Text style={[styles.dictCharChipText, { color: colors.indigo || "#4F46E5" }]}>
                                  {ch}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>

                        {/* Phản hồi kết quả (Correct / Wrong) */}
                        {dictationStatus === "correct" && (
                          <View style={styles.dictFeedbackSuccess}>
                            <View style={styles.dictFeedbackSuccessRow}>
                              <MaterialIcons name="check-circle" size={24} color="#10B981" />
                              <View style={{ flex: 1, marginLeft: 10 }}>
                                <Text style={styles.dictFeedbackSuccessTitle}>CHÍNH XÁC! XUẤT SẮC! 🎉</Text>
                                <Text style={[styles.dictFeedbackSuccessSub, { color: colors.text }]}>
                                  {currentDictItem.text}
                                </Text>
                                {currentDictItem.pinyin ? (
                                  <Text style={[styles.dictFeedbackPinyin, { color: colors.amber || "#CFAC62" }]}>
                                    {currentDictItem.pinyin}
                                  </Text>
                                ) : null}
                                {currentDictItem.meaningVi ? (
                                  <Text style={[styles.dictFeedbackMeaning, { color: colors.textMuted }]}>
                                    🇻🇳 {currentDictItem.meaningVi}
                                  </Text>
                                ) : null}
                              </View>
                            </View>
                          </View>
                        )}

                        {dictationStatus === "wrong" && (
                          <View style={styles.dictFeedbackWrong}>
                            <MaterialIcons name="cancel" size={20} color="#EF4444" />
                            <Text style={styles.dictFeedbackWrongText}>
                              Chưa chính xác. Hãy nghe lại lần nữa hoặc bấm "Gợi ý"!
                            </Text>
                          </View>
                        )}

                        {/* Gợi ý full câu khi user bấm nút Gợi ý */}
                        {dictationStatus === "hint" && (
                          <View
                            style={[
                              styles.dictHintCard,
                              {
                                backgroundColor: isDark ? "#1C1408" : "#FEF3C7",
                                borderColor: colors.amber || "#F59E0B",
                              },
                            ]}
                          >
                            <View style={styles.dictHintHeader}>
                              <MaterialIcons name="lightbulb" size={18} color="#D97706" />
                              <Text style={styles.dictHintTitle}>GỢI Ý CÂU ĐẦY ĐỦ</Text>
                            </View>
                            <Text style={[styles.dictHintTextZh, { color: colors.text }]}>
                              {currentDictItem.text}
                            </Text>
                            {currentDictItem.pinyin ? (
                              <Text style={[styles.dictHintTextPy, { color: colors.amber || "#CFAC62" }]}>
                                {currentDictItem.pinyin}
                              </Text>
                            ) : null}
                            {currentDictItem.meaningVi ? (
                              <Text style={[styles.dictHintTextVi, { color: colors.textMuted }]}>
                                🇻🇳 {currentDictItem.meaningVi}
                              </Text>
                            ) : null}

                            <TouchableOpacity
                              onPress={handleFillDictationAnswer}
                              style={styles.dictFillBtn}
                              activeOpacity={0.8}
                            >
                              <MaterialIcons name="assignment-turned-in" size={16} color="#FFFFFF" />
                              <Text style={styles.dictFillBtnText}>Tự điền đáp án & tiếp tục</Text>
                            </TouchableOpacity>
                          </View>
                        )}

                        {/* Dòng nút hành động chính */}
                        <View style={styles.dictActionsRow}>
                          {/* Nút Gợi ý */}
                          <TouchableOpacity
                            onPress={handleShowHint}
                            style={[
                              styles.dictHintBtn,
                              {
                                backgroundColor: isDark ? "rgba(245, 158, 11, 0.15)" : "#FEF3C7",
                                borderColor: "rgba(245, 158, 11, 0.4)",
                              },
                            ]}
                            activeOpacity={0.7}
                          >
                            <MaterialIcons name="lightbulb-outline" size={18} color="#D97706" />
                            <Text style={styles.dictHintBtnText}>Gợi ý câu</Text>
                          </TouchableOpacity>

                          {/* Nút Kiểm tra hoặc Nút Tiếp theo */}
                          {dictationStatus !== "correct" && dictationStatus !== "hint" ? (
                            <TouchableOpacity
                              onPress={handleCheckDictation}
                              style={[
                                styles.dictCheckBtn,
                                {
                                  backgroundColor: dictationInput.trim().length > 0
                                    ? (colors.indigo || "#4F46E5")
                                    : colors.border,
                                },
                              ]}
                              disabled={dictationInput.trim().length === 0}
                              activeOpacity={0.8}
                            >
                              <MaterialIcons name="check" size={20} color="#FFFFFF" />
                              <Text style={styles.dictCheckBtnText}>Kiểm tra</Text>
                            </TouchableOpacity>
                          ) : currentDictIdx < dictationItems.length - 1 ? (
                            <TouchableOpacity
                              onPress={handleNextDictationItem}
                              style={[styles.dictNextBtn, { backgroundColor: "#10B981" }]}
                              activeOpacity={0.8}
                            >
                              <Text style={styles.dictNextBtnText}>Câu tiếp theo</Text>
                              <MaterialIcons name="arrow-forward" size={18} color="#FFFFFF" />
                            </TouchableOpacity>
                          ) : (
                            <TouchableOpacity
                              onPress={() => {
                                Alert.alert(
                                  "🎉 Chúc mừng bạn!",
                                  `Bạn đã hoàn thành toàn bộ ${dictationItems.length} câu chép chính tả với ${correctCount} câu đúng tự lực!`
                                );
                              }}
                              style={[styles.dictNextBtn, { backgroundColor: "#10B981" }]}
                              activeOpacity={0.8}
                            >
                              <MaterialIcons name="emoji-events" size={18} color="#FFFFFF" />
                              <Text style={styles.dictNextBtnText}>Hoàn thành bài</Text>
                            </TouchableOpacity>
                          )}
                        </View>

                        {/* Dòng điều hướng trước / sau */}
                        <View style={styles.dictNavRow}>
                          <TouchableOpacity
                            onPress={handlePrevDictationItem}
                            disabled={currentDictIdx === 0}
                            style={[
                              styles.dictNavBtn,
                              { opacity: currentDictIdx === 0 ? 0.3 : 1 },
                            ]}
                          >
                            <MaterialIcons name="skip-previous" size={20} color={colors.textMuted} />
                            <Text style={[styles.dictNavText, { color: colors.textMuted }]}>Câu trước</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            onPress={handleNextDictationItem}
                            disabled={currentDictIdx >= dictationItems.length - 1}
                            style={[
                              styles.dictNavBtn,
                              { opacity: currentDictIdx >= dictationItems.length - 1 ? 0.3 : 1 },
                            ]}
                          >
                            <Text style={[styles.dictNavText, { color: colors.textMuted }]}>Câu sau</Text>
                            <MaterialIcons name="skip-next" size={20} color={colors.textMuted} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* Tab 3: Toàn bộ văn bản */}
            {activeTab === "fullText" && (
              <View style={{ marginTop: 12 }}>
                {/* Bản gốc tiếng Trung */}
                <View
                  style={[
                    styles.fullTextCard,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  <View style={styles.fullTextHeader}>
                    <Text style={[styles.fullTextTitle, { color: colors.textMuted }]}>
                      BẢN GỐC TIẾNG TRUNG (PHỒN THỂ)
                    </Text>
                    <TouchableOpacity
                      onPress={() => handleShareOrCopy(result.fullText)}
                      style={[styles.copyAllBtn, { backgroundColor: colors.indigo || "#4F46E5" }]}
                      activeOpacity={0.8}
                    >
                      <MaterialIcons name="content-copy" size={15} color="#FFFFFF" />
                      <Text style={styles.copyAllBtnText}>Sao chép</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={[styles.fullTextBody, { color: colors.text }]} selectable>
                    {result.fullText}
                  </Text>
                </View>

                {/* Bản dịch tiếng Việt toàn bài */}
                {result.fullTranslation && (
                  <View
                    style={[
                      styles.fullTextCard,
                      { backgroundColor: colors.surface, borderColor: colors.border, marginTop: 14 },
                    ]}
                  >
                    <View style={styles.fullTextHeader}>
                      <Text style={[styles.fullTextTitle, { color: "#10B981" }]}>
                        BẢN DỊCH TIẾNG VIỆT TOÀN BÀI
                      </Text>
                      <TouchableOpacity
                        onPress={() => handleShareOrCopy(result.fullTranslation || "")}
                        style={[styles.copyAllBtn, { backgroundColor: "#10B981" }]}
                        activeOpacity={0.8}
                      >
                        <MaterialIcons name="content-copy" size={15} color="#FFFFFF" />
                        <Text style={styles.copyAllBtnText}>Sao chép</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={[styles.fullTextBody, { color: isDark ? "#D1D5DB" : "#374151" }]} selectable>
                      {result.fullTranslation}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* 💾 DÒNG NÚT THAO TÁC DƯỚI CÙNG (LƯU BÀI NGHE / CHIA SẺ) */}
            <View style={styles.actionBottomRow}>
              {/* Nút lưu bài nghe */}
              <TouchableOpacity
                onPress={handleSaveLesson}
                style={[
                  styles.bottomActionBtn,
                  {
                    backgroundColor: isCurrentLessonSaved ? (isDark ? "#1C1408" : "#FEF3C7") : "#F59E0B",
                    borderColor: isCurrentLessonSaved ? colors.amber : "transparent",
                    borderWidth: isCurrentLessonSaved ? 1 : 0,
                    marginRight: 8,
                  },
                ]}
                activeOpacity={0.8}
              >
                <MaterialIcons
                  name={isCurrentLessonSaved ? "bookmark" : "bookmark-add"}
                  size={18}
                  color={isCurrentLessonSaved ? (colors.amber || "#CFAC62") : "#FFFFFF"}
                />
                <Text
                  style={[
                    styles.bottomActionText,
                    { color: isCurrentLessonSaved ? (colors.amber || "#CFAC62") : "#FFFFFF" },
                  ]}
                >
                  {isCurrentLessonSaved ? "Đã lưu vào thư viện" : "Lưu bài nghe"}
                </Text>
              </TouchableOpacity>

              {/* Nút chia sẻ song ngữ */}
              <TouchableOpacity
                onPress={() => {
                  const combined = result.segments
                    .map((s) => `[${s.startFormatted}] ${s.text}\n(${s.pinyin || ""})\n🇻🇳 ${s.meaningVi || ""}`)
                    .join("\n\n");
                  handleShareOrCopy(combined);
                }}
                style={[
                  styles.bottomActionBtn,
                  { backgroundColor: "#10B981", flex: 1 },
                ]}
                activeOpacity={0.8}
              >
                <MaterialIcons name="share" size={18} color="#FFFFFF" />
                <Text style={styles.bottomActionText}>Chia sẻ</Text>
              </TouchableOpacity>

              {/* Nút bóc file khác */}
              <TouchableOpacity
                onPress={() => {
                  setResult(null);
                  setSelectedFile(null);
                  if (sound) sound.unloadAsync();
                  setSound(null);
                }}
                style={[
                  styles.bottomActionBtn,
                  { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, marginLeft: 8 },
                ]}
                activeOpacity={0.8}
              >
                <MaterialIcons name="refresh" size={18} color={colors.text} />
                <Text style={[styles.bottomActionText, { color: colors.text }]}>Đổi file</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}
      </ScrollView>

      {/* ─── MODAL THƯ VIỆN BÀI NGHE ĐÃ LƯU (XEM LẠI & XÓA ĐOẠN KHÔNG CẦN) ─── */}
      <Modal
        visible={showLibraryModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowLibraryModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View
            style={[
              styles.modalHeader,
              {
                backgroundColor: colors.surface,
                borderBottomColor: colors.border,
                paddingTop: insets.top > 0 ? insets.top + 8 : (Platform.OS === "android" ? 44 : 20),
              },
            ]}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <MaterialIcons name="folder-special" size={24} color={colors.amber || "#CFAC62"} />
              <View>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Thư viện bài nghe</Text>
                <Text style={[styles.modalSubtitle, { color: colors.textMuted }]}>
                  {savedLessons.length} bài nghe đã lưu
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => setShowLibraryModal(false)}
              style={[styles.closeModalBtn, { borderColor: colors.border }]}
              activeOpacity={0.7}
            >
              <MaterialIcons name="close" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
            {savedLessons.length === 0 ? (
              <View style={styles.emptyLibraryContainer}>
                <MaterialIcons name="folder-open" size={64} color={colors.textMuted} />
                <Text style={[styles.emptyLibraryTitle, { color: colors.text }]}>
                  Thư viện chưa có bài nghe nào
                </Text>
                <Text style={[styles.emptyLibrarySub, { color: colors.textMuted }]}>
                  Sau khi bóc script một file MP3, bạn hãy bấm nút "Lưu bài nghe" để lưu lại vào đây và nghe lại bất kỳ lúc nào.
                </Text>
              </View>
            ) : (
              savedLessons.map((lesson) => (
                <View
                  key={lesson.id}
                  style={[
                    styles.savedLessonCard,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  <View style={styles.savedLessonHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.savedLessonTitle, { color: colors.text }]}>
                        {lesson.title}
                      </Text>
                      <View style={styles.savedLessonMetaRow}>
                        <Text style={[styles.savedLessonMeta, { color: colors.textMuted }]}>
                          🕒 {formatDisplayTime(lesson.duration)} · {lesson.totalSegments || lesson.segments?.length} câu {lesson.fileSize ? `· ${formatFileSize(lesson.fileSize)}` : ""} · {lesson.savedAt}
                        </Text>
                      </View>
                    </View>

                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      {/* NÚT TẢI FILE MP3 NHỊ PHÂN VỀ MÁY */}
                      <TouchableOpacity
                        onPress={() => handleDownloadAudio(lesson)}
                        style={styles.downloadLessonBtn}
                        activeOpacity={0.7}
                      >
                        <MaterialIcons name="file-download" size={20} color={colors.amber || "#CFAC62"} />
                      </TouchableOpacity>

                      {/* NÚT XÓA BÀI NGHE KHỎI MONGODB */}
                      <TouchableOpacity
                        onPress={() => handleDeleteLesson(lesson.lessonId || lesson.id, lesson.title)}
                        style={styles.deleteLessonBtn}
                        activeOpacity={0.7}
                      >
                        <MaterialIcons name="delete-outline" size={20} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Xem trước câu đầu tiên */}
                  {lesson.segments && lesson.segments.length > 0 && (
                    <View style={[styles.previewBox, { backgroundColor: isDark ? "#120E08" : "#F8F6F0" }]}>
                      <Text style={[styles.previewTextZh, { color: colors.text }]} numberOfLines={1}>
                        {lesson.segments[0].text}
                      </Text>
                      {!!lesson.segments[0].meaningVi && (
                        <Text style={[styles.previewTextVi, { color: colors.textMuted }]} numberOfLines={1}>
                          🇻🇳 {lesson.segments[0].meaningVi}
                        </Text>
                      )}
                    </View>
                  )}

                  {/* Nút mở bài nghe */}
                  <TouchableOpacity
                    onPress={() => handleOpenLesson(lesson)}
                    style={[styles.openLessonBtn, { backgroundColor: "#10B981" }]}
                    activeOpacity={0.8}
                  >
                    <MaterialIcons name="play-arrow" size={18} color="#FFFFFF" />
                    <Text style={styles.openLessonBtnText}>Mở bài nghe & Karaoke</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* ─── 📖 MODAL CHI TIẾT TỪ VỰNG, HÁN TỰ, TỪ ĐỒNG NGHĨA & NÉT VIẾT ─── */}
      <Modal
        visible={exploreStack.length > 0}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeWordDetail}
      >
        <View style={[styles.wordDetailContainer, { backgroundColor: colors.background }]}>
          {/* Top Bar Modal */}
          <View
            style={[
              styles.wordDetailTopBar,
              {
                backgroundColor: colors.surface,
                borderBottomColor: colors.border,
                paddingTop: insets.top > 0 ? insets.top + 8 : (Platform.OS === "android" ? 44 : 20),
              },
            ]}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
              {exploreStack.length > 1 ? (
                <TouchableOpacity onPress={popExploreWord} style={styles.modalBackBtn}>
                  <MaterialIcons name="arrow-back-ios" size={18} color={colors.text} />
                  <Text style={[styles.modalBackText, { color: colors.text }]} numberOfLines={1}>
                    {exploreStack[exploreStack.length - 2]?.word}
                  </Text>
                </TouchableOpacity>
              ) : (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <MaterialIcons name="menu-book" size={20} color={colors.amber || "#F59E0B"} />
                  <Text style={[styles.wordDetailTopTitle, { color: colors.text }]}>
                    Chi tiết từ & Hán tự
                  </Text>
                </View>
              )}
            </View>

            <TouchableOpacity onPress={closeWordDetail} style={styles.modalCloseBtn}>
              <MaterialIcons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {activeExploreItem && (
            <ScrollView
              contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
              showsVerticalScrollIndicator={false}
            >
              {/* 🌟 HERO CARD: TỪ VỰNG & HÁN TỰ */}
              <View
                style={[
                  styles.exploreHeroCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View style={styles.exploreHeroTopRow}>
                  <Text style={[styles.exploreHeroWord, { color: colors.text }]}>
                    {activeExploreItem.word}
                  </Text>

                  <TouchableOpacity
                    onPress={() => speakSentence(activeExploreItem.word)}
                    style={styles.exploreTtsBtn}
                    activeOpacity={0.8}
                  >
                    <MaterialIcons name="volume-up" size={22} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>

                {/* Badges: Pinyin + Hán Việt */}
                <View style={styles.exploreBadgeRow}>
                  {!!(activeExploreItem.pinyin || wordInsights?.pinyin) && (
                    <View style={styles.explorePinyinBadge}>
                      <Text style={styles.explorePinyinText}>
                        {activeExploreItem.pinyin || wordInsights?.pinyin}
                      </Text>
                    </View>
                  )}
                  {!!(activeExploreItem.hanviet || wordInsights?.hanviet) && (
                    <View style={styles.exploreHanvietBadge}>
                      <Text style={styles.exploreHanvietText}>
                        Hán Việt: {activeExploreItem.hanviet || wordInsights?.hanviet}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Nghĩa tiếng Việt */}
                <View
                  style={[
                    styles.exploreMeaningBox,
                    { backgroundColor: isDark ? "rgba(16, 185, 129, 0.08)" : "#F0FDF4" },
                  ]}
                >
                  <Text style={styles.exploreMeaningLabel}>🇻🇳 Ý NGHĨA TIẾNG VIỆT</Text>
                  <Text style={[styles.exploreMeaningText, { color: isDark ? "#A7F3D0" : "#065F46" }]}>
                    {activeExploreItem.meaning || wordInsights?.meaning || "Từ vựng tiếng Trung"}
                  </Text>
                </View>

                {/* Nút phát âm thanh từ đoạn audio này (nếu được mở từ audio) */}
                {activeExploreItem.audioTimestamp !== undefined && (
                  <TouchableOpacity
                    onPress={() => {
                      const ts = activeExploreItem.audioTimestamp!;
                      closeWordDetail();
                      seekToTime(ts);
                    }}
                    style={styles.explorePlayFromAudioBtn}
                    activeOpacity={0.8}
                  >
                    <MaterialIcons name="headphones" size={18} color="#FFFFFF" />
                    <Text style={styles.explorePlayFromAudioText}>
                      Nghe câu này trong bài audio ({formatDisplayTime(activeExploreItem.audioTimestamp)})
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* ✍️ TẬP VIẾT THỨ TỰ TỪNG NÉT (STROKE ORDER CANVAS) */}
              {activeHanziChars.length > 0 && (
                <View
                  style={[
                    styles.exploreSectionCard,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  <View style={styles.exploreSectionTitleRow}>
                    <MaterialIcons name="edit" size={18} color={colors.amber || "#F59E0B"} />
                    <Text style={[styles.exploreSectionTitle, { color: colors.text }]}>
                      Tập viết & Thứ tự từng nét chữ
                    </Text>
                  </View>

                  {/* Nếu từ có nhiều chữ Hán (ví dụ: 走路, 幫忙), cho chọn từng chữ để viết */}
                  {activeHanziChars.length > 1 && (
                    <View style={styles.charSelectorRow}>
                      {activeHanziChars.map((ch, idx) => (
                        <TouchableOpacity
                          key={idx}
                          onPress={() => setActivePracticeCharIdx(idx)}
                          style={[
                            styles.charSelectTab,
                            activePracticeCharIdx === idx && styles.charSelectTabActive,
                            {
                              borderColor:
                                activePracticeCharIdx === idx
                                  ? colors.amber || "#F59E0B"
                                  : colors.border,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.charSelectTabText,
                              {
                                color:
                                  activePracticeCharIdx === idx
                                    ? colors.amber || "#F59E0B"
                                    : colors.text,
                                fontWeight: activePracticeCharIdx === idx ? "800" : "500",
                              },
                            ]}
                          >
                            {ch}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  {/* Interactive Stroke Practice Canvas */}
                  <View style={styles.strokeCanvasWrap}>
                    <StrokeOrderPractice
                      character={activeHanziChars[activePracticeCharIdx] || activeHanziChars[0]}
                      pinyin={getCharInfo(activeHanziChars[activePracticeCharIdx] || activeHanziChars[0]).pinyin}
                      vietnameseReading={getCharInfo(activeHanziChars[activePracticeCharIdx] || activeHanziChars[0]).hanviet}
                      size={Platform.OS === "web" ? 170 : 150}
                    />
                  </View>
                </View>
              )}

              {/* 🌿 TỪ ĐỒNG NGHĨA & GẦN NGHĨA */}
              <View
                style={[
                  styles.exploreSectionCard,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <View style={styles.exploreSectionTitleRow}>
                  <MaterialIcons name="compare-arrows" size={18} color="#10B981" />
                  <Text style={[styles.exploreSectionTitle, { color: colors.text }]}>
                    Từ đồng nghĩa & Gần nghĩa
                  </Text>
                  {loadingInsights && <ActivityIndicator size="small" color="#10B981" style={{ marginLeft: 8 }} />}
                </View>

                {wordInsights?.synonyms && wordInsights.synonyms.length > 0 ? (
                  <View style={{ gap: 10 }}>
                    {wordInsights.synonyms.map((syn, sIdx) => (
                      <View
                        key={sIdx}
                        style={[
                          styles.synonymCard,
                          {
                            backgroundColor: isDark ? "#1C1917" : "#F9FAFB",
                            borderColor: colors.border,
                          },
                        ]}
                      >
                        <View style={styles.synonymHeaderRow}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                            <Text style={[styles.synonymWord, { color: colors.text }]}>{syn.word}</Text>
                            {!!syn.pinyin && (
                              <Text style={[styles.synonymPinyin, { color: colors.amber || "#CFAC62" }]}>
                                {syn.pinyin}
                              </Text>
                            )}
                            <Text style={[styles.synonymMeaning, { color: "#10B981" }]} numberOfLines={1}>
                              · {syn.meaning}
                            </Text>
                          </View>

                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                            <TouchableOpacity
                              onPress={() => speakSentence(syn.word)}
                              style={styles.smallTtsBtn}
                            >
                              <MaterialIcons name="volume-up" size={16} color="#10B981" />
                            </TouchableOpacity>

                            <TouchableOpacity
                              onPress={() => pushExploreWord(syn.word, syn.pinyin, syn.meaning)}
                              style={styles.exploreNextBtn}
                            >
                              <Text style={styles.exploreNextBtnText}>Tra từ này</Text>
                              <MaterialIcons name="chevron-right" size={14} color="#FFFFFF" />
                            </TouchableOpacity>
                          </View>
                        </View>

                        {!!syn.difference && (
                          <View style={[styles.synonymDiffBox, { backgroundColor: isDark ? "#292524" : "#F3F4F6" }]}>
                            <Text style={[styles.synonymDiffText, { color: colors.textMuted }]}>
                              💡 <Text style={{ fontWeight: "700", color: colors.text }}>Phân biệt:</Text>{" "}
                              {syn.difference}
                            </Text>
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                ) : !loadingInsights ? (
                  <Text style={[styles.emptySectionText, { color: colors.textMuted }]}>
                    Chưa có từ đồng nghĩa ghi nhận cho từ này.
                  </Text>
                ) : null}
              </View>

              {/* 📘 CÁC CÁCH DÙNG KHÁC & CẤU TRÚC NGỮ PHÁP */}
              <View
                style={[
                  styles.exploreSectionCard,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <View style={styles.exploreSectionTitleRow}>
                  <MaterialIcons name="school" size={18} color="#3B82F6" />
                  <Text style={[styles.exploreSectionTitle, { color: colors.text }]}>
                    Cách dùng & Cấu trúc ngữ pháp
                  </Text>
                  {loadingInsights && <ActivityIndicator size="small" color="#3B82F6" style={{ marginLeft: 8 }} />}
                </View>

                {wordInsights?.usages && wordInsights.usages.length > 0 ? (
                  <View style={{ gap: 10 }}>
                    {wordInsights.usages.map((usage, uIdx) => (
                      <View
                        key={uIdx}
                        style={[
                          styles.usageCard,
                          {
                            backgroundColor: isDark ? "#1C1917" : "#F9FAFB",
                            borderColor: colors.border,
                          },
                        ]}
                      >
                        <View style={styles.usagePatternBadge}>
                          <Text style={styles.usagePatternText}>{usage.pattern}</Text>
                        </View>

                        {!!(usage.meaning || usage.explanation) && (
                          <Text style={[styles.usageMeaningText, { color: colors.text }]}>
                            👉 {usage.meaning || usage.explanation}
                          </Text>
                        )}

                        {!!(usage.exampleCn || usage.example) && (
                          <View
                            style={[
                              styles.usageExampleBox,
                              { backgroundColor: isDark ? "#292524" : "#FFFFFF", borderColor: colors.border },
                            ]}
                          >
                            <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
                              <Text style={[styles.usageExampleCn, { color: colors.text }]}>
                                {usage.exampleCn || usage.example}
                              </Text>
                              <TouchableOpacity
                                onPress={() => speakSentence(usage.exampleCn || usage.example || "")}
                                style={styles.smallTtsBtn}
                              >
                                <MaterialIcons name="volume-up" size={16} color="#3B82F6" />
                              </TouchableOpacity>
                            </View>

                            {!!usage.examplePinyin && (
                              <Text style={[styles.usageExamplePinyin, { color: colors.amber || "#CFAC62" }]}>
                                {usage.examplePinyin}
                              </Text>
                            )}

                            {!!usage.exampleVn && (
                              <Text style={[styles.usageExampleVn, { color: colors.textMuted }]}>
                                🇻🇳 {usage.exampleVn}
                              </Text>
                            )}
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                ) : !loadingInsights ? (
                  <Text style={[styles.emptySectionText, { color: colors.textMuted }]}>
                    Đang cập nhật các cấu trúc ngữ pháp phổ biến cho từ này.
                  </Text>
                ) : null}
              </View>

              {/* 🔗 CÁC TỪ GHÉP CÓ CHỨA CHỮ NÀY */}
              {activeRelatedWords.length > 0 && (
                <View
                  style={[
                    styles.exploreSectionCard,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  <View style={styles.exploreSectionTitleRow}>
                    <MaterialIcons name="hub" size={18} color="#8B5CF6" />
                    <Text style={[styles.exploreSectionTitle, { color: colors.text }]}>
                      Các từ ghép có chứa chữ "{activeExploreItem.word}" ({activeRelatedWords.length})
                    </Text>
                  </View>

                  <View style={styles.relatedWordsGrid}>
                    {activeRelatedWords.map((rw, rwIdx) => (
                      <TouchableOpacity
                        key={rwIdx}
                        onPress={() => pushExploreWord(rw.word, rw.pinyin, rw.meaning)}
                        style={[
                          styles.relatedWordChip,
                          {
                            backgroundColor: isDark ? "#1C1917" : "#F9FAFB",
                            borderColor: colors.border,
                          },
                        ]}
                        activeOpacity={0.7}
                      >
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                            <Text style={[styles.relatedWordText, { color: colors.text }]}>{rw.word}</Text>
                            {!!rw.pinyin && (
                              <Text style={[styles.relatedWordPinyin, { color: colors.amber || "#CFAC62" }]}>
                                {rw.pinyin}
                              </Text>
                            )}
                          </View>
                          <Text style={[styles.relatedWordMeaning, { color: colors.textMuted }]} numberOfLines={1}>
                            {rw.meaning}
                          </Text>
                        </View>
                        <MaterialIcons name="chevron-right" size={18} color={colors.textMuted} />
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* Copy notification toast */}
      {copiedNotice && (
        <Animated.View entering={FadeIn.duration(200)} style={styles.toastWrap}>
          <View style={styles.toast}>
            <MaterialIcons name="check-circle" size={18} color="#10B981" />
            <Text style={styles.toastText}>Đã mở hộp thoại sao chép/chia sẻ!</Text>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 0.5,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleWrap: {
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  freeBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10B981",
    marginRight: 5,
  },
  freeBadgeText: {
    fontSize: 11,
    color: "#10B981",
    fontWeight: "600",
  },
  libraryBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  libraryBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#10B981",
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  libraryBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },
  uploadCard: {
    borderRadius: 18,
    borderWidth: 2,
    borderStyle: "dashed",
    paddingVertical: 36,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  } as any,
  uploadIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  uploadTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 6,
    textAlign: "center",
  },
  uploadSub: {
    fontSize: 13,
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 18,
    maxWidth: 320,
  },
  uploadActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 24,
    gap: 8,
  },
  uploadActionBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  openLibraryQuickBtn: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 18,
    gap: 6,
  },
  openLibraryQuickText: {
    fontSize: 12.5,
    fontWeight: "600",
  },
  fileSelectedCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  fileInfoRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  fileIconSmall: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  fileName: {
    fontSize: 15,
    fontWeight: "700",
  },
  fileMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  changeFileBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 1,
    gap: 4,
  },
  changeFileText: {
    fontSize: 12,
    fontWeight: "600",
  },
  playerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
    padding: 12,
    borderRadius: 14,
  },
  skipBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 3,
  },
  playPauseBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  timeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  timelineHitArea: {
    paddingVertical: 8,
    cursor: "pointer",
  } as any,
  progressBg: {
    height: 6,
    backgroundColor: "rgba(150, 150, 150, 0.25)",
    borderRadius: 3,
    position: "relative",
    justifyContent: "center",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  scrubberThumb: {
    position: "absolute",
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#10B981",
    marginLeft: -6,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    elevation: 2,
  },
  transcribeBtn: {
    marginTop: 16,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  transcribeBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  processingCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  processingTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginTop: 14,
    textAlign: "center",
  },
  processingDesc: {
    fontSize: 12,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18,
    maxWidth: 320,
  },
  resultStatsBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  statCol: {
    alignItems: "center",
    flex: 1,
  },
  statVal: {
    fontSize: 17,
    fontWeight: "800",
  },
  statLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 24,
  },
  controlsRow: {
    flexDirection: "row",
    marginTop: 12,
    gap: 8,
    flexWrap: "wrap",
  },
  filterPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(150, 150, 150, 0.3)",
    gap: 4,
  },
  filterPillText: {
    fontSize: 11.5,
    fontWeight: "600",
  },
  tabToggleRow: {
    flexDirection: "row",
    marginTop: 12,
    gap: 10,
  },
  tabToggleBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
    backgroundColor: "transparent",
  },
  tabToggleActive: {
    borderWidth: 1.5,
  },
  tabToggleText: {
    fontSize: 13,
  },
  segmentCard: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    cursor: "pointer",
  } as any,
  segmentTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  segmentActionsLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
    flex: 1,
    marginRight: 8,
  },
  actionPillBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 14,
    borderWidth: 1,
    gap: 3.5,
  },
  actionPillText: {
    fontSize: 11,
    fontWeight: "700",
  },
  actionIconBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  timestampBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  timestampText: {
    fontSize: 11.5,
    fontWeight: "700",
  },
  copySingleBtn: {
    padding: 4,
  },
  deleteSingleSegmentBtn: {
    padding: 4,
    borderRadius: 6,
  },
  // 🟢 Ô XANH LÁ HIỆN ĐANG NÓI Ở CHỮ NÀO
  activeCharCallout: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    borderColor: "#10B981",
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginBottom: 8,
    gap: 5,
  },
  pulsingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10B981",
  },
  activeCharCalloutLabel: {
    fontSize: 11,
    color: "#10B981",
    fontWeight: "700",
  },
  activeCharBadge: {
    backgroundColor: "#10B981",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  activeCharBadgeText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },
  karaokeTextWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
  },
  charBox: {
    paddingHorizontal: 2,
    paddingVertical: 1,
    borderRadius: 5,
    marginVertical: 1,
    cursor: "pointer",
  } as any,
  activeCharBoxHighlight: {
    backgroundColor: "#10B981",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 6,
    elevation: 3,
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
  segmentCharText: {
    fontSize: 18,
    lineHeight: 28,
  },
  segmentPinyin: {
    fontSize: 13,
    marginTop: 4,
    letterSpacing: 0.3,
  },
  meaningContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 0.5,
  },
  meaningRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },
  vnFlag: {
    fontSize: 13,
    marginTop: 1,
  },
  segmentMeaning: {
    fontSize: 13.5,
    lineHeight: 20,
    flex: 1,
  },
  fullTextCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
  },
  fullTextHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  fullTextTitle: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  copyAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    gap: 4,
  },
  copyAllBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  fullTextBody: {
    fontSize: 16,
    lineHeight: 26,
    letterSpacing: 0.2,
  },
  actionBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
    gap: 6,
  },
  bottomActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 14,
    gap: 6,
  },
  bottomActionText: {
    fontSize: 13.5,
    fontWeight: "700",
  },
  toastWrap: {
    position: "absolute",
    bottom: 30,
    left: 20,
    right: 20,
    alignItems: "center",
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1F2937",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    gap: 8,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  toastText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  // Modal Thư viện đã lưu
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 0.5,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  modalSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  closeModalBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyLibraryContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
    paddingHorizontal: 24,
  },
  emptyLibraryTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 16,
    textAlign: "center",
  },
  emptyLibrarySub: {
    fontSize: 13,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 18,
  },
  savedLessonCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
  },
  savedLessonHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  savedLessonTitle: {
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22,
  },
  savedLessonMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  savedLessonMeta: {
    fontSize: 12,
  },
  deleteLessonBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    marginLeft: 6,
  },
  downloadLessonBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: "rgba(207, 172, 98, 0.12)",
    marginLeft: 6,
  },
  previewBox: {
    padding: 10,
    borderRadius: 10,
    marginTop: 10,
  },
  previewTextZh: {
    fontSize: 14,
    fontWeight: "600",
  },
  previewTextVi: {
    fontSize: 12.5,
    marginTop: 3,
  },
  openLessonBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 12,
    gap: 6,
  },
  openLessonBtnText: {
    color: "#FFFFFF",
    fontSize: 13.5,
    fontWeight: "700",
  },
  // ─── DICTATION STYLES ───
  dictHeaderCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  dictProgressRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  dictProgressTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  dictProgressBarBg: {
    height: 6,
    backgroundColor: "rgba(150, 150, 150, 0.2)",
    borderRadius: 3,
    marginTop: 6,
    overflow: "hidden",
  },
  dictProgressBarFill: {
    height: "100%",
    backgroundColor: "#10B981",
    borderRadius: 3,
  },
  dictStatsChips: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginLeft: 12,
  },
  dictStatChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  dictStatChipText: {
    fontSize: 12,
    fontWeight: "700",
  },
  dictNumbersScroll: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 2,
  },
  dictNumChip: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dictNumChipText: {
    fontSize: 12,
  },
  dictationCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  dictEmptyTitle: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 8,
  },
  dictAudioHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  dictTimestampBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    gap: 4,
  },
  dictTimestampText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#10B981",
  },
  dictControlIconBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  dictControlIconText: {
    fontSize: 11,
    fontWeight: "700",
  },
  dictHeroPlayBtn: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: 14,
  },
  dictHeroPlayIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
  },
  dictHeroPlayTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  dictHeroPlaySubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  dictSlotsWrapper: {
    marginBottom: 14,
  },
  dictSlotsLabel: {
    fontSize: 11.5,
    fontWeight: "600",
    marginBottom: 8,
  },
  dictSlotsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
  },
  dictSlotBox: {
    minWidth: 38,
    height: 42,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  dictSlotText: {
    fontSize: 20,
    fontWeight: "800",
  },
  dictPunctBadge: {
    paddingHorizontal: 10,
    height: 42,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  dictPunctText: {
    fontSize: 20,
    fontWeight: "900",
  },
  dictInputWrap: {
    marginBottom: 14,
  },
  dictInputBox: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  dictTextInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    paddingVertical: 8,
  },
  dictClearBtn: {
    padding: 6,
  },
  dictChipsContainer: {
    marginBottom: 14,
  },
  dictChipsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  dictChipsTitle: {
    fontSize: 11.5,
    fontWeight: "600",
  },
  dictBackspaceBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    gap: 4,
  },
  dictBackspaceText: {
    fontSize: 11,
    fontWeight: "600",
  },
  dictChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  dictCharChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dictCharChipText: {
    fontSize: 18,
    fontWeight: "800",
  },
  dictFeedbackSuccess: {
    borderRadius: 12,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderWidth: 1,
    borderColor: "#10B981",
    padding: 12,
    marginBottom: 14,
  },
  dictFeedbackSuccessRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  dictFeedbackSuccessTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#10B981",
  },
  dictFeedbackSuccessSub: {
    fontSize: 17,
    fontWeight: "800",
    marginTop: 4,
  },
  dictFeedbackPinyin: {
    fontSize: 13,
    fontWeight: "600",
    marginTop: 2,
  },
  dictFeedbackMeaning: {
    fontSize: 12.5,
    marginTop: 2,
  },
  dictFeedbackWrong: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderWidth: 1,
    borderColor: "#EF4444",
    padding: 12,
    marginBottom: 14,
    gap: 8,
  },
  dictFeedbackWrongText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#EF4444",
    flex: 1,
  },
  dictHintCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 14,
  },
  dictHintHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  dictHintTitle: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
    color: "#D97706",
  },
  dictHintTextZh: {
    fontSize: 18,
    fontWeight: "800",
    marginTop: 4,
  },
  dictHintTextPy: {
    fontSize: 13,
    fontWeight: "600",
    marginTop: 2,
  },
  dictHintTextVi: {
    fontSize: 12.5,
    marginTop: 2,
  },
  dictFillBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#F59E0B",
    marginTop: 10,
    gap: 6,
  },
  dictFillBtnText: {
    color: "#FFFFFF",
    fontSize: 12.5,
    fontWeight: "700",
  },
  dictActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  dictHintBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  dictHintBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#D97706",
  },
  dictCheckBtn: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  dictCheckBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  dictNextBtn: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  dictNextBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  dictNavRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: "rgba(150, 150, 150, 0.2)",
  },
  dictNavBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 8,
    gap: 4,
  },
  dictNavText: {
    fontSize: 12,
    fontWeight: "600",
  },

  // ─── STYLES FOR CHAR QUICK TOOLTIP ───
  charTooltipCard: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 12,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  charTooltipHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  charTooltipChar: {
    fontSize: 26,
    fontWeight: "900",
  },
  charTooltipPinyinBadge: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  charTooltipPinyinText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#D97706",
  },
  charTooltipHanviet: {
    fontSize: 13,
    fontWeight: "700",
  },
  charTooltipCloseBtn: {
    padding: 4,
  },
  charTooltipMeaning: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    marginBottom: 10,
  },
  charTooltipActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  charTooltipActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  charTooltipActionText: {
    fontSize: 12,
    fontWeight: "600",
  },
  hoveredCharBoxHighlight: {
    borderColor: "#F59E0B",
    borderWidth: 2,
    transform: [{ scale: 1.08 }],
    backgroundColor: "rgba(245, 158, 11, 0.18)",
  },

  // ─── STYLES FOR WORD DETAIL MODAL ───
  wordDetailContainer: {
    flex: 1,
  },
  wordDetailTopBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
  },
  modalBackBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  modalBackText: {
    fontSize: 15,
    fontWeight: "700",
  },
  wordDetailTopTitle: {
    fontSize: 17,
    fontWeight: "800",
  },
  modalCloseBtn: {
    padding: 6,
  },

  // Explore Hero Card
  exploreHeroCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
  },
  exploreHeroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  exploreHeroWord: {
    fontSize: 40,
    fontWeight: "900",
    letterSpacing: 2,
  },
  exploreTtsBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
  },
  exploreBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  explorePinyinBadge: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  explorePinyinText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#D97706",
  },
  exploreHanvietBadge: {
    backgroundColor: "rgba(139, 92, 246, 0.12)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  exploreHanvietText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#8B5CF6",
  },
  exploreMeaningBox: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  exploreMeaningLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#059669",
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  exploreMeaningText: {
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22,
  },
  explorePlayFromAudioBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3B82F6",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 4,
  },
  explorePlayFromAudioText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },

  // Explore Section Card
  exploreSectionCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
  },
  exploreSectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  exploreSectionTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  charSelectorRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  charSelectTab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  charSelectTabActive: {
    backgroundColor: "rgba(245, 158, 11, 0.12)",
  },
  charSelectTabText: {
    fontSize: 16,
  },
  strokeCanvasWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },

  // Synonyms
  synonymCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  synonymHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  synonymWord: {
    fontSize: 17,
    fontWeight: "800",
  },
  synonymPinyin: {
    fontSize: 14,
    fontWeight: "700",
  },
  synonymMeaning: {
    fontSize: 13,
    fontWeight: "600",
  },
  smallTtsBtn: {
    padding: 6,
  },
  exploreNextBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#10B981",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 2,
  },
  exploreNextBtnText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  synonymDiffBox: {
    padding: 8,
    borderRadius: 8,
    marginTop: 4,
  },
  synonymDiffText: {
    fontSize: 12.5,
    lineHeight: 18,
  },

  // Usages
  usageCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  usagePatternBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(59, 130, 246, 0.12)",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 6,
  },
  usagePatternText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#2563EB",
  },
  usageMeaningText: {
    fontSize: 13.5,
    fontWeight: "600",
    marginBottom: 8,
  },
  usageExampleBox: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  usageExampleCn: {
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 22,
    flex: 1,
  },
  usageExamplePinyin: {
    fontSize: 12.5,
    fontWeight: "600",
    marginTop: 4,
  },
  usageExampleVn: {
    fontSize: 12.5,
    marginTop: 2,
    lineHeight: 18,
  },

  // Related words
  relatedWordsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  relatedWordChip: {
    width: "48%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  relatedWordText: {
    fontSize: 15,
    fontWeight: "800",
  },
  relatedWordPinyin: {
    fontSize: 12,
    fontWeight: "600",
  },
  relatedWordMeaning: {
    fontSize: 11.5,
    marginTop: 2,
  },
  emptySectionText: {
    fontSize: 13,
    fontStyle: "italic",
    paddingVertical: 4,
  },
});
