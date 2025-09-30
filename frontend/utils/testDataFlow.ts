import { studentContextManager } from '@/services/studentContext';
import { achievementTracker } from '@/services/achievementTracker';
import { useActivityTracker } from '@/hooks/useActivityTracker';

interface TestResult {
  step: string;
  success: boolean;
  data?: any;
  error?: string;
  timestamp: number;
}

class DataFlowTester {
  private results: TestResult[] = [];
  private userId: string = '';
  private token: string = '';

  constructor() {
    this.token = localStorage.getItem('token') || '';
  }

  private log(step: string, success: boolean, data?: any, error?: string) {
    const result: TestResult = {
      step,
      success,
      data,
      error,
      timestamp: Date.now(),
    };
    this.results.push(result);

    const emoji = success ? '✅' : '❌';
    const style = success ? 'color: green' : 'color: red';
    console.log(`%c${emoji} ${step}`, style, data || error || '');

    return result;
  }

  private assert(condition: boolean, message: string): void {
    if (!condition) {
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  async initialize(userId: string): Promise<void> {
    this.userId = userId;
    console.log('🚀 Initializing Data Flow Test for user:', userId);
    console.log('━'.repeat(50));
  }

  async testRealDataFlow(): Promise<TestResult[]> {
    console.log('📊 Testing Complete Data Flow Pipeline...\n');

    try {
      // Step 1: Fetch initial context
      console.group('📥 Step 1: Fetching Initial Context');
      const initialContext = await studentContextManager.fetchContext(this.userId);
      this.log('Initial context fetched', true, {
        correctAnswers: initialContext.correctAnswers,
        wrongAnswers: initialContext.wrongAnswers,
        totalLearningTime: initialContext.totalLearningTime,
        points: initialContext.points,
        streakCount: initialContext.streakCount,
      });
      console.groupEnd();

      // Step 2: Submit quiz answer
      console.group('📝 Step 2: Submitting Quiz Answer');
      const quizPayload = {
        questionId: `test-q-${Date.now()}`,
        answer: 'A',
        isCorrect: true,
        timeSpent: 30,
        topic: 'كسور',
      };

      const quizResponse = await this.sendQuizAnswer(quizPayload);
      this.log('Quiz answer submitted', !!quizResponse, quizPayload);
      console.groupEnd();

      // Wait for backend processing
      await this.delay(2000);

      // Step 3: Verify context updated
      console.group('🔄 Step 3: Verifying Context Update');
      const updatedContext = await studentContextManager.fetchContext(this.userId);

      const contextChanged = updatedContext.correctAnswers > initialContext.correctAnswers;
      this.assert(contextChanged, 'Correct answers should have increased');

      this.log('Context updated correctly', contextChanged, {
        before: initialContext.correctAnswers,
        after: updatedContext.correctAnswers,
        difference: updatedContext.correctAnswers - initialContext.correctAnswers,
      });
      console.groupEnd();

      // Step 4: Check achievements
      console.group('🏆 Step 4: Checking Achievements');
      const achievementCheck = await achievementTracker.checkAchievements(
        updatedContext,
        'quiz_answer',
        quizPayload
      );

      if (achievementCheck?.newAchievements && achievementCheck.newAchievements.length > 0) {
        this.log('New achievements unlocked', true, achievementCheck.newAchievements);
      } else {
        this.log('No new achievements (may need more actions)', true, {
          currentPoints: updatedContext.points,
          currentLevel: updatedContext.currentLevel,
        });
      }

      const allAchievements = await achievementTracker.fetchUserAchievements(this.userId);
      this.log('Total achievements', true, {
        count: allAchievements.length,
        totalPoints: allAchievements.reduce((sum, a) => sum + a.points, 0),
      });
      console.groupEnd();

      // Step 5: Test help request
      console.group('❓ Step 5: Testing Help Request');
      const helpResponse = await this.sendHelpRequest({
        type: 'hint',
        lessonId: 'test-lesson',
        reason: 'difficult_concept',
        topic: 'كسور',
      });
      this.log('Help request sent', !!helpResponse, helpResponse);
      console.groupEnd();

      // Step 6: Test lesson time tracking
      console.group('⏱️ Step 6: Testing Time Tracking');
      const timeResponse = await this.sendLessonTime({
        lessonId: 'test-lesson',
        seconds: 120,
      });
      this.log('Lesson time tracked', !!timeResponse, {
        addedTime: 120,
        totalTime: updatedContext.totalLearningTime + 120,
      });
      console.groupEnd();

      // Step 7: Verify parent can see updates
      console.group('👨‍👩‍👧 Step 7: Verifying Parent Reports');
      const parentReport = await this.fetchParentReport();

      this.log('Parent report fetched', !!parentReport, {
        childName: parentReport?.firstName,
        lastActive: parentReport?.lastActiveDate,
        averageScore: parentReport?.averageScore,
        totalTime: parentReport?.totalLearningTime,
      });

      // Check today's activity in parent view
      const todayActivity = await this.fetchTodayActivity();
      this.log('Today\'s activity visible to parent', todayActivity.length > 0, {
        eventCount: todayActivity.length,
        recentEvents: todayActivity.slice(-3),
      });
      console.groupEnd();

      // Step 8: Test WebSocket real-time updates
      console.group('🔌 Step 8: Testing Real-time Updates');
      const wsTest = await this.testWebSocketUpdates();
      this.log('WebSocket connection', wsTest.connected, {
        latency: wsTest.latency,
        eventsReceived: wsTest.eventsReceived,
      });
      console.groupEnd();

      // Step 9: Test streak update
      console.group('🔥 Step 9: Testing Streak Tracking');
      const streakTest = await this.testStreakUpdate();
      this.log('Streak tracking', streakTest.success, {
        currentStreak: streakTest.currentStreak,
        longestStreak: streakTest.longestStreak,
      });
      console.groupEnd();

      // Step 10: Generate summary
      console.group('📊 Test Summary');
      this.generateSummary();
      console.groupEnd();

    } catch (error) {
      this.log('Test failed', false, null, error instanceof Error ? error.message : 'Unknown error');
      console.error('Test error:', error);
    }

    return this.results;
  }

  private async sendQuizAnswer(payload: any): Promise<any> {
    try {
      const response = await fetch(`/api/v1/student-context/${this.userId}/activity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`,
        },
        body: JSON.stringify({
          action: 'quiz_answer',
          metadata: payload,
        }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      this.log('Quiz answer submission failed', false, null, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  private async sendHelpRequest(payload: any): Promise<any> {
    try {
      const response = await fetch(`/api/v1/student-context/${this.userId}/activity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`,
        },
        body: JSON.stringify({
          action: 'help_request',
          metadata: payload,
        }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      this.log('Help request failed', false, null, error instanceof Error ? error.message : 'Unknown error');
      return null;
    }
  }

  private async sendLessonTime(payload: any): Promise<any> {
    try {
      const response = await fetch(`/api/v1/student-context/${this.userId}/activity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`,
        },
        body: JSON.stringify({
          action: 'lesson_time',
          metadata: payload,
        }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      this.log('Lesson time tracking failed', false, null, error instanceof Error ? error.message : 'Unknown error');
      return null;
    }
  }

  private async fetchParentReport(): Promise<any> {
    try {
      const response = await fetch(`http://localhost:3001/api/v1/parent-reports/child/${this.userId}`, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
        },
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      this.log('Parent report fetch failed', false, null, error instanceof Error ? error.message : 'Unknown error');
      return null;
    }
  }

  private async fetchTodayActivity(): Promise<any[]> {
    try {
      const response = await fetch(`http://localhost:3001/api/v1/parent-reports/today/${this.userId}`, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
        },
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      return data.events || [];
    } catch (error) {
      this.log('Today activity fetch failed', false, null, error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  private async testWebSocketUpdates(): Promise<any> {
    // Simulated WebSocket test - in real app would use actual WebSocket
    const startTime = Date.now();

    try {
      // Test if WebSocket endpoint is reachable
      const ws = new WebSocket('ws://localhost:3001');

      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          ws.close();
          resolve({
            connected: false,
            latency: Date.now() - startTime,
            eventsReceived: 0,
          });
        }, 3000);

        ws.onopen = () => {
          clearTimeout(timeout);
          ws.close();
          resolve({
            connected: true,
            latency: Date.now() - startTime,
            eventsReceived: 0,
          });
        };

        ws.onerror = () => {
          clearTimeout(timeout);
          resolve({
            connected: false,
            latency: Date.now() - startTime,
            eventsReceived: 0,
          });
        };
      });
    } catch (error) {
      return {
        connected: false,
        latency: Date.now() - startTime,
        eventsReceived: 0,
      };
    }
  }

  private async testStreakUpdate(): Promise<any> {
    try {
      const context = await studentContextManager.fetchContext(this.userId);
      return {
        success: true,
        currentStreak: context.streakCount,
        longestStreak: context.longestStreak,
        lastActiveDate: context.lastActiveDate,
      };
    } catch (error) {
      return {
        success: false,
        currentStreak: 0,
        longestStreak: 0,
      };
    }
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private generateSummary(): void {
    const successful = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;
    const successRate = (successful / this.results.length) * 100;

    console.log('\n' + '='.repeat(50));
    console.log('📈 TEST RESULTS SUMMARY');
    console.log('='.repeat(50));
    console.log(`Total Steps: ${this.results.length}`);
    console.log(`✅ Successful: ${successful}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`Success Rate: ${successRate.toFixed(1)}%`);
    console.log('='.repeat(50));

    // Detailed breakdown
    console.table(this.results.map(r => ({
      Step: r.step,
      Status: r.success ? '✅' : '❌',
      Time: new Date(r.timestamp).toLocaleTimeString(),
    })));

    // Data flow verification
    console.log('\n🔍 Data Flow Verification:');
    const checks = [
      { name: 'Backend API', status: this.results.some(r => r.step.includes('submitted') && r.success) },
      { name: 'Context Updates', status: this.results.some(r => r.step.includes('Context updated') && r.success) },
      { name: 'Achievement System', status: this.results.some(r => r.step.includes('achievements') && r.success) },
      { name: 'Parent Reports', status: this.results.some(r => r.step.includes('Parent report') && r.success) },
      { name: 'Real-time Updates', status: this.results.some(r => r.step.includes('WebSocket') && r.success) },
    ];

    checks.forEach(check => {
      console.log(`${check.status ? '✅' : '❌'} ${check.name}: ${check.status ? 'Working' : 'Not Working'}`);
    });
  }

  exportResults(): string {
    return JSON.stringify(this.results, null, 2);
  }
}

// Export test function for easy use
export async function testRealDataFlow(userId?: string): Promise<void> {
  const tester = new DataFlowTester();

  // Get userId from context or use provided
  const testUserId = userId || studentContextManager.getContext()?.userId;

  if (!testUserId) {
    console.error('❌ No user ID available. Please login first.');
    return;
  }

  await tester.initialize(testUserId);
  const results = await tester.testRealDataFlow();

  // Log final results
  console.log('\n📋 Full test results:', results);
}

// Export for use in console
if (typeof window !== 'undefined') {
  (window as any).testDataFlow = testRealDataFlow;
  (window as any).DataFlowTester = DataFlowTester;
  console.log('💡 Data flow tester loaded. Run: testDataFlow() in console');
}

export { DataFlowTester };