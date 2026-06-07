import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Animated,
  Platform,
  RefreshControl,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import api from "../../services/api";
import Toast from "../../components/ui/Toast";
import Header from "../../components/ui/Header";
import { useTheme } from "@/src/context/ThemeContext";

// ============================================================
// INTERFACES
// ============================================================
interface KanjiGroup {
  name: string;
  count: number;
  levels: string[];
  previewChars: string[];
}

// Màu sắc cho từng level badge
const LEVEL_COLORS: Record<string, { bg: string; bgDark: string; text: string; textDark: string }> = {
  N5: { bg: "#DCFCE7", bgDark: "#14532D", text: "#15803D", textDark: "#86EFAC" },
  N4: { bg: "#DBEAFE", bgDark: "#1E3A5F", text: "#1D4ED8", textDark: "#93C5FD" },
  N3: { bg: "#FEF3C7", bgDark: "#2D1A10", text: "#D97706", textDark: "#FBBF24" },
  N2: { bg: "#F5F3FF", bgDark: "#2E1A5E", text: "#7C3AED", textDark: "#C4B5FD" },
  N1: { bg: "#FFF0F0", bgDark: "#3A1C1C", text: "#DC2626", textDark: "#F87171" },
};

// Màu gradient cho từng card bài học (tuần hoàn)
const CARD_ACCENTS = [
  "#F59E0B", "#3B82F6", "#10B981", "#8B5CF6",
  "#EC4899", "#EF4444", "#06B6D4", "#84CC16",
];

// ============================================================
// COMPONENT CHÍNH: DANH SÁCH BÀI HỌC KANJI
// ============================================================
export default function ShowKanjiScreen() {
  const { colors, isDark } = useTheme();
  const router = useRouter();

  const [groups, setGroups] = useState<KanjiGroup[]>([]);
  const [unnamedCount, setUnnamedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // TOAST
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const slideAnim = useRef(new Animated.Value(-100)).current;

  const triggerToast = (type: "success" | "error", text: string) => {
    setToast({ type, text });
    Animated.timing(slideAnim, { toValue: 40, duration: 400, useNativeDriver: true }).start();
    setTimeout(() => {
      Animated.timing(slideAnim, { toValue: -100, duration: 400, useNativeDriver: true })
        .start(() => setToast(null));
    }, 3500);
  };

  // ============================================================
  // FETCH GROUPS
  // ============================================================
  const fetchGroups = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await api.get("/api/kanji/groups");
      if (res.data.success) {
        setGroups(res.data.data);
        setUnnamedCount(res.data.unnamedCount || 0);
      }
    } catch {
      triggerToast("error", "Lỗi kết nối server!");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  // ============================================================
  // NAVIGATE ĐẾN TRANG CHI TIẾT BÀI HỌC
  // ============================================================
  const openLesson = (groupName: string) => {
    router.push({
      pathname: "/study/kanji-lesson",
      params: { group: groupName },
    } as any);
  };

  const openUnnamed = () => {
    router.push({
      pathname: "/study/kanji-lesson",
      params: { group: "__unnamed__" },
    } as any);
  };

  // ============================================================
  // RENDER
  // ============================================================
  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Header title="📖 Học Kanji" />
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={colors.amber} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>
            Đang tải danh sách bài học...
          </Text>
        </View>
      </View>
    );
  }

  const totalKanji = groups.reduce((s, g) => s + g.count, 0) + unnamedCount;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <Toast toast={toast} slideAnim={slideAnim} />
      <Header title="📖 Học Kanji" />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchGroups(true)}
            tintColor={colors.amber}
          />
        }
      >
        {/* HEADER THỐNG KÊ */}
        <View style={[styles.statsRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: colors.amber }]}>{groups.length}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Bài học</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: isDark ? "#60A5FA" : "#3B82F6" }]}>
              {totalKanji}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Tổng Kanji</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: isDark ? "#34D399" : "#10B981" }]}>
              {[...new Set(groups.flatMap((g) => g.levels))].length}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Cấp độ</Text>
          </View>
        </View>

        {/* TIÊU ĐỀ SECTION */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          📚 Danh sách bài học
        </Text>

        {/* DANH SÁCH CÁC BÀI HỌC */}
        {groups.length === 0 && unnamedCount === 0 ? (
          <View style={styles.emptyBox}>
            <MaterialIcons name="inbox" size={56} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              Chưa có bài học nào
            </Text>
            <Text style={[styles.emptyDesc, { color: colors.textMuted }]}>
              Hãy thêm Kanji và gán tên bài học{"\n"}qua trang "Thêm Kanji"!
            </Text>
            <TouchableOpacity
              style={[styles.emptyBtn, { backgroundColor: colors.amber }]}
              onPress={() => router.push("/study/add-kanji" as any)}
            >
              <MaterialIcons name="add" size={18} color="#FFF" />
              <Text style={styles.emptyBtnText}>Thêm Kanji ngay</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {groups.map((group, idx) => {
              const accent = CARD_ACCENTS[idx % CARD_ACCENTS.length];
              return (
                <TouchableOpacity
                  key={group.name}
                  style={[
                    styles.lessonCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      borderLeftColor: accent,
                    },
                  ]}
                  onPress={() => openLesson(group.name)}
                  activeOpacity={0.8}
                >
                  {/* TOP ROW */}
                  <View style={styles.cardTop}>
                    {/* ICON BÀI HỌC */}
                    <View style={[styles.cardIconBox, { backgroundColor: accent + "18" }]}>
                      <MaterialIcons name="menu-book" size={26} color={accent} />
                    </View>

                    {/* TEN BÀI HỌC + LEVEL BADGES */}
                    <View style={styles.cardInfo}>
                      <Text
                        style={[styles.cardTitle, { color: colors.text }]}
                        numberOfLines={2}
                      >
                        {group.name}
                      </Text>
                      <View style={styles.levelBadgeRow}>
                        {group.levels.map((lv) => {
                          const lc = LEVEL_COLORS[lv] || LEVEL_COLORS["N5"];
                          return (
                            <View
                              key={lv}
                              style={[
                                styles.levelBadge,
                                { backgroundColor: isDark ? lc.bgDark : lc.bg },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.levelBadgeText,
                                  { color: isDark ? lc.textDark : lc.text },
                                ]}
                              >
                                {lv}
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    </View>

                    {/* ARROW */}
                    <MaterialIcons name="chevron-right" size={24} color={colors.textMuted} />
                  </View>

                  {/* PREVIEW KANJI CHARACTERS */}
                  <View style={styles.previewRow}>
                    {group.previewChars.map((char, ci) => (
                      <View
                        key={ci}
                        style={[
                          styles.previewChar,
                          {
                            backgroundColor: accent + "12",
                            borderColor: accent + "40",
                          },
                        ]}
                      >
                        <Text style={[styles.previewCharText, { color: accent }]}>{char}</Text>
                      </View>
                    ))}
                    {group.count > 6 && (
                      <View
                        style={[
                          styles.previewChar,
                          { backgroundColor: isDark ? "#334155" : "#F1F5F9", borderColor: colors.border },
                        ]}
                      >
                        <Text style={[styles.previewCharText, { color: colors.textMuted }]}>
                          +{group.count - 6}
                        </Text>
                      </View>
                    )}

                    {/* COUNT BÊN PHẢI */}
                    <View style={{ flex: 1, alignItems: "flex-end" }}>
                      <Text style={[styles.cardCount, { color: accent }]}>
                        {group.count} chữ
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}

            {/* BÀI HỌC CHƯA XẾP NHÓM */}
            {unnamedCount > 0 && (
              <TouchableOpacity
                style={[
                  styles.lessonCard,
                  styles.unnamedCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderLeftColor: isDark ? "#64748B" : "#94A3B8",
                  },
                ]}
                onPress={openUnnamed}
                activeOpacity={0.8}
              >
                <View style={styles.cardTop}>
                  <View style={[styles.cardIconBox, { backgroundColor: isDark ? "#1E293B" : "#F1F5F9" }]}>
                    <MaterialIcons name="folder-open" size={26} color={isDark ? "#64748B" : "#94A3B8"} />
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={[styles.cardTitle, { color: colors.textMuted }]}>
                      Chưa phân loại
                    </Text>
                    <Text style={[styles.cardSubtitle, { color: colors.textMuted }]}>
                      {unnamedCount} Kanji chưa có tên bài học
                    </Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={24} color={colors.textMuted} />
                </View>
              </TouchableOpacity>
            )}
          </>
        )}

        {/* TIP BOX */}
        {groups.length > 0 && (
          <View style={[styles.tipBox, { backgroundColor: isDark ? "#1E293B" : "#F8FAFC", borderColor: isDark ? "#334155" : "#E2E8F0" }]}>
            <MaterialIcons name="lightbulb-outline" size={16} color={colors.amber} style={{ marginRight: 8 }} />
            <Text style={[styles.tipText, { color: colors.textMuted }]}>
              💡 Kéo xuống để làm mới. Bấm vào bài học để học từng Kanji.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
  container: { flex: 1 },
  centerBox: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { marginTop: 12, fontSize: 14, fontWeight: "500" },

  statsRow: {
    flexDirection: "row",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  statItem: { flex: 1, alignItems: "center" },
  statNumber: { fontSize: 26, fontWeight: "900", letterSpacing: -0.5 },
  statLabel: { fontSize: 12, fontWeight: "600", marginTop: 2 },
  statDivider: { width: 1, marginHorizontal: 8 },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 14,
    letterSpacing: -0.3,
  },

  // LESSON CARD
  lessonCard: {
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderLeftWidth: 5,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  unnamedCard: { opacity: 0.8 },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  cardIconBox: {
    width: 50,
    height: 50,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  cardInfo: { flex: 1, paddingRight: 8 },
  cardTitle: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.2,
    marginBottom: 6,
  },
  cardSubtitle: { fontSize: 13, fontWeight: "500" },
  levelBadgeRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  levelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  levelBadgeText: { fontSize: 11, fontWeight: "800" },

  // PREVIEW CHARS
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  previewChar: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  previewCharText: { fontSize: 16, fontWeight: "700" },
  cardCount: { fontSize: 13, fontWeight: "800" },

  // EMPTY STATE
  emptyBox: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyTitle: { fontSize: 18, fontWeight: "800", marginTop: 16, marginBottom: 8 },
  emptyDesc: { fontSize: 14, textAlign: "center", lineHeight: 22, marginBottom: 24 },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 13,
    borderRadius: 14,
    gap: 8,
  },
  emptyBtnText: { color: "#FFF", fontSize: 15, fontWeight: "800" },

  // TIP BOX
  tipBox: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
  },
  tipText: { flex: 1, fontSize: 12, lineHeight: 18 },
});
