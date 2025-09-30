import { studentContextManager, StudentContext } from './studentContext';
import { API_URL } from '@/config/api.config';

export interface Achievement {
  id: string;
  title: string;
  titleAr: string;
  description: string;
  descriptionAr: string;
  icon: string;
  points: number;
  category: string;
  unlockedAt?: string;
  progress?: number;
  requirement?: number;
}

// Remove duplicate API_URL - already imported from api.config

export interface AchievementCheckResponse {
  newAchievements: Achievement[];
  updatedPoints: number;
  updatedLevel: number;
  leveledUp: boolean;
}

type AchievementCallback = (achievements: Achievement[]) => void;

class AchievementTracker {
  private achievementCallbacks: Set<AchievementCallback> = new Set();
  private checkInProgress: boolean = false;
  private lastCheckTime: number = 0;
  private minCheckInterval: number = 1000;

  async checkAchievements(
    context: StudentContext,
    lastAction: string,
    actionDetails?: any
  ): Promise<AchievementCheckResponse | null> {
    const now = Date.now();
    if (this.checkInProgress || (now - this.lastCheckTime) < this.minCheckInterval) {
      return null;
    }

    this.checkInProgress = true;
    this.lastCheckTime = now;

    try {
      const response = await fetch(`${API_URL}/achievements/check`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          userId: context.userId,
          action: lastAction,
          actionDetails,
          currentStats: {
            streakCount: context.streakCount,
            longestStreak: context.longestStreak,
            totalTime: context.totalLearningTime,
            correctAnswers: context.correctAnswers,
            wrongAnswers: context.wrongAnswers,
            averageScore: context.averageScore,
            level: context.currentLevel,
            points: context.points,
            questionsAsked: context.questionsAsked,
            hintsRequested: context.hintsRequested,
            breaksRequested: context.breaksRequested,
            strugglingTopics: context.strugglingTopics,
            masteredTopics: context.masteredTopics,
            recentTopics: context.recentTopics,
            currentMood: context.currentMood,
            averageConfidence: context.averageConfidence,
            averageEngagement: context.averageEngagement,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Achievement check failed: ${response.statusText}`);
      }

      const data: AchievementCheckResponse = await response.json();

      if (data.newAchievements && data.newAchievements.length > 0) {
        this.notifyAchievements(data.newAchievements);

        await studentContextManager.updateContext('achievements_unlocked', {
          newAchievements: data.newAchievements,
          points: data.updatedPoints,
          level: data.updatedLevel,
        });
      }

      return data;
    } catch (error) {
      console.error('Error checking achievements:', error);
      return null;
    } finally {
      this.checkInProgress = false;
    }
  }

  async checkSpecificAchievement(achievementType: string): Promise<Achievement | null> {
    const context = studentContextManager.getContext();
    if (!context) return null;

    try {
      const response = await fetch(`${API_URL}/achievements/check/${achievementType}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          userId: context.userId,
          currentStats: {
            streakCount: context.streakCount,
            totalTime: context.totalLearningTime,
            correctAnswers: context.correctAnswers,
            level: context.currentLevel,
            points: context.points,
          },
        }),
      });

      if (!response.ok) {
        return null;
      }

      const achievement = await response.json();
      if (achievement) {
        this.notifyAchievements([achievement]);
      }

      return achievement;
    } catch (error) {
      console.error(`Error checking ${achievementType} achievement:`, error);
      return null;
    }
  }

  subscribeToAchievements(callback: AchievementCallback): () => void {
    this.achievementCallbacks.add(callback);
    return () => {
      this.achievementCallbacks.delete(callback);
    };
  }

  private notifyAchievements(achievements: Achievement[]): void {
    this.achievementCallbacks.forEach(callback => {
      try {
        callback(achievements);
      } catch (error) {
        console.error('Error in achievement callback:', error);
      }
    });
  }

  async fetchUserAchievements(userId: string): Promise<Achievement[]> {
    try {
      const response = await fetch(`${API_URL}/achievements/user/${userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch achievements: ${response.statusText}`);
      }

      const data = await response.json();
      return data.achievements || [];
    } catch (error) {
      console.error('Error fetching user achievements:', error);
      return [];
    }
  }

  async getAchievementProgress(userId: string): Promise<Record<string, { progress: number; requirement: number }>> {
    try {
      const response = await fetch(`${API_URL}/api/v1/achievements/progress/${userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch achievement progress: ${response.statusText}`);
      }

      const data = await response.json();
      return data.progress || {};
    } catch (error) {
      console.error('Error fetching achievement progress:', error);
      return {};
    }
  }
}

const achievementTracker = new AchievementTracker();

const ACHIEVEMENT_ACTIONS = {
  QUIZ_ANSWER: 'quiz_answer',
  LESSON_COMPLETE: 'lesson_complete',
  STREAK_UPDATE: 'streak_update',
  TIME_MILESTONE: 'time_milestone',
  TOPIC_MASTERED: 'topic_mastered',
  LEVEL_UP: 'level_up',
  PERFECT_QUIZ: 'perfect_quiz',
  HELP_REQUEST: 'help_request',
  BREAK_REQUEST: 'break_request',
  LOGIN: 'login',
  STUDY_SESSION: 'study_session',
} as const;

export { achievementTracker, ACHIEVEMENT_ACTIONS };
export type { AchievementCallback };