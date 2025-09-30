import api from './api';

interface StudentContext {
  userId: string;
  firstName: string;
  grade: number;
  learningStyle: string;
  totalLearningTime: number;
  correctAnswers: number;
  wrongAnswers: number;
  averageScore: number;
  streakCount: number;
  longestStreak: number;
  lastActiveDate: string;
  strugglingTopics: string[];
  masteredTopics: string[];
  recentTopics: string[];
  currentMood: string;
  averageConfidence: number;
  averageEngagement: number;
  questionsAsked: number;
  hintsRequested: number;
  breaksRequested: number;
  currentLevel: number;
  points: number;
  achievements: string[];
  completedLessons?: number;
  totalLessons?: number;
}

interface ContextUpdate {
  action: string;
  data: any;
  timestamp: number;
}

type ContextChangeCallback = (context: StudentContext) => void;

class StudentContextManager {
  private context: StudentContext | null = null;
  private pendingUpdates: ContextUpdate[] = [];
  private subscribers: Set<ContextChangeCallback> = new Set();
  private syncInterval: NodeJS.Timeout | null = null;
  private lastSyncTime: number = Date.now();
  private userInfo: any = null;

  constructor() {
    this.startAutoSync();
  }

  private getDefaultContext(userId: string): StudentContext {
    return {
      userId,
      firstName: 'مستخدم جديد',
      grade: 1,
      learningStyle: 'visual',
      totalLearningTime: 0,
      correctAnswers: 0,
      wrongAnswers: 0,
      averageScore: 0,
      streakCount: 0,
      longestStreak: 0,
      lastActiveDate: new Date().toISOString(),
      strugglingTopics: [],
      masteredTopics: [],
      recentTopics: [],
      currentMood: 'neutral',
      averageConfidence: 70,
      averageEngagement: 80,
      questionsAsked: 0,
      hintsRequested: 0,
      breaksRequested: 0,
      currentLevel: 1,
      points: 0,
      achievements: [],
    };
  }

  async fetchContext(userId: string): Promise<StudentContext> {
    try {
      const response = await api.get<any>(`/student-context/${userId}`);
      const data = response.data.success ? response.data.data : response.data;

      // ✅ طباعة البيانات للتشخيص
      console.log('📊 Student Context Response:', {
        completedLessons: data.completedLessons,
        totalLessons: data.totalLessons,
        stats: data.stats
      });

      // Handle the response data structure
      this.context = {
        userId: data.userId || userId,
        firstName: data.firstName || data.user?.firstName || 'مستخدم جديد',
        grade: data.grade || data.user?.grade || 1,
        learningStyle: data.learningStyle || 'visual',
        totalLearningTime: data.totalLearningTime || 0,
        correctAnswers: data.correctAnswers || 0,
        wrongAnswers: data.wrongAnswers || 0,
        averageScore: data.averageScore || 0,
        streakCount: data.streakCount || 0,
        longestStreak: data.longestStreak || 0,
        lastActiveDate: data.lastActiveDate || data.lastInteractionTime || new Date().toISOString(),
        strugglingTopics: Array.isArray(data.strugglingTopics) ? data.strugglingTopics : [],
        masteredTopics: Array.isArray(data.masteredTopics) ? data.masteredTopics : [],
        recentTopics: Array.isArray(data.recentTopics) ? data.recentTopics : [],
        currentMood: data.currentMood || 'neutral',
        averageConfidence: data.averageConfidence ?? 70,
        averageEngagement: data.averageEngagement ?? 80,
        questionsAsked: data.questionsAsked || 0,
        hintsRequested: data.hintsRequested || 0,
        breaksRequested: data.breaksRequested || 0,
        currentLevel: data.currentLevel || 1,
        points: data.points || 0,
        achievements: Array.isArray(data.achievements) ? data.achievements : [],

        // ✅ إصلاح: جرب أماكن متعددة
        completedLessons: data.completedLessons ?? data.stats?.completedLessons ?? 0,
        totalLessons: data.totalLessons ?? data.stats?.totalLessons ?? 0,
      };

      console.log('✅ Context Set:', {
        completedLessons: this.context.completedLessons,
        totalLessons: this.context.totalLessons
      });

      // Store user info if available
      if (data.user) {
        this.userInfo = data.user;
      }

      this.notifySubscribers();
      return this.context;
    } catch (error: any) {
      if (error.response?.status === 404) {
        console.log('Context not found, using defaults for new user');
      } else {
        console.error('Error fetching student context:', error);
      }
      // Return default context for new users instead of throwing
      this.context = this.getDefaultContext(userId);
      this.notifySubscribers();
      return this.context;
    }
  }

  async updateContext(action: string, data: any): Promise<void> {
    if (!this.context) {
      console.warn('Context not initialized. Initializing with default values.');
      const userId = data.userId || localStorage.getItem('userId');
      if (!userId) {
        throw new Error('No user ID available for context update');
      }
      this.context = this.getDefaultContext(userId);
    }

    const update: ContextUpdate = {
      action,
      data,
      timestamp: Date.now(),
    };

    this.pendingUpdates.push(update);

    // Optimistically update local context
    if (typeof data === 'object' && !Array.isArray(data)) {
      this.context = {
        ...this.context,
        ...data,
      };
      this.notifySubscribers();
    }

    try {
      const payload = { action, metadata: data };

      const response = action === 'activity_tracked' || action.includes('optimistic')
        ? await api.post<any>(`/student-context/${this.context!.userId}/activity`, payload)
        : await api.put<any>(`/student-context/${this.context!.userId}`, payload);

      const updatedData = response.data.success ? response.data.data : response.data;

      // Merge the response data
      this.context = {
        ...this.context,
        ...updatedData,
      };

      this.pendingUpdates = this.pendingUpdates.filter(u => u.timestamp > update.timestamp);
      this.lastSyncTime = Date.now();
      this.notifySubscribers();
    } catch (error: any) {
      if (error.response?.status === 404) {
        // Context doesn't exist, try to create it
        if (this.context?.userId) {
          await this.fetchContext(this.context.userId);
        }
        return;
      }
      console.error('Error updating context:', error);
      // Don't throw - keep the optimistic update
    }
  }

  subscribeToChanges(callback: ContextChangeCallback): () => void {
    this.subscribers.add(callback);

    if (this.context) {
      callback(this.context);
    }

    return () => {
      this.subscribers.delete(callback);
    };
  }

  getContext(): StudentContext | null {
    return this.context;
  }

  clearContext(): void {
    this.context = null;
    this.pendingUpdates = [];
    this.subscribers.clear();

    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    this.startAutoSync();
  }

  private notifySubscribers(): void {
    if (this.context) {
      this.subscribers.forEach(callback => {
        try {
          callback(this.context!);
        } catch (error) {
          console.error('Error in context change callback:', error);
        }
      });
    }
  }

  private startAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(async () => {
      await this.syncPendingUpdates();
    }, 30000);
  }

  private async syncPendingUpdates(): Promise<void> {
    if (this.pendingUpdates.length === 0 || !this.context) {
      return;
    }

    const updates = [...this.pendingUpdates];
    this.pendingUpdates = [];

    try {
      // Send updates one by one as activity tracking
      for (const update of updates) {
        const response = await api.post<any>(
          `/student-context/${this.context!.userId}/activity`,
          {
            action: update.action,
            metadata: update.data,
          }
        );

        // axios response doesn't have .ok property, check status instead
        if (response.status >= 200 && response.status < 300) {
          const updatedData: any = response.data.success ? response.data.data : response.data;

          this.context = {
            ...this.context,
            ...updatedData,
          };
        }
      }

      this.lastSyncTime = Date.now();
      this.notifySubscribers();
    } catch (error) {
      console.error('Error syncing pending updates:', error);
      // Re-queue failed updates
      this.pendingUpdates.push(...updates);
    }
  }

  destroy(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    this.clearContext();
  }
}

const studentContextManager = new StudentContextManager();

export { StudentContextManager, studentContextManager };
export type { StudentContext };