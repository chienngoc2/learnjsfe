import React, { useState, useRef, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Platform,
} from "react-native";
import { WebView } from "react-native-webview";
import { MaterialIcons } from "@expo/vector-icons";
import * as Speech from "expo-speech";
import { useTheme } from "@/src/context/ThemeContext";
import { usePinyin } from "@/src/context/PinyinContext";

interface StrokeOrderPracticeProps {
  character: string;
  charIndex?: number;
  pinyin?: string;
  zhuyin?: string;
  vietnameseReading?: string;
  size?: number;
}

export default function StrokeOrderPractice({
  character,
  charIndex = 0,
  pinyin,
  zhuyin,
  vietnameseReading,
  size = 140,
}: StrokeOrderPracticeProps) {
  const { colors, isDark } = useTheme();
  const { hidePinyin } = usePinyin();
  const [practiceMode, setPracticeMode] = useState<"quiz" | "animate">("quiz");
  const [statusMessage, setStatusMessage] = useState<string>("Tô theo nét mờ");
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const webViewRef = useRef<any>(null);

  const strokeColor = isDark ? "#38BDF8" : "#0284C7";
  const ghostColor = isDark ? "rgba(148, 163, 184, 0.28)" : "rgba(100, 116, 139, 0.22)";
  const highlightColor = "#F59E0B";
  const iframeUniqueId = `hanzi-writer-iframe-${character}-${charIndex}`;

  const paddingVal = Math.max(6, Math.round(size * 0.07));
  const drawWidthVal = Math.max(8, Math.round(size * 0.08));

  const hanziHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <script src="https://cdn.jsdelivr.net/npm/hanzi-writer@3.5/dist/hanzi-writer.min.js"></script>
      <style>
        * { box-sizing: border-box; touch-action: none; -webkit-user-select: none; user-select: none; }
        body {
          margin: 0; padding: 0; display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          background-color: transparent; height: 100vh; overflow: hidden;
        }
        #box-container {
          position: relative;
          width: ${size}px;
          height: ${size}px;
          background: ${isDark ? "#0F172A" : "#FFFFFF"};
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
          border: 1.5px solid ${isDark ? "#334155" : "#CBD5E1"};
        }
        .grid-line {
          position: absolute;
          pointer-events: none;
        }
        .grid-v {
          top: 0; bottom: 0; left: 50%;
          border-left: 1px dashed ${isDark ? "#334155" : "#E2E8F0"};
        }
        .grid-h {
          left: 0; right: 0; top: 50%;
          border-top: 1px dashed ${isDark ? "#334155" : "#E2E8F0"};
        }
        .grid-d1 {
          top: 0; left: 0; width: 100%; height: 100%;
          background: linear-gradient(to top right, transparent calc(50% - 0.5px), ${isDark ? "#1E293B" : "#F1F5F9"} 50%, transparent calc(50% + 0.5px));
        }
        .grid-d2 {
          top: 0; left: 0; width: 100%; height: 100%;
          background: linear-gradient(to bottom right, transparent calc(50% - 0.5px), ${isDark ? "#1E293B" : "#F1F5F9"} 50%, transparent calc(50% + 0.5px));
        }
        #target-writer {
          position: absolute;
          top: 0; left: 0;
          width: 100%; height: 100%;
        }
      </style>
    </head>
    <body>
      <div id="box-container">
        <div class="grid-line grid-d1"></div>
        <div class="grid-line grid-d2"></div>
        <div class="grid-line grid-v"></div>
        <div class="grid-line grid-h"></div>
        <div id="target-writer"></div>
      </div>

      <script>
        let writer = null;

        function sendMessage(data) {
          data.char = '${character}';
          data.charIndex = ${charIndex};
          const msg = JSON.stringify(data);
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(msg);
          } else if (window.parent) {
            window.parent.postMessage(msg, '*');
          }
        }

        function initWriter() {
          const container = document.getElementById('target-writer');
          container.innerHTML = '';

          writer = HanziWriter.create('target-writer', '${character || "學"}', {
            width: ${size},
            height: ${size},
            padding: ${paddingVal},
            strokeAnimationSpeed: 1.2,
            delayBetweenStrokes: 150,
            strokeColor: '${strokeColor}',
            outlineColor: '${ghostColor}',
            highlightColor: '${highlightColor}',
            drawingWidth: ${drawWidthVal},
            showOutline: true,
            showCharacter: false,
          });

          startQuiz();
        }

        function startQuiz() {
          if (!writer) return;
          writer.quiz({
            onCorrectStroke: function(strokeData) {
              sendMessage({ type: 'CORRECT_STROKE', strokeNum: strokeData.strokeNum });
            },
            onMistake: function(strokeData) {
              sendMessage({ type: 'MISTAKE', strokeNum: strokeData.strokeNum });
            },
            onComplete: function(summaryData) {
              sendMessage({ type: 'COMPLETE', mistakes: summaryData.totalMistakes });
            }
          });
        }

        function startAnimate() {
          if (!writer) return;
          try {
            writer.cancelQuiz();
          } catch(e) {}
          writer.animateCharacter({
            onComplete: function() {
              sendMessage({ type: 'ANIMATION_DONE' });
            }
          });
        }

        window.addEventListener('message', function(event) {
          try {
            const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
            if (data.targetChar && data.targetChar !== '${character}') return;
            if (data.action === 'ANIMATE') startAnimate();
            if (data.action === 'QUIZ' || data.action === 'RESET') {
              try {
                writer.cancelQuiz();
              } catch(e) {}
              startQuiz();
            }
          } catch(e) {}
        });

        window.onload = initWriter;
      </script>
    </body>
    </html>
  `;

  const handleMessage = (event: any) => {
    try {
      const raw = event.nativeEvent ? event.nativeEvent.data : event.data;
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (parsed.char && parsed.char !== character) return;
      if (parsed.charIndex !== undefined && parsed.charIndex !== charIndex) return;

      if (parsed.type === "CORRECT_STROKE") {
        setStatusMessage(`✨ Nét ${parsed.strokeNum + 1} đúng!`);
      } else if (parsed.type === "MISTAKE") {
        setStatusMessage("⚠️ Sai nét, thử lại!");
      } else if (parsed.type === "COMPLETE") {
        setIsCompleted(true);
        setStatusMessage(`🎉 Xong! (${parsed.mistakes || 0} lỗi)`);
      } else if (parsed.type === "ANIMATION_DONE") {
        setStatusMessage("Thị phạm xong!");
      }
    } catch (e) {
      console.warn("Error in StrokeOrderPractice message:", e);
    }
  };

  // Lắng nghe sự kiện postMessage trên Web từ iframe
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
  }, [character, charIndex]);

  const triggerAnimate = () => {
    setPracticeMode("animate");
    setIsCompleted(false);
    setStatusMessage("Đang thị phạm...");
    if (Platform.OS === "web") {
      const iframe = document.getElementById(iframeUniqueId) as HTMLIFrameElement;
      if (iframe?.contentWindow) {
        iframe.contentWindow.postMessage(JSON.stringify({ action: "ANIMATE", targetChar: character }), "*");
      }
    } else {
      webViewRef.current?.postMessage(JSON.stringify({ action: "ANIMATE", targetChar: character }));
    }
  };

  const triggerQuiz = () => {
    setPracticeMode("quiz");
    setIsCompleted(false);
    setStatusMessage("Tô theo nét mờ");
    if (Platform.OS === "web") {
      const iframe = document.getElementById(iframeUniqueId) as HTMLIFrameElement;
      if (iframe?.contentWindow) {
        iframe.contentWindow.postMessage(JSON.stringify({ action: "RESET", targetChar: character }), "*");
      }
    } else {
      webViewRef.current?.postMessage(JSON.stringify({ action: "RESET", targetChar: character }));
    }
  };

  const playPronunciation = () => {
    if (character) {
      Speech.speak(character, {
        language: "zh-TW",
        pitch: 1.0,
        rate: 0.9,
      });
    }
  };

  const isMini = size < 160;

  return (
    <View style={styles.container}>
      {/* Header Info (Pinyin, Âm Hán Việt) */}
      {((!hidePinyin && pinyin) || vietnameseReading) ? (
        <View style={styles.headerInfo}>
          <View style={styles.charInfoRow}>
            {!hidePinyin && pinyin ? <Text style={[styles.pinyinText, { color: colors.amber }]}>[{pinyin}]</Text> : null}
            {vietnameseReading ? (
              <Text style={[styles.hanvietText, { color: colors.textMuted }]}>
                {!hidePinyin && pinyin ? "• " : ""}<Text style={{ color: colors.text, fontWeight: "700" }}>{vietnameseReading}</Text>
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}

      {/* Canvas Practice Box */}
      <View style={[styles.canvasBox, { width: size, height: size }]}>
        {Platform.OS === "web" ? (
          <iframe
            id={iframeUniqueId}
            key={iframeUniqueId}
            srcDoc={hanziHtml}
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
            key={iframeUniqueId}
            originWhitelist={["*"]}
            source={{ html: hanziHtml }}
            style={{ backgroundColor: "transparent" }}
            onMessage={handleMessage}
            scrollEnabled={false}
          />
        )}
      </View>

      {/* Status Feedback */}
      <View style={[styles.statusBox, { backgroundColor: isCompleted ? (isDark ? "#064E3B" : "#ECFDF5") : (isDark ? "#1E293B" : "#F8FAFC") }]}>
        <Text style={[styles.statusText, { color: isCompleted ? "#10B981" : colors.text }]} numberOfLines={1}>
          {statusMessage}
        </Text>
      </View>

      {/* Controls: Thị phạm / Viết lại / Phát âm */}
      <View style={styles.actionButtonsRow}>
        <TouchableOpacity
          style={[styles.btnAction, { backgroundColor: isDark ? "#1E293B" : "#EFF6FF", borderColor: colors.indigo, borderWidth: 1 }]}
          onPress={playPronunciation}
        >
          <MaterialIcons name="volume-up" size={14} color={colors.indigo} />
          <Text style={[styles.btnActionText, { color: colors.indigo }]}>Đọc</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btnAction, { backgroundColor: isDark ? "#334155" : "#E2E8F0" }]}
          onPress={triggerAnimate}
        >
          <MaterialIcons name="play-arrow" size={14} color={colors.text} />
          <Text style={[styles.btnActionText, { color: colors.text }]}>Nét</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btnAction, { backgroundColor: colors.indigo }]}
          onPress={triggerQuiz}
        >
          <MaterialIcons name="edit" size={13} color="#FFFFFF" />
          <Text style={[styles.btnActionText, { color: "#FFFFFF" }]}>Viết</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    width: "100%",
    marginVertical: 2,
  },
  headerInfo: {
    alignItems: "center",
    marginBottom: 4,
  },
  charInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  pinyinText: {
    fontSize: 13,
    fontWeight: "700",
  },
  hanvietText: {
    fontSize: 12,
  },
  canvasBox: {
    borderRadius: 12,
    overflow: "hidden",
  },
  statusBox: {
    marginTop: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    alignItems: "center",
    maxWidth: 180,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
  },
  actionButtonsRow: {
    flexDirection: "row",
    gap: 4,
    marginTop: 6,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  btnAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 6,
  },
  btnActionText: {
    fontSize: 11,
    fontWeight: "700",
  },
});
