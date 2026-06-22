import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Platform,
  Dimensions,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter, Stack } from "expo-router";
import api from "../../services/api";
import { useTheme } from "@/src/context/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
} from "react-native-reanimated";
import { useCultivationStore } from "../../store/useCultivationStore";

const { width } = Dimensions.get("window");

export default function DashboardScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  
  // Zustand Cultivation Store
  const { 
    level, 
    stage, 
    tuVi, 
    dailyQuests, 
    currentTitle,
    streak: cultivationStreak,
    setStreak: setStoreStreak,
    completeQuestDirectly
  } = useCultivationStore();
  
  // Data states
  const [username, setUsername] = useState("Sếp");
  const [vocabCount, setVocabCount] = useState(0);
  const [kanjiCount, setKanjiCount] = useState(0);
  const [grammarCount, setGrammarCount] = useState(0);
  const [serverOnline, setServerOnline] = useState(true);

  const maxTuVi = level * 100 + 500;
  const tuViPercent = Math.min(100, Math.round((tuVi / maxTuVi) * 100));
  const nextStage = level < 11 
    ? 'Trúc Cơ 期 (築基期 - N4)' 
    : level < 21 
      ? 'Kim Đan 期 (金丹期 - N3)' 
      : level < 31 
        ? 'Nguyên Anh 期 (元嬰期 - N2)' 
        : 'Hóa Thần 期 (化神期 - N1)';

  // Shared value for breathing connection dot
  const pulseValue = useSharedValue(1);

  useEffect(() => {
    pulseValue.value = withRepeat(
      withSequence(
        withTiming(0.3, { duration: 1200 }),
        withTiming(1, { duration: 1200 })
      ),
      -1,
      true
    );
  }, []);

  const pulseStyle = useAnimatedStyle(() => {
    return {
      opacity: pulseValue.value,
      transform: [{ scale: withTiming(pulseValue.value * 0.2 + 0.9, { duration: 100 }) }],
    };
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login" as any);
        return;
      }
      
      // Get user information
      const userStr = await AsyncStorage.getItem("user");
      if (userStr) {
        try {
          const userObj = JSON.parse(userStr);
          if (userObj && userObj.username) {
            setUsername(userObj.username);
          }
        } catch (e) {
          // ignore parse errors
        }
      }
      
      // 1. Calculate Streak
      const lastLogin = await AsyncStorage.getItem("last_login");
      const currentStreak = await AsyncStorage.getItem("streak_count");
      const today = new Date().toDateString();

      if (lastLogin === today) {
        const val = Number(currentStreak) || 0;
        setStoreStreak(val);
      } else {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        
        let newStreak = 1;
        if (lastLogin === yesterday.toDateString()) {
          newStreak = (Number(currentStreak) || 0) + 1;
        }
        
        await AsyncStorage.setItem("last_login", today);
        await AsyncStorage.setItem("streak_count", newStreak.toString());
        setStoreStreak(newStreak);
      }

      // 2. Fetch Stats from Backend
      let active = true;
      try {
        const vocabRes = await api.get("/api/vocab/lists");
        if (active) {
          const list = vocabRes.data.data || vocabRes.data || [];
          const totalWords = list.reduce(
            (acc: number, item: any) => acc + (item.words?.length || 0),
            0
          );
          setVocabCount(totalWords);
        }
      } catch (err) {
        console.warn("Failed to fetch vocab list stats:", err);
      }

      try {
        const kanjiRes = await api.get("/api/kanji/groups");
        if (active) {
          const list = kanjiRes.data.data || kanjiRes.data;
          const totalKanji = list.reduce((acc: number, g: any) => acc + (g.count || 0), 0);
          setKanjiCount(totalKanji);
        }
      } catch (err) {
        console.warn("Failed to fetch kanji groups stats:", err);
      }

      try {
        const grammarRes = await api.get("/api/vocab/all-grammar-points");
        if (active) {
          const list = grammarRes.data.data || grammarRes.data || [];
          setGrammarCount(list.length);
        }
      } catch (err) {
        console.warn("Failed to fetch grammar points stats:", err);
      }

      setServerOnline(true);
    } catch (error) {
      console.error("Connection issue in dashboard:", error);
      setServerOnline(false);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem("token");
      await AsyncStorage.removeItem("user");
      router.replace("/login" as any);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  if (loading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.indigo} />
      </View>
    );
  }

  // Study targets progress
  const targetCards = 300;
  const completionPercent = Math.min(100, Math.round((vocabCount / targetCards) * 100)) || 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.scrollContent,
          { 
            paddingTop: insets.top > 0 ? insets.top + 10 : (Platform.OS === "android" ? 50 : 25) 
          }
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ================= HEADER ROW ================= */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Image
              source={{ uri: "https://api.dicebear.com/7.x/avataaars/svg?seed=" + username }}
              style={[styles.avatar, { borderColor: colors.indigo }]}
            />
            <View style={styles.greetingBox}>
              <Text style={[styles.greetingTitle, { color: colors.text }]}>
                {currentTitle ? `【${currentTitle}】` : ''} {username}
              </Text>
              <Text style={{ fontSize: 11, color: colors.indigo, fontWeight: "700", marginTop: 2 }}>
                Cảnh giới: {stage} (Cấp {level})
              </Text>
              
              {/* Pulsing server connection indicator */}
              <View style={styles.statusContainer}>
                <Animated.View 
                  style={[
                    styles.statusDot, 
                    { backgroundColor: serverOnline ? colors.indigo : colors.error },
                    pulseStyle
                  ]} 
                />
                <Text style={[styles.statusText, { color: colors.textMuted }]}>
                  {serverOnline ? "Đã kết nối máy chủ" : "Mất kết nối máy chủ"}
                </Text>
              </View>
            </View>
          </View>

          {/* Action buttons */}
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
              activeOpacity={0.8}
              onPress={fetchDashboardData}
            >
              <MaterialIcons name="refresh" size={22} color={colors.text} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
              activeOpacity={0.8}
              onPress={handleLogout}
            >
              <MaterialIcons name="logout" size={20} color={colors.error} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ================= BENTO GRID STATS ================= */}
        <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 12 }]}>
          Thống kê tiến trình
        </Text>

        <View style={styles.bentoContainer}>
          {/* Widget 1: Tu Vi Progress (Large Widget) */}
          <Animated.View 
            entering={FadeInDown.delay(50).duration(500)}
            style={[
              styles.bentoLarge, 
              { 
                backgroundColor: colors.surface, 
                borderColor: colors.border,
                borderLeftWidth: 4,
                borderLeftColor: colors.indigo,
              }
            ]}
          >
            <View style={styles.bentoLargeContent}>
              <Text style={[styles.bentoLabel, { color: colors.indigo, fontWeight: "800" }]}>TU VI TIẾN TRÌNH</Text>
              <Text style={[styles.bentoValue, { color: colors.text }]}>{tuVi} / {maxTuVi} Linh Khí</Text>
              
              <View style={[styles.progressBarBg, { backgroundColor: isDark ? "#121824" : colors.border }]}>
                <View 
                  style={[
                    styles.progressBarFill, 
                    { 
                      backgroundColor: colors.indigo, 
                      width: `${tuViPercent}%` 
                    }
                  ]} 
                />
              </View>
              <Text style={[styles.progressBarText, { color: colors.textMuted }]}>
                Cảnh giới tiếp theo: {nextStage}
              </Text>
            </View>

            <View style={styles.circleContainer}>
              <View style={[styles.circleProgress, { borderColor: colors.border, backgroundColor: isDark ? "#101625" : "#FFF" }]}>
                <Text style={[styles.circlePercent, { color: colors.indigo }]}>{tuViPercent}%</Text>
              </View>
            </View>
          </Animated.View>

          {/* Row 2: Two Medium Widgets */}
          <View style={styles.bentoRow}>
            {/* Widget 2: Vocabulary Count */}
            <Animated.View 
              entering={FadeInDown.delay(150).duration(500)}
              style={[styles.bentoMedium, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={[styles.iconBadge, { backgroundColor: colors.indigoLight }]}>
                <MaterialIcons name="view-carousel" size={22} color={colors.indigo} />
              </View>
              <Text style={[styles.bentoNumber, { color: colors.text }]}>{vocabCount}</Text>
              <Text style={[styles.bentoLabel, { color: colors.textMuted }]}>Từ vựng đã nạp</Text>
            </Animated.View>

            {/* Widget 3: Kanji Count */}
            <Animated.View 
              entering={FadeInDown.delay(250).duration(500)}
              style={[styles.bentoMedium, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={[styles.iconBadge, { backgroundColor: colors.indigoLight }]}>
                <MaterialIcons name="font-download" size={22} color={colors.indigo} />
              </View>
              <Text style={[styles.bentoNumber, { color: colors.text }]}>{kanjiCount}</Text>
              <Text style={[styles.bentoLabel, { color: colors.textMuted }]}>Chữ Hán tự thuộc</Text>
            </Animated.View>
          </View>

          {/* Row 3: Two Medium Widgets */}
          <View style={styles.bentoRow}>
            {/* Widget 4: Grammar Count */}
            <Animated.View 
              entering={FadeInDown.delay(350).duration(500)}
              style={[styles.bentoMedium, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={[styles.iconBadge, { backgroundColor: colors.indigoLight }]}>
                <MaterialIcons name="menu-book" size={22} color={colors.indigo} />
              </View>
              <Text style={[styles.bentoNumber, { color: colors.text }]}>{grammarCount}</Text>
              <Text style={[styles.bentoLabel, { color: colors.textMuted }]}>Cấu trúc ngữ pháp</Text>
            </Animated.View>

            {/* Widget 5: Streak count */}
            <Animated.View 
              entering={FadeInDown.delay(450).duration(500)}
              style={[styles.bentoMedium, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={[styles.iconBadge, { backgroundColor: colors.indigoLight }]}>
                <MaterialIcons name="whatshot" size={22} color={colors.indigo} />
              </View>
              <Text style={[styles.bentoNumber, { color: colors.text }]}>{cultivationStreak}</Text>
              <Text style={[styles.bentoLabel, { color: colors.textMuted }]}>Tu luyện liên tục (Ngày)</Text>
            </Animated.View>
          </View>
        </View>

        {/* ================= DAILY QUESTS ================= */}
        <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 20, marginBottom: 12 }]}>
          Nhiệm vụ tu luyện hôm nay
        </Text>
        <View style={styles.questsList}>
          {dailyQuests.map((quest) => (
            <TouchableOpacity
              key={quest.id}
              activeOpacity={0.8}
              onPress={() => {
                if (!quest.completed) {
                  completeQuestDirectly(quest.id);
                }
              }}
              style={[
                styles.questItem,
                { 
                  backgroundColor: colors.surface, 
                  borderColor: quest.completed ? "#10b98140" : colors.border,
                  borderLeftWidth: 3.5,
                  borderLeftColor: quest.completed ? "#10b981" : colors.indigo
                }
              ]}
            >
              <View style={styles.questLeft}>
                <MaterialIcons
                  name={quest.completed ? "check-circle" : "radio-button-unchecked"}
                  size={18}
                  color={quest.completed ? "#10b981" : colors.textMuted}
                />
                <View style={styles.questInfo}>
                  <Text style={[styles.questJpLabel, { color: colors.text }]}>{quest.jpLabel}</Text>
                  <Text style={[styles.questLabel, { color: colors.textMuted }]}>
                    {quest.label} ({quest.current}/{quest.target})
                  </Text>
                </View>
              </View>
              <Text style={[styles.questReward, { color: quest.completed ? "#10b981" : colors.indigo }]}>
                +{quest.rewardTuVi} Tu Vi
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ================= QUICK LINK WIDGETS ================= */}
        <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 20, marginBottom: 12 }]}>
          Lối tắt học tập
        </Text>

        <View style={styles.quickGrid}>
          {/* Học thẻ */}
          <TouchableOpacity
            style={[styles.quickCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push("/vocab")}
            activeOpacity={0.8}
          >
            <View style={[styles.quickIconCircle, { backgroundColor: colors.indigoLight }]}>
              <MaterialIcons name="library-books" size={22} color={colors.indigo} />
            </View>
            <Text style={[styles.quickLabel, { color: colors.text }]}>Học thẻ</Text>
          </TouchableOpacity>

          {/* Học Kanji */}
          <TouchableOpacity
            style={[styles.quickCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push("/study/show-kanji")}
            activeOpacity={0.8}
          >
            <View style={[styles.quickIconCircle, { backgroundColor: colors.indigoLight }]}>
              <MaterialIcons name="import-contacts" size={22} color={colors.indigo} />
            </View>
            <Text style={[styles.quickLabel, { color: colors.text }]}>Học Kanji</Text>
          </TouchableOpacity>

          {/* Game Ghép Câu */}
          <TouchableOpacity
            style={[styles.quickCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push("/luyen-tap/grammar")}
            activeOpacity={0.8}
          >
            <View style={[styles.quickIconCircle, { backgroundColor: colors.indigoLight }]}>
              <MaterialIcons name="extension" size={22} color={colors.indigo} />
            </View>
            <Text style={[styles.quickLabel, { color: colors.text }]}>Game Ghép Câu</Text>
          </TouchableOpacity>

          {/* Game Ghép Từ */}
          <TouchableOpacity
            style={[styles.quickCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push("/luyen-tap/vocab-match")}
            activeOpacity={0.8}
          >
            <View style={[styles.quickIconCircle, { backgroundColor: colors.indigoLight }]}>
              <MaterialIcons name="layers" size={22} color={colors.indigo} />
            </View>
            <Text style={[styles.quickLabel, { color: colors.text }]}>Game Ghép Từ</Text>
          </TouchableOpacity>

          {/* Trắc nghiệm */}
          <TouchableOpacity
            style={[styles.quickCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push("/luyen-tap/quiz")}
            activeOpacity={0.8}
          >
            <View style={[styles.quickIconCircle, { backgroundColor: colors.indigoLight }]}>
              <MaterialIcons name="quiz" size={22} color={colors.indigo} />
            </View>
            <Text style={[styles.quickLabel, { color: colors.text }]}>Trắc nghiệm</Text>
          </TouchableOpacity>

          {/* Chia thể động từ */}
          <TouchableOpacity
            style={[styles.quickCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push("/luyen-tap/conjugation")}
            activeOpacity={0.8}
          >
            <View style={[styles.quickIconCircle, { backgroundColor: colors.indigoLight }]}>
              <MaterialIcons name="transform" size={22} color={colors.indigo} />
            </View>
            <Text style={[styles.quickLabel, { color: colors.text }]}>Chia thể</Text>
          </TouchableOpacity>

          {/* Luyện nói AI */}
          <TouchableOpacity
            style={[styles.quickCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push("/chat")}
            activeOpacity={0.8}
          >
            <View style={[styles.quickIconCircle, { backgroundColor: colors.indigoLight }]}>
              <MaterialIcons name="settings-voice" size={22} color={colors.indigo} />
            </View>
            <Text style={[styles.quickLabel, { color: colors.text }]}>Hội thoại</Text>
          </TouchableOpacity>
        </View>

        {/* ================= DECKS SECTION ================= */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Lớp học của tôi</Text>
          <TouchableOpacity onPress={() => router.push("/vocab")} activeOpacity={0.7}>
            <Text style={[styles.sectionLink, { color: colors.indigo }]}>Xem thêm</Text>
          </TouchableOpacity>
        </View>

        {/* Deck 1: Vocabs */}
        <TouchableOpacity
          style={[styles.deckCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => router.push("/vocab")}
          activeOpacity={0.8}
        >
          <Image
            source={{ uri: "https://images.unsplash.com/photo-1528459801416-a9e53bbf4e17?q=80&w=200" }}
            style={styles.deckThumbnail}
          />
          <View style={styles.deckContent}>
            <Text style={[styles.deckTitle, { color: colors.text }]}>Từ vựng N5 cốt lõi</Text>
            <Text style={[styles.deckSub, { color: colors.textMuted }]}>
              Đã tích hợp flashcard lật 3D hiệu năng cao
            </Text>
            <View style={styles.deckProgressRow}>
              <View style={[styles.deckProgressBarBg, { backgroundColor: colors.border }]}>
                <View style={[styles.deckProgressBarFill, { backgroundColor: colors.indigo, width: `${completionPercent}%` }]} />
              </View>
              <Text style={[styles.deckPercent, { color: colors.textMuted }]}>{completionPercent}%</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Deck 2: Kanji */}
        <TouchableOpacity
          style={[styles.deckCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => router.push("/study/show-kanji")}
          activeOpacity={0.8}
        >
          <Image
            source={{ uri: "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?q=80&w=200" }}
            style={styles.deckThumbnail}
          />
          <View style={styles.deckContent}>
            <Text style={[styles.deckTitle, { color: colors.text }]}>Hán tự bài học</Text>
            <Text style={[styles.deckSub, { color: colors.textMuted }]}>
              Học chữ Kanji, cách viết nét và tra nghĩa Hán Việt
            </Text>
            <View style={styles.deckProgressRow}>
              <View style={[styles.deckProgressBarBg, { backgroundColor: colors.border }]}>
                <View style={[styles.deckProgressBarFill, { backgroundColor: colors.indigo, width: "50%" }]} />
              </View>
              <Text style={[styles.deckPercent, { color: colors.textMuted }]}>50%</Text>
            </View>
          </View>
        </TouchableOpacity>
      </ScrollView>

      {/* Floating Plus Button */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.indigo }]}
        onPress={() => router.push("/study/add-vocab" as any)}
        activeOpacity={0.8}
      >
        <MaterialIcons name="add" size={28} color="#FFF" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
  },
  greetingBox: {
    marginLeft: 12,
    flex: 1,
  },
  greetingTitle: {
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 3,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 20,
    marginBottom: 12,
  },
  sectionLink: {
    fontSize: 12,
    fontWeight: "700",
  },

  // BENTO LAYOUT STYLE
  bentoContainer: {
    gap: 12,
  },
  bentoLarge: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 120,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.03,
        shadowRadius: 10,
      },
      android: { elevation: 2 },
    }),
  },
  bentoLargeContent: {
    flex: 1,
    paddingRight: 10,
  },
  bentoLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  bentoValue: {
    fontSize: 18,
    fontWeight: "900",
    marginVertical: 4,
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    marginVertical: 8,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  progressBarText: {
    fontSize: 11,
    fontWeight: "600",
  },
  circleContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  circleProgress: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3.5,
    justifyContent: "center",
    alignItems: "center",
  },
  circlePercent: {
    fontSize: 14,
    fontWeight: "900",
  },
  bentoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  bentoMedium: {
    flex: 1,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    minHeight: 110,
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.03,
        shadowRadius: 10,
      },
      android: { elevation: 2 },
    }),
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  bentoNumber: {
    fontSize: 24,
    fontWeight: "900",
    lineHeight: 28,
  },

  // QUICK LINK GRID
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10,
  },
  quickCard: {
    width: "48%",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.02,
        shadowRadius: 6,
      },
      android: { elevation: 1 },
    }),
  },
  quickIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  quickLabel: {
    fontSize: 13,
    fontWeight: "800",
  },

  // DECK CARD
  deckCard: {
    flexDirection: "row",
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    marginBottom: 12,
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.02,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
  },
  deckThumbnail: {
    width: 54,
    height: 54,
    borderRadius: 12,
    marginRight: 12,
  },
  deckContent: {
    flex: 1,
  },
  deckTitle: {
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 3,
  },
  deckSub: {
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 6,
  },
  deckProgressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  deckProgressBarBg: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  deckProgressBarFill: {
    height: "100%",
    borderRadius: 2,
  },
  deckPercent: {
    fontSize: 10,
    fontWeight: "700",
    width: 28,
    textAlign: "right",
  },

  // FAB
  fab: {
    position: "absolute",
    right: 16,
    bottom: 16,
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#dfb15b",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      android: { elevation: 5 },
    }),
  },
  
  // QUESTS
  questsList: {
    gap: 8,
    marginBottom: 10,
  },
  questItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  questLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  questInfo: {
    flex: 1,
  },
  questJpLabel: {
    fontSize: 12.5,
    fontWeight: "800",
  },
  questLabel: {
    fontSize: 10.5,
    fontWeight: "600",
    marginTop: 1.5,
  },
  questReward: {
    fontSize: 11,
    fontWeight: "900",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
});