import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  TextInput,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import api from '../../services/api';
import { useTheme } from '@/src/context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function DashboardScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState(0);
  const [vocabCount, setVocabCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

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

      // 2. Lấy số lượng từ vựng từ Backend
      const response = await api.get('/api/vocab/lists');
      const totalWords = response.data.reduce((acc: number, list: any) => acc + (list.words?.length || 0), 0);
      setVocabCount(totalWords);

    } catch (error) {
      console.error("Lỗi cập nhật dữ liệu:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.indigo} />
      </View>
    );
  }

  // Tính toán phần trăm hoàn thành học tập (Mục tiêu 300 từ vựng N5)
  const targetCards = 300;
  const completionPercent = Math.min(100, Math.round((vocabCount / targetCards) * 100)) || 15;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top > 0 ? insets.top + 10 : (Platform.OS === 'android' ? 50 : 25) }
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ================= HEADER ROW ================= */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Image
              source={{ uri: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Chien' }}
              style={[styles.avatar, { borderColor: colors.indigo }]}
            />
            <View style={styles.greetingBox}>
              <Text style={[styles.greetingTitle, { color: colors.text }]}>Chào sếp! 👋</Text>
              <Text style={[styles.greetingSub, { color: colors.textMuted }]}>Hôm nay sếp muốn học gì?</Text>
            </View>
          </View>

          {/* Bell icon notification */}
          <TouchableOpacity
            style={[styles.bellBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            activeOpacity={0.8}
          >
            <MaterialIcons name="notifications-none" size={24} color={colors.text} />
            <View style={styles.bellBadge} />
          </TouchableOpacity>
        </View>

        {/* ================= SEARCH BAR ================= */}
        <View style={styles.searchContainer}>
          <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <MaterialIcons name="search" size={22} color={colors.textMuted} style={{ marginRight: 8 }} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Tìm kiếm bộ thẻ, chủ đề..."
              placeholderTextColor={colors.textMuted + '80'}
            />
          </View>
          <TouchableOpacity
            style={[styles.filterBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            activeOpacity={0.8}
          >
            <MaterialIcons name="tune" size={22} color={colors.indigo} />
          </TouchableOpacity>
        </View>

        {/* ================= STATS WIDGET (BLUE GRADIENT) ================= */}
        <LinearGradient
          colors={isDark ? ['#1E1B4B', '#312E81'] : ['#4F46E5', '#6366F1']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.statsCard}
        >
          <View style={styles.statsCardLeft}>
            <Text style={styles.statsCardLabel}>TIẾN ĐỘ HỌC TẬP</Text>
            <Text style={styles.statsCardTitle}>{streak} ngày liên tiếp 🔥</Text>
            <View style={styles.statsProgressBarBg}>
              <View style={[styles.statsProgressBarFill, { width: `${Math.min(100, (streak / 30) * 100)}%` }]} />
            </View>
            <Text style={styles.statsProgressText}>{vocabCount} / {targetCards} thẻ đã học</Text>
          </View>

          {/* Circular progress chart container */}
          <View style={styles.statsCardRight}>
            <View style={styles.circleProgressOuter}>
              {/* Fake circular chart using border borders */}
              <View style={[styles.circleProgressIndicator, { borderRightColor: '#60A5FA', borderTopColor: '#60A5FA' }]} />
              <View style={styles.circleProgressInner}>
                <Text style={styles.circleProgressText}>{completionPercent}%</Text>
              </View>
            </View>
            <Text style={styles.circleProgressLabel}>Đã hoàn thành</Text>
          </View>
        </LinearGradient>

        {/* ================= GRID ACTIONS ================= */}
        <View style={styles.gridRow}>
          {/* Học từ */}
          <TouchableOpacity
            style={[styles.gridItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push('/vocab')}
            activeOpacity={0.8}
          >
            <View style={[styles.gridIconCircle, { backgroundColor: '#EFF6FF' }]}>
              <MaterialIcons name="view-carousel" size={24} color="#3B82F6" />
            </View>
            <Text style={[styles.gridLabel, { color: colors.text }]}>Học thẻ</Text>
          </TouchableOpacity>

          {/* Ôn tập */}
          <TouchableOpacity
            style={[styles.gridItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push('/study/show-kanji')}
            activeOpacity={0.8}
          >
            <View style={[styles.gridIconCircle, { backgroundColor: '#ECFDF5' }]}>
              <MaterialIcons name="repeat" size={24} color="#10B981" />
            </View>
            <Text style={[styles.gridLabel, { color: colors.text }]}>Ôn tập</Text>
          </TouchableOpacity>

          {/* Kiểm tra */}
          <TouchableOpacity
            style={[styles.gridItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push('/study/practice-grammar')}
            activeOpacity={0.8}
          >
            <View style={[styles.gridIconCircle, { backgroundColor: '#F5F3FF' }]}>
              <MaterialIcons name="assignment-turned-in" size={24} color="#8B5CF6" />
            </View>
            <Text style={[styles.gridLabel, { color: colors.text }]}>Kiểm tra</Text>
          </TouchableOpacity>

          {/* Chơi game */}
          <TouchableOpacity
            style={[styles.gridItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push('/chat')}
            activeOpacity={0.8}
          >
            <View style={[styles.gridIconCircle, { backgroundColor: '#FFFBEB' }]}>
              <MaterialIcons name="emoji-events" size={24} color="#F59E0B" />
            </View>
            <Text style={[styles.gridLabel, { color: colors.text }]}>Chơi game</Text>
          </TouchableOpacity>
        </View>

        {/* ================= LIST SECTION ================= */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Bộ thẻ của tôi</Text>
          <TouchableOpacity onPress={() => router.push('/vocab')} activeOpacity={0.7}>
            <Text style={[styles.sectionLink, { color: colors.indigo }]}>Xem tất cả </Text>
          </TouchableOpacity>
        </View>

        {/* Deck 1: Từ vựng N5 */}
        <TouchableOpacity
          style={[styles.deckCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => router.push('/vocab')}
          activeOpacity={0.8}
        >
          <Image
            source={{ uri: 'https://images.unsplash.com/photo-1528459801416-a9e53bbf4e17?q=80&w=200' }}
            style={styles.deckThumbnail}
          />
          <View style={styles.deckContent}>
            <Text style={[styles.deckTitle, { color: colors.text }]}>500 Từ vựng IELTS & N5</Text>
            <Text style={[styles.deckSub, { color: colors.textMuted }]}>• {vocabCount > 0 ? vocabCount : 120} thẻ đã thuộc</Text>
            <View style={styles.deckProgressRow}>
              <View style={[styles.deckProgressBarBg, { backgroundColor: colors.border }]}>
                <View style={[styles.deckProgressBarFill, { backgroundColor: '#3B82F6', width: `${completionPercent}%` }]} />
              </View>
              <Text style={[styles.deckPercent, { color: colors.textMuted }]}>{completionPercent}%</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Deck 2: Kanji N5 */}
        <TouchableOpacity
          style={[styles.deckCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => router.push('/study/show-kanji')}
          activeOpacity={0.8}
        >
          <Image
            source={{ uri: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?q=80&w=200' }}
            style={styles.deckThumbnail}
          />
          <View style={styles.deckContent}>
            <Text style={[styles.deckTitle, { color: colors.text }]}>Chữ Kanji N5 cốt lõi</Text>
            <Text style={[styles.deckSub, { color: colors.textMuted }]}>• Xem nét vẽ, sửa & xóa</Text>
            <View style={styles.deckProgressRow}>
              <View style={[styles.deckProgressBarBg, { backgroundColor: colors.border }]}>
                <View style={[styles.deckProgressBarFill, { backgroundColor: '#10B981', width: '45%' }]} />
              </View>
              <Text style={[styles.deckPercent, { color: colors.textMuted }]}>45%</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Deck 3: Ngữ pháp N5 */}
        <TouchableOpacity
          style={[styles.deckCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => router.push('/study/practice-grammar')}
          activeOpacity={0.8}
        >
          <Image
            source={{ uri: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?q=80&w=200' }}
            style={styles.deckThumbnail}
          />
          <View style={styles.deckContent}>
            <Text style={[styles.deckTitle, { color: colors.text }]}>Ngữ pháp N5 phản xạ</Text>
            <Text style={[styles.deckSub, { color: colors.textMuted }]}>• Luyện tập & cấu trúc</Text>
            <View style={styles.deckProgressRow}>
              <View style={[styles.deckProgressBarBg, { backgroundColor: colors.border }]}>
                <View style={[styles.deckProgressBarFill, { backgroundColor: '#8B5CF6', width: '30%' }]} />
              </View>
              <Text style={[styles.deckPercent, { color: colors.textMuted }]}>30%</Text>
            </View>
          </View>
        </TouchableOpacity>
      </ScrollView>

      {/* ================= FLOATING ACTION BUTTON (FAB) ================= */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.indigo }]}
        onPress={() => router.push('/study/add-kanji')}
        activeOpacity={0.8}
      >
        <MaterialIcons name="add" size={28} color="#FFF" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingTop: Platform.OS === 'android' ? 50 : 25,
    paddingBottom: 90, // tránh đè lên FAB
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2.5,
  },
  greetingBox: {
    marginLeft: 12,
  },
  greetingTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  greetingSub: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  bellBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    position: 'relative',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 5,
      },
      android: { elevation: 2 },
    }),
  },
  bellBadge: {
    position: 'absolute',
    top: 10,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },

  // SEARCH BAR
  searchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 22,
    gap: 12,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    height: 48,
    paddingHorizontal: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 6,
      },
      android: { elevation: 2 },
    }),
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    height: '100%',
  },
  filterBtn: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 6,
      },
      android: { elevation: 2 },
    }),
  },

  // PROGRESS STATS CARD
  statsCard: {
    borderRadius: 24,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#4F46E5',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 15,
      },
      android: { elevation: 6 },
    }),
  },
  statsCardLeft: {
    flex: 1.2,
    paddingRight: 10,
  },
  statsCardLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.7)',
    letterSpacing: 1,
    marginBottom: 6,
  },
  statsCardTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFF',
    marginBottom: 14,
  },
  statsProgressBarBg: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 3,
    marginBottom: 10,
    overflow: 'hidden',
  },
  statsProgressBarFill: {
    height: '100%',
    backgroundColor: '#60A5FA',
    borderRadius: 3,
  },
  statsProgressText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '600',
  },

  // CIRCULAR CHART IN BLUE CARD
  statsCardRight: {
    flex: 0.8,
    alignItems: 'center',
  },
  circleProgressOuter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  circleProgressIndicator: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 5,
    borderColor: 'rgba(255,255,255,0.15)',
    borderStyle: 'solid',
  },
  circleProgressInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  circleProgressText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFF',
  },
  circleProgressLabel: {
    fontSize: 9,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '700',
    marginTop: 6,
    textAlign: 'center',
  },

  // GRID MENU
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 10,
  },
  gridItem: {
    flex: 1,
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.03,
        shadowRadius: 10,
      },
      android: { elevation: 2 },
    }),
  },
  gridIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  gridLabel: {
    fontSize: 12,
    fontWeight: '800',
  },

  // SECTION HEADER ROW
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  sectionLink: {
    fontSize: 12,
    fontWeight: '700',
  },

  // DECK CARD
  deckCard: {
    flexDirection: 'row',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    marginBottom: 12,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.02,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
  },
  deckThumbnail: {
    width: 68,
    height: 68,
    borderRadius: 14,
    marginRight: 14,
  },
  deckContent: {
    flex: 1,
  },
  deckTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 6,
  },
  deckSub: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 8,
  },
  deckProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deckProgressBarBg: {
    flex: 1,
    height: 5,
    borderRadius: 2.5,
    overflow: 'hidden',
  },
  deckProgressBarFill: {
    height: '100%',
    borderRadius: 2.5,
  },
  deckPercent: {
    fontSize: 11,
    fontWeight: '700',
    width: 32,
    textAlign: 'right',
  },

  // FAB
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#4F46E5',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
      },
      android: { elevation: 6 },
    }),
  },
});