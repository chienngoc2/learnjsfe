import React, { useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Platform,
  StatusBar,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter, Stack } from "expo-router";
import { useTheme } from "@/src/context/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";

export default function StudyMenuScreen() {
  const router = useRouter();
  const { colors, isDark, toggleTheme } = useTheme();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    (async () => {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login" as any);
      }
    })();
  }, []);

  const studyOptions = [
    {
      id: "flashcard",
      title: "Flashcard Từ vựng",
      desc: "Ôn tập N5 với thẻ ghi nhớ thông minh & thống kê tiến độ",
      icon: "view-carousel",
      color: colors.blue,
      lightColor: colors.blueLight,
      route: "/study/flashcard",
      category: "TỪ VỰNG",
    },
    {
      id: "add_vocab",
      title: "Thêm Từ vựng",
      desc: "Bổ sung kho từ vựng cá nhân trực tiếp lên hệ thống đám mây",
      icon: "post-add",
      color: colors.emerald,
      lightColor: colors.emeraldLight,
      route: "/study/add-vocab",
      category: "TÙY BIẾN",
    },
    {
      id: "add_grammar",
      title: "Thêm Ngữ pháp",
      desc: "Ghi chú cấu trúc mới theo phong cách tu tiên",
      icon: "edit-note",
      color: colors.amber,
      lightColor: colors.amberLight,
      route: "/study/add-grammar",
      category: "TÙY BIẾN",
    },
    {
      id: "practice_grammar",
      title: "Luyện Ngữ pháp",
      desc: "Làm bài tập trắc nghiệm chọn đáp án & Đánh giá năng lực",
      icon: "psychology",
      color: colors.purple,
      lightColor: colors.purpleLight,
      route: "/luyen-tap/grammar",
      category: "NGỮ PHÁP",
    },
    {
      id: "vocab_match",
      title: "Game Ghép Từ",
      desc: "Ghép cặp từ vựng Nhật - Việt để nhận điểm tu vi",
      icon: "layers",
      color: colors.indigo,
      lightColor: colors.indigoLight,
      route: "/luyen-tap/vocab-match",
      category: "GAME",
    },
    {
      id: "kanji_search",
      title: "Tra cứu Kanji",
      desc: "Xem âm Hán Việt, ví dụ mẫu & múa nét vẽ động trực quan",
      icon: "font-download",
      color: colors.amber,
      lightColor: colors.amberLight,
      route: "/study/kanji-search",
      category: "KANJI",
    },
    {
      id: "add_kanji",
      title: "Thêm Kanji",
      desc: "Bổ sung Kanji mới vào kho dữ liệu cá nhân & nhập hàng loạt JSON",
      icon: "add-box",
      color: colors.indigo,
      lightColor: colors.indigoLight,
      route: "/study/add-kanji",
      category: "TÙY BIẾN",
    },
    {
      id: "show_kanji",
      title: "Học Kanji",
      desc: "Duyệt từng Kanji theo cấp độ, xem nét vẽ, sửa & xóa linh hoạt",
      icon: "menu-book",
      color: colors.emerald,
      lightColor: colors.emeraldLight,
      route: "/study/show-kanji",
      category: "KANJI",
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* HEADER */}
      <View style={[styles.header, { paddingTop: insets.top > 0 ? insets.top + 16 : 48 }]}>
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              Khu vực Học tập 👋
            </Text>
            <Text style={[styles.headerSub, { color: colors.textMuted }]}>
              Chọn kỹ năng sếp muốn cày hôm nay
            </Text>
          </View>

          {/* Toggle Theme */}
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
              size={20}
              color={isDark ? colors.amber : colors.textMuted}
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {studyOptions.map((item, index) => (
          <Animated.View
            key={item.id}
            entering={FadeInDown.delay(index * 60).duration(400).springify()}
          >
            <TouchableOpacity
              style={[
                styles.listCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
              onPress={() => router.push(item.route as any)}
              activeOpacity={0.75}
            >
              {/* Vạch màu bên trái */}
              <View style={[styles.accentLine, { backgroundColor: item.color }]} />

              <View style={styles.cardContent}>
                {/* Left Side: Icon */}
                <View
                  style={[
                    styles.iconBox,
                    { backgroundColor: item.lightColor },
                  ]}
                >
                  <MaterialIcons name={item.icon as any} size={24} color={item.color} />
                </View>

                {/* Middle: Text details */}
                <View style={styles.textDetails}>
                  <View style={styles.categoryRow}>
                    <Text style={[styles.categoryText, { color: item.color }]}>
                      {item.category}
                    </Text>
                  </View>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>
                    {item.title}
                  </Text>
                  <Text style={[styles.cardDesc, { color: colors.textMuted }]}>
                    {item.desc}
                  </Text>
                </View>

                {/* Right Side: Chevron */}
                <View style={styles.chevronBox}>
                  <MaterialIcons
                    name="chevron-right"
                    size={22}
                    color={colors.textMuted}
                  />
                </View>
              </View>
            </TouchableOpacity>
          </Animated.View>
        ))}
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(15,23,42,0.03)",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: 13,
    marginTop: 4,
    fontWeight: "500",
  },
  btnToggle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 12,
  },
  listCard: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    position: "relative",
    ...Platform.select({
      ios: {
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.03,
        shadowRadius: 12,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  accentLine: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 5,
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    paddingLeft: 20,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  textDetails: {
    flex: 1,
    paddingRight: 8,
  },
  categoryRow: {
    marginBottom: 4,
  },
  categoryText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500",
  },
  chevronBox: {
    justifyContent: "center",
    alignItems: "center",
    opacity: 0.8,
  },
});
