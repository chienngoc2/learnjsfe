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
  const { colors, isDark } = useTheme(); // 🚀 ĐÃ TÍCH HỢP: Đón nhận bộ màu động sáng/tối
  const [topics, setTopics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // State quản lý Hover cho nút Back trên Header (Dành cho bản Web)
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
        <ActivityIndicator size="large" color={colors.amber} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ẨN HEADER MẶC ĐỊNH CỦA EXPO */}
      <Stack.Screen options={{ headerShown: false }} />

      {/* CUSTOM HEADER ĐỒNG BỘ THEME ĐỘNG */}
      <View
        style={[
          styles.customHeader,
          { 
            backgroundColor: colors.background,
            paddingTop: insets.top > 0 ? insets.top : (Platform.OS === "android" ? 50 : 20)
          }
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
              backgroundColor: colors.amberLight,
              borderColor: colors.amber,
              shadowColor: colors.amber,
            },
          ]}
        >
          {({ pressed }) => (
            <MaterialIcons
              name="arrow-back-ios"
              size={20}
              color={isHovered || pressed ? colors.amber : colors.textMuted}
              style={{ marginLeft: 6 }}
            />
          )}
        </Pressable>

        <Text style={[styles.headerTitle, { color: colors.text }]}>
          📚 Thư Viện Bài Học
        </Text>

        {/* Khối View trống để cân bằng layout giúp Title nằm giữa chính xác */}
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
                  backgroundColor: isDark ? "#2C1A10" : "#FFF7ED", // Động: Tối dùng Cam cháy, Sáng dùng Cam pastel
                  borderWidth: 2,
                  borderColor: colors.amber,
                  shadowColor: colors.amber,
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
                    { backgroundColor: isDark ? "#334155" : "#EEF2F6" },
                    isReviewCard && {
                      backgroundColor: isDark ? "#45230F" : "#FFEDD5",
                    },
                  ]}
                >
                  <MaterialIcons
                    name={
                      isReviewCard ? "local-fire-department" : "library-books"
                    }
                    size={24}
                    color={
                      isReviewCard
                        ? colors.amber
                        : isDark
                          ? "#818CF8"
                          : "#4F46E5"
                    }
                  />
                </View>

                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text
                    style={[
                      styles.topicTitle,
                      { color: colors.text },
                      isReviewCard && { color: isDark ? "#FDBA74" : "#9A3412" }, // Màu chữ cam dịu hơn ở Dark Mode
                    ]}
                    numberOfLines={1}
                  >
                    {item.title} {isReviewCard && "🔥"}
                  </Text>
                  <Text
                    style={[
                      styles.wordCount,
                      { color: colors.textMuted },
                      isReviewCard && { color: isDark ? "#FB923C" : "#C2410C" },
                    ]}
                  >
                    {item.words ? item.words.length : 0} TỪ chưa thuộc này sếp
                  </Text>
                </View>
              </TouchableOpacity>

              {/* KHỐI NÚT CHỨC NĂNG HÒA THEO THEME ĐỘNG */}
              <View style={styles.actionGroup}>
                {/* Nút Game */}
                <TouchableOpacity
                  style={[
                    styles.btnAction,
                    { backgroundColor: isDark ? "#334155" : "#EEF2F6" },
                    isReviewCard && {
                      backgroundColor: isDark ? "#45230F" : "#FFEDD5",
                    },
                  ]}
                  onPress={() =>
                    router.push({
                      pathname: "/study/practice-typing",
                      params: { topicId: item._id, title: item.title },
                    })
                  }
                >
                  <MaterialIcons
                    name="sports-esports"
                    size={20}
                    color={
                      isReviewCard
                        ? colors.amber
                        : isDark
                          ? "#818CF8"
                          : "#4F46E5"
                    }
                  />
                </TouchableOpacity>

                {/* Nút Ngữ Pháp */}
                <TouchableOpacity
                  style={[
                    styles.btnAction,
                    { backgroundColor: isDark ? "#334155" : "#EEF2F6" },
                    isReviewCard && {
                      backgroundColor: isDark ? "#45230F" : "#FFEDD5",
                    },
                  ]}
                  onPress={() =>
                    router.push(
                      `/study/grammar-viewer?topicId=${item._id}&title=${encodeURIComponent(item.title)}`,
                    )
                  }
                >
                  <MaterialIcons
                    name="menu-book"
                    size={18}
                    color={
                      isReviewCard
                        ? colors.amber
                        : isDark
                          ? "#34D399"
                          : "#059669"
                    }
                  />
                </TouchableOpacity>

                {/* Nút Sửa */}
                <TouchableOpacity
                  style={[
                    styles.btnAction,
                    { backgroundColor: isDark ? "#334155" : "#EEF2F6" },
                    isReviewCard && {
                      backgroundColor: isDark ? "#45230F" : "#FFEDD5",
                    },
                  ]}
                  onPress={() => handleEdit(item._id)}
                >
                  <MaterialIcons
                    name="edit"
                    size={18}
                    color={colors.textMuted}
                  />
                </TouchableOpacity>

                {/* Nút Xóa */}
                <TouchableOpacity
                  style={[
                    styles.btnAction,
                    { backgroundColor: isDark ? "#451A1A" : "#FEF2F2" },
                  ]}
                  onPress={() => handleDelete(item._id, item.title)}
                >
                  <MaterialIcons
                    name="delete-outline"
                    size={18}
                    color={isDark ? "#F87171" : "#EF4444"}
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

  // === STYLE CHO CUSTOM HEADER ===
  customHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? 50 : 20,
    paddingBottom: 15,
    zIndex: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 0.5,
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

  // === STYLE DANH SÁCH THẺ ===
  topicCard: {
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    padding: 12,
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
  topicTitle: { fontSize: 16, fontWeight: "700" },
  wordCount: {
    fontSize: 13,
    marginTop: 3,
    fontWeight: "500",
  },
  actionGroup: { flexDirection: "row", alignItems: "center", gap: 6 },
  btnAction: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
});
