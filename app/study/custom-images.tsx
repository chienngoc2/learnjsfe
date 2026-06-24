import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialIcons, Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/src/context/ThemeContext";
import Header from "../../components/ui/Header";
import Animated, { FadeInDown } from "react-native-reanimated";

export default function CustomImagesScreen() {
  const { colors, isDark } = useTheme();
  const router = useRouter();

  const [userAvatar, setUserAvatar] = useState("");
  const [botAvatar, setBotAvatar] = useState("");

  const DEFAULT_USER_AVATAR = "https://i.pinimg.com/1200x/21/22/b5/2122b5f6964f4dfb1d87ec514be679ae.jpg";
  const DEFAULT_BOT_AVATAR = "https://i.pinimg.com/1200x/c0/b4/1c/c0b41c041088fcfb97d76bfd703c47ac.jpg";

  useEffect(() => {
    (async () => {
      const au = await AsyncStorage.getItem("avatar_user");
      const ab = await AsyncStorage.getItem("avatar_bot");
      if (au) setUserAvatar(au);
      if (ab) setBotAvatar(ab);
    })();
  }, []);

  const handleSave = async () => {
    try {
      if (userAvatar.trim()) {
        await AsyncStorage.setItem("avatar_user", userAvatar.trim());
      } else {
        await AsyncStorage.removeItem("avatar_user");
      }

      if (botAvatar.trim()) {
        await AsyncStorage.setItem("avatar_bot", botAvatar.trim());
      } else {
        await AsyncStorage.removeItem("avatar_bot");
      }

      Alert.alert("Thành công", "Đã lưu cấu hình ảnh đại diện thành công!");
    } catch (e) {
      Alert.alert("Lỗi", "Không thể lưu cấu hình.");
    }
  };

  const handleResetUser = () => {
    setUserAvatar("");
  };

  const handleResetBot = () => {
    setBotAvatar("");
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <Header title="Ảnh đại diện (User / AI)" />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* USER AVATAR CONFIG (Double-Bezel Card) */}
          <Animated.View
            entering={FadeInDown.delay(100).duration(400)}
            style={[styles.outerShell, { backgroundColor: colors.border, borderColor: colors.border }]}
          >
            <View style={[styles.innerCore, { backgroundColor: colors.surface }]}>
              <View style={styles.cardHeader}>
                <View style={[styles.iconBox, { backgroundColor: colors.indigo + "12" }]}>
                  <Ionicons name="person" size={20} color={colors.indigo} />
                </View>
                <Text style={[styles.cardTitle, { color: colors.text }]}>Ảnh đại diện Người dùng</Text>
              </View>

              <Text style={[styles.cardDescription, { color: colors.textMuted }]}>
                Dán link ảnh (URL) để thay đổi avatar của bạn trên Trang chủ và cuộc trò chuyện.
              </Text>

              {/* Preview Box */}
              <View style={styles.previewContainer}>
                <View style={[styles.previewCircle, { borderColor: colors.indigo, backgroundColor: colors.background }]}>
                  <Image
                    source={{ uri: userAvatar.trim() || DEFAULT_USER_AVATAR }}
                    style={styles.previewImage}
                  />
                </View>
                {userAvatar.trim() ? (
                  <TouchableOpacity
                    style={[styles.resetInputBtn, { borderColor: colors.border }]}
                    onPress={handleResetUser}
                    activeOpacity={0.7}
                  >
                    <Text style={{ color: colors.error, fontSize: 12, fontWeight: "600" }}>Xóa link</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={[styles.previewLabel, { color: colors.textMuted }]}>Mặc định (Dicebear)</Text>
                )}
              </View>

              {/* Input Field */}
              <View style={[styles.inputWrapper, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  value={userAvatar}
                  onChangeText={setUserAvatar}
                  placeholder="https://example.com/avatar.jpg"
                  placeholderTextColor={colors.textMuted + "80"}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>
          </Animated.View>

          {/* BOT AVATAR CONFIG (Double-Bezel Card) */}
          <Animated.View
            entering={FadeInDown.delay(200).duration(400)}
            style={[styles.outerShell, { backgroundColor: colors.border, borderColor: colors.border }]}
          >
            <View style={[styles.innerCore, { backgroundColor: colors.surface }]}>
              <View style={styles.cardHeader}>
                <View style={[styles.iconBox, { backgroundColor: colors.indigo + "12" }]}>
                  <Ionicons name="chatbubble-ellipses" size={20} color={colors.indigo} />
                </View>
                <Text style={[styles.cardTitle, { color: colors.text }]}>Ảnh đại diện AI Emma</Text>
              </View>

              <Text style={[styles.cardDescription, { color: colors.textMuted }]}>
                https://i.pinimg.com/1200x/c0/b4/1c/c0b41c041088fcfb97d76bfd703c47ac.jpg
              </Text>

              {/* Preview Box */}
              <View style={styles.previewContainer}>
                <View style={[styles.previewCircle, { borderColor: colors.indigo, backgroundColor: colors.background }]}>
                  <Image
                    source={{ uri: botAvatar.trim() || DEFAULT_BOT_AVATAR }}
                    style={styles.previewImage}
                  />
                </View>
                {botAvatar.trim() ? (
                  <TouchableOpacity
                    style={[styles.resetInputBtn, { borderColor: colors.border }]}
                    onPress={handleResetBot}
                    activeOpacity={0.7}
                  >
                    <Text style={{ color: colors.error, fontSize: 12, fontWeight: "600" }}>Xóa link</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={[styles.previewLabel, { color: colors.textMuted }]}>Mặc định (Emma)</Text>
                )}
              </View>

              {/* Input Field */}
              <View style={[styles.inputWrapper, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  value={botAvatar}
                  onChangeText={setBotAvatar}
                  placeholder="https://example.com/emma.jpg"
                  placeholderTextColor={colors.textMuted + "80"}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>
          </Animated.View>

          {/* SUGGESTIONS CARD */}
          <Animated.View
            entering={FadeInDown.delay(250).duration(400)}
            style={[styles.outerShell, { backgroundColor: colors.border, borderColor: colors.border }]}
          >
            <View style={[styles.innerCore, { backgroundColor: colors.surface }]}>
              <View style={styles.cardHeader}>
                <View style={[styles.iconBox, { backgroundColor: colors.indigo + "12" }]}>
                  <Ionicons name="sparkles" size={20} color={colors.indigo} />
                </View>
                <Text style={[styles.cardTitle, { color: colors.text }]}>Gợi ý ảnh đại diện đẹp</Text>
              </View>

              <Text style={[styles.cardDescription, { color: colors.textMuted }]}>
                Bấm nút dưới mỗi ảnh để áp dụng ngay lập tức mà không cần copy link.
              </Text>

              {/* Emma Avatars Grid */}
              <Text style={[styles.suggestGroupTitle, { color: colors.indigo }]}>🌸 Ảnh Emma (Cho AI)</Text>
              <View style={styles.suggestGrid}>
                {[
                  { label: "Dễ thương", url: "https://api.dicebear.com/7.x/adventurer/png?seed=EmmaCute" },
                  { label: "Trí tuệ", url: "https://api.dicebear.com/7.x/lorelei/png?seed=EmmaSmart" },
                  { label: "Phong cách", url: "https://api.dicebear.com/7.x/avataaars/png?seed=EmmaSensei" },
                  { label: "Robot", url: "https://api.dicebear.com/7.x/bottts/png?seed=EmmaBot" },
                ].map((item, idx) => (
                  <View key={idx} style={[styles.suggestCard, { borderColor: colors.border, backgroundColor: colors.background }]}>
                    <View style={{ width: 50, height: 50, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.surface }}>
                      <Image source={{ uri: item.url }} style={styles.suggestImg} />
                    </View>
                    <Text style={[styles.suggestLabelText, { color: colors.text }]} numberOfLines={1}>{item.label}</Text>
                    <TouchableOpacity
                      style={[styles.suggestApplyBtn, { backgroundColor: colors.indigo }]}
                      onPress={() => setBotAvatar(item.url)}
                    >
                      <Text style={styles.suggestApplyBtnText}>Áp dụng</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>

              {/* User Avatars Grid */}
              <Text style={[styles.suggestGroupTitle, { color: colors.indigo }]}>🎓 Ảnh Học Viên (Cho Bạn)</Text>
              <View style={styles.suggestGrid}>
                {[
                  { label: "Anime Nam", url: DEFAULT_USER_AVATAR },
                  { label: "Anime Nữ", url: "https://api.dicebear.com/7.x/adventurer/png?seed=Sakura" },
                  { label: "Cute Boy", url: "https://api.dicebear.com/7.x/lorelei/png?seed=Felix" },
                  { label: "Cute Girl", url: "https://api.dicebear.com/7.x/lorelei/png?seed=Heidi" },
                ].map((item, idx) => (
                  <View key={idx} style={[styles.suggestCard, { borderColor: colors.border, backgroundColor: colors.background }]}>
                    <View style={{ width: 50, height: 50, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.surface }}>
                      <Image source={{ uri: item.url }} style={styles.suggestImg} />
                    </View>
                    <Text style={[styles.suggestLabelText, { color: colors.text }]} numberOfLines={1}>{item.label}</Text>
                    <TouchableOpacity
                      style={[styles.suggestApplyBtn, { backgroundColor: colors.indigo }]}
                      onPress={() => setUserAvatar(item.url)}
                    >
                      <Text style={styles.suggestApplyBtnText}>Áp dụng</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
          </Animated.View>

          {/* SAVE BUTTON */}
          <Animated.View entering={FadeInDown.delay(300).duration(400)}>
            <TouchableOpacity
              style={styles.saveBtn}
              onPress={handleSave}
              activeOpacity={0.8}
            >
              <View style={[styles.saveGradient, { backgroundColor: colors.indigo }]}>
                <MaterialIcons name="save" size={20} color="#FFF" />
                <Text style={styles.saveBtnText}>Lưu cấu hình</Text>
              </View>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  // Double-Bezel Card Technique
  outerShell: {
    padding: 2,
    borderRadius: 24,
    borderWidth: 1,
  },
  innerCore: {
    padding: 18,
    borderRadius: 22,
    gap: 12,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  cardDescription: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  previewContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginVertical: 4,
  },
  previewCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1.5,
    overflow: "hidden",
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  previewLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
  resetInputBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  inputWrapper: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  input: {
    fontSize: 13.5,
    fontWeight: "500",
    padding: 0,
  },
  saveBtn: {
    borderRadius: 16,
    overflow: "hidden",
    marginTop: 8,
    ...Platform.select({
      ios: {
        shadowColor: "#4F46E5",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  saveGradient: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 14,
    gap: 8,
  },
  saveBtnText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "800",
  },
  suggestGroupTitle: {
    fontSize: 13,
    fontWeight: "800",
    marginTop: 14,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  suggestGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "space-between",
  },
  suggestCard: {
    width: "48%",
    borderRadius: 16,
    borderWidth: 1,
    padding: 10,
    alignItems: "center",
    gap: 6,
  },
  suggestImg: {
    width: 50,
    height: 50,
    borderRadius: 10,
  },
  suggestLabelText: {
    fontSize: 11,
    fontWeight: "700",
  },
  suggestApplyBtn: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 10,
    width: "100%",
    alignItems: "center",
  },
  suggestApplyBtnText: {
    color: "#FFF",
    fontSize: 11,
    fontWeight: "800",
  },
});
