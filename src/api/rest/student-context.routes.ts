import { Router, Request, Response } from 'express';
import { prisma } from '../../config/database.config';
import { AppError } from '../../utils/errors';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { successResponse, errorResponse } from '../../utils/response.utils';
import asyncHandler from 'express-async-handler';
import { progressCalculator } from '../../core/progress/progress-calculator.service';
import { fullValidateStudentContext, validateActivityMetadata } from '../../utils/validation.utils';

// Type assertion for Prisma client with all models
const db = prisma as any;

const router = Router();

// Get student context
// يحتاج Authentication للتأكد من أن المستخدم يصل لبياناته فقط
router.get('/:userId', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;

  // Authorization: التحقق من أن المستخدم يصل لبياناته فقط
  // أو أنه معلم/ولي أمر له صلاحية
  const userRole = req.user!.role as string;
  if (req.user!.userId !== userId &&
      userRole !== 'TEACHER' &&
      userRole !== 'ADMIN' &&
      userRole !== 'PARENT') {
    res.status(403).json(
      errorResponse('FORBIDDEN', 'غير مصرح لك بالوصول لهذه البيانات')
    );
    return;
  }

    let context = await db.studentContext.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            grade: true
          }
        }
      }
    });

    // Create default context if doesn't exist
    if (!context) {
      context = await db.studentContext.create({
        data: {
          userId,
          learningStyle: 'visual',
          preferredDifficulty: 'MEDIUM',
          currentLevel: 1,
          totalSessions: 0,
          totalLearningTime: 0,
          correctAnswers: 0,
          wrongAnswers: 0,
          averageScore: 0,
          streakCount: 0,
          longestStreak: 0,
          lastInteractionTime: new Date(),
          strugglingTopics: JSON.stringify([]),
          masteredTopics: JSON.stringify([]),
          recentTopics: JSON.stringify([]),
          currentMood: 'neutral',
          averageConfidence: 70,
          averageEngagement: 80,
          questionsAsked: 0,
          hintsRequested: 0,
          breaksRequested: 0,
          sessionsCompleted: 0,
          parentNotified: false,
          parentReportFrequency: 'weekly'
        },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              grade: true
            }
          }
        }
      });
      console.log('✅ Created new student context for user:', userId);
    }

    // Get user info if not included
    const user = context.user || await db.user.findUnique({
      where: { id: userId },
      select: {
        firstName: true,
        lastName: true,
        email: true,
        grade: true
      }
    });

    // ✅ حساب الإحصائيات من Progress (Source of Truth)
    const stats = await progressCalculator.calculateStats(userId);

    // جلب إحصائيات الكويزات من QuizAttempt
    const quizAttempts = await db.quizAttempt.findMany({
      where: { userId },
      select: {
        score: true,
        correctAnswers: true,
        totalQuestions: true
      }
    });

    const totalQuizzes = quizAttempts.length;
    const correctAnswers = quizAttempts.reduce((sum: number, q: any) => sum + (q.correctAnswers || 0), 0);
    const totalQuestions = quizAttempts.reduce((sum: number, q: any) => sum + (q.totalQuestions || 0), 0);
    const wrongAnswers = totalQuestions - correctAnswers;
    const avgScore = totalQuizzes > 0
      ? Math.round(quizAttempts.reduce((sum: number, q: any) => sum + (q.score || 0), 0) / totalQuizzes)
      : 0;

    const achievements = await db.userAchievement.count({
      where: { userId }
    });

    // Get topics lists (parse JSON if stored as string)
    const strugglingTopics = context.strugglingTopics ?
      (typeof context.strugglingTopics === 'string' ?
        JSON.parse(context.strugglingTopics) : context.strugglingTopics) : [];

    const masteredTopics = context.masteredTopics ?
      (typeof context.masteredTopics === 'string' ?
        JSON.parse(context.masteredTopics) : context.masteredTopics) : [];

    const recentTopics = context.recentTopics ?
      (typeof context.recentTopics === 'string' ?
        JSON.parse(context.recentTopics) : context.recentTopics) : [];

    const response = fullValidateStudentContext({
      ...context,
      firstName: user?.firstName || '',
      grade: user?.grade || 1,
      learningStyle: context.learningStyle || 'visual',
      strugglingTopics,
      masteredTopics,
      recentTopics,
      achievements: [],

      // ✅ من Progress مباشرة
      completedLessons: stats.completedLessons,
      totalLessons: stats.totalLessons,
      totalLearningTime: stats.totalLearningTime,  // بالدقائق من Progress

      // ✅ من QuizAttempt مباشرة
      correctAnswers,
      wrongAnswers,
      averageScore: avgScore,

      points: context.currentLevel * 100 + (correctAnswers * 10),
      averageEngagement: context.averageEngagement,  // ✅ Validation will handle normalization
      averageConfidence: context.averageConfidence,  // ✅ Validation will handle normalization
      stats: {
        totalQuizzes,
        completedLessons: stats.completedLessons,
        totalLessons: stats.totalLessons,
        inProgressLessons: stats.inProgressLessons,
        achievements,
        xp: context.currentLevel * 100 + (correctAnswers * 10),
        rank: await calculateRank(userId)
      }
    });

    res.json(
      successResponse(response, 'Student context retrieved successfully')
    );
}));

// Track student activity and update context
router.post('/:userId/activity', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { action, metadata } = req.body;

  // Get current context
  let context = await db.studentContext.findUnique({
    where: { userId }
  });

  if (!context) {
    // Create default context if doesn't exist
    context = await db.studentContext.create({
      data: {
        userId,
        learningStyle: 'visual',
        preferredDifficulty: 'MEDIUM',
        currentLevel: 1,
        totalSessions: 0,
        totalLearningTime: 0,
        correctAnswers: 0,
        wrongAnswers: 0,
        averageScore: 0,
        streakCount: 0,
        longestStreak: 0,
        currentMood: 'neutral',
        averageConfidence: 70,
        averageEngagement: 80,
        questionsAsked: 0,
        hintsRequested: 0,
        breaksRequested: 0,
        sessionsCompleted: 0,
        parentNotified: false,
        parentReportFrequency: 'weekly'
      }
    });
  }

  // Update context based on action
  const updates: any = {};

  switch (action) {
    case 'quiz_answer':
      // Validate metadata exists and has required fields
      if (!metadata || typeof metadata.isCorrect !== 'boolean') {
        res.status(400).json(
          errorResponse('INVALID_DATA', 'Missing or invalid metadata for quiz_answer action')
        );
        return;
      }

      if (metadata.isCorrect) {
        updates.correctAnswers = (context.correctAnswers || 0) + 1;
      } else {
        updates.wrongAnswers = (context.wrongAnswers || 0) + 1;
      }
      const totalAnswers = (updates.correctAnswers || context.correctAnswers) + (updates.wrongAnswers || context.wrongAnswers);
      if (totalAnswers > 0) {
        updates.averageScore = ((context.correctAnswers + (updates.correctAnswers || 0)) / totalAnswers) * 100;
      }
      break;

    case 'lesson_time':
      if (!metadata || typeof metadata.seconds !== 'number') {
        res.status(400).json(
          errorResponse('INVALID_DATA', 'Missing or invalid seconds for lesson_time action')
        );
        return;
      }
      const minutes = Math.round((metadata.seconds || 0) / 60);
      updates.totalLearningTime = (context.totalLearningTime || 0) + minutes;
      break;

    case 'help_request':
      updates.hintsRequested = (context.hintsRequested || 0) + 1;
      break;

    case 'emotional_indicator':
      if (!metadata || !metadata.indicator) {
        res.status(400).json(
          errorResponse('INVALID_DATA', 'Missing indicator for emotional_indicator action')
        );
        return;
      }

      // ✅ Use validated metadata values from frontend if provided
      const validatedMetadata = validateActivityMetadata(metadata);

      if (validatedMetadata.confidence !== undefined) {
        updates.averageConfidence = validatedMetadata.confidence;
      }
      if (validatedMetadata.engagement !== undefined) {
        updates.averageEngagement = validatedMetadata.engagement;
      }

      updates.currentMood = metadata.indicator;
      updates.lastMoodUpdate = new Date();
      break;

    case 'topic_interaction':
      if (!metadata || !metadata.topic || typeof metadata.success !== 'boolean') {
        res.status(400).json(
          errorResponse('INVALID_DATA', 'Missing topic or success for topic_interaction action')
        );
        return;
      }

      const strugglingTopics = context.strugglingTopics ?
        (typeof context.strugglingTopics === 'string' ? JSON.parse(context.strugglingTopics) : context.strugglingTopics) : [];
      const masteredTopics = context.masteredTopics ?
        (typeof context.masteredTopics === 'string' ? JSON.parse(context.masteredTopics) : context.masteredTopics) : [];

      if (metadata.success) {
        // Remove from struggling, add to mastered
        const newStruggling = strugglingTopics.filter((t: string) => t !== metadata.topic);
        if (!masteredTopics.includes(metadata.topic)) {
          masteredTopics.push(metadata.topic);
        }
        updates.strugglingTopics = JSON.stringify(newStruggling);
        updates.masteredTopics = JSON.stringify(masteredTopics);
      } else {
        // Add to struggling, remove from mastered
        if (!strugglingTopics.includes(metadata.topic)) {
          strugglingTopics.push(metadata.topic);
        }
        const newMastered = masteredTopics.filter((t: string) => t !== metadata.topic);
        updates.strugglingTopics = JSON.stringify(strugglingTopics);
        updates.masteredTopics = JSON.stringify(newMastered);
      }
      break;

    case 'question_asked':
      updates.questionsAsked = (context.questionsAsked || 0) + 1;
      break;

    case 'break_taken':
      updates.breaksRequested = (context.breaksRequested || 0) + 1;
      break;

    case 'session_start':
      updates.totalSessions = (context.totalSessions || 0) + 1;
      updates.lastActiveDate = new Date();
      // Check and update streak
      const lastActive = context.lastActiveDate ? new Date(context.lastActiveDate) : null;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (lastActive) {
        lastActive.setHours(0, 0, 0, 0);
        const daysDiff = Math.floor((today.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff === 1) {
          updates.streakCount = (context.streakCount || 0) + 1;
          if (updates.streakCount > (context.longestStreak || 0)) {
            updates.longestStreak = updates.streakCount;
          }
        } else if (daysDiff > 1) {
          updates.streakCount = 1;
        }
      } else {
        updates.streakCount = 1;
      }
      break;

    case 'lesson_completed':
      // Ensure Progress record exists for tracking completed lessons
      if (metadata?.lessonId) {
        await db.progress.upsert({
          where: {
            userId_lessonId: {
              userId,
              lessonId: metadata.lessonId
            }
          },
          update: {
            completedAt: new Date(),
            status: 'COMPLETED',
            completionRate: 100,
            lastAccessedAt: new Date()
          },
          create: {
            userId,
            lessonId: metadata.lessonId,
            status: 'COMPLETED',
            completedAt: new Date(),
            completionRate: 100,
            lastAccessedAt: new Date()
          }
        });
      }
      updates.sessionsCompleted = (context.sessionsCompleted || 0) + 1;
      break;
  }

  // Update context with new values
  const updatedContext = await db.studentContext.update({
    where: { userId },
    data: {
      ...updates,
      updatedAt: new Date()
    }
  });

  // ✅ Validate before sending to frontend
  const validatedContext = fullValidateStudentContext(updatedContext);
  res.json(successResponse(validatedContext, 'Activity tracked successfully'));
}));

// Update student context
router.put('/:userId', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;

  // 🔍 DEBUG: اطبع كل حاجة
  console.log('===============================================');
  console.log('📥 PUT /student-context/:userId');
  console.log('User ID:', userId);
  console.log('Request Body:', JSON.stringify(req.body, null, 2));
  console.log('===============================================');

  try {
    // Authorization check
    if (req.user!.userId !== userId &&
        req.user!.role !== 'TEACHER' &&
        req.user!.role !== 'ADMIN') {
      res.status(403).json(
        errorResponse('FORBIDDEN', 'غير مصرح لك بتعديل هذه البيانات')
      );
      return;
    }

    const { action, ...updates } = req.body;

    // Remove fields that shouldn't be updated directly
    delete updates.userId;
    delete updates.createdAt;
    delete updates.updatedAt;
    delete updates.metadata;  // ✅ Remove metadata field sent from frontend

    console.log('🔧 Updates after cleanup:', JSON.stringify(updates, null, 2));

    // Safely stringify JSON fields if they're arrays
    if (Array.isArray(updates.strugglingTopics)) {
      updates.strugglingTopics = JSON.stringify(updates.strugglingTopics);
    }
    if (Array.isArray(updates.masteredTopics)) {
      updates.masteredTopics = JSON.stringify(updates.masteredTopics);
    }
    if (Array.isArray(updates.recentTopics)) {
      updates.recentTopics = JSON.stringify(updates.recentTopics);
    }
    if (Array.isArray(updates.achievements)) {
      updates.achievements = JSON.stringify(updates.achievements);
    }

    console.log('📦 Final updates to send to Prisma:', JSON.stringify(updates, null, 2));

    // Ensure the context exists before updating
    const existingContext = await db.studentContext.findUnique({
      where: { userId }
    });

    if (!existingContext) {
      console.log('⚠️ Context not found, creating new one');
      // Create if doesn't exist
      const newContext = await db.studentContext.create({
        data: {
          userId,
          ...updates,
          updatedAt: new Date()
        }
      });
      console.log('✅ Context created successfully');
      res.json(successResponse(newContext, 'Student context created successfully'));
      return;
    }

    console.log('📝 Updating existing context...');

    // Update existing context
    const updatedContext = await db.studentContext.update({
      where: { userId },
      data: {
        ...updates,
        updatedAt: new Date()
      }
    });

    console.log('✅ Context updated successfully');
    console.log('===============================================\n');

    res.json(
      successResponse(updatedContext, 'Student context updated successfully')
    );
  } catch (error: any) {
    console.error('❌❌❌ ERROR DETAILS ❌❌❌');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    console.error('Full error:', error);
    console.error('Error stack:', error.stack);
    console.error('===============================================\n');

    res.status(400).json(
      errorResponse('UPDATE_FAILED', error.message || 'Update failed')
    );
  }
}));

// Get emotional state history
router.get('/:userId/emotional-state', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;

  // Authorization check
  const userRole = req.user!.role as string;
  if (req.user!.userId !== userId &&
      userRole !== 'TEACHER' &&
      userRole !== 'ADMIN' &&
      userRole !== 'PARENT') {
    res.status(403).json(
      errorResponse('FORBIDDEN', 'غير مصرح لك بالوصول لهذه البيانات')
    );
    return;
  }
    const { limit = 10 } = req.query;

    const states = await db.emotionalState.findMany({
      where: { userId },
      orderBy: { detectedAt: 'desc' },
      take: Number(limit)
    });

    // Get current context mood
    const context = await db.studentContext.findUnique({
      where: { userId },
      select: {
        currentMood: true,
        averageConfidence: true,
        averageEngagement: true,
        lastMoodUpdate: true
      }
    });

    res.json(
      successResponse({
        current: {
          mood: context?.currentMood || 'neutral',
          confidence: context?.averageConfidence || 70,
          engagement: context?.averageEngagement || 80,
          lastUpdate: context?.lastMoodUpdate
        },
        history: states
      }, 'Emotional state retrieved successfully')
    );
}));

// Update emotional state
router.post('/:userId/emotional-state', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;

  // Authorization check
  if (req.user!.userId !== userId &&
      req.user!.role !== 'TEACHER' &&
      req.user!.role !== 'ADMIN') {
    res.status(403).json(
      errorResponse('FORBIDDEN', 'غير مصرح لك بتعديل هذه البيانات')
    );
    return;
  }

  try {
    const { mood, confidence, engagement, stress, indicators, triggers, lessonId } = req.body;

    // Create new emotional state record
    const state = await db.emotionalState.create({
      data: {
        userId,
        lessonId,
        mood,
        confidence,
        engagement,
        stress: stress || 0,
        indicators: indicators ? JSON.stringify(indicators) : null,
        triggers: triggers ? JSON.stringify(triggers) : null
      }
    });

    // Update student context with latest mood
    await db.studentContext.update({
      where: { userId },
      data: {
        currentMood: mood,
        lastMoodUpdate: new Date(),
        // Update running averages
        averageConfidence: await calculateAverage(userId, 'confidence'),
        averageEngagement: await calculateAverage(userId, 'engagement')
      }
    });

    // Generate system response based on emotional state
    const response = await generateEmotionalResponse(mood, confidence, engagement);

    res.json({
      success: true,
      data: {
        state,
        response
      }
    });
  } catch (error) {
    console.error('Error updating emotional state:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to update emotional state'
      }
    });
  }
}));

// Get student progress
router.get('/:userId/progress', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;

  try {
    // Get progress data
    const progress = await db.progress.findMany({
      where: { userId },
      include: {
        lesson: {
          select: {
            id: true,
            title: true,
            titleAr: true
          }
        }
      },
      orderBy: { lastAccessedAt: 'desc' }
    });

    // Calculate overall stats
    const totalLessons = progress.length;
    const completedLessons = progress.filter((p: any) => p.status === 'COMPLETED').length;
    const totalTimeSpent = progress.reduce((sum: number, p: any) => sum + (p.timeSpent || 0), 0);
    const averageCompletion = progress.length > 0
      ? progress.reduce((sum: number, p: any) => sum + (p.completionRate || 0), 0) / progress.length
      : 0;

    res.json({
      success: true,
      data: {
        totalLessons,
        completedLessons,
        inProgressLessons: totalLessons - completedLessons,
        totalTimeSpent,
        averageCompletion: Math.round(averageCompletion),
        lessons: progress
      }
    });
  } catch (error) {
    console.error('Error getting progress:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to get progress data'
      }
    });
  }
}));

// Get learning patterns
router.get('/:userId/learning-patterns', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    // Get quiz performance patterns
    const quizPatterns = await db.quizAttempt.findMany({
      where: { userId },
      select: {
        lessonId: true,
        score: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    // Get progress patterns
    const progressPatterns = await db.progress.findMany({
      where: { userId },
      select: {
        lessonId: true,
        completionRate: true,
        timeSpent: true,
        completedAt: true,
        lastAccessedAt: true
      }
    });

    // Get session patterns
    const sessions = await db.learningSession.findMany({
      where: { userId },
      select: {
        lessonId: true,
        interactionCount: true,
        questionsAsked: true,
        hintsRequested: true,
        breaksTaken: true,
        startedAt: true,
        completedAt: true
      },
      orderBy: { startedAt: 'desc' },
      take: 20
    });

    // Analyze patterns
    const analysis = analyzePatterns(quizPatterns, progressPatterns, sessions);

    res.json({
      success: true,
      data: {
        patterns: analysis,
        rawData: {
          quizzes: quizPatterns,
          progress: progressPatterns,
          sessions
        }
      }
    });
  } catch (error) {
    console.error('Error getting learning patterns:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to get learning patterns'
      }
    });
  }
});

// Get personalized recommendations
router.get('/:userId/recommendations', authenticate, asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params;

    // Get student context - إنشاء context إذا لم يكن موجود
    let context = await db.studentContext.findUnique({
      where: { userId }
    });

    if (!context) {
      // إنشاء context افتراضي إذا لم يكن موجود
      context = await db.studentContext.create({
        data: {
          userId,
          learningStyle: 'visual',
          preferredDifficulty: 'MEDIUM',
          currentLevel: 1,
          totalSessions: 0,
          totalLearningTime: 0,
          correctAnswers: 0,
          wrongAnswers: 0,
          averageScore: 0,
          streakCount: 0,
          longestStreak: 0,
          currentMood: 'neutral',
          averageConfidence: 70,
          averageEngagement: 80,
          questionsAsked: 0,
          hintsRequested: 0,
          breaksRequested: 0,
          sessionsCompleted: 0,
          parentNotified: false,
          parentReportFrequency: 'weekly'
        }
      });
    }

    // Check if this is a new user
    const isNewUser = context.totalSessions === 0 || context.totalLearningTime === 0;

    if (isNewUser) {
      // Return basic recommendations for new users
      res.json({
        success: true,
        data: {
          suggestions: [
            { type: 'welcome', message: 'مرحباً بك! ابدأ رحلتك التعليمية بدرس بسيط' },
            { type: 'tip', message: 'خصص 30 دقيقة يومياً للدراسة للحصول على أفضل النتائج' },
            { type: 'guide', message: 'اطلب المساعدة عند الحاجة - نحن هنا لدعمك!' }
          ],
          nextLessons: [],
          practiceAreas: [],
          tips: [
            'ابدأ بالأساسيات وتقدم تدريجياً',
            'اطلب المساعدة عند الحاجة',
            'احتفل بكل إنجاز صغير',
            'الممارسة المنتظمة تؤدي للإتقان'
          ],
          estimatedTime: 30,
          recommendations: [
            {
              id: '1',
              title: 'ابدأ بدرس تجريبي',
              description: 'جرب درساً قصيراً للتعرف على النظام',
              type: 'suggestion',
              priority: 10,
              actionable: true
            },
            {
              id: '2',
              title: 'حدد أهدافك',
              description: 'ضع أهدافاً يومية صغيرة وقابلة للتحقيق',
              type: 'suggestion',
              priority: 8,
              actionable: true
            }
          ]
        }
      });
      return;
    }

    // Get struggling topics for existing users
    const strugglingTopics = context.strugglingTopics ?
      (typeof context.strugglingTopics === 'string' ?
        JSON.parse(context.strugglingTopics) : context.strugglingTopics) : [];

    // Get next lessons recommendations
    // Ensure difficulty is uppercase to match Prisma enum
    const difficulty = (context.preferredDifficulty || 'MEDIUM').toUpperCase() as 'EASY' | 'MEDIUM' | 'HARD';
    const nextLessons = await db.lesson.findMany({
      where: {
        difficulty
      },
      take: 5
    });

    // Get practice recommendations based on weak areas
    const practiceRecommendations = await generatePracticeRecommendations(
      userId,
      strugglingTopics
    );

    // Generate dynamic suggestions based on context
    const suggestions = [];

    if (context.averageConfidence < 60) {
      suggestions.push({
        type: 'help',
        message: 'جرب أمثلة إضافية لفهم أفضل'
      });
    }

    if (context.streakCount > 3) {
      suggestions.push({
        type: 'motivation',
        message: `رائع! ${context.streakCount} أيام متتالية من التعلم!`
      });
    }

    if (context.totalLearningTime > 60 && context.breaksRequested < 2) {
      suggestions.push({
        type: 'break',
        message: 'خذ استراحة قصيرة لتحسين التركيز'
      });
    }

    // Default suggestion if none generated
    if (suggestions.length === 0) {
      suggestions.push({
        type: 'motivation',
        message: 'أنت تتقدم بشكل رائع!'
      });
    }

    res.json({
      success: true,
      data: {
        suggestions,
        nextLessons,
        practiceAreas: practiceRecommendations,
        tips: generateLearningTips(context),
        estimatedTime: calculateEstimatedTime(nextLessons),
        recommendations: await generatePersonalizedRecommendations(context, strugglingTopics)
      }
    });
}));

// Helper functions
async function calculateRank(userId: string): Promise<number> {
  // Simple ranking based on XP
  const users = await db.studentContext.findMany({
    select: {
      userId: true,
      currentLevel: true,
      correctAnswers: true
    },
    orderBy: [
      { currentLevel: 'desc' },
      { correctAnswers: 'desc' }
    ]
  });

  const index = users.findIndex((u: any) => u.userId === userId);
  return index + 1;
}

async function calculateAverage(userId: string, field: 'confidence' | 'engagement'): Promise<number> {
  const states = await db.emotionalState.findMany({
    where: { userId },
    select: { [field]: true },
    orderBy: { detectedAt: 'desc' },
    take: 10
  });

  if (states.length === 0) return field === 'confidence' ? 70 : 80;

  const sum = states.reduce((acc: number, state: any) => acc + state[field], 0);
  return Math.round(sum / states.length);
}

async function generateEmotionalResponse(mood: string, confidence: number, engagement: number) {
  const responses: Record<string, any> = {
    happy: {
      message: "رائع! يبدو أنك في مزاج جيد للتعلم",
      suggestions: ["استمر في العمل الجيد", "جرب تحديًا جديدًا"],
      action: "continue"
    },
    confused: {
      message: "لا تقلق، دعني أساعدك في فهم هذا بشكل أفضل",
      suggestions: ["اطلب شرحًا إضافيًا", "جرب مثالًا أبسط"],
      action: "simplify"
    },
    frustrated: {
      message: "أعلم أن هذا صعب، دعنا نأخذ خطوة للخلف",
      suggestions: ["خذ استراحة قصيرة", "جرب طريقة مختلفة"],
      action: "break_suggested"
    },
    bored: {
      message: "هل نحتاج إلى تحدٍ أكبر؟",
      suggestions: ["جرب مستوى أصعب", "انتقل إلى موضوع جديد"],
      action: "increase_difficulty"
    },
    neutral: {
      message: "دعنا نجعل التعلم أكثر متعة!",
      suggestions: ["ابدأ بنشاط تفاعلي", "اختر موضوعًا مثيرًا"],
      action: "engage"
    }
  };

  return responses[mood] || responses.neutral;
}

function analyzePatterns(quizzes: any[], progress: any[], sessions: any[]) {
  return {
    strongSubjects: [],
    weakSubjects: [],
    bestTimeToLearn: "afternoon",
    averageSessionLength: 30,
    learningStyle: "visual",
    focusTrend: "improving"
  };
}

async function getRelevantSubjects(userId: string): Promise<string[]> {
  const progress = await db.progress.findMany({
    where: { userId },
    select: { lessonId: true }
  });

  return progress.map((p: any) => p.lessonId).filter(Boolean);
}

async function generatePracticeRecommendations(userId: string, strugglingTopics: string[]) {
  return strugglingTopics.map(topic => ({
    topic,
    exercises: 5,
    estimatedTime: 15,
    difficulty: 'easy'
  }));
}

function generateLearningTips(context: any) {
  const tips = [];

  if (context.averageConfidence < 50) {
    tips.push("ابدأ بالمفاهيم الأساسية واعمل على بناء ثقتك");
  }

  if (context.streakCount > 5) {
    tips.push("أحسنت! حافظ على استمراريتك");
  }

  if (context.breaksRequested > 3) {
    tips.push("خذ فترات راحة منتظمة للحفاظ على التركيز");
  }

  return tips;
}

function calculateEstimatedTime(lessons: any[]): number {
  return lessons.reduce((total, lesson) => total + (lesson.estimatedDuration || 30), 0);
}

async function generatePersonalizedRecommendations(context: any, strugglingTopics: string[]) {
  const recommendations = [];

  // Add recommendations based on struggling topics
  if (strugglingTopics.length > 0) {
    recommendations.push({
      id: `rec-${Date.now()}-1`,
      title: `مراجعة ${strugglingTopics[0]}`,
      description: 'يحتاج هذا الموضوع إلى مزيد من التدريب',
      type: 'improvement',
      priority: 9,
      actionable: true
    });
  }

  // Add streak-based recommendations
  if (context.streakCount === 0) {
    recommendations.push({
      id: `rec-${Date.now()}-2`,
      title: 'ابدأ سلسلة يومية',
      description: 'ادرس كل يوم لبناء عادة التعلم',
      type: 'suggestion',
      priority: 7,
      actionable: false
    });
  }

  // Add performance-based recommendations
  if (context.averageScore < 70 && context.totalQuizzes > 0) {
    recommendations.push({
      id: `rec-${Date.now()}-3`,
      title: 'ركز على الأساسيات',
      description: 'راجع المفاهيم الأساسية قبل المتابعة',
      type: 'improvement',
      priority: 8,
      actionable: true
    });
  }

  if (context.averageScore > 85) {
    recommendations.push({
      id: `rec-${Date.now()}-4`,
      title: 'جرب مستوى أصعب',
      description: 'أنت جاهز للتحديات الأكثر تقدماً',
      type: 'strength',
      priority: 6,
      actionable: true
    });
  }

  return recommendations;
}

/**
 * @route   POST /api/v1/student-context/:userId/sync
 * @desc    إعادة حساب جميع الإحصائيات من Progress
 * @access  Private
 */
router.post('/:userId/sync', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;

  // التحقق من الصلاحية
  if (req.user!.userId !== userId && req.user!.role !== 'ADMIN') {
    res.status(403).json(errorResponse('FORBIDDEN', 'غير مصرح'));
    return;
  }

  // 1. حساب من Progress
  const stats = await progressCalculator.calculateStats(userId);

  // 2. حساب من QuizAttempt
  const quizAttempts = await prisma.quizAttempt.findMany({
    where: { userId }
  });

  const totalCorrect = quizAttempts.reduce((sum: number, q: any) => sum + q.correctAnswers, 0);
  const totalWrong = quizAttempts.reduce((sum: number, q: any) => sum + (q.totalQuestions - q.correctAnswers), 0);
  const avgScore = quizAttempts.length > 0
    ? quizAttempts.reduce((sum: number, q: any) => sum + (q.score || 0), 0) / quizAttempts.length
    : 0;

  // 3. تحديث StudentContext
  const updated = await prisma.studentContext.update({
    where: { userId },
    data: {
      sessionsCompleted: stats.completedLessons,
      totalLearningTime: stats.totalLearningTime,
      correctAnswers: totalCorrect,
      wrongAnswers: totalWrong,
      averageScore: Math.round(avgScore)
    }
  });

  res.json(successResponse(updated, 'تمت المزامنة بنجاح'));
}));

export default router;