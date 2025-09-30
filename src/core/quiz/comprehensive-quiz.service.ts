import { prisma } from '../../config/database.config';
import { questionBankService } from './question-bank.service';

type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';

interface ComprehensiveQuizOptions {
  maxQuestions?: number;
  difficulty?: Difficulty | 'MIXED';
  subjectId?: string;
  unitId?: string;
}

class ComprehensiveQuizService {

  /**
   * اختبار شامل على كل الدروس المكتملة
   */
  async createComprehensiveQuiz(
    userId: string,
    options: ComprehensiveQuizOptions = {}
  ) {

    const maxQuestions = options.maxQuestions || 30;

    console.log(`📋 Creating comprehensive quiz for user ${userId}`);

    // 1️⃣ جلب الدروس المكتملة
    const completedLessons = await this.getCompletedLessons(
      userId,
      options.subjectId
    );

    if (completedLessons.length === 0) {
      throw new Error('لا توجد دروس مكتملة للاختبار');
    }

    console.log(`✅ Found ${completedLessons.length} completed lessons`);

    // 2️⃣ توزيع الأسئلة على الدروس
    const questionsPerLesson = Math.max(
      1,
      Math.floor(maxQuestions / completedLessons.length)
    );

    // 3️⃣ جلب الأسئلة من كل درس
    const allQuestions = [];

    for (const lesson of completedLessons) {
      const questions = await questionBankService.getQuestions({
        lessonIds: [lesson.lessonId],
        difficulty: options.difficulty,
        userId,
        excludeRecent: true,
        count: questionsPerLesson
      });

      allQuestions.push(...questions);
    }

    console.log(`✅ Collected ${allQuestions.length} questions total`);

    // 4️⃣ إنشاء QuizAttempt وحفظ الأسئلة في metadata
    const questionsToSave = allQuestions.slice(0, maxQuestions);

    const attempt = await prisma.quizAttempt.create({
      data: {
        userId,
        lessonId: completedLessons[0].lessonId,
        totalQuestions: questionsToSave.length,
        correctAnswers: 0,
        score: 0,
        metadata: JSON.stringify({
          type: 'comprehensive',
          lessonsIncluded: completedLessons.map((l: any) => l.lessonId),
          subjectId: options.subjectId,
          questions: questionsToSave  // ✅ احفظ الأسئلة هنا
        })
      }
    });

    return {
      attemptId: attempt.id,
      questions: questionsToSave,
      lessonsIncluded: completedLessons.length,
      totalQuestions: questionsToSave.length,
      type: 'comprehensive'
    };
  }

  /**
   * اختبار على unit كامل
   */
  async createUnitQuiz(
    userId: string,
    unitId: string,
    maxQuestions: number = 15
  ) {

    console.log(`📋 Creating unit quiz for unit ${unitId}`);

    // 1️⃣ جلب دروس الـ unit
    const lessons = await prisma.lesson.findMany({
      where: { unitId },
      select: { id: true, title: true }
    });

    if (lessons.length === 0) {
      throw new Error('لا توجد دروس في هذا الـ unit');
    }

    const lessonIds = lessons.map((l: any) => l.id);

    // 2️⃣ جلب الأسئلة
    const questions = await questionBankService.getQuestions({
      lessonIds,
      difficulty: 'MIXED',
      userId,
      excludeRecent: true,
      count: maxQuestions
    });

    // 3️⃣ إنشاء attempt وحفظ الأسئلة
    const attempt = await prisma.quizAttempt.create({
      data: {
        userId,
        lessonId: lessonIds[0],
        totalQuestions: questions.length,
        correctAnswers: 0,
        score: 0,
        metadata: JSON.stringify({
          type: 'unit',
          unitId,
          lessonsIncluded: lessonIds,
          questions: questions  // ✅ احفظ الأسئلة
        })
      }
    });

    return {
      attemptId: attempt.id,
      questions,
      lessonsIncluded: lessons.length,
      totalQuestions: questions.length,
      type: 'unit'
    };
  }

  /**
   * اختبار على subject كامل
   */
  async createSubjectQuiz(
    userId: string,
    subjectId: string,
    maxQuestions: number = 50
  ) {

    console.log(`📋 Creating subject quiz for subject ${subjectId}`);

    // 1️⃣ جلب جميع دروس الـ subject
    const lessons = await prisma.lesson.findMany({
      where: {
        unit: { subjectId }
      },
      select: { id: true, title: true }
    });

    if (lessons.length === 0) {
      throw new Error('لا توجد دروس في هذا الـ subject');
    }

    const lessonIds = lessons.map((l: any) => l.id);

    // 2️⃣ جلب الأسئلة
    const questions = await questionBankService.getQuestions({
      lessonIds,
      difficulty: 'MIXED',
      userId,
      excludeRecent: true,
      count: maxQuestions
    });

    // 3️⃣ إنشاء attempt وحفظ الأسئلة
    const attempt = await prisma.quizAttempt.create({
      data: {
        userId,
        lessonId: lessonIds[0],
        totalQuestions: questions.length,
        correctAnswers: 0,
        score: 0,
        metadata: JSON.stringify({
          type: 'subject',
          subjectId,
          lessonsIncluded: lessonIds,
          questions: questions  // ✅ احفظ الأسئلة
        })
      }
    });

    return {
      attemptId: attempt.id,
      questions,
      lessonsIncluded: lessons.length,
      totalQuestions: questions.length,
      type: 'subject'
    };
  }

  /**
   * جلب الدروس المكتملة للطالب
   */
  private async getCompletedLessons(
    userId: string,
    subjectId?: string
  ) {

    const where: any = {
      userId,
      status: 'COMPLETED'
    };

    if (subjectId) {
      where.lesson = {
        unit: { subjectId }
      };
    }

    return await prisma.progress.findMany({
      where,
      select: {
        lessonId: true,
        lesson: {
          select: {
            id: true,
            title: true
          }
        }
      },
      orderBy: { completedAt: 'desc' },
      take: 20  // آخر 20 درس
    });
  }

  /**
   * الحصول على تفاصيل اختبار شامل
   */
  async getQuizDetails(attemptId: string) {
    const attempt = await prisma.quizAttempt.findUnique({
      where: { id: attemptId },
      include: {
        lesson: {
          select: {
            id: true,
            title: true,
            titleAr: true
          }
        }
      }
    });

    if (!attempt) {
      throw new Error('الاختبار غير موجود');
    }

    let metadata: any = {};
    if (attempt.metadata) {
      try {
        metadata = JSON.parse(attempt.metadata);
      } catch (e) {
        console.error('Error parsing metadata:', e);
      }
    }

    return {
      attemptId: attempt.id,
      type: metadata.type || 'lesson',
      totalQuestions: attempt.totalQuestions,
      correctAnswers: attempt.correctAnswers,
      score: attempt.score,
      completedAt: attempt.completedAt,
      lessonsIncluded: metadata.lessonsIncluded?.length || 1,
      questions: metadata.questions || [],  // ✅ ارجع الأسئلة المحفوظة
      metadata
    };
  }
}

export const comprehensiveQuizService = new ComprehensiveQuizService();