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

interface StudyItem {
  id: string;
  title: string;
  desc: string;
  icon: string;
  color: string;
  lightColor: string;
  route: string;
  params?: any;
}

interface StudySection {
  title: string;
  items: StudyItem[];
}

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

  const sections: StudySection[] = [
    {
      title: "Tra cứu & Học tập",
      items: [
        {
          id: "flashcard",
          title: "Flashcard Từ vựng",
          desc: "Ôn tập N5 với thẻ ghi nhớ thông minh & tiến trình tự động",
          icon: "view-carousel",
          color: colors.blue,
          lightColor: colors.blueLight,
          route: "/study/flashcard",
        },
        {
          id: "show_kanji",
          title: "Bài học Kanji",
          desc: "Duyệt từng Kanji theo cấp độ, múa nét vẽ, sửa & xóa bài",
          icon: "menu-book",
          color: colors.emerald,
          lightColor: colors.emeraldLight,
          route: "/study/show-kanji",
        },
        {
          id: "kanji_search",
          title: "Tra cứu Kanji",
          desc: "Xem âm Hán Việt, ví dụ mẫu & mô phỏng nét vẽ động",
          icon: "search",
          color: colors.amber,
          lightColor: colors.amberLight,
          route: "/study/kanji-search",
        },
      ],
    },
    {
      title: "Luyện tập & Trò chơi",
      items: [
        {
          id: "quiz_vocab",
          title: "Trắc nghiệm Từ vựng",
          desc: "Kiểm tra phản xạ nghĩa từ vựng Nhật - Việt dưới áp lực thời gian",
          icon: "quiz",
          color: colors.indigo,
          lightColor: colors.indigoLight,
          route: "/luyen-tap/quiz",
          params: { mode: "vocab" },
        },
        {
          id: "quiz_grammar",
          title: "Trắc nghiệm Ngữ pháp",
          desc: "Làm đề trắc nghiệm cấu trúc, công thức và dịch nghĩa câu",
          icon: "assignment",
          color: colors.purple,
          lightColor: colors.purpleLight,
          route: "/luyen-tap/quiz",
          params: { mode: "grammar" },
        },
        {
          id: "match_vocab",
          title: "Game Ghép Từ vựng",
          desc: "Phá giải trận pháp ghép cặp từ vựng Nhật - Việt để tăng tu vi",
          icon: "layers",
          color: colors.blue,
          lightColor: colors.blueLight,
          route: "/luyen-tap/vocab-match",
        },
        {
          id: "match_grammar",
          title: "Game Ghép Câu Ngữ pháp",
          desc: "Ghép các cặp câu ví dụ Nhật - Việt nhằm thấu hiểu sâu ngữ pháp",
          icon: "extension",
          color: colors.amber,
          lightColor: colors.amberLight,
          route: "/luyen-tap/grammar",
        },
      ],
    },
    {
      title: "Quản lý dữ liệu",
      items: [
        {
          id: "add_vocab",
          title: "Thêm Từ vựng mới",
          desc: "Bổ sung kho từ vựng cá nhân trực tiếp lên máy chủ đám mây",
          icon: "post-add",
          color: colors.emerald,
          lightColor: colors.emeraldLight,
          route: "/study/add-vocab",
        },
        {
          id: "add_grammar",
          title: "Thêm Ngữ pháp mới",
          desc: "Ghi chú cấu trúc câu, ý nghĩa và ví dụ tự biên soạn",
          icon: "edit-note",
          color: colors.amber,
          lightColor: colors.amberLight,
          route: "/study/add-grammar",
        },
        {
          id: "add_kanji",
          title: "Thêm Kanji mới",
          desc: "Bổ sung Kanji lẻ hoặc nhập hàng loạt từ danh sách JSON",
          icon: "add-box",
          color: colors.indigo,
          lightColor: colors.indigoLight,
          route: "/study/add-kanji",
        },
      ],
    },
  ];

  const handlePressItem = (item: StudyItem) => {
    if (item.params) {
      router.push({
        pathname: item.route as any,
        params: item.params,
      });
    } else {
      router.push(item.route as any);
    }
  };

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
        {sections.map((section, secIdx) => (
          <View key={section.title} style={styles.sectionContainer}>
            <Text style={[styles.sectionTitleHeader, { color: colors.indigo }]}>
              {section.title.toUpperCase()}
            </Text>
            
            <View style={styles.sectionItemsWrap}>
              {section.items.map((item, itemIdx) => {
                const staggerDelay = (secIdx * 3 + itemIdx) * 50;
                return (
                  <Animated.View
                    key={item.id}
                    entering={FadeInDown.delay(staggerDelay).duration(400).springify()}
                  >
                    <TouchableOpacity
                      style={[
                        styles.listCard,
                        {
                          backgroundColor: colors.surface,
                          borderColor: colors.border,
                        },
                      ]}
                      onPress={() => handlePressItem(item)}
                      activeOpacity={0.75}
                    >
                      {/* Left color bar */}
                      <View style={[styles.accentLine, { backgroundColor: item.color }]} />

                      <View style={styles.cardContent}>
                        {/* Icon */}
                        <View
                          style={[
                            styles.iconBox,
                            { backgroundColor: item.lightColor },
                          ]}
                        >
                          <MaterialIcons name={item.icon as any} size={24} color={item.color} />
                        </View>

                        {/* Text */}
                        <View style={styles.textDetails}>
                          <Text style={[styles.cardTitle, { color: colors.text }]}>
                            {item.title}
                          </Text>
                          <Text style={[styles.cardDesc, { color: colors.textMuted }]}>
                            {item.desc}
                          </Text>
                        </View>

                        {/* Chevron */}
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
                );
              })}
            </View>
          </View>
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
    gap: 20,
  },
  sectionContainer: {
    gap: 10,
  },
  sectionTitleHeader: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    paddingLeft: 4,
  },
  sectionItemsWrap: {
    gap: 10,
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
    width: 46,
    height: 46,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  textDetails: {
    flex: 1,
    paddingRight: 8,
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
