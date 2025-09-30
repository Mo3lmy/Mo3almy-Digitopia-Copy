import { prisma } from '../../config/database.config';
import { openAIService } from '../../services/ai/openai.service';
import { questionBankService } from './question-bank.service';

type Question = any;
type QuizAttempt = any;
type Difficulty = 'EASY' | 'MEDIUM' | 'HARD' | 'MIXED';
type QuestionType = 'MCQ' | 'TRUE_FALSE' | 'SHORT_ANSWER' | 'FILL_BLANK';

interface QuizStatistics {
  totalAttempts: number;
  averageScore: number;
  passRate: number;
  averageTimeSpent: number;
  difficultyDistribution: Record<string, number>;
  questionTypeDistribution: Record<string, number>;
}

interface QuizSession {
  attemptId: string;
  questions: any[];
  currentQuestion: number;
  startTime: Date;
  timeLimit: number;
}

interface QuizResult {
  attemptId: string;
  score: number;
  percentage: number;
  passed: boolean;
  timeSpent: number;
  correctAnswers: number;
  totalQuestions: number;
  questionResults: any[];
}

interface QuizHistory {
  attempts: any[];
  totalAttempts: number;
  averageScore: number;
  bestScore: number;
  lastAttemptDate: Date | null;
}

class QuizService {
  private readonly PASS_THRESHOLD = 60;
  private readonly MAX_QUESTIONS_PER_QUIZ = 10;

  /**
   * Generate quiz questions for a lesson
   * الآن يستخدم Question Bank الهجين (Static + Dynamic)
   */
  async generateQuizQuestions(
    lessonId: string,
    count: number = 5,
    difficulty?: Difficulty,
    userId?: string
  ): Promise<Question[]> {
    try {
      console.log(`📝 Generating ${count} questions for lesson ${lessonId}`);

      // ✅ استخدم Question Bank Service
      const questions = await questionBankService.getQuestions({
        lessonIds: [lessonId],
        difficulty: difficulty || 'MIXED',  // تنوع تلقائي
        types: ['MCQ', 'TRUE_FALSE', 'SHORT_ANSWER'],  // الأنواع المتاحة
        excludeRecent: userId ? true : false,  // تجنب التكرار إذا كان هناك userId
        userId,
        count
      });

      console.log(`✅ Got ${questions.length} questions from Question Bank`);

      return questions as Question[];
    } catch (error) {
      console.error('Error generating quiz questions:', error);
      throw error;
    }
  }

  /**
   * Start a quiz attempt
   */
  async startQuizAttempt(
    userId: string,
    lessonId: string,
    questionCount?: number
  ): Promise<QuizSession> {
    try {
      // Get questions for the lesson
      const questions = await this.generateQuizQuestions(
        lessonId,
        questionCount || 5
      );

      // Create quiz attempt
      const attempt = await prisma.quizAttempt.create({
        data: {
          userId,
          lessonId,
          totalQuestions: questions.length,
          correctAnswers: 0,
          score: 0,
          confidenceLevel: 0,
          stressLevel: 0
        }
      });

      return {
        attemptId: attempt.id,
        questions,
        currentQuestion: 0,
        startTime: new Date(),
        timeLimit: 1800000 // 30 minutes
      };
    } catch (error) {
      console.error('Error starting quiz attempt:', error);
      throw error;
    }
  }

  /**
   * Submit answer for a question
   */
  async submitAnswer(
    attemptId: string,
    questionId: string,
    answer: string,
    timeSpent: number
  ): Promise<boolean> {
    try {
      const question = await prisma.question.findUnique({
        where: { id: questionId }
      });

      if (!question) {
        throw new Error('Question not found');
      }

      const isCorrect = this.checkAnswer(question, answer);

      // Save answer
      await prisma.quizAttemptAnswer.create({
        data: {
          attemptId,
          questionId,
          userAnswer: answer,
          isCorrect,
          timeSpent
        }
      });

      // ✅ تحديث إحصائيات السؤال
      await questionBankService.updateQuestionStats(questionId, isCorrect);

      return isCorrect;
    } catch (error) {
      console.error('Error submitting answer:', error);
      throw error;
    }
  }

  /**
   * Complete quiz and calculate results
   */
  async completeQuiz(attemptId: string): Promise<QuizResult> {
    try {
      const attempt = await prisma.quizAttempt.findUnique({
        where: { id: attemptId },
        include: {
          answers: {
            include: {
              question: true
            }
          }
        }
      });

      if (!attempt) {
        throw new Error('Quiz attempt not found');
      }

      const correctAnswers = attempt.answers.filter((a: any) => a.isCorrect).length;
      const totalQuestions = attempt.answers.length;
      const percentage = (correctAnswers / totalQuestions) * 100;
      const passed = percentage >= this.PASS_THRESHOLD;

      // Calculate time spent
      const timeSpent = attempt.answers.reduce((sum: number, a: any) => sum + (a.timeSpent || 0), 0);

      // Update attempt
      await prisma.quizAttempt.update({
        where: { id: attemptId },
        data: {
          correctAnswers,
          score: percentage,
          completedAt: new Date(),
          timeSpent
        }
      });

      return {
        attemptId,
        score: percentage,
        percentage,
        passed,
        timeSpent,
        correctAnswers,
        totalQuestions,
        questionResults: attempt.answers.map((a: any) => ({
          questionId: a.questionId,
          question: a.question.question,
          userAnswer: '', // a.answer not available,
          correctAnswer: a.question.correctAnswer,
          isCorrect: a.isCorrect,
          explanation: a.question.explanation
        }))
      };
    } catch (error) {
      console.error('Error completing quiz:', error);
      throw error;
    }
  }

  /**
   * Get user quiz history
   */
  async getUserQuizHistory(
    userId: string,
    lessonId?: string
  ): Promise<QuizHistory> {
    try {
      const where: any = { userId };
      if (lessonId) {
        where.lessonId = lessonId;
      }

      const attempts = await prisma.quizAttempt.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 20
      });

      const totalAttempts = attempts.length;
      const averageScore = totalAttempts > 0
        ? attempts.reduce((sum: number, a: any) => sum + (a.score || 0), 0) / totalAttempts
        : 0;
      const bestScore = totalAttempts > 0
        ? Math.max(...attempts.map((a: any) => a.score || 0))
        : 0;
      const lastAttemptDate = attempts[0]?.createdAt || null;

      return {
        attempts,
        totalAttempts,
        averageScore,
        bestScore,
        lastAttemptDate
      };
    } catch (error) {
      console.error('Error getting quiz history:', error);
      throw error;
    }
  }

  /**
   * Get quiz statistics for a lesson
   */
  async getQuizStatistics(lessonId: string): Promise<QuizStatistics> {
    try {
      const attempts = await prisma.quizAttempt.findMany({
        where: { lessonId },
        include: {
          answers: {
            include: {
              question: true
            }
          }
        }
      });

      const totalAttempts = attempts.length;
      if (totalAttempts === 0) {
        return {
          totalAttempts: 0,
          averageScore: 0,
          passRate: 0,
          averageTimeSpent: 0,
          difficultyDistribution: {},
          questionTypeDistribution: {}
        };
      }

      const scores = attempts.map((a: any) => a.score || 0);
      const averageScore = scores.reduce((sum: number, s: any) => sum + s, 0) / totalAttempts;
      const passRate = (scores.filter((s: any) => s >= this.PASS_THRESHOLD).length / totalAttempts) * 100;
      const averageTimeSpent = attempts.reduce((sum: number, a: any) => sum + (a.timeSpent || 0), 0) / totalAttempts;

      // Calculate distributions
      const difficultyDistribution: Record<string, number> = {};
      const questionTypeDistribution: Record<string, number> = {};

      attempts.forEach((attempt: any) => {
        attempt.answers.forEach((answer: any) => {
          const difficulty = answer.question.difficulty;
          const type = answer.question.type;

          difficultyDistribution[difficulty] = (difficultyDistribution[difficulty] || 0) + 1;
          questionTypeDistribution[type] = (questionTypeDistribution[type] || 0) + 1;
        });
      });

      return {
        totalAttempts,
        averageScore,
        passRate,
        averageTimeSpent,
        difficultyDistribution,
        questionTypeDistribution
      };
    } catch (error) {
      console.error('Error getting quiz statistics:', error);
      throw error;
    }
  }

  /**
   * Helper method to check answer
   */
  private checkAnswer(question: Question, userAnswer: string): boolean {
    const normalizedAnswer = userAnswer.trim().toLowerCase();
    const normalizedCorrect = question.correctAnswer.trim().toLowerCase();

    switch (question.type) {
      case 'TRUE_FALSE':
        return normalizedAnswer === normalizedCorrect ||
               (normalizedAnswer === 'صح' && ['true', 'صح', 'صحيح', '1'].includes(normalizedCorrect)) ||
               (normalizedAnswer === 'خطأ' && ['false', 'خطأ', 'خاطئ', '0'].includes(normalizedCorrect));

      case 'MCQ':
        return normalizedAnswer === normalizedCorrect;

      case 'SHORT_ANSWER':
      case 'FILL_BLANK':
        return normalizedAnswer === normalizedCorrect ||
               normalizedAnswer.replace(/\s+/g, '') === normalizedCorrect.replace(/\s+/g, '');

      default:
        return normalizedAnswer === normalizedCorrect;
    }
  }

  /**
   * Generate fallback questions when AI fails
   */
  private async generateFallbackQuestions(
    lessonId: string,
    count: number,
    difficulty?: Difficulty
  ): Promise<Question[]> {
    // Simple fallback questions
    const fallbackQuestions = [];

    for (let i = 0; i < count; i++) {
      const question = await prisma.question.create({
        data: {
          lessonId,
          type: 'MCQ',
          question: `سؤال تجريبي رقم ${i + 1} من الدرس`,
          options: JSON.stringify(['خيار أ', 'خيار ب', 'خيار ج', 'خيار د']),
          correctAnswer: '0',
          explanation: 'هذا سؤال تجريبي',
          difficulty: (difficulty && difficulty !== 'MIXED' ? difficulty : 'MEDIUM') as 'EASY' | 'MEDIUM' | 'HARD',
          points: 1,
          order: i + 1
        }
      });
      fallbackQuestions.push(question);
    }

    return fallbackQuestions;
  }
}

// Export singleton
export const quizService = new QuizService();