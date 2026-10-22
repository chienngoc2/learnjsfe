import React, { useState, useCallback } from "react";
import {
  StyleSheet, View, Text, TouchableOpacity,
  FlatList, ActivityIndicator, Alert,
  Platform, Pressable, StatusBar,
} from "react-native";
import { useRouter, useFocusEffect, Stack } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import api from "../../services/api";
import { useTheme } from "@/src/context/ThemeContext";
import { usePriority } from "@/src/context/PriorityContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const PAGE_SIZE = 10;

// Skeleton placeholder for loading
function SkeletonCard({ colors }: { colors: any }) {
  return (
    <View style={[styles.skeletonCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.skeletonIcon, { backgroundColor: colors.border }]} />
      <View style={{ flex: 1, gap: 8 }}>
        <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: "60%" }]} />
        <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: "40%" }]} />
      </View>
    </View>
  );
}

export default function TopicListScreen() {
  const { colors, isDark } = useTheme();
  const { priorityCount, priorityTopics, refreshPriority } = usePriority();
  const [topics, setTopics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      if (topics.length === 0) {
        setLoading(true);
      }
      setVisibleCount(PAGE_SIZE);

      const fetchLists = api.get("/api/vocab/lists");
      refreshPriority();

      fetchLists
        .then((resLists) => {
          if (resLists.data.success && isActive) {
            const sorted = [...resLists.data.data].sort((a, b) => {
              if (a.title === "Cần ôn tập") return -1;
              if (b.title === "Cần ôn tập") return 1;
              return 0;
            });
            setTopics(sorted);
          }
          if (isActive) setLoading(false);
        })
        .catch(() => {
          if (isActive) setLoading(false);
        });
      return () => {
        isActive = false;
      };
    }, [topics.length, refreshPriority])
  );

  const executeDelete = async (topicId: string) => {
    try {
      const res = await api.delete(`/api/vocab/delete/${topicId}`);
      if (res.data.success || res.status === 200) {
        setTopics((prev) => prev.filter((t) => t._id !== topicId));
      }
    } catch { alert("Không thể xóa bài học này."); }
  };

  const handleDelete = (topicId: string, title: string) => {
    if (title === "Cần ôn tập") { alert("Bài ôn tập cốt lõi của hệ thống, sếp không nên xóa nha!"); return; }
    if (Platform.OS === "web") {
      if (window.confirm(`Xóa bài "${title}"?`)) executeDelete(topicId);
    } else {
      Alert.alert("Xác nhận xóa", `Xóa bài "${title}"?`, [
        { text: "Hủy", style: "cancel" },
        { text: "Xóa", style: "destructive", onPress: () => executeDelete(topicId) },
      ]);
    }
  };

  const accentColor = isDark ? colors.indigo : "#4F46E5";

  // Pagination
  const visibleTopics = topics.slice(0, visibleCount);
  const hasMore = visibleCount < topics.length;
  const remaining = topics.length - visibleCount;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* ─── HEADER ─── */}
      <View style={[styles.header, { paddingTop: insets.top > 0 ? insets.top + 4 : (Platform.OS === "android" ? 48 : 16) }]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backBtn,
            { backgroundColor: pressed ? colors.indigoLight : colors.surface, borderColor: colors.border }
          ]}
        >
          {({ pressed }) => (
            <MaterialIcons name="arrow-back-ios" size={20} color={pressed ? accentColor : colors.textMuted} style={{ marginLeft: 5 }} />
          )}
        </Pressable>

        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Tàng Thư Các</Text>
          <Text style={[styles.headerSub, { color: colors.textMuted }]}>
            {topics.length} bài học · {topics.reduce((a, t) => a + (t.words?.length || 0), 0)} từ
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => router.push("/study/add-vocab" as any)}
          style={[styles.addBtn, { backgroundColor: accentColor }]}
        >
          <MaterialIcons name="add" size={22} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* ─── LIST ─── */}
      {loading ? (
        <View style={{ padding: 16, gap: 10 }}>
          {[1, 2, 3, 4, 5].map((i) => <SkeletonCard key={i} colors={colors} />)}
        </View>
      ) : topics.length === 0 ? (
        <View style={styles.emptyBox}>
          <View style={[styles.emptyIconWrap, { backgroundColor: colors.indigoLight }]}>
            <MaterialIcons name="library-books" size={36} color={accentColor} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Chưa có bài học nào</Text>
          <Text style={[styles.emptyDesc, { color: colors.textMuted }]}>Thêm từ vựng để bắt đầu học nhé sếp!</Text>
          <TouchableOpacity
            onPress={() => router.push("/study/add-vocab" as any)}
            style={[styles.emptyBtn, { backgroundColor: accentColor }]}
          >
            <MaterialIcons name="add" size={18} color="#FFF" />
            <Text style={styles.emptyBtnText}>Thêm bài học</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={visibleTopics}
          keyExtractor={(item) => item._id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          ListHeaderComponent={
            <View style={styles.pinnedHeaderContainer}>
              {/* ⭐ PINNED PRIORITY CARD */}
              <View
                style={[
                  styles.priorityPinnedCard,
                  {
                    backgroundColor: isDark ? "#1C1917" : "#FFFBEB",
                    borderColor: isDark ? "#78350F" : "#FDE68A",
                  },
                ]}
              >
                <View style={styles.priorityCardTop}>
                  <View style={[styles.priorityIconBadge, { backgroundColor: isDark ? "#78350F" : "#FEF3C7" }]}>
                    <MaterialIcons name="star" size={24} color="#F59E0B" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={[styles.priorityCardTitle, { color: isDark ? "#FDE68A" : "#92400E" }]}>
                        Ưu Tiên Ôn Tập
                      </Text>
                      <View style={[styles.priorityCountBadge, { backgroundColor: "#F59E0B" }]}>
                        <Text style={styles.priorityCountText}>{priorityCount} từ</Text>
                      </View>
                    </View>
                    <Text style={[styles.priorityCardSub, { color: isDark ? "#D6D3D1" : "#78350F" }]}>
                      {priorityTopics.length > 0
                        ? `Trích từ ${priorityTopics.length} bài học · Tự động ghi nhận khi làm sai`
                        : "Tự động ghi nhận khi làm sai hoặc tích dấu ⭐"}
                    </Text>
                  </View>
                </View>

                {/* 2 Quick action buttons */}
                <View style={styles.priorityActionRow}>
                  <TouchableOpacity
                    style={[
                      styles.btnPriorityAction,
                      {
                        backgroundColor: "#F59E0B",
                        opacity: priorityCount === 0 ? 0.6 : 1,
                      },
                    ]}
                    onPress={() => {
                      if (priorityCount === 0) {
                        alert("Chưa có từ nào trong mục ưu tiên ôn tập. Sếp hãy chơi trắc nghiệm hoặc đánh dấu ⭐ trong flashcard nhé!");
                        return;
                      }
                      router.push({
                        pathname: "/study/card-viewer",
                        params: { mode: "priority", title: "Ưu Tiên Ôn Tập" },
                      });
                    }}
                    activeOpacity={0.8}
                  >
                    <MaterialIcons name="style" size={17} color="#FFFFFF" />
                    <Text style={styles.btnPriorityActionText}>Luyện Flashcard</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.btnPriorityAction,
                      {
                        backgroundColor: isDark ? "#292524" : "#FEF3C7",
                        borderColor: isDark ? "#78350F" : "#F59E0B",
                        borderWidth: 1,
                        opacity: priorityCount === 0 ? 0.6 : 1,
                      },
                    ]}
                    onPress={() => {
                      if (priorityCount === 0) {
                        alert("Chưa có từ nào trong mục ưu tiên ôn tập. Sếp hãy chơi trắc nghiệm hoặc đánh dấu ⭐ trong flashcard nhé!");
                        return;
                      }
                      router.push({
                        pathname: "/luyen-tap/quiz",
                        params: { mode: "priority" },
                      });
                    }}
                    activeOpacity={0.8}
                  >
                    <MaterialIcons name="quiz" size={17} color={isDark ? "#FDE68A" : "#B45309"} />
                    <Text style={[styles.btnPriorityActionText, { color: isDark ? "#FDE68A" : "#B45309" }]}>
                      Trắc nghiệm
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.sectionDividerRow}>
                <Text style={[styles.sectionDividerText, { color: colors.textMuted }]}>
                  DANH SÁCH BÀI HỌC ({topics.length})
                </Text>
              </View>
            </View>
          }
          renderItem={({ item, index }) => {
            const isReview = item.title === "Cần ôn tập";
            const wordCount = item.words?.length || 0;
            return (
              <Animated.View entering={FadeInDown.delay(index * 40).duration(400)}>
                <View
                  style={[
                    styles.topicCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: isReview ? accentColor : colors.border,
                      borderLeftWidth: isReview ? 3.5 : 1,
                      borderLeftColor: isReview ? accentColor : colors.border,
                    }
                  ]}
                >
                  {/* Main tap area */}
                  <TouchableOpacity
                    style={styles.cardMain}
                    onPress={() => router.push({ pathname: "/study/card-viewer", params: { topicId: item._id, title: item.title } })}
                    activeOpacity={0.75}
                  >
                    <View style={[
                      styles.iconCircle,
                      { backgroundColor: isReview ? (isDark ? colors.amberLight : "#FEF3C7") : colors.indigoLight }
                    ]}>
                      <MaterialIcons
                        name={isReview ? "local-fire-department" : "menu-book"}
                        size={22}
                        color={isReview ? colors.amber : accentColor}
                      />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={[styles.topicTitle, { color: isReview ? accentColor : colors.text }]} numberOfLines={1}>
                        {item.title}{isReview ? " ★" : ""}
                      </Text>
                      <Text style={[styles.wordCount, { color: colors.textMuted }]}>
                        {wordCount} từ vựng
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {/* Actions */}
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: isDark ? colors.surfaceAlt : "#F1F5F9" }]}
                      onPress={() => router.push({ pathname: "/luyen-tap/typing", params: { topicId: item._id } })}
                    >
                      <MaterialIcons name="keyboard" size={17} color={accentColor} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: isDark ? "#064E3B" : "#ECFDF5" }]}
                      onPress={() =>
                        router.push({
                          pathname: "/study/kanji-search",
                          params: { topicId: item._id, title: item.title },
                        })
                      }
                    >
                      <MaterialIcons name="draw" size={17} color={colors.emerald} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: isDark ? colors.surfaceAlt : "#F1F5F9" }]}
                      onPress={() => router.push(`/study/grammar-viewer?topicId=${item._id}&title=${encodeURIComponent(item.title)}` as any)}
                    >
                      <MaterialIcons name="collections-bookmark" size={16} color={colors.blue} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: isDark ? colors.surfaceAlt : "#F1F5F9" }]}
                      onPress={() => router.push({ pathname: "/study/add-vocab", params: { editId: item._id } })}
                    >
                      <MaterialIcons name="edit" size={16} color={colors.textMuted} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: isDark ? colors.errorLight : "#FEF2F2" }]}
                      onPress={() => handleDelete(item._id, item.title)}
                    >
                      <MaterialIcons name="delete-outline" size={16} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                </View>
              </Animated.View>
            );
          }}
          ListFooterComponent={
            hasMore ? (
              <Animated.View entering={FadeInDown.delay(100)}>
                <TouchableOpacity
                  onPress={() => setVisibleCount((c) => c + PAGE_SIZE)}
                  style={[styles.loadMoreBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  activeOpacity={0.75}
                >
                  <MaterialIcons name="expand-more" size={20} color={accentColor} />
                  <Text style={[styles.loadMoreText, { color: accentColor }]}>
                    Xem thêm {Math.min(PAGE_SIZE, remaining)} bài ({remaining} còn lại)
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            ) : topics.length > PAGE_SIZE ? (
              <Text style={[styles.allLoadedText, { color: colors.textMuted }]}>
                Đã hiển thị tất cả {topics.length} bài học
              </Text>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // HEADER
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingBottom: 12,
  },
  backBtn: {
    width: 42, height: 42, borderRadius: 21,
    justifyContent: "center", alignItems: "center",
    borderWidth: 1,
  },
  headerTitle: { fontSize: 20, fontWeight: "800", letterSpacing: -0.5 },
  headerSub: { fontSize: 12, fontWeight: "600", marginTop: 1 },
  addBtn: {
    width: 38, height: 38, borderRadius: 19,
    justifyContent: "center", alignItems: "center",
    ...Platform.select({
      ios: { shadowColor: "#4F46E5", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
      android: { elevation: 4 },
    }),
  },

  // SKELETON
  skeletonCard: {
    flexDirection: "row", alignItems: "center",
    borderRadius: 16, padding: 14, borderWidth: 1, marginBottom: 10,
  },
  skeletonIcon: { width: 46, height: 46, borderRadius: 23, marginRight: 12 },
  skeletonLine: { height: 12, borderRadius: 6 },

  // TOPIC CARD
  topicCard: {
    borderRadius: 18, borderWidth: 1,
    flexDirection: "row", alignItems: "center",
    marginBottom: 10, paddingRight: 10,
    overflow: "hidden",
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.03, shadowRadius: 8 },
      android: { elevation: 2 },
    }),
  },
  cardMain: { flex: 1, flexDirection: "row", alignItems: "center", padding: 14 },
  iconCircle: {
    width: 46, height: 46, borderRadius: 23,
    justifyContent: "center", alignItems: "center", marginRight: 12,
  },
  topicTitle: { fontSize: 15, fontWeight: "700" },
  wordCount: { fontSize: 12, marginTop: 3, fontWeight: "500" },
  actionRow: { flexDirection: "row", gap: 6, paddingRight: 4 },
  actionBtn: {
    width: 32, height: 32, borderRadius: 9,
    justifyContent: "center", alignItems: "center",
  },

  // LOAD MORE
  loadMoreBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 14, borderRadius: 16, borderWidth: 1,
    marginTop: 4, marginBottom: 16,
  },
  loadMoreText: { fontSize: 14, fontWeight: "700" },
  allLoadedText: { textAlign: "center", fontSize: 12, marginBottom: 20, fontWeight: "500" },

  // EMPTY STATE
  emptyBox: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  emptyIconWrap: { width: 80, height: 80, borderRadius: 24, justifyContent: "center", alignItems: "center", marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: "800", marginBottom: 8 },
  emptyDesc: { fontSize: 14, textAlign: "center", lineHeight: 20, marginBottom: 24 },
  emptyBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 24, paddingVertical: 13, borderRadius: 14,
  },
  emptyBtnText: { color: "#FFF", fontSize: 15, fontWeight: "800" },

  // PINNED PRIORITY CARD
  pinnedHeaderContainer: {
    marginBottom: 14,
  },
  priorityPinnedCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 16,
    marginBottom: 12,
    ...Platform.select({
      ios: { shadowColor: "#F59E0B", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10 },
      android: { elevation: 3 },
    }),
  },
  priorityCardTop: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  priorityIconBadge: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  priorityCardTitle: {
    fontSize: 17,
    fontWeight: "800",
  },
  priorityCountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  priorityCountText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },
  priorityCardSub: {
    fontSize: 12,
    marginTop: 3,
    lineHeight: 16,
  },
  priorityActionRow: {
    flexDirection: "row",
    gap: 10,
  },
  btnPriorityAction: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
  },
  btnPriorityActionText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  sectionDividerRow: {
    paddingTop: 8,
    paddingBottom: 4,
    paddingHorizontal: 4,
  },
  sectionDividerText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
});
