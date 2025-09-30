'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  TrendingUp,
  Trophy,
  Clock,
  Target,
  Award,
  BookOpen,
  Users,
  ChevronRight,
  Star,
  Zap,
  Brain,
  ArrowUp,
  ArrowDown,
  Medal,
  Crown,
  Lock,
  CheckCircle,
  Activity,
  BarChart3,
  PieChart,
  Calendar,
  Loader
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart as RePieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadialBarChart,
  RadialBar
} from 'recharts';
import api from '@/services/api';
import useAuthStore from '@/stores/useAuthStore';

// Interfaces for real data
interface StudentContext {
  totalLearningTime: number;
  correctAnswers: number;
  wrongAnswers: number;
  averageScore: number;
  streakCount: number;
  longestStreak: number;
  currentLevel: number;
  points: number;
  sessionsCompleted: number;
  masteredTopics: string[];
  strugglingTopics: string[];
  recentTopics: string[];
  questionsAsked: number;
  hintsRequested: number;
  achievements: string[];
}

interface QuizProgress {
  totalAttempts: number;
  averageScore: number;
  bestScore: number;
  recentScores: { date: string; score: number }[];
}

interface LessonProgress {
  totalLessons: number;
  completedLessons: number;
  inProgressLessons: number;
  notStartedLessons: number;
  subjectProgress: { subject: string; completed: number; total: number }[];
}

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlockedAt: string;
  points: number;
}

export default function ProgressPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [studentContext, setStudentContext] = useState<StudentContext | null>(null);
  const [quizProgress, setQuizProgress] = useState<QuizProgress | null>(null);
  const [lessonProgress, setLessonProgress] = useState<LessonProgress | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [dailyActivity, setDailyActivity] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (user?.id) {
      fetchAllData();
    }
  }, [user]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchStudentContext(),
        fetchQuizProgress(),
        fetchLessonProgress(),
        fetchAchievements(),
        fetchDailyActivity()
      ]);
    } catch (error) {
      console.error('Error fetching progress data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStudentContext = async () => {
    try {
      const response = await api.get(`/student-context/${user?.id}`);
      const data = response.data as any;
      if (data?.success) {
        setStudentContext(data.data);
      }
    } catch (error) {
      console.error('Error fetching student context:', error);
    }
  };

  const fetchQuizProgress = async () => {
    try {
      const response = await api.get('/quiz/progress');
      const responseData = response.data as any;
      if (responseData?.success) {
        const data = responseData.data;
        setQuizProgress({
          totalAttempts: data.totalAttempts || 0,
          averageScore: data.averageScore || 0,
          bestScore: data.bestScore || 0,
          recentScores: data.recentScores || []
        });
      }
    } catch (error) {
      console.error('Error fetching quiz progress:', error);
    }
  };

  const fetchLessonProgress = async () => {
    try {
      const response = await api.get('/lessons/user-progress');
      const responseData = response.data as any;
      if (responseData?.success) {
        const data = responseData.data;
        setLessonProgress({
          totalLessons: data.totalLessons || 0,
          completedLessons: data.completedLessons || 0,
          inProgressLessons: data.inProgressLessons || 0,
          notStartedLessons: data.notStartedLessons || 0,
          subjectProgress: data.subjectProgress || []
        });
      }
    } catch (error) {
      console.error('Error fetching lesson progress:', error);
    }
  };

  const fetchAchievements = async () => {
    if (!user?.id) return;
    try {
      const response = await api.get(`/achievements/user/${user.id}`);
      const responseData = response.data as any;
      if (responseData?.success) {
        setAchievements(responseData.data || []);
      }
    } catch (error) {
      console.error('Error fetching achievements:', error);
    }
  };

  const fetchDailyActivity = async () => {
    try {
      const response = await api.get('/analytics/daily-activity');
      const responseData = response.data as any;
      if (responseData?.success) {
        // Transform data for chart
        const activity = responseData.data || [];
        const last7Days = [];
        const today = new Date();

        for (let i = 6; i >= 0; i--) {
          const date = new Date(today);
          date.setDate(date.getDate() - i);
          const dateStr = date.toISOString().split('T')[0];
          const dayData = activity.find((a: any) => a.date === dateStr);

          last7Days.push({
            day: date.toLocaleDateString('ar-SA', { weekday: 'short' }),
            lessons: dayData?.lessons || 0,
            quizzes: dayData?.quizzes || 0,
            minutes: dayData?.minutes || 0
          });
        }

        setDailyActivity(last7Days);
      }
    } catch (error) {
      console.error('Error fetching daily activity:', error);
      // Set default data if API fails
      setDailyActivity([
        { day: 'السبت', lessons: 0, quizzes: 0, minutes: 0 },
        { day: 'الأحد', lessons: 0, quizzes: 0, minutes: 0 },
        { day: 'الاثنين', lessons: 0, quizzes: 0, minutes: 0 },
        { day: 'الثلاثاء', lessons: 0, quizzes: 0, minutes: 0 },
        { day: 'الأربعاء', lessons: 0, quizzes: 0, minutes: 0 },
        { day: 'الخميس', lessons: 0, quizzes: 0, minutes: 0 },
        { day: 'الجمعة', lessons: 0, quizzes: 0, minutes: 0 }
      ]);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-12 h-12 animate-spin text-primary-500 mx-auto mb-4" />
          <p className="text-gray-600">جاري تحميل البيانات...</p>
        </div>
      </div>
    );
  }

  // Calculate overall progress percentage
  const overallProgress = lessonProgress
    ? Math.round((lessonProgress.completedLessons / Math.max(lessonProgress.totalLessons, 1)) * 100)
    : 0;

  // Prepare data for subject distribution pie chart
  const subjectDistribution = lessonProgress?.subjectProgress.map(sp => ({
    name: sp.subject,
    value: sp.completed,
    total: sp.total,
    percentage: Math.round((sp.completed / Math.max(sp.total, 1)) * 100)
  })) || [];

  // Prepare data for score trends
  const scoreTrends = quizProgress?.recentScores.map(score => ({
    date: new Date(score.date).toLocaleDateString('ar-SA'),
    score: score.score
  })) || [];

  // Colors for charts
  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="mb-4"
          >
            <ChevronRight className="ml-2 h-4 w-4" />
            رجوع
          </Button>

          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            تقدمك الدراسي
          </h1>
          <p className="text-gray-600">
            تابع إنجازاتك وتقدمك في التعلم
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">إجمالي الدروس</p>
                <p className="text-2xl font-bold text-gray-900">
                  {lessonProgress?.completedLessons || 0} / {Math.max(1, lessonProgress?.totalLessons || 1)}
                </p>
                <p className="text-xs text-green-600 mt-1">
                  {overallProgress}% مكتمل
                </p>
              </div>
              <BookOpen className="h-8 w-8 text-primary-500" />
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">معدل النجاح</p>
                <p className="text-2xl font-bold text-gray-900">
                  {studentContext?.averageScore || 0}%
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  {studentContext?.correctAnswers || 0} إجابة صحيحة
                </p>
              </div>
              <Trophy className="h-8 w-8 text-yellow-500" />
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">وقت التعلم</p>
                <p className="text-2xl font-bold text-gray-900">
                  {Math.round((studentContext?.totalLearningTime || 0) / 60)} ساعة
                </p>
                <p className="text-xs text-purple-600 mt-1">
                  {studentContext?.sessionsCompleted || 0} جلسة
                </p>
              </div>
              <Clock className="h-8 w-8 text-purple-500" />
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">السلسلة الحالية</p>
                <p className="text-2xl font-bold text-gray-900">
                  {studentContext?.streakCount || 0} يوم
                </p>
                <p className="text-xs text-orange-600 mt-1">
                  أطول سلسلة: {studentContext?.longestStreak || 0}
                </p>
              </div>
              <Zap className="h-8 w-8 text-orange-500" />
            </div>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b">
          {['overview', 'subjects', 'achievements'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === tab
                  ? 'text-primary-600 border-b-2 border-primary-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab === 'overview' && 'نظرة عامة'}
              {tab === 'subjects' && 'المواد'}
              {tab === 'achievements' && 'الإنجازات'}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Daily Activity Chart */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <Activity className="ml-2 h-5 w-5 text-primary-500" />
                النشاط اليومي (آخر 7 أيام)
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={dailyActivity}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="lessons" name="دروس" fill="#3B82F6" />
                  <Bar dataKey="quizzes" name="اختبارات" fill="#10B981" />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            {/* Score Trends */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <TrendingUp className="ml-2 h-5 w-5 text-green-500" />
                تطور الدرجات
              </h3>
              {scoreTrends.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={scoreTrends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="#10B981"
                      strokeWidth={2}
                      dot={{ fill: '#10B981' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-gray-500">
                  لا توجد بيانات كافية بعد
                </div>
              )}
            </Card>

            {/* Topics Progress */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <Brain className="ml-2 h-5 w-5 text-purple-500" />
                المواضيع
              </h3>
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">مواضيع متقنة</p>
                  <div className="flex flex-wrap gap-2">
                    {studentContext?.masteredTopics?.length ? (
                      studentContext.masteredTopics.slice(0, 5).map((topic, index) => (
                        <span
                          key={index}
                          className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm"
                        >
                          {topic}
                        </span>
                      ))
                    ) : (
                      <span className="text-gray-500 text-sm">لا توجد مواضيع متقنة بعد</span>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">تحتاج للمراجعة</p>
                  <div className="flex flex-wrap gap-2">
                    {studentContext?.strugglingTopics?.length ? (
                      studentContext.strugglingTopics.slice(0, 5).map((topic, index) => (
                        <span
                          key={index}
                          className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm"
                        >
                          {topic}
                        </span>
                      ))
                    ) : (
                      <span className="text-gray-500 text-sm">لا توجد مواضيع تحتاج مراجعة</span>
                    )}
                  </div>
                </div>
              </div>
            </Card>

            {/* Learning Stats */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <BarChart3 className="ml-2 h-5 w-5 text-blue-500" />
                إحصائيات التعلم
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">الأسئلة المطروحة</span>
                  <span className="font-semibold">{studentContext?.questionsAsked || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">التلميحات المطلوبة</span>
                  <span className="font-semibold">{studentContext?.hintsRequested || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">إجمالي الاختبارات</span>
                  <span className="font-semibold">{quizProgress?.totalAttempts || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">أفضل نتيجة</span>
                  <span className="font-semibold">{quizProgress?.bestScore || 0}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">النقاط المكتسبة</span>
                  <span className="font-semibold text-yellow-600">
                    {studentContext?.points || 0} نقطة
                  </span>
                </div>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'subjects' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Subject Distribution Pie Chart */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <PieChart className="ml-2 h-5 w-5 text-primary-500" />
                توزيع المواد
              </h3>
              {subjectDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <RePieChart>
                    <Pie
                      data={subjectDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percentage }) => `${name} (${percentage}%)`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {subjectDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </RePieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-gray-500">
                  لا توجد بيانات المواد بعد
                </div>
              )}
            </Card>

            {/* Subject Progress Bars */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <Target className="ml-2 h-5 w-5 text-green-500" />
                تقدم المواد
              </h3>
              <div className="space-y-4">
                {subjectDistribution.map((subject, index) => (
                  <div key={index}>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium">{subject.name}</span>
                      <span className="text-sm text-gray-600">
                        {subject.value} / {subject.total}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div
                        className="h-2.5 rounded-full transition-all duration-300"
                        style={{
                          width: `${subject.percentage}%`,
                          backgroundColor: COLORS[index % COLORS.length]
                        }}
                      />
                    </div>
                  </div>
                ))}
                {subjectDistribution.length === 0 && (
                  <p className="text-gray-500 text-center py-8">
                    لا توجد مواد مسجلة بعد
                  </p>
                )}
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'achievements' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {achievements.length > 0 ? (
              achievements.map((achievement) => (
                <Card key={achievement.id} className="p-4 hover:shadow-lg transition-shadow">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-yellow-100 rounded-lg">
                      <Trophy className="h-6 w-6 text-yellow-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900">{achievement.name}</h4>
                      <p className="text-sm text-gray-600 mt-1">{achievement.description}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-gray-500">
                          {new Date(achievement.unlockedAt).toLocaleDateString('ar-SA')}
                        </span>
                        <span className="text-sm font-semibold text-yellow-600">
                          +{achievement.points} نقطة
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              ))
            ) : (
              <div className="col-span-full text-center py-12">
                <Trophy className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">لم تحصل على إنجازات بعد</p>
                <p className="text-sm text-gray-400 mt-1">استمر في التعلم لفتح الإنجازات!</p>
              </div>
            )}
          </div>
        )}

        {/* Level Progress */}
        <Card className="mt-8 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center">
              <Medal className="ml-2 h-5 w-5 text-yellow-500" />
              المستوى {studentContext?.currentLevel || 1}
            </h3>
            <span className="text-2xl font-bold text-yellow-600">
              {studentContext?.points || 0} نقطة
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
            <div
              className="h-3 rounded-full bg-gradient-to-r from-yellow-400 to-yellow-600 transition-all duration-500"
              style={{
                width: `${Math.min(((studentContext?.points || 0) % 100), 100)}%`
              }}
            />
          </div>
          <p className="text-sm text-gray-600 text-left">
            {100 - ((studentContext?.points || 0) % 100)} نقطة للمستوى التالي
          </p>
        </Card>
      </div>
    </div>
  );
}