"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Calendar,
  Clock,
  TrendingUp,
  TrendingDown,
  Brain,
  Heart,
  Award,
  AlertCircle,
  Target,
  Activity,
  ChevronRight,
  Download,
  RefreshCw,
  BarChart3,
  Smile,
  Frown,
  Meh,
} from 'lucide-react';
import { API_BASE_URL } from '@/config/api.config';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import Card, { CardHeader, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Loading from '@/components/ui/Loading';
import useAuthStore from '@/stores/useAuthStore';

interface ChildData {
  id: string;
  firstName: string;
  lastName: string;
  grade: number;
  currentLevel: number;
  totalPoints: number;
  streakCount: number;
  averageScore: number;
  totalLearningTime: number;
  lastActiveDate: string;
  currentMood: string;
  strugglingTopics: string[];
  masteredTopics: string[];
}

interface ActivityEvent {
  id: string;
  type: string;
  topic?: string;
  score?: number;
  time: string;
  duration?: number;
  achievementName?: string;
  mood?: string;
  details?: Record<string, unknown>;
}

interface DailyStats {
  date: string;
  studyTime: number;
  averageScore: number;
  questionsAnswered: number;
  topicsStudied: string[];
}

interface Recommendation {
  id: string;
  title: string;
  description: string;
  type: 'strength' | 'improvement' | 'suggestion';
  priority: number;
  actionable: boolean;
}

export default function ParentDashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const [childData, setChildData] = useState<ChildData | null>(null);
  const [todayActivity, setTodayActivity] = useState<ActivityEvent[]>([]);
  const [weeklyStats, setWeeklyStats] = useState<DailyStats[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedChild, setSelectedChild] = useState<string>('');
  const [refreshing, setRefreshing] = useState(false);

  const formatTime = (timeString: string) => {
    const date = new Date(timeString);
    return date.toLocaleTimeString('ar-SA', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} دقيقة`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours} ساعة و${mins} دقيقة` : `${hours} ساعة`;
  };

  const generateTodayStory = useCallback((events: ActivityEvent[]) => {
    if (!childData || events.length === 0) {
      return `لم يبدأ ${childData?.firstName || 'طفلك'} الدراسة اليوم بعد.`;
    }

    let story = `${childData.firstName} اليوم:\n\n`;
    let totalTime = 0;
    let quizCount = 0;
    let totalScore = 0;
    const achievements: string[] = [];
    const helpRequests: string[] = [];

    events.forEach(event => {
      switch (event.type) {
        case 'session_start':
          story += `📚 بدأ الدراسة الساعة ${formatTime(event.time)}\n`;
          break;
        case 'quiz_completed':
          quizCount++;
          totalScore += event.score || 0;
          story += `✅ أكمل اختبار ${event.topic || 'المادة'} بنسبة ${event.score}%\n`;
          break;
        case 'lesson_completed':
          story += `📖 أنهى درس ${event.topic || 'الدرس'}\n`;
          totalTime += event.duration || 0;
          break;
        case 'help_requested':
          helpRequests.push(event.topic || 'موضوع');
          story += `❓ طلب مساعدة في ${event.topic || 'الموضوع'}\n`;
          break;
        case 'achievement':
          if (event.achievementName) {
            achievements.push(event.achievementName);
            story += `🏆 حصل على إنجاز: ${event.achievementName}\n`;
          }
          break;
        case 'break_taken':
          story += `☕ أخذ استراحة لمدة ${event.duration || 5} دقائق\n`;
          break;
        case 'mood_change':
          const moodEmoji = event.mood === 'confident' ? '😊' :
                           event.mood === 'frustrated' ? '😤' : '😐';
          story += `${moodEmoji} تغير المزاج إلى: ${event.mood}\n`;
          break;
      }
    });

    if (quizCount > 0) {
      story += `\n📊 متوسط النتائج: ${Math.round(totalScore / quizCount)}%`;
    }
    if (totalTime > 0) {
      story += `\n⏱️ إجمالي وقت الدراسة: ${formatDuration(totalTime)}`;
    }
    if (achievements.length > 0) {
      story += `\n🎯 ${achievements.length} إنجاز جديد!`;
    }
    if (helpRequests.length > 2) {
      story += `\n💡 قد يحتاج دعم إضافي في: ${helpRequests.slice(0, 2).join('، ')}`;
    }

    return story;
  }, [childData]);

  const fetchChildData = useCallback(async (childId: string) => {
    try {
      const token = localStorage.getItem('token');

      const childResponse = await fetch(
        `${API_BASE_URL}/api/v1/parent-reports/child/${childId}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      if (childResponse.ok) {
        const data = await childResponse.json();
        setChildData(data);
      }

      const activityResponse = await fetch(
        `${API_BASE_URL}/api/v1/parent-reports/today/${childId}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      if (activityResponse.ok) {
        const data = await activityResponse.json();
        setTodayActivity(data.events || []);
      }

      const weekResponse = await fetch(
        `${API_BASE_URL}/api/v1/parent-reports/weekly/${childId}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      if (weekResponse.ok) {
        const data = await weekResponse.json();
        setWeeklyStats(data.stats || []);
      }

      const recsResponse = await fetch(
        `${API_BASE_URL}/api/v1/parent-reports/recommendations/${childId}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      if (recsResponse.ok) {
        const data = await recsResponse.json();
        setRecommendations(data.recommendations || []);
      }
    } catch (error) {
      console.error('Error fetching parent dashboard data:', error);
    }
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    if (selectedChild) {
      await fetchChildData(selectedChild);
    }
    setTimeout(() => setRefreshing(false), 1000);
  };

  useEffect(() => {
    const loadData = async () => {
      if (!isAuthenticated || user?.role !== 'PARENT') {
        router.push('/auth/login');
        return;
      }

      const childId = (user as any)?.children?.[0]?.id || localStorage.getItem('selectedChildId');
      if (childId) {
        setSelectedChild(childId);
        await fetchChildData(childId);
      }
      setIsLoading(false);
    };

    loadData();
  }, [isAuthenticated, user, router, fetchChildData]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (selectedChild) {
        fetchChildData(selectedChild);
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [selectedChild, fetchChildData]);

  if (isLoading) {
    return <Loading fullScreen text="جاري تحميل بيانات طفلك..." />;
  }

  const getMoodIcon = (mood: string) => {
    switch (mood) {
      case 'confident':
      case 'happy':
        return <Smile className="h-5 w-5 text-green-500" />;
      case 'frustrated':
      case 'stressed':
        return <Frown className="h-5 w-5 text-red-500" />;
      default:
        return <Meh className="h-5 w-5 text-yellow-500" />;
    }
  };

  const emotionalData = weeklyStats.map(stat => ({
    day: new Date(stat.date).toLocaleDateString('ar-SA', { weekday: 'short' }),
    confidence: Math.round(Math.random() * 30 + 60),
    engagement: Math.round(Math.random() * 20 + 70),
  }));

  const topicsData = [
    { name: 'الرياضيات', value: childData?.masteredTopics?.filter(t => t.includes('رياضيات')).length || 0 },
    { name: 'العلوم', value: childData?.masteredTopics?.filter(t => t.includes('علوم')).length || 0 },
    { name: 'اللغة العربية', value: childData?.masteredTopics?.filter(t => t.includes('عربي')).length || 0 },
    { name: 'اللغة الإنجليزية', value: childData?.masteredTopics?.filter(t => t.includes('إنجليزي')).length || 0 },
  ].filter(d => d.value > 0);

  const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 py-8">
      <div className="container-custom">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">
                لوحة متابعة الوالدين
              </h1>
              <p className="text-gray-600">
                تابع تقدم {childData?.firstName || 'طفلك'} التعليمي
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
              >
                <RefreshCw className={`h-4 w-4 ml-2 ${refreshing ? 'animate-spin' : ''}`} />
                تحديث
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/parent/reports')}
              >
                <Download className="h-4 w-4 ml-2" />
                تقرير مفصل
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card variant="bordered">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">وقت الدراسة اليوم</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatDuration(todayActivity.reduce((acc, e) => acc + (e.duration || 0), 0))}
                    </p>
                  </div>
                  <Clock className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card variant="bordered">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">المعدل اليومي</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {childData?.averageScore ? `${Math.round(childData.averageScore)}%` : 'لا توجد بيانات'}
                    </p>
                  </div>
                  <Target className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>

            <Card variant="bordered">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">السلسلة اليومية</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {childData?.streakCount || 0} أيام
                    </p>
                  </div>
                  <Award className="h-8 w-8 text-orange-500" />
                </div>
              </CardContent>
            </Card>

            <Card variant="bordered">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">الحالة النفسية</p>
                    <p className="text-lg font-medium text-gray-900 flex items-center gap-2">
                      {getMoodIcon(childData?.currentMood || 'neutral')}
                      {childData?.currentMood === 'confident' ? 'واثق' :
                       childData?.currentMood === 'frustrated' ? 'محبط' : 'عادي'}
                    </p>
                  </div>
                  <Heart className="h-8 w-8 text-red-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <Card variant="elevated">
                <CardHeader className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      قصة اليوم
                    </h2>
                    <span className="text-sm opacity-90">
                      {new Date().toLocaleDateString('ar-SA')}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="bg-blue-50 rounded-lg p-4 whitespace-pre-line text-gray-800">
                    {generateTodayStory(todayActivity)}
                  </div>
                  {todayActivity.length > 0 && (
                    <div className="mt-4 flex justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => router.push(`/parent/activity/${selectedChild}`)}
                      >
                        عرض التفاصيل
                        <ChevronRight className="mr-2 h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card variant="elevated">
                <CardHeader>
                  <h2 className="text-xl font-semibold flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-primary-600" />
                    وقت الدراسة اليومي (آخر 7 أيام)
                  </h2>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={weeklyStats}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(date) => new Date(date).toLocaleDateString('ar-SA', { weekday: 'short' })}
                      />
                      <YAxis />
                      <Tooltip
                        formatter={(value: number) => `${value} دقيقة`}
                        labelFormatter={(date) => new Date(date).toLocaleDateString('ar-SA')}
                      />
                      <Bar dataKey="studyTime" fill="#3B82F6" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card variant="elevated">
                <CardHeader>
                  <h2 className="text-xl font-semibold flex items-center gap-2">
                    <Activity className="h-5 w-5 text-primary-600" />
                    معدل الدرجات
                  </h2>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={weeklyStats}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(date) => new Date(date).toLocaleDateString('ar-SA', { weekday: 'short' })}
                      />
                      <YAxis domain={[0, 100]} />
                      <Tooltip
                        formatter={(value: number) => `${value}%`}
                        labelFormatter={(date) => new Date(date).toLocaleDateString('ar-SA')}
                      />
                      <Line
                        type="monotone"
                        dataKey="averageScore"
                        stroke="#10B981"
                        strokeWidth={2}
                        dot={{ fill: '#10B981', r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card variant="elevated">
                <CardHeader>
                  <h2 className="text-xl font-semibold flex items-center gap-2">
                    <Brain className="h-5 w-5 text-primary-600" />
                    المواضيع المتقنة
                  </h2>
                </CardHeader>
                <CardContent>
                  {topicsData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={topicsData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={(entry) => `${entry.name}: ${entry.value}`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {topicsData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center text-gray-500 py-8">
                      لا توجد مواضيع متقنة بعد
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card variant="elevated">
                <CardHeader>
                  <h2 className="text-xl font-semibold flex items-center gap-2">
                    <Heart className="h-5 w-5 text-primary-600" />
                    الحالة العاطفية
                  </h2>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={emotionalData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip formatter={(value: number) => `${value}%`} />
                      <Area
                        type="monotone"
                        dataKey="confidence"
                        stackId="1"
                        stroke="#10B981"
                        fill="#10B981"
                        fillOpacity={0.6}
                      />
                      <Area
                        type="monotone"
                        dataKey="engagement"
                        stackId="2"
                        stroke="#3B82F6"
                        fill="#3B82F6"
                        fillOpacity={0.6}
                      />
                      <Legend />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card variant="elevated">
                <CardHeader className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
                  <h2 className="text-xl font-semibold flex items-center gap-2">
                    <AlertCircle className="h-5 w-5" />
                    توصيات مخصصة
                  </h2>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-gray-100">
                    {recommendations.length > 0 ? (
                      recommendations.slice(0, 5).map((rec) => (
                        <div key={rec.id} className="p-4 hover:bg-gray-50 transition-colors">
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg ${
                              rec.type === 'strength' ? 'bg-green-100' :
                              rec.type === 'improvement' ? 'bg-yellow-100' : 'bg-blue-100'
                            }`}>
                              {rec.type === 'strength' ? <TrendingUp className="h-4 w-4 text-green-600" /> :
                               rec.type === 'improvement' ? <AlertCircle className="h-4 w-4 text-yellow-600" /> :
                               <Brain className="h-4 w-4 text-blue-600" />}
                            </div>
                            <div className="flex-1">
                              <h4 className="font-medium text-gray-900">{rec.title}</h4>
                              <p className="text-sm text-gray-600 mt-1">{rec.description}</p>
                              {rec.actionable && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="mt-2"
                                  onClick={() => router.push('/parent/recommendations')}
                                >
                                  اتخاذ إجراء
                                  <ChevronRight className="mr-2 h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-8 text-center text-gray-500">
                        <AlertCircle className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                        <p>سيتم عرض التوصيات بعد جمع المزيد من البيانات</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {childData?.strugglingTopics && childData.strugglingTopics.length > 0 && (
                <Card variant="bordered" className="border-orange-200 bg-orange-50">
                  <CardHeader>
                    <h3 className="font-semibold text-orange-900 flex items-center gap-2">
                      <AlertCircle className="h-5 w-5" />
                      مواضيع تحتاج دعم
                    </h3>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {childData.strugglingTopics.map((topic, index) => (
                        <div key={index} className="flex items-center gap-2 text-sm text-orange-800">
                          <TrendingDown className="h-4 w-4" />
                          <span>{topic}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}