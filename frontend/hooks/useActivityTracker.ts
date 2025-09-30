import { useCallback, useEffect, useRef } from 'react';
import { studentContextManager } from '../services/studentContext';
import { achievementTracker, ACHIEVEMENT_ACTIONS } from '../services/achievementTracker';
import { API_URL } from '@/config/api.config';
import { EMOTIONAL_SCALE, ADJUSTMENTS } from '@/config/constants';

interface ActivityMetadata {
  questionId?: string;
  answer?: string;
  isCorrect?: boolean;
  timeSpent?: number;
  topic?: string;
  lessonId?: string;
  seconds?: number;
  type?: string;
  reason?: string;
  indicator?: string;
  confidence?: number;  // Added for emotional tracking
  engagement?: number;  // Added for emotional tracking
  success?: boolean;
  timestamp?: number;
  slideIndex?: number;
  totalSlides?: number;
  slideContent?: any;
  direction?: string;
}

// Remove duplicate API_URL - already imported from api.config

interface ActivityPayload {
  action: string;
  metadata: ActivityMetadata;
  userId?: string;
}

interface EmotionalPattern {
  fastClicking: number;
  lastClickTime: number;
  pauseStart: number;
  correctStreak: number;
}

export const useActivityTracker = () => {
  const emotionalPatternRef = useRef<EmotionalPattern>({
    fastClicking: 0,
    lastClickTime: 0,
    pauseStart: Date.now(),
    correctStreak: 0,
  });

  const lessonTimerRef = useRef<NodeJS.Timeout | null>(null);
  const currentLessonRef = useRef<string | null>(null);

  const sendActivity = useCallback(async (payload: ActivityPayload) => {
    const context = studentContextManager.getContext();
    if (!context?.userId) {
      console.error('No user context available for tracking');
      return null;
    }

    try {
      const response = await fetch(`${API_URL}/student-context/${context.userId}/activity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          action: payload.action,
          metadata: {
            ...payload.metadata,
            timestamp: Date.now(),
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to track activity: ${response.statusText}`);
      }

      const updatedContext = await response.json();

      await studentContextManager.updateContext('activity_tracked', {
        action: payload.action,
        updatedFields: updatedContext,
      });

      return updatedContext;
    } catch (error) {
      console.error('Error tracking activity:', error);

      await studentContextManager.updateContext('activity_pending', {
        action: payload.action,
        metadata: payload.metadata,
      });

      throw error;
    }
  }, []);

  const trackQuizAnswer = useCallback(async (
    questionId: string,
    answer: string,
    isCorrect: boolean,
    timeSpent: number,
    topic: string
  ) => {
    const now = Date.now();
    const pattern = emotionalPatternRef.current;

    if (isCorrect) {
      pattern.correctStreak++;
    } else {
      pattern.correctStreak = 0;
    }

    if (now - pattern.lastClickTime < 1000) {
      pattern.fastClicking++;
    } else {
      pattern.fastClicking = 0;
    }
    pattern.lastClickTime = now;

    const context = studentContextManager.getContext();
    if (context) {
      const newCorrect = isCorrect ? context.correctAnswers + 1 : context.correctAnswers;
      const newWrong = !isCorrect ? context.wrongAnswers + 1 : context.wrongAnswers;
      const totalAnswers = newCorrect + newWrong;

      const optimisticUpdate = {
        ...context,
        correctAnswers: newCorrect,
        wrongAnswers: newWrong,
        averageScore: totalAnswers > 0
          ? ((newCorrect / totalAnswers) * 100)
          : 0,
      };

      await studentContextManager.updateContext('optimistic_quiz_answer', optimisticUpdate);

      await achievementTracker.checkAchievements(
        optimisticUpdate,
        ACHIEVEMENT_ACTIONS.QUIZ_ANSWER,
        {
          questionId,
          isCorrect,
          topic,
          correctStreak: pattern.correctStreak,
          timeSpent
        }
      );

      if (pattern.correctStreak === 10) {
        await achievementTracker.checkSpecificAchievement('10_correct_streak');
      }
    }

    if (pattern.fastClicking > 3) {
      await trackEmotionalIndicator('frustrated');
    } else if (pattern.correctStreak >= 3) {
      await trackEmotionalIndicator('confident');
    }

    const result = await sendActivity({
      action: 'quiz_answer',
      metadata: {
        questionId,
        answer,
        isCorrect,
        timeSpent,
        topic,
      },
    });

    return result;
  }, [sendActivity]);

  const trackLessonTime = useCallback(async (lessonId: string, seconds: number) => {
    const context = studentContextManager.getContext();
    if (context) {
      const optimisticUpdate = {
        ...context,
        totalLearningTime: context.totalLearningTime + Math.round(seconds / 60),
      };

      await studentContextManager.updateContext('optimistic_lesson_time', optimisticUpdate);

      const totalMinutes = Math.floor(optimisticUpdate.totalLearningTime / 60);
      if (totalMinutes >= 30 && totalMinutes < 31) {
        await achievementTracker.checkSpecificAchievement('30_minutes_study');
      }

      await achievementTracker.checkAchievements(
        optimisticUpdate,
        ACHIEVEMENT_ACTIONS.TIME_MILESTONE,
        {
          lessonId,
          totalTime: optimisticUpdate.totalLearningTime,
          sessionTime: seconds
        }
      );
    }

    return await sendActivity({
      action: 'lesson_time',
      metadata: {
        lessonId,
        seconds,
      },
    });
  }, [sendActivity]);

  const trackHelpRequest = useCallback(async (
    type: 'hint' | 'help' | 'explanation',
    lessonId: string,
    reason?: string
  ) => {
    const context = studentContextManager.getContext();
    if (context) {
      const optimisticUpdate = {
        ...context,
        hintsRequested: context.hintsRequested + 1,
      };

      await studentContextManager.updateContext('optimistic_help_request', optimisticUpdate);
    }

    return await sendActivity({
      action: 'help_request',
      metadata: {
        type,
        lessonId,
        reason: reason || 'user_requested',
      },
    });
  }, [sendActivity]);

  const trackEmotionalIndicator = useCallback(async (indicator: string) => {
    const context = studentContextManager.getContext();
    if (!context) return;

    let confidence = context.averageConfidence || EMOTIONAL_SCALE.DEFAULT_CONFIDENCE;
    let engagement = context.averageEngagement || EMOTIONAL_SCALE.DEFAULT_ENGAGEMENT;
    let mood = context.currentMood;

    // ✅ التعديلات بالأرقام الصحيحة (من 100)
    switch (indicator) {
      case 'frustrated':
        confidence = EMOTIONAL_SCALE.clamp(confidence + ADJUSTMENTS.FRUSTRATED);
        engagement = EMOTIONAL_SCALE.clamp(engagement - 10);
        mood = 'frustrated';
        break;
      case 'confused':
        confidence = EMOTIONAL_SCALE.clamp(confidence + ADJUSTMENTS.CONFUSED);
        mood = 'confused';
        break;
      case 'confident':
        confidence = EMOTIONAL_SCALE.clamp(confidence + ADJUSTMENTS.CONFIDENT);
        engagement = EMOTIONAL_SCALE.clamp(engagement + 10);
        mood = 'confident';
        break;
      case 'engaged':
        engagement = EMOTIONAL_SCALE.clamp(engagement + ADJUSTMENTS.ENGAGED);
        mood = 'engaged';
        break;
    }

    const optimisticUpdate = {
      ...context,
      currentMood: mood,
      averageConfidence: confidence,  // ✅ قيم من 0-100
      averageEngagement: engagement,
    };

    await studentContextManager.updateContext('optimistic_emotional_update', optimisticUpdate);

    return await sendActivity({
      action: 'emotional_indicator',
      metadata: { indicator, confidence, engagement },
    });
  }, [sendActivity]);

  const trackTopicInteraction = useCallback(async (topic: string, success: boolean) => {
    const context = studentContextManager.getContext();
    if (context) {
      let strugglingTopics = [...context.strugglingTopics];
      let masteredTopics = [...context.masteredTopics];
      let recentTopics = [...context.recentTopics];

      if (!recentTopics.includes(topic)) {
        recentTopics = [topic, ...recentTopics.slice(0, 9)];
      }

      const wasMastered = masteredTopics.includes(topic);

      if (success) {
        strugglingTopics = strugglingTopics.filter(t => t !== topic);
        if (!masteredTopics.includes(topic)) {
          masteredTopics.push(topic);
        }
      } else {
        masteredTopics = masteredTopics.filter(t => t !== topic);
        if (!strugglingTopics.includes(topic)) {
          strugglingTopics.push(topic);
        }
      }

      const optimisticUpdate = {
        ...context,
        strugglingTopics,
        masteredTopics,
        recentTopics,
      };

      await studentContextManager.updateContext('optimistic_topic', optimisticUpdate);

      if (success && !wasMastered) {
        await achievementTracker.checkAchievements(
          optimisticUpdate,
          ACHIEVEMENT_ACTIONS.TOPIC_MASTERED,
          {
            topic,
            masteredTopics: masteredTopics.length
          }
        );
      }
    }

    return await sendActivity({
      action: 'topic_interaction',
      metadata: {
        topic,
        success,
      },
    });
  }, [sendActivity]);

  const startLessonTracking = useCallback((lessonId: string) => {
    currentLessonRef.current = lessonId;

    if (lessonTimerRef.current) {
      clearInterval(lessonTimerRef.current);
    }

    const context = studentContextManager.getContext();
    if (context) {
      achievementTracker.checkAchievements(
        context,
        ACHIEVEMENT_ACTIONS.LESSON_COMPLETE,
        { lessonId }
      );
    }

    lessonTimerRef.current = setInterval(async () => {
      if (currentLessonRef.current) {
        await trackLessonTime(currentLessonRef.current, 30);
      }
    }, 30000);

    return () => stopLessonTracking();
  }, [trackLessonTime]);

  const stopLessonTracking = useCallback(() => {
    if (lessonTimerRef.current) {
      clearInterval(lessonTimerRef.current);
      lessonTimerRef.current = null;
    }
    currentLessonRef.current = null;
  }, []);

  const detectLongPause = useCallback(() => {
    const now = Date.now();
    const pattern = emotionalPatternRef.current;

    if (now - pattern.pauseStart > 30000) {
      trackEmotionalIndicator('confused');
      pattern.pauseStart = now;
    }
  }, [trackEmotionalIndicator]);

  const checkLoginAchievements = useCallback(async () => {
    const context = studentContextManager.getContext();
    if (context) {
      await achievementTracker.checkAchievements(
        context,
        ACHIEVEMENT_ACTIONS.LOGIN,
        { streakCount: context.streakCount }
      );

      if (context.streakCount === 3) {
        await achievementTracker.checkSpecificAchievement('3_day_streak');
      } else if (context.streakCount === 7) {
        await achievementTracker.checkSpecificAchievement('7_day_streak');
      }
    }
  }, []);

  useEffect(() => {
    const pauseInterval = setInterval(detectLongPause, 5000);

    const handleActivity = () => {
      emotionalPatternRef.current.pauseStart = Date.now();
    };

    window.addEventListener('click', handleActivity);
    window.addEventListener('keydown', handleActivity);

    checkLoginAchievements();

    return () => {
      clearInterval(pauseInterval);
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      stopLessonTracking();
    };
  }, [detectLongPause, stopLessonTracking, checkLoginAchievements]);

  // Generic activity tracker for slide navigation
  const trackActivity = useCallback(async (action: string, metadata: ActivityMetadata) => {
    return await sendActivity({
      action,
      metadata,
    });
  }, [sendActivity]);

  return {
    trackQuizAnswer,
    trackLessonTime,
    trackHelpRequest,
    trackEmotionalIndicator,
    trackTopicInteraction,
    startLessonTracking,
    stopLessonTracking,
    trackActivity,
  };
};