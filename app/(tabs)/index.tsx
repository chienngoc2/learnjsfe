import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import api from '../../services/api';

export default function DashboardScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState(0);
  const [vocabCount, setVocabCount] = useState(0);

  useEffect(() => {
    fetchRealtimeData();
  }, []);

  const fetchRealtimeData = async () => {
    try {
      setLoading(true);
      
      // 1. Tính toán Streak (Chuỗi ngày)
      const lastLogin = await AsyncStorage.getItem('last_login');
      const currentStreak = await AsyncStorage.getItem('streak_count');
      const today = new Date().toDateString();

      if (lastLogin === today) {
        setStreak(Number(currentStreak) || 0);
      } else {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        
        let newStreak = 1;
        if (lastLogin === yesterday.toDateString()) {
          newStreak = (Number(currentStreak) || 0) + 1;
        }
        
        await AsyncStorage.setItem('last_login', today);
        await AsyncStorage.setItem('streak_count', newStreak.toString());
        setStreak(newStreak);
      }

      // 2. Lấy số lượng từ vựng thật từ Backend
      const response = await api.get('/api/vocab/lists');
      // Giả sử API trả về mảng các list, mình đếm tổng số words trong đó
      const totalWords = response.data.reduce((acc: number, list: any) => acc + list.words.length, 0);
      setVocabCount(totalWords);

    } catch (error) {
      console.error("Lỗi cập nhật dữ liệu:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <ActivityIndicator size="large" color="#007AFF" style={{flex: 1}} />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Chào sếp! 🚀</Text>
          <Text style={styles.subGreeting}>Hôm nay sếp muốn cày N5 hay luyện BrSE?</Text>
        </View>
        <Image source={{ uri: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Chien' }} style={styles.avatar} />
      </View>

      {/* Stats Section */}
      <View style={styles.statsContainer}>
        {/* Streak Card */}
        <LinearGradient colors={['#E0EAFC', '#CFDEF3']} style={styles.statCard}>
          <View style={styles.cardHeader}>
             <Image source={{ uri: 'https://cdn-icons-png.flaticon.com/512/426/426833.png' }} style={styles.icon3d} />
             <View style={styles.cardInfo}>
                <Text style={styles.cardTitle}>Chuỗi Ngày Liên Tiếp</Text>
                <Text style={styles.cardValue}>{streak}</Text>
                <Text style={styles.cardSub}>Ngày liên tiếp</Text>
             </View>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${(streak / 30) * 100}%` }]} />
          </View>
          <Text style={styles.progressText}>Mục tiêu: 30 ngày</Text>
        </LinearGradient>

        {/* Vocab Card */}
        <LinearGradient colors={['#E0EAFC', '#CFDEF3']} style={styles.statCard}>
          <View style={styles.cardHeader}>
             <Image source={{ uri: 'https://cdn-icons-png.flaticon.com/512/2232/2232688.png' }} style={styles.icon3d} />
             <View style={styles.cardInfo}>
                <Text style={styles.cardTitle}>Từ Vựng N5 Đã Thuộc</Text>
                <Text style={styles.cardValue}>{vocabCount}</Text>
                <Text style={styles.cardSub}>Từ vựng N5 đã thuộc</Text>
             </View>
             <View style={styles.circularProgress}>
                <Text style={styles.percentText}>90%</Text>
             </View>
          </View>
        </LinearGradient>
      </View>

      <Text style={styles.sectionTitle}>Học nhanh</Text>
      
      {/* Action Cards */}
      <TouchableOpacity style={[styles.actionCard, { backgroundColor: '#1A365D' }]} onPress={() => router.push('/chat')}>
        <View style={styles.actionTextContainer}>
          <Text style={styles.actionTitleWeb}>Chat với Sensei AI</Text>
          <Text style={styles.actionSubWeb}>Luyện giao tiếp & giải đáp ngữ pháp</Text>
        </View>
        <Image source={{ uri: 'https://cdn-icons-png.flaticon.com/512/4712/4712035.png' }} style={styles.botIcon} />
      </TouchableOpacity>

      <TouchableOpacity style={[styles.actionCard, { backgroundColor: '#F6AD55' }]} onPress={() => router.push('/vocab')}>
        <View style={styles.actionTextContainer}>
          <Text style={[styles.actionTitleWeb, {color: '#2D3748'}]}>Ôn tập Flashcards N5</Text>
          <Text style={[styles.actionSubWeb, {color: '#4A5568'}]}>Cày nốt N5 bài 5-10</Text>
        </View>
        <Image source={{ uri: 'https://cdn-icons-png.flaticon.com/512/2436/2436636.png' }} style={styles.vocabIcon} />
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F4F8' },
  content: { padding: 20, paddingTop: 60 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 25 },
  greeting: { fontSize: 28, fontWeight: 'bold', color: '#1A202C' },
  subGreeting: { fontSize: 14, color: '#718096' },
  avatar: { width: 55, height: 55, borderRadius: 27.5, borderWeight: 2, borderColor: '#fff' },
  statsContainer: { gap: 15, marginBottom: 30 },
  statCard: { padding: 15, borderRadius: 20, elevation: 3, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10 },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  icon3d: { width: 60, height: 60, marginRight: 15 },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#2D3748' },
  cardValue: { fontSize: 32, fontWeight: 'bold', color: '#1A202C' },
  cardSub: { fontSize: 12, color: '#718096' },
  progressBarBg: { height: 8, backgroundColor: '#CBD5E0', borderRadius: 4, marginTop: 15 },
  progressBarFill: { height: '100%', backgroundColor: '#2C5282', borderRadius: 4 },
  progressText: { fontSize: 10, textAlign: 'right', marginTop: 5, color: '#4A5568' },
  circularProgress: { width: 50, height: 50, borderRadius: 25, borderWidth: 4, borderColor: '#2C5282', justifyContent: 'center', alignItems: 'center' },
  percentText: { fontSize: 12, fontWeight: 'bold', color: '#2C5282' },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 15 },
  actionCard: { flexDirection: 'row', borderRadius: 20, padding: 20, marginBottom: 15, alignItems: 'center', justifyContent: 'space-between', overflow: 'hidden' },
  actionTextContainer: { flex: 1 },
  actionTitleWeb: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  actionSubWeb: { fontSize: 14, color: '#E2E8F0', marginTop: 5 },
  botIcon: { width: 100, height: 100, marginBottom: -20, marginRight: -10 },
  vocabIcon: { width: 80, height: 80, marginRight: -5 }
});