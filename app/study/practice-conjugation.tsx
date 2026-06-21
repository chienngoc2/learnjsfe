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

interface VerbDetail {
  word: string;
  reading: string;
  meaning: string;
  te: string;
  ta: string;
  nai: string;
  ru: string;
  masu: string;
}

type ConjType = "te" | "ta" | "nai" | "masu";

interface Question {
  verb: VerbDetail;
  targetType: ConjType;
  options: string[];
  correctAnswer: string;
}

export default function PracticeConjugationScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const params = useLocalSearchParams<{ topicId?: string; listId?: string }>();
  
  // Cultivation store rewards
  const { addTuVi, addXP } = useCultivationStore();

  // Settings phase state
  const [isPlaying, setIsPlaying] = useState(false);
  const [vocabLists, setVocabLists] = useState<any[]>([]);
  const [selectedListIds, setSelectedListIds] = useState<string[]>([]);
  const [questionCount, setQuestionCount] = useState<number | "all">(10);
  const [loadingLists, setLoadingLists] = useState(true);

  // Active quiz phase state
  const [quizVerbs, setQuizVerbs] = useState<VerbDetail[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  
  // Results
  const [score, setScore] = useState(0);
  const [isFinished, setIsFinished] = useState(false);

  useEffect(() => {
    api
      .get("/api/vocab/lists")
      .then((res) => {
        if (res.data.success && res.data.data) {
          // Filter lists that have at least one verb
          const listsWithVerbs = res.data.data.map((list: any) => {
            const verbWords = (list.words || []).filter((w: any) => {
              const parsed = parseWord(w.term, w.def);
              const isVerbType = (parsed.type || "").toLowerCase().includes("verb");
              const hasConjs = !!(parsed.te || parsed.ta || parsed.nai || parsed.ru || parsed.masu);
              return isVerbType || hasConjs;
            });
            return {
              ...list,
              verbCount: verbWords.length,
            };
          });

          setVocabLists(listsWithVerbs);
          
          const targetId = params.topicId || params.listId;
          if (targetId) {
            const matched = listsWithVerbs.find((l: any) => l._id.toString() === targetId.toString());
            if (matched) {
              setSelectedListIds([matched._id]);
            } else {
              const defaultSelect = listsWithVerbs.find((l: any) => l.verbCount > 0);
              if (defaultSelect) {
                setSelectedListIds([defaultSelect._id]);
              }
            }
          } else {
            const defaultSelect = listsWithVerbs.find((l: any) => l.verbCount > 0);
            if (defaultSelect) {
              setSelectedListIds([defaultSelect._id]);
            }
          }
        }
        setLoadingLists(false);
      })
      .catch((err) => {
        console.error("Lỗi lấy danh sách bài học:", err);
        setLoadingLists(false);
      });
  }, [params.topicId, params.listId]);

  // Auto start quiz if listId or topicId param exists
  useEffect(() => {
    const targetId = params.topicId || params.listId;
    if (targetId && vocabLists.length > 0 && selectedListIds.length > 0 && !isPlaying) {
      const matched = vocabLists.find((l: any) => l._id.toString() === targetId.toString());
      if (matched && selectedListIds.includes(matched._id) && (matched.verbCount || 0) > 0) {
        // Collect verbs
        const selectedVerbs: VerbDetail[] = [];
        if (matched.words && matched.words.length > 0) {
          matched.words.forEach((w: any) => {
            const parsed = parseWord(w.term, w.def);
            const isVerb = (parsed.type || "").toLowerCase().includes("verb") || 
              !!(parsed.te || parsed.ta || parsed.nai || parsed.ru || parsed.masu);
            
            if (isVerb) {
              selectedVerbs.push({
                word: parsed.word,
                reading: parsed.reading || parsed.word,
                meaning: parsed.meaning,
                te: parsed.te || "",
                ta: parsed.ta || "",
                nai: parsed.nai || "",
                ru: parsed.ru || parsed.word || "",
                masu: parsed.masu || "",
              });
            }
          });
        }
        
        if (selectedVerbs.length > 0) {
          const shuffledVerbs = [...selectedVerbs].sort(() => Math.random() - 0.5);
          const limit = questionCount === "all" ? shuffledVerbs.length : (typeof questionCount === 'number' ? questionCount : 10);
          const finalVerbs = shuffledVerbs.slice(0, limit);
          
          const quizQuestions: Question[] = finalVerbs.map((verb) => {
            const availableTypes: ConjType[] = [];
            if (verb.te) availableTypes.push("te");
            if (verb.ta) availableTypes.push("ta");
            if (verb.nai) availableTypes.push("nai");
            if (verb.masu) availableTypes.push("masu");
            const targetType = availableTypes.length > 0
              ? availableTypes[Math.floor(Math.random() * availableTypes.length)]
              : "masu";
            let correctAnswer = "";
            if (targetType === "te") correctAnswer = verb.te;
            else if (targetType === "ta") correctAnswer = verb.ta;
            else if (targetType === "nai") correctAnswer = verb.nai;
            else correctAnswer = verb.masu;
            
            const wrongOptionsSet = new Set<string>();
            if (verb.te && targetType !== "te") wrongOptionsSet.add(verb.te);
            if (verb.ta && targetType !== "ta") wrongOptionsSet.add(verb.ta);
            if (verb.nai && targetType !== "nai") wrongOptionsSet.add(verb.nai);
            if (verb.masu && targetType !== "masu") wrongOptionsSet.add(verb.masu);
            if (verb.ru && verb.ru !== correctAnswer) wrongOptionsSet.add(verb.ru);
            if (wrongOptionsSet.size < 3) {
              const otherVerbsForms = selectedVerbs
                .filter((v) => v.word !== verb.word)
                .map((v) => [v.te, v.ta, v.nai, v.masu])
                .flat()
                .filter((f) => f && f !== correctAnswer);
              const shuffledOthers = otherVerbsForms.sort(() => Math.random() - 0.5);
              shuffledOthers.forEach((opt) => {
                if (wrongOptionsSet.size < 3) wrongOptionsSet.add(opt);
              });
            }
            const options = [correctAnswer, ...Array.from(wrongOptionsSet).slice(0, 3)].sort(() => Math.random() - 0.5);
            return { verb, targetType, options, correctAnswer };
          });
          
          setQuizVerbs(finalVerbs);
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
  }, [vocabLists, selectedListIds, params.topicId, params.listId]);

  const handleToggleList = (id: string) => {
    setSelectedListIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleStartQuiz = () => {
    if (selectedListIds.length === 0) return;

    const selectedDecks = vocabLists.filter((list) =>
      selectedListIds.includes(list._id)
    );
    const selectedVerbs: VerbDetail[] = [];

    selectedDecks.forEach((deck) => {
      if (deck.words && deck.words.length > 0) {
        deck.words.forEach((w: any) => {
          const parsed = parseWord(w.term, w.def);
          const isVerb = (parsed.type || "").toLowerCase().includes("verb") || 
            !!(parsed.te || parsed.ta || parsed.nai || parsed.ru || parsed.masu);
          
          if (isVerb) {
            selectedVerbs.push({
              word: parsed.word,
              reading: parsed.reading || parsed.word,
              meaning: parsed.meaning,
              te: parsed.te || "",
              ta: parsed.ta || "",
              nai: parsed.nai || "",
              ru: parsed.ru || parsed.word || "",
              masu: parsed.masu || "",
            });
          }
        });
      }
    });

    if (selectedVerbs.length === 0) {
      alert("Các bài học được chọn chưa có động từ nào có chia thể sếp ơi! Vui lòng chọn bài khác.");
      return;
    }

    const shuffledVerbs = [...selectedVerbs].sort(() => Math.random() - 0.5);
    const finalVerbs = questionCount === "all" 
      ? shuffledVerbs 
      : shuffledVerbs.slice(0, questionCount);

    // Prepare questions with random target conjugation types (te, ta, nai, masu)
    const quizQuestions: Question[] = finalVerbs.map((verb) => {
      const availableTypes: ConjType[] = [];
      if (verb.te) availableTypes.push("te");
      if (verb.ta) availableTypes.push("ta");
      if (verb.nai) availableTypes.push("nai");
      if (verb.masu) availableTypes.push("masu");

      // Default fallback type if none is defined
      const targetType = availableTypes.length > 0
        ? availableTypes[Math.floor(Math.random() * availableTypes.length)]
        : "masu";

      let correctAnswer = "";
      if (targetType === "te") correctAnswer = verb.te;
      else if (targetType === "ta") correctAnswer = verb.ta;
      else if (targetType === "nai") correctAnswer = verb.nai;
      else correctAnswer = verb.masu;

      // Smart wrong choices: other conjugation forms of the SAME verb!
      const wrongOptionsSet = new Set<string>();
      if (verb.te && targetType !== "te") wrongOptionsSet.add(verb.te);
      if (verb.ta && targetType !== "ta") wrongOptionsSet.add(verb.ta);
      if (verb.nai && targetType !== "nai") wrongOptionsSet.add(verb.nai);
      if (verb.masu && targetType !== "masu") wrongOptionsSet.add(verb.masu);
      if (verb.ru && verb.ru !== correctAnswer) wrongOptionsSet.add(verb.ru);

      // Fallback wrong options from other verbs if we don't have enough options
      if (wrongOptionsSet.size < 3) {
        const otherVerbsForms = selectedVerbs
          .filter((v) => v.word !== verb.word)
          .map((v) => [v.te, v.ta, v.nai, v.masu])
          .flat()
          .filter((f) => f && f !== correctAnswer);
          
        const shuffledOthers = otherVerbsForms.sort(() => Math.random() - 0.5);
        shuffledOthers.forEach((opt) => {
          if (wrongOptionsSet.size < 3) wrongOptionsSet.add(opt);
        });
      }

      // Add options and shuffle
      const options = [correctAnswer, ...Array.from(wrongOptionsSet).slice(0, 3)].sort(
        () => Math.random() - 0.5
      );

      return {
        verb,
        targetType,
        options,
        correctAnswer,
      };
    });

    setQuizVerbs(finalVerbs);
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

    // TTS pronunciation of correct answer
    speak(currentQuestion.correctAnswer);

    setTimeout(() => {
      if (currentIdx < questions.length - 1) {
        setCurrentIdx((prev) => prev + 1);
        setIsAnswered(false);
        setSelectedAnswer(null);
      } else {
        const finalScore = isCorrect ? score + 1 : score;
        const rewardTuViAmount = finalScore * 15; // More difficult -> 15 Tu Vi per correct
        const rewardXPAmount = finalScore * 6;
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

  const getTargetTypeLabel = (type: ConjType) => {
    if (type === "te") return "Thể Liên Kết (-te)";
    if (type === "ta") return "Thể Quá Khứ (-ta)";
    if (type === "nai") return "Thể Phủ Định (-nai)";
    return "Thể Lịch Sự (-masu)";
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

  // 1. CONFIGURATION PHASE
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
              <Text style={[styles.headerTitle, { color: colors.text }]}>Trắc Nghiệm Chia Thể</Text>
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
              <Text style={[styles.sectionHeading, { color: colors.indigo }]}>1. CHỌN BÀI CHỨA ĐỘNG TỪ</Text>
              {vocabLists.length === 0 ? (
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                  Chưa có bài học nào. Sếp cần tạo bài trước nha!
                </Text>
              ) : (
                <View style={styles.listGrid}>
                  {vocabLists.map((list) => {
                    const isSelected = selectedListIds.includes(list._id);
                    const disabled = list.verbCount === 0;
                    return (
                      <Pressable
                        key={list._id}
                        onPress={() => !disabled && handleToggleList(list._id)}
                        disabled={disabled}
                        style={({ pressed }) => [
                          styles.listCardItem,
                          {
                            backgroundColor: isSelected 
                              ? colors.indigoLight 
                              : disabled 
                                ? (isDark ? "rgba(255, 255, 255, 0.02)" : "#E2E8F0")
                                : colors.surface,
                            borderColor: isSelected ? colors.indigo : colors.border,
                            opacity: disabled ? 0.4 : 1,
                            transform: [{ scale: pressed && !disabled ? 0.98 : 1 }],
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
                              Có {list.verbCount} động từ chia thể
                            </Text>
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>

            {/* Question Count Section */}
            <View style={[styles.sectionContainer, { marginTop: 24 }]}>
              <Text style={[styles.sectionHeading, { color: colors.indigo }]}>2. SỐ LƯỢNG ĐỘNG TỪ HỎI</Text>
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
              <Text style={styles.btnStartText}>BẮT ĐẦU TU LUYỆN CHIA THỂ</Text>
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
              <Text style={[styles.headerTitle, { color: colors.text }]}>Tu Luyện Chia Thể</Text>
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
              onPress={() => speak(currentQuestion.verb.word)}
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
              <Text style={[styles.questionInstruction, { color: colors.textMuted }]}>
                HÃY CHIA ĐỘNG TỪ
              </Text>
              <Text style={[styles.questionWordText, { color: colors.text }]}>
                {currentQuestion.verb.word} <Text style={{ fontSize: 18, color: colors.textMuted }}>({currentQuestion.verb.meaning})</Text>
              </Text>
              
              <View style={[styles.badgeTarget, { backgroundColor: colors.indigoLight, borderColor: colors.indigo }]}>
                <Text style={[styles.badgeTargetText, { color: colors.indigo }]}>
                  SANG: {getTargetTypeLabel(currentQuestion.targetType).toUpperCase()}
                </Text>
              </View>
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
    const rewardTuViGained = score * 15;

    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: bgColors[0] }]}>
        <LinearGradient colors={bgColors} style={styles.container}>
          <Stack.Screen options={{ headerShown: false }} />

          <View style={[styles.center, { paddingHorizontal: 24 }]}>
            {/* Success Emblem Banner */}
            <View style={[styles.emblemIconCircle, { backgroundColor: colors.indigoLight }]}>
              <Ionicons name="sparkles-outline" size={50} color={colors.indigo} />
            </View>

            <Text style={[styles.resultTitle, { color: colors.text }]}>PHÁP LỰC ĐỘT PHÁ</Text>
            <Text style={[styles.resultSubtitle, { color: colors.textMuted }]}>
              Hoàn thành thử thách trắc nghiệm chia thể động từ!
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
                  Lĩnh ngộ võ công: <Text style={{ color: colors.indigo, fontWeight: "900" }}>+{rewardTuViGained}</Text> Tu Vi pháp lực!
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
                <Text style={[styles.btnResultText, { color: "#050814" }]}>TU LUYỆN LẠI</Text>
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
    borderRadius: 28,
    borderWidth: 1.5,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 4,
    minHeight: 180,
    marginBottom: 30,
  },
  questionInstruction: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  questionWordText: {
    fontSize: 34,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 16,
  },
  badgeTarget: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
  },
  badgeTargetText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
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
});
