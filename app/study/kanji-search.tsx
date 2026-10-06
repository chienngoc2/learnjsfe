import React, { useState, useEffect, useMemo } from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Keyboard,
  Platform,
} from "react-native";
import { MaterialIcons, Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams } from "expo-router";
import * as Speech from "expo-speech";
import { useTheme } from "@/src/context/ThemeContext";
import { usePinyin } from "@/src/context/PinyinContext";
import PinyinCheckbox from "../../components/ui/PinyinCheckbox";
import Header from "../../components/ui/Header";
import api from "@/services/api";
import HandwritingCanvas from "../../components/HandwritingCanvas";
import StrokeOrderPractice from "../../components/StrokeOrderPractice";
import masterData from "@/assets/data/vocab_master.json";

interface ExampleWord {
  word: string;
  reading: string;
  meaning: string;
}

interface ExampleSentence {
  cn: string;
  pinyin?: string;
  vn: string;
}

interface KanjiData {
  _id?: string;
  character: string;
  characters?: string[];
  meaning: string;
  pinyin?: string;
  zhuyin?: string;
  onyomi?: string;
  kunyomi?: string;
  vietnamese_reading: string;
  level: string;
  stroke_order?: string[];
  example_words?: ExampleWord[];
  examples?: ExampleSentence[];
  story?: string;
  components?: string[];
}

const masterWords: Array<{
  word: string;
  pinyin?: string;
  meaning: string;
  level?: string;
}> = (masterData as any).words || [];

// 📖 TỪ ĐIỂN ÂM HÁN VIỆT & NGHĨA TIẾNG VIỆT CHUẨN XÁC ĐẦY ĐỦ
export const SINO_VIETNAMESE_DICT: Record<
  string,
  { hanviet: string; meaning: string; pinyin: string }
> = {
  // Chữ số & Số đếm
  一: { hanviet: "Nhất", meaning: "số 1, một", pinyin: "yī" },
  二: { hanviet: "Nhị", meaning: "số 2, hai", pinyin: "èr" },
  三: { hanviet: "Tam", meaning: "số 3, ba", pinyin: "sān" },
  四: { hanviet: "Tứ", meaning: "số 4, bốn", pinyin: "sì" },
  五: { hanviet: "Ngũ", meaning: "số 5, năm", pinyin: "wǔ" },
  六: { hanviet: "Lục", meaning: "số 6, sáu", pinyin: "liù" },
  七: { hanviet: "Thất", meaning: "số 7, bảy", pinyin: "qī" },
  八: { hanviet: "Bát", meaning: "số 8, tám", pinyin: "bā" },
  九: { hanviet: "Cửu", meaning: "số 9, chín", pinyin: "jiǔ" },
  十: { hanviet: "Thập", meaning: "số 10, mười", pinyin: "shí" },
  百: { hanviet: "Bách", meaning: "trăm", pinyin: "bǎi" },
  千: { hanviet: "Thiên", meaning: "nghìn", pinyin: "qiān" },
  萬: { hanviet: "Vạn", meaning: "vạn, mười nghìn", pinyin: "wàn" },
  万: { hanviet: "Vạn", meaning: "vạn, mười nghìn", pinyin: "wàn" },

  // Tên riêng & Nhân vật phổ biến
  田: { hanviet: "Điền", meaning: "ruộng, họ Điền", pinyin: "tián" },
  中: { hanviet: "Trung", meaning: "ở giữa, Trung Quốc", pinyin: "zhōng" },
  誠: { hanviet: "Thành", meaning: "chân thành, thành thật", pinyin: "chéng" },
  陳: { hanviet: "Trần", meaning: "họ Trần, bày ra", pinyin: "chén" },
  月: { hanviet: "Nguyệt", meaning: "tháng, mặt trăng", pinyin: "yuè" },
  美: { hanviet: "Mỹ", meaning: "đẹp, hoàn mỹ, nước Mỹ", pinyin: "měi" },
  李: { hanviet: "Lý", meaning: "họ Lý, cây mận", pinyin: "lǐ" },
  明: { hanviet: "Minh", meaning: "sáng sủa, ngày mai", pinyin: "míng" },
  華: { hanviet: "Hoa", meaning: "hoa lệ, phồn hoa, Trung Hoa", pinyin: "huá" },
  王: { hanviet: "Vương", meaning: "vua, họ Vương", pinyin: "wáng" },
  開: { hanviet: "Khai", meaning: "mở, bắt đầu, nở", pinyin: "kāi" },
  文: { hanviet: "Văn", meaning: "văn học, văn hóa, chữ viết", pinyin: "wén" },

  // Đại từ & Xưng hô
  你: { hanviet: "Nhĩ", meaning: "bạn, anh, chị", pinyin: "nǐ" },
  您: { hanviet: "Nẫm", meaning: "ngài, ông (kính ngữ)", pinyin: "nín" },
  我: { hanviet: "Ngã", meaning: "tôi, mình, ta", pinyin: "wǒ" },
  他: { hanviet: "Tha", meaning: "anh ấy, cậu ấy", pinyin: "tā" },
  她: { hanviet: "Tha", meaning: "cô ấy, bà ấy", pinyin: "tā" },
  們: { hanviet: "Môn", meaning: "chúng tôi, các bạn (số nhiều)", pinyin: "men" },
  人: { hanviet: "Nhân", meaning: "người", pinyin: "rén" },
  誰: { hanviet: "Thùy", meaning: "ai", pinyin: "shéi" },
  先: { hanviet: "Tiên", meaning: "trước, đầu tiên", pinyin: "xiān" },
  生: { hanviet: "Sinh", meaning: "sinh ra, học sinh, ông/ngài", pinyin: "shēng" },
  小: { hanviet: "Tiểu", meaning: "nhỏ, bé", pinyin: "xiǎo" },
  姐: { hanviet: "Tỷ", meaning: "chị, cô", pinyin: "jiě" },
  老: { hanviet: "Lão", meaning: "già, thầy", pinyin: "lǎo" },
  師: { hanviet: "Sư", meaning: "thầy, cô giáo", pinyin: "shī" },
  學: { hanviet: "Học", meaning: "học tập", pinyin: "xué" },
  朋: { hanviet: "Bằng", meaning: "bạn bè", pinyin: "péng" },
  友: { hanviet: "Hữu", meaning: "bạn hữu", pinyin: "yǒu" },
  家: { hanviet: "Gia", meaning: "nhà, gia đình", pinyin: "jiā" },

  // Động từ & Hành động
  來: { hanviet: "Lai", meaning: "đến, tới", pinyin: "lái" },
  去: { hanviet: "Khứ", meaning: "đi", pinyin: "qù" },
  是: { hanviet: "Thị", meaning: "là, đúng, phải", pinyin: "shì" },
  有: { hanviet: "Hữu", meaning: "có", pinyin: "yǒu" },
  沒: { hanviet: "Một", meaning: "không có, chưa", pinyin: "méi" },
  在: { hanviet: "Tại", meaning: "ở, tại, đang", pinyin: "zài" },
  吃: { hanviet: "Cật", meaning: "ăn", pinyin: "chī" },
  喝: { hanviet: "Hát", meaning: "uống", pinyin: "hē" },
  買: { hanviet: "Mãi", meaning: "mua", pinyin: "mǎi" },
  賣: { hanviet: "Mại", meaning: "bán", pinyin: "mài" },
  做: { hanviet: "Tố", meaning: "làm", pinyin: "zuò" },
  作: { hanviet: "Tác", meaning: "làm việc, tác phẩm", pinyin: "zuò" },
  看: { hanviet: "Khán", meaning: "xem, nhìn, đọc", pinyin: "kàn" },
  聽: { hanviet: "Thính", meaning: "nghe", pinyin: "tīng" },
  說: { hanviet: "Thuyết", meaning: "nói", pinyin: "shuō" },
  讀: { hanviet: "Độc", meaning: "đọc", pinyin: "dú" },
  寫: { hanviet: "Tả", meaning: "viết", pinyin: "xiě" },
  教: { hanviet: "Giáo", meaning: "dạy dỗ", pinyin: "jiāo" },
  問: { hanviet: "Vấn", meaning: "hỏi", pinyin: "wèn" },
  請: { hanviet: "Thỉnh", meaning: "xin mời, vui lòng", pinyin: "qǐng" },
  謝: { hanviet: "Tạ", meaning: "cảm ơn, họ Tạ", pinyin: "xiè" },
  接: { hanviet: "Tiếp", meaning: "đón, nhận, tiếp xúc", pinyin: "jiē" },
  叫: { hanviet: "Khiếu", meaning: "gọi là, tên là", pinyin: "jiào" },
  姓: { hanviet: "Tính", meaning: "họ (tên họ)", pinyin: "xìng" },
  想: { hanviet: "Tưởng", meaning: "nghĩ, muốn, nhớ", pinyin: "xiǎng" },
  要: { hanviet: "Yếu", meaning: "muốn, cần", pinyin: "yào" },
  會: { hanviet: "Hội", meaning: "biết, có thể, cuộc họp", pinyin: "huì" },
  能: { hanviet: "Năng", meaning: "có khả năng", pinyin: "néng" },
  喜: { hanviet: "Hỷ", meaning: "thích, vui mừng", pinyin: "xǐ" },
  歡: { hanviet: "Hoan", meaning: "hoan hỷ, vui vẻ", pinyin: "huān" },
  迎: { hanviet: "Nghênh", meaning: "đón tiếp, hoan nghênh", pinyin: "yíng" },
  給: { hanviet: "Cấp", meaning: "cho, đưa cho", pinyin: "gěi" },
  帶: { hanviet: "Đới", meaning: "mang theo, dẫn dắt", pinyin: "dài" },
  等: { hanviet: "Đẳng", meaning: "chờ đợi, hạng", pinyin: "děng" },
  找: { hanviet: "Trảo", meaning: "tìm kiếm, thối tiền", pinyin: "zhǎo" },
  坐: { hanviet: "Tọa", meaning: "ngồi", pinyin: "zuò" },
  走: { hanviet: "Tẩu", meaning: "đi, bước đi", pinyin: "zǒu" },
  進: { hanviet: "Tiến", meaning: "tiến vào", pinyin: "jìn" },
  出: { hanviet: "Xuất", meaning: "ra ngoài", pinyin: "chū" },
  回: { hanviet: "Hồi", meaning: "quay về", pinyin: "huí" },

  // Thời gian & Phương hướng & Vị trí
  日: { hanviet: "Nhật", meaning: "ngày, mặt trời", pinyin: "rì" },
  天: { hanviet: "Thiên", meaning: "trời, ngày", pinyin: "tiān" },
  年: { hanviet: "Niên", meaning: "năm, tuổi", pinyin: "nián" },
  底: { hanviet: "Đế", meaning: "đáy, cuối (tháng)", pinyin: "dǐ" },
  期: { hanviet: "Kỳ", meaning: "kỳ hạn, thời kỳ", pinyin: "qí" },
  末: { hanviet: "Mạt", meaning: "cuối, mạt", pinyin: "mò" },
  初: { hanviet: "Sơ", meaning: "đầu (tháng), ban sơ", pinyin: "chū" },
  今: { hanviet: "Kim", meaning: "hôm nay, bây giờ", pinyin: "jīn" },
  昨: { hanviet: "Tác", meaning: "hôm qua", pinyin: "zuó" },
  上: { hanviet: "Thượng", meaning: "ở trên, trước", pinyin: "shàng" },
  下: { hanviet: "Hạ", meaning: "ở dưới, sau", pinyin: "xià" },
  前: { hanviet: "Tiền", meaning: "phía trước", pinyin: "qián" },
  後: { hanviet: "Hậu", meaning: "phía sau", pinyin: "hòu" },
  左: { hanviet: "Tả", meaning: "bên trái", pinyin: "zuǒ" },
  右: { hanviet: "Hữu", meaning: "bên phải", pinyin: "yòu" },
  東: { hanviet: "Đông", meaning: "phía Đông", pinyin: "dōng" },
  西: { hanviet: "Tây", meaning: "phía Tây", pinyin: "xī" },
  南: { hanviet: "Nam", meaning: "phía Nam", pinyin: "nán" },
  北: { hanviet: "Bắc", meaning: "phía Bắc", pinyin: "běi" },

  // Tính từ & Trợ từ & Danh từ thường gặp
  好: { hanviet: "Hảo", meaning: "tốt, đẹp, hay", pinyin: "hǎo" },
  大: { hanviet: "Đại", meaning: "to, lớn", pinyin: "dà" },
  多: { hanviet: "Đa", meaning: "nhiều", pinyin: "duō" },
  少: { hanviet: "Thiểu", meaning: "ít", pinyin: "shǎo" },
  高: { hanviet: "Cao", meaning: "cao", pinyin: "gāo" },
  新: { hanviet: "Tân", meaning: "mới", pinyin: "xīn" },
  舊: { hanviet: "Cựu", meaning: "cũ", pinyin: "jiù" },
  貴: { hanviet: "Quý", meaning: "quý, đắt tiền", pinyin: "guì" },
  便: { hanviet: "Tiện", meaning: "tiện lợi, rẻ", pinyin: "pián" },
  宜: { hanviet: "Nghi", meaning: "thích hợp, rẻ", pinyin: "yí" },
  早: { hanviet: "Tảo", meaning: "sớm", pinyin: "zǎo" },
  晚: { hanviet: "Vãn", meaning: "muộn, tối", pinyin: "wǎn" },
  快: { hanviet: "Khoái", meaning: "nhanh, vui vẻ", pinyin: "kuài" },
  慢: { hanviet: "Mạn", meaning: "chậm chạp", pinyin: "màn" },
  很: { hanviet: "Khẩn", meaning: "rất, quá", pinyin: "hěn" },
  太: { hanviet: "Thái", meaning: "quá, lắm", pinyin: "tài" },
  真: { hanviet: "Chân", meaning: "thật, chân thật", pinyin: "zhēn" },
  都: { hanviet: "Đô", meaning: "đều, tất cả", pinyin: "dōu" },
  也: { hanviet: "Dã", meaning: "cũng", pinyin: "yě" },
  不: { hanviet: "Bất", meaning: "không, chẳng", pinyin: "bù" },
  客: { hanviet: "Khách", meaning: "khách sáo, khách hàng", pinyin: "kè" },
  氣: { hanviet: "Khí", meaning: "không khí, lịch sự, tính khí", pinyin: "qì" },
  茶: { hanviet: "Trà", meaning: "trà, chè", pinyin: "chá" },
  飯: { hanviet: "Phạn", meaning: "cơm, bữa ăn", pinyin: "fàn" },
  錢: { hanviet: "Tiền", meaning: "tiền bạc", pinyin: "qián" },
  書: { hanviet: "Thư", meaning: "sách", pinyin: "shū" },
  字: { hanviet: "Tự", meaning: "chữ viết", pinyin: "zì" },
  漢: { hanviet: "Hán", meaning: "tiếng Hán, Hán tộc", pinyin: "hàn" },
  語: { hanviet: "Ngữ", meaning: "ngôn ngữ, lời nói", pinyin: "yǔ" },
  國: { hanviet: "Quốc", meaning: "đất nước, quốc gia", pinyin: "guó" },
  臺: { hanviet: "Đài", meaning: "Đài Loan, bục bệ", pinyin: "tái" },
  台: { hanviet: "Đài", meaning: "Đài Loan, đài", pinyin: "tái" },
  灣: { hanviet: "Loan", meaning: "vịnh biển, Đài Loan", pinyin: "wān" },
  這: { hanviet: "Giá", meaning: "đây, này", pinyin: "zhè" },
  那: { hanviet: "Na", meaning: "kia, đó", pinyin: "nà" },
  嗎: { hanviet: "Ma", meaning: "phải không, ư, nhỉ", pinyin: "ma" },
  呢: { hanviet: "Ni", meaning: "thì sao, nhé, nhỉ", pinyin: "ne" },
  吧: { hanviet: "Ba", meaning: "nhé, đi, thôi", pinyin: "ba" },
  甚: { hanviet: "Thậm", meaning: "cái gì, rất", pinyin: "shén" },
  麼: { hanviet: "Ma", meaning: "cái gì, sao", pinyin: "me" },
};

export default function KanjiSearchScreen() {
  const { colors, isDark } = useTheme();
  const { hidePinyin } = usePinyin();
  const routeParams = useLocalSearchParams<{
    topicId?: string;
    title?: string;
    word?: string;
  }>();

  const [searchQuery, setSearchQuery] = useState(routeParams.word || "");
  const [hideKeyboardSuggestions, setHideKeyboardSuggestions] = useState(false);
  const [inputMode, setInputMode] = useState<"keyboard" | "handwriting">("handwriting");
  const [selectedKanji, setSelectedKanji] = useState<KanjiData | null>(null);
  const [activePracticeChar, setActivePracticeChar] = useState<string>("");
  const [loading, setLoading] = useState(false);

  // 🌟 Quản lý danh sách từ vựng theo bài học nếu mở từ bài học
  const [lessonTitle, setLessonTitle] = useState(routeParams.title || "");
  const [lessonWordsList, setLessonWordsList] = useState<
    Array<{ word: string; pinyin?: string; meaning: string }>
  >([]);
  const [currentLessonIdx, setCurrentLessonIdx] = useState(0);

  // 🌟 Tổng kho từ vựng hợp nhất (Gồm 533 từ Master + TẤT CẢ từ trong các bảng bài học & Kanji)
  const [allWords, setAllWords] = useState<
    Array<{ word: string; pinyin?: string; meaning: string; level?: string }>
  >(masterWords);

  // Tự động kéo tất cả các bộ bài học từ Server về khi mở màn hình
  useEffect(() => {
    let isMounted = true;
    const loadAllLessonWords = async () => {
      try {
        const [vocabRes, kanjiRes] = await Promise.allSettled([
          api.get("/api/vocab/lists"),
          api.get("/api/kanji/all", { params: { limit: 500 } }),
        ]);

        const dbWords: Array<{
          word: string;
          pinyin?: string;
          meaning: string;
          level?: string;
        }> = [];
        const seen = new Set<string>();

        if (vocabRes.status === "fulfilled" && vocabRes.value.data?.data) {
          const lists = vocabRes.value.data.data;
          lists.forEach((list: any) => {
            const currentListWords: Array<{ word: string; pinyin?: string; meaning: string }> = [];
            (list.words || []).forEach((w: any) => {
              if (w.term) {
                let meaning = w.meaning || w.def || "";
                if (typeof meaning === "string" && meaning.startsWith("{")) {
                  try {
                    const parsed = JSON.parse(meaning);
                    meaning = parsed.meaning || parsed.def || meaning;
                  } catch (e) {}
                }
                const wordItem = {
                  word: w.term,
                  pinyin: w.pinyin || w.reading || "",
                  meaning: String(meaning || ""),
                  level: list.title || w.level || "Bài học",
                };
                currentListWords.push(wordItem);
                if (!seen.has(w.term)) {
                  seen.add(w.term);
                  dbWords.push(wordItem);
                }
              }
            });

            // Nếu người dùng chọn luyện viết bài học này
            if (
              routeParams.topicId &&
              (list._id === routeParams.topicId || list.title === routeParams.title)
            ) {
              setLessonTitle(list.title);
              setLessonWordsList(currentListWords);
              if (currentListWords.length > 0) {
                const targetInitialWord = routeParams.word || currentListWords[0].word;
                const foundIdx = currentListWords.findIndex((w) => w.word === targetInitialWord);
                setCurrentLessonIdx(foundIdx >= 0 ? foundIdx : 0);
                performSearch(targetInitialWord);
              }
            }
          });
        }

        if (kanjiRes.status === "fulfilled" && kanjiRes.value.data?.data) {
          const kanjiItems = kanjiRes.value.data.data;
          kanjiItems.forEach((k: any) => {
            if (k.character && !seen.has(k.character)) {
              seen.add(k.character);
              dbWords.push({
                word: k.character,
                pinyin: k.pinyin || "",
                meaning: k.meaning || k.vietnamese_reading || "",
                level: k.lessonGroup || k.level || "Kanji",
              });
            }
            (k.example_words || []).forEach((ew: any) => {
              if (ew.word && !seen.has(ew.word)) {
                seen.add(ew.word);
                dbWords.push({
                  word: ew.word,
                  pinyin: ew.reading || "",
                  meaning: ew.meaning || "",
                  level: k.lessonGroup || k.level || "Kanji",
                });
              }
            });
          });
        }

        if (isMounted && dbWords.length > 0) {
          setAllWords((prev) => {
            const map = new Map<
              string,
              { word: string; pinyin?: string; meaning: string; level?: string }
            >();
            // 1. Thêm từ static master
            prev.forEach((w) => map.set(w.word, w));
            // 2. Bổ sung / đè các từ trong bảng bài học DB
            dbWords.forEach((w) => map.set(w.word, w));
            return Array.from(map.values());
          });
        }
      } catch (e) {
        console.warn("Lỗi khi tải từ vựng bài học:", e);
      }
    };

    loadAllLessonWords();
    return () => {
      isMounted = false;
    };
  }, []);

  // Tự động tìm kiếm nếu truyền trực tiếp từ param word
  useEffect(() => {
    if (routeParams.word && !routeParams.topicId) {
      performSearch(routeParams.word);
    }
  }, [routeParams.word]);

  // 🌟 Gợi ý từ vựng trực tiếp khi nhập bàn phím (ngay cả khi chỉ gõ 1 chữ)
  const liveKeyboardSuggestions = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return [];

    const qLower = q.toLowerCase();
    const hanziChars = q.split("").filter((ch) => /[\u4e00-\u9fff\u3400-\u4dbf]/.test(ch));

    const matched: Array<{
      word: string;
      pinyin?: string;
      meaning: string;
      matchType: string;
    }> = [];
    const seen = new Set<string>();

    allWords.forEach((item) => {
      const wordLower = item.word.toLowerCase();
      const pinyinLower = (item.pinyin || "").toLowerCase();
      const meaningLower = (item.meaning || "").toLowerCase();

      const exactWord = wordLower === qLower;
      const containsWord = wordLower.includes(qLower);
      const containsChar =
        hanziChars.length > 0 && hanziChars.some((ch) => item.word.includes(ch));
      const containsPinyin = pinyinLower.includes(qLower);
      const containsMeaning = meaningLower.includes(qLower);

      if (
        (exactWord || containsWord || containsChar || containsPinyin || containsMeaning) &&
        !seen.has(item.word)
      ) {
        seen.add(item.word);
        let matchType = "Gợi ý";
        if (exactWord) matchType = "Khớp từ";
        else if (containsWord) matchType = "Khớp cụm";
        else if (containsChar) {
          const ch = hanziChars.find((c) => item.word.includes(c));
          matchType = `Chứa "${ch}"`;
        } else if (containsPinyin) matchType = "Pinyin";
        else if (containsMeaning) matchType = "Nghĩa";

        matched.push({
          word: item.word,
          pinyin: item.pinyin,
          meaning: item.meaning,
          matchType,
        });
      }
    });

    return matched.slice(0, 16);
  }, [searchQuery, allWords]);

  // Cập nhật chữ đang được chọn để múa nét khi kết quả tra cứu thay đổi
  useEffect(() => {
    if (selectedKanji) {
      if (selectedKanji.characters && selectedKanji.characters.length > 0) {
        setActivePracticeChar(selectedKanji.characters[0]);
      } else if (selectedKanji.character) {
        setActivePracticeChar(selectedKanji.character[0]);
      }
    }
  }, [selectedKanji]);

  // 🔍 HÀM TÌM KIẾM CỤC BỘ TỨC THÌ TỪ KHO MASTER & TẤT CẢ BẢNG BÀI HỌC
  const buildLocalSearchResult = (queryText: string): KanjiData | null => {
    const q = queryText.trim();
    if (!q) return null;

    const singleChars = q
      .split("")
      .filter((ch) => /[\u4e00-\u9fff\u3400-\u4dbf]/.test(ch));

    // 1. Tìm chính xác trong toàn bộ kho allWords
    const exactMaster = allWords.find(
      (w) => w.word === q || w.word.toLowerCase() === q.toLowerCase()
    );

    // 2. Tìm mờ nếu không thấy chính xác
    const fuzzyMaster = !exactMaster
      ? allWords.find(
          (w) =>
            w.word.includes(q) ||
            (w.pinyin && w.pinyin.toLowerCase().includes(q.toLowerCase())) ||
            (w.meaning && w.meaning.toLowerCase().includes(q.toLowerCase()))
        )
      : null;

    const targetMaster = exactMaster || fuzzyMaster;
    const targetWordStr = targetMaster?.word || q;
    const targetChars = targetWordStr
      .split("")
      .filter((ch) => /[\u4e00-\u9fff\u3400-\u4dbf]/.test(ch));
    const effectiveChars = targetChars.length > 0 ? targetChars : singleChars;

    // 3. Tra cứu âm Hán Việt & Pinyin từng chữ
    const hanvietList = effectiveChars.map(
      (ch) => SINO_VIETNAMESE_DICT[ch]?.hanviet || ch
    );
    const charMeanings = effectiveChars.map(
      (ch) => SINO_VIETNAMESE_DICT[ch]?.meaning || ""
    );
    const charPinyins = effectiveChars.map(
      (ch) => SINO_VIETNAMESE_DICT[ch]?.pinyin || ""
    );

    let hanviet =
      targetMaster?.meaning && targetMaster.meaning.length <= 25 && effectiveChars.length > 1
        ? targetMaster.meaning
        : hanvietList.join(" ");

    if (!hanviet || hanviet === q) {
      hanviet = SINO_VIETNAMESE_DICT[q]?.hanviet || hanvietList.join(" ") || "Phồn Thể";
    }

    let meaning =
      targetMaster?.meaning ||
      SINO_VIETNAMESE_DICT[q]?.meaning ||
      charMeanings.filter(Boolean).join(", ");

    if (!meaning) {
      meaning = `Từ vựng tiếng Trung Phồn Thể (${hanviet})`;
    }

    let pinyin =
      targetMaster?.pinyin ||
      SINO_VIETNAMESE_DICT[q]?.pinyin ||
      charPinyins.filter(Boolean).join(" ");

    // 4. Quét tìm tất cả các từ ghép / từ liên quan trong toàn bộ kho chứa các chữ này
    const searchChs = effectiveChars.length > 0 ? effectiveChars : [q];
    const relatedWords: ExampleWord[] = [];
    const seen = new Set<string>();

    allWords.forEach((w) => {
      const contains = searchChs.some((ch) => w.word.includes(ch));
      if (contains && !seen.has(w.word)) {
        seen.add(w.word);
        relatedWords.push({
          word: w.word,
          reading: w.pinyin || "",
          meaning: w.meaning || "",
        });
      }
    });

    // 5. Tạo câu ví dụ song ngữ tự nhiên
    const sampleExamples: ExampleSentence[] = [
      {
        cn: `這是${targetWordStr}。`,
        pinyin: `Zhè shì ${pinyin || targetWordStr}.`,
        vn: `Đây là ${meaning.split(",")[0]}.`,
      },
    ];

    if (relatedWords.length > 0) {
      const sample = relatedWords.find((r) => r.word !== targetWordStr) || relatedWords[0];
      if (sample && sample.word !== targetWordStr) {
        sampleExamples.push({
          cn: `我很喜歡${sample.word}。`,
          pinyin: `Wǒ hěn xǐhuān ${sample.reading || sample.word}.`,
          vn: `Tôi rất thích ${sample.meaning.split(",")[0]}.`,
        });
      }
    }

    return {
      character: targetWordStr,
      characters: effectiveChars.length > 0 ? effectiveChars : [targetWordStr[0] || targetWordStr],
      meaning,
      pinyin,
      vietnamese_reading: hanviet,
      level: targetMaster?.level || "TOCFL A1",
      example_words: relatedWords,
      examples: sampleExamples,
    };
  };

  const performSearch = async (queryText: string) => {
    Keyboard.dismiss();
    setHideKeyboardSuggestions(true);
    const query = queryText.trim();
    if (!query) return;

    setSearchQuery(query);

    // 1. Phục vụ kết quả cục bộ NGAY LẬP TỨC (0ms lag, luôn có nghĩa & từ ghép)
    const localResult = buildLocalSearchResult(query);
    if (localResult) {
      setSelectedKanji(localResult);
    }

    // 2. Tra cứu thêm từ Server để bổ sung dữ liệu
    try {
      const response = await api.get(`/api/kanji/search`, {
        params: { q: query },
      });

      if (response.data && response.data.success && response.data.data) {
        const serverData: KanjiData = response.data.data;
        // Merge kết quả server với local
        setSelectedKanji((prev) => {
          if (!prev) return serverData;
          return {
            ...serverData,
            meaning:
              serverData.meaning && serverData.meaning !== "Từ vựng tiếng Trung Phồn Thể"
                ? serverData.meaning
                : prev.meaning,
            vietnamese_reading:
              serverData.vietnamese_reading && serverData.vietnamese_reading !== query
                ? serverData.vietnamese_reading
                : prev.vietnamese_reading,
            example_words:
              serverData.example_words && serverData.example_words.length > 0
                ? serverData.example_words
                : prev.example_words,
            examples:
              serverData.examples && serverData.examples.length > 0
                ? serverData.examples
                : prev.examples,
          };
        });
      }
    } catch (error) {
      // Đã có localResult đảm bảo 100% không bao giờ bị trống
    }
  };

  const handleSelectHandwrittenChar = (char: string) => {
    performSearch(char);
  };

  const playPronunciation = (text: string) => {
    Speech.speak(text, {
      language: "zh-TW",
      rate: 0.85,
    });
  };

  const isLessonPracticeMode = lessonWordsList.length > 0 || !!routeParams.topicId;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <Header
        title={
          isLessonPracticeMode
            ? `✍️ Luyện viết: ${lessonTitle || "Bài học"}`
            : "✍️ Tra cứu & Luyện viết"
        }
        rightAction={<PinyinCheckbox compact />}
      />

      {/* 📚 THANH ĐIỀU HƯỚNG BÀI HỌC (KHI MỞ TRONG MỤC LUYỆN VIẾT BÀI HỌC) */}
      {lessonWordsList.length > 0 && (
        <View
          style={[
            styles.lessonBanner,
            {
              backgroundColor: isDark ? "#064E3B" : "#ECFDF5",
              borderColor: colors.emerald,
            },
          ]}
        >
          <View style={styles.lessonBannerTop}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
              <MaterialIcons name="draw" size={18} color={colors.emerald} />
              <Text
                style={[styles.lessonBannerTitle, { color: isDark ? "#A7F3D0" : "#065F46" }]}
                numberOfLines={1}
              >
                Bài học: {lessonTitle} ({lessonWordsList.length} từ)
              </Text>
            </View>
            <View style={styles.lessonNavControls}>
              <TouchableOpacity
                style={[
                  styles.btnNavStep,
                  { backgroundColor: isDark ? "#065F46" : "#FFFFFF" },
                ]}
                disabled={currentLessonIdx === 0}
                onPress={() => {
                  const prevIdx = Math.max(0, currentLessonIdx - 1);
                  setCurrentLessonIdx(prevIdx);
                  performSearch(lessonWordsList[prevIdx].word);
                }}
              >
                <MaterialIcons
                  name="chevron-left"
                  size={20}
                  color={currentLessonIdx === 0 ? colors.textMuted : colors.text}
                />
              </TouchableOpacity>
              <Text
                style={[
                  styles.lessonNavIndicator,
                  { color: isDark ? "#A7F3D0" : "#065F46" },
                ]}
              >
                {currentLessonIdx + 1}/{lessonWordsList.length}
              </Text>
              <TouchableOpacity
                style={[
                  styles.btnNavStep,
                  { backgroundColor: isDark ? "#065F46" : "#FFFFFF" },
                ]}
                disabled={currentLessonIdx >= lessonWordsList.length - 1}
                onPress={() => {
                  const nextIdx = Math.min(lessonWordsList.length - 1, currentLessonIdx + 1);
                  setCurrentLessonIdx(nextIdx);
                  performSearch(lessonWordsList[nextIdx].word);
                }}
              >
                <MaterialIcons
                  name="chevron-right"
                  size={20}
                  color={
                    currentLessonIdx >= lessonWordsList.length - 1
                      ? colors.textMuted
                      : colors.text
                  }
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Dải cuộn chọn nhanh từ trong bài */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.lessonChipsScroll}
          >
            {lessonWordsList.map((item, idx) => {
              const isActive =
                currentLessonIdx === idx || selectedKanji?.character === item.word;
              return (
                <TouchableOpacity
                  key={`${item.word}-${idx}`}
                  style={[
                    styles.lessonChip,
                    {
                      backgroundColor: isActive
                        ? colors.emerald
                        : isDark
                        ? "#022C22"
                        : "#FFFFFF",
                      borderColor: isActive ? colors.emerald : isDark ? "#065F46" : "#A7F3D0",
                    },
                  ]}
                  onPress={() => {
                    setCurrentLessonIdx(idx);
                    performSearch(item.word);
                  }}
                >
                  <Text
                    style={[
                      styles.lessonChipText,
                      {
                        color: isActive
                          ? "#FFFFFF"
                          : isDark
                          ? "#A7F3D0"
                          : "#047857",
                        fontWeight: isActive ? "800" : "600",
                      },
                    ]}
                  >
                    {idx + 1}. {item.word}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Mode Selector Tabs (Chỉ hiện khi ở chế độ tra cứu tự do) */}
      {!isLessonPracticeMode && (
        <View style={styles.modeTabsRow}>
          <TouchableOpacity
            style={[
              styles.modeTab,
              inputMode === "handwriting" && {
                backgroundColor: colors.indigo,
                borderColor: colors.indigo,
              },
              inputMode !== "handwriting" && {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
            onPress={() => setInputMode("handwriting")}
          >
            <MaterialIcons
              name="gesture"
              size={18}
              color={inputMode === "handwriting" ? "#FFFFFF" : colors.text}
            />
            <Text
              style={[
                styles.modeTabText,
                { color: inputMode === "handwriting" ? "#FFFFFF" : colors.text },
              ]}
            >
              Viết tay 3 ô nhận diện
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.modeTab,
              inputMode === "keyboard" && {
                backgroundColor: colors.indigo,
                borderColor: colors.indigo,
              },
              inputMode !== "keyboard" && {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
            onPress={() => setInputMode("keyboard")}
          >
            <MaterialIcons
              name="keyboard"
              size={18}
              color={inputMode === "keyboard" ? "#FFFFFF" : colors.text}
            />
            <Text
              style={[
                styles.modeTabText,
                { color: inputMode === "keyboard" ? "#FFFFFF" : colors.text },
              ]}
            >
              Nhập bàn phím
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 60 }}
      >
        {/* INPUT: BÀN PHÍM HOẶC VIẾT TAY (Chỉ hiện khi ở chế độ tra cứu tự do) */}
        {!isLessonPracticeMode &&
          (inputMode === "keyboard" ? (
            <View style={styles.searchSection}>
              <View style={styles.searchBarRow}>
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
                    placeholder="Nhập 1 chữ bất kỳ (vd: 月, 陳, 美, 李...)"
                    placeholderTextColor={colors.textMuted}
                    value={searchQuery}
                    onChangeText={(text) => {
                      setSearchQuery(text);
                      setHideKeyboardSuggestions(false);
                    }}
                    onSubmitEditing={() => performSearch(searchQuery)}
                    autoCorrect={false}
                    autoCapitalize="none"
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity
                      onPress={() => {
                        setSearchQuery("");
                        setHideKeyboardSuggestions(false);
                      }}
                    >
                      <MaterialIcons name="clear" size={20} color={colors.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>
                <TouchableOpacity
                  style={[styles.btnSearch, { backgroundColor: colors.indigo }]}
                  onPress={() => performSearch(searchQuery)}
                >
                  <Text style={styles.btnSearchText}>Tra cứu</Text>
                </TouchableOpacity>
              </View>

              {/* LIVE KEYBOARD SUGGESTIONS */}
              {!hideKeyboardSuggestions && liveKeyboardSuggestions.length > 0 && (
                <View
                  style={[
                    styles.keyboardSuggestionsContainer,
                    {
                      backgroundColor: isDark ? "#131C2E" : "#F0F7FF",
                      borderColor: isDark ? "#334155" : "#BFDBFE",
                    },
                  ]}
                >
                  <View style={styles.keyboardSuggestionsHeader}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
                      <Ionicons name="sparkles" size={15} color={colors.amber} />
                      <Text style={[styles.keyboardSuggestionsTitle, { color: colors.indigo }]}>
                        Từ vựng liên quan đến "{searchQuery}" ({liveKeyboardSuggestions.length} từ khớp):
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setHideKeyboardSuggestions(true)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <MaterialIcons name="close" size={18} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.keyboardSuggestionsList}>
                    {liveKeyboardSuggestions.map((item, idx) => (
                      <TouchableOpacity
                        key={`${item.word}-${idx}`}
                        style={[
                          styles.keyboardSuggestionItem,
                          {
                            backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
                            borderColor: isDark ? "#334155" : "#E2E8F0",
                          },
                        ]}
                        onPress={() => {
                          setSearchQuery(item.word);
                          setHideKeyboardSuggestions(true);
                          performSearch(item.word);
                        }}
                      >
                        <View style={styles.keyboardSuggestionLeft}>
                          <Text style={[styles.keyboardSuggestionWord, { color: colors.indigo }]}>
                            {item.word}
                          </Text>
                          {!hidePinyin && item.pinyin ? (
                            <View style={styles.pinyinBadgeSmall}>
                              <Text style={[styles.keyboardSuggestionPinyin, { color: colors.amber }]}>
                                {item.pinyin}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                        <Text
                          style={[styles.keyboardSuggestionMeaning, { color: colors.text }]}
                          numberOfLines={1}
                        >
                          {item.meaning}
                        </Text>
                        <View style={styles.matchTypeBadge}>
                          <Text style={styles.matchTypeText}>{item.matchType}</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </View>
          ) : (
            /* INPUT: VIẾT TAY 3 Ô NHẬN DIỆN */
            <View style={styles.handwritingSection}>
              <HandwritingCanvas
                onSelectCharacter={handleSelectHandwrittenChar}
                vocabList={allWords}
              />
            </View>
          ))}

        {/* KẾT QUẢ TRA CỨU & KHU VỰC LUYỆN VIẾT */}
        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={colors.indigo} />
            <Text style={[styles.loadingText, { color: colors.textMuted }]}>
              Đang tra cứu kho từ điển Hán tự...
            </Text>
          </View>
        ) : selectedKanji ? (
          <View
            style={[
              styles.resultCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            {/* 1. Header Thông tin Từ Vựng */}
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <View style={styles.titleRow}>
                  <Text style={[styles.mainWordText, { color: colors.indigo }]}>
                    {selectedKanji.character}
                  </Text>
                  <View
                    style={[
                      styles.levelBadge,
                      { backgroundColor: isDark ? "#1E293B" : "#EEF2F6" },
                    ]}
                  >
                    <Text style={[styles.levelText, { color: colors.indigo }]}>
                      {selectedKanji.level || "TOCFL A1"}
                    </Text>
                  </View>
                </View>

                {/* Âm Hán Việt & Pinyin */}
                <View style={styles.readingRow}>
                  {!hidePinyin && selectedKanji.pinyin ? (
                    <Text style={[styles.pinyinHeader, { color: colors.amber }]}>
                      [{selectedKanji.pinyin}]
                    </Text>
                  ) : null}
                  {selectedKanji.vietnamese_reading ? (
                    <Text style={[styles.hanvietHeader, { color: colors.textMuted }]}>
                      {!hidePinyin && selectedKanji.pinyin ? "• " : ""}Hán Việt: <Text style={{ color: colors.text, fontWeight: "700" }}>{selectedKanji.vietnamese_reading}</Text>
                    </Text>
                  ) : null}
                </View>

                {/* Nghĩa tiếng Việt */}
                <Text style={[styles.meaningText, { color: colors.text }]}>
                  👉 {selectedKanji.meaning}
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.audioBtn, { backgroundColor: isDark ? "#1E293B" : "#EFF6FF" }]}
                onPress={() => playPronunciation(selectedKanji.character)}
              >
                <MaterialIcons name="volume-up" size={26} color={colors.indigo} />
              </TouchableOpacity>
            </View>

            {/* 2. Khối Luyện viết theo nét mờ trực quan (Hiển thị cùng lúc TẤT CẢ các ô theo chiều ngang & tự động xuống dòng) */}
            <View style={[styles.practiceWrap, { borderColor: colors.border }]}>
              <View style={styles.practiceHeader}>
                <MaterialIcons name="border-color" size={16} color={colors.indigo} />
                <Text style={[styles.practiceTitle, { color: colors.text }]}>
                  Luyện viết ({selectedKanji.characters?.length || 1} ô chữ):
                </Text>
              </View>

              <View style={styles.multiPracticeGrid}>
                {(selectedKanji.characters && selectedKanji.characters.length > 0
                  ? selectedKanji.characters
                  : [selectedKanji.character]
                ).map((ch, idx) => {
                  const charInfo = SINO_VIETNAMESE_DICT[ch];
                  const displayPinyin =
                    charInfo?.pinyin ||
                    (selectedKanji.characters?.length === 1 ? selectedKanji.pinyin : "");
                  const displayHanviet =
                    charInfo?.hanviet ||
                    (selectedKanji.characters?.length === 1
                      ? selectedKanji.vietnamese_reading
                      : ch);

                  const totalChars = selectedKanji.characters?.length || 1;
                  const canvasSize =
                    totalChars === 1
                      ? (Platform.OS === "web" ? 165 : 155)
                      : totalChars === 2
                      ? (Platform.OS === "web" ? 135 : 128)
                      : (Platform.OS === "web" ? 122 : 116);

                  return (
                    <View
                      key={`${ch}-${idx}`}
                      style={[
                        styles.singlePracticeCard,
                        {
                          backgroundColor: isDark ? "#131C2E" : "#FFFFFF",
                          borderColor: isDark ? "#334155" : "#E2E8F0",
                          minWidth: totalChars === 1 ? "100%" : totalChars === 2 ? 138 : 120,
                          maxWidth: totalChars === 1 ? 260 : totalChars === 2 ? 170 : 155,
                          flex: totalChars === 1 ? 0 : 1,
                        },
                      ]}
                    >
                      <View style={styles.charBadgeRow}>
                        <View
                          style={[styles.charNumberBadge, { backgroundColor: colors.indigo }]}
                        >
                          <Text style={styles.charNumberText}>{idx + 1}</Text>
                        </View>
                        <Text style={[styles.charBadgeTitle, { color: colors.indigo }]}>
                          Chữ {ch} {displayHanviet ? `(${displayHanviet})` : ""}
                        </Text>
                      </View>

                      <StrokeOrderPractice
                        character={ch}
                        charIndex={idx}
                        pinyin={displayPinyin}
                        vietnameseReading={displayHanviet}
                        size={canvasSize}
                      />
                    </View>
                  );
                })}
              </View>
            </View>

            {/* 3. Câu ví dụ mẫu Song ngữ (Trung - Pinyin - Việt) */}
            {selectedKanji.examples && selectedKanji.examples.length > 0 && (
              <View style={[styles.sectionBlock, { borderTopColor: colors.border }]}>
                <View style={styles.sectionHeaderRow}>
                  <Ionicons name="chatbubbles-outline" size={18} color={colors.indigo} />
                  <Text style={[styles.sectionHeading, { color: colors.text }]}>
                    Câu ví dụ mẫu song ngữ:
                  </Text>
                </View>

                {selectedKanji.examples.map((ex, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.sentenceItem,
                      { backgroundColor: isDark ? "#162032" : "#F8FAFC", borderColor: colors.border },
                    ]}
                  >
                    <TouchableOpacity
                      style={styles.speakerMini}
                      onPress={() => playPronunciation(ex.cn)}
                    >
                      <MaterialIcons name="volume-up" size={18} color={colors.indigo} />
                    </TouchableOpacity>

                    <View style={{ flex: 1 }}>
                      <Text style={[styles.sentenceCn, { color: colors.text }]}>
                        {ex.cn}
                      </Text>
                      {!hidePinyin && ex.pinyin ? (
                        <Text style={[styles.sentencePinyin, { color: colors.indigo }]}>
                          {ex.pinyin}
                        </Text>
                      ) : null}
                      <Text style={[styles.sentenceVn, { color: colors.textMuted }]}>
                        {ex.vn}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* 4. Từ vựng / Từ ghép có chứa chữ này */}
            <View style={[styles.sectionBlock, { borderTopColor: colors.border }]}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="albums-outline" size={18} color={colors.amber} />
                <Text style={[styles.sectionHeading, { color: colors.text }]}>
                  Từ vựng & Từ ghép có chứa chữ này ({selectedKanji.example_words?.length || 0} từ):
                </Text>
              </View>

              {selectedKanji.example_words && selectedKanji.example_words.length > 0 ? (
                <View style={styles.compoundGrid}>
                  {selectedKanji.example_words.map((ex, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={[
                        styles.compoundCard,
                        { backgroundColor: isDark ? "#1E293B" : "#FFFFFF", borderColor: colors.border },
                      ]}
                      onPress={() => performSearch(ex.word)}
                    >
                      <View style={styles.compoundCardHeader}>
                        <Text style={[styles.compoundWord, { color: colors.indigo }]}>
                          {ex.word}
                        </Text>
                        <TouchableOpacity
                          onPress={(e) => {
                            e.stopPropagation();
                            playPronunciation(ex.word);
                          }}
                        >
                          <MaterialIcons name="volume-up" size={16} color={colors.indigo} />
                        </TouchableOpacity>
                      </View>

                      {!hidePinyin && ex.reading ? (
                        <Text style={[styles.compoundPinyin, { color: colors.amber }]}>
                          [{ex.reading}]
                        </Text>
                      ) : null}

                      <Text
                        style={[styles.compoundMeaning, { color: colors.textMuted }]}
                        numberOfLines={2}
                      >
                        {ex.meaning}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <Text style={{ color: colors.textMuted, fontSize: 13, fontStyle: "italic", marginTop: 4 }}>
                  Chưa có từ ghép mẫu trong kho.
                </Text>
              )}
            </View>
          </View>
        ) : (
          <View style={styles.centerBox}>
            <MaterialIcons name="draw" size={54} color={colors.textMuted} />
            <Text style={[styles.emptyHint, { color: colors.textMuted }]}>
              {searchQuery
                ? `Không tìm thấy "${searchQuery}" trong từ điển. Hãy thử vẽ nét hoặc nhập từ khác nhé!`
                : "Vẽ chữ Hán vào 3 ô trên hoặc nhập từ khóa để tra cứu toàn diện và luyện viết nét!"}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  modeTabsRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 12,
  },
  modeTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  modeTabText: {
    fontSize: 13,
    fontWeight: "700",
  },
  searchSection: {
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  searchBarRow: {
    flexDirection: "row",
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
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    height: "100%",
  },
  btnSearch: {
    paddingHorizontal: 18,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    height: 48,
  },
  btnSearchText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  keyboardSuggestionsContainer: {
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  keyboardSuggestionsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  keyboardSuggestionsTitle: {
    fontSize: 13,
    fontWeight: "800",
  },
  keyboardSuggestionsList: {
    gap: 6,
  },
  keyboardSuggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  keyboardSuggestionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  keyboardSuggestionWord: {
    fontSize: 16,
    fontWeight: "800",
  },
  pinyinBadgeSmall: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: "rgba(245, 158, 11, 0.12)",
  },
  keyboardSuggestionPinyin: {
    fontSize: 11,
    fontWeight: "700",
  },
  keyboardSuggestionMeaning: {
    flex: 1,
    fontSize: 13,
    fontWeight: "500",
  },
  matchTypeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: "rgba(99, 102, 241, 0.12)",
  },
  matchTypeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#4F46E5",
  },
  handwritingSection: {
    paddingHorizontal: 12,
  },
  centerBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: "600",
  },
  emptyHint: {
    marginTop: 14,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  resultCard: {
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 8,
    gap: 8,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  mainWordText: {
    fontSize: 22,
    fontWeight: "900",
  },
  levelBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  levelText: {
    fontSize: 10,
    fontWeight: "800",
  },
  readingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
    flexWrap: "wrap",
  },
  pinyinHeader: {
    fontSize: 14,
    fontWeight: "700",
  },
  hanvietHeader: {
    fontSize: 12,
  },
  meaningText: {
    fontSize: 14,
    fontWeight: "700",
    marginTop: 4,
    lineHeight: 18,
  },
  audioBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  practiceWrap: {
    borderTopWidth: 1,
    paddingTop: 10,
    marginTop: 6,
  },
  practiceHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 6,
  },
  practiceTitle: {
    fontSize: 13,
    fontWeight: "800",
  },
  multiPracticeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "flex-start",
    gap: 6,
    marginTop: 4,
    width: "100%",
  },
  singlePracticeCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 6,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    marginBottom: 4,
  },
  charBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 2,
  },
  charNumberBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  charNumberText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },
  charBadgeTitle: {
    fontSize: 12,
    fontWeight: "800",
  },
  sectionBlock: {
    borderTopWidth: 1,
    paddingTop: 12,
    marginTop: 12,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: "800",
  },
  sentenceItem: {
    flexDirection: "row",
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 6,
    gap: 8,
  },
  speakerMini: {
    paddingTop: 2,
  },
  sentenceCn: {
    fontSize: 15,
    fontWeight: "700",
  },
  sentencePinyin: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  sentenceVn: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  compoundGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  compoundCard: {
    width: "48%",
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  compoundCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  compoundWord: {
    fontSize: 15,
    fontWeight: "800",
  },
  compoundPinyin: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
  compoundMeaning: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  lessonBanner: {
    marginHorizontal: 12,
    marginTop: 6,
    marginBottom: 4,
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 8,
  },
  lessonBannerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  lessonBannerTitle: {
    fontSize: 12,
    fontWeight: "800",
  },
  lessonNavControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  btnNavStep: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    elevation: 1,
  },
  lessonNavIndicator: {
    fontSize: 11,
    fontWeight: "800",
  },
  lessonChipsScroll: {
    flexDirection: "row",
    gap: 4,
    paddingVertical: 2,
  },
  lessonChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  lessonChipText: {
    fontSize: 11,
  },
});
