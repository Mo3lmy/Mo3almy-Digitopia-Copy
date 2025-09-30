import { prisma } from '../../config/database.config';

export class ProgressCalculator {
  /**
   * حساب الدروس المكتملة - الطريقة الموحدة الوحيدة
   */
  static async getCompletedLessonsCount(userId: string): Promise<number> {
    return await prisma.progress.count({
      where: {
        userId,
        status: 'COMPLETED'  // ✅ طريقة واحدة فقط
      }
    });
  }

  /**
   * حساب الوقت الكلي من Progress
   */
  static async getTotalLearningTime(userId: string): Promise<number> {
    const records = await prisma.progress.findMany({
      where: { userId },
      select: { timeSpent: true }
    });

    // timeSpent بالثواني، نحول لدقائق
    const totalSeconds = records.reduce((sum: number, r: any) => sum + r.timeSpent, 0);
    return Math.round(totalSeconds / 60);
  }

  /**
   * حساب إحصائيات كاملة من Progress
   */
  static async calculateStats(userId: string) {
    const [completedLessons, totalTime, progressRecords] = await Promise.all([
      this.getCompletedLessonsCount(userId),
      this.getTotalLearningTime(userId),
      prisma.progress.findMany({ where: { userId } })
    ]);

    // ✅ طباعة للتشخيص
    console.log(`📊 Progress Stats for ${userId}:`, {
      completedLessons,
      totalLessons: progressRecords.length,
      inProgress: progressRecords.filter((p: any) => p.status === 'IN_PROGRESS').length
    });

    return {
      completedLessons,
      totalLearningTime: totalTime,
      inProgressLessons: progressRecords.filter((p: any) => p.status === 'IN_PROGRESS').length,
      totalLessons: progressRecords.length
    };
  }
}

export const progressCalculator = ProgressCalculator;