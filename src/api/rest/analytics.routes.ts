import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { successResponse, errorResponse } from '../../utils/response.utils';
import asyncHandler from 'express-async-handler';
import { prisma } from '../../config/database.config';

const router = Router();

// Get daily activity data
router.get('/daily-activity', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const { days = 7 } = req.query;

  // Calculate date range
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - Number(days));

  try {
    // Get activity data from student context
    const activities = await prisma.studentContext.findUnique({
      where: { userId },
      select: {
        totalLearningTime: true,
        updatedAt: true, // Use updatedAt instead of lastActiveDate
        streakCount: true,
        correctAnswers: true,
        wrongAnswers: true,
        questionsAsked: true
      }
    });

    // Get lesson progress
    const lessonProgress = await prisma.progress.findMany({
      where: {
        userId,
        updatedAt: {
          gte: startDate,
          lte: endDate
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    // Get quiz attempts
    const quizAttempts = await prisma.quizAttempt.findMany({
      where: {
        userId,
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Format daily data
    const dailyData = [];
    for (let i = 0; i < Number(days); i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const dayLessons = lessonProgress.filter((p: any) =>
        p.updatedAt.toISOString().split('T')[0] === dateStr
      );

      const dayQuizzes = quizAttempts.filter((q: any) =>
        q.createdAt.toISOString().split('T')[0] === dateStr
      );

      dailyData.push({
        date: dateStr,
        lessons: dayLessons.filter((l: any) => l.status === 'COMPLETED').length,
        quizzes: dayQuizzes.length,
        minutes: 0 // TODO: Calculate actual learning time per day
      });
    }

    res.json(successResponse(dailyData.reverse()));
  } catch (error: any) {
    console.error('Error fetching analytics:', error);
    res.status(500).json(
      errorResponse('ANALYTICS_ERROR', 'Failed to fetch analytics data')
    );
  }
}));

// Get performance analytics
router.get('/performance', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;

  const context = await prisma.studentContext.findUnique({
    where: { userId }
  });

  const achievements = await prisma.userAchievement.count({
    where: { userId }
  });

  const completedLessons = await prisma.progress.count({
    where: { userId, status: 'COMPLETED' }
  });

  const quizStats = await prisma.quizAttempt.aggregate({
    where: { userId },
    _avg: { score: true },
    _count: true
  });

  // Get user points from User model (now available in User table)
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { points: true }
  });

  res.json(successResponse({
    averageScore: context?.averageScore || 0,
    totalPoints: user?.points || 0, // Get points from User.points field
    currentLevel: context?.currentLevel || 1,
    achievementsUnlocked: achievements,
    completedLessons,
    quizzesTaken: quizStats._count,
    averageQuizScore: quizStats._avg.score || 0,
    strengths: context?.masteredTopics ? JSON.parse(context.masteredTopics) : [],
    weaknesses: context?.strugglingTopics ? JSON.parse(context.strugglingTopics) : []
  }));
}));

export default router;