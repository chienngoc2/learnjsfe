import React, { useState, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from "react-native";
import { WebView } from "react-native-webview";
import { MaterialIcons } from "@expo/vector-icons";
import { useTheme } from "@/src/context/ThemeContext";

interface HandwritingCanvasProps {
  onSelectCharacter: (char: string) => void;
  width?: number;
  height?: number;
}

export default function HandwritingCanvas({
  onSelectCharacter,
  width = 300,
  height = 260,
}: HandwritingCanvasProps) {
  const { colors, isDark } = useTheme();
  const [candidates, setCandidates] = useState<string[]>([]);
  const [recognizing, setRecognizing] = useState(false);
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
  const recognizeStrokes = async (ink: number[][][]) => {
    if (!ink || ink.length === 0) {
      setCandidates([]);
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
        const foundChars: string[] = data[1][0][1];
        setCandidates(foundChars);
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
        recognizeStrokes(parsed.strokes);
      }
    } catch (e) {
      console.warn("Error parsing canvas message", e);
    }
  };

  const clearCanvas = () => {
    setCandidates([]);
    if (Platform.OS === "web") {
      const iframe = document.getElementById("handwriting-iframe") as HTMLIFrameElement;
      if (iframe?.contentWindow) {
        iframe.contentWindow.postMessage(JSON.stringify({ action: "CLEAR" }), "*");
      }
    } else {
      webViewRef.current?.postMessage(JSON.stringify({ action: "CLEAR" }));
    }
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

  return (
    <View style={styles.container}>
      {/* Khung vẽ Canvas */}
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

      {/* Control Buttons */}
      <View style={styles.controlsRow}>
        <TouchableOpacity
          style={[styles.btnAction, { backgroundColor: isDark ? "#334155" : "#E2E8F0" }]}
          onPress={undoStroke}
        >
          <MaterialIcons name="undo" size={18} color={colors.text} />
          <Text style={[styles.btnActionText, { color: colors.text }]}>Lùi 1 nét</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btnAction, { backgroundColor: isDark ? "#334155" : "#E2E8F0" }]}
          onPress={clearCanvas}
        >
          <MaterialIcons name="delete-outline" size={18} color="#EF4444" />
          <Text style={[styles.btnActionText, { color: "#EF4444" }]}>Xóa vẽ lại</Text>
        </TouchableOpacity>

        {recognizing && (
          <View style={styles.recognizingBadge}>
            <ActivityIndicator size="small" color={colors.indigo} />
            <Text style={[styles.recognizingText, { color: colors.indigo }]}>Nhận diện...</Text>
          </View>
        )}
      </View>

      {/* Candidates (Gợi ý chữ Hán Phồn Thể nhận diện được) */}
      <View style={styles.candidatesWrapper}>
        <Text style={[styles.candidatesTitle, { color: colors.textMuted }]}>
          {candidates.length > 0 ? "👉 Chạm vào chữ để tra cứu:" : "✏️ Hãy viết chữ Hán vào ô trên..."}
        </Text>
        <View style={styles.candidatesList}>
          {candidates.map((char, idx) => (
            <TouchableOpacity
              key={`${char}-${idx}`}
              style={[
                styles.candidateBtn,
                {
                  backgroundColor: idx === 0 ? (isDark ? "#1E3A8A" : "#DBEAFE") : (isDark ? "#1E293B" : "#F1F5F9"),
                  borderColor: idx === 0 ? colors.indigo : colors.border,
                },
              ]}
              onPress={() => onSelectCharacter(char)}
            >
              <Text
                style={[
                  styles.candidateChar,
                  { color: idx === 0 ? colors.indigo : colors.text },
                ]}
              >
                {char}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    marginVertical: 10,
    width: "100%",
  },
  canvasBox: {
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    maxWidth: 320,
    marginTop: 10,
    paddingHorizontal: 4,
  },
  btnAction: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 4,
  },
  btnActionText: {
    fontSize: 13,
    fontWeight: "600",
  },
  recognizingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  recognizingText: {
    fontSize: 12,
    fontWeight: "600",
  },
  candidatesWrapper: {
    width: "100%",
    maxWidth: 340,
    marginTop: 12,
  },
  candidatesTitle: {
    fontSize: 13,
    marginBottom: 8,
    textAlign: "center",
  },
  candidatesList: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
  },
  candidateBtn: {
    width: 46,
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  candidateChar: {
    fontSize: 22,
    fontWeight: "700",
  },
});
