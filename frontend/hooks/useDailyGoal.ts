import { useEffect, useState } from 'react';
import api from '@/services/api';

export interface DailyGoal {
  target: number;
  completed: number;
  percentage: number;
  streak: number;
  timeSpent: number;
}

interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
}

export function useDailyGoal(userId: string | undefined) {
  const [goal, setGoal] = useState<DailyGoal>({
    target: 3,
    completed: 0,
    percentage: 0,
    streak: 0,
    timeSpent: 0
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;

    const fetchGoal = async () => {
      setLoading(true);
      setError(null);

      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // ✅ استخدام الـ endpoint الجديد المبسط
        const response = await api.get<ApiResponse>(`/progress/daily?userId=${userId}&date=${today.toISOString()}`);

        if (response.data?.success) {
          const data = response.data.data;
          setGoal({
            target: data.dailyTarget || 3,
            completed: data.completedToday || 0,
            percentage: data.percentage || 0,
            streak: data.streak || 0,
            timeSpent: data.timeSpentMinutes || 0
          });
        }
      } catch (err: any) {
        console.error('Failed to fetch daily goal:', err);
        setError(err.message || 'Failed to fetch goal');
        // Keep default values on error
      } finally {
        setLoading(false);
      }
    };

    fetchGoal();
  }, [userId]);

  return { goal, loading, error };
}

// Helper function to get motivational message based on progress
export function getDailyGoalMessage(percentage: number): string {
  if (percentage === 0) {
    return 'ابدأ رحلتك اليوم! 🚀';
  } else if (percentage < 50) {
    return 'بداية رائعة، استمر! 💪';
  } else if (percentage < 100) {
    return 'أنت على وشك إنجاز هدفك! 🎯';
  } else {
    return 'ممتاز! حققت هدف اليوم! 🎉';
  }
}

// Helper to get streak message
export function getStreakMessage(streak: number): string {
  if (streak === 0) {
    return 'ابدأ سلسلة إنجازاتك اليوم';
  } else if (streak === 1) {
    return 'يوم واحد متتالي! 🔥';
  } else if (streak < 7) {
    return `${streak} أيام متتالية! 🔥`;
  } else if (streak < 30) {
    return `إنجاز رائع! ${streak} يوم متتالي! 🔥🔥`;
  } else {
    return `أسطورة! ${streak} يوم متتالي! 🔥🔥🔥`;
  }
}