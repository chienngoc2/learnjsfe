import React, { useState, useCallback, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  Pressable,
  Platform,
  TouchableOpacity,
  Animated,
  Modal,
} from "react-native";
import {
  useLocalSearchParams,
  useRouter,
  Stack,
  useFocusEffect,
} from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import api from "../../services/api";
import { useTheme } from "@/src/context/ThemeContext";

// =========================================================================
// 🚀 THÀNH PHẦN 1: SUB-COMPONENT THẺ NGỮ PHÁP (ĐÃ CẬP NHẬT MẢNG EXAMPLES)
// =========================================================================
function GrammarCardItem({
  item,
  index,
  onEdit,
  onDelete,
}: {
  item: any;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { colors, isDark } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);
  const router = useRouter();
  const { topicId, title } = useLocalSearchParams<{ topicId?: string; title?: string }>();

  return (
    <View 
      style={[
        styles.card, 
        { backgroundColor: colors.surface, borderColor: colors.border },
        isExpanded && { borderColor: colors.indigo, borderWidth: 1.5 }
      ]}
    >
      <Pressable
        onPress={() => setIsExpanded(!isExpanded)}
        style={styles.cardHeaderAction}
      >
        <View style={styles.headerLeft}>
          <View
            style={[
              styles.indexCircle, 
              { backgroundColor: isDark ? "#1E293B" : "#E2E8F0" },
              isExpanded && { backgroundColor: colors.indigo }
            ]}
          >
            <Text 
              style={[
                styles.indexText, 
                { color: isExpanded ? "#050814" : colors.text }
              ]}
            >
              {String(index + 1).padStart(2, '0')}
            </Text>
          </View>
          <Text
            style={[
              styles.cardTitle, 
              { color: colors.text },
              isExpanded && { color: colors.indigo }
            ]}
            numberOfLines={2}
          >
            {item.title}
          </Text>
        </View>
        <Feather
          name={isExpanded ? "chevron-up" : "chevron-down"}
          size={22}
          color={isExpanded ? colors.indigo : colors.textMuted}
        />
      </Pressable>

      {isExpanded && (
        <View style={styles.cardContent}>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          
          {/* 1. CỤM CÔNG THỨC (Màu Vàng Kyoto Gold) */}
          {item.formula ? (
            <View 
              style={[
                styles.formulaBox, 
                { 
                  backgroundColor: isDark ? "#1E1A10" : "#FDF8EB", 
                  borderColor: isDark ? "rgba(245, 199, 107, 0.4)" : "rgba(176, 130, 46, 0.3)" 
                }
              ]}
            >
              <View style={styles.sectionHeaderRow}>
                <Feather
                  name="code"
                  size={14}
                  color={colors.indigo}
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.sectionTitle, { color: colors.indigo, marginBottom: 0 }]}>
                  CÔNG THỨC ÁP DỤNG
                </Text>
              </View>
              <View style={{ flexDirection: "column", gap: 6, marginTop: 8, alignItems: "flex-start" }}>
                {item.formula.split("|").map((part: string, idx: number) => (
                  <View 
                    key={idx} 
                    style={[
                      styles.formulaPill, 
                      { 
                        backgroundColor: isDark ? "rgba(245, 199, 107, 0.1)" : "rgba(176, 130, 46, 0.05)",
                        borderColor: isDark ? "rgba(245, 199, 107, 0.25)" : "rgba(176, 130, 46, 0.2)"
                      }
                    ]}
                  >
                    <Text style={[styles.formulaText, { color: colors.indigo }]}>
                      {part.trim()}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* 2. CỤM Ý NGHĨA (Màu Xanh Thủy Triều) */}
          <View 
            style={[
              styles.meaningBox, 
              { 
                backgroundColor: isDark ? "#0A1424" : "#F0F7FF", 
                borderColor: isDark ? "rgba(77, 168, 255, 0.35)" : "rgba(77, 168, 255, 0.25)" 
              }
            ]}
          >
            <View style={styles.sectionHeaderRow}>
              <Feather
                name="info"
                size={14}
                color={colors.blue}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.sectionTitle, { color: colors.blue, marginBottom: 0 }]}>
                Ý NGHĨA & NGỮ CẢNH
              </Text>
            </View>
            <Text style={[styles.sectionContent, { color: colors.text, marginTop: 8 }]}>
              {item.meaning}
            </Text>
          </View>

          {/* 3. CỤM VÍ DỤ MẪU (Màu Tím Linh Thảo) */}
          {item.examples && item.examples.length > 0 ? (
            <View 
              style={[
                styles.examplesBox,
                { 
                  backgroundColor: isDark ? "#120F24" : "#F5F3FF", 
                  borderColor: isDark ? "rgba(124, 92, 255, 0.35)" : "rgba(124, 92, 255, 0.25)" 
                }
              ]}
            >
              <View style={styles.sectionHeaderRow}>
                <Feather
                  name="book-open"
                  size={14}
                  color={colors.purple}
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.sectionTitle, { color: colors.purple, marginBottom: 0 }]}>
                  CÂU VÍ DỤ MẪU
                </Text>
              </View>
              <View style={{ marginTop: 8 }}>
                {item.examples.map((ex: any, exIdx: number) => {
                  let jp = "";
                  let vn = "";
                  if (typeof ex === "string") {
                    const parts = ex.split(":");
                    jp = parts[0]?.trim() || "";
                    vn = parts.slice(1).join(":")?.trim() || "";
                  } else if (ex && typeof ex === "object") {
                    jp = ex.jp || "";
                    vn = ex.vn || "";
                  }
                  return (
                    <View key={exIdx} style={[styles.exampleItem, { borderLeftColor: colors.purple }]}>
                      <Text style={[styles.exampleTextJp, { color: colors.text }]}>
                        🇯🇵 {jp}
                      </Text>
                      {vn ? (
                        <Text style={[styles.exampleTextVn, { color: colors.textMuted }]}>
                          🇻🇳 {vn}
                        </Text>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </View>
          ) : item.example ? (
            <View 
              style={[
                styles.examplesBox,
                { 
                  backgroundColor: isDark ? "#120F24" : "#F5F3FF", 
                  borderColor: isDark ? "rgba(124, 92, 255, 0.35)" : "rgba(124, 92, 255, 0.25)" 
                }
              ]}
            >
              <View style={styles.sectionHeaderRow}>
                <Feather
                  name="book-open"
                  size={14}
                  color={colors.purple}
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.sectionTitle, { color: colors.purple, marginBottom: 0 }]}>
                  CÂU VÍ DỤ MẪU
                </Text>
              </View>
              <View style={{ marginTop: 8 }}>
                <View style={[styles.exampleItem, { borderLeftColor: colors.purple }]}>
                  <Text style={[styles.exampleTextJp, { color: colors.text }]}>
                    {typeof item.example === "string" && item.example.includes(":") ? (
                      `🇯🇵 ${item.example.split(":")[0]?.trim() || ""}`
                    ) : (
                      item.example
                    )}
                  </Text>
                  {typeof item.example === "string" && item.example.includes(":") ? (
                    <Text style={[styles.exampleTextVn, { color: colors.textMuted }]}>
                      🇻🇳 {item.example.split(":").slice(1).join(":")?.trim() || ""}
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>
          ) : null}

          {/* CỤM LUYỆN TẬP ĐỘC QUYỀN */}
          <View style={styles.practiceActionContainer}>
            <View style={styles.practiceRow}>
              <TouchableOpacity 
                style={[
                  styles.btnPracticeGrammar, 
                  { backgroundColor: colors.indigoLight, borderColor: colors.indigo }
                ]} 
                onPress={() => router.push({
                  pathname: "/luyen-tap/grammar",
                  params: { topicTitle: item.belongingTopic || title, mode: "match" }
                } as any)}
              >
                <Feather name="layers" size={14} color={colors.indigo} />
                <Text style={[styles.btnPracticeText, { color: colors.indigo }]} numberOfLines={1}>Game Ghép Câu</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[
                  styles.btnPracticeGrammar, 
                  { backgroundColor: isDark ? "rgba(245, 158, 11, 0.12)" : "#FEF3C7", borderColor: colors.amber }
                ]} 
                onPress={() => router.push({
                  pathname: "/luyen-tap/grammar",
                  params: { title: item.title, mode: "ai_translation" }
                } as any)}
              >
                <Feather name="zap" size={14} color={colors.amber} />
                <Text style={[styles.btnPracticeText, { color: colors.amber }]} numberOfLines={1}>AI Luyện Tập</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={[
                styles.btnPracticeQuiz, 
                { backgroundColor: isDark ? "rgba(16, 185, 129, 0.12)" : "#ECFDF5", borderColor: "#10B981" }
              ]} 
              onPress={() => router.push({
                pathname: "/luyen-tap/quiz",
                params: { topicId: topicId }
              } as any)}
            >
              <Feather name="help-circle" size={14} color="#10B981" />
              <Text style={[styles.btnPracticeText, { color: "#10B981" }]}>Trắc Nghiệm Từ Vựng</Text>
            </TouchableOpacity>
          </View>

          {/* CỤM HÀNH ĐỘNG */}
          <View style={[styles.itemActionContainer, { borderTopColor: colors.border }]}>
            <TouchableOpacity 
              style={[
                styles.btnItemEdit, 
                { backgroundColor: colors.indigoLight, borderColor: colors.indigo }
              ]} 
              onPress={onEdit}
            >
              <Feather name="edit-2" size={14} color={colors.indigo} />
              <Text style={[styles.btnItemEditText, { color: colors.indigo }]}>Sửa cấu trúc</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[
                styles.btnItemDelete, 
                { backgroundColor: colors.errorLight, borderColor: colors.error }
              ]} 
              onPress={onDelete}
            >
              <Feather name="trash-2" size={14} color={colors.error} />
              <Text style={[styles.btnItemDeleteText, { color: colors.error }]}>Xóa cấu trúc</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

// =========================================================================
// 🚀 THÀNH PHẦN 2: MÀN HÌNH CHÍNH (GRAMMAR VIEWER SCREEN)
// =========================================================================
export default function GrammarViewerScreen() {
  const { topicId, title } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  
  const [grammarData, setGrammarData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [toast, setToast] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const [confirmModal, setConfirmModal] = useState<{
    visible: boolean;
    id: string | null;
  }>({
    visible: false,
    id: null,
  });

  const triggerToast = (type: "success" | "error", text: string) => {
    setToast({ type, text });
    Animated.timing(slideAnim, {
      toValue: 40,
      duration: 400,
      useNativeDriver: true,
    }).start();
    setTimeout(() => {
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 400,
        useNativeDriver: true,
      }).start(() => setToast(null));
    }, 3000);
  };

  const fetchGrammarList = useCallback(async () => {
    try {
      const res = await api.get(`/api/vocab/list/${topicId}`);
      if (res.data.success && res.data.data) {
        setGrammarData(res.data.data.grammarPoints || []);
      }
    } catch (error) {
      console.log("Lỗi tải data:", error);
    } finally {
      setLoading(false);
    }
  }, [topicId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchGrammarList();
    }, [fetchGrammarList]),
  );

  const handleAddNew = () => {
    router.push(
      `/study/add-grammar?topicId=${topicId}&currentTitle=${encodeURIComponent(title as string)}`,
    );
  };

  const handleEditItem = (item: any) => {
    const cleanExamples =
      item.examples && item.examples.length > 0
        ? item.examples
        : item.example
          ? [item.example]
          : [""];

    router.push({
      pathname: "/study/add-grammar",
      params: {
        topicId: topicId,
        grammarId: item._id,
        topicName: item.topicName || title,
        title: item.title,
        formula: item.formula || "",
        meaning: item.meaning,
        examples: JSON.stringify(cleanExamples),
      },
    });
  };

  const requestDelete = (grammarId: string) => {
    if (!grammarId) {
      triggerToast("error", "Lỗi: Cấu trúc này không có ID!");
      return;
    }
    setConfirmModal({ visible: true, id: grammarId });
  };

  const executeDelete = async () => {
    const grammarId = confirmModal.id;
    setConfirmModal({ visible: false, id: null });

    if (!grammarId) return;

    try {
      const res = await api.delete(
        `/api/vocab/delete-grammar/${topicId}/${grammarId}`,
      );
      if (res.data.success) {
        triggerToast("success", "Đã xóa cấu trúc ngữ pháp thành công!");
        fetchGrammarList();
      }
    } catch (error) {
      triggerToast("error", "Không thể xóa ngữ pháp lúc này.");
      console.log(error);
    }
  };

  const bgColors: readonly [string, string, ...string[]] = isDark 
    ? ["#050814", "#0a0e1c"] 
    : ["#f5edd6", "#fcf8ed"];

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: bgColors[0] }]}>
        <ActivityIndicator size="large" color={colors.indigo} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: bgColors[0] }]}>
      <LinearGradient colors={bgColors} style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />

        {/* COMPONENT TOAST */}
        {toast && (
          <Animated.View
            style={[
              styles.toastContainer,
              toast.type === "success" 
                ? { backgroundColor: "#F0FDF4", borderColor: "#A7F3D0" } 
                : { backgroundColor: "#FEF2F2", borderColor: "#FCA5A5" },
              { transform: [{ translateY: slideAnim }] },
            ]}
          >
            <Text style={styles.toastText}>{toast.text}</Text>
          </Animated.View>
        )}

        {/* COMPONENT MODAL XÁC NHẬN XÓA */}
        <Modal transparent visible={confirmModal.visible} animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalBox, { backgroundColor: colors.surface }]}>
              <View style={[styles.modalIconBox, { backgroundColor: colors.errorLight }]}>
                <Feather name="alert-triangle" size={32} color={colors.error} />
              </View>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Xác nhận xóa</Text>
              <Text style={[styles.modalMessage, { color: colors.textMuted }]}>
                Bạn có chắc chắn muốn xóa cấu trúc này không? Hành động này không
                thể hoàn tác.
              </Text>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.btnModalCancel, { backgroundColor: isDark ? "#1E293B" : "#E2E8F0" }]}
                  onPress={() => setConfirmModal({ visible: false, id: null })}
                >
                  <Text style={[styles.btnModalCancelText, { color: colors.text }]}>Hủy Bỏ</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btnModalConfirm, { backgroundColor: colors.error }]}
                  onPress={executeDelete}
                >
                  <Text style={styles.btnModalConfirmText}>Xóa Luôn</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* HEADER */}
        <View style={[
          styles.customHeader,
          { paddingTop: insets.top > 0 ? insets.top : (Platform.OS === "android" ? 50 : 20) }
        ]}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.btnBackHeader,
              { 
                backgroundColor: colors.surface, 
                borderColor: colors.border,
                transform: [{ scale: pressed ? 0.95 : 1 }]
              },
            ]}
          >
            <Feather name="chevron-left" size={20} color={colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
            Sách Ngữ Pháp: {title}
          </Text>
          <Pressable 
            style={({ pressed }) => [
              styles.btnHeaderAdd, 
              { 
                backgroundColor: colors.indigo,
                transform: [{ scale: pressed ? 0.95 : 1 }]
              }
            ]} 
            onPress={handleAddNew}
          >
            <Feather name="plus" size={22} color="#050814" />
          </Pressable>
        </View>

        {/* LIST NGỮ PHÁP */}
        {grammarData.length === 0 ? (
          <View style={styles.center}>
            <Feather name="book-open" size={60} color={colors.textMuted} style={{ marginBottom: 16 }} />
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>Chưa có tài liệu ngữ pháp nào.</Text>
            <Pressable 
              style={({ pressed }) => [
                styles.btnEmpty, 
                { backgroundColor: colors.indigo, transform: [{ scale: pressed ? 0.95 : 1 }] }
              ]} 
              onPress={handleAddNew}
            >
              <Text style={{ color: "#050814", fontWeight: "bold" }}>
                Thêm mới ngay
              </Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {grammarData.map((item, index) => (
              <GrammarCardItem
                key={item._id || index}
                item={item}
                index={index}
                onEdit={() => handleEditItem(item)}
                onDelete={() => requestDelete(item._id)}
              />
            ))}
          </ScrollView>
        )}
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyText: {
    color: "#64748B",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 20,
  },
  btnEmpty: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  customHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 15,
    backgroundColor: "transparent",
    zIndex: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    flex: 1,
    textAlign: "center",
    marginHorizontal: 10,
  },
  btnBackHeader: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  btnHeaderAdd: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  scrollContent: { padding: 16, paddingBottom: 40 },

  card: {
    borderRadius: 20,
    marginBottom: 14,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 1,
  },
  cardHeaderAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    paddingRight: 10,
  },
  indexCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  indexText: { 
    fontWeight: "700", 
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  cardTitle: { 
    fontSize: 18, 
    fontWeight: "800", 
    flex: 1,
    lineHeight: 24,
  },
  cardContent: { paddingHorizontal: 18, paddingBottom: 18 },
  divider: { height: 1, marginBottom: 16 },
  
  formulaBox: {
    padding: 14,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
  },
  meaningBox: {
    padding: 14,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
  },
  examplesBox: {
    padding: 14,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  
  formulaPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  formulaText: { 
    fontSize: 14, 
    fontWeight: "800", 
    letterSpacing: 0.5,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  sectionContent: { 
    fontSize: 16, 
    lineHeight: 24,
    fontWeight: "500",
  },

  exampleItem: {
    paddingLeft: 12,
    borderLeftWidth: 2,
    marginBottom: 10,
  },
  exampleTextJp: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "700",
  },
  exampleTextVn: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
    marginTop: 2,
  },
  itemActionContainer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  btnItemEdit: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    marginRight: 10,
    borderWidth: 1,
  },
  btnItemEditText: {
    fontSize: 13,
    fontWeight: "700",
    marginLeft: 6,
  },
  btnItemDelete: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  btnItemDeleteText: {
    fontSize: 13,
    fontWeight: "700",
    marginLeft: 6,
  },

  toastContainer: {
    position: "absolute",
    top: 10,
    right: 16,
    padding: 14,
    borderRadius: 12,
    zIndex: 9999,
    borderWidth: 1,
  },
  toastText: { fontWeight: "700", color: "#1E293B" },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalBox: {
    width: 320,
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    elevation: 10,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  modalIconBox: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 8,
  },
  modalMessage: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  modalButtons: {
    flexDirection: "row",
    width: "100%",
    justifyContent: "space-between",
  },
  btnModalCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    marginRight: 8,
  },
  btnModalCancelText: { fontWeight: "700", fontSize: 14 },
  btnModalConfirm: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    marginLeft: 8,
  },
  btnModalConfirmText: { color: "#FFF", fontWeight: "700", fontSize: 14 },
  practiceActionContainer: {
    flexDirection: "column",
    marginTop: 14,
    gap: 8,
  },
  practiceRow: {
    flexDirection: "row",
    gap: 8,
  },
  btnPracticeGrammar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  btnPracticeQuiz: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  btnPracticeText: {
    fontSize: 13,
    fontWeight: "700",
    marginLeft: 6,
  },
});
