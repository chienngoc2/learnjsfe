import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, Animated, Dimensions, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import api from '../../services/api';

interface WordItem { term: string; def: string; correctCount?: number; }

export default function PracticeTypingScreen() {
  const { topicId, title } = useLocalSearchParams<{ topicId: string, title: string }>();
  const router = useRouter();

  const [words, setWords] = useState<WordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userInput, setUserInput] = useState('');
  const [status, setStatus] = useState<'typing' | 'correct' | 'wrong'>('typing');

  const [score, setScore] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [isReverseMode, setIsReverseMode] = useState(false); 

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastAnim = useRef(new Animated.Value(-100)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 🚀 STATE THẦN THÁNH: Lưu thông tin bài "Cần ôn tập" tổng thể để thao tác chép/xóa từ
  const [reviewListObj, setReviewListObj] = useState<any>(null);

  useEffect(() => {
    api.get('/api/vocab/lists').then(res => {
      if (res.data.success) {
        const allLists = res.data.data;
        
        // 🔎 Chủ động quét tìm bài "Cần ôn tập" cất vào kho báu state
        const foundReview = allLists.find((l: any) => l.title === "Cần ôn tập");
        setReviewListObj(foundReview);

        const targetList = allLists.find((l: any) => l._id === topicId);
        if (targetList && targetList.words.length > 0) {
          // Khởi tạo biến đếm nếu từ chưa từng có trường correctCount trong DB
          const preparedWords = targetList.words.map((w: any) => ({
            ...w,
            correctCount: w.correctCount || 0
          }));
          
          // Chỉ xáo trộn nếu đây không phải bài "Cần ôn tập" để dễ theo dõi tiến trình gõ tích lũy
          if (targetList.title !== "Cần ôn tập") {
            preparedWords.sort(() => Math.random() - 0.5);
          }
          setWords(preparedWords);
        } else {
          setIsFinished(true);
        }
      }
      setLoading(false);
    });
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [topicId]);

  useEffect(() => {
    if (words.length > 0) {
      const percentage = (currentIndex / words.length) * 100;
      Animated.timing(progressAnim, { toValue: percentage, duration: 300, useNativeDriver: false }).start();
    }
  }, [currentIndex, words.length]);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    Animated.timing(toastAnim, { toValue: 40, duration: 300, useNativeDriver: true }).start();
    setTimeout(() => {
      Animated.timing(toastAnim, { toValue: -100, duration: 300, useNativeDriver: true }).start(() => setToastMsg(null));
    }, 2500);
  };

  const getTargetAnswers = (rawAnswer: string) => {
    let validAnswers: string[] = [];
    const normalizedStr = rawAnswer.replace(/（/g, "(").replace(/）/g, ")");
    const parts = normalizedStr.split("/");
    parts.forEach(part => {
      const outside = part.replace(/\(.*?\)/g, "").trim().toLowerCase();
      if (outside) validAnswers.push(outside);
      const insideMatch = part.match(/\((.*?)\)/);
      if (insideMatch && insideMatch[1]) {
        insideMatch[1].split("/").forEach(ip => {
          if (ip.trim()) validAnswers.push(ip.trim().toLowerCase());
        });
      }
    });
    return validAnswers;
  };

  const handleHint = () => {
    const rawAnswer = isReverseMode ? words[currentIndex].def : words[currentIndex].term;
    const firstValidAnswer = getTargetAnswers(rawAnswer)[0];
    const revealCount = Math.max(1, Math.floor(firstValidAnswer.length / 2));
    triggerToast(`💡 Gợi ý: ${firstValidAnswer.substring(0, revealCount)} * * *`);
  };

  const moveToNextQuestion = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (currentIndex < words.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setUserInput('');
      setStatus('typing');
    } else {
      setIsFinished(true);
    }
  };

  const checkAnswer = () => {
    if (status !== 'typing') {
      moveToNextQuestion();
      return;
    }
    if (!userInput.trim()) return;
    
    const currentWordObj = words[currentIndex];
    const rawAnswer = isReverseMode ? currentWordObj.def : currentWordObj.term;
    const alternativeAnswers = getTargetAnswers(rawAnswer);
    const cleanUser = userInput.replace(/　/g, " ").trim().toLowerCase(); 

    if (alternativeAnswers.includes(cleanUser)) {
      setStatus('correct');
      setScore(prev => prev + 1);

      // 🚀 TÌM ĐIỂM SÁNG: Xử lý logic ĐÚNG 10 LẦN khi đang cày chính bài "Cần ôn tập"
      if (title === "Cần ôn tập" && reviewListObj) {
        const nextCount = (currentWordObj.correctCount || 0) + 1;
        currentWordObj.correctCount = nextCount; // Tăng cục bộ trên UI

        if (nextCount >= 10) {
          // 🎉 Đạt đỉnh 10 lần đúng -> TRỤC XUẤT KHỎI BÀI ÔN TẬP
          const filteredWords = reviewListObj.words.filter((w: any) => w.term !== currentWordObj.term);
          api.put(`/api/vocab/update/${reviewListObj._id}`, { title: "Cần ôn tập", list: filteredWords })
            .then(() => {
              setReviewListObj({ ...reviewListObj, words: filteredWords });
              triggerToast(`🎉 Thành tài! Đã gõ đúng 10 lần, xóa khỏi mục ôn tập!`);
            });
        } else {
          // Chưa đủ 10 lần -> Chỉ cập nhật lưu vết số lần gõ đúng lên MongoDB
          const updatedReviewWords = reviewListObj.words.map((w: any) => 
            w.term === currentWordObj.term ? { ...w, correctCount: nextCount } : w
          );
          api.put(`/api/vocab/update/${reviewListObj._id}`, { title: "Cần ôn tập", list: updatedReviewWords })
            .then(() => setReviewListObj({ ...reviewListObj, words: updatedReviewWords }));
        }
      }

    } else {
      setStatus('wrong');

      // 🚀 TÌM ĐIỂM SÁNG: Gõ SAI ở bất kỳ bài thường nào -> Auto COPY ném qua bài "Cần ôn tập"
      if (title !== "Cần ôn tập" && reviewListObj) {
        const isAlreadyInReview = reviewListObj.words.some((w: any) => w.term === currentWordObj.term);
        
        if (!isAlreadyInReview) {
          const freshReviewWords = [...reviewListObj.words, { term: currentWordObj.term, def: currentWordObj.def, correctCount: 0 }];
          api.put(`/api/vocab/update/${reviewListObj._id}`, { title: "Cần ôn tập", list: freshReviewWords })
            .then(() => {
              setReviewListObj({ ...reviewListObj, words: freshReviewWords });
              triggerToast("⚠️ Lọt lưới! Đã tự chép từ này vào mục 'Cần ôn tập'.");
            });
        }
      }
    }

    timerRef.current = setTimeout(() => { moveToNextQuestion(); }, 2500); 
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#4F46E5" /></View>;

  if (isFinished) {
    const accuracy = Math.round((score / words.length) * 100) || 0;
    return (
      <View style={styles.finishContainer}>
        <Text style={styles.finishEmoji}>{accuracy >= 80 ? '🎉' : '💪'}</Text>
        <Text style={styles.finishTitle}>Hoàn thành bài tập!</Text>
        <Text style={styles.finishSub}>Tỉ lệ chính xác: {accuracy}%</Text>
        <TouchableOpacity style={styles.btnFinish} onPress={() => router.back()}><Text style={styles.btnFinishText}>Trở về thư viện</Text></TouchableOpacity>
      </View>
    );
  }

  const currentQuestion = isReverseMode ? words[currentIndex].term : words[currentIndex].def;
  const currentAnswer = isReverseMode ? words[currentIndex].def : words[currentIndex].term;
  const currentWordCorrectStreak = words[currentIndex].correctCount || 0;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      {toastMsg && (
        <Animated.View style={[styles.miniToast, { transform: [{ translateY: toastAnim }] }]}><Text style={styles.miniToastText}>{toastMsg}</Text></Animated.View>
      )}

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><MaterialIcons name="close" size={28} color="#64748B" /></TouchableOpacity>
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, { width: progressAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) }]} />
        </View>
        <Text style={styles.progressText}>{currentIndex + 1}/{words.length}</Text>
      </View>

      <View style={{ alignItems: 'center', marginTop: 10 }}>
        <TouchableOpacity style={styles.toggleModeBtn} onPress={() => { setIsReverseMode(!isReverseMode); setUserInput(''); setStatus('typing'); if(timerRef.current) clearTimeout(timerRef.current); }}>
          <MaterialIcons name="swap-horiz" size={20} color="#4F46E5" />
          <Text style={styles.toggleModeText}>{isReverseMode ? "Chế độ: Nhật ➔ Việt" : "Chế độ: Việt ➔ Nhật"}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.questionLabel}>{isReverseMode ? "Dịch sang Tiếng Việt" : "Dịch sang Tiếng Nhật"}</Text>
        <Text style={[styles.questionWord, isReverseMode && { fontSize: 36 } ]}>{currentQuestion}</Text>
        
        {/* 🔥 TIẾN TRÌNH 10 LẦN: Chỉ hiển thị huy hiệu đếm số lần đúng nếu đang ở bài "Cần ôn tập" */}
        {title === "Cần ôn tập" && (
          <View style={styles.streakBadge}>
            <Text style={styles.streakBadgeText}>🔥 Độ thuần thục: {currentWordCorrectStreak}/10 lần đúng</Text>
          </View>
        )}
      </View>

      <View style={styles.inputContainer}>
        <TextInput
          style={[styles.input, status === 'wrong' && styles.inputWrong, status === 'correct' && styles.inputCorrect]}
          value={userInput}
          onChangeText={(text) => { 
            if (status !== 'typing') { setStatus('typing'); if (timerRef.current) clearTimeout(timerRef.current); }
            setUserInput(text); 
          }}
          placeholder={isReverseMode ? "Gõ tiếng Việt..." : "Gõ tiếng Nhật..."}
          placeholderTextColor="#94A3B8"
          autoFocus={true}
          autoCapitalize="none"
          editable={true} 
          blurOnSubmit={false}
          onKeyPress={(e) => { if (e.nativeEvent.key === 'Enter') checkAnswer(); }}
        />
        {status === 'typing' && (
          <TouchableOpacity style={styles.hintBtn} onPress={handleHint}>
            <MaterialIcons name="lightbulb-outline" size={16} color="#F59E0B" /><Text style={styles.hintText}>Trợ giúp</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.footer}>
        {status === 'typing' ? (
          <TouchableOpacity style={[styles.btnCheck, !userInput.trim() && styles.btnCheckDisabled]} onPress={checkAnswer} disabled={!userInput.trim()}><Text style={styles.btnCheckText}>Kiểm tra</Text></TouchableOpacity>
        ) : (
          <View style={[styles.floatingBanner, status === 'correct' ? styles.bannerCorrect : styles.bannerWrong]}>
            <View style={styles.feedbackInfo}>
              <MaterialIcons name={status === 'correct' ? 'check-circle' : 'cancel'} size={28} color={status === 'correct' ? '#10B981' : '#EF4444'} />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={[styles.feedbackTitle, { color: status === 'correct' ? '#10B981' : '#EF4444' }]}>{status === 'correct' ? 'Tuyệt vời!' : 'Sai mất rồi sếp ơi!'}</Text>
                {status === 'wrong' && <Text style={styles.feedbackAnswer}>Đ/A đúng: <Text style={{fontWeight: '800'}}>{currentAnswer}</Text></Text>}
              </View>
              <TouchableOpacity style={[styles.btnNextMini, { backgroundColor: status === 'correct' ? '#10B981' : '#EF4444' }]} onPress={moveToNextQuestion}><MaterialIcons name="arrow-forward" size={24} color="#FFF" /></TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  miniToast: { position: 'absolute', top: 0, right: 16, backgroundColor: '#334155', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, zIndex: 9999 },
  miniToastText: { color: '#FCD34D', fontSize: 13, fontWeight: '700' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 50, paddingBottom: 10, gap: 16 },
  progressTrack: { flex: 1, height: 10, backgroundColor: '#E2E8F0', borderRadius: 10, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#10B981', borderRadius: 10 },
  progressText: { fontSize: 14, fontWeight: '700', color: '#64748B' },
  toggleModeBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EEF2F6', paddingVertical: 6, paddingHorizontal: 16, borderRadius: 20, gap: 6, borderWidth: 1, borderColor: '#E0E7FF' },
  toggleModeText: { fontSize: 13, fontWeight: '700', color: '#4F46E5' },
  card: { marginHorizontal: 20, marginTop: 20, paddingVertical: 35, paddingHorizontal: 20, backgroundColor: '#FFFFFF', borderRadius: 24, alignItems: 'center', shadowColor: "#0F172A", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.04, shadowRadius: 16, elevation: 3 },
  questionLabel: { fontSize: 13, fontWeight: '700', color: '#64748B', textTransform: 'uppercase', marginBottom: 12 },
  questionWord: { fontSize: 28, fontWeight: '800', color: '#1E293B', textAlign: 'center' },
  
  // Huy hiệu đếm số lần thuộc lòng
  streakBadge: { marginTop: 16, backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FED7AA', paddingVertical: 4, paddingHorizontal: 12, borderRadius: 12 },
  streakBadgeText: { fontSize: 12, fontWeight: '700', color: '#EA580C' },

  inputContainer: { paddingHorizontal: 20, marginTop: 30 },
  input: { backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#E2E8F0', borderRadius: 16, paddingVertical: 16, paddingHorizontal: 20, fontSize: 18, fontWeight: '600', color: '#1E293B', textAlign: 'center' },
  inputCorrect: { borderColor: '#10B981', backgroundColor: '#F0FDF4', color: '#10B981' },
  inputWrong: { borderColor: '#EF4444', backgroundColor: '#FEF2F2', color: '#EF4444' },
  hintBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', marginTop: 12, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#FEF3C7', borderRadius: 12, borderWidth: 1, borderColor: '#FDE68A' },
  hintText: { fontSize: 12, fontWeight: '700', color: '#D97706', marginLeft: 4 },
  footer: { position: 'absolute', bottom: 20, left: 0, right: 0, paddingHorizontal: 20 },
  btnCheck: { backgroundColor: '#4F46E5', paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  btnCheckDisabled: { backgroundColor: '#CBD5E1' },
  btnCheckText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', textTransform: 'uppercase' },
  floatingBanner: { padding: 16, borderRadius: 20 },
  bannerCorrect: { backgroundColor: '#D1FAE5', borderWidth: 1, borderColor: '#A7F3D0' },
  bannerWrong: { backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#FECACA' },
  feedbackInfo: { flexDirection: 'row', alignItems: 'center' },
  feedbackTitle: { fontSize: 18, fontWeight: '800' },
  feedbackAnswer: { fontSize: 14, color: '#991B1B', marginTop: 2 },
  btnNextMini: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  finishContainer: { flex: 1, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center', padding: 20 },
  finishEmoji: { fontSize: 70, marginBottom: 16 },
  finishTitle: { fontSize: 26, fontWeight: '800', color: '#1E293B', marginBottom: 8 },
  finishSub: { fontSize: 15, color: '#64748B', fontWeight: '600', marginBottom: 24 },
  btnFinish: { backgroundColor: '#4F46E5', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 16 },
  btnFinishText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' }
});