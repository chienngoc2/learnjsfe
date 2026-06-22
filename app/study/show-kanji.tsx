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
  Image,
  Alert,
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

// Hình ảnh Nhật Bản cho từng card bài học
const JAP_IMAGES = [
  "https://images.unsplash.com/photo-1542051841857-5f90071e7989?q=80&w=200", // Tokyo
  "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=200", // Kyoto
  "https://images.unsplash.com/photo-1528164344705-47542687000d?q=80&w=200", // Sakura
  "https://images.unsplash.com/photo-1490730141103-6cac27aaab94?q=80&w=200", // Sunset Mt Fuji
  "https://images.unsplash.com/photo-1504109586057-7a2ae4fdd853?q=80&w=200", // Temple
  "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?q=80&w=200", // Pagoda
];

function SkeletonCard({ colors }: { colors: any }) {
  return (
    <View style={[styles.deckCard, { backgroundColor: colors.surface, borderColor: colors.border, opacity: 0.6, marginHorizontal: 20 }]}>
      <View style={styles.cardHeaderArea}>
        <View style={[styles.deckThumbnail, { backgroundColor: colors.border }]} />
        <View style={styles.deckContent}>
          <View style={{ height: 16, width: "60%", backgroundColor: colors.border, borderRadius: 4, marginBottom: 8 }} />
          <View style={{ height: 12, width: "40%", backgroundColor: colors.border, borderRadius: 4, marginBottom: 8 }} />
          <View style={{ height: 5, backgroundColor: colors.border, borderRadius: 2.5 }} />
        </View>
      </View>
    </View>
  );
}

const PAGE_SIZE = 10;

export default function ShowKanjiScreen() {
  const { colors, isDark } = useTheme();
  const router = useRouter();

  const [groups, setGroups] = useState<KanjiGroup[]>([]);
  const [unnamedCount, setUnnamedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

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

  const fetchGroups = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setVisibleCount(PAGE_SIZE);
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

  const executeDeleteGroup = async (groupName: string, displayTitle: string) => {
    try {
      const res = await api.delete("/api/kanji/group", {
        params: { group: groupName },
      });
      if (res.data.success) {
        triggerToast("success", `🗑️ Đã xóa bài học "${displayTitle}" thành công!`);
        fetchGroups();
      } else {
        triggerToast("error", res.data.message || "Xóa thất bại.");
      }
    } catch (err: any) {
      triggerToast("error", "Lỗi kết nối khi xóa bài học!");
    }
  };

  const handleDeleteGroup = (groupName: string, displayTitle = groupName) => {
    if (Platform.OS === "web") {
      const confirmed = window.confirm(
        `Sếp có chắc chắn muốn xóa bài học Kanji "${displayTitle}" này không? (Hành động này sẽ xóa tất cả Kanji thuộc bài học)`
      );
      if (confirmed) {
        executeDeleteGroup(groupName, displayTitle);
      }
    } else {
      Alert.alert(
        "Xác nhận xóa",
        `Sếp có chắc chắn muốn xóa bài học Kanji "${displayTitle}" này không?\n(Hành động này sẽ xóa tất cả Kanji thuộc bài học)`,
        [
          { text: "Hủy", style: "cancel" },
          {
            text: "Xóa sạch",
            style: "destructive",
            onPress: () => executeDeleteGroup(groupName, displayTitle),
          },
        ]
      );
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

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

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Header title="📖 Học Kanji" />
        <ScrollView style={{ flex: 1, paddingTop: 20 }} showsVerticalScrollIndicator={false}>
          <SkeletonCard colors={colors} />
          <SkeletonCard colors={colors} />
          <SkeletonCard colors={colors} />
          <SkeletonCard colors={colors} />
        </ScrollView>
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
        contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchGroups(true)}
            tintColor={colors.indigo}
          />
        }
      >
        {/* HEADER THỐNG KÊ (Redesigned like the mockup progress layout) */}
        <View style={[styles.statsRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: colors.indigo }]}>{groups.length}</Text>
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
          📚 Danh sách bài học của tôi
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
              style={[styles.emptyBtn, { backgroundColor: colors.indigo }]}
              onPress={() => router.push("/study/add-kanji" as any)}
            >
              <MaterialIcons name="add" size={18} color="#FFF" />
              <Text style={styles.emptyBtnText}>Thêm Kanji ngay</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {groups.slice(0, visibleCount).map((group, idx) => {
              const thumbnail = JAP_IMAGES[idx % JAP_IMAGES.length];
              const progressPercentage = Math.min(100, Math.round((6 / (group.count || 6)) * 100)) || 50; // Mock progress based on counts

              return (
                <TouchableOpacity
                  key={group.name}
                  style={[
                    styles.deckCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                  onPress={() => openLesson(group.name)}
                  activeOpacity={0.8}
                >
                  <View style={styles.cardHeaderArea}>
                    {/* THUMBNAIL */}
                    <Image source={{ uri: thumbnail }} style={styles.deckThumbnail} />

                    {/* CARD INFO (Redesigned matching mockup) */}
                    <View style={styles.deckContent}>
                      <View style={styles.deckTopRow}>
                        <Text style={[styles.deckTitle, { color: colors.text }]} numberOfLines={1}>
                          {group.name}
                        </Text>
                        <View style={styles.badgeContainer}>
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

                      <Text style={[styles.deckSub, { color: colors.textMuted }]}>
                        • {group.count} chữ Kanji
                      </Text>

                      {/* Progress bar matching mockup */}
                      <View style={styles.deckProgressRow}>
                        <View style={[styles.deckProgressBarBg, { backgroundColor: colors.border }]}>
                          <View
                            style={[
                              styles.deckProgressBarFill,
                              { backgroundColor: colors.indigo, width: `${progressPercentage}%` },
                            ]}
                          />
                        </View>
                        <Text style={[styles.deckPercent, { color: colors.textMuted }]}>
                          {progressPercentage}%
                        </Text>
                      </View>
                    </View>

                    {/* ACTION ROW (DELETE + CHEVRON) */}
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <TouchableOpacity
                        style={[styles.deleteBtn, { backgroundColor: isDark ? "#451A1A" : "#FEF2F2" }]}
                        onPress={() => handleDeleteGroup(group.name)}
                      >
                        <MaterialIcons name="delete-outline" size={20} color={isDark ? "#F87171" : "#EF4444"} />
                      </TouchableOpacity>
                      <MaterialIcons name="chevron-right" size={24} color={colors.textMuted} />
                    </View>
                  </View>

                  {/* PREVIEW MINI CHARACTERS DISPLAY */}
                  <View style={styles.previewRow}>
                    {group.previewChars.map((char, ci) => (
                      <View
                        key={ci}
                        style={[
                          styles.previewChar,
                          {
                            backgroundColor: colors.background,
                            borderColor: colors.border,
                          },
                        ]}
                      >
                        <Text style={[styles.previewCharText, { color: colors.text }]}>{char}</Text>
                      </View>
                    ))}
                    {group.count > 6 && (
                      <View
                        style={[
                          styles.previewChar,
                          { backgroundColor: isDark ? "#334155" : "#F1F5F9", borderColor: colors.border },
                        ]}
                      >
                        <Text style={[styles.previewCharText, { color: colors.textMuted, fontSize: 11 }]}>
                          +{group.count - 6}
                        </Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}

            {/* XEM THÊM BUTTON */}
            {visibleCount < groups.length && (
              <TouchableOpacity
                style={[
                  styles.loadMoreBtn,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
                onPress={() => setVisibleCount((c) => c + PAGE_SIZE)}
                activeOpacity={0.75}
              >
                <Text style={[styles.loadMoreText, { color: colors.indigo }]}>
                  Xem thêm ({groups.length - visibleCount} bài học còn lại)
                </Text>
                <MaterialIcons name="keyboard-arrow-down" size={20} color={colors.indigo} />
              </TouchableOpacity>
            )}

            {/* BÀI HỌC CHƯA XẾP NHÓM */}
            {unnamedCount > 0 && (
              <TouchableOpacity
                style={[
                  styles.deckCard,
                  styles.unnamedCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
                onPress={openUnnamed}
                activeOpacity={0.8}
              >
                <View style={styles.cardHeaderArea}>
                  <View style={[styles.unnamedIconBox, { backgroundColor: isDark ? "#1E293B" : "#F1F5F9" }]}>
                    <MaterialIcons name="folder-open" size={28} color={colors.textMuted} />
                  </View>
                  <View style={styles.deckContent}>
                    <Text style={[styles.deckTitle, { color: colors.text }]}>
                      Chưa phân loại
                    </Text>
                    <Text style={[styles.deckSub, { color: colors.textMuted }]}>
                      {unnamedCount} chữ Kanji chưa có tên bài học
                    </Text>
                  </View>
                  {/* ACTION ROW (DELETE + CHEVRON) */}
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <TouchableOpacity
                      style={[styles.deleteBtn, { backgroundColor: isDark ? "#451A1A" : "#FEF2F2" }]}
                      onPress={() => handleDeleteGroup("__unnamed__", "Chưa phân loại")}
                    >
                      <MaterialIcons name="delete-outline" size={20} color={isDark ? "#F87171" : "#EF4444"} />
                    </TouchableOpacity>
                    <MaterialIcons name="chevron-right" size={24} color={colors.textMuted} />
                  </View>
                </View>
              </TouchableOpacity>
            )}
          </>
        )}

        {/* TIP BOX */}
        {groups.length > 0 && (
          <View style={[styles.tipBox, { backgroundColor: isDark ? "#1E293B" : "#F8FAFC", borderColor: isDark ? "#334155" : "#E2E8F0" }]}>
            <MaterialIcons name="lightbulb-outline" size={16} color={colors.indigo} style={{ marginRight: 8 }} />
            <Text style={[styles.tipText, { color: colors.textMuted }]}>
              💡 Kéo xuống để làm mới. Chọn bài học để bắt đầu học flashcard.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* ================= FLOATING ACTION BUTTON (FAB) ================= */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.indigo }]}
        onPress={() => router.push('/study/add-kanji')}
        activeOpacity={0.8}
      >
        <MaterialIcons name="add" size={28} color="#FFF" />
      </TouchableOpacity>
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
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    marginHorizontal: 20,
    marginTop: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  statItem: { flex: 1, alignItems: "center" },
  statNumber: { fontSize: 24, fontWeight: "900", letterSpacing: -0.5 },
  statLabel: { fontSize: 11, fontWeight: "600", marginTop: 2 },
  statDivider: { width: 1, marginHorizontal: 8 },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 14,
    paddingHorizontal: 20,
    letterSpacing: -0.3,
  },

  // DECK CARD REDESIGN
  deckCard: {
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    marginBottom: 14,
    marginHorizontal: 20,
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
  cardHeaderArea: {
    flexDirection: "row",
    alignItems: "center",
  },
  unnamedCard: { opacity: 0.8 },
  unnamedIconBox: {
    width: 68,
    height: 68,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  deckThumbnail: {
    width: 68,
    height: 68,
    borderRadius: 14,
    marginRight: 14,
  },
  deckContent: {
    flex: 1,
  },
  deckTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  deckTitle: {
    fontSize: 14,
    fontWeight: "800",
    flex: 1,
    paddingRight: 6,
  },
  badgeContainer: {
    flexDirection: "row",
  },
  levelBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  levelBadgeText: { fontSize: 9, fontWeight: "900" },
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
    height: 5,
    borderRadius: 2.5,
    overflow: "hidden",
  },
  deckProgressBarFill: {
    height: "100%",
    borderRadius: 2.5,
  },
  deckPercent: {
    fontSize: 10,
    fontWeight: "800",
    width: 30,
    textAlign: "right",
  },

  // PREVIEW MINI CHARACTERS BELOW
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(0, 0, 0, 0.05)",
  },
  previewChar: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  previewCharText: { fontSize: 14, fontWeight: "700" },

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
    marginHorizontal: 20,
  },
  tipText: { flex: 1, fontSize: 12, lineHeight: 18 },

  // FAB
  fab: {
    position: "absolute",
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#4F46E5",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
      },
      android: { elevation: 6 },
    }),
  },
  deleteBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  loadMoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginHorizontal: 20,
    marginBottom: 16,
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
