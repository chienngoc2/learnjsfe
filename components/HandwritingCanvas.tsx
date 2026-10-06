import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  ScrollView,
} from "react-native";
import { WebView } from "react-native-webview";
import { MaterialIcons, Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/src/context/ThemeContext";
import { usePinyin } from "@/src/context/PinyinContext";
import masterData from "@/assets/data/vocab_master.json";

interface HandwritingCanvasProps {
  onSelectCharacter: (char: string) => void;
  width?: number;
  height?: number;
  vocabList?: Array<{ word: string; pinyin?: string; meaning: string; level?: string }>;
}

const masterWords: Array<{ word: string; pinyin?: string; meaning: string; level?: string }> =
  (masterData as any).words || [];

export default function HandwritingCanvas({
  onSelectCharacter,
  width = 270,
  height = 185,
  vocabList,
}: HandwritingCanvasProps) {
  const { colors, isDark } = useTheme();
  const { hidePinyin } = usePinyin();

  const wordsPool = useMemo(() => {
    return vocabList && vocabList.length > 0 ? vocabList : masterWords;
  }, [vocabList]);

  // Multi-box states (ô viết tay co giãn linh hoạt)
  const [activeBox, setActiveBox] = useState<number>(0);
  const [boxChars, setBoxChars] = useState<string[]>(["", "", ""]);
  const [boxCandidates, setBoxCandidates] = useState<string[][]>([[], [], []]);
  const [recognizing, setRecognizing] = useState(false);
  const [currentStrokes, setCurrentStrokes] = useState<number[][][]>([]);
  const [hideSuggestions, setHideSuggestions] = useState<boolean>(false);

  const webViewRef = useRef<any>(null);

  // HTML + JS Canvas capturing stroke ink coordinates
  const canvasHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <style>
        * { box-sizing: border-box; touch-action: none; -webkit-user-select: none; user-select: none; }
        body {
          margin: 0; padding: 0; display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          background-color: ${isDark ? "#1E293B" : "#F8FAFC"};
          height: 100vh; overflow: hidden; font-family: sans-serif;
        }
        #canvas-wrap {
          position: relative;
          width: ${width}px;
          height: ${height}px;
          background: ${isDark ? "#0F172A" : "#FFFFFF"};
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          border: 2px dashed ${isDark ? "#334155" : "#CBD5E1"};
        }
        canvas {
          position: absolute;
          top: 0; left: 0;
          width: 100%; height: 100%;
          border-radius: 12px;
          cursor: crosshair;
        }
        /* Ô vuông chữ Điền / Mễ trợ lực căn chữ */
        .grid-line {
          position: absolute;
          pointer-events: none;
        }
        .grid-v {
          top: 0; bottom: 0; left: 50%;
          border-left: 1px dashed ${isDark ? "#1E293B" : "#E2E8F0"};
        }
        .grid-h {
          left: 0; right: 0; top: 50%;
          border-top: 1px dashed ${isDark ? "#1E293B" : "#E2E8F0"};
        }
        .grid-d1 {
          top: 0; left: 0; width: 100%; height: 100%;
          background: linear-gradient(to top right, transparent calc(50% - 0.5px), ${isDark ? "#162032" : "#F1F5F9"} 50%, transparent calc(50% + 0.5px));
        }
        .grid-d2 {
          top: 0; left: 0; width: 100%; height: 100%;
          background: linear-gradient(to bottom right, transparent calc(50% - 0.5px), ${isDark ? "#162032" : "#F1F5F9"} 50%, transparent calc(50% + 0.5px));
        }
      </style>
    </head>
    <body>
      <div id="canvas-wrap">
        <div class="grid-line grid-d1"></div>
        <div class="grid-line grid-d2"></div>
        <div class="grid-line grid-v"></div>
        <div class="grid-line grid-h"></div>
        <canvas id="paintCanvas" width="${width}" height="${height}"></canvas>
      </div>

      <script>
        const canvas = document.getElementById('paintCanvas');
        const ctx = canvas.getContext('2d');
        ctx.strokeStyle = '${isDark ? "#38BDF8" : "#0284C7"}';
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        let isDrawing = false;
        let strokes = []; // ink format: [ [ [x...], [y...], [t...] ], ... ]
        let currentStroke = [[], [], []];
        let startTime = Date.now();

        function getPos(e) {
          const rect = canvas.getBoundingClientRect();
          const clientX = e.touches ? e.touches[0].clientX : e.clientX;
          const clientY = e.touches ? e.touches[0].clientY : e.clientY;
          return {
            x: Math.round(clientX - rect.left),
            y: Math.round(clientY - rect.top),
            t: Date.now() - startTime
          };
        }

        function startDraw(e) {
          e.preventDefault();
          isDrawing = true;
          const p = getPos(e);
          currentStroke = [[p.x], [p.y], [p.t]];
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
        }

        function draw(e) {
          if (!isDrawing) return;
          e.preventDefault();
          const p = getPos(e);
          currentStroke[0].push(p.x);
          currentStroke[1].push(p.y);
          currentStroke[2].push(p.t);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
        }

        function endDraw(e) {
          if (!isDrawing) return;
          isDrawing = false;
          if (currentStroke[0].length > 0) {
            strokes.push(currentStroke);
            sendStrokesToNative();
          }
        }

        canvas.addEventListener('mousedown', startDraw);
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseup', endDraw);
        canvas.addEventListener('mouseleave', endDraw);

        canvas.addEventListener('touchstart', startDraw, { passive: false });
        canvas.addEventListener('touchmove', draw, { passive: false });
        canvas.addEventListener('touchend', endDraw, { passive: false });

        function sendStrokesToNative() {
          const message = JSON.stringify({ type: 'STROKES_UPDATED', strokes: strokes });
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(message);
          } else if (window.parent) {
            window.parent.postMessage(message, '*');
          }
        }

        window.clearCanvas = function() {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          strokes = [];
          currentStroke = [[], [], []];
          startTime = Date.now();
          sendStrokesToNative();
        };

        window.undoStroke = function() {
          if (strokes.length === 0) return;
          strokes.pop();
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          strokes.forEach(stroke => {
            const xs = stroke[0];
            const ys = stroke[1];
            if (xs.length > 0) {
              ctx.beginPath();
              ctx.moveTo(xs[0], ys[0]);
              for (let i = 1; i < xs.length; i++) {
                ctx.lineTo(xs[i], ys[i]);
              }
              ctx.stroke();
            }
          });
          sendStrokesToNative();
        };

        window.addEventListener('message', function(event) {
          try {
            const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
            if (data.action === 'CLEAR') window.clearCanvas();
            if (data.action === 'UNDO') window.undoStroke();
          } catch(err) {}
        });
      </script>
    </body>
    </html>
  `;

  // Call Google Input Tools Handwriting Recognition API
  const recognizeStrokes = async (ink: number[][][], boxIdx: number) => {
    if (!ink || ink.length === 0) {
      setBoxCandidates((prev) => {
        const next = [...prev];
        next[boxIdx] = [];
        return next;
      });
      return;
    }

    setRecognizing(true);
    try {
      const payload = {
        app_version: 0.4,
        api_level: "537.36",
        device: "5.0 (Windows NT 10.0; Win64; x64)",
        input_type: "0",
        options: "enable_pre_space",
        requests: [
          {
            writing_guide: {
              writing_area_width: width,
              writing_area_height: height,
            },
            pre_context: "",
            max_num_results: 10,
            max_completions: 0,
            language: "zh_TW", // Phồn Thể Đài Loan
            ink: ink,
          },
        ],
      };

      const res = await fetch(
        "https://inputtools.google.com/request?itc=zh-t-i0-handwrit&app=translate",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const data = await res.json();
      if (data && data[0] === "SUCCESS" && data[1] && data[1][0] && data[1][0][1]) {
        const rawChars: string[] = data[1][0][1];
        // Lọc bỏ ký tự rác hoặc dấu chấm câu không hợp lệ
        const foundChars = rawChars
          .map((c) => c.trim())
          .filter(
            (c) =>
              /[\u4e00-\u9fff\u3400-\u4dbf]/.test(c) &&
              !/[.,/#!$%^&*;:{}=\-_`~()?]/.test(c)
          );

        setBoxCandidates((prev) => {
          const next = [...prev];
          next[boxIdx] = foundChars;
          return next;
        });

        // Tự động gán ứng viên đầu tiên vào ô nếu ô đang trống
        setBoxChars((prev) => {
          if (!prev[boxIdx] && foundChars.length > 0) {
            const nextChars = [...prev];
            nextChars[boxIdx] = foundChars[0];
            return nextChars;
          }
          return prev;
        });
      }
    } catch (err) {
      console.warn("Handwriting recognition error:", err);
    } finally {
      setRecognizing(false);
    }
  };

  const handleMessage = (event: any) => {
    try {
      const raw = event.nativeEvent ? event.nativeEvent.data : event.data;
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (parsed.type === "STROKES_UPDATED") {
        setHideSuggestions(false);
        setCurrentStrokes(parsed.strokes || []);
        recognizeStrokes(parsed.strokes, activeBox);
      }
    } catch (e) {
      console.warn("Error parsing canvas message", e);
    }
  };

  // Lắng nghe sự kiện postMessage trên Web
  useEffect(() => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const onWebMessage = (e: MessageEvent) => {
        handleMessage(e);
      };
      window.addEventListener("message", onWebMessage);
      return () => {
        window.removeEventListener("message", onWebMessage);
      };
    }
  }, [activeBox]);

  const clearCurrentCanvasInk = () => {
    if (Platform.OS === "web") {
      const iframe = document.getElementById("handwriting-iframe") as HTMLIFrameElement;
      if (iframe?.contentWindow) {
        iframe.contentWindow.postMessage(JSON.stringify({ action: "CLEAR" }), "*");
      }
    } else {
      webViewRef.current?.postMessage(JSON.stringify({ action: "CLEAR" }));
    }
  };

  const clearCurrentCanvas = () => {
    setBoxCandidates((prev) => {
      const next = [...prev];
      next[activeBox] = [];
      return next;
    });
    setBoxChars((prev) => {
      const next = [...prev];
      next[activeBox] = "";
      return next;
    });
    setCurrentStrokes([]);
    setHideSuggestions(false);
    clearCurrentCanvasInk();
  };

  const clearAllBoxes = () => {
    setBoxChars((prev) => new Array(Math.max(prev.length, 2)).fill(""));
    setBoxCandidates((prev) => new Array(Math.max(prev.length, 2)).fill([]));
    setCurrentStrokes([]);
    setActiveBox(0);
    setHideSuggestions(false);
    clearCurrentCanvasInk();
  };

  const addBox = () => {
    setBoxChars((prev) => [...prev, ""]);
    setBoxCandidates((prev) => [...prev, []]);
    setActiveBox(boxChars.length);
    setCurrentStrokes([]);
    setHideSuggestions(false);
    clearCurrentCanvasInk();
  };

  const undoStroke = () => {
    if (Platform.OS === "web") {
      const iframe = document.getElementById("handwriting-iframe") as HTMLIFrameElement;
      if (iframe?.contentWindow) {
        iframe.contentWindow.postMessage(JSON.stringify({ action: "UNDO" }), "*");
      }
    } else {
      webViewRef.current?.postMessage(JSON.stringify({ action: "UNDO" }));
    }
  };

  const handleSelectCandidate = (char: string) => {
    // Nếu ứng viên là cụm từ (vd: "田中誠一" hoặc "陳月美")
    if (char.length > 1) {
      const chars = char.split("").filter((c) => /[\u4e00-\u9fff\u3400-\u4dbf]/.test(c));
      const newBoxChars = chars.length > 0 ? chars : [char];
      setBoxChars(newBoxChars);
      setBoxCandidates(new Array(newBoxChars.length).fill([]));
      setHideSuggestions(true);
      onSelectCharacter(char);
      return;
    }

    // Nếu là 1 chữ đơn
    setHideSuggestions(false);
    setBoxChars((prev) => {
      const next = [...prev];
      next[activeBox] = char;
      return next;
    });

    // Nếu chưa ở ô cuối, tự động chuyển sang ô kế tiếp
    if (activeBox < boxChars.length - 1) {
      setTimeout(() => {
        handleChangeActiveBox(activeBox + 1);
      }, 200);
    }
  };

  const handleChangeActiveBox = (newIdx: number) => {
    setActiveBox(newIdx);
    setHideSuggestions(false);
    setCurrentStrokes([]);
    clearCurrentCanvasInk();
  };

  // 🌟 TÌM TẤT CẢ CÁC TỪ TRONG KHO CHỨA BẤT KỲ CHỮ NÀO ĐÃ NHẬP Ở BẤT CỨ Ô NÀO
  const matchedVocabSuggestions = useMemo(() => {
    const activeCandidates = (boxCandidates[activeBox] || []).filter((c) =>
      /[\u4e00-\u9fff\u3400-\u4dbf]/.test(c)
    );

    // Thu thập tất cả các chữ Hán đã viết ở mọi ô hoặc top gợi ý nhận diện
    const directChars = boxChars.filter((c) => /[\u4e00-\u9fff\u3400-\u4dbf]/.test(c));
    const candidateChars = activeCandidates.slice(0, 6).flatMap((c) =>
      c.split("").filter((ch) => /[\u4e00-\u9fff\u3400-\u4dbf]/.test(ch))
    );

    const searchChars = Array.from(new Set([...directChars, ...candidateChars]));
    const assembled = boxChars.filter(Boolean).join("");

    if (searchChars.length === 0 && !assembled) return [];

    const matched: Array<{
      word: string;
      pinyin: string;
      meaning: string;
      matchedChar: string;
      isExactPrefix: boolean;
    }> = [];
    const seen = new Set<string>();

    wordsPool.forEach((w) => {
      const isExactPrefix = assembled.length > 0 && w.word.startsWith(assembled);
      const matchedChar = searchChars.find((ch) => w.word.includes(ch)) || "";

      if ((isExactPrefix || matchedChar) && !seen.has(w.word)) {
        seen.add(w.word);
        matched.push({
          word: w.word,
          pinyin: w.pinyin || "",
          meaning: w.meaning || "",
          matchedChar: isExactPrefix ? assembled : matchedChar,
          isExactPrefix,
        });
      }
    });

    // Sắp xếp: Ưu tiên khớp tổ hợp trước, sau đó sắp xếp theo độ dài từ
    matched.sort((a, b) => {
      if (a.isExactPrefix && !b.isExactPrefix) return -1;
      if (!a.isExactPrefix && b.isExactPrefix) return 1;
      return a.word.length - b.word.length;
    });

    return matched.slice(0, 24);
  }, [boxChars, boxCandidates, activeBox, wordsPool]);

  const handleSelectVocabSuggestion = (item: { word: string; pinyin: string; meaning: string }) => {
    const chars = item.word.split("").filter((c) => /[\u4e00-\u9fff\u3400-\u4dbf]/.test(c));
    const newBoxChars = chars.length > 0 ? chars : [item.word];
    setBoxChars(newBoxChars);
    setBoxCandidates(new Array(newBoxChars.length).fill([]));
    setHideSuggestions(true);
    onSelectCharacter(item.word);
  };

  const assembledWord = boxChars.filter(Boolean).join("");
  const activeCandidates = boxCandidates[activeBox] || [];

  return (
    <View style={styles.container}>
      {/* 1. THANH TỔ HỢP TỪ GHÉP 3 Ô TRỰC QUAN (Viết ở bất kỳ ô nào) */}
      <View
        style={[
          styles.assemblyBar,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <View style={styles.boxesRow}>
          {boxChars.map((char, idx) => {
            const isActive = activeBox === idx;
            return (
              <TouchableOpacity
                key={idx}
                style={[
                  styles.boxChip,
                  {
                    backgroundColor: isActive
                      ? isDark ? "#1E3A8A" : "#DBEAFE"
                      : isDark ? "#1E293B" : "#F1F5F9",
                    borderColor: isActive ? colors.indigo : colors.border,
                  },
                ]}
                onPress={() => handleChangeActiveBox(idx)}
              >
                <Text
                  style={[
                    styles.boxChipIndex,
                    { color: isActive ? colors.indigo : colors.textMuted },
                  ]}
                >
                  Ô {idx + 1}
                </Text>
                <Text
                  style={[
                    styles.boxChipChar,
                    { color: char ? (isActive ? colors.indigo : colors.text) : colors.textMuted },
                  ]}
                >
                  {char || "+"}
                </Text>
              </TouchableOpacity>
            );
          })}

          {/* Nút + Thêm ô vẽ linh hoạt */}
          <TouchableOpacity
            style={[
              styles.btnAddBox,
              {
                backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
                borderColor: colors.indigo,
              },
            ]}
            onPress={addBox}
          >
            <MaterialIcons name="add-circle-outline" size={20} color={colors.indigo} />
            <Text style={[styles.btnAddBoxText, { color: colors.indigo }]}>+ Thêm ô</Text>
          </TouchableOpacity>
        </View>

        {/* Nút tra cứu tổng hợp */}
        <TouchableOpacity
          style={[
            styles.btnSearchAssembled,
            {
              backgroundColor: assembledWord ? colors.indigo : isDark ? "#334155" : "#E2E8F0",
            },
          ]}
          onPress={() => {
            if (assembledWord) {
              setHideSuggestions(true);
              onSelectCharacter(assembledWord);
            }
          }}
          disabled={!assembledWord}
        >
          <MaterialIcons
            name="search"
            size={20}
            color={assembledWord ? "#FFFFFF" : colors.textMuted}
          />
          <Text
            style={[
              styles.btnSearchAssembledText,
              { color: assembledWord ? "#FFFFFF" : colors.textMuted },
            ]}
          >
            {assembledWord ? `Tra cứu: "${assembledWord}"` : "Vẽ từ để tra"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 2. CHỈ DẪN Ô ĐANG VẼ */}
      <View style={styles.activeBoxIndicator}>
        <Text style={[styles.activeBoxText, { color: colors.indigo }]}>
          ✏️ Đang vẽ cho <Text style={{ fontWeight: "900" }}>Ô SỐ {activeBox + 1}</Text> (bạn có thể bấm chọn vẽ ô bất kỳ ở trên)
        </Text>
      </View>

      {/* 3. KHUNG VẼ CANVAS */}
      <View style={[styles.canvasBox, { width, height, borderColor: colors.border }]}>
        {Platform.OS === "web" ? (
          <iframe
            id="handwriting-iframe"
            srcDoc={canvasHtml}
            style={{
              width: "100%",
              height: "100%",
              border: "none",
              borderRadius: 12,
              backgroundColor: "transparent",
            }}
          />
        ) : (
          <WebView
            ref={webViewRef}
            originWhitelist={["*"]}
            source={{ html: canvasHtml }}
            style={{ backgroundColor: "transparent" }}
            onMessage={handleMessage}
            scrollEnabled={false}
          />
        )}
      </View>

      {/* 4. THANH ĐIỀU KHIỂN NÉT VẼ */}
      <View style={styles.controlsRow}>
        <TouchableOpacity
          style={[styles.btnAction, { backgroundColor: isDark ? "#334155" : "#E2E8F0" }]}
          onPress={undoStroke}
        >
          <MaterialIcons name="undo" size={16} color={colors.text} />
          <Text style={[styles.btnActionText, { color: colors.text }]}>Lùi nét</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btnAction, { backgroundColor: isDark ? "#334155" : "#E2E8F0" }]}
          onPress={clearCurrentCanvas}
        >
          <MaterialIcons name="clear" size={16} color="#EF4444" />
          <Text style={[styles.btnActionText, { color: "#EF4444" }]}>Xóa ô này</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btnAction, { backgroundColor: isDark ? "#334155" : "#E2E8F0" }]}
          onPress={clearAllBoxes}
        >
          <MaterialIcons name="delete-sweep" size={16} color="#EF4444" />
          <Text style={[styles.btnActionText, { color: "#EF4444" }]}>
            Xóa cả {boxChars.length} ô
          </Text>
        </TouchableOpacity>

        {recognizing && (
          <View style={styles.recognizingBadge}>
            <ActivityIndicator size="small" color={colors.indigo} />
            <Text style={[styles.recognizingText, { color: colors.indigo }]}>Nhận diện...</Text>
          </View>
        )}
      </View>

      {/* 5. GỢI Ý CHỮ HÁN NHẬN DIỆN CHO Ô ĐANG VẼ */}
      {activeCandidates.length > 0 && (
        <View style={styles.candidatesWrapper}>
          <Text style={[styles.candidatesTitle, { color: colors.textMuted }]}>
            👉 Chạm chữ nhận diện cho Ô {activeBox + 1}:
          </Text>
          <View style={styles.candidatesList}>
            {activeCandidates.map((char, idx) => {
              const isSelected = boxChars[activeBox] === char;
              const isMultiChar = char.length > 1;
              return (
                <TouchableOpacity
                  key={`${char}-${idx}`}
                  style={[
                    styles.candidateBtn,
                    {
                      width: isMultiChar ? "auto" : 44,
                      paddingHorizontal: isMultiChar ? 10 : 0,
                      backgroundColor: isSelected
                        ? isDark ? "#1E3A8A" : "#DBEAFE"
                        : isDark ? "#1E293B" : "#F1F5F9",
                      borderColor: isSelected ? colors.indigo : colors.border,
                      transform: [{ scale: isSelected ? 1.05 : 1 }],
                    },
                  ]}
                  onPress={() => handleSelectCandidate(char)}
                >
                  <Text
                    style={[
                      styles.candidateChar,
                      { color: isSelected ? colors.indigo : colors.text },
                    ]}
                  >
                    {char}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* 6. 🌟 TỰ ĐỘNG HIỆN CÁC TỪ TRONG KHO CHỨA CHỮ NÀY (VD: 陳月美, 李明華, ...) */}
      {!hideSuggestions && matchedVocabSuggestions.length > 0 && (
        <View
          style={[
            styles.suggestionsWrapper,
            {
              borderColor: colors.indigo,
              backgroundColor: isDark ? "#131C2E" : "#F0F7FF",
            },
          ]}
        >
          <View style={styles.suggestionsHeader}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
              <Ionicons name="sparkles" size={16} color={colors.amber} />
              <Text style={[styles.suggestionsTitle, { color: colors.indigo }]}>
                Từ vựng liên quan trong từ điển ({matchedVocabSuggestions.length} từ):
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setHideSuggestions(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MaterialIcons name="close" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.suggestionsSub, { color: colors.textMuted }]}>
            👉 Chạm vào bất kỳ từ nào để tự động điền & xem chi tiết phân tích:
          </Text>

          <View style={styles.suggestionsGrid}>
            {matchedVocabSuggestions.map((item, idx) => (
              <TouchableOpacity
                key={`${item.word}-${idx}`}
                style={[
                  styles.suggestionCard,
                  {
                    backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
                    borderColor: isDark ? "#334155" : "#BFDBFE",
                  },
                ]}
                onPress={() => handleSelectVocabSuggestion(item)}
              >
                <View style={styles.suggestionWordRow}>
                  <Text style={[styles.suggestionWord, { color: colors.indigo }]}>
                    {item.word}
                  </Text>
                  {!hidePinyin && item.pinyin ? (
                    <View style={styles.pinyinBadge}>
                      <Text style={[styles.suggestionPinyin, { color: colors.amber }]}>
                        {item.pinyin}
                      </Text>
                    </View>
                  ) : null}
                  {item.matchedChar ? (
                    <View style={styles.matchedTag}>
                      <Text style={styles.matchedTagText}>
                        {item.isExactPrefix ? "Khớp cụm" : `Chứa "${item.matchedChar}"`}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text
                  style={[styles.suggestionMeaning, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {item.meaning}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    marginVertical: 4,
    width: "100%",
  },
  assemblyBar: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 12,
    borderWidth: 1,
    padding: 8,
    marginBottom: 6,
  },
  boxesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 6,
    justifyContent: "flex-start",
  },
  boxChip: {
    minWidth: 46,
    flexGrow: 1,
    maxWidth: 75,
    height: 48,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  btnAddBox: {
    minWidth: 46,
    height: 48,
    borderRadius: 8,
    borderWidth: 1.5,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    gap: 1,
  },
  btnAddBoxText: {
    fontSize: 9,
    fontWeight: "700",
  },
  boxChipIndex: {
    fontSize: 9,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  boxChipChar: {
    fontSize: 18,
    fontWeight: "900",
    marginTop: 1,
  },
  btnSearchAssembled: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 7,
    borderRadius: 8,
    gap: 4,
  },
  btnSearchAssembledText: {
    fontSize: 12,
    fontWeight: "800",
  },
  activeBoxIndicator: {
    marginBottom: 4,
  },
  activeBoxText: {
    fontSize: 11,
    fontWeight: "600",
  },
  canvasBox: {
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    maxWidth: 320,
    marginTop: 6,
    gap: 4,
    flexWrap: "wrap",
  },
  btnAction: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 3,
  },
  btnActionText: {
    fontSize: 11,
    fontWeight: "600",
  },
  recognizingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginLeft: 4,
  },
  recognizingText: {
    fontSize: 11,
    fontWeight: "600",
  },
  candidatesWrapper: {
    width: "100%",
    maxWidth: 360,
    marginTop: 6,
  },
  candidatesTitle: {
    fontSize: 11,
    marginBottom: 4,
    textAlign: "center",
  },
  candidatesList: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 4,
  },
  candidateBtn: {
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  candidateChar: {
    fontSize: 16,
    fontWeight: "700",
  },
  suggestionsWrapper: {
    width: "100%",
    maxWidth: 360,
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    padding: 8,
  },
  suggestionsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 6,
  },
  suggestionsTitle: {
    fontSize: 12,
    fontWeight: "800",
  },
  suggestionsSub: {
    fontSize: 10,
    marginBottom: 6,
  },
  suggestionsGrid: {
    gap: 6,
  },
  suggestionCard: {
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  suggestionWordRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
    flexWrap: "wrap",
  },
  suggestionWord: {
    fontSize: 15,
    fontWeight: "800",
  },
  pinyinBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: "rgba(245, 158, 11, 0.12)",
  },
  suggestionPinyin: {
    fontSize: 11,
    fontWeight: "700",
  },
  matchedTag: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: "rgba(99, 102, 241, 0.12)",
    marginLeft: "auto",
  },
  matchedTagText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#4F46E5",
  },
  suggestionMeaning: {
    fontSize: 11,
    fontWeight: "500",
  },
});
