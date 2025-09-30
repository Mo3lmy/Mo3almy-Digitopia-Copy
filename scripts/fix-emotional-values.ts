import { prisma } from '../src/config/database.config';

/**
 * Migration script to fix emotional values in StudentContext
 * Converts values from 0-1 scale to 0-100 scale
 */

interface MigrationStats {
  total: number;
  fixed: number;
  skipped: number;
  errors: number;
}

async function fixEmotionalValues() {
  console.log('🔧 Starting emotional values migration...');
  console.log('=' . repeat(50));

  const stats: MigrationStats = {
    total: 0,
    fixed: 0,
    skipped: 0,
    errors: 0
  };

  try {
    // Get all student contexts
    const contexts = await prisma.studentContext.findMany();
    stats.total = contexts.length;

    console.log(`📊 Found ${contexts.length} student contexts to check\n`);

    for (const context of contexts) {
      let needsUpdate = false;
      const updates: any = {};
      const originalValues = {
        confidence: context.averageConfidence,
        engagement: context.averageEngagement
      };

      // Fix confidence values
      if (context.averageConfidence !== null) {
        if (context.averageConfidence > 100) {
          // Value is too high, probably an error
          updates.averageConfidence = 70; // Reset to default
          needsUpdate = true;
        } else if (context.averageConfidence > 0 && context.averageConfidence <= 1) {
          // Value is in 0-1 scale, convert to 0-100
          updates.averageConfidence = Math.round(context.averageConfidence * 100);
          needsUpdate = true;
        } else if (context.averageConfidence < 0) {
          // Negative value, reset to default
          updates.averageConfidence = 70;
          needsUpdate = true;
        }
      }

      // Fix engagement values
      if (context.averageEngagement !== null) {
        if (context.averageEngagement > 100) {
          // Value is too high, probably an error
          updates.averageEngagement = 80; // Reset to default
          needsUpdate = true;
        } else if (context.averageEngagement > 0 && context.averageEngagement <= 1) {
          // Value is in 0-1 scale, convert to 0-100
          updates.averageEngagement = Math.round(context.averageEngagement * 100);
          needsUpdate = true;
        } else if (context.averageEngagement < 0) {
          // Negative value, reset to default
          updates.averageEngagement = 80;
          needsUpdate = true;
        }
      }

      // Fix averageScore if needed
      if (context.averageScore !== null) {
        if (context.averageScore > 0 && context.averageScore <= 1) {
          // Convert from 0-1 to 0-100
          updates.averageScore = Math.round(context.averageScore * 100);
          needsUpdate = true;
        } else if (context.averageScore < 0 || context.averageScore > 100) {
          // Invalid value, calculate from correct/wrong answers
          const total = context.correctAnswers + context.wrongAnswers;
          updates.averageScore = total > 0
            ? Math.round((context.correctAnswers / total) * 100)
            : 0;
          needsUpdate = true;
        }
      }

      // Apply updates if needed
      if (needsUpdate) {
        try {
          await prisma.studentContext.update({
            where: { id: context.id },
            data: {
              ...updates,
              updatedAt: new Date()
            }
          });

          stats.fixed++;
          console.log(`✅ Fixed user ${context.userId}:`);

          if (updates.averageConfidence !== undefined) {
            console.log(`   Confidence: ${originalValues.confidence} → ${updates.averageConfidence}`);
          }
          if (updates.averageEngagement !== undefined) {
            console.log(`   Engagement: ${originalValues.engagement} → ${updates.averageEngagement}`);
          }
          if (updates.averageScore !== undefined) {
            console.log(`   Score: ${context.averageScore} → ${updates.averageScore}`);
          }
          console.log('');
        } catch (error) {
          console.error(`❌ Error updating user ${context.userId}:`, error);
          stats.errors++;
        }
      } else {
        stats.skipped++;
      }
    }

    // Print summary
    console.log('=' . repeat(50));
    console.log('📊 Migration Summary:');
    console.log(`   Total records: ${stats.total}`);
    console.log(`   Fixed: ${stats.fixed} ✅`);
    console.log(`   Skipped (already correct): ${stats.skipped}`);
    console.log(`   Errors: ${stats.errors}`);
    console.log('=' . repeat(50));

    if (stats.fixed > 0) {
      console.log('✨ Migration completed successfully!');
    } else {
      console.log('ℹ️  No records needed fixing - all values are already correct.');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Additional function to verify the data after migration
async function verifyData() {
  console.log('\n🔍 Verifying data integrity...\n');

  const contexts = await prisma.studentContext.findMany({
    select: {
      userId: true,
      averageConfidence: true,
      averageEngagement: true,
      averageScore: true
    }
  });

  let issues = 0;

  for (const context of contexts) {
    const problems: string[] = [];

    // Check confidence
    if (context.averageConfidence !== null) {
      if (context.averageConfidence < 0 || context.averageConfidence > 100) {
        problems.push(`Invalid confidence: ${context.averageConfidence}`);
      }
    }

    // Check engagement
    if (context.averageEngagement !== null) {
      if (context.averageEngagement < 0 || context.averageEngagement > 100) {
        problems.push(`Invalid engagement: ${context.averageEngagement}`);
      }
    }

    // Check score
    if (context.averageScore !== null) {
      if (context.averageScore < 0 || context.averageScore > 100) {
        problems.push(`Invalid score: ${context.averageScore}`);
      }
    }

    if (problems.length > 0) {
      console.log(`⚠️  User ${context.userId}: ${problems.join(', ')}`);
      issues++;
    }
  }

  if (issues === 0) {
    console.log('✅ All data is valid! No issues found.');
  } else {
    console.log(`\n⚠️  Found ${issues} records with potential issues.`);
  }
}

// Run the migration with verification
async function main() {
  try {
    // Run migration
    await fixEmotionalValues();

    // Verify results
    await verifyData();

    // Disconnect from database
    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Fatal error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

// Add command line argument support
const args = process.argv.slice(2);
const command = args[0];

if (command === '--verify-only') {
  // Just verify without migrating
  verifyData()
    .then(() => prisma.$disconnect())
    .then(() => process.exit(0))
    .catch(error => {
      console.error('❌ Error:', error);
      prisma.$disconnect();
      process.exit(1);
    });
} else if (command === '--help') {
  console.log(`
📚 Emotional Values Migration Script

Usage:
  npm run migrate:emotional-values     Run migration and verify
  npm run migrate:emotional-values -- --verify-only    Only verify data
  npm run migrate:emotional-values -- --help          Show this help

This script fixes emotional values that were incorrectly stored in 0-1 scale
and converts them to the correct 0-100 scale.
  `);
  process.exit(0);
} else {
  // Run full migration
  main();
}