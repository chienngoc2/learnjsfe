
import React, { useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter, Stack } from "expo-router";
import { useTheme } from "@/src/context/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function StudyMenuScreen() {
  const router = useRouter();
  const { colors, isDark, toggleTheme } = useTheme(); // Đón nhận bộ màu động
  const insets = useSafeAreaInsets();

  useEffect(() => {
    (async () => {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login" as any);
      }
    })();
  }, []);

  // Danh sách các chức năng học tập được tối ưu màu sắc thích ứng sáng/tối
  const studyOptions = [
    {
      id: "flashcard",
      title: "Flashcard Từ vựng",
      desc: "Ôn tập N5 với thẻ ghi nhớ thông minh",
      icon: "view-carousel",
      color: isDark ? "#60A5FA" : "#007AFF", // Xanh dương dịu hơn ở Dark Mode
      route: "/study/flashcard",
    },
    {
      id: "add_vocab",
      title: "Thêm Từ vựng",
      desc: "Bổ sung kho từ vựng cá nhân lên hệ thống",
      icon: "post-add",
      color: isDark ? "#34D399" : "#10B981", // Xanh lá thích ứng
      route: "/study/add-vocab",
    },
    {
      id: "add_grammar",
      title: "Thêm Ngữ pháp",
      desc: "Ghi chú cấu trúc mới theo chuẩn hổ phách",
      icon: "edit-note",
      color: colors.amber, // Ăn theo màu cam cốt lõi
      route: "/study/add-grammar",
    },
    {
      id: "practice_grammar",
      title: "Luyện Ngữ pháp",
      desc: "Làm bài tập trắc nghiệm & Đánh giá năng lực",
      icon: "psychology",
      color: isDark ? "#C084FC" : "#A855F7", // Tím mộng mơ
      route: "/study/practice-grammar",
    },
    // 🚀 TÍNH NĂNG MỚI: TRA CỨU KANJI HOẠT HỌA NÉT VẼ
    {
      id: "kanji_search",
      title: "Tra cứu Kanji",
      desc: "Xem âm Hán Việt, ví dụ mẫu & múa nét vẽ động",
      icon: "font-download",
      color: isDark ? "#FBBF24" : "#F59E0B",
      route: "/study/KanjiSearchScreen",
    },
    // 🆕 THÊM KANJI VÀO KHO
    {
      id: "add_kanji",
      title: "Thêm Kanji",
      desc: "Bổ sung Kanji vào kho dữ liệu cá nhân & nhập hàng loạt JSON",
      icon: "add-box",
      color: isDark ? "#F472B6" : "#EC4899", // Hồng tươi tắn
      route: "/study/add-kanji",
    },
    // 📖 HỌC & DUYỆT KHO KANJI
    {
      id: "show_kanji",
      title: "Học Kanji",
      desc: "Duyệt từng Kanji theo cấp độ, xem nét vẽ, sửa & xóa",
      icon: "menu-book",
      color: isDark ? "#34D399" : "#059669", // Xanh ngọc
      route: "/study/show-kanji",
    },
  ];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top > 0 ? insets.top + 10 : (Platform.OS === 'android' ? 60 : 30) }
      ]}
    >
      <Stack.Screen options={{ headerShown: false }} />

      {/* HEADER SINH ĐỘNG TÍCH HỢP ĐỔI THEME TẠI CHỖ */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              Khu vực Học tập 👋
            </Text>
            <Text style={[styles.headerSub, { color: colors.textMuted }]}>
              Chọn kỹ năng sếp muốn cày hôm nay
            </Text>
          </View>

          {/* Nút đổi theme góc phải siêu ngầu */}
          <TouchableOpacity
            onPress={toggleTheme}
            style={[
              styles.btnToggle,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
            activeOpacity={0.7}
          >
            <MaterialIcons
              name={isDark ? "wb-sunny" : "nights-stay"}
              size={22}
              color={isDark ? colors.amber : colors.textMuted}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* LƯỚI GRID HIỂN THỊ THẺ COMPONENT */}
      <View style={styles.gridContainer}>
        {studyOptions.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[
              styles.card,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderLeftColor: item.color, // Thanh màu Accent vạch dọc bên trái thẻ
              },
            ]}
            onPress={() => router.push(item.route as any)}
            activeOpacity={0.8}
          >
            {/* Vòng tròn Icon đổ màu opacity nhạt theo item */}
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: item.color + "15" },
              ]}
            >
              <MaterialIcons
                name={item.icon as any}
                size={30}
                color={item.color}
              />
            </View>

            {/* Mũi tên nhỏ chỉ hướng sang trọng ở góc phải */}
            <View style={styles.arrowBox}>
              <MaterialIcons
                name="arrow-forward-ios"
                size={12}
                color={colors.textMuted}
              />
            </View>

            <Text
              style={[styles.cardTitle, { color: colors.text }]}
              numberOfLines={1}
            >
              {item.title}
            </Text>
            <Text
              style={[styles.cardDesc, { color: colors.textMuted }]}
              numberOfLines={2}
            >
              {item.desc}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingTop: Platform.OS === "android" ? 60 : 30,
  },
  header: {
    marginBottom: 24,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: 14,
    marginTop: 4,
    fontWeight: "500",
  },
  btnToggle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
      },
      android: { elevation: 2 },
    }),
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  card: {
    width: "48.5%", // Tối ưu khoảng hở giữa 2 cột cân đối hơn
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderLeftWidth: 5, // Biến cạnh trái thành vạch màu thanh lịch
    position: "relative",
    ...Platform.select({
      ios: {
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.04,
        shadowRadius: 12,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  arrowBox: {
    position: "absolute",
    top: 20,
    right: 16,
    opacity: 0.6,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 6,
    letterSpacing: -0.2,
  },
  cardDesc: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500",
  },
});

