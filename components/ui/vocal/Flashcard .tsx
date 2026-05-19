import { useTheme } from "@/src/context/ThemeContext";
import React, { useState, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Animated,
  Platform,
} from "react-native";


interface Props {
  term: string; // Từ tiếng Nhật
  definition: string; // Nghĩa tiếng Việt
}

export default function Flashcard({ term, definition }: Props) {
  const { colors } = useTheme(); // 🚀 Đón nhận bộ màu động sáng/tối
  const [flipped, setFlipped] = useState(false);
  const flipAnim = useRef(new Animated.Value(0)).current;

  const handleFlip = () => {
    Animated.timing(flipAnim, {
      toValue: flipped ? 0 : 180,
      duration: 320, // Tăng nhẹ một chút cho cảm giác lật mượt và đầm tay hơn
      useNativeDriver: true,
    }).start();
    setFlipped(!flipped);
  };

  // Hiệu ứng xoay mặt trước
  const frontInterpolate = flipAnim.interpolate({
    inputRange: [0, 180],
    outputRange: ["0deg", "180deg"],
  });

  // Hiệu ứng xoay mặt sau
  const backInterpolate = flipAnim.interpolate({
    inputRange: [0, 180],
    outputRange: ["180deg", "360deg"],
  });

  // Ẩn mặt trước khi góc quay đạt đến giữa thẻ
  const frontOpacity = flipAnim.interpolate({
    inputRange: [89, 90],
    outputRange: [1, 0],
  });

  // Hiện mặt sau khi góc quay vượt qua giữa thẻ
  const backOpacity = flipAnim.interpolate({
    inputRange: [89, 90],
    outputRange: [0, 1],
  });

  return (
    <TouchableOpacity
      onPress={handleFlip}
      activeOpacity={1}
      style={styles.container}
    >
      {/* 🌟 MẶT TRƯỚC: TIẾNG NHẬT (Ăn theo màu Surface hệ thống) */}
      <Animated.View
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            transform: [{ rotateY: frontInterpolate }],
            opacity: frontOpacity,
          },
        ]}
      >
        {/* Điểm nhấn vạch màu thương hiệu phía trên thẻ cho sinh động */}
        <View
          style={[styles.topAccentBar, { backgroundColor: colors.amber }]}
        />

        <Text style={[styles.termText, { color: colors.text }]}>{term}</Text>
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          Chạm để xem nghĩa 💡
        </Text>
      </Animated.View>

      {/* 🌟 MẶT SAU: NGHĨA TIẾNG VIỆT (Hòa âm phối khí theo tone Amber cao cấp) */}
      <Animated.View
        style={[
          styles.card,
          styles.cardBack,
          {
            backgroundColor: colors.amberLight, // Nền cam pastel nhạt ở Light Mode, Cam đen ở Dark Mode
            borderColor: colors.amber + "40", // Viền cam trong suốt nhẹ
            transform: [{ rotateY: backInterpolate }],
            opacity: backOpacity,
          },
        ]}
      >
        <Text style={[styles.defText, { color: colors.amber }]}>
          {definition}
        </Text>
        <Text style={[styles.hint, { color: colors.amber, opacity: 0.6 }]}>
          Chạm để quay lại
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    height: 250,
    marginVertical: 12,
  },
  card: {
    width: "100%",
    height: "100%",
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    backfaceVisibility: "hidden",
    borderWidth: 1,
    padding: 24,
    position: "relative",
    overflow: "hidden", // Bo khít cái thanh accent bar lại
    ...Platform.select({
      ios: {
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.06,
        shadowRadius: 16,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  cardBack: {
    position: "absolute",
    top: 0,
  },
  topAccentBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 6, // Thanh vạch màu mỏng tinh tế ở đỉnh đầu card
  },
  termText: {
    fontSize: 40,
    fontWeight: "900", // Đậm đặc phong cách BrSE
    textAlign: "center",
    letterSpacing: -0.5,
  },
  defText: {
    fontSize: 26,
    fontWeight: "800",
    textAlign: "center",
    lineHeight: 36,
  },
  hint: {
    position: "absolute",
    bottom: 20,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: -0.1,
  },
});
