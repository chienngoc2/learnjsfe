import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface DailyQuest {
  id: string;
  label: string;
  jpLabel: string;
  current: number;
  target: number;
  rewardTuVi: number;
  completed: boolean;
}

export interface RecentActivity {
  id: string;
  type: 'kanji' | 'vocab' | 'grammar' | 'listening';
  name: string;
  time: string;
}

interface CultivationState {
  xp: number;
  tuVi: number;
  level: number;
  stage: string;
  streak: number;
  lastActive: string | null;
  dailyQuests: DailyQuest[];
  recentActivities: RecentActivity[];
  unlockedTitles: string[];
  currentTitle: string;
  soundEnabled: boolean;
  tokensUsed: { prompt: number; completion: number; total: number };
  
  addXP: (amount: number) => { leveledUp: boolean, newLevel: number, newStage: string };
  addTuVi: (amount: number) => { stageBreakthrough: boolean, newStage: string };
  incrementQuest: (id: string, amount: number) => void;
  addRecentActivity: (activity: Omit<RecentActivity, 'id'>) => void;
  completeQuestDirectly: (id: string) => void;
  toggleSound: () => void;
  resetQuests: () => void;
  setStreak: (val: number) => void;
  addTokens: (prompt: number, completion: number) => void;
  clearTokens: () => void;
}

const STAGES = [
  { name: 'Luyện Khí 期 (練気期 - N5)', minLevel: 1 },
  { name: 'Trúc Cơ 期 (築基期 - N4)', minLevel: 11 },
  { name: 'Kim Đan 期 (金丹期 - N3)', minLevel: 21 },
  { name: 'Nguyên Anh 期 (元嬰期 - N2)', minLevel: 31 },
  { name: 'Hóa Thần 期 (化神期 - N1)', minLevel: 41 },
  { name: 'Luyện Hư 期 (煉虚期 - Tông Sư)', minLevel: 51 },
  { name: 'Hợp Thể 期 (合体期 - Hộ Pháp)', minLevel: 65 },
  { name: 'Đại Thừa 期 (大乗期 - Tiên Nhân)', minLevel: 80 }
];

const getStageForLevel = (level: number): string => {
  let activeStage = STAGES[0].name;
  for (const s of STAGES) {
    if (level >= s.minLevel) {
      activeStage = s.name;
    }
  }
  return activeStage;
};

const getTuViRequiredForLevel = (level: number): number => {
  return level * 100 + 500;
};

const INITIAL_QUESTS: DailyQuest[] = [
  {
    id: 'kanji',
    label: 'Học 20 Kanji',
    jpLabel: '漢字を20個学ぶ',
    current: 12,
    target: 20,
    rewardTuVi: 60,
    completed: false
  },
  {
    id: 'flashcards',
    label: 'Ôn 50 Flashcard',
    jpLabel: 'フラッシュカードを50枚復習する',
    current: 34,
    target: 50,
    rewardTuVi: 40,
    completed: false
  },
  {
    id: 'listening',
    label: 'Hoàn thành 1 bài nghe',
    jpLabel: 'リスニングを1回完了する',
    current: 0,
    target: 1,
    rewardTuVi: 50,
    completed: false
  },
  {
    id: 'streak',
    label: 'Giữ streak 7 ngày',
    jpLabel: '7日連続で修行する',
    current: 7,
    target: 7,
    rewardTuVi: 100,
    completed: true
  }
];

const INITIAL_ACTIVITIES: RecentActivity[] = [
  { id: '1', type: 'kanji', name: 'N5 Kanji list', time: '2 phút trước' },
  { id: '2', type: 'vocab', name: 'N5 語彙 - 食物', time: '15 phút trước' },
  { id: '3', type: 'grammar', name: 'Cấu trúc N5 〜ている', time: '1 giờ trước' },
  { id: '4', type: 'listening', name: 'Luyện nghe hiểu N5', time: 'Hôm qua' }
];

export const useCultivationStore = create<CultivationState>()(
  persist(
    (set, get) => ({
      xp: 12450,
      tuVi: 2450,
      level: 28,
      stage: 'Kim Đan 期 (金丹期 - N3)',
      streak: 7,
      lastActive: new Date().toISOString().split('T')[0],
      dailyQuests: INITIAL_QUESTS,
      recentActivities: INITIAL_ACTIVITIES,
      unlockedTitles: ['Đệ Tử Ngoại Môn', 'Tu Tiên Giả', 'Kim Đan Chân Nhân'],
      currentTitle: 'Kim Đan Chân Nhân',
      soundEnabled: true,
      tokensUsed: { prompt: 0, completion: 0, total: 0 },

      addXP: (amount) => {
        const state = get();
        let newXP = state.xp + amount;
        let newLevel = state.level;
        let newStage = state.stage;
        let leveledUp = false;

        while (newXP >= newLevel * 1000) {
          newXP -= newLevel * 1000;
          newLevel += 1;
          leveledUp = true;
        }

        if (leveledUp) {
          newStage = getStageForLevel(newLevel);
        }

        set({ xp: newXP, level: newLevel, stage: newStage });
        return { leveledUp, newLevel, newStage };
      },

      addTuVi: (amount) => {
        const state = get();
        let newTuVi = state.tuVi + amount;
        let newLevel = state.level;
        let newStage = state.stage;
        let stageBreakthrough = false;

        const required = getTuViRequiredForLevel(newLevel);
        if (newTuVi >= required) {
          newTuVi = newTuVi - required;
          newLevel += 1;
          newStage = getStageForLevel(newLevel);
          stageBreakthrough = true;
        }

        set({ tuVi: newTuVi, level: newLevel, stage: newStage });
        return { stageBreakthrough, newStage };
      },

      incrementQuest: (id, amount) => {
        const state = get();
        const updatedQuests = state.dailyQuests.map((q) => {
          if (q.id === id) {
            const nextVal = Math.min(q.target, q.current + amount);
            const isCompletedNow = nextVal >= q.target && !q.completed;
            
            if (isCompletedNow) {
              setTimeout(() => {
                get().addTuVi(q.rewardTuVi);
              }, 100);
            }

            return {
              ...q,
              current: nextVal,
              completed: nextVal >= q.target ? true : q.completed
            };
          }
          return q;
        });

        set({ dailyQuests: updatedQuests });
      },

      completeQuestDirectly: (id) => {
        const state = get();
        const updatedQuests = state.dailyQuests.map((q) => {
          if (q.id === id && !q.completed) {
            setTimeout(() => {
              get().addTuVi(q.rewardTuVi);
            }, 100);
            return { ...q, current: q.target, completed: true };
          }
          return q;
        });
        set({ dailyQuests: updatedQuests });
      },

      addRecentActivity: (act) => {
        const state = get();
        const newAct: RecentActivity = {
          ...act,
          id: Date.now().toString()
        };
        const currentList = [newAct, ...state.recentActivities];
        set({ recentActivities: currentList.slice(0, 6) });
      },

      toggleSound: () => set((state) => ({ soundEnabled: !state.soundEnabled })),

      resetQuests: () => {
        const reset = INITIAL_QUESTS.map(q => ({ 
          ...q, 
          current: q.id === 'streak' ? get().streak : 0, 
          completed: q.id === 'streak' 
        }));
        set({ dailyQuests: reset });
      },

      setStreak: (val) => set({ streak: val }),

      addTokens: (prompt, completion) => {
        set((state) => {
          const newPrompt = state.tokensUsed.prompt + prompt;
          const newCompletion = state.tokensUsed.completion + completion;
          return {
            tokensUsed: {
              prompt: newPrompt,
              completion: newCompletion,
              total: newPrompt + newCompletion
            }
          };
        });
      },

      clearTokens: () => {
        set({ tokensUsed: { prompt: 0, completion: 0, total: 0 } });
      }
    }),
    {
      name: 'xianxia-cultivation-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        xp: state.xp,
        tuVi: state.tuVi,
        level: state.level,
        stage: state.stage,
        streak: state.streak,
        lastActive: state.lastActive,
        unlockedTitles: state.unlockedTitles,
        currentTitle: state.currentTitle,
        soundEnabled: state.soundEnabled,
        tokensUsed: state.tokensUsed,
      })
    }
  )
);
