import { prisma } from '../src/config/database.config';
import { progressCalculator } from '../src/core/progress/progress-calculator.service';

async function verifyProgress(userId: string) {
  console.log('🔍 Verifying progress for user:', userId);
  console.log('=' .repeat(50));

  try {
    // 1. من Progress مباشرة
    const stats = await progressCalculator.calculateStats(userId);
    console.log('\n📊 From Progress table:');
    console.log('  - Completed Lessons:', stats.completedLessons);
    console.log('  - Total Learning Time (minutes):', stats.totalLearningTime);
    console.log('  - In Progress Lessons:', stats.inProgressLessons);
    console.log('  - Total Lessons:', stats.totalLessons);

    // 2. من StudentContext
    const context = await prisma.studentContext.findUnique({
      where: { userId },
      select: {
        sessionsCompleted: true,
        totalLearningTime: true,
        correctAnswers: true,
        wrongAnswers: true,
        averageScore: true
      }
    });

    if (!context) {
      console.log('\n⚠️ No StudentContext found for user');
      return;
    }

    console.log('\n💾 From StudentContext:');
    console.log('  - Sessions Completed:', context.sessionsCompleted);
    console.log('  - Total Learning Time:', context.totalLearningTime);
    console.log('  - Correct Answers:', context.correctAnswers);
    console.log('  - Wrong Answers:', context.wrongAnswers);
    console.log('  - Average Score:', context.averageScore);

    // 3. من QuizAttempt
    const quizAttempts = await prisma.quizAttempt.findMany({
      where: { userId }
    });

    const totalCorrect = quizAttempts.reduce((sum, q) => sum + q.correctAnswers, 0);
    const totalWrong = quizAttempts.reduce((sum, q) => sum + (q.totalQuestions - q.correctAnswers), 0);
    const avgScore = quizAttempts.length > 0
      ? Math.round(quizAttempts.reduce((sum, q) => sum + (q.score || 0), 0) / quizAttempts.length)
      : 0;

    console.log('\n🎯 From QuizAttempt table:');
    console.log('  - Total Correct:', totalCorrect);
    console.log('  - Total Wrong:', totalWrong);
    console.log('  - Average Score:', avgScore);
    console.log('  - Total Attempts:', quizAttempts.length);

    // 4. المقارنة
    console.log('\n' + '=' .repeat(50));
    console.log('📋 VERIFICATION RESULTS:');
    console.log('=' .repeat(50));

    const lessonsMatch = context.sessionsCompleted === stats.completedLessons;
    const timeMatch = context.totalLearningTime === stats.totalLearningTime;
    const correctMatch = context.correctAnswers === totalCorrect;
    const wrongMatch = context.wrongAnswers === totalWrong;
    const scoreMatch = context.averageScore === avgScore;

    console.log('\nLessons Completed:', lessonsMatch ? '✅ Match' : '❌ Mismatch');
    if (!lessonsMatch) {
      console.log(`  Expected: ${stats.completedLessons}, Found: ${context.sessionsCompleted}`);
    }

    console.log('Learning Time:', timeMatch ? '✅ Match' : '❌ Mismatch');
    if (!timeMatch) {
      console.log(`  Expected: ${stats.totalLearningTime}, Found: ${context.totalLearningTime}`);
    }

    console.log('Correct Answers:', correctMatch ? '✅ Match' : '❌ Mismatch');
    if (!correctMatch) {
      console.log(`  Expected: ${totalCorrect}, Found: ${context.correctAnswers}`);
    }

    console.log('Wrong Answers:', wrongMatch ? '✅ Match' : '❌ Mismatch');
    if (!wrongMatch) {
      console.log(`  Expected: ${totalWrong}, Found: ${context.wrongAnswers}`);
    }

    console.log('Average Score:', scoreMatch ? '✅ Match' : '❌ Mismatch');
    if (!scoreMatch) {
      console.log(`  Expected: ${avgScore}, Found: ${context.averageScore}`);
    }

    const allMatch = lessonsMatch && timeMatch && correctMatch && wrongMatch && scoreMatch;

    console.log('\n' + '=' .repeat(50));
    if (allMatch) {
      console.log('✅ ALL DATA MATCHES! The system is working correctly.');
    } else {
      console.log('❌ DATA MISMATCH DETECTED!');
      console.log('💡 Run sync endpoint to fix: POST /api/v1/student-context/' + userId + '/sync');
    }
    console.log('=' .repeat(50));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run
const userId = process.argv[2];
if (!userId) {
  console.error('❌ Usage: npx tsx scripts/verify-progress.ts <userId>');
  console.error('Example: npx tsx scripts/verify-progress.ts 123e4567-e89b-12d3-a456-426614174000');
  process.exit(1);
}

verifyProgress(userId).then(() => process.exit(0)).catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});