"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  BookOpen,
  Trophy,
  Target,
  TrendingUp,
  Clock,
  ChevronRight,
  Brain,
  Flame,
  Star,
  Zap,
  GraduationCap,
  Medal,
  Calendar,
  Activity,
  Users,
  BookMarked,
  PenTool,
  Lightbulb,
} from "lucide-react";
import Button from "@/components/ui/Button";
import Card, { CardHeader, CardContent } from "@/components/ui/Card";
import Loading from "@/components/ui/Loading";
import useAuthStore from "@/stores/useAuthStore";
import { lessonAPI } from "@/services/api";
import api from "@/services/api";
import { studentContextManager, StudentContext } from "@/services/studentContext";
import { useDailyGoal, getDailyGoalMessage, getStreakMessage } from "@/hooks/useDailyGoal";

interface Lesson {
  id: string;
  title: string;
  titleAr: string;
  description: string;
  duration: number;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  unit: {
    title: string;
    subject: {
      name: string;
      nameAr: string;
    };
  };
}

interface Subject {
  id: string;
  name: string;
  nameAr: string;
  nameEn: string;
  description: string;
  grade: number;
}

interface Recommendation {
  id: string;
  title: string;
  description: string;
  type: string;
  priority: number;
  actionUrl?: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuthStore();

  // ✅ كل الـ useState في البداية
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [studentContext, setStudentContext] = useState<StudentContext | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [realProgress, setRealProgress] = useState<{completed: number; total: number}>({
    completed: 0,
    total: 0
  }); // ✅ نقلناه للبداية

  const { goal: dailyGoal, loading: goalLoading, error: goalError } = useDailyGoal(user?.id);

  const generateGreeting = useCallback((context: StudentContext) => {
    const hour = new Date().getHours();
    let greeting = hour < 12 ? 'صباح الخير' : hour < 18 ? 'نهارك سعيد' : 'مساء الخير';
    greeting += ` ${context.firstName}!`;

    if (context.streakCount > 0) {
      greeting += ` 🔥 ${context.streakCount} أيام متتالية`;
    }

    if (context.recentTopics?.length > 0 && context.averageScore > 0) {
      const improvement = Math.round(context.averageScore - 70);
      if (improvement > 0) {
        greeting += ` - تحسن ${improvement}% في ${context.recentTopics[0]}`;
      }
    }

    return greeting;
  }, []);

  const fetchStudentContext = useCallback(async () => {
    if (!user?.id) return;

    try {
      const context = await studentContextManager.fetchContext(user.id);
      setStudentContext(context);

      // ✅ جلب التقدم الحقيقي هنا مباشرة
      const progressResponse = await api.get<{
        success: boolean;
        data: {
          completedLessons: number;
          totalLessons: number;
        }
      }>('/lessons/user-progress');
      if (progressResponse.data?.success) {
        setRealProgress({
          completed: progressResponse.data.data.completedLessons || 0,
          total: progressResponse.data.data.totalLessons || 0
        });
        console.log('✅ Real Progress:', progressResponse.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch student context:', error);
    }
  }, [user?.id]);

  const fetchRecommendations = useCallback(async () => {
    if (!user?.id) return;

    try {
      const response = await api.get<any>(`/student-context/${user.id}/recommendations`);
      setRecommendations(response.data.recommendations || []);
    } catch (error) {
      console.error('Failed to fetch recommendations:', error);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/auth/login");
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const subjectsResponse = await api.get<any>(`/subjects?grade=${user?.grade || 6}`);
        if (subjectsResponse.data?.success) {
          setSubjects(subjectsResponse.data.data || []);
        }

        const data = await lessonAPI.getAllLessons();
        setLessons(data.lessons || []);

        await fetchStudentContext();
        await fetchRecommendations();
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (isAuthenticated && user?.id) {
      fetchDashboardData();
    }
  }, [isAuthenticated, user?.id, user?.grade, fetchStudentContext, fetchRecommendations]);

  useEffect(() => {
    const unsubscribe = studentContextManager.subscribeToChanges((context) => {
      setStudentContext(context);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const interval = setInterval(async () => {
      if (user?.id) {
        await fetchStudentContext();
        await fetchRecommendations();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [user?.id, fetchStudentContext, fetchRecommendations]);


  if (authLoading || isLoading) {
    return <Loading fullScreen text="جاري التحميل..." />;
  }

  const calculateSuccessRate = () => {
    if (!studentContext) return 0;
    const total = studentContext.correctAnswers + studentContext.wrongAnswers;
    if (total === 0) return 0;
    return Math.round((studentContext.correctAnswers / total) * 100);
  };

  const formatLearningTime = (minutes: number) => {
    if (minutes < 60) return `${minutes} دقيقة`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}س ${mins}د` : `${hours} ساعة`;
  };

  const stats = [
    {
      icon: <BookOpen className="h-6 w-6" />,
      label: "الدروس المكتملة",
      // ✅ استخدام realProgress أولاً، ثم studentContext
      value: realProgress.completed || studentContext?.completedLessons || 0,
      total: Math.max(1, realProgress.total || studentContext?.totalLessons || 1),
      progress: ((realProgress.completed || studentContext?.completedLessons || 0) /
                 Math.max(1, realProgress.total || studentContext?.totalLessons || 1)) * 100,
      color: "text-primary-600",
      bg: "bg-gradient-to-br from-primary-50 to-primary-100",
      iconBg: "bg-primary-500",
    },
    {
      icon: <Trophy className="h-6 w-6 text-white" />,
      label: "النقاط المكتسبة",
      value: studentContext?.points || 0,
      trend: studentContext?.points ? `+${Math.round(studentContext.points * 0.1)}` : null,
      color: "text-motivation-600",
      bg: "bg-gradient-to-br from-motivation-50 to-motivation-100",
      iconBg: "bg-motivation-500",
    },
    {
      icon: <Target className="h-6 w-6 text-white" />,
      label: "معدل النجاح",
      value: `${calculateSuccessRate()}%`,
      trend: (studentContext?.averageScore ?? 0) > 75 ? "+5%" : null,
      color: "text-success-600",
      bg: "bg-gradient-to-br from-success-50 to-success-100",
      iconBg: "bg-success-500",
    },
    {
      icon: <Clock className="h-6 w-6 text-white" />,
      label: "وقت التعلم",
      value: formatLearningTime(studentContext?.totalLearningTime || 0),
      total: "100 ساعة",
      progress: Math.min(((studentContext?.totalLearningTime || 0) / 6000) * 100, 100),
      color: "text-purple-600",
      bg: "bg-gradient-to-br from-purple-50 to-purple-100",
      iconBg: "bg-purple-500",
    },
  ];

  const getAchievements = () => {
    if (!studentContext?.achievements) return [];

    return studentContext.achievements.slice(0, 4).map((achievement: string) => ({
      name: achievement,
      icon: achievement.includes('رياضيات') ? '🧮' :
            achievement.includes('علوم') ? '🔬' :
            achievement.includes('قراءة') ? '📚' : '🏆',
      date: 'مؤخراً',
      points: Math.floor(Math.random() * 50 + 25)
    }));
  };

  const recentAchievements = getAchievements();

  const quickActions = [
    {
      icon: <PenTool className="h-5 w-5" />,
      label: "اختبار سريع",
      color: "bg-gradient-to-br from-blue-500 to-blue-600",
      onClick: () => router.push("/quiz/quick")
    },
    {
      icon: <BookMarked className="h-5 w-5" />,
      label: "المفضلة",
      color: "bg-gradient-to-br from-purple-500 to-purple-600",
      onClick: () => router.push("/favorites")
    },
    {
      icon: <Users className="h-5 w-5" />,
      label: "لوحة الشرف",
      color: "bg-gradient-to-br from-motivation-500 to-motivation-600",
      onClick: () => router.push("/leaderboard")
    },
    {
      icon: <Lightbulb className="h-5 w-5" />,
      label: "نصائح اليوم",
      color: "bg-gradient-to-br from-success-500 to-success-600",
      onClick: () => router.push("/tips")
    },
  ];

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "EASY":
        return "text-success-600 bg-success-100";
      case "MEDIUM":
        return "text-motivation-600 bg-motivation-100";
      case "HARD":
        return "text-red-600 bg-red-100";
      default:
        return "text-gray-600 bg-gray-100";
    }
  };

  const getDifficultyLabel = (difficulty: string) => {
    switch (difficulty) {
      case "EASY":
        return "سهل";
      case "MEDIUM":
        return "متوسط";
      case "HARD":
        return "صعب";
      default:
        return difficulty;
    }
  };

  const getDifficultyIcon = (difficulty: string) => {
    switch (difficulty) {
      case "EASY":
        return <Zap className="h-4 w-4" />;
      case "MEDIUM":
        return <Brain className="h-4 w-4" />;
      case "HARD":
        return <Flame className="h-4 w-4" />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-primary-50 py-8">
      <div className="container-custom">
        {/* Welcome Section with Streak */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-8"
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 font-amiri mb-2">
                {studentContext ? generateGreeting(studentContext) : `مرحباً ${user?.firstName || ''}`} <span className="text-3xl">👋</span>
              </h1>
              <p className="text-gray-600 text-lg">
                {studentContext?.currentMood === 'confident' ? 'أداء ممتاز! استمر في التقدم' :
                 studentContext?.currentMood === 'frustrated' ? 'لا تقلق، كل خطوة تقربك من الهدف' :
                 studentContext?.currentMood === 'confused' ? 'خذ وقتك في الفهم، نحن هنا للمساعدة' :
                 'استمر في التقدم! أنت تبلي بلاءً حسناً'}
              </p>
              {studentContext && (
                <div className="flex gap-4 mt-2 text-sm text-gray-600">
                  <span>المستوى: {studentContext.currentLevel}</span>
                  <span>•</span>
                  <span>الثقة: {Math.round(studentContext.averageConfidence || 0)}%</span>
                  <span>•</span>
                  <span>التفاعل: {Math.round(studentContext.averageEngagement || 0)}%</span>
                </div>
              )}
            </div>

            {/* Streak Counter */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, type: "spring" }}
              className="mt-4 md:mt-0 flex items-center gap-3 bg-gradient-to-r from-motivation-500 to-motivation-600 text-white px-6 py-3 rounded-xl shadow-lg"
            >
              <Flame className="h-8 w-8" />
              <div>
                <p className="text-sm opacity-90">السلسلة اليومية</p>
                <p className="text-2xl font-bold">{studentContext?.streakCount || 0} أيام</p>
                {studentContext?.longestStreak && studentContext.longestStreak > studentContext.streakCount && (
                  <p className="text-xs opacity-75">الأطول: {studentContext.longestStreak} أيام</p>
                )}
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.05 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
        >
          {quickActions.map((action, index) => (
            <motion.button
              key={index}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={action.onClick}
              className={`${action.color} text-white p-4 rounded-xl shadow-lg hover:shadow-xl transition-all`}
            >
              <div className="flex flex-col items-center gap-2">
                {action.icon}
                <span className="text-sm font-medium">{action.label}</span>
              </div>
            </motion.button>
          ))}
        </motion.div>

        {/* Stats Grid with Progress Rings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
        >
          {stats.map((stat, index) => (
            <motion.div
              key={index}
              whileHover={{ y: -5 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <Card variant="bordered" className="overflow-hidden h-full">
                <div className={`h-2 ${stat.iconBg}`} />
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <p className="text-sm text-gray-600 mb-2">{stat.label}</p>
                      <div className="flex items-baseline gap-1">
                        <p className="text-3xl font-bold text-gray-900">
                          {typeof stat.value === 'number' ? stat.value.toLocaleString('ar-SA') : stat.value}
                        </p>
                        {stat.total && typeof stat.total === 'number' && (
                          <span className="text-sm font-normal text-gray-500">
                            /{stat.total.toLocaleString('ar-SA')}
                          </span>
                        )}
                      </div>
                      {stat.trend && (
                        <span className="text-xs text-success-600 font-medium flex items-center mt-1">
                          <TrendingUp className="h-3 w-3 ml-1" />
                          {stat.trend}
                        </span>
                      )}
                    </div>
                    <div className={`${stat.iconBg} p-3 rounded-lg shadow-md`}>
                      {stat.icon}
                    </div>
                  </div>

                  {stat.progress && (
                    <div className="mt-3">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${stat.progress}%` }}
                          transition={{ duration: 1, delay: 0.5 + index * 0.1 }}
                          className={`${stat.iconBg} h-2 rounded-full`}
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {/* Comprehensive Quiz Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="mb-8"
        >
          <Card variant="elevated" className="overflow-hidden">
            <div className="bg-gradient-to-r from-primary-500 to-purple-600 p-6 text-white">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold">اختبر نفسك</h2>
                <Trophy className="h-8 w-8" />
              </div>
              <p className="text-white/90 mb-6 text-lg">
                جاهز لاختبار شامل على كل ما تعلمته؟ اختبر معلوماتك في جميع الدروس المكتملة
              </p>
              <Button
                onClick={() => router.push('/quiz/comprehensive')}
                variant="ghost"
                className="bg-white text-primary-600 hover:bg-white/90 font-bold w-full md:w-auto px-8 py-3"
              >
                <Trophy className="h-5 w-5 mr-2" />
                ابدأ اختبار شامل
              </Button>
            </div>
          </Card>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Recent Lessons with Enhanced Cards */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="lg:col-span-2"
          >
            <Card variant="elevated" className="overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-primary-500 to-primary-600 text-white p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <GraduationCap className="h-6 w-6" />
                    <h2 className="text-xl font-semibold">
                      الدروس المتاحة
                    </h2>
                  </div>
                  <Button variant="ghost" size="sm" className="text-white hover:bg-white/20">
                    عرض الكل
                    <ChevronRight className="mr-2 h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-gray-100">
                  {lessons.slice(0, 5).map((lesson, index) => (
                    <motion.div
                      key={lesson.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + index * 0.1 }}
                      className="p-4 hover:bg-gradient-to-r hover:from-primary-50 hover:to-transparent transition-all cursor-pointer group"
                      onClick={() => router.push(`/lesson/${lesson.id}`)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 group-hover:text-primary-600 transition-colors mb-2">
                            {lesson.titleAr || lesson.title}
                          </h3>
                          <div className="flex items-center gap-4">
                            <span className="text-sm text-gray-600 flex items-center gap-1">
                              <BookOpen className="h-4 w-4 text-gray-400" />
                              {lesson.unit.subject.nameAr || lesson.unit.subject.name}
                            </span>
                            <span className="text-sm text-gray-600 flex items-center gap-1">
                              <Clock className="h-4 w-4 text-gray-400" />
                              {lesson.duration || 45} دقيقة
                            </span>
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getDifficultyColor(
                                lesson.difficulty
                              )}`}
                            >
                              {getDifficultyIcon(lesson.difficulty)}
                              {getDifficultyLabel(lesson.difficulty)}
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-primary-600 group-hover:translate-x-[-4px] transition-all" />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Achievements & Progress */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="space-y-6"
          >
            {/* Daily Goal Progress */}
            <Card variant="elevated" className="overflow-hidden">
              <div className="bg-gradient-to-br from-success-500 to-success-600 p-5 text-white">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold">الهدف اليومي</h2>
                  <Activity className="h-6 w-6" />
                </div>

                {/* Circular Progress */}
                <div className="flex justify-center my-6">
                  <div className="relative w-32 h-32">
                    <svg className="w-32 h-32 transform -rotate-90">
                      <circle
                        cx="64"
                        cy="64"
                        r="56"
                        stroke="rgba(255,255,255,0.2)"
                        strokeWidth="12"
                        fill="none"
                      />
                      <motion.circle
                        cx="64"
                        cy="64"
                        r="56"
                        stroke="white"
                        strokeWidth="12"
                        fill="none"
                        strokeDasharray={`${2 * Math.PI * 56}`}
                        initial={{ strokeDashoffset: 2 * Math.PI * 56 }}
                        animate={{ strokeDashoffset: 2 * Math.PI * 56 * (1 - dailyGoal.percentage / 100) }}
                        transition={{ duration: 1, delay: 0.5 }}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-3xl font-bold">
                        {dailyGoal.percentage}%
                      </span>
                      <span className="text-xs opacity-90">مكتمل</span>
                    </div>
                  </div>
                </div>

                <div className="text-center">
                  {goalLoading ? (
                    <p className="text-sm opacity-75">جاري التحميل...</p>
                  ) : goalError ? (
                    <p className="text-sm opacity-75">فشل تحميل الهدف</p>
                  ) : (
                    <>
                      <p className="text-sm opacity-90 mb-1">
                        {dailyGoal.completed} من {dailyGoal.target} دروس اليوم
                      </p>
                      <p className="text-xs opacity-75">
                        {getDailyGoalMessage(dailyGoal.percentage)}
                      </p>
                      {dailyGoal.streak > 0 && (
                        <p className="text-xs opacity-75 mt-1">
                          {getStreakMessage(dailyGoal.streak)}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
            </Card>

            {/* Recent Achievements with Points */}
            <Card variant="elevated" className="overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-motivation-500 to-motivation-600 text-white p-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold">
                    آخر الإنجازات
                  </h2>
                  <Medal className="h-6 w-6" />
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-gray-100">
                  {recentAchievements.map((achievement, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.4 + index * 0.1 }}
                      whileHover={{ x: 5 }}
                      className="p-4 hover:bg-gradient-to-r hover:from-motivation-50 hover:to-transparent transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-3xl">{achievement.icon}</span>
                          <div>
                            <p className="font-medium text-gray-900">
                              {achievement.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {achievement.date}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-motivation-600">
                          <span className="font-bold">+{achievement.points}</span>
                          <Star className="h-4 w-4 fill-current" />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Quick Access Subjects */}
            <Card variant="bordered">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <BookMarked className="h-5 w-5 text-primary-600" />
                    المواد الدراسية
                  </h3>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => router.push('/subjects')}
                  >
                    عرض الكل
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {subjects.slice(0, 3).map((subject, index) => (
                  <div
                    key={subject.id}
                    className="flex items-center gap-3 p-3 bg-gray-50 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors"
                    onClick={() => router.push(`/subjects/${subject.id}/units`)}
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      index === 0 ? 'bg-blue-100' : index === 1 ? 'bg-purple-100' : 'bg-green-100'
                    }`}>
                      <BookOpen className={`h-5 w-5 ${
                        index === 0 ? 'text-blue-600' : index === 1 ? 'text-purple-600' : 'text-green-600'
                      }`} />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{subject.nameAr || subject.name}</p>
                      <p className="text-xs text-gray-600">الصف {subject.grade}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  </div>
                ))}
                {subjects.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">
                    لا توجد مواد دراسية متاحة
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Personalized Recommendations */}
            <Card variant="bordered">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-primary-600" />
                    توصيات شخصية
                  </h3>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {recommendations.length > 0 ? (
                  recommendations.slice(0, 3).map((rec, index) => (
                    <div
                      key={rec.id}
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                        rec.priority > 7 ? 'bg-red-50 hover:bg-red-100' :
                        rec.priority > 4 ? 'bg-yellow-50 hover:bg-yellow-100' :
                        'bg-blue-50 hover:bg-blue-100'
                      }`}
                      onClick={() => rec.actionUrl && router.push(rec.actionUrl)}
                    >
                      <div className={`w-2 h-12 rounded-full ${
                        rec.priority > 7 ? 'bg-red-500' :
                        rec.priority > 4 ? 'bg-yellow-500' :
                        'bg-blue-500'
                      }`} />
                      <div>
                        <p className="font-medium text-sm">{rec.title}</p>
                        <p className="text-xs text-gray-600">{rec.description}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <>
                    {studentContext?.strugglingTopics && studentContext.strugglingTopics.length > 0 && (
                      <div className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg">
                        <div className="w-2 h-12 bg-yellow-500 rounded-full" />
                        <div>
                          <p className="font-medium text-sm">مراجعة {studentContext.strugglingTopics[0]}</p>
                          <p className="text-xs text-gray-600">يحتاج لمزيد من التدريب</p>
                        </div>
                      </div>
                    )}
                    {studentContext?.masteredTopics && studentContext.masteredTopics.length > 0 && (
                      <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                        <div className="w-2 h-12 bg-green-500 rounded-full" />
                        <div>
                          <p className="font-medium text-sm">ممتاز في {studentContext.masteredTopics[0]}</p>
                          <p className="text-xs text-gray-600">جرب المستوى المتقدم</p>
                        </div>
                      </div>
                    )}
                    {!studentContext?.strugglingTopics?.length && !studentContext?.masteredTopics?.length && (
                      <p className="text-sm text-gray-500 text-center py-4">
                        ابدأ التعلم لتحصل على توصيات شخصية
                      </p>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}