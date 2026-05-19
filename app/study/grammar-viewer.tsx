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
import { MaterialIcons } from "@expo/vector-icons";
import api from "../../services/api";

// =========================================================================
// 🚀 THÀNH PHẦN 1: SUB-COMPONENT THÈ NGỮ PHÁP (ĐÃ CẬP NHẬT MẢNG EXAMPLES)
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
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <View style={[styles.card, isExpanded && styles.cardActive]}>
      <Pressable
        onPress={() => setIsExpanded(!isExpanded)}
        style={styles.cardHeaderAction}
      >
        <View style={styles.headerLeft}>
          <View
            style={[styles.indexCircle, isExpanded && styles.indexCircleActive]}
          >
            <Text style={styles.indexText}>{index + 1}</Text>
          </View>
          <Text
            style={[styles.cardTitle, isExpanded && { color: "#EA580C" }]}
            numberOfLines={1}
          >
            {item.title}
          </Text>
        </View>
        <MaterialIcons
          name={isExpanded ? "keyboard-arrow-up" : "keyboard-arrow-down"}
          size={26}
          color={isExpanded ? "#EA580C" : "#64748B"}
        />
      </Pressable>

      {isExpanded && (
        <View style={styles.cardContent}>
          <View style={styles.divider} />
          {item.formula ? (
            <View style={styles.formulaBox}>
              <MaterialIcons
                name="functions"
                size={18}
                color="#D97706"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.formulaText}>{item.formula}</Text>
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ý nghĩa & Cách dùng:</Text>
            <Text style={styles.sectionContent}>{item.meaning}</Text>
          </View>

          {/* 🚀 VỊ TRÍ 1 ĐÃ SỬA: DUYỆT ĐỘNG MẢNG VÍ DỤ MẪU EXAMPLES */}
          {item.examples && item.examples.length > 0 ? (
            <View style={[styles.section, styles.exampleSection]}>
              <Text style={styles.sectionTitle}>Danh sách ví dụ mẫu:</Text>
              {item.examples.map((ex: string, exIdx: number) => (
                <Text key={exIdx} style={styles.exampleText}>
                  {item.examples.length > 1 ? `• ` : ""}
                  {ex}
                </Text>
              ))}
            </View>
          ) : item.example ? (
            /* Khiên phòng thủ: Nếu trúng data chữ đơn cũ dưới DB, vẫn hiện mượt mà */
            <View style={[styles.section, styles.exampleSection]}>
              <Text style={styles.sectionTitle}>Ví dụ mẫu:</Text>
              <Text style={styles.exampleText}>{item.example}</Text>
            </View>
          ) : null}

          <View style={styles.itemActionContainer}>
            <TouchableOpacity style={styles.btnItemEdit} onPress={onEdit}>
              <MaterialIcons name="edit" size={16} color="#0369A1" />
              <Text style={styles.btnItemEditText}>Chỉnh sửa</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.btnItemDelete} onPress={onDelete}>
              <MaterialIcons name="delete-outline" size={16} color="#B91C1C" />
              <Text style={styles.btnItemDeleteText}>Xóa cấu trúc</Text>
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
  const [grammarData, setGrammarData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isHovered, setIsHovered] = useState(false);

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

  // 🚀 VỊ TRÍ 2 ĐÃ SỬA: ĐÓNG GÓI MẢNG EXAMPLES QUA PARAMS ROUTER
  const handleEditItem = (item: any) => {
    // Gom mảng ví dụ thành mảng sạch, nếu trúng data cũ thì bọc chuỗi đơn thành mảng []
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
        // 🔥 MẸO HAY CHÍ MẠNG: Mã hóa mảng ví dụ thành một chuỗi JSON String để chuyển trang an toàn, không bị rớt dữ liệu
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
        triggerToast("success", "🗑️ Đã xóa cấu trúc ngữ pháp!");
        fetchGrammarList();
      }
    } catch (error) {
      triggerToast("error", "Không thể xóa ngữ pháp lúc này.");
      console.log(error);
    }
  };

  if (loading)
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#F97316" />
      </View>
    );

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* COMPONENT TOAST */}
      {toast && (
        <Animated.View
          style={[
            styles.toastContainer,
            toast.type === "success" ? styles.toastSuccess : styles.toastError,
            { transform: [{ translateY: slideAnim }] },
          ]}
        >
          <Text style={styles.toastText}>{toast.text}</Text>
        </Animated.View>
      )}

      {/* COMPONENT MODAL XÁC NHẬN XÓA */}
      <Modal transparent visible={confirmModal.visible} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalIconBox}>
              <MaterialIcons name="warning" size={32} color="#EF4444" />
            </View>
            <Text style={styles.modalTitle}>Xác nhận xóa</Text>
            <Text style={styles.modalMessage}>
              Bạn có chắc chắn muốn xóa cấu trúc này không? Hành động này không
              thể hoàn tác.
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.btnModalCancel}
                onPress={() => setConfirmModal({ visible: false, id: null })}
              >
                <Text style={styles.btnModalCancelText}>Hủy Bỏ</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btnModalConfirm}
                onPress={executeDelete}
              >
                <Text style={styles.btnModalConfirmText}>Xóa Luôn</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* HEADER */}
      <View style={styles.customHeader}>
        <Pressable
          onPress={() => router.back()}
          onHoverIn={() => setIsHovered(true)}
          onHoverOut={() => setIsHovered(false)}
          style={({ pressed }) => [
            styles.btnBackHeader,
            (isHovered || pressed) && styles.btnBackHeaderHover,
          ]}
        >
          {({ pressed }) => (
            <MaterialIcons
              name="arrow-back-ios"
              size={20}
              color={isHovered || pressed ? "#EA580C" : "#475569"}
              style={{ marginLeft: 6 }}
            />
          )}
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Sổ Tay: {title}
        </Text>
        <TouchableOpacity style={styles.btnHeaderAdd} onPress={handleAddNew}>
          <MaterialIcons name="add" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* LIST NGỮ PHÁP */}
      {grammarData.length === 0 ? (
        <View style={styles.center}>
          <MaterialIcons name="menu-book" size={60} color="#CBD5E1" />
          <Text style={styles.emptyText}>Chưa có tài liệu ngữ pháp nào.</Text>
          <Pressable style={styles.btnEmpty} onPress={handleAddNew}>
            <Text style={{ color: "#FFF", fontWeight: "bold" }}>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F1F5F9" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyText: {
    marginTop: 16,
    color: "#64748B",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 20,
  },
  btnEmpty: {
    backgroundColor: "#F97316",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  customHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "android" ? 50 : 20,
    paddingBottom: 15,
    backgroundColor: "#F1F5F9",
    zIndex: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1E293B",
    flex: 1,
    textAlign: "center",
  },
  btnBackHeader: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
  },
  btnBackHeaderHover: {
    backgroundColor: "#FFF7ED",
    borderColor: "#F97316",
    transform: [{ scale: 1.05 }],
  },
  btnHeaderAdd: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F97316",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#F97316",
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 3,
  },
  scrollContent: { padding: 16, paddingBottom: 40 },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    overflow: "hidden",
  },
  cardActive: { borderColor: "#FDBA74" },
  cardHeaderAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    paddingRight: 10,
  },
  indexCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#64748B",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  indexCircleActive: { backgroundColor: "#EA580C" },
  indexText: { color: "#FFF", fontWeight: "900", fontSize: 13 },
  cardTitle: { fontSize: 16, fontWeight: "800", color: "#1E293B", flex: 1 },
  cardContent: { paddingHorizontal: 16, paddingBottom: 16 },
  divider: { height: 1, backgroundColor: "#F1F5F9", marginBottom: 14 },
  formulaBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF3C7",
    padding: 12,
    borderRadius: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  formulaText: { fontSize: 14, fontWeight: "800", color: "#B45309", flex: 1 },
  section: { marginBottom: 12 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748B",
    marginBottom: 4,
  },
  sectionContent: { fontSize: 15, color: "#334155", lineHeight: 22 },

  // Ô chứa danh sách ví dụ xếp chồng gọn gàng
  exampleSection: {
    backgroundColor: "#F8FAFC",
    padding: 12,
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: "#F97316",
    gap: 4, // 🚀 Tạo khoảng cách đều giữa các dòng ví dụ con
  },
  exampleText: {
    fontSize: 14,
    color: "#0F172A",
    fontStyle: "italic",
    lineHeight: 22,
    fontWeight: "500",
  },
  itemActionContainer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  btnItemEdit: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0F9FF",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 10,
    borderWidth: 1,
    borderColor: "#BAE6FD",
  },
  btnItemEditText: {
    color: "#0369A1",
    fontSize: 13,
    fontWeight: "600",
    marginLeft: 4,
  },
  btnItemDelete: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  btnItemDeleteText: {
    color: "#B91C1C",
    fontSize: 13,
    fontWeight: "600",
    marginLeft: 4,
  },

  toastContainer: {
    position: "absolute",
    top: 10,
    right: 16,
    padding: 12,
    borderRadius: 10,
    zIndex: 9999,
    borderWidth: 1,
    backgroundColor: "#F0FDF4",
    borderColor: "#A7F3D0",
  },
  toastSuccess: { borderColor: "#A7F3D0", backgroundColor: "#F0FDF4" },
  toastError: { borderColor: "#FCA5A5", backgroundColor: "#FEF2F2" },
  toastText: { fontWeight: "600", color: "#1E293B" },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalBox: {
    width: 320,
    backgroundColor: "#FFF",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    elevation: 10,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  modalIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FEF2F2",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1E293B",
    marginBottom: 8,
  },
  modalMessage: {
    fontSize: 14,
    color: "#64748B",
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
    backgroundColor: "#F1F5F9",
    borderRadius: 10,
    alignItems: "center",
    marginRight: 8,
  },
  btnModalCancelText: { color: "#475569", fontWeight: "700", fontSize: 15 },
  btnModalConfirm: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: "#EF4444",
    borderRadius: 10,
    alignItems: "center",
    marginLeft: 8,
  },
  btnModalConfirmText: { color: "#FFF", fontWeight: "700", fontSize: 15 },
});
