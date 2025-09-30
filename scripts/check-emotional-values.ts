import { prisma } from '../src/config/database.config';

/**
 * Script to check current emotional values distribution
 * Helps identify which records need fixing
 */

interface ValueRange {
  range: string;
  count: number;
  percentage: number;
  userIds: string[];
}

async function analyzeEmotionalValues() {
  console.log('🔍 Analyzing emotional values in database...');
  console.log('=' . repeat(50));

  const contexts = await prisma.studentContext.findMany({
    select: {
      userId: true,
      averageConfidence: true,
      averageEngagement: true,
      averageScore: true,
      currentMood: true,
      createdAt: true,
      updatedAt: true
    }
  });

  console.log(`📊 Total records: ${contexts.length}\n`);

  // Analyze confidence values
  console.log('📈 CONFIDENCE VALUES ANALYSIS:');
  console.log('-'.repeat(40));
  analyzeField(contexts, 'averageConfidence');

  // Analyze engagement values
  console.log('\n📈 ENGAGEMENT VALUES ANALYSIS:');
  console.log('-'.repeat(40));
  analyzeField(contexts, 'averageEngagement');

  // Analyze score values
  console.log('\n📈 AVERAGE SCORE ANALYSIS:');
  console.log('-'.repeat(40));
  analyzeField(contexts, 'averageScore');

  // Analyze mood distribution
  console.log('\n😊 MOOD DISTRIBUTION:');
  console.log('-'.repeat(40));
  const moods: Record<string, number> = {};
  contexts.forEach(c => {
    const mood = c.currentMood || 'null';
    moods[mood] = (moods[mood] || 0) + 1;
  });

  Object.entries(moods).forEach(([mood, count]) => {
    const percentage = ((count / contexts.length) * 100).toFixed(1);
    console.log(`   ${mood}: ${count} (${percentage}%)`);
  });

  // Find problematic records
  console.log('\n⚠️  PROBLEMATIC RECORDS:');
  console.log('-'.repeat(40));

  const problems: string[] = [];
  contexts.forEach(context => {
    const issues: string[] = [];

    if (context.averageConfidence !== null) {
      if (context.averageConfidence > 0 && context.averageConfidence <= 1) {
        issues.push(`Confidence=${context.averageConfidence} (0-1 scale)`);
      } else if (context.averageConfidence < 0 || context.averageConfidence > 100) {
        issues.push(`Confidence=${context.averageConfidence} (out of range)`);
      }
    }

    if (context.averageEngagement !== null) {
      if (context.averageEngagement > 0 && context.averageEngagement <= 1) {
        issues.push(`Engagement=${context.averageEngagement} (0-1 scale)`);
      } else if (context.averageEngagement < 0 || context.averageEngagement > 100) {
        issues.push(`Engagement=${context.averageEngagement} (out of range)`);
      }
    }

    if (context.averageScore !== null) {
      if (context.averageScore > 0 && context.averageScore <= 1) {
        issues.push(`Score=${context.averageScore} (0-1 scale)`);
      } else if (context.averageScore < 0 || context.averageScore > 100) {
        issues.push(`Score=${context.averageScore} (out of range)`);
      }
    }

    if (issues.length > 0) {
      problems.push(`User ${context.userId}: ${issues.join(', ')}`);
    }
  });

  if (problems.length > 0) {
    console.log(`Found ${problems.length} records with issues:\n`);
    problems.slice(0, 10).forEach(p => console.log(`   ${p}`));
    if (problems.length > 10) {
      console.log(`   ... and ${problems.length - 10} more`);
    }
  } else {
    console.log('   ✅ No problematic records found!');
  }

  // Recommendations
  console.log('\n💡 RECOMMENDATIONS:');
  console.log('-'.repeat(40));

  const needsFix = contexts.filter(c => {
    const conf = c.averageConfidence;
    const eng = c.averageEngagement;
    const score = c.averageScore;

    return (
      (conf !== null && (conf > 0 && conf <= 1)) ||
      (eng !== null && (eng > 0 && eng <= 1)) ||
      (score !== null && (score > 0 && score <= 1)) ||
      (conf !== null && (conf < 0 || conf > 100)) ||
      (eng !== null && (eng < 0 || eng > 100)) ||
      (score !== null && (score < 0 || score > 100))
    );
  });

  if (needsFix.length > 0) {
    console.log(`   🔧 ${needsFix.length} records need fixing`);
    console.log(`   Run: npm run migrate:emotional-values`);
  } else {
    console.log(`   ✅ All records have valid values!`);
  }

  console.log('\n' + '=' . repeat(50));
}

function analyzeField(contexts: any[], fieldName: string) {
  const ranges: ValueRange[] = [
    { range: 'null', count: 0, percentage: 0, userIds: [] },
    { range: '0', count: 0, percentage: 0, userIds: [] },
    { range: '0-1 (needs fix)', count: 0, percentage: 0, userIds: [] },
    { range: '1-50', count: 0, percentage: 0, userIds: [] },
    { range: '50-70', count: 0, percentage: 0, userIds: [] },
    { range: '70-90', count: 0, percentage: 0, userIds: [] },
    { range: '90-100', count: 0, percentage: 0, userIds: [] },
    { range: '>100 (error)', count: 0, percentage: 0, userIds: [] },
    { range: '<0 (error)', count: 0, percentage: 0, userIds: [] }
  ];

  contexts.forEach(context => {
    const value = context[fieldName];
    const userId = context.userId;

    if (value === null || value === undefined) {
      ranges[0].count++;
      ranges[0].userIds.push(userId);
    } else if (value === 0) {
      ranges[1].count++;
      ranges[1].userIds.push(userId);
    } else if (value > 0 && value <= 1) {
      ranges[2].count++;
      ranges[2].userIds.push(userId);
    } else if (value > 1 && value <= 50) {
      ranges[3].count++;
      ranges[3].userIds.push(userId);
    } else if (value > 50 && value <= 70) {
      ranges[4].count++;
      ranges[4].userIds.push(userId);
    } else if (value > 70 && value <= 90) {
      ranges[5].count++;
      ranges[5].userIds.push(userId);
    } else if (value > 90 && value <= 100) {
      ranges[6].count++;
      ranges[6].userIds.push(userId);
    } else if (value > 100) {
      ranges[7].count++;
      ranges[7].userIds.push(userId);
    } else if (value < 0) {
      ranges[8].count++;
      ranges[8].userIds.push(userId);
    }
  });

  ranges.forEach(range => {
    range.percentage = (range.count / contexts.length) * 100;
    if (range.count > 0) {
      const examples = range.userIds.slice(0, 3).join(', ');
      const more = range.userIds.length > 3 ? ` (+${range.userIds.length - 3} more)` : '';
      console.log(`   ${range.range}: ${range.count} records (${range.percentage.toFixed(1)}%)`);
      if (range.range.includes('error') || range.range.includes('fix')) {
        console.log(`      Users: ${examples}${more}`);
      }
    }
  });
}

// Run the analysis
analyzeEmotionalValues()
  .then(() => prisma.$disconnect())
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Error:', error);
    prisma.$disconnect();
    process.exit(1);
  });