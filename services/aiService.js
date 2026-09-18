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

export default {
  sendChatMessage,
  transcribeAudio,
  evaluatePronunciation,
  getDailySuggestion,
  generateGrammarQuiz,
};
