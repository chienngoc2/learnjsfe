import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface VoiceIndicatorProps {
  isRecording: boolean;
  text?: string;
}

export default function VoiceIndicator({ isRecording, text = "Đang nghe sếp nói..." }: VoiceIndicatorProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.5,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording]);

  if (!isRecording) return null;

  return (
    <View style={styles.overlay}>
      <Animated.View style={[styles.pulse, { transform: [{ scale: pulseAnim }] }]}>
        <View style={styles.micCircle}>
          <MaterialIcons name="mic" size={32} color="#fff" />
        </View>
      </Animated.View>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    alignItems: 'center',
  },
  pulse: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0, 122, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  micCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    marginTop: 15,
    color: '#007AFF',
    fontWeight: '600',
    fontSize: 14,
  },
});