import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter, Stack } from "expo-router";
import api from "../services/api";
import { useTheme } from "@/src/context/ThemeContext";
import { Feather, Ionicons } from "@expo/vector-icons";

export default function LoginScreen() {
  const { colors } = useTheme();
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAuth = async () => {
    if (!username.trim() || !password.trim()) {
      setError("Vui lòng điền đầy đủ tài khoản và mật khẩu.");
      return;
    }

    if (isRegistering && password !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const endpoint = isRegistering ? "/api/auth/register" : "/api/auth/login";
      const payload = isRegistering
        ? { username: username.trim(), password: password.trim(), role: "student" }
        : { username: username.trim(), password: password.trim() };

      const res = await api.post(endpoint, payload);

      if (res.data && res.data.success) {
        await AsyncStorage.setItem("token", res.data.token);
        await AsyncStorage.setItem("user", JSON.stringify(res.data.user));
        router.replace("/(tabs)");
      } else {
        setError(res.data.message || "Xác thực không thành công.");
      }
    } catch (err: any) {
      console.error("Lỗi xác thực:", err);
      if (err.response && err.response.data && err.response.data.message) {
        setError(err.response.data.message);
      } else {
        setError("Không thể kết nối đến server backend.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        
        {/* Double-Bezel Card Container */}
        <Animated.View 
          entering={FadeInDown.duration(800)}
          style={styles.outerShell}
        >
          {/* Inner core */}
          <View style={styles.innerCore}>
            
            {/* Header */}
            <View style={styles.headerContainer}>
              <View style={styles.iconCircle}>
                <Ionicons name="sparkles" size={20} color="#4255ff" />
              </View>
              <Text style={styles.title}>AI SENSEI</Text>
              <Text style={styles.subtitle}>QUIZLET LEARNING APP</Text>
            </View>

            {/* Error Message */}
            {error && (
              <View style={styles.errorBox}>
                <Feather name="alert-circle" size={14} color="#ef4444" style={{ marginRight: 6 }} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Form Fields */}
            <View style={styles.form}>
              
              {/* Username field */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Tên tài khoản</Text>
                <View style={styles.inputWrapper}>
                  <Feather name="user" size={14} color="#939bb4" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Nhập tên đăng nhập..."
                    placeholderTextColor="rgba(147, 155, 180, 0.5)"
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                    editable={!loading}
                  />
                </View>
              </View>

              {/* Password field */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Mật khẩu</Text>
                <View style={styles.inputWrapper}>
                  <Feather name="lock" size={14} color="#939bb4" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Nhập mật khẩu..."
                    placeholderTextColor="rgba(147, 155, 180, 0.5)"
                    secureTextEntry
                    value={password}
                    onChangeText={setPassword}
                    autoCapitalize="none"
                    editable={!loading}
                  />
                </View>
              </View>

              {/* Confirm Password field */}
              {isRegistering && (
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Xác nhận mật khẩu</Text>
                  <View style={styles.inputWrapper}>
                    <Feather name="lock" size={14} color="#939bb4" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Xác nhận mật khẩu..."
                      placeholderTextColor="rgba(147, 155, 180, 0.5)"
                      secureTextEntry
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      autoCapitalize="none"
                      editable={!loading}
                    />
                  </View>
                </View>
              )}

              {/* Submit Button with Button-in-Button Trailing Icon */}
              <TouchableOpacity
                style={styles.submitButton}
                onPress={handleAuth}
                disabled={loading}
                activeOpacity={0.9}
              >
                <Text style={styles.submitButtonText}>
                  {loading ? "ĐANG XỬ LÝ..." : (isRegistering ? "ĐĂNG KÝ TÀI KHOẢN" : "ĐĂNG NHẬP HỆ THỐNG")}
                </Text>
                <View style={styles.arrowCircle}>
                  {loading ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Feather name="arrow-right" size={14} color="#ffffff" />
                  )}
                </View>
              </TouchableOpacity>

              {/* Switch Mode Link */}
              <TouchableOpacity 
                onPress={() => {
                  setIsRegistering(!isRegistering);
                  setError(null);
                }}
                style={styles.toggleLink}
              >
                <Text style={styles.toggleLinkText}>
                  {isRegistering ? "Đã có tài khoản? Đăng nhập ngay" : "Chưa có tài khoản? Đăng ký ngay"}
                </Text>
              </TouchableOpacity>
            </View>

          </View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050505",
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  outerShell: {
    width: "100%",
    maxWidth: 380,
    padding: 8,
    borderRadius: 36,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
  },
  innerCore: {
    padding: 24,
    borderRadius: 28,
    backgroundColor: "#0d0f1a",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  headerContainer: {
    alignItems: "center",
    marginBottom: 24,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(66, 85, 255, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 9,
    fontWeight: "700",
    color: "#4255ff",
    letterSpacing: 2,
    marginTop: 6,
    backgroundColor: "rgba(66, 85, 255, 0.08)",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: "hidden",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderColor: "rgba(239, 68, 68, 0.2)",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  errorText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#ef4444",
    flex: 1,
  },
  form: {
    gap: 16,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 10,
    fontWeight: "700",
    color: "#939bb4",
    textTransform: "uppercase",
    letterSpacing: 1,
    paddingLeft: 4,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    paddingHorizontal: 16,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: "100%",
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "500",
  },
  submitButton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    height: 50,
    borderRadius: 9999,
    backgroundColor: "#4255ff",
    paddingLeft: 24,
    paddingRight: 8,
    marginTop: 10,
  },
  submitButtonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  arrowCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  toggleLink: {
    marginTop: 10,
    alignItems: "center",
  },
  toggleLinkText: {
    color: "#4255ff",
    fontSize: 12,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
});
