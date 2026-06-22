import React, { useState, useCallback } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
} from "react-native";
import { useRouter, useFocusEffect, Stack } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import api from "../../services/api";
import { useTheme } from "@/src/context/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function TopicListScreen() {
  const { colors, isDark } = useTheme();
  const [topics, setTopics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [isHovered, setIsHovered] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      setLoading(true);
      api
        .get("/api/vocab/lists")
        .then((res) => {
          if (res.data.success && isActive) {
            const sortedData = [...res.data.data].sort((a, b) => {
              if (a.title === "Cần ôn tập") return -1;
              if (b.title === "Cần ôn tập") return 1;
              return 0;
            });
            setTopics(sortedData);
          }
          if (isActive) setLoading(false);
        })
        .catch((err) => {
          console.error("Lỗi lấy danh sách bài học:", err);
          if (isActive) setLoading(false);
        });
      return () => {
        isActive = false;
      };
    }, []),
  );

  const executeDelete = async (topicId: string) => {
    try {
      const res = await api.delete(`/api/vocab/delete/${topicId}`);
      if (res.data.success || res.status === 200) {
        setTopics((prev) => prev.filter((topic) => topic._id !== topicId));
      }
    } catch (error) {
      alert("Không thể xóa bài học này.");
    }
  };

  const handleDelete = (topicId: string, title: string) => {
    if (title === "Cần ôn tập") {
      alert("Bài ôn tập cốt lõi của hệ thống, sếp không nên xóa nha!");
      return;
    }
    if (Platform.OS === "web") {
      const confirmed = window.confirm(
        `Sếp có chắc chắn muốn xóa bài học "${title}" này không?`,
      );
      if (confirmed) executeDelete(topicId);
    } else {
      Alert.alert("Xác nhận xóa", `Sếp muốn xóa bài "${title}"?`, [
        { text: "Hủy", style: "cancel" },
        {
          text: "Xóa sạch",
          style: "destructive",
          onPress: () => executeDelete(topicId),
        },
      ]);
    }
  };

  const handleEdit = (topicId: string) => {
    router.push({ pathname: "/study/add-vocab", params: { editId: topicId } });
  };

  if (loading) {
    return (
      <View
        style={[
          styles.container,
          { justifyContent: "center", backgroundColor: colors.background },
        ]}
      >
        <ActivityIndicator size="large" color={colors.indigo} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* CUSTOM HEADER */}
      <View
        style={[
          styles.customHeader,
          {
            backgroundColor: colors.background,
            paddingTop: insets.top > 0 ? insets.top : (Platform.OS === "android" ? 50 : 20),
          },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          onHoverIn={() => setIsHovered(true)}
          onHoverOut={() => setIsHovered(false)}
          style={({ pressed }) => [
            styles.btnBackHeader,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
            (isHovered || pressed) && {
              backgroundColor: colors.indigoLight,
              borderColor: colors.indigo,
              shadowColor: colors.indigo,
            },
          ]}
        >
          {({ pressed }) => (
            <MaterialIcons
              name="arrow-back-ios"
              size={20}
              color={isHovered || pressed ? colors.indigo : colors.textMuted}
              style={{ marginLeft: 6 }}
            />
          )}
        </Pressable>

        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Tàng Thư Các
        </Text>

        <View style={{ width: 44 }} />
      </View>

      <FlatList
        data={topics}
        keyExtractor={(item) => item._id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: 10, paddingBottom: 40 }}
        renderItem={({ item }) => {
          const isReviewCard = item.title === "Cần ôn tập";

          return (
            <View
              style={[
                styles.topicCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
                isReviewCard && {
                  backgroundColor: isDark ? "rgba(245, 199, 107, 0.08)" : "#FFFBEB",
                  borderWidth: 1.5,
                  borderColor: colors.indigo,
                  shadowColor: colors.indigo,
                  shadowOpacity: 0.15,
                  shadowRadius: 10,
                  elevation: 4,
                },
              ]}
            >
              <TouchableOpacity
                style={styles.cardMainAction}
                onPress={() =>
                  router.push({
                    pathname: "/study/card-viewer",
                    params: { topicId: item._id, title: item.title },
                  })
                }
              >
                <View
                  style={[
                    styles.iconCircle,
                    { backgroundColor: isDark ? "rgba(255, 255, 255, 0.05)" : "#F1F5F9" },
                    isReviewCard && {
                      backgroundColor: isDark ? "rgba(245, 199, 107, 0.15)" : "#FEF3C7",
                    },
                  ]}
                >
                  <MaterialIcons
                    name={
                      isReviewCard ? "local-fire-department" : "menu-book"
                    }
                    size={22}
                    color={
                      isReviewCard
                        ? colors.indigo
                        : colors.purple
                    }
                  />
                </View>

                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text
                    style={[
                      styles.topicTitle,
                      { color: colors.text },
                      isReviewCard && { color: colors.indigo },
                    ]}
                    numberOfLines={1}
                  >
                    {item.title} {isReviewCard && " (Cực Hạn Ôn Tập)"}
                  </Text>
                  <Text
                    style={[
                      styles.wordCount,
                      { color: colors.textMuted },
                      isReviewCard && { color: colors.amber },
                    ]}
                  >
                    {item.words ? item.words.length : 0} khẩu quyết chưa thuộc
                  </Text>
                </View>
              </TouchableOpacity>

              {/* ACTION BUTTONS */}
              <View style={styles.actionGroup}>
                {/* Luyện gõ phím */}
                <TouchableOpacity
                  style={[
                    styles.btnAction,
                    { backgroundColor: isDark ? "rgba(255, 255, 255, 0.05)" : "#F1F5F9", borderColor: colors.border, borderWidth: 1 },
                  ]}
                  onPress={() =>
                    router.push({
                      pathname: "/luyen-tap/typing",
                      params: { topicId: item._id, title: item.title },
                    })
                  }
                >
                  <MaterialIcons
                    name="keyboard"
                    size={18}
                    color={colors.indigo}
                  />
                </TouchableOpacity>

                {/* Ngữ Pháp */}
                <TouchableOpacity
                  style={[
                    styles.btnAction,
                    { backgroundColor: isDark ? "rgba(255, 255, 255, 0.05)" : "#F1F5F9", borderColor: colors.border, borderWidth: 1 },
                  ]}
                  onPress={() =>
                    router.push(
                      `/study/grammar-viewer?topicId=${item._id}&title=${encodeURIComponent(item.title)}`,
                    )
                  }
                >
                  <MaterialIcons
                    name="collections-bookmark"
                    size={16}
                    color={colors.blue}
                  />
                </TouchableOpacity>

                {/* Sửa */}
                <TouchableOpacity
                  style={[
                    styles.btnAction,
                    { backgroundColor: isDark ? "rgba(255, 255, 255, 0.05)" : "#F1F5F9", borderColor: colors.border, borderWidth: 1 },
                  ]}
                  onPress={() => handleEdit(item._id)}
                >
                  <MaterialIcons
                    name="edit"
                    size={16}
                    color={colors.textMuted}
                  />
                </TouchableOpacity>

                {/* Xóa */}
                <TouchableOpacity
                  style={[
                    styles.btnAction,
                    { backgroundColor: isDark ? "rgba(239, 68, 68, 0.1)" : "#FEF2F2" },
                  ]}
                  onPress={() => handleDelete(item._id, item.title)}
                >
                  <MaterialIcons
                    name="delete-outline"
                    size={16}
                    color={colors.error}
                  />
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  customHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 15,
    zIndex: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 1,
  },
  btnBackHeader: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    ...Platform.select({
      web: { transition: "all 0.2s ease" },
    }),
  },
  topicCard: {
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    padding: 14,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 2,
    marginHorizontal: 16,
  },
  cardMainAction: { flex: 1, flexDirection: "row", alignItems: "center" },
  iconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  topicTitle: { fontSize: 15, fontWeight: "700" },
  wordCount: {
    fontSize: 12,
    marginTop: 3,
    fontWeight: "500",
  },
  actionGroup: { flexDirection: "row", alignItems: "center", gap: 6 },
  btnAction: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
});
