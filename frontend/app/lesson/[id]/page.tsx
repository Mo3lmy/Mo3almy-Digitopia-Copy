'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Clock,
  BookOpen,
  Play,
  MessageSquare,
  FileText,
  CheckCircle,
  Star,
  ChevronRight,
  PenTool,
  MessageCircle
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { API_BASE_URL } from '@/config/api.config';

interface LessonContent {
  id: string;
  title: string;
  titleAr: string;
  titleEn: string;
  description: string;
  duration: number;
  difficulty: string;
  keyPoints: string[];
  summary: string;
  content?: {
    fullText?: string;
    summary?: string;
    examples?: any[];
    exercises?: any[];
  };
  unit: {
    id: string;
    title: string;
    titleAr: string;
    subject: {
      id: string;
      name: string;
      nameAr: string;
    };
  };
}

export default function LessonPage() {
  const params = useParams();
  const router = useRouter();
  const [lesson, setLesson] = useState<LessonContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'content' | 'slides' | 'quiz' | 'chat'>('content');

  useEffect(() => {
    fetchLessonDetails();
  }, [params.id]);

  const fetchLessonDetails = async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/lessons/${params.id}`
      );
      const data = await response.json();

      if (data?.success) {
        setLesson(data.data);
      }
    } catch (error) {
      console.error('Error fetching lesson:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty?.toUpperCase()) {
      case 'EASY': return 'text-green-600 bg-green-100';
      case 'MEDIUM': return 'text-yellow-600 bg-yellow-100';
      case 'HARD': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-700 font-medium">جاري تحميل الدرس...</p>
        </div>
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="p-8 text-center">
          <BookOpen className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">الدرس غير موجود</h2>
          <p className="text-gray-500 mb-4">عذراً، لم نتمكن من العثور على هذا الدرس</p>
          <Button onClick={() => router.back()}>
            العودة
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm">
              <button
                onClick={() => router.push('/subjects')}
                className="text-gray-600 hover:text-blue-600"
              >
                المواد الدراسية
              </button>
              <ChevronRight className="h-4 w-4 text-gray-400" />
              <button
                onClick={() => router.push(`/subjects/${lesson.unit.subject.id}/units`)}
                className="text-gray-600 hover:text-blue-600"
              >
                {lesson.unit.subject.nameAr}
              </button>
              <ChevronRight className="h-4 w-4 text-gray-400" />
              <span className="text-gray-900 font-medium">
                {lesson.titleAr || lesson.title}
              </span>
            </div>

            {/* Back Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              رجوع
            </Button>
          </div>
        </div>
      </div>

      {/* Lesson Info */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">
                {lesson.titleAr || lesson.title}
              </h1>
              <p className="text-blue-100 text-lg mb-4">
                {lesson.titleEn}
              </p>
              <p className="text-white/90 mb-4">
                {lesson.description}
              </p>
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {lesson.duration || 45} دقيقة
                </span>
                <span className={`px-3 py-1 rounded-full ${getDifficultyColor(lesson.difficulty)}`}>
                  {lesson.difficulty === 'EASY' ? 'سهل' :
                   lesson.difficulty === 'HARD' ? 'صعب' : 'متوسط'}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                className="bg-white text-blue-600 hover:bg-blue-50"
                onClick={() => setActiveTab('slides')}
              >
                <Play className="h-4 w-4 ml-2" />
                عرض الشرائح
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-6">
            {[
              { id: 'content', label: 'المحتوى', icon: FileText },
              { id: 'slides', label: 'الشرائح', icon: Play },
              { id: 'quiz', label: 'الاختبار', icon: CheckCircle },
              { id: 'chat', label: 'المساعد', icon: MessageSquare }
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 py-4 px-2 border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {activeTab === 'content' && (
              <Card className="p-6">
                <h2 className="text-2xl font-bold mb-4">محتوى الدرس</h2>

                {/* Summary */}
                {lesson.summary && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold mb-2">الملخص</h3>
                    <p className="text-gray-700 leading-relaxed">
                      {lesson.summary}
                    </p>
                  </div>
                )}

                {/* Key Points */}
                {lesson.keyPoints && lesson.keyPoints.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold mb-3">النقاط الرئيسية</h3>
                    <ul className="space-y-2">
                      {lesson.keyPoints.map((point, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <Star className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                          <span className="text-gray-700">{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Full Content */}
                {lesson.content?.fullText && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold mb-3">الشرح التفصيلي</h3>
                    <div className="prose prose-gray max-w-none">
                      <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                        {lesson.content.fullText}
                      </p>
                    </div>
                  </div>
                )}

                {/* Examples */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-3">أمثلة تطبيقية</h3>
                  {(() => {
                    const examples = (lesson as any).enrichedContent?.examples ||
                                   lesson.content?.examples ||
                                   [];

                    if (examples.length === 0) {
                      return (
                        <Card className="p-4 bg-gray-50 text-gray-600 text-center">
                          <p>لا توجد أمثلة متاحة حالياً</p>
                        </Card>
                      );
                    }

                    return (
                      <div className="space-y-3">
                        {examples.map((example: any, index: number) => (
                          <Card key={index} className="p-4 bg-blue-50 border-blue-200">
                            <h4 className="font-medium text-blue-900 mb-2">مثال {index + 1}</h4>
                            {typeof example === 'string' ? (
                              <p className="text-gray-700">{example}</p>
                            ) : (
                              <>
                                {example.problem && (
                                  <div className="mb-3">
                                    <span className="font-semibold text-gray-800">المسألة: </span>
                                    <span className="text-gray-700">{example.problem}</span>
                                  </div>
                                )}
                                {example.solution && (
                                  <div className="mb-3">
                                    <span className="font-semibold text-gray-800">الحل: </span>
                                    <span className="text-gray-700">{example.solution}</span>
                                  </div>
                                )}
                                {example.explanation && (
                                  <div>
                                    <span className="font-semibold text-gray-800">الشرح: </span>
                                    <span className="text-gray-700">{example.explanation}</span>
                                  </div>
                                )}
                                {!example.problem && !example.solution && !example.explanation && (
                                  <p className="text-gray-700">
                                    {example.text || example.content || JSON.stringify(example)}
                                  </p>
                                )}
                              </>
                            )}
                          </Card>
                        ))}
                      </div>
                    );
                  })()}
                </div>

                {/* أزرار الإجراءات السريعة - الجديدة */}
                <div className="mt-8 p-6 bg-gray-50 rounded-lg">
                  <h3 className="text-lg font-bold mb-4">ابدأ التعلم التفاعلي</h3>

                  <div className="grid md:grid-cols-3 gap-4">
                    {/* زر الفصل التفاعلي */}
                    <button
                      onClick={() => router.push(`/classroom/${params.id}`)}
                      className="p-6 bg-white rounded-lg border-2 border-gray-200 hover:border-blue-500 hover:shadow-lg transition-all group"
                    >
                      <Play className="h-10 w-10 text-blue-500 mb-3 mx-auto group-hover:scale-110 transition-transform" />
                      <h4 className="font-bold text-lg mb-2">الفصل التفاعلي</h4>
                      <p className="text-sm text-gray-600">
                        شرائح تفاعلية مع شرح صوتي ومساعد ذكي
                      </p>
                    </button>

                    {/* زر التمارين */}
                    <button
                      onClick={() => router.push(`/exercises/${params.id}`)}
                      className="p-6 bg-white rounded-lg border-2 border-gray-200 hover:border-green-500 hover:shadow-lg transition-all group"
                    >
                      <PenTool className="h-10 w-10 text-green-500 mb-3 mx-auto group-hover:scale-110 transition-transform" />
                      <h4 className="font-bold text-lg mb-2">حل التمارين</h4>
                      <p className="text-sm text-gray-600">
                        تمارين تفاعلية مع تصحيح فوري وشرح
                      </p>
                    </button>

                    {/* زر المساعد الذكي */}
                    <button
                      onClick={() => {
                        // التوجيه للفصل التفاعلي حيث يوجد المساعد
                        router.push(`/classroom/${params.id}`);
                      }}
                      className="p-6 bg-white rounded-lg border-2 border-gray-200 hover:border-purple-500 hover:shadow-lg transition-all group"
                    >
                      <MessageCircle className="h-10 w-10 text-purple-500 mb-3 mx-auto group-hover:scale-110 transition-transform" />
                      <h4 className="font-bold text-lg mb-2">اسأل المساعد</h4>
                      <p className="text-sm text-gray-600">
                        احصل على إجابات فورية لأسئلتك
                      </p>
                    </button>
                  </div>
                </div>
              </Card>
            )}

            {activeTab === 'slides' && (
              <Card className="p-8 text-center">
                <Play className="h-16 w-16 text-blue-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">الشرائح التفاعلية</h3>
                <p className="text-gray-600 mb-4">
                  اضغط للبدء في عرض الشرائح التفاعلية للدرس
                </p>
                <Button
                  variant="primary"
                  onClick={() => router.push(`/classroom/${params.id}`)}
                >
                  بدء العرض
                </Button>
              </Card>
            )}

            {activeTab === 'quiz' && (
              <Card className="p-8 text-center">
                <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">اختبار الدرس</h3>
                <p className="text-gray-600 mb-4">
                  اختبر فهمك للدرس من خلال مجموعة من الأسئلة التفاعلية
                </p>
                <Button
                  variant="primary"
                  onClick={() => router.push(`/exercises/${params.id}`)}
                >
                  بدء الاختبار
                </Button>
              </Card>
            )}

            {activeTab === 'chat' && (
              <Card className="p-8 text-center">
                <MessageSquare className="h-16 w-16 text-purple-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">المساعد الذكي</h3>
                <p className="text-gray-600 mb-4">
                  اسأل المساعد الذكي عن أي شيء يتعلق بالدرس
                </p>
                <Button
                  variant="primary"
                  onClick={() => router.push(`/classroom/${params.id}`)}
                >
                  فتح المساعد
                </Button>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Lesson Info Card */}
            <Card className="p-6">
              <h3 className="font-semibold mb-4">معلومات الدرس</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-500">المادة</p>
                  <p className="font-medium">{lesson.unit.subject.nameAr}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">الوحدة</p>
                  <p className="font-medium">{lesson.unit.titleAr || lesson.unit.title}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">المدة</p>
                  <p className="font-medium">{lesson.duration || 45} دقيقة</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">المستوى</p>
                  <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getDifficultyColor(lesson.difficulty)}`}>
                    {lesson.difficulty === 'EASY' ? 'سهل' :
                     lesson.difficulty === 'HARD' ? 'صعب' : 'متوسط'}
                  </span>
                </div>
              </div>
            </Card>

            {/* Quick Actions */}
            <Card className="p-6">
              <h3 className="font-semibold mb-4">إجراءات سريعة</h3>
              <div className="space-y-2">
                <Button
                  variant="secondary"
                  className="w-full justify-start"
                  onClick={() => router.push(`/classroom/${params.id}`)}
                >
                  <Play className="h-4 w-4 ml-2" />
                  الفصل التفاعلي
                </Button>
                <Button
                  variant="secondary"
                  className="w-full justify-start"
                  onClick={() => router.push(`/exercises/${params.id}`)}
                >
                  <CheckCircle className="h-4 w-4 ml-2" />
                  حل التمارين
                </Button>
                <Button
                  variant="secondary"
                  className="w-full justify-start"
                  onClick={() => router.push(`/classroom/${params.id}`)}
                >
                  <MessageSquare className="h-4 w-4 ml-2" />
                  اسأل المساعد
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}