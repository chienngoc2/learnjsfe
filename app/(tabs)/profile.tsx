import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Platform,
  Switch,
  Image,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter, Stack } from "expo-router";
import { useTheme } from "@/src/context/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCultivationStore } from "../../store/useCultivationStore";
import { useIsFocused } from "@react-navigation/native";

export default function ProfileScreen() {
  const router = useRouter();
  const { colors, isDark, toggleTheme } = useTheme();
  const insets = useSafeAreaInsets();

  const {
    level,
    stage,
    tuVi,
    streak,
    currentTitle,
    tokensUsed,
    soundEnabled,
    toggleSound,
    clearTokens,
  } = useCultivationStore();

  const maxTuVi = level * 100 + 500;
  const tuViPercentage = Math.min(100, Math.round((tuVi / maxTuVi) * 100));

  const [username, setUsername] = useState("Học viên");
  const [apiUrl, setApiUrl] = useState("http://localhost:5000");
  const isFocused = useIsFocused();
  const [avatarUser, setAvatarUser] = useState("");

  const mapTitle = (title: string) => {
    if (title === 'Đệ Tử Ngoại Môn') return 'Học viên Sơ cấp';
    if (title === 'Tu Tiên Giả') return 'Học viên Trung cấp';
    if (title === 'Kim Đan Chân Nhân') return 'Học viên Cao cấp';
    return title || 'Học viên';
  };

  const getJpLevelStr = (lv: number) => {
    if (lv >= 41) return "Cao cấp N1";
    if (lv >= 31) return "Trung-Cao cấp N2";
    if (lv >= 21) return "Trung cấp N3";
    if (lv >= 11) return "Sơ-Trung cấp N4";
    return "Sơ cấp N5";
  };

  useEffect(() => {
    if (isFocused) {
      (async () => {
        // Load user info
        const userStr = await AsyncStorage.getItem("user");
        if (userStr) {
          try {
            const userObj = JSON.parse(userStr);
            if (userObj && userObj.username) {
              setUsername(userObj.username);
            }
          } catch (e) {
            console.error("Lỗi parse user info:", e);
          }
        }

        // Load avatars
        const au = await AsyncStorage.getItem("avatar_user");
        if (au) setAvatarUser(au);
        else setAvatarUser("");

        // Load dynamic apiBase configuration
        const savedApiBase = await AsyncStorage.getItem("apiBase");
        if (savedApiBase) {
          setApiUrl(savedApiBase);
        }
      })();
    }
  }, [isFocused]);

  const handleSaveApi = async () => {
    if (!apiUrl.trim()) {
      Alert.alert("Lỗi", "Địa chỉ API không được trống");
      return;
    }
    await AsyncStorage.setItem("apiBase", apiUrl.trim());
    Alert.alert("Thành công", "Đã cập nhật linh mạch (API URL) thành công!");
  };

  const handleLogout = () => {
    Alert.alert(
      "Đăng Xuất",
      "Bạn có chắc chắn muốn đăng xuất không?",
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Đăng Xuất",
          style: "destructive",
          onPress: async () => {
            await AsyncStorage.removeItem("token");
            await AsyncStorage.removeItem("user");
            router.replace("/login");
          },
        },
      ]
    );
  };

  const handleResetData = () => {
    Alert.alert(
      "CẢNH BÁO NGUY HIỂM",
      "Hành động này sẽ xóa sạch kinh nghiệm tích lũy (clear storage) và thiết lập lại hệ thống. Tiếp tục?",
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Đặt lại",
          style: "destructive",
          onPress: async () => {
            await AsyncStorage.clear();
            clearTokens();
            Alert.alert("Đã reset", "Tiến trình học tập đã được đặt lại thành công.");
            router.replace("/login");
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top > 0 ? insets.top + 10 : (Platform.OS === 'android' ? 60 : 30) }
      ]}
    >
      <Stack.Screen options={{ headerShown: false }} />

      {/* Profile Header Card */}
      <View style={[styles.profileCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.avatarCircle, { borderColor: colors.indigo, padding: 2 }]}>
          <Image
            source={{ uri: avatarUser || "https://api.dicebear.com/7.x/avataaars/svg?seed=" + username }}
            style={{ width: "100%", height: "100%", borderRadius: 28 }}
          />
        </View>

        <View style={styles.profileTextContainer}>
          <Text style={[styles.usernameText, { color: colors.text }]}>{username}</Text>
          <Text style={[styles.titleTag, { backgroundColor: colors.indigo + "20", color: colors.indigo }]}>
            {mapTitle(currentTitle)}
          </Text>
          <Text style={[styles.stageText, { color: colors.textMuted }]}>{getJpLevelStr(level)}</Text>
        </View>
      </View>

      {/* Cultivation Status Card */}
      <View style={[styles.statsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>TIẾN ĐỘ HỌC TẬP</Text>
        
        <View style={styles.statRow}>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Cấp Độ Hiện Tại</Text>
          <Text style={[styles.statValue, { color: colors.text }]}>Lv.{level}</Text>
        </View>

        <View style={styles.statRow}>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Kinh Nghiệm Tích Lũy (XP)</Text>
          <Text style={[styles.statValue, { color: colors.indigo }]}>{tuVi} / {maxTuVi}</Text>
        </View>

        <View style={styles.progressContainer}>
          <View style={[styles.progressBarBg, { backgroundColor: isDark ? "#1E293B" : "#E2E8F0" }]}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${tuViPercentage}%`, backgroundColor: colors.indigo }
              ]}
            />
          </View>
          <Text style={[styles.progressPercent, { color: colors.textMuted }]}>{tuViPercentage}%</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.statRow}>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Chuỗi học liên tục (Streak)</Text>
          <View style={styles.streakBadge}>
            <MaterialIcons name="local-fire-department" size={16} color={colors.amber} />
            <Text style={[styles.streakText, { color: colors.amber }]}>{streak} ngày liên tiếp</Text>
          </View>
        </View>
      </View>

      {/* System Settings Card */}
      <View style={[styles.cardContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>CÀI ĐẶT HỆ THỐNG</Text>

        {/* Toggle Dark Mode */}
        <View style={styles.settingItem}>
          <View style={styles.settingLabelContainer}>
            <MaterialIcons name={isDark ? "brightness-2" : "brightness-5"} size={22} color={colors.textMuted} />
            <Text style={[styles.settingText, { color: colors.text }]}>Giao diện tối (Dark Mode)</Text>
          </View>
          <Switch
            value={isDark}
            onValueChange={toggleTheme}
            trackColor={{ false: "#CBD5E1", true: colors.indigo + "80" }}
            thumbColor={isDark ? colors.indigo : "#F1F5F9"}
          />
        </View>

        {/* Toggle Sound */}
        <View style={styles.settingItem}>
          <View style={styles.settingLabelContainer}>
            <MaterialIcons name={soundEnabled ? "volume-up" : "volume-off"} size={22} color={colors.textMuted} />
            <Text style={[styles.settingText, { color: colors.text }]}>Âm thanh thông báo</Text>
          </View>
          <Switch
            value={soundEnabled}
            onValueChange={toggleSound}
            trackColor={{ false: "#CBD5E1", true: colors.indigo + "80" }}
            thumbColor={soundEnabled ? colors.indigo : "#F1F5F9"}
          />
        </View>

        {/* Custom Avatars Settings */}
        <TouchableOpacity
          style={styles.settingItem}
          onPress={() => router.push("/study/custom-images" as any)}
          activeOpacity={0.7}
        >
          <View style={styles.settingLabelContainer}>
            <MaterialIcons name="image" size={22} color={colors.textMuted} />
            <Text style={[styles.settingText, { color: colors.text }]}>Ảnh đại diện (Học viên / AI)</Text>
          </View>
          <MaterialIcons name="chevron-right" size={20} color={colors.textMuted} />
        </TouchableOpacity>

        <View style={styles.divider} />

        {/* Dynamic API Configuration */}
        <View style={styles.apiConfigGroup}>
          <Text style={[styles.apiLabel, { color: colors.textMuted }]}>ĐỊA CHỈ API SERVER (BACKEND)</Text>
          <View style={styles.apiInputContainer}>
            <TextInput
              style={[
                styles.apiInput,
                {
                  backgroundColor: isDark ? "#0F172A" : colors.background,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              value={apiUrl}
              onChangeText={setApiUrl}
              placeholder="Nhập địa chỉ Backend..."
              placeholderTextColor={colors.textMuted + "80"}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={[styles.btnSaveApi, { backgroundColor: colors.indigo }]}
              onPress={handleSaveApi}
              activeOpacity={0.8}
            >
              <Text style={styles.btnSaveText}>LƯU</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* AI Token Usage Card */}
      <View style={[styles.cardContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>TIÊU THỤ AI TOKENS</Text>
        <View style={styles.tokenRow}>
          <Text style={[styles.tokenLabel, { color: colors.textMuted }]}>Prompt Tokens</Text>
          <Text style={[styles.tokenValue, { color: colors.text }]}>{tokensUsed?.prompt || 0}</Text>
        </View>
        <View style={styles.tokenRow}>
          <Text style={[styles.tokenLabel, { color: colors.textMuted }]}>Completion Tokens</Text>
          <Text style={[styles.tokenValue, { color: colors.text }]}>{tokensUsed?.completion || 0}</Text>
        </View>
        <View style={styles.tokenRow}>
          <Text style={[styles.tokenLabel, { color: colors.textMuted }]}>Tokens đã dùng</Text>
          <Text style={[styles.tokenValue, { color: colors.indigo, fontWeight: "900" }]}>
            {tokensUsed?.total || 0}
          </Text>
        </View>
      </View>

      {/* Danger Zone Controls */}
      <View style={styles.actionButtonsContainer}>
        <TouchableOpacity
          style={[styles.btnLogout, { borderColor: colors.error }]}
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <MaterialIcons name="exit-to-app" size={20} color={colors.error} />
          <Text style={[styles.btnLogoutText, { color: colors.error }]}>ĐĂNG XUẤT</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.btnReset}
          onPress={handleResetData}
          activeOpacity={0.7}
        >
          <Text style={styles.btnResetText}>ĐẶT LẠI DỮ LIỆU TIẾN TRÌNH</Text>
        </TouchableOpacity>
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
    gap: 16,
    paddingBottom: 40,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    padding: 20,
    gap: 18,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
      },
      android: { elevation: 2 },
    }),
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 22,
    fontWeight: "900",
  },
  profileTextContainer: {
    flex: 1,
    gap: 4,
  },
  usernameText: {
    fontSize: 18,
    fontWeight: "800",
  },
  titleTag: {
    fontSize: 11,
    fontWeight: "800",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: "flex-start",
    overflow: "hidden",
  },
  stageText: {
    fontSize: 12,
    fontWeight: "500",
    marginTop: 2,
  },
  statsCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
    marginBottom: 6,
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statLabel: {
    fontSize: 13,
    fontWeight: "500",
  },
  statValue: {
    fontSize: 15,
    fontWeight: "800",
  },
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
  },
  progressBarBg: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 4,
  },
  progressPercent: {
    fontSize: 11,
    fontWeight: "700",
    width: 32,
    textAlign: "right",
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(142, 142, 147, 0.15)",
    marginVertical: 4,
  },
  streakBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  streakText: {
    fontSize: 14,
    fontWeight: "700",
  },
  cardContainer: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    gap: 12,
  },
  settingItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    height: 40,
  },
  settingLabelContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  settingText: {
    fontSize: 14,
    fontWeight: "600",
  },
  apiConfigGroup: {
    gap: 8,
    marginTop: 4,
  },
  apiLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  apiInputContainer: {
    flexDirection: "row",
    gap: 10,
  },
  apiInput: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    fontSize: 14,
    fontWeight: "600",
  },
  btnSaveApi: {
    width: 60,
    height: 44,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  btnSaveText: {
    color: "#050814",
    fontSize: 12,
    fontWeight: "900",
  },
  tokenRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tokenLabel: {
    fontSize: 13,
    fontWeight: "500",
  },
  tokenValue: {
    fontSize: 14,
    fontWeight: "700",
  },
  actionButtonsContainer: {
    marginTop: 10,
    gap: 12,
  },
  btnLogout: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1.5,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  btnLogoutText: {
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  btnReset: {
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  btnResetText: {
    color: "#EF4444",
    fontSize: 11,
    fontWeight: "700",
    textDecorationLine: "underline",
    letterSpacing: 0.5,
  },
});
