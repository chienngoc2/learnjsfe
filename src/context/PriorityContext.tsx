import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "@/services/api";

export interface PriorityWordInput {
  term: string;
  word?: string;
  reading?: string;
  pinyin?: string;
  meaning?: string;
  def?: any;
  topicTitle?: string;
  topicId?: string;
}

export interface PriorityContextProps {
  prioritySet: Set<string>;
  priorityCount: number;
  priorityWords: any[];
  priorityTopics: string[];
  isLoading: boolean;
  isPriority: (term: string) => boolean;
  togglePriority: (wordInput: PriorityWordInput) => Promise<boolean>;
  addPriority: (wordInput: PriorityWordInput) => Promise<boolean>;
  removePriority: (term: string) => Promise<boolean>;
  refreshPriority: () => Promise<void>;
}

const PriorityContext = createContext<PriorityContextProps | undefined>(undefined);

const STORAGE_CACHE_KEY = "@app_priority_cache_v2";
const PENDING_SYNC_KEY = "@app_priority_pending_sync_v2";

export function PriorityProvider({ children }: { children: React.ReactNode }) {
  const [prioritySet, setPrioritySet] = useState<Set<string>>(new Set());
  const [priorityWords, setPriorityWords] = useState<any[]>([]);
  const [priorityTopics, setPriorityTopics] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // In-flight sync queue to prevent duplicate concurrent network bursts
  const inFlightRef = useRef<Map<string, boolean>>(new Map());

  // 1. Khởi tạo tức thì từ AsyncStorage Cache (0ms cold start)
  useEffect(() => {
    (async () => {
      try {
        const cached = await AsyncStorage.getItem(STORAGE_CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed.terms)) {
            setPrioritySet(new Set(parsed.terms));
          }
          if (Array.isArray(parsed.words)) {
            setPriorityWords(parsed.words);
          }
          if (Array.isArray(parsed.topics)) {
            setPriorityTopics(parsed.topics);
          }
        }
      } catch (err) {
        console.warn("[Priority] Lỗi nạp cache local:", err);
      }
      // Sau khi nạp local, fetch đồng bộ dữ liệu mới nhất từ server
      refreshPriority();
    })();
  }, []);

  // Lưu snapshot vào AsyncStorage để offline/mở lại app là có ngay
  const saveSnapshotToStorage = async (
    termsList: string[],
    wordsList: any[],
    topicsList: string[]
  ) => {
    try {
      await AsyncStorage.setItem(
        STORAGE_CACHE_KEY,
        JSON.stringify({
          terms: termsList,
          words: wordsList,
          topics: topicsList,
          updatedAt: Date.now(),
        })
      );
    } catch (e) {
      console.warn("[Priority] Lỗi lưu cache local:", e);
    }
  };

  // Đồng bộ lại toàn bộ danh sách ưu tiên từ máy chủ
  const refreshPriority = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await api.get("/api/vocab/priority/list");
      if (res.data && res.data.success) {
        const words: any[] = res.data.words || [];
        const topics: string[] = res.data.topics || [];
        const terms = words.map((w) => w.term).filter(Boolean);

        setPrioritySet(new Set(terms));
        setPriorityWords(words);
        setPriorityTopics(topics);

        // Cập nhật lại cache local
        await saveSnapshotToStorage(terms, words, topics);
      }
    } catch (err) {
      console.warn("[Priority] Đồng bộ mạng thất bại, tiếp tục dùng cache:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Kiểm tra 1 từ có nằm trong danh sách ưu tiên không (O(1))
  const isPriority = useCallback(
    (term: string): boolean => {
      if (!term) return false;
      return prioritySet.has(term.trim());
    },
    [prioritySet]
  );

  // 🚀 TOGGLE ƯU TIÊN: CẬP NHẬT GIAO DIỆN TỨC THÌ (0ms) & RÁNG TỰ ĐỘNG LƯU VÀO SERVER
  const togglePriority = useCallback(
    async (wordInput: PriorityWordInput): Promise<boolean> => {
      const targetTerm = (wordInput.term || wordInput.word || "").trim();
      if (!targetTerm) return false;

      const wasPriority = prioritySet.has(targetTerm);
      const willBePriority = !wasPriority;

      // ⚡ 1. CẬP NHẬT TỨC THÌ UI STATE (0ms phản hồi, mượt mà tuyệt đối)
      setPrioritySet((prev) => {
        const next = new Set(prev);
        if (willBePriority) {
          next.add(targetTerm);
        } else {
          next.delete(targetTerm);
        }
        return next;
      });

      setPriorityWords((prev) => {
        if (willBePriority) {
          // Thêm vào đầu danh sách
          const exists = prev.some((w) => w.term === targetTerm);
          if (exists) return prev;
          const newWord = {
            term: targetTerm,
            reading: wordInput.reading || wordInput.pinyin || "",
            pinyin: wordInput.pinyin || wordInput.reading || "",
            meaning: wordInput.meaning || "",
            topicTitle: wordInput.topicTitle || "Bài học",
            topicId: wordInput.topicId,
            isPriority: true,
          };
          const nextWords = [newWord, ...prev];
          saveSnapshotToStorage(
            [...prioritySet, targetTerm],
            nextWords,
            priorityTopics
          );
          return nextWords;
        } else {
          // Bỏ khỏi danh sách
          const nextWords = prev.filter((w) => w.term !== targetTerm);
          saveSnapshotToStorage(
            Array.from(prioritySet).filter((t) => t !== targetTerm),
            nextWords,
            priorityTopics
          );
          return nextWords;
        }
      });

      // ⚡ 2. RÁNG GỬI LƯU LÊN SERVER Ở CHẾ ĐỘ NỀN (Auto-retry & sync)
      try {
        inFlightRef.current.set(targetTerm, true);
        const res = await api.post("/api/vocab/priority/toggle", {
          term: targetTerm,
          word: targetTerm,
          reading: wordInput.reading || wordInput.pinyin,
          pinyin: wordInput.pinyin || wordInput.reading,
          meaning: wordInput.meaning,
          topicTitle: wordInput.topicTitle,
          topicId: wordInput.topicId,
        });

        if (res.data && res.data.success) {
          const serverIsPriority = !!res.data.isPriority;
          const serverTopicTitle = res.data.topicTitle;

          // Nếu server phản hồi thông tin bài học chuẩn xác, cập nhật lại topicTitle
          if (serverTopicTitle) {
            setPriorityWords((prev) =>
              prev.map((w) =>
                w.term === targetTerm ? { ...w, topicTitle: serverTopicTitle } : w
              )
            );
          }

          // Kiểm tra nếu trạng thái server khác với phỏng đoán, đồng bộ theo server
          if (serverIsPriority !== willBePriority) {
            setPrioritySet((prev) => {
              const next = new Set(prev);
              if (serverIsPriority) next.add(targetTerm);
              else next.delete(targetTerm);
              return next;
            });
          }
          return serverIsPriority;
        }
        return willBePriority;
      } catch (err) {
        console.warn(
          `[Priority] Server sync delay cho "${targetTerm}". Đã lưu cache cục bộ.`
        );
        // Lưu tạm vào pending sync queue để đồng bộ khi có mạng
        try {
          const pendingRaw = await AsyncStorage.getItem(PENDING_SYNC_KEY);
          const pending = pendingRaw ? JSON.parse(pendingRaw) : [];
          pending.push({
            action: willBePriority ? "add" : "remove",
            data: wordInput,
            time: Date.now(),
          });
          await AsyncStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(pending));
        } catch (_) {}
        return willBePriority;
      } finally {
        inFlightRef.current.delete(targetTerm);
      }
    },
    [prioritySet, priorityTopics]
  );

  // 🚀 THÊM TRỰC TIẾP VÀO ƯU TIÊN (Dành cho game từ vựng, tự động dò bài)
  const addPriority = useCallback(
    async (wordInput: PriorityWordInput): Promise<boolean> => {
      const targetTerm = (wordInput.term || wordInput.word || "").trim();
      if (!targetTerm) return false;

      // Cập nhật local tức thì
      setPrioritySet((prev) => {
        if (prev.has(targetTerm)) return prev;
        const next = new Set(prev);
        next.add(targetTerm);
        return next;
      });

      setPriorityWords((prev) => {
        if (prev.some((w) => w.term === targetTerm)) return prev;
        const newWord = {
          term: targetTerm,
          reading: wordInput.reading || wordInput.pinyin || "",
          pinyin: wordInput.pinyin || wordInput.reading || "",
          meaning: wordInput.meaning || "",
          topicTitle: wordInput.topicTitle || "Bài học",
          topicId: wordInput.topicId,
          isPriority: true,
        };
        const nextWords = [newWord, ...prev];
        saveSnapshotToStorage([...prioritySet, targetTerm], nextWords, priorityTopics);
        return nextWords;
      });

      // Gửi API
      try {
        const res = await api.post("/api/vocab/priority/add", {
          term: targetTerm,
          word: targetTerm,
          reading: wordInput.reading || wordInput.pinyin,
          meaning: wordInput.meaning,
          topicTitle: wordInput.topicTitle,
          topicId: wordInput.topicId,
        });
        if (res.data?.topicTitle) {
          const t = res.data.topicTitle;
          setPriorityWords((prev) =>
            prev.map((w) => (w.term === targetTerm ? { ...w, topicTitle: t } : w))
          );
        }
        return true;
      } catch (e) {
        console.warn(`[Priority] addPriority network error cho ${targetTerm}:`, e);
        return true;
      }
    },
    [prioritySet, priorityTopics]
  );

  // 🚀 GỠ KHỎI ƯU TIÊN
  const removePriority = useCallback(
    async (term: string): Promise<boolean> => {
      const targetTerm = term.trim();
      if (!targetTerm) return false;

      setPrioritySet((prev) => {
        if (!prev.has(targetTerm)) return prev;
        const next = new Set(prev);
        next.delete(targetTerm);
        return next;
      });

      setPriorityWords((prev) => prev.filter((w) => w.term !== targetTerm));

      try {
        await api.post("/api/vocab/priority/remove", {
          term: targetTerm,
          word: targetTerm,
        });
        return true;
      } catch (e) {
        console.warn(`[Priority] removePriority network error cho ${targetTerm}:`, e);
        return true;
      }
    },
    []
  );

  return (
    <PriorityContext.Provider
      value={{
        prioritySet,
        priorityCount: prioritySet.size,
        priorityWords,
        priorityTopics,
        isLoading,
        isPriority,
        togglePriority,
        addPriority,
        removePriority,
        refreshPriority,
      }}
    >
      {children}
    </PriorityContext.Provider>
  );
}

export function usePriority() {
  const context = useContext(PriorityContext);
  if (!context) {
    throw new Error("usePriority must be used within a PriorityProvider");
  }
  return context;
}
