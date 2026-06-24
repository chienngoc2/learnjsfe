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
} from "react-native";
import { useRouter, Stack, useLocalSearchParams } from "expo-router";
import { Feather, Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Speech from "expo-speech";
import api from "../../services/api";
import { useTheme } from "@/src/context/ThemeContext";
import { useCultivationStore } from "../../store/useCultivationStore";
import { parseWord } from "../../src/utils/wordParser";

const { width, height } = Dimensions.get("window");

interface WordDetail {
  word: string;
  reading: string;
  meaning: string;
}

interface Question {
  questionWord: WordDetail;
  options: string[];
  correctAnswer: string;
}

const getQuestionFontSize = (text: string) => {
  if (!text) return 36;
  const len = text.length;
  if (len > 50) return 18;
  if (len > 30) return 22;
  if (len > 15) return 28;
  return 36;
};

export default function PracticeQuizScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const params = useLocalSearchParams<{ topicId?: string; listId?: string; mode?: string }>();
  
  // Cultivation store rewards
  const { addTuVi, addXP } = useCultivationStore();

  // Settings phase state
  const [isPlaying, setIsPlaying] = useState(false);
  const [vocabLists, setVocabLists] = useState<any[]>([]);
  const [allGrammarPoints, setAllGrammarPoints] = useState<any[]>([]);
  const [selectedListIds, setSelectedListIds] = useState<string[]>([]);
  const [questionCount, setQuestionCount] = useState<number | "all">(10);
  const [loadingLists, setLoadingLists] = useState(true);
  const [quizMode, setQuizMode] = useState<"vocab" | "grammar">("vocab");
  const PAGE_SIZE = 10;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Active quiz phase state
  const [quizWords, setQuizWords] = useState<WordDetail[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  
  // Results
  const [score, setScore] = useState(0);
  const [isFinished, setIsFinished] = useState(false);

  useEffect(() => {
    if (params.mode === "grammar") {
      setQuizMode("grammar");
    } else {
      setQuizMode("vocab");
    }
  }, [params.mode]);

  useEffect(() => {
    setLoadingLists(true);
    
    const fetchLists = api.get("/api/vocab/lists");
    const fetchGrammars = api.get("/api/vocab/all-grammar-points").catch(() => ({ data: { success: false, data: [] } }));

    Promise.all([fetchLists, fetchGrammars])
      .then(([listsRes, grammarsRes]) => {
        if (listsRes.data.success && listsRes.data.data) {
          const data = listsRes.data.data;
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
        if (grammarsRes.data.success && grammarsRes.data.data) {
          setAllGrammarPoints(grammarsRes.data.data);
        }
        setLoadingLists(false);
        setVisibleCount(PAGE_SIZE);
      })
      .catch((err) => {
        console.error("Lỗi lấy danh sách:", err);
        setLoadingLists(false);
      });
  }, [params.topicId, params.listId]);

  const generateGrammarQuestions = (selectedDecks: any[]) => {
    const deckIds = selectedDecks.map((d) => d._id.toString());
    const filteredGrammar = allGrammarPoints.filter((g) => 
      g.topicId && deckIds.includes(g.topicId.toString())
    );

    if (filteredGrammar.length === 0) {
      alert("Các bài học được chọn chưa có cấu trúc ngữ pháp nào bạn nhé!");
      return null;
    }

    const allMeanings = allGrammarPoints.map((g) => g.meaning).filter(Boolean);
    const allFormulas = allGrammarPoints.map((g) => g.formula).filter(Boolean);

    const shuffledGrammar = [...filteredGrammar].sort(() => Math.random() - 0.5);
    const limit = questionCount === "all" ? shuffledGrammar.length : (typeof questionCount === "number" ? questionCount : 10);
    const finalGrammar = shuffledGrammar.slice(0, limit);

    const generatedQuestions: Question[] = [];

    finalGrammar.forEach((g) => {
      const possibleTypes = ["meaning"];
      if (g.formula) possibleTypes.push("formula");
      
      const parsedExamples: { jp: string; vn: string }[] = [];
      if (g.examples && g.examples.length > 0) {
        g.examples.forEach((ex: any) => {
          let jp = "", vn = "";
          if (typeof ex === "string") {
            const parts = ex.split(":");
            jp = parts[0]?.trim() || "";
            vn = parts.slice(1).join(":")?.trim() || "";
          } else if (ex && typeof ex === "object") {
            jp = ex.jp || "";
            vn = ex.vn || "";
          }
          if (jp && vn) parsedExamples.push({ jp, vn });
        });
      }

      if (parsedExamples.length > 0) {
        possibleTypes.push("translation");
      }

      const chosenType = possibleTypes[Math.floor(Math.random() * possibleTypes.length)];

      if (chosenType === "meaning") {
        const wrongMeanings = allMeanings.filter((m) => m !== g.meaning);
        const uniqueWrong = Array.from(new Set(wrongMeanings)).sort(() => Math.random() - 0.5);
        const distractors = uniqueWrong.slice(0, 3);
        while (distractors.length < 3) distractors.push("Ăn", "Uống", "Học tập");
        const options = [g.meaning, ...distractors].sort(() => Math.random() - 0.5);

        generatedQuestions.push({
          questionWord: {
            word: `Ý nghĩa của cấu trúc ngữ pháp "${g.title}" là gì?`,
            reading: "CHỌN Ý NGHĨA PHÙ HỢP",
            meaning: g.meaning,
          },
          options,
          correctAnswer: g.meaning,
        });
      } else if (chosenType === "formula") {
        const wrongFormulas = allFormulas.filter((f) => f !== g.formula);
        const uniqueWrong = Array.from(new Set(wrongFormulas)).sort(() => Math.random() - 0.5);
        const distractors = uniqueWrong.slice(0, 3);
        while (distractors.length < 3) distractors.push("N + に", "V + る", "A + い");
        const options = [g.formula, ...distractors].sort(() => Math.random() - 0.5);

        generatedQuestions.push({
          questionWord: {
            word: `Công thức áp dụng của cấu trúc "${g.title}" là gì?`,
            reading: "CHỌN CÔNG THỨC ĐÚNG",
            meaning: g.formula,
          },
          options,
          correctAnswer: g.formula,
        });
      } else {
        const randomEx = parsedExamples[Math.floor(Math.random() * parsedExamples.length)];
        const otherVns = allGrammarPoints
          .flatMap((gp) =>
            (gp.examples || []).map((ex: any) => {
              if (typeof ex === "string") return ex.split(":")[1]?.trim() || "";
              return ex.vn || "";
            })
          )
          .filter((vn) => vn && vn !== randomEx.vn);

        const uniqueWrong = Array.from(new Set(otherVns)).sort(() => Math.random() - 0.5);
        const distractors = uniqueWrong.slice(0, 3);
        while (distractors.length < 3) distractors.push("Tôi đi học.", "Hôm nay trời đẹp.", "Xin chào.");
        const options = [randomEx.vn, ...distractors].sort(() => Math.random() - 0.5);

        generatedQuestions.push({
          questionWord: {
            word: `Chọn bản dịch đúng cho câu:\n"${randomEx.jp}"`,
            reading: `CẤU TRÚC: ${g.title}`,
            meaning: randomEx.vn,
          },
          options,
          correctAnswer: randomEx.vn,
        });
      }
    });

    return generatedQuestions;
  };

  // Auto start quiz if listId or topicId param exists
  useEffect(() => {
    const targetId = params.topicId || params.listId;
    if (targetId && vocabLists.length > 0 && selectedListIds.length > 0 && !isPlaying) {
      const matched = vocabLists.find((l: any) => l._id.toString() === targetId.toString());
      if (matched && selectedListIds.includes(matched._id)) {
        if (params.mode === "grammar") {
          if (allGrammarPoints.length > 0) {
            const quizQuestions = generateGrammarQuestions([matched]);
            if (quizQuestions && quizQuestions.length > 0) {
              setQuestions(quizQuestions);
              setCurrentIdx(0);
              setScore(0);
              setIsAnswered(false);
              setSelectedAnswer(null);
              setIsFinished(false);
              setIsPlaying(true);
            }
          }
        } else {
          // Collect all words
          const allWords: WordDetail[] = [];
          if (matched.words && matched.words.length > 0) {
            matched.words.forEach((w: any) => {
              const parsed = parseWord(w.term, w.def);
              allWords.push({
                word: parsed.word,
                reading: parsed.reading || parsed.word,
                meaning: parsed.meaning,
              });
            });
          }
          
          if (allWords.length > 0) {
            const shuffledWords = [...allWords].sort(() => Math.random() - 0.5);
            const limit = questionCount === "all" ? shuffledWords.length : (typeof questionCount === "number" ? questionCount : 10);
            const finalWords = shuffledWords.slice(0, limit);
            
            const quizQuestions: Question[] = finalWords.map((word) => {
              const correctAns = word.meaning;
              const otherMeanings = allWords.filter((w) => w.meaning !== correctAns).map((w) => w.meaning);
              const uniqueWrong = Array.from(new Set(otherMeanings));
              const shuffledWrong = uniqueWrong.sort(() => Math.random() - 0.5);
              const fallbackOptions = ["Ăn", "Uống", "Trường học", "Nhà"];
              const finalWrongOptions = shuffledWrong.length >= 3 
                ? shuffledWrong.slice(0, 3) 
                : [...shuffledWrong, ...fallbackOptions].slice(0, 3);
              const options = [correctAns, ...finalWrongOptions].sort(() => Math.random() - 0.5);
              return { questionWord: word, options, correctAnswer: correctAns };
            });
            
            setQuizWords(finalWords);
            setQuestions(quizQuestions);
            setCurrentIdx(0);
            setScore(0);
            setIsAnswered(false);
            setSelectedAnswer(null);
            setIsFinished(false);
            setIsPlaying(true);
          }
        }
      }
    }
  }, [vocabLists, selectedListIds, params.topicId, params.listId, params.mode, allGrammarPoints]);

  const handleToggleList = (id: string) => {
    setSelectedListIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleStartQuiz = () => {
    if (selectedListIds.length === 0) return;

    // Collect all words from selected lists
    const selectedDecks = vocabLists.filter((list) =>
      selectedListIds.includes(list._id)
    );

    if (quizMode === "grammar") {
      const quizQuestions = generateGrammarQuestions(selectedDecks);
      if (quizQuestions && quizQuestions.length > 0) {
        setQuestions(quizQuestions);
        setCurrentIdx(0);
        setScore(0);
        setIsAnswered(false);
        setSelectedAnswer(null);
        setIsFinished(false);
        setIsPlaying(true);
      }
      return;
    }

    const allWords: WordDetail[] = [];
    selectedDecks.forEach((deck) => {
      if (deck.words && deck.words.length > 0) {
        deck.words.forEach((w: any) => {
          const parsed = parseWord(w.term, w.def);
          allWords.push({
            word: parsed.word,
            reading: parsed.reading || parsed.word,
            meaning: parsed.meaning,
          });
        });
      }
    });

    if (allWords.length === 0) {
      alert("Bài học được chọn chưa có từ vựng nào bạn nhé!");
      return;
    }

    // Shuffle and slice according to count settings
    const shuffledWords = [...allWords].sort(() => Math.random() - 0.5);
    const finalWords = questionCount === "all" 
      ? shuffledWords 
      : shuffledWords.slice(0, questionCount);

    // Prepare questions with 4 multiple choice options
    const quizQuestions: Question[] = finalWords.map((word) => {
      const correctAns = word.meaning;
      const otherMeanings = allWords
        .filter((w) => w.meaning !== correctAns)
        .map((w) => w.meaning);
        
      const uniqueWrong = Array.from(new Set(otherMeanings));
      const shuffledWrong = uniqueWrong.sort(() => Math.random() - 0.5);
      
      const fallbackOptions = ["Ăn", "Uống", "Trường học", "Nhà"];
      const finalWrongOptions = shuffledWrong.length >= 3 
        ? shuffledWrong.slice(0, 3) 
        : [...shuffledWrong, ...fallbackOptions].slice(0, 3);

      const options = [correctAns, ...finalWrongOptions].sort(
        () => Math.random() - 0.5
      );

      return {
        questionWord: word,
        options,
        correctAnswer: correctAns,
      };
    });

    setQuizWords(finalWords);
    setQuestions(quizQuestions);
    setCurrentIdx(0);
    setScore(0);
    setIsAnswered(false);
    setSelectedAnswer(null);
    setIsFinished(false);
    setIsPlaying(true);
  };

  const handleAnswerSelect = (option: string) => {
    if (isAnswered) return;
    
    setSelectedAnswer(option);
    setIsAnswered(true);

    const currentQuestion = questions[currentIdx];
    const isCorrect = option === currentQuestion.correctAnswer;

    if (isCorrect) {
      setScore((prev) => prev + 1);
    }

    // TTS pronunciation of the Japanese word
    speak(currentQuestion.questionWord.word);

    // Wait 1.5 seconds and move to next or finish
    setTimeout(() => {
      if (currentIdx < questions.length - 1) {
        setCurrentIdx((prev) => prev + 1);
        setIsAnswered(false);
        setSelectedAnswer(null);
      } else {
        // Calculate and reward Tu Vi
        const finalScore = isCorrect ? score + 1 : score;
        const rewardTuViAmount = finalScore * 10;
        const rewardXPAmount = finalScore * 5;
        if (rewardTuViAmount > 0) {
          addTuVi(rewardTuViAmount);
          addXP(rewardXPAmount);
        }
        setIsFinished(true);
      }
    }, 1500);
  };

  const speak = (text: string) => {
    Speech.speak(text, { language: "ja-JP", rate: 0.85 });
  };

  const bgColors: readonly [string, string, ...string[]] = isDark 
    ? ["#050814", "#0a0e1c"] 
    : ["#f5edd6", "#fcf8ed"];

  if (loadingLists) {
    return (
      <View style={[styles.center, { backgroundColor: bgColors[0] }]}>
        <ActivityIndicator size="large" color={colors.indigo} />
      </View>
    );
  }

  // 1. SETTINGS / CONFIG PHASE RENDER
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
                  transform: [{ scale: pressed ? 0.95 : 1 }]
                },
              ]}
            >
              <Feather name="chevron-left" size={20} color={colors.text} />
            </Pressable>
            <View style={styles.headerTitleWrap}>
              <Text style={[styles.headerTitle, { color: colors.text }]}>Trắc Nghiệm Ghi Nhớ</Text>
              <Text style={[styles.headerSub, { color: colors.textMuted }]}>CẤU HÌNH THỬ THÁCH</Text>
            </View>
            <View style={{ width: 42 }} />
          </View>

          <ScrollView
            style={{ flex: 1, paddingHorizontal: 20 }}
            contentContainerStyle={{ paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Choose Lessons Section */}
            <View style={styles.sectionContainer}>
              <Text style={[styles.sectionHeading, { color: colors.indigo }]}>1. CHỌN BÀI LUYỆN TẬP</Text>
              {vocabLists.length === 0 ? (
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                  Chưa có bài học nào. Bạn cần tạo bài trước nha!
                </Text>
              ) : (
                <View style={styles.listGrid}>
                  {vocabLists.slice(0, visibleCount).map((list) => {
                    const isSelected = selectedListIds.includes(list._id);
                    return (
                      <Pressable
                        key={list._id}
                        onPress={() => handleToggleList(list._id)}
                        style={({ pressed }) => [
                          styles.listCardItem,
                          {
                            backgroundColor: isSelected ? colors.indigoLight : colors.surface,
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
                                isSelected && { color: colors.indigo },
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
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.loadMoreText, { color: colors.indigo }]}>
                        Xem thêm ({vocabLists.length - visibleCount} bài học còn lại)
                      </Text>
                      <Feather name="chevron-down" size={20} color={colors.indigo} />
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>

            {/* Question Count Section */}
            <View style={[styles.sectionContainer, { marginTop: 24 }]}>
              <Text style={[styles.sectionHeading, { color: colors.indigo }]}>2. SỐ LƯỢNG CÂU HỎI</Text>
              <View style={styles.chipsRow}>
                {([5, 10, 15, 20, "all"] as const).map((count) => {
                  const isSelected = questionCount === count;
                  return (
                    <Pressable
                      key={count}
                      onPress={() => setQuestionCount(count)}
                      style={({ pressed }) => [
                        styles.chipBtn,
                        {
                          backgroundColor: isSelected ? colors.indigo : colors.surface,
                          borderColor: isSelected ? colors.indigo : colors.border,
                          transform: [{ scale: pressed ? 0.95 : 1 }],
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          { color: isSelected ? "#050814" : colors.text },
                        ]}
                      >
                        {count === "all" ? "Tất Cả" : `${count} Từ`}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Start Button */}
            <Pressable
              onPress={handleStartQuiz}
              disabled={selectedListIds.length === 0}
              style={({ pressed }) => [
                styles.btnStart,
                {
                  backgroundColor: colors.indigo,
                  opacity: selectedListIds.length === 0 ? 0.5 : 1,
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                },
              ]}
            >
              <Text style={styles.btnStartText}>BẮT ĐẦU LUYỆN TẬP</Text>
            </Pressable>
          </ScrollView>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  // 2. ACTIVE QUIZ PLAYING PHASE
  if (isPlaying && !isFinished) {
    const currentQuestion = questions[currentIdx];
    const progressPercent = ((currentIdx + 1) / questions.length) * 100;

    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: bgColors[0] }]}>
        <LinearGradient colors={bgColors} style={styles.container}>
          <Stack.Screen options={{ headerShown: false }} />

          {/* Header */}
          <View style={styles.header}>
            <Pressable
              onPress={() => setIsPlaying(false)}
              style={({ pressed }) => [
                styles.btnIconHeader,
                { 
                  backgroundColor: colors.surface, 
                  borderColor: colors.border,
                  transform: [{ scale: pressed ? 0.95 : 1 }]
                },
              ]}
            >
              <Feather name="x" size={20} color={colors.text} />
            </Pressable>
            <View style={styles.headerTitleWrap}>
              <Text style={[styles.headerTitle, { color: colors.text }]}>Trắc Nghiệm Ghi Nhớ</Text>
              <Text style={[styles.headerSub, { color: colors.textMuted }]}>
                {String(currentIdx + 1).padStart(2, "0")} <Text style={{ color: colors.textMuted }}>/</Text> {String(questions.length).padStart(2, "0")}
              </Text>
            </View>
            <Pressable
              style={({ pressed }) => [
                styles.btnIconHeader,
                { 
                  backgroundColor: colors.surface, 
                  borderColor: colors.border,
                  transform: [{ scale: pressed ? 0.95 : 1 }]
                },
              ]}
              onPress={() => speak(currentQuestion.questionWord.word)}
            >
              <Feather name="volume-2" size={20} color={colors.indigo} />
            </Pressable>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressSection}>
            <View
              style={[
                styles.progressBarBg,
                { backgroundColor: isDark ? "#1E293B" : "#E2E8F0" },
              ]}
            >
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${progressPercent}%`, backgroundColor: colors.indigo },
                ]}
              />
            </View>
          </View>

          <View style={{ flex: 1, paddingHorizontal: 20, justifyContent: "center" }}>
            {/* Question Card */}
            <View
              style={[
                styles.questionCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: isDark ? "rgba(245, 199, 107, 0.2)" : "rgba(176, 130, 46, 0.25)",
                },
              ]}
            >
              <Text style={[styles.questionReading, { color: colors.textMuted }]}>
                {currentQuestion.questionWord.reading}
              </Text>
              <Text style={[styles.questionWordText, { color: colors.indigo, fontSize: getQuestionFontSize(currentQuestion.questionWord.word) }]}>
                {currentQuestion.questionWord.word}
              </Text>
            </View>

            {/* Answer Options Box */}
            <View style={styles.optionsContainer}>
              {currentQuestion.options.map((option, idx) => {
                const isSelected = selectedAnswer === option;
                const isCorrectAnswer = option === currentQuestion.correctAnswer;
                
                let optionBgColor = colors.surface;
                let optionBorderColor = colors.border;
                let optionTextColor = colors.text;

                if (isAnswered) {
                  if (isCorrectAnswer) {
                    optionBgColor = "#10b981"; // Highlight correct green
                    optionBorderColor = "#10b981";
                    optionTextColor = "#FFFFFF";
                  } else if (isSelected) {
                    optionBgColor = "#ef4444"; // Highlight wrong red
                    optionBorderColor = "#ef4444";
                    optionTextColor = "#FFFFFF";
                  } else {
                    optionBgColor = colors.surface;
                    optionBorderColor = colors.border;
                    optionTextColor = colors.textMuted;
                  }
                }

                return (
                  <Pressable
                    key={idx}
                    onPress={() => handleAnswerSelect(option)}
                    disabled={isAnswered}
                    style={({ pressed }) => [
                      styles.optionButton,
                      {
                        backgroundColor: optionBgColor,
                        borderColor: optionBorderColor,
                        transform: [{ scale: pressed && !isAnswered ? 0.98 : 1 }],
                      },
                    ]}
                  >
                    <Text style={[styles.optionText, { color: optionTextColor }]}>
                      {option}
                    </Text>
                    {isAnswered && isCorrectAnswer && (
                      <Feather name="check" size={18} color="#FFFFFF" />
                    )}
                    {isAnswered && isSelected && !isCorrectAnswer && (
                      <Feather name="x" size={18} color="#FFFFFF" />
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

  // 3. RESULTS DISPLAY
  if (isFinished) {
    const accuracy = Math.round((score / questions.length) * 100);
    const rewardTuViGained = score * 10;

    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: bgColors[0] }]}>
        <LinearGradient colors={bgColors} style={styles.container}>
          <Stack.Screen options={{ headerShown: false }} />

          <View style={[styles.center, { paddingHorizontal: 24 }]}>
            {/* Success Emblem Banner */}
            <View style={[styles.emblemIconCircle, { backgroundColor: colors.indigoLight }]}>
              <Ionicons name="trophy-outline" size={50} color={colors.indigo} />
            </View>

            <Text style={[styles.resultTitle, { color: colors.text }]}>BÀI TẬP HOÀN THÀNH</Text>
            <Text style={[styles.resultSubtitle, { color: colors.textMuted }]}>
              Thử thách trắc nghiệm đã được chinh phục!
            </Text>

            {/* Score Bento Box */}
            <View style={[styles.resultBentoBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.resultBentoItem}>
                <Text style={[styles.bentoBLabel, { color: colors.textMuted }]}>KẾT QUẢ</Text>
                <Text style={[styles.bentoBVal, { color: colors.indigo }]}>
                  {score} <Text style={{ fontSize: 16, color: colors.textMuted }}>/</Text> {questions.length}
                </Text>
              </View>

              <View style={[styles.resultBentoDivider, { backgroundColor: colors.border }]} />

              <View style={styles.resultBentoItem}>
                <Text style={[styles.bentoBLabel, { color: colors.textMuted }]}>CHÍNH XÁC</Text>
                <Text style={[styles.bentoBVal, { color: colors.indigo }]}>{accuracy}%</Text>
              </View>
            </View>

            {/* Rewards Card */}
            {rewardTuViGained > 0 ? (
              <View style={[styles.rewardCard, { backgroundColor: colors.surface, borderColor: colors.indigo }]}>
                <Ionicons name="sparkles" size={18} color={colors.indigo} style={{ marginRight: 8 }} />
                <Text style={[styles.rewardCardText, { color: colors.text }]}>
                  Gặt hái thành công: <Text style={{ color: colors.indigo, fontWeight: "900" }}>+{rewardTuViGained}</Text> XP và +{score * 5} kinh nghiệm!
                </Text>
              </View>
            ) : null}

            {/* Action Buttons */}
            <View style={styles.resultActions}>
              <Pressable
                onPress={handleStartQuiz}
                style={({ pressed }) => [
                  styles.btnResultAction,
                  {
                    backgroundColor: colors.indigo,
                    transform: [{ scale: pressed ? 0.98 : 1 }],
                  },
                ]}
              >
                <Text style={[styles.btnResultText, { color: "#050814" }]}>THỬ THÁCH LẠI</Text>
              </Pressable>

              <Pressable
                onPress={() => setIsPlaying(false)}
                style={({ pressed }) => [
                  styles.btnResultActionSecondary,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    transform: [{ scale: pressed ? 0.98 : 1 }],
                  },
                ]}
              >
                <Text style={[styles.btnResultTextSecondary, { color: colors.text }]}>VỀ TRANG CHỦ</Text>
              </Pressable>
            </View>
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 15,
  },
  btnIconHeader: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  headerTitleWrap: { flex: 1, alignItems: "center", paddingHorizontal: 10 },
  headerTitle: { fontSize: 16, fontWeight: "800", letterSpacing: 0.5 },
  headerSub: {
    fontSize: 10,
    fontWeight: "800",
    marginTop: 2,
    letterSpacing: 1.5,
  },
  progressSection: { paddingHorizontal: 20, paddingBottom: 15 },
  progressBarBg: {
    height: 4,
    width: "100%",
    borderRadius: 10,
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 10,
  },

  // Setup Phase
  sectionContainer: { marginTop: 16 },
  sectionHeading: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
  },
  listGrid: {
    gap: 8,
  },
  listCardItem: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
  },
  listCardLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  listCardTitle: {
    fontSize: 15,
    fontWeight: "800",
  },
  listCardCount: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chipBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "700",
  },
  btnStart: {
    marginTop: 36,
    borderRadius: 16,
    paddingVertical: 16,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  btnStartText: {
    color: "#050814",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 1,
  },

  // Quiz active phase
  questionCard: {
    borderRadius: 24,
    borderWidth: 1.5,
    padding: Platform.OS === 'web' ? 24 : 18,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
    minHeight: Platform.OS === 'web' ? 160 : 130,
    marginBottom: Platform.OS === 'web' ? 24 : 16,
  },
  questionReading: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 2,
    marginBottom: 10,
  },
  questionWordText: {
    fontSize: 38,
    fontWeight: "900",
    textAlign: "center",
  },
  optionsContainer: {
    gap: 12,
  },
  optionButton: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 56,
  },
  optionText: {
    fontSize: 15,
    fontWeight: "700",
    flex: 1,
    marginRight: 10,
  },

  // Results Screen
  emblemIconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  resultTitle: {
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 1.5,
    textAlign: "center",
  },
  resultSubtitle: {
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 6,
    marginBottom: 30,
  },
  resultBentoBox: {
    flexDirection: "row",
    borderRadius: 24,
    borderWidth: 1,
    paddingVertical: 20,
    paddingHorizontal: 24,
    width: "100%",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  resultBentoItem: {
    flex: 1,
    alignItems: "center",
  },
  bentoBLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  bentoBVal: {
    fontSize: 26,
    fontWeight: "900",
    marginTop: 4,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  resultBentoDivider: {
    width: 1,
    height: 40,
  },
  rewardCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    width: "100%",
    marginBottom: 36,
  },
  rewardCardText: {
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
  resultActions: {
    width: "100%",
    gap: 12,
  },
  btnResultAction: {
    borderRadius: 16,
    paddingVertical: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  btnResultActionSecondary: {
    borderRadius: 16,
    paddingVertical: 16,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  btnResultText: {
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  btnResultTextSecondary: {
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  loadMoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 10,
    gap: 8,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.02,
        shadowRadius: 4,
      },
      android: { elevation: 1 },
    }),
  },
  loadMoreText: {
    fontSize: 14,
    fontWeight: "700",
  },
});
