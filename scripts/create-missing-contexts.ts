import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createMissingContexts() {
  console.log('🔍 Finding users without StudentContext...\n');

  try {
    // Get all users
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        role: true,
        grade: true
      }
    });

    console.log(`Found ${users.length} total users\n`);

    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (const user of users) {
      try {
        // Check if context exists
        const exists = await prisma.studentContext.findUnique({
          where: { userId: user.id }
        });

        if (!exists) {
          console.log(`✨ Creating context for: ${user.email} (${user.firstName || 'No name'})`);

          await prisma.studentContext.create({
            data: {
              userId: user.id,
              learningStyle: 'visual',
              preferredDifficulty: 'medium',
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
              parentReportFrequency: 'weekly',
              strugglingTopics: JSON.stringify([]),
              masteredTopics: JSON.stringify([]),
              recentTopics: JSON.stringify([])
            }
          });

          created++;
        } else {
          console.log(`✓ Context already exists for: ${user.email}`);
          skipped++;
        }
      } catch (error) {
        console.error(`❌ Error creating context for ${user.email}:`, error);
        errors++;
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 SUMMARY:');
    console.log('='.repeat(50));
    console.log(`✅ Created: ${created} new contexts`);
    console.log(`⏭️  Skipped: ${skipped} existing contexts`);
    console.log(`❌ Errors: ${errors}`);
    console.log('='.repeat(50));

    // Verify all users now have contexts
    const usersWithoutContext = await prisma.user.findMany({
      where: {
        studentContext: null
      },
      select: {
        id: true,
        email: true
      }
    });

    if (usersWithoutContext.length === 0) {
      console.log('\n✨ SUCCESS: All users now have StudentContext records!');
    } else {
      console.log(`\n⚠️  WARNING: ${usersWithoutContext.length} users still without context:`);
      usersWithoutContext.forEach(u => {
        console.log(`  - ${u.email} (${u.id})`);
      });
    }

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Also create a function to reset contexts if needed
async function resetAllContexts(confirm: boolean = false) {
  if (!confirm) {
    console.log('⚠️  This will reset ALL student contexts to default values!');
    console.log('Run with resetAllContexts(true) to confirm.');
    return;
  }

  console.log('🔄 Resetting all student contexts...\n');

  const result = await prisma.studentContext.updateMany({
    data: {
      totalSessions: 0,
      totalLearningTime: 0,
      correctAnswers: 0,
      wrongAnswers: 0,
      averageScore: 0,
      streakCount: 0,
      currentMood: 'neutral',
      averageConfidence: 70,
      averageEngagement: 80,
      questionsAsked: 0,
      hintsRequested: 0,
      breaksRequested: 0,
      sessionsCompleted: 0,
      strugglingTopics: JSON.stringify([]),
      masteredTopics: JSON.stringify([]),
      recentTopics: JSON.stringify([])
    }
  });

  console.log(`✅ Reset ${result.count} contexts to default values`);
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args[0] === '--reset') {
    console.log('🚨 RESET MODE ACTIVATED');
    resetAllContexts(true)
      .catch(console.error)
      .finally(() => prisma.$disconnect());
  } else {
    createMissingContexts()
      .catch(console.error)
      .finally(() => prisma.$disconnect());
  }
}

export { createMissingContexts, resetAllContexts };