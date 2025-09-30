/**
 * Emotional Scale Constants - Unified across frontend and backend
 * All values are in 0-100 scale
 */
export const EMOTIONAL_SCALE = {
  MIN: 0,
  MAX: 100,
  DEFAULT_CONFIDENCE: 70,
  DEFAULT_ENGAGEMENT: 80,

  // Helper function to ensure values stay within bounds
  clamp: (value: number): number => {
    return Math.max(0, Math.min(100, Math.round(value)));
  }
};

/**
 * Adjustment values for emotional indicators
 * These are the amounts to add/subtract from current values
 */
export const ADJUSTMENTS = {
  FRUSTRATED: -10,    // Reduces confidence by 10
  CONFUSED: -5,       // Reduces confidence by 5
  CONFIDENT: 10,      // Increases confidence by 10
  ENGAGED: 15,        // Increases engagement by 15
};

/**
 * Progress Constants
 */
export const PROGRESS = {
  BEGINNER_THRESHOLD: 30,
  INTERMEDIATE_THRESHOLD: 70,
  ADVANCED_THRESHOLD: 90,

  MIN_LESSONS_FOR_STATS: 1,
  DEFAULT_COMPLETION_RATE: 0,
};

/**
 * Achievement Thresholds
 */
export const ACHIEVEMENTS = {
  STREAK_3_DAYS: 3,
  STREAK_7_DAYS: 7,
  CORRECT_STREAK: 10,
  STUDY_TIME_30_MIN: 30,
  FAST_CLICK_THRESHOLD: 1000, // milliseconds
  FAST_CLICK_COUNT: 3,
  LONG_PAUSE_THRESHOLD: 30000, // 30 seconds
};

/**
 * Quiz Constants
 */
export const QUIZ = {
  PASS_THRESHOLD: 70, // 70% to pass
  EXCELLENCE_THRESHOLD: 90, // 90% for excellence
  TIME_LIMIT_DEFAULT: 300, // 5 minutes in seconds
};

/**
 * Session Constants
 */
export const SESSION = {
  LESSON_TIME_INTERVAL: 30000, // Track every 30 seconds
  ACTIVITY_CHECK_INTERVAL: 5000, // Check for inactivity every 5 seconds
};