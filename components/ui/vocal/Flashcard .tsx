import { useTheme } from "@/src/context/ThemeContext";
import React from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Platform,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
} from "react-native-reanimated";

interface Props {
  term: string; // Từ tiếng Nhật
  definition: string; // Nghĩa tiếng Việt
}

export default function Flashcard({ term, definition }: Props) {
  const { colors } = useTheme();
  const rotate = useSharedValue(0);

  const handleFlip = () => {
    rotate.value = withTiming(rotate.value === 0 ? 180 : 0, { duration: 400 });
  };

  // Reanimated style for Front Card
  const frontStyle = useAnimatedStyle(() => {
    const spin = interpolate(rotate.value, [0, 180], [0, 180]);
    return {
      transform: [{ rotateY: `${spin}deg` }],
      backfaceVisibility: "hidden",
    };
  });

  // Reanimated style for Back Card
  const backStyle = useAnimatedStyle(() => {
    const spin = interpolate(rotate.value, [0, 180], [180, 360]);
    return {
      transform: [{ rotateY: `${spin}deg` }],
      backfaceVisibility: "hidden",
    };
  });

  return (
    <TouchableOpacity
      onPress={handleFlip}
      activeOpacity={1}
      style={styles.container}
    >
      <View style={{ flex: 1, position: "relative" }}>
        {/* MẶT TRƯỚC: TIẾNG NHẬT */}
        <Animated.View
          style={[
            styles.card,
            frontStyle,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <View
            style={[styles.topAccentBar, { backgroundColor: colors.amber }]}
          />
          <Text style={[styles.termText, { color: colors.text }]}>{term}</Text>
          <Text style={[styles.hint, { color: colors.textMuted }]}>
            Chạm để xem nghĩa
          </Text>
        </Animated.View>

        {/* MẶT SAU: NGHĨA TIẾNG VIỆT */}
        <Animated.View
          style={[
            styles.card,
            styles.cardBack,
            backStyle,
            {
              backgroundColor: colors.amberLight,
              borderColor: colors.amber + "40",
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
      </View>
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
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    padding: 24,
    overflow: "hidden",
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
    backfaceVisibility: "hidden",
  },
  topAccentBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 6,
  },
  termText: {
    fontSize: 40,
    fontWeight: "900",
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
