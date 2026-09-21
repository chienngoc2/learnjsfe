import React, { useState, useRef } from "react";
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

interface StrokeOrderPracticeProps {
  character: string;
  pinyin?: string;
  zhuyin?: string;
  vietnameseReading?: string;
  size?: number;
}

export default function StrokeOrderPractice({
  character,
  pinyin,
  zhuyin,
  vietnameseReading,
  size = 280,
}: StrokeOrderPracticeProps) {
  const { colors, isDark } = useTheme();
  const [practiceMode, setPracticeMode] = useState<"quiz" | "animate">("quiz");
  const [statusMessage, setStatusMessage] = useState<string>("Tô theo nét mờ để tập viết");
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const webViewRef = useRef<any>(null);

  const strokeColor = isDark ? "#38BDF8" : "#0284C7";
  const ghostColor = isDark ? "rgba(148, 163, 184, 0.28)" : "rgba(100, 116, 139, 0.22)";
  const highlightColor = "#F59E0B";

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
          border-radius: 16px;
          box-shadow: 0 4px 14px rgba(0,0,0,0.12);
          border: 2px solid ${isDark ? "#334155" : "#CBD5E1"};
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
            padding: 18,
            strokeAnimationSpeed: 1.2,
            delayBetweenStrokes: 150,
            strokeColor: '${strokeColor}',
            outlineColor: '${ghostColor}',
            highlightColor: '${highlightColor}',
            drawingWidth: 20,
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
          writer.animateCharacter({
            onComplete: function() {
              sendMessage({ type: 'ANIMATION_DONE' });
            }
          });
        }

        window.addEventListener('message', function(event) {
          try {
            const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
            if (data.action === 'ANIMATE') startAnimate();
            if (data.action === 'QUIZ') startQuiz();
            if (data.action === 'RESET') {
              writer.cancelQuiz();
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
      if (parsed.type === "CORRECT_STROKE") {
        setStatusMessage(`✨ Nét ${parsed.strokeNum + 1} chính xác! Tiếp tục nào...`);
      } else if (parsed.type === "MISTAKE") {
        setStatusMessage("⚠️ Sai nét hoặc sai hướng! Hãy thử lại theo nét mờ.");
      } else if (parsed.type === "COMPLETE") {
        setIsCompleted(true);
        setStatusMessage(`🎉 Xuất sắc! Hoàn thành chữ với ${parsed.mistakes || 0} lần sai!`);
      } else if (parsed.type === "ANIMATION_DONE") {
        setStatusMessage("Đã trình diễn xong thứ tự nét! Bấm 'Tự viết' để luyện.");
      }
    } catch (e) {
      console.warn("Error in StrokeOrderPractice message:", e);
    }
  };

  const triggerAnimate = () => {
    setPracticeMode("animate");
    setIsCompleted(false);
    setStatusMessage("Đang thị phạm thứ tự từng nét...");
    if (Platform.OS === "web") {
      const iframe = document.getElementById("hanzi-writer-iframe") as HTMLIFrameElement;
      if (iframe?.contentWindow) {
        iframe.contentWindow.postMessage(JSON.stringify({ action: "ANIMATE" }), "*");
      }
    } else {
      webViewRef.current?.postMessage(JSON.stringify({ action: "ANIMATE" }));
    }
  };

  const triggerQuiz = () => {
    setPracticeMode("quiz");
    setIsCompleted(false);
    setStatusMessage("Tô theo nét mờ để tập viết");
    if (Platform.OS === "web") {
      const iframe = document.getElementById("hanzi-writer-iframe") as HTMLIFrameElement;
      if (iframe?.contentWindow) {
        iframe.contentWindow.postMessage(JSON.stringify({ action: "RESET" }), "*");
      }
    } else {
      webViewRef.current?.postMessage(JSON.stringify({ action: "RESET" }));
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

  return (
    <View style={styles.container}>
      {/* Header Info (Pinyin, Zhuyin, Âm Hán Việt) */}
      <View style={styles.headerInfo}>
        <View style={styles.charInfoRow}>
          {pinyin ? <Text style={[styles.pinyinText, { color: colors.indigo }]}>{pinyin}</Text> : null}
          {zhuyin ? <Text style={[styles.zhuyinText, { color: colors.amber }]}>({zhuyin})</Text> : null}
        </View>
        {vietnameseReading ? (
          <Text style={[styles.hanvietText, { color: colors.textMuted }]}>
            Âm Hán Việt: <Text style={{ color: colors.text, fontWeight: "700" }}>{vietnameseReading}</Text>
          </Text>
        ) : null}
      </View>

      {/* Canvas Practice Box */}
      <View style={[styles.canvasBox, { width: size, height: size }]}>
        {Platform.OS === "web" ? (
          <iframe
            id="hanzi-writer-iframe"
            key={`${character}-${practiceMode}`}
            srcDoc={hanziHtml}
            style={{
              width: "100%",
              height: "100%",
              border: "none",
              borderRadius: 16,
              backgroundColor: "transparent",
            }}
          />
        ) : (
          <WebView
            ref={webViewRef}
            key={`${character}-${practiceMode}`}
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
        <Text style={[styles.statusText, { color: isCompleted ? "#10B981" : colors.text }]}>
          {statusMessage}
        </Text>
      </View>

      {/* Controls: Thị phạm / Viết lại / Phát âm */}
      <View style={styles.actionButtonsRow}>
        <TouchableOpacity
          style={[styles.btnAction, { backgroundColor: isDark ? "#1E293B" : "#EFF6FF", borderColor: colors.indigo, borderWidth: 1 }]}
          onPress={playPronunciation}
        >
          <MaterialIcons name="volume-up" size={18} color={colors.indigo} />
          <Text style={[styles.btnActionText, { color: colors.indigo }]}>Phát âm</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btnAction, { backgroundColor: isDark ? "#334155" : "#E2E8F0" }]}
          onPress={triggerAnimate}
        >
          <MaterialIcons name="play-circle-outline" size={18} color={colors.text} />
          <Text style={[styles.btnActionText, { color: colors.text }]}>Thị phạm nét</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btnAction, { backgroundColor: colors.indigo }]}
          onPress={triggerQuiz}
        >
          <MaterialIcons name="edit" size={18} color="#FFFFFF" />
          <Text style={[styles.btnActionText, { color: "#FFFFFF" }]}>Luyện viết lại</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    width: "100%",
    marginVertical: 8,
  },
  headerInfo: {
    alignItems: "center",
    marginBottom: 10,
    gap: 2,
  },
  charInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pinyinText: {
    fontSize: 20,
    fontWeight: "700",
  },
  zhuyinText: {
    fontSize: 15,
    fontWeight: "600",
  },
  hanvietText: {
    fontSize: 14,
    marginTop: 2,
  },
  canvasBox: {
    borderRadius: 18,
    overflow: "hidden",
  },
  statusBox: {
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: "center",
    maxWidth: 320,
  },
  statusText: {
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  actionButtonsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  btnAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },
  btnActionText: {
    fontSize: 13,
    fontWeight: "700",
  },
});
