/**
 * Emotional Intelligence Scale Configuration
 * All values use a 0-100 scale for consistency
 */

export const EMOTIONAL_SCALE = {
  MIN: 0,
  MAX: 100,
  DEFAULT_CONFIDENCE: 70,
  DEFAULT_ENGAGEMENT: 80,

  // Helper functions
  clamp: (value: number) => Math.max(0, Math.min(100, value)),
  isValid: (value: number) => value >= 0 && value <= 100,
};

// Adjustments (all out of 100)
export const ADJUSTMENTS = {
  // Performance-based adjustments
  CORRECT_ANSWER: 5,      // +5%
  WRONG_ANSWER: -10,      // -10%
  STREAK_BONUS: 8,        // +8% for maintaining streak

  // Interaction-based adjustments
  QUESTION_ASKED: 3,      // +3% engagement
  HINT_REQUESTED: -5,     // -5% confidence (needs help)
  LONG_SESSION: -5,       // -5% engagement (fatigue)
  SHORT_BREAK: 10,        // +10% engagement after break

  // Emotional indicators
  FRUSTRATED: -15,        // -15% confidence
  CONFUSED: -8,           // -8% confidence
  CONFIDENT: 10,          // +10% confidence
  ENGAGED: 12,            // +12% engagement
  BORED: -20,            // -20% engagement
  EXCITED: 15,           // +15% both
};

// Thresholds for triggering interventions
export const THRESHOLDS = {
  LOW_CONFIDENCE: 40,     // Below this needs encouragement
  LOW_ENGAGEMENT: 35,     // Below this needs break/change
  HIGH_CONFIDENCE: 85,    // Above this can increase difficulty
  HIGH_ENGAGEMENT: 90,    // Above this is in flow state

  // Critical levels
  CRITICAL_LOW: 20,       // Immediate intervention needed
  OPTIMAL_RANGE: {
    MIN: 60,
    MAX: 85
  }
};

// Time constants (in minutes)
export const TIME_CONSTANTS = {
  SESSION_WARNING: 30,    // Warn after 30 minutes
  SESSION_MAX: 45,        // Suggest break after 45 minutes
  BREAK_MIN: 5,          // Minimum break duration
  BREAK_RECOMMENDED: 10, // Recommended break duration
};

// Mood mappings
export const MOOD_MAPPING = {
  'happy': { confidence: 80, engagement: 85 },
  'neutral': { confidence: 70, engagement: 80 },
  'confused': { confidence: 50, engagement: 70 },
  'frustrated': { confidence: 40, engagement: 60 },
  'excited': { confidence: 85, engagement: 95 },
  'bored': { confidence: 60, engagement: 40 },
  'focused': { confidence: 75, engagement: 90 },
  'tired': { confidence: 55, engagement: 50 },
};

// Export helper function for consistent clamping
export function normalizeEmotionalValue(value: number): number {
  return EMOTIONAL_SCALE.clamp(Math.round(value));
}

// Calculate weighted average
export function calculateWeightedMood(
  confidence: number,
  engagement: number,
  recentPerformance: number = 0
): string {
  // Weight: 40% confidence, 40% engagement, 20% recent performance
  const weighted = (confidence * 0.4) + (engagement * 0.4) + (recentPerformance * 0.2);

  if (weighted >= 85) return 'excited';
  if (weighted >= 75) return 'happy';
  if (weighted >= 65) return 'focused';
  if (weighted >= 55) return 'neutral';
  if (weighted >= 45) return 'confused';
  if (weighted >= 35) return 'tired';
  if (weighted >= 25) return 'frustrated';
  return 'bored';
}

// Export for use across the application
export const EMOTIONAL_CONSTANTS = {
  SCALE: EMOTIONAL_SCALE,
  ADJUSTMENTS,
  THRESHOLDS,
  TIME: TIME_CONSTANTS,
  MOODS: MOOD_MAPPING,
  normalize: normalizeEmotionalValue,
  calculateMood: calculateWeightedMood,
};