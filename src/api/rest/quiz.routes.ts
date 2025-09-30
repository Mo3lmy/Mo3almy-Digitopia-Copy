import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { quizService } from '../../core/quiz/quiz.service';
import { progressService } from '../../core/progress/progress.service';
import { comprehensiveQuizService } from '../../core/quiz/comprehensive-quiz.service';
import { validateBody, validateParams, validateQuery } from '../middleware/validation.middleware';
import { authenticate } from '../middleware/auth.middleware';
import { successResponse, errorResponse } from '../../utils/response.utils';
import asyncHandler from 'express-async-handler';
import { prisma } from '../../config/database.config';
import { progressCalculator } from '../../core/progress/progress-calculator.service';

const router = Router();

// Validation schemas - FIXED: Removed UUID validation
const startQuizSchema = z.object({
  lessonId: z.string().min(1),  // ✅ تم التعديل
  questionCount: z.number().min(1).max(20).optional(),
});

const submitAnswerSchema = z.object({
  attemptId: z.string().min(1),   // ✅ تم التعديل
  questionId: z.string().min(1),  // ✅ تم التعديل
  answer: z.string(),
  timeSpent: z.number().min(0),
});

/**
 * @route   POST /api/v1/quiz/start
 * @desc    Start a new quiz attempt
 * @access  Private
 */
router.post(
  '/start',
  authenticate,
  validateBody(startQuizSchema),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { lessonId, questionCount } = req.body;
    
    const session = await quizService.startQuizAttempt(
      req.user!.userId,
      lessonId,
      questionCount
    );
    
    res.json(
      successResponse(session, 'Quiz started successfully')
    );
  })
);

/**
 * @route   POST /api/v1/quiz/answer
 * @desc    Submit answer for a question
 * @access  Private
 */
router.post(
  '/answer',
  authenticate,
  validateBody(submitAnswerSchema),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { attemptId, questionId, answer, timeSpent } = req.body;
    
    const isCorrect = await quizService.submitAnswer(
      attemptId,
      questionId,
      answer,
      timeSpent
    );
    
    res.json(
      successResponse(
        { isCorrect },
        isCorrect ? 'Correct answer!' : 'Incorrect answer'
      )
    );
  })
);

/**
 * @route   POST /api/v1/quiz/complete/:attemptId
 * @desc    Complete quiz and get results
 * @access  Private
 */
router.post(
  '/complete/:attemptId',
  authenticate,
  validateParams(z.object({ attemptId: z.string().min(1) })),  // ✅ تم التعديل
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const result = await quizService.completeQuiz(req.params.attemptId);
    
    res.json(
      successResponse(result, 'Quiz completed successfully')
    );
  })
);

/**
 * @route   GET /api/v1/quiz/history
 * @desc    Get user's quiz history
 * @access  Private
 */
router.get(
  '/history',
  authenticate,
  validateQuery(z.object({
    lessonId: z.string().optional(),  // ✅ تم التعديل - أزلت .uuid()
  })),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { lessonId } = req.query as any;
    
    const history = await quizService.getUserQuizHistory(
      req.user!.userId,
      lessonId
    );
    
    res.json(
      successResponse(history, 'Quiz history retrieved')
    );
  })
);

/**
 * @route   GET /api/v1/quiz/statistics/:lessonId
 * @desc    Get quiz statistics for a lesson
 * @access  Private
 */
router.get(
  '/statistics/:lessonId',
  authenticate,
  validateParams(z.object({ lessonId: z.string().min(1) })),  // ✅ تم التعديل
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const stats = await quizService.getQuizStatistics(req.params.lessonId);
    
    res.json(
      successResponse(stats, 'Statistics retrieved')
    );
  })
);

/**
 * @route   POST /api/v1/quiz/generate
 * @desc    Generate quiz questions for a lesson
 * @access  Private (Teacher/Admin)
 */
router.post(
  '/generate',
  authenticate,
  validateBody(z.object({
    lessonId: z.string().min(1),
    count: z.number().min(1).max(20).default(5),
    difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).optional(),
  })),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const { lessonId, count, difficulty } = req.body;

      const questions = await quizService.generateQuizQuestions(
        lessonId,
        count,
        difficulty
      );

      // Safe parsing with error handling
      const formattedQuestions = questions.map(q => {
        // Helper function for safe JSON parsing
        const safeParse = (data: any, fallback: any = null) => {
          if (!data) return fallback;
          if (typeof data !== 'string') return data;
          try {
            return JSON.parse(data);
          } catch (e) {
            console.error(`Failed to parse JSON for question ${q.id}:`, e);
            return fallback;
          }
        };

        return {
          id: q.id,
          lessonId: q.lessonId,
          type: q.type,
          question: q.question,
          options: q.options
            ? safeParse(q.options, q.type === 'TRUE_FALSE' ? ['صح', 'خطأ'] : [])
            : q.type === 'TRUE_FALSE' ? ['صح', 'خطأ'] : undefined,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
          points: q.points || 1,
          difficulty: q.difficulty || 'MEDIUM',
          hints: safeParse(q.hints),
          tags: safeParse(q.tags),
          stepByStepSolution: safeParse(q.stepByStepSolution),
          encouragementMessages: safeParse(q.encouragementMessages)
        };
      });

      res.json(
        successResponse(
          { questions: formattedQuestions },
          'Questions generated successfully'
        )
      );
    } catch (error) {
      console.error('Error in /generate endpoint:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate questions',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   GET /api/v1/quiz/lessons/:lessonId/exercises
 * @desc    Get exercises from enriched content
 * @access  Private
 *   NEW ENDPOINT
 */
router.get(
  '/lessons/:lessonId/exercises',
  authenticate,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { lessonId } = req.params;
    const { difficulty, count = '10' } = req.query as { difficulty?: string; count?: string };

    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { content: true }
    });

    if (!lesson?.content) {
      res.status(404).json(
        errorResponse('NO_CONTENT', 'No exercises found for this lesson')
      );
      return;
    }

    // Parse and return exercises
    let exercises: any[] = [];

    // Check enrichedContent first
    if (lesson.content.enrichedContent) {
      try {
        const enriched = typeof lesson.content.enrichedContent === 'string'
          ? JSON.parse(lesson.content.enrichedContent)
          : lesson.content.enrichedContent;
        exercises = enriched.exercises || [];
      } catch (e) {
        console.error('Error parsing enrichedContent:', e);
      }
    }

    // Fallback to exercises field
    if (exercises.length === 0 && lesson.content.exercises) {
      try {
        const parsedExercises = typeof lesson.content.exercises === 'string'
          ? JSON.parse(lesson.content.exercises)
          : lesson.content.exercises;
        if (Array.isArray(parsedExercises)) {
          exercises = parsedExercises;
        }
      } catch (e) {
        console.error('Error parsing exercises:', e);
      }
    }

    // Filter by difficulty if specified
    if (difficulty && exercises.length > 0) {
      exercises = exercises.filter(ex =>
        !ex.difficulty || ex.difficulty.toLowerCase() === difficulty.toLowerCase()
      );
    }

    // Limit results
    const limit = parseInt(count, 10);
    exercises = exercises.slice(0, limit);

    res.json(
      successResponse({
        exercises,
        total: exercises.length,
        lessonId,
        lessonTitle: lesson.titleAr || lesson.title,
        hasMore: exercises.length === limit,
        enrichmentLevel: lesson.content.enrichmentLevel || 0
      }, 'Exercises retrieved successfully')
    );
  })
);

/**
 * @route   POST /api/v1/quiz/submit-answer
 * @desc    Submit answer for a question (optional tracking)
 * @access  Private
 */
router.post(
  '/submit-answer',
  authenticate,
  validateBody(z.object({
    lessonId: z.string(),
    questionId: z.string(),
    answer: z.string(),
    isCorrect: z.boolean(),
    timeSpent: z.number().optional(),
    hintsUsed: z.number().optional()
  })),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { lessonId, questionId, answer, isCorrect, timeSpent, hintsUsed } = req.body;
    const userId = req.user?.userId;

    try {
      // Track answer in database (optional - for analytics)
      // You can implement this later if needed

      // For now, just acknowledge receipt
      res.json(
        successResponse({
          received: true,
          isCorrect,
          message: isCorrect ? 'إجابة صحيحة!' : 'حاول مرة أخرى'
        }, 'Answer recorded')
      );
    } catch (error) {
      // Silent fail - don't break the quiz experience
      res.json(
        successResponse({
          received: false,
          message: 'Unable to record answer'
        }, 'Answer tracking unavailable')
      );
    }
  })
);

// Progress endpoints

/**
 * @route   GET /api/v1/quiz/progress
 * @desc    Get user's overall progress
 * @access  Private
 */
router.get(
  '/progress',
  authenticate,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const progress = await progressService.getUserProgress(req.user!.userId);
    
    res.json(
      successResponse(progress, 'Progress retrieved successfully')
    );
  })
);

/**
 * @route   GET /api/v1/quiz/analytics
 * @desc    Get learning analytics
 * @access  Private
 */
router.get(
  '/analytics',
  authenticate,
  validateQuery(z.object({
    subjectId: z.string().optional(),  // ✅ تم التعديل - أزلت .uuid()
  })),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    console.log('[ANALYTICS] Request received');
    const { subjectId } = req.query as any;
    console.log('[ANALYTICS] Parameters:', { userId: req.user!.userId, subjectId });

    const analytics = await progressService.getLearningAnalytics(
      req.user!.userId,
      subjectId
    );
    console.log('[ANALYTICS] Success');

    res.json(
      successResponse(analytics, 'Analytics retrieved successfully')
    );
  })
);

/**
 * @route   GET /api/v1/quiz/leaderboard
 * @desc    Get leaderboard
 * @access  Private
 */
router.get(
  '/leaderboard',
  authenticate,
  validateQuery(z.object({
    subjectId: z.string().optional(),  // ✅ تم التعديل - أزلت .uuid()
    grade: z.string().transform(Number).optional(),
    limit: z.string().default('10').transform(Number).pipe(z.number()),
  })),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    console.log('[LEADERBOARD] Request received');
    const { subjectId, grade, limit } = req.query as any;
    console.log('[LEADERBOARD] Parameters:', { subjectId, grade: grade, gradeType: typeof grade, limit, limitType: typeof limit });

    const leaderboard = await progressService.getLeaderboard(
      subjectId,
      grade ? Number(grade) : undefined,
      Number(limit) || 10
    );
    console.log('[LEADERBOARD] Success');

    res.json(
      successResponse(leaderboard, 'Leaderboard retrieved')
    );
  })
);

/**
 * @route   POST /api/v1/quiz/exercises/track
 * @desc    Track exercise completion and update student context
 * @access  Private
 */
router.post(
  '/exercises/track',
  authenticate,
  validateBody(z.object({
    lessonId: z.string().min(1),
    totalQuestions: z.number().min(1),
    correctAnswers: z.number().min(0),
    timeSpent: z.number().min(0)
  })),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { lessonId, totalQuestions, correctAnswers, timeSpent } = req.body;
    const userId = (req.user as any)?.userId;

    if (!userId) {
      res.status(401).json(
        errorResponse('UNAUTHORIZED', 'User not authenticated')
      );
      return;
    }

    console.log(`📝 Tracking quiz: User ${userId}, Lesson ${lessonId}`);

    // 1️⃣ تحديث Progress مع الوقت (Source of Truth)
    const timeInMinutes = Math.round(timeSpent / 60);

    const currentProgress = await prisma.progress.findUnique({
      where: { userId_lessonId: { userId, lessonId } }
    });

    await prisma.progress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      update: {
        timeSpent: (currentProgress?.timeSpent || 0) + timeInMinutes,
        lastAccessedAt: new Date()
      },
      create: {
        userId,
        lessonId,
        status: 'IN_PROGRESS',
        timeSpent: timeInMinutes,
        lastAccessedAt: new Date()
      }
    });

    // 2️⃣ حساب الوقت الكلي من Progress (Source of Truth)
    const allProgress = await prisma.progress.findMany({
      where: { userId },
      select: { timeSpent: true }
    });
    const totalTime = allProgress.reduce((sum: number, p: any) => sum + p.timeSpent, 0);

    // 3️⃣ حساب الإحصائيات
    const wrongAnswers = totalQuestions - correctAnswers;
    const scorePercentage = Math.round((correctAnswers / totalQuestions) * 100);

    // 4️⃣ جلب StudentContext الحالي
    const existingContext = await prisma.studentContext.findUnique({
      where: { userId }
    });

    // 5️⃣ حساب المتوسط الجديد
    let newAverageScore = scorePercentage;
    if (existingContext) {
      const totalAttempts = existingContext.correctAnswers + existingContext.wrongAnswers;
      const totalQuizzes = totalAttempts > 0 ? Math.ceil(totalAttempts / 5) : 0;
      newAverageScore = totalQuizzes > 0
        ? Math.round(((existingContext.averageScore * totalQuizzes) + scorePercentage) / (totalQuizzes + 1))
        : scorePercentage;
    }

    // 6️⃣ تحديث StudentContext
    const updatedContext = await prisma.studentContext.upsert({
      where: { userId },
      update: {
        correctAnswers: (existingContext?.correctAnswers || 0) + correctAnswers,
        wrongAnswers: (existingContext?.wrongAnswers || 0) + wrongAnswers,
        averageScore: newAverageScore,
        totalLearningTime: totalTime,  // ✅ من Progress (Source of Truth)
        lastInteractionTime: new Date(),
        // تحديث الـ streak إذا كان الأداء جيد
        streakCount: scorePercentage >= 70
          ? (existingContext?.streakCount || 0) + 1
          : 0,
        longestStreak: scorePercentage >= 70 && existingContext
          ? Math.max(existingContext.longestStreak, (existingContext.streakCount || 0) + 1)
          : existingContext?.longestStreak || 0
      },
      create: {
        userId,
        learningStyle: 'visual',
        currentMood: 'neutral',
        correctAnswers,
        wrongAnswers,
        averageScore: scorePercentage,
        totalLearningTime: totalTime,  // ✅ من Progress
        currentLevel: 1,
        averageConfidence: 70,
        averageEngagement: 80,
        streakCount: scorePercentage >= 70 ? 1 : 0,
        longestStreak: scorePercentage >= 70 ? 1 : 0,
        questionsAsked: 0,
        hintsRequested: 0,
        breaksRequested: 0,
        sessionsCompleted: 0
      }
    });

    // 7️⃣ Create QuizAttempt record
    const quizAttempt = await prisma.quizAttempt.create({
      data: {
        userId,
        lessonId,
        score: scorePercentage,
        correctAnswers,
        totalQuestions,
        timeSpent,
        completedAt: new Date()
      }
    });

    console.log(`✅ Quiz tracked: ${scorePercentage}%, Total time: ${totalTime} mins`);

    res.json(
      successResponse({
        attempt: {
          id: quizAttempt.id,
          score: quizAttempt.score,
          correctAnswers: quizAttempt.correctAnswers,
          totalQuestions: quizAttempt.totalQuestions,
          timeSpent: quizAttempt.timeSpent
        },
        context: {
          totalCorrectAnswers: updatedContext.correctAnswers,
          totalWrongAnswers: updatedContext.wrongAnswers,
          averageScore: updatedContext.averageScore,
          streakCount: updatedContext.streakCount,
          totalLearningTime: totalTime  // ✅ من Progress
        },
        message: scorePercentage >= 70
          ? '🎉 أحسنت! استمر في التقدم'
          : 'حاول مرة أخرى للحصول على نتيجة أفضل'
      }, 'Exercise tracked successfully')
    );
  })
);

/**
 * @route   POST /api/v1/quiz/comprehensive/start
 * @desc    بدء اختبار شامل على كل الدروس المكتملة
 * @access  Private
 */
router.post(
  '/comprehensive/start',
  authenticate,
  validateBody(z.object({
    maxQuestions: z.number().min(5).max(100).optional(),
    difficulty: z.enum(['EASY', 'MEDIUM', 'HARD', 'MIXED']).optional(),
    subjectId: z.string().optional()
  })),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    const { maxQuestions, difficulty, subjectId } = req.body;

    try {
      const quiz = await comprehensiveQuizService.createComprehensiveQuiz(
        userId,
        { maxQuestions, difficulty, subjectId }
      );

      res.json(successResponse(quiz, 'تم إنشاء الاختبار الشامل بنجاح'));

    } catch (error: any) {
      res.status(400).json(errorResponse(
        'QUIZ_CREATION_FAILED',
        error.message || 'فشل إنشاء الاختبار'
      ));
    }
  })
);

/**
 * @route   POST /api/v1/quiz/unit/:unitId/start
 * @desc    بدء اختبار على unit كامل
 * @access  Private
 */
router.post(
  '/unit/:unitId/start',
  authenticate,
  validateParams(z.object({ unitId: z.string().min(1) })),
  validateBody(z.object({
    maxQuestions: z.number().min(5).max(50).optional()
  })),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { unitId } = req.params;
    const userId = req.user!.userId;
    const { maxQuestions } = req.body;

    try {
      const quiz = await comprehensiveQuizService.createUnitQuiz(
        userId,
        unitId,
        maxQuestions || 15
      );

      res.json(successResponse(quiz, 'تم إنشاء اختبار الـ Unit بنجاح'));

    } catch (error: any) {
      res.status(400).json(errorResponse(
        'QUIZ_CREATION_FAILED',
        error.message || 'فشل إنشاء الاختبار'
      ));
    }
  })
);

/**
 * @route   POST /api/v1/quiz/subject/:subjectId/start
 * @desc    بدء اختبار على subject كامل
 * @access  Private
 */
router.post(
  '/subject/:subjectId/start',
  authenticate,
  validateParams(z.object({ subjectId: z.string().min(1) })),
  validateBody(z.object({
    maxQuestions: z.number().min(10).max(100).optional()
  })),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { subjectId } = req.params;
    const userId = req.user!.userId;
    const { maxQuestions } = req.body;

    try {
      const quiz = await comprehensiveQuizService.createSubjectQuiz(
        userId,
        subjectId,
        maxQuestions || 50
      );

      res.json(successResponse(quiz, 'تم إنشاء اختبار الـ Subject بنجاح'));

    } catch (error: any) {
      res.status(400).json(errorResponse(
        'QUIZ_CREATION_FAILED',
        error.message || 'فشل إنشاء الاختبار'
      ));
    }
  })
);

/**
 * @route   GET /api/v1/quiz/:attemptId/details
 * @desc    الحصول على تفاصيل اختبار شامل
 * @access  Private
 */
router.get(
  '/:attemptId/details',
  authenticate,
  validateParams(z.object({ attemptId: z.string().min(1) })),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { attemptId } = req.params;

    try {
      const details = await comprehensiveQuizService.getQuizDetails(attemptId);

      res.json(successResponse(details, 'تم جلب تفاصيل الاختبار بنجاح'));

    } catch (error: any) {
      res.status(404).json(errorResponse(
        'QUIZ_NOT_FOUND',
        error.message || 'الاختبار غير موجود'
      ));
    }
  })
);

export default router;