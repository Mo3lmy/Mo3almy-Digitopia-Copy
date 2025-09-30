/**
 * Validation utilities for emotional and context data
 */

/**
 * Validate and normalize emotional values
 */
export function normalizeEmotionalValue(value: number | undefined, defaultValue: number = 70): number {
  if (value === undefined || value === null) return defaultValue;

  // إذا كانت القيمة بين 0-1، حولها لـ 0-100
  if (value > 0 && value <= 1) {
    value = value * 100;
  }

  // تأكد أنها 0-100
  return Math.max(0, Math.min(100, Math.round(value)));
}

/**
 * Validate StudentContext before sending to frontend
 */
export function validateStudentContext(context: any): any {
  return {
    ...context,
    averageConfidence: normalizeEmotionalValue(context.averageConfidence, 70),
    averageEngagement: normalizeEmotionalValue(context.averageEngagement, 80),
    completedLessons: Math.max(0, context.completedLessons || 0),
    totalLessons: Math.max(1, context.totalLessons || 1), // ✅ avoid division by zero
    currentLevel: Math.max(1, context.currentLevel || 1),
  };
}

/**
 * Convert emotional value to percentage (0-100)
 */
export function toPercentage(value: number): number {
  return normalizeEmotionalValue(value, 70);
}

/**
 * Convert percentage to decimal (0-1) if needed for legacy code
 */
export function toDecimal(value: number): number {
  return normalizeEmotionalValue(value, 70) / 100;
}

/**
 * Validate quiz scores
 */
export function validateQuizScore(score: number | undefined): number {
  if (score === undefined || score === null) return 0;

  // إذا كانت النتيجة بالفعل 0-100
  if (score >= 0 && score <= 100) return Math.round(score);

  // إذا كانت بين 0-1، حولها لـ percentage
  if (score >= 0 && score <= 1) return Math.round(score * 100);

  // قيمة خاطئة
  return 0;
}

/**
 * Batch validation for multiple contexts
 */
export function validateContextBatch(contexts: any[]): any[] {
  return contexts.map(validateStudentContext);
}

/**
 * Validate activity metadata
 */
export function validateActivityMetadata(metadata: any): any {
  if (!metadata) return {};

  const validated = { ...metadata };

  // Normalize confidence and engagement if present
  if ('confidence' in validated) {
    validated.confidence = normalizeEmotionalValue(validated.confidence);
  }
  if ('engagement' in validated) {
    validated.engagement = normalizeEmotionalValue(validated.engagement);
  }

  // Validate scores
  if ('score' in validated) {
    validated.score = validateQuizScore(validated.score);
  }

  return validated;
}

/**
 * Ensure mood is valid
 */
export function validateMood(mood: string | undefined): string {
  const validMoods = ['neutral', 'happy', 'confused', 'frustrated', 'confident', 'engaged'];

  if (!mood || !validMoods.includes(mood)) {
    return 'neutral';
  }

  return mood;
}

/**
 * Full context validation with all fields
 */
export function fullValidateStudentContext(context: any): any {
  const validated = validateStudentContext(context);

  // Additional validations
  validated.currentMood = validateMood(validated.currentMood);
  validated.averageScore = validateQuizScore(validated.averageScore);

  // Ensure arrays exist
  validated.strugglingTopics = validated.strugglingTopics || [];
  validated.masteredTopics = validated.masteredTopics || [];
  validated.recentTopics = validated.recentTopics || [];
  validated.achievements = validated.achievements || [];

  // Ensure numbers are valid
  validated.correctAnswers = Math.max(0, validated.correctAnswers || 0);
  validated.wrongAnswers = Math.max(0, validated.wrongAnswers || 0);
  validated.hintsRequested = Math.max(0, validated.hintsRequested || 0);
  validated.totalLearningTime = Math.max(0, validated.totalLearningTime || 0);
  validated.streakCount = Math.max(0, validated.streakCount || 0);

  return validated;
}