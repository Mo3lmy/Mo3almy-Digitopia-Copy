import { prisma } from '../../config/database.config';
import { ragService } from '../rag/rag.service';

type Question = any;
type Difficulty = 'EASY' | 'MEDIUM' | 'HARD' | 'MIXED';
type QuestionType = 'MCQ' | 'TRUE_FALSE' | 'SHORT_ANSWER' | 'FILL_BLANK';

interface QuestionCriteria {
  lessonIds?: string[];
  difficulty?: Difficulty | 'MIXED';
  types?: QuestionType[];
  excludeRecent?: boolean;
  userId?: string;
  count: number;
}

class QuestionBankService {

  private readonly STATIC_RATIO = 0.6;  // 60% static, 40% dynamic

  /**
   * الدالة الرئيسية: جلب أسئلة هجينة (Static + Dynamic)
   */
  async getQuestions(criteria: QuestionCriteria): Promise<any[]> {
    const { count } = criteria;

    console.log(`📚 Getting ${count} questions with criteria:`, criteria);

    // 1️⃣ حساب التوزيع
    const staticCount = Math.ceil(count * this.STATIC_RATIO);
    const dynamicCount = count - staticCount;

    // 2️⃣ جلب Static Questions
    const staticQuestions = await this.getStaticQuestions(criteria, staticCount);
    console.log(`✅ Got ${staticQuestions.length} static questions`);

    // 3️⃣ إذا لم تكفِ، ولد Dynamic
    const needed = count - staticQuestions.length;
    let dynamicQuestions: any[] = [];

    if (needed > 0 && dynamicCount > 0) {
      dynamicQuestions = await this.generateDynamicQuestions(criteria, needed);
      console.log(`✅ Generated ${dynamicQuestions.length} dynamic questions`);
    }

    // 4️⃣ دمج وخلط
    const allQuestions = [...staticQuestions, ...dynamicQuestions];
    return this.shuffleArray(allQuestions).slice(0, count);
  }

  /**
   * جلب أسئلة من Question Bank
   */
  private async getStaticQuestions(
    criteria: QuestionCriteria,
    count: number
  ): Promise<Question[]> {

    const where: any = {
      isActive: true,
      isDynamic: false  // Static questions only
    };

    // 📍 تصفية حسب الدروس
    if (criteria.lessonIds && criteria.lessonIds.length > 0) {
      where.lessonId = criteria.lessonIds.length === 1
        ? criteria.lessonIds[0]
        : { in: criteria.lessonIds };
    }

    // 📍 تصفية حسب الصعوبة
    if (criteria.difficulty && criteria.difficulty !== 'MIXED') {
      where.difficulty = criteria.difficulty;
    }

    // 📍 تصفية حسب النوع
    if (criteria.types && criteria.types.length > 0) {
      where.type = { in: criteria.types };
    }

    // 📍 استبعاد الأسئلة الأخيرة
    if (criteria.excludeRecent && criteria.userId) {
      const recentAnswers = await prisma.quizAttemptAnswer.findMany({
        where: {
          attempt: { userId: criteria.userId }
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { questionId: true }
      });

      const recentIds = recentAnswers.map((a: any) => a.questionId);
      if (recentIds.length > 0) {
        where.id = { notIn: recentIds };
      }
    }

    // 🔍 جلب الأسئلة (ضعف العدد للاختيار)
    const questions = await prisma.question.findMany({
      where,
      take: count * 2,
      orderBy: { timesUsed: 'asc' }  // الأقل استخداماً أولاً
    });

    // 🎲 اختر عشوائياً
    const selected = this.shuffleArray(questions).slice(0, count);

    // ✅ حدث timesUsed
    await Promise.all(
      selected.map((q: any) =>
        prisma.question.update({
          where: { id: q.id },
          data: {
            timesUsed: { increment: 1 },
            lastUsedAt: new Date()
          }
        })
      )
    );

    return selected;
  }

  /**
   * توليد أسئلة ديناميكية باستخدام RAG
   */
  private async generateDynamicQuestions(
    criteria: QuestionCriteria,
    count: number
  ): Promise<any[]> {

    if (!criteria.lessonIds || criteria.lessonIds.length === 0) {
      console.log('⚠️ No lessonIds provided for dynamic generation');
      return [];
    }

    try {
      // استخدم أول lesson
      const lessonId = criteria.lessonIds[0];

      // ✨ استخدم RAG Service
      const questions = await ragService.generateQuizQuestions(
        lessonId,
        count,
        criteria.userId
      );

      // ✅ Filter invalid questions
      const validQuestions = questions.filter((q: any) => {
        const question = q.question || '';
        if (!question || question.length < 10) return false;
        if (question.includes('[') || question.includes(']')) return false;
        if (!q.type || !q.correctAnswer) return false;
        return true;
      });

      // ✅ تطبيع أنواع الأسئلة
      const normalizedQuestions = validQuestions.map((q: any) => {
        // تحويل أنواع مختلفة للصيغة الموحدة
        let type = (q.type || 'SHORT_ANSWER').toUpperCase();

        // تطبيع الأسماء
        if (type === 'TRUE_FALSE' || type === 'TRUEFALSE') {
          type = 'TRUE_FALSE';
          // إزالة options إذا وجدت
          delete q.options;
        } else if (type === 'MCQ' || type === 'MULTIPLECHOICE') {
          type = 'MCQ';
        } else if (type === 'FILL_BLANK' || type === 'FILLBLANK') {
          type = 'FILL_BLANK';
        } else if (type === 'SHORT_ANSWER' || type === 'SHORTANSWER') {
          type = 'SHORT_ANSWER';
        }

        return {
          ...q,
          type,
          id: `dynamic_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          isDynamic: true,
          timesUsed: 0
        };
      });

      console.log(`✅ Question Bank: ${questions.length} generated, ${normalizedQuestions.length} valid`);

      return normalizedQuestions;

    } catch (error) {
      console.error('Error generating dynamic questions:', error);
      return [];
    }
  }

  /**
   * خلط Array
   */
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * تحديث successRate لسؤال بعد إجابة
   */
  async updateQuestionStats(questionId: string, isCorrect: boolean): Promise<void> {
    try {
      const question = await prisma.question.findUnique({
        where: { id: questionId },
        select: { successRate: true, timesUsed: true }
      });

      if (!question) {
        console.log(`⚠️ Question ${questionId} not found for stats update`);
        return;
      }

      // حساب successRate الجديد
      const totalAttempts = question.timesUsed;
      if (totalAttempts === 0) return;

      const currentSuccesses = (question.successRate / 100) * totalAttempts;
      const newSuccesses = currentSuccesses + (isCorrect ? 1 : 0);
      const newSuccessRate = (newSuccesses / totalAttempts) * 100;

      await prisma.question.update({
        where: { id: questionId },
        data: {
          successRate: Math.round(newSuccessRate * 100) / 100  // round to 2 decimals
        }
      });

      console.log(`✅ Updated question ${questionId} successRate to ${newSuccessRate.toFixed(2)}%`);
    } catch (error) {
      console.error('Error updating question stats:', error);
    }
  }
}

export const questionBankService = new QuestionBankService();