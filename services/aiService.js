import { Platform } from "react-native";
import api from "./api";

/**
 * Gửi tin nhắn chat đến Sensei AI
 */
export const sendChatMessage = async (messages) => {
  const response = await api.post("/api/chat/chat", { messages });
  return response.data;
};

/**
 * Chuyển đổi giọng nói thành văn bản (STT qua Whisper AI)
 */
export const transcribeAudio = async (audioUri, filename = "voice.m4a") => {
  const formData = new FormData();
  formData.append("audio", {
    uri: audioUri,
    type: "audio/m4a",
    name: filename,
  });

  const response = await api.post("/api/chat/transcribe", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data;
};

/**
 * Thẩm định và chấm điểm phát âm Tiếng Trung Phồn Thể bằng AI
 */
export const evaluatePronunciation = async ({
  audioUri,
  targetText,
  pinyin = "",
  meaning = "",
  filename = "pronunciation.m4a",
}) => {
  const formData = new FormData();
  formData.append("audio", {
    uri: audioUri,
    type: "audio/m4a",
    name: filename,
  });
  formData.append("targetText", targetText);
  formData.append("pinyin", pinyin);
  formData.append("meaning", meaning);

  const response = await api.post("/api/chat/evaluate-pronunciation", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data;
};

/**
 * Lấy gợi ý học tập hàng ngày
 */
export const getDailySuggestion = async () => {
  const response = await api.get("/api/chat/daily-suggestion");
  return response.data;
};

/**
 * Tạo câu hỏi trắc nghiệm ngữ pháp tiếng Trung
 */
export const generateGrammarQuiz = async (grammarData) => {
  const response = await api.post("/api/chat/generate-direct-grammar-quiz", grammarData);
  return response.data;
};

/**
 * Trích xuất Script hoàn chỉnh từ file MP3/Audio (100% Free, 0 token, không tốn Groq)
 * Hỗ trợ đa nền tảng: Expo Web, Android, iOS
 */
export const transcribeMp3File = async ({
  uri,
  name = "audio.mp3",
  type = "audio/mpeg",
  language = "chinese",
  file = null,
}) => {
  const isWeb = Platform.OS === "web" || (typeof window !== "undefined" && !!window.document);

  if (isWeb) {
    let fileBlob = file;
    if (!fileBlob && uri && (uri.startsWith("blob:") || uri.startsWith("data:") || uri.startsWith("http"))) {
      try {
        const resp = await fetch(uri);
        fileBlob = await resp.blob();
      } catch (e) {
        console.warn("Không thể fetch blob từ URI:", e);
      }
    }

    if (fileBlob) {
      const formData = new FormData();
      formData.append("file", fileBlob, name || "audio.mp3");
      formData.append("language", language);

      const response = await api.post("/api/audio/transcribe-mp3", formData, {
        headers: {
          "Content-Type": undefined, // Để browser tự thêm boundary multipart chuẩn
        },
        timeout: 180000,
      });
      return response.data;
    }
  }

  // Chế độ Native Mobile (Android / iOS)
  const formData = new FormData();
  formData.append("file", {
    uri,
    type: type || "audio/mpeg",
    name: name || "audio.mp3",
  });
  formData.append("language", language);

  const response = await api.post("/api/audio/transcribe-mp3", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
    timeout: 180000,
  });
  return response.data;
};

/**
 * Lấy danh sách các bài nghe & script đã lưu trong MongoDB
 */
export const fetchSavedAudioLessons = async () => {
  try {
    const response = await api.get("/api/audio/lessons");
    return response.data;
  } catch (err) {
    console.warn("Lỗi fetch bài nghe từ MongoDB:", err);
    return { success: false, data: [] };
  }
};

/**
 * Lưu bài nghe vào MongoDB
 */
export const saveAudioLessonToCloud = async (lessonData) => {
  const response = await api.post("/api/audio/save-lesson", lessonData);
  return response.data;
};

/**
 * Xóa vĩnh viễn bài nghe và file nhị phân khỏi MongoDB
 */
export const deleteAudioLessonFromCloud = async (lessonId) => {
  const response = await api.delete(`/api/audio/lessons/${lessonId}`);
  return response.data;
};

/**
 * Lấy URL đầy đủ để stream âm thanh từ MongoDB GridFS
 */
export const getFullAudioStreamUrl = (streamUrlOrFileId) => {
  if (!streamUrlOrFileId) return "";
  if (
    streamUrlOrFileId.startsWith("http://") ||
    streamUrlOrFileId.startsWith("https://") ||
    streamUrlOrFileId.startsWith("blob:") ||
    streamUrlOrFileId.startsWith("file:")
  ) {
    return streamUrlOrFileId;
  }
  const baseUrl = api.defaults.baseURL || "http://localhost:5000";
  const cleanBase = baseUrl.replace(/\/+$/, "");
  const cleanPath = streamUrlOrFileId.startsWith("/")
    ? streamUrlOrFileId
    : `/api/audio/files/${streamUrlOrFileId}`;
  return `${cleanBase}${cleanPath}`;
};

/**
 * Lấy URL đầy đủ để tải file MP3 nhị phân từ MongoDB về máy
 */
export const getFullAudioDownloadUrl = (downloadUrlOrFileId) => {
  if (!downloadUrlOrFileId) return "";
  if (downloadUrlOrFileId.startsWith("http://") || downloadUrlOrFileId.startsWith("https://")) {
    return downloadUrlOrFileId;
  }
  const baseUrl = api.defaults.baseURL || "http://localhost:5000";
  const cleanBase = baseUrl.replace(/\/+$/, "");
  const cleanPath = downloadUrlOrFileId.startsWith("/")
    ? downloadUrlOrFileId
    : `/api/audio/download/${downloadUrlOrFileId}`;
  return `${cleanBase}${cleanPath}`;
};

export default {
  sendChatMessage,
  transcribeAudio,
  transcribeMp3File,
  evaluatePronunciation,
  getDailySuggestion,
  generateGrammarQuiz,
  fetchSavedAudioLessons,
  saveAudioLessonToCloud,
  deleteAudioLessonFromCloud,
  getFullAudioStreamUrl,
  getFullAudioDownloadUrl,
};

