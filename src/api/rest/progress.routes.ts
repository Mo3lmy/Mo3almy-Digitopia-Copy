import { Router, Request, Response } from 'express';
import { prisma } from '../../config/database.config';
import { authenticate } from '../middleware/auth.middleware';
import { successResponse, errorResponse } from '../../utils/response.utils';
import asyncHandler from 'express-async-handler';

const router = Router();
const db = prisma as any;

// Get daily progress for a user (SIMPLIFIED VERSION)
router.get('/daily', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { userId, date } = req.query;

  if (!userId) {
    res.status(400).json(errorResponse('INVALID_PARAMS', 'userId is required'));
    return;
  }

  // Authorization check
  const userRole = req.user!.role as string;
  if (req.user!.userId !== userId &&
      userRole !== 'TEACHER' &&
      userRole !== 'ADMIN' &&
      userRole !== 'PARENT') {
    res.status(403).json(errorResponse('FORBIDDEN', 'Not authorized'));
    return;
  }

  try {
    // Parse date or use today
    const targetDate = date ? new Date(date as string) : new Date();
    targetDate.setHours(0, 0, 0, 0);

    const endDate = new Date(targetDate);
    endDate.setHours(23, 59, 59, 999);

    // ✅ 1. Count completed lessons today
    const completedToday = await prisma.progress.count({
      where: {
        userId: userId as string,
        status: 'COMPLETED',
        completedAt: {
          gte: targetDate,
          lte: endDate
        }
      }
    });

    // ✅ 2. Get user's daily target and streak
    const context = await prisma.studentContext.findUnique({
      where: { userId: userId as string }
    }) as any;

    const dailyTarget = context?.dailyTarget || 3; // Default 3 lessons
    const percentage = Math.min(100, Math.round((completedToday / dailyTarget) * 100));

    // ✅ 3. Calculate time spent today (from Progress.timeSpent)
    const todayProgress = await prisma.progress.findMany({
      where: {
        userId: userId as string,
        lastAccessedAt: {
          gte: targetDate,
          lte: endDate
        }
      },
      select: {
        timeSpent: true
      }
    });

    // timeSpent is in seconds, convert to minutes
    const timeSpentSeconds = todayProgress.reduce((sum: number, p: any) => sum + (p.timeSpent || 0), 0);
    const timeSpentMinutes = Math.round(timeSpentSeconds / 60);

    // ✅ 4. Simple response (no over-engineering)
    res.json(successResponse({
      completedToday,
      dailyTarget,
      percentage,
      streak: context?.streakCount || 0,
      timeSpentMinutes,
      lastActivityDate: context?.lastActiveDate,
      date: targetDate
    }, 'Daily progress retrieved'));

  } catch (error: any) {
    console.error('Error in /daily:', error);
    res.status(500).json(errorResponse('SERVER_ERROR', error.message || 'Failed to fetch daily progress'));
  }
}));

// Update daily target
router.put('/daily/target', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { userId, target } = req.body;

  if (!userId || !target) {
    res.status(400).json(
      errorResponse('INVALID_PARAMS', 'userId and target are required')
    );
    return;
  }

  // Check authorization
  const userRole = req.user!.role as string;
  if (req.user!.userId !== userId &&
      userRole !== 'TEACHER' &&
      userRole !== 'ADMIN' &&
      userRole !== 'PARENT') {
    res.status(403).json(
      errorResponse('FORBIDDEN', 'Not authorized to update this data')
    );
    return;
  }

  try {
    // Update or create student context with new daily target
    await db.studentContext.upsert({
      where: { userId },
      update: {
        dailyTarget: target,
        updatedAt: new Date()
      },
      create: {
        userId,
        dailyTarget: target,
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

    res.json(successResponse({
      dailyTarget: target,
      message: `تم تحديث الهدف اليومي إلى ${target} دروس`
    }, 'Daily target updated successfully'));
  } catch (error: any) {
    console.error('Error updating daily target:', error);
    res.status(500).json(
      errorResponse('SERVER_ERROR', 'Failed to update daily target')
    );
  }
}));

export default router;