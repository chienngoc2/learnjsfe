import React, { useState, useEffect, useRef } from "react";
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
  StatusBar,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter, Stack } from "expo-router";
import api from "../../services/api";
import { useTheme } from "@/src/context/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInRight,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  interpolate,
} from "react-native-reanimated";
import { useCultivationStore } from "../../store/useCultivationStore";
import { LinearGradient } from "expo-linear-gradient";

const { width } = Dimensions.get("window");

// Quick action data
const QUICK_ACTIONS = [
  { id: "flashcard", label: "Flashcard", icon: "style", route: "/study/flashcard" },
  { id: "vocab", label: "Thêm từ", icon: "post-add", route: "/study/add-vocab" },
  { id: "game", label: "Luyện tập", icon: "extension", route: "/luyen-tap/grammar" },
  { id: "stats", label: "Thống kê", icon: "bar-chart", route: "/profile" },
];

const JAP_IMAGES = [
  "https://images.unsplash.com/photo-1542051841857-5f90071e7989?q=80&w=300",
  "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=300",
  "https://images.unsplash.com/photo-1528164344705-47542687000d?q=80&w=300",
  "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?q=80&w=300",
];

export default function DashboardScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);

  const {
    level, stage, tuVi,
    dailyQuests, currentTitle,
    streak: cultivationStreak,
    setStreak: setStoreStreak,
    completeQuestDirectly,
  } = useCultivationStore();

  const [username, setUsername] = useState("Sếp");
  const [vocabCount, setVocabCount] = useState(0);
  const [kanjiCount, setKanjiCount] = useState(0);
  const [grammarCount, setGrammarCount] = useState(0);
  const [serverOnline, setServerOnline] = useState(true);
  const [recentDecks, setRecentDecks] = useState<any[]>([]);

  const maxTuVi = level * 100 + 500;
  const tuViPercent = Math.min(100, Math.round((tuVi / maxTuVi) * 100));
  const targetCards = 300;
  const completionPercent = Math.min(100, Math.round((vocabCount / targetCards) * 100)) || 0;

  // Pulse animation for status dot
  const pulseValue = useSharedValue(1);
  useEffect(() => {
    pulseValue.value = withRepeat(
      withSequence(
        withTiming(0.4, { duration: 1000 }),
        withTiming(1, { duration: 1000 })
      ),
      -1, true
    );
  }, []);
  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulseValue.value,
    transform: [{ scale: interpolate(pulseValue.value, [0.4, 1], [0.85, 1.05]) }],
  }));

  useEffect(() => { fetchDashboardData(); }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) { router.replace("/login" as any); return; }

      const userStr = await AsyncStorage.getItem("user");
      if (userStr) {
        try {
          const userObj = JSON.parse(userStr);
          if (userObj?.username) setUsername(userObj.username);
        } catch (e) {}
      }

      // Streak
      const lastLogin = await AsyncStorage.getItem("last_login");
      const currentStreak = await AsyncStorage.getItem("streak_count");
      const today = new Date().toDateString();
      if (lastLogin === today) {
        setStoreStreak(Number(currentStreak) || 0);
      } else {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        let newStreak = 1;
        if (lastLogin === yesterday.toDateString()) newStreak = (Number(currentStreak) || 0) + 1;
        await AsyncStorage.setItem("last_login", today);
        await AsyncStorage.setItem("streak_count", newStreak.toString());
        setStoreStreak(newStreak);
      }

      // Stats
      try {
        const vocabRes = await api.get("/api/vocab/lists");
        const list = vocabRes.data.data || vocabRes.data || [];
        setVocabCount(list.reduce((acc: number, item: any) => acc + (item.words?.length || 0), 0));
        // Lấy 2 deck gần nhất
        setRecentDecks(list.slice(0, 2));
      } catch {}

      try {
        const kanjiRes = await api.get("/api/kanji/groups");
        const list = kanjiRes.data.data || kanjiRes.data;
        setKanjiCount(list.reduce((acc: number, g: any) => acc + (g.count || 0), 0));
      } catch {}

      try {
        const grammarRes = await api.get("/api/vocab/all-grammar-points");
        const list = grammarRes.data.data || grammarRes.data || [];
        setGrammarCount(list.length);
      } catch {}

      setServerOnline(true);
    } catch {
      setServerOnline(false);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem("token");
    await AsyncStorage.removeItem("user");
    router.replace("/login" as any);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background }}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={colors.indigo} />
      </View>
    );
  }

  const accentColor = isDark ? colors.indigo : "#4F46E5";

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* ─── HEADER ─── */}
        <Animated.View
          entering={FadeInDown.delay(0).duration(500)}
          style={[
            styles.header,
            { paddingTop: insets.top > 0 ? insets.top + 8 : (Platform.OS === "android" ? 48 : 20) }
          ]}
        >
          <View style={styles.headerLeft}>
            <View style={[styles.avatarWrap, { borderColor: accentColor + "40" }]}>
              <Image
                source={{ uri: "https://api.dicebear.com/7.x/avataaars/svg?seed=" + username }}
                style={styles.avatar}
              />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.greetText, { color: colors.textMuted }]}>
                Xin chào, {currentTitle ? `【${currentTitle}】` : ""}
              </Text>
              <Text style={[styles.greetName, { color: colors.text }]}>
                {username} 👋
              </Text>
              <View style={styles.statusRow}>
                <Animated.View style={[styles.statusDot, { backgroundColor: serverOnline ? "#10B981" : colors.error }, pulseStyle]} />
                <Text style={[styles.statusText, { color: colors.textMuted }]}>
                  {serverOnline ? "Đã kết nối" : "Mất kết nối"}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity
              style={[styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={fetchDashboardData} activeOpacity={0.7}
            >
              <MaterialIcons name="refresh" size={20} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={handleLogout} activeOpacity={0.7}
            >
              <MaterialIcons name="logout" size={18} color={colors.error} />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* ─── PROGRESS CARD (gradient indigo như concept) ─── */}
        <Animated.View entering={FadeInDown.delay(80).duration(550)} style={{ marginHorizontal: 16, marginBottom: 20 }}>
          <LinearGradient
            colors={isDark ? ["#3730A3", "#1E1B4B"] : ["#4F46E5", "#6366F1"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.progressCard}
          >
            {/* Decorative circle */}
            <View style={styles.decorCircleLg} />
            <View style={styles.decorCircleSm} />

            <View style={{ flex: 1, zIndex: 1 }}>
              <Text style={styles.progressLabel}>Tiến độ hôm nay</Text>
              <Text style={styles.progressPercent}>{tuViPercent}%</Text>
              <Text style={styles.progressSub}>
                Mục tiêu: {tuVi} / {maxTuVi} Linh Khí
              </Text>

              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${tuViPercent}%` }]} />
              </View>

              <Text style={styles.progressStage}>
                {stage} · Cấp {level}
              </Text>
            </View>

            {/* Circle timer (như concept) */}
            <View style={styles.circleTimer}>
              <Text style={styles.circleTimerNum}>{cultivationStreak}</Text>
              <Text style={styles.circleTimerLabel}>ngày{"\n"}liên tục</Text>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* ─── QUICK ACTIONS (4 icon pill) ─── */}
        <Animated.View entering={FadeInDown.delay(150).duration(500)}>
          <View style={[styles.quickRow, { marginHorizontal: 16 }]}>
            {QUICK_ACTIONS.map((action, i) => (
              <TouchableOpacity
                key={action.id}
                onPress={() => router.push(action.route as any)}
                activeOpacity={0.75}
                style={styles.quickItem}
              >
                <View style={[styles.quickIconWrap, {
                  backgroundColor: isDark ? colors.surface : "#FFFFFF",
                  borderColor: colors.border,
                  shadowColor: accentColor,
                }]}>
                  <MaterialIcons name={action.icon as any} size={24} color={accentColor} />
                </View>
                <Text style={[styles.quickLabel, { color: colors.textMuted }]}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>

        {/* ─── STATS BENTO GRID ─── */}
        <Animated.View entering={FadeInDown.delay(220).duration(500)} style={{ marginHorizontal: 16, marginBottom: 20 }}>
          <View style={styles.sectionRow}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Thống kê tổng quan</Text>
          </View>

          <View style={styles.bentoGrid}>
            {/* Vocab */}
            <View style={[styles.bentoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.bentoIcon, { backgroundColor: colors.blueLight }]}>
                <MaterialIcons name="style" size={20} color={colors.blue} />
              </View>
              <Text style={[styles.bentoNum, { color: colors.text }]}>{vocabCount}</Text>
              <Text style={[styles.bentoLabel, { color: colors.textMuted }]}>Từ vựng</Text>
              <Text style={[styles.bentoTrend, { color: colors.emerald }]}>+{completionPercent}%</Text>
            </View>

            {/* Kanji */}
            <View style={[styles.bentoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.bentoIcon, { backgroundColor: colors.amberLight }]}>
                <MaterialIcons name="font-download" size={20} color={colors.amber} />
              </View>
              <Text style={[styles.bentoNum, { color: colors.text }]}>{kanjiCount}</Text>
              <Text style={[styles.bentoLabel, { color: colors.textMuted }]}>Kanji</Text>
              <Text style={[styles.bentoTrend, { color: colors.emerald }]}>JLPT</Text>
            </View>

            {/* Grammar */}
            <View style={[styles.bentoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.bentoIcon, { backgroundColor: colors.purpleLight }]}>
                <MaterialIcons name="menu-book" size={20} color={colors.purple} />
              </View>
              <Text style={[styles.bentoNum, { color: colors.text }]}>{grammarCount}</Text>
              <Text style={[styles.bentoLabel, { color: colors.textMuted }]}>Ngữ pháp</Text>
              <Text style={[styles.bentoTrend, { color: colors.emerald }]}>N5-N1</Text>
            </View>

            {/* Streak */}
            <View style={[styles.bentoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.bentoIcon, { backgroundColor: isDark ? "#1C1508" : "#FEF3C7" }]}>
                <MaterialIcons name="local-fire-department" size={20} color={colors.amber} />
              </View>
              <Text style={[styles.bentoNum, { color: colors.text }]}>{cultivationStreak}</Text>
              <Text style={[styles.bentoLabel, { color: colors.textMuted }]}>Streak</Text>
              <Text style={[styles.bentoTrend, { color: colors.amber }]}>ngày</Text>
            </View>
          </View>
        </Animated.View>

        {/* ─── TIẾP TỤC HỌC (Deck list) ─── */}
        <Animated.View entering={FadeInDown.delay(290).duration(500)} style={{ marginHorizontal: 16, marginBottom: 20 }}>
          <View style={styles.sectionRow}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Tiếp tục học</Text>
            <TouchableOpacity onPress={() => router.push("/study/flashcard" as any)} activeOpacity={0.7}>
              <View style={styles.seeAllBtn}>
                <Text style={[styles.seeAllText, { color: accentColor }]}>Xem tất cả</Text>
                <MaterialIcons name="chevron-right" size={16} color={accentColor} />
              </View>
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -4 }}>
            {(recentDecks.length > 0 ? recentDecks : [
              { _id: "1", title: "Từ vựng N5 cốt lõi", words: [], __img: JAP_IMAGES[0] },
              { _id: "2", title: "Hán tự bài học", words: [], __img: JAP_IMAGES[1] },
            ]).map((deck, idx) => {
              const cardPercent = Math.min(100, Math.round(((deck.words?.length || 0) / 200) * 100)) || Math.round(30 + idx * 25);
              return (
                <TouchableOpacity
                  key={deck._id}
                  onPress={() => router.push({ pathname: "/study/card-viewer", params: { topicId: deck._id, title: deck.title } } as any)}
                  activeOpacity={0.8}
                  style={[styles.deckCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <Image
                    source={{ uri: deck.__img || JAP_IMAGES[idx % JAP_IMAGES.length] }}
                    style={styles.deckImg}
                  />
                  <View style={styles.deckInfo}>
                    <Text style={[styles.deckTitle, { color: colors.text }]} numberOfLines={1}>
                      {deck.title}
                    </Text>
                    <Text style={[styles.deckSub, { color: colors.textMuted }]}>
                      {deck.words?.length || 0} từ · {cardPercent}%
                    </Text>
                    <View style={[styles.deckBarBg, { backgroundColor: colors.border }]}>
                      <View style={[styles.deckBarFill, { backgroundColor: accentColor, width: `${cardPercent}%` }]} />
                    </View>
                  </View>
                  <View style={[styles.deckPlayBtn, { backgroundColor: accentColor + "18" }]}>
                    <MaterialIcons name="play-arrow" size={20} color={accentColor} />
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </Animated.View>

        {/* ─── NHIỆM VỤ HÀNG NGÀY ─── */}
        <Animated.View entering={FadeInDown.delay(360).duration(500)} style={{ marginHorizontal: 16, marginBottom: 20 }}>
          <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 12 }]}>
            Nhiệm vụ hôm nay
          </Text>

          {dailyQuests.map((quest, i) => (
            <TouchableOpacity
              key={quest.id}
              activeOpacity={0.8}
              onPress={() => { if (!quest.completed) completeQuestDirectly(quest.id); }}
              style={[
                styles.questItem,
                {
                  backgroundColor: colors.surface,
                  borderColor: quest.completed ? (colors.emerald + "30") : colors.border,
                }
              ]}
            >
              <View style={[
                styles.questCheck,
                { backgroundColor: quest.completed ? colors.emerald : colors.border }
              ]}>
                {quest.completed && <MaterialIcons name="check" size={12} color="#FFF" />}
              </View>

              <View style={{ flex: 1, marginHorizontal: 12 }}>
                <Text style={[styles.questTitle, { color: colors.text }]}>{quest.jpLabel}</Text>
                <Text style={[styles.questSub, { color: colors.textMuted }]}>
                  {quest.label} ({quest.current}/{quest.target})
                </Text>
              </View>

              <View style={[styles.questRewardBadge, { backgroundColor: quest.completed ? colors.emeraldLight : colors.indigoLight }]}>
                <Text style={[styles.questRewardText, { color: quest.completed ? colors.emerald : accentColor }]}>
                  +{quest.rewardTuVi}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </Animated.View>
      </ScrollView>

      {/* ─── FAB ─── */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: accentColor }]}
        onPress={() => router.push("/study/add-vocab" as any)}
        activeOpacity={0.8}
      >
        <MaterialIcons name="add" size={28} color="#FFF" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  // HEADER
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  avatarWrap: {
    width: 50, height: 50, borderRadius: 25,
    borderWidth: 2, overflow: "hidden",
  },
  avatar: { width: "100%", height: "100%" },
  greetText: { fontSize: 12, fontWeight: "600" },
  greetName: { fontSize: 18, fontWeight: "900", letterSpacing: -0.5, marginTop: 1 },
  statusRow: { flexDirection: "row", alignItems: "center", marginTop: 3 },
  statusDot: { width: 7, height: 7, borderRadius: 3.5, marginRight: 5 },
  statusText: { fontSize: 11, fontWeight: "600" },
  headerRight: { flexDirection: "row", gap: 8 },
  iconBtn: {
    width: 38, height: 38, borderRadius: 19,
    justifyContent: "center", alignItems: "center",
    borderWidth: 1,
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6 },
      android: { elevation: 1 },
    }),
  },

  // PROGRESS CARD
  progressCard: {
    borderRadius: 24, padding: 20,
    flexDirection: "row", alignItems: "center",
    overflow: "hidden",
    minHeight: 140,
    ...Platform.select({
      ios: { shadowColor: "#4F46E5", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16 },
      android: { elevation: 8 },
    }),
  },
  decorCircleLg: {
    position: "absolute", right: -30, top: -30,
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  decorCircleSm: {
    position: "absolute", right: 50, bottom: -40,
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  progressLabel: { fontSize: 11, fontWeight: "700", color: "rgba(255,255,255,0.7)", letterSpacing: 0.5, textTransform: "uppercase" },
  progressPercent: { fontSize: 40, fontWeight: "900", color: "#FFF", letterSpacing: -2, marginTop: 2 },
  progressSub: { fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 2, marginBottom: 10 },
  progressBarBg: { height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.2)", overflow: "hidden" },
  progressBarFill: { height: "100%", borderRadius: 3, backgroundColor: "#FFF" },
  progressStage: { fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 8 },
  circleTimer: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center", alignItems: "center",
    marginLeft: 16, zIndex: 1,
    borderWidth: 2, borderColor: "rgba(255,255,255,0.3)",
  },
  circleTimerNum: { fontSize: 22, fontWeight: "900", color: "#FFF" },
  circleTimerLabel: { fontSize: 9, color: "rgba(255,255,255,0.75)", textAlign: "center", lineHeight: 12, marginTop: 1 },

  // QUICK ACTIONS
  quickRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  quickItem: { alignItems: "center", flex: 1 },
  quickIconWrap: {
    width: 56, height: 56, borderRadius: 18,
    justifyContent: "center", alignItems: "center",
    borderWidth: 1,
    marginBottom: 6,
    ...Platform.select({
      ios: { shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 10 },
      android: { elevation: 3 },
    }),
  },
  quickLabel: { fontSize: 11, fontWeight: "700" },

  // SECTION HEADER
  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: "800", letterSpacing: -0.4 },
  seeAllBtn: { flexDirection: "row", alignItems: "center" },
  seeAllText: { fontSize: 13, fontWeight: "700" },

  // BENTO GRID
  bentoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  bentoCard: {
    width: (width - 42) / 2 - 5,
    borderRadius: 20, padding: 14,
    borderWidth: 1,
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 10 },
      android: { elevation: 2 },
    }),
  },
  bentoIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center", marginBottom: 10 },
  bentoNum: { fontSize: 28, fontWeight: "900", letterSpacing: -1 },
  bentoLabel: { fontSize: 11, fontWeight: "600", marginTop: 2 },
  bentoTrend: { fontSize: 11, fontWeight: "700", marginTop: 4 },

  // DECK CARDS (horizontal scroll)
  deckCard: {
    width: width * 0.72,
    borderRadius: 20, padding: 12,
    marginHorizontal: 4, borderWidth: 1,
    flexDirection: "row", alignItems: "center",
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 10 },
      android: { elevation: 2 },
    }),
  },
  deckImg: { width: 56, height: 56, borderRadius: 14, marginRight: 12 },
  deckInfo: { flex: 1 },
  deckTitle: { fontSize: 14, fontWeight: "800", letterSpacing: -0.3 },
  deckSub: { fontSize: 11, marginTop: 2, marginBottom: 7, fontWeight: "600" },
  deckBarBg: { height: 4, borderRadius: 2, overflow: "hidden" },
  deckBarFill: { height: "100%", borderRadius: 2 },
  deckPlayBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center", marginLeft: 10 },

  // QUEST ITEMS
  questItem: {
    flexDirection: "row", alignItems: "center",
    padding: 14, borderRadius: 16, borderWidth: 1,
    marginBottom: 10,
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 6 },
      android: { elevation: 1 },
    }),
  },
  questCheck: { width: 22, height: 22, borderRadius: 11, justifyContent: "center", alignItems: "center" },
  questTitle: { fontSize: 14, fontWeight: "700" },
  questSub: { fontSize: 11, marginTop: 2, fontWeight: "500" },
  questRewardBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  questRewardText: { fontSize: 12, fontWeight: "800" },

  // FAB
  fab: {
    position: "absolute", right: 20, bottom: 22,
    width: 56, height: 56, borderRadius: 28,
    justifyContent: "center", alignItems: "center",
    ...Platform.select({
      ios: { shadowColor: "#4F46E5", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 14 },
      android: { elevation: 8 },
    }),
  },
});