'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CheckCircle, XCircle, RefreshCw, Award, ChevronLeft } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import api from '@/services/api';
import { useActivityTracker } from '@/hooks/useActivityTracker';

// Type definitions
interface ApiResponse {
  success: boolean;
  data?: any;
  message?: string;
}

interface Question {
  id: string;
  question: string;
  type: 'MCQ' | 'TRUE_FALSE' | 'FILL_BLANK' | 'SHORT_ANSWER' | 'PROBLEM' | 'ESSAY';
  options?: string[];
  correctAnswer: string;
  explanation?: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  points?: number;
}

export default function ExercisesPage() {
  const params = useParams();
  const router = useRouter();
  const lessonId = params.lessonId as string;

  // State بسيط
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [score, setScore] = useState(0);
  const [totalAnswered, setTotalAnswered] = useState(0);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [startTime, setStartTime] = useState<Date>(new Date());
  const [questionStartTime, setQuestionStartTime] = useState<Date>(new Date());
  const [totalTimeSpent, setTotalTimeSpent] = useState(0);
  const [lesson, setLesson] = useState<any>(null);

  const currentQuestion = questions[currentIndex];
  const { trackQuizAnswer } = useActivityTracker();

  // Load questions on mount
  useEffect(() => {
    loadQuestions();
    loadLessonInfo();
    setStartTime(new Date());
    setQuestionStartTime(new Date());
  }, [lessonId]);

  // Load lesson info
  const loadLessonInfo = async () => {
    try {
      const response = await api.get(`/lessons/${lessonId}`);
      const responseData = response.data as any;
      if (responseData?.success) {
        setLesson(responseData.data);
      }
    } catch (error) {
      console.error('Error loading lesson:', error);
    }
  };

  // تحميل أو توليد الأسئلة
  const loadQuestions = async () => {
    try {
      setLoading(true);

      // بما أنه لا يوجد endpoint للحصول على أسئلة موجودة، ولّد مباشرة
      await generateNewQuestions();

    } catch (error) {
      console.error('Error loading questions:', error);
      // استخدم أسئلة تجريبية
      setDefaultQuestions();
    } finally {
      setLoading(false);
    }
  };

  // توليد أسئلة جديدة
  const generateNewQuestions = async () => {
    try {
      setGenerating(true);

      // استخدم quiz generation endpoint
      const response = await api.post<ApiResponse>(`/quiz/generate`, {
        lessonId: lessonId,
        count: 10,
        difficulty: 'MEDIUM', // استخدم MEDIUM بدلاً من MIXED
        adaptive: true
      });

      if (response.data?.success && response.data.data?.questions) {
        const formattedQuestions = response.data.data.questions.map((q: any) => ({
          id: q.id || Math.random().toString(),
          question: q.question,
          type: q.type || 'MCQ',
          options: q.options || [],
          correctAnswer: String(q.correctAnswer || '0'),
          explanation: q.explanation || '',
          difficulty: q.difficulty || 'MEDIUM'
        }));
        setQuestions(formattedQuestions);
      } else {
        setDefaultQuestions();
      }
    } catch (error) {
      console.error('Error generating questions:', error);
      setDefaultQuestions();
    } finally {
      setGenerating(false);
    }
  };

  // أسئلة افتراضية للتجربة
  const setDefaultQuestions = () => {
    setQuestions([
      {
        id: '1',
        question: 'ما هو الناتج من 5 + 3؟',
        type: 'MCQ',
        options: ['6', '7', '8', '9'],
        correctAnswer: '2',
        explanation: '5 + 3 = 8',
        difficulty: 'EASY'
      },
      {
        id: '2',
        question: 'العدد 10 أكبر من العدد 5',
        type: 'TRUE_FALSE',
        correctAnswer: 'true',
        explanation: '10 > 5 هذه عبارة صحيحة',
        difficulty: 'EASY'
      },
      {
        id: '3',
        question: 'أي من التالي يساوي 15؟',
        type: 'MCQ',
        options: ['7 + 7', '8 + 7', '9 + 5', '6 + 8'],
        correctAnswer: '1',
        explanation: '8 + 7 = 15',
        difficulty: 'MEDIUM'
      },
      {
        id: '4',
        question: 'الضرب هو عملية تبديلية',
        type: 'TRUE_FALSE',
        correctAnswer: 'true',
        explanation: '3 × 4 = 4 × 3 = 12',
        difficulty: 'MEDIUM'
      },
      {
        id: '5',
        question: 'ما هو ناتج 12 ÷ 3؟',
        type: 'MCQ',
        options: ['2', '3', '4', '6'],
        correctAnswer: '2',
        explanation: '12 ÷ 3 = 4',
        difficulty: 'EASY'
      }
    ]);
  };

  // التحقق من الإجابة
  const checkAnswer = async () => {
    const normalizedAnswer = selectedAnswer.trim();
    const normalizedCorrect = String(currentQuestion.correctAnswer).trim();

    // Calculate time spent on this question
    const timeSpent = Math.round((new Date().getTime() - questionStartTime.getTime()) / 1000);

    let correct = false;

    switch (currentQuestion.type) {
      case 'TRUE_FALSE':
        correct = normalizedAnswer === normalizedCorrect ||
                 (normalizedAnswer === 'صح' && ['true', 'صح', 'صحيح', '1'].includes(normalizedCorrect)) ||
                 (normalizedAnswer === 'خطأ' && ['false', 'خطأ', 'خاطئ', '0'].includes(normalizedCorrect)) ||
                 (normalizedAnswer === 'true' && normalizedCorrect === 'true') ||
                 (normalizedAnswer === 'false' && normalizedCorrect === 'false');
        break;

      case 'MCQ':
        if (currentQuestion.options) {
          correct = normalizedAnswer === normalizedCorrect;
        }
        break;

      case 'FILL_BLANK':
      case 'SHORT_ANSWER':
        // مقارنة مرنة للنصوص
        correct = normalizedAnswer.toLowerCase() === normalizedCorrect.toLowerCase() ||
                  normalizedAnswer.replace(/\s+/g, '') === normalizedCorrect.replace(/\s+/g, '');
        break;

      case 'PROBLEM':
        // للمسائل الحسابية - قارن الأرقام
        const userNum = parseFloat(normalizedAnswer);
        const correctNum = parseFloat(normalizedCorrect);
        if (!isNaN(userNum) && !isNaN(correctNum)) {
          correct = Math.abs(userNum - correctNum) < 0.01;
        } else {
          correct = normalizedAnswer === normalizedCorrect;
        }
        break;

      case 'ESSAY':
        // للمقالي - اعتبرها صحيحة إذا كتب 50+ حرف
        correct = normalizedAnswer.length >= 50;
        break;

      default:
        correct = normalizedAnswer === normalizedCorrect;
    }

    setIsCorrect(correct);
    setShowResult(true);
    setTotalAnswered(totalAnswered + 1);
    setTotalTimeSpent(totalTimeSpent + timeSpent);

    if (correct) {
      setScore(score + (currentQuestion.points || 1));
    }

    // Track the answer using the hook
    try {
      await trackQuizAnswer(
        currentQuestion.id,
        normalizedAnswer,
        correct,
        timeSpent,
        lesson?.subject?.name || 'Math'
      );
    } catch (error) {
      console.log('Answer tracking error:', error);
    }
  };

  // الانتقال للسؤال التالي
  const nextQuestion = async () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setSelectedAnswer('');
      setShowResult(false);
      setIsCorrect(false);
      setQuestionStartTime(new Date());
    } else {
      // Quiz completed - track the completion
      await completeQuiz();
    }
  };

  // Complete quiz and track
  const completeQuiz = async () => {
    const percentage = Math.round((score / questions.length) * 100);

    // Track exercise completion
    try {
      const response = await api.post('/quiz/exercises/track', {
        lessonId,
        totalQuestions: questions.length,
        correctAnswers: score,
        timeSpent: totalTimeSpent
      });

      if (response.data?.success) {
        const result = response.data;

        // Show detailed results
        alert(`
🎉 انتهيت من التمارين!

النتيجة: ${score} من ${questions.length}
النسبة: ${percentage}%

${percentage >= 80 ? '🌟 ممتاز! أداء رائع!' :
  percentage >= 60 ? '👍 جيد! استمر في التحسن!' :
  '📚 تحتاج مزيد من المذاكرة'}

📊 إحصائياتك الإجمالية:
• إجابات صحيحة: ${result.data?.context?.totalCorrectAnswers || score}
• معدل النجاح: ${result.data?.context?.averageScore || percentage}%
• السلسلة الحالية: ${result.data?.context?.streakCount || 0} تمرين
        `);
      } else {
        // Show basic results if tracking fails
        alert(`
🎉 انتهيت من التمارين!

النتيجة: ${score} من ${questions.length}
النسبة: ${percentage}%

${percentage >= 80 ? '🌟 ممتاز! أداء رائع!' :
  percentage >= 60 ? '👍 جيد! استمر في التحسن!' :
  '📚 تحتاج مزيد من المذاكرة'}
        `);
      }
    } catch (error) {
      console.error('Error tracking exercise completion:', error);
      // Show basic results
      alert(`
🎉 انتهيت من التمارين!

النتيجة: ${score} من ${questions.length}
النسبة: ${percentage}%
      `);
    }

    // Navigate back to lesson
    setTimeout(() => {
      router.push(`/lesson/${lessonId}`);
    }, 2000);
  };

  // إعادة تحميل أسئلة جديدة
  const refreshQuestions = () => {
    setCurrentIndex(0);
    setScore(0);
    setTotalAnswered(0);
    setSelectedAnswer('');
    setShowResult(false);
    generateNewQuestions();
  };

  // Loading
  if (loading || generating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-lg">{generating ? 'جاري توليد تمارين ذكية...' : 'جاري التحميل...'}</p>
        </div>
      </div>
    );
  }

  // No questions
  if (!currentQuestion) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="p-8 text-center">
          <p className="mb-4 text-gray-600">لا توجد تمارين متاحة</p>
          <Button onClick={generateNewQuestions} variant="primary">
            توليد تمارين
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex justify-between items-center">
          <Button variant="ghost" onClick={() => router.back()}>
            <ChevronLeft className="h-4 w-4 ml-2" />
            رجوع
          </Button>

          <h1 className="text-2xl font-bold">التمارين التفاعلية</h1>

          <Button variant="outline" onClick={refreshQuestions}>
            <RefreshCw className="h-4 w-4 ml-2" />
            تمارين جديدة
          </Button>
        </div>

        {/* Progress */}
        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>السؤال {currentIndex + 1} من {questions.length}</span>
            <span className="flex items-center">
              <Award className="h-4 w-4 ml-1 text-yellow-500" />
              النقاط: {score} / {totalAnswered}
            </span>
          </div>

          {/* Progress bar */}
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-500 transition-all duration-300"
              style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Question Card */}
        <Card className="p-6">
          {/* Difficulty badge */}
          <div className="mb-4">
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
              currentQuestion.difficulty === 'EASY'
                ? 'bg-green-100 text-green-700'
                : currentQuestion.difficulty === 'MEDIUM'
                ? 'bg-yellow-100 text-yellow-700'
                : 'bg-red-100 text-red-700'
            }`}>
              {currentQuestion.difficulty === 'EASY' ? 'سهل' :
               currentQuestion.difficulty === 'MEDIUM' ? 'متوسط' : 'صعب'}
            </span>
          </div>

          {/* Question text */}
          <h2 className="text-xl mb-6 font-medium">{currentQuestion.question}</h2>

          {/* Answer Options */}
          {!showResult && (
            <div className="space-y-3">
              {currentQuestion.type === 'MCQ' && currentQuestion.options ? (
                currentQuestion.options.map((option, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedAnswer(String(index))}
                    className={`w-full text-right p-4 rounded-lg border-2 transition-all ${
                      selectedAnswer === String(index)
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <span className="font-medium">{option}</span>
                  </button>
                ))
              ) : currentQuestion.type === 'TRUE_FALSE' ? (
                <div className="flex gap-4">
                  <button
                    onClick={() => setSelectedAnswer('true')}
                    className={`flex-1 p-4 rounded-lg border-2 transition-all ${
                      selectedAnswer === 'true'
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    ✓ صح
                  </button>
                  <button
                    onClick={() => setSelectedAnswer('false')}
                    className={`flex-1 p-4 rounded-lg border-2 transition-all ${
                      selectedAnswer === 'false'
                        ? 'border-red-500 bg-red-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    ✗ خطأ
                  </button>
                </div>
              ) : (() => {
                // كشف الأسئلة الحسابية من النص
                const isMathQuestion =
                  currentQuestion.question.includes('احسب') ||
                  currentQuestion.question.includes('كم') ||
                  currentQuestion.question.includes('ناتج') ||
                  currentQuestion.question.includes('حاصل') ||
                  currentQuestion.question.includes('+') ||
                  currentQuestion.question.includes('-') ||
                  currentQuestion.question.includes('×') ||
                  currentQuestion.question.includes('÷') ||
                  currentQuestion.question.includes('*') ||
                  currentQuestion.question.includes('/') ||
                  /\d+\s*[+\-×÷*/]\s*\d+/.test(currentQuestion.question) ||
                  currentQuestion.type === 'PROBLEM';

                // Math questions - show number input
                if (isMathQuestion) {
                  return (
                    <div className="space-y-2">
                      <input
                        type="number"
                        value={selectedAnswer}
                        onChange={(e) => setSelectedAnswer(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && selectedAnswer) {
                            checkAnswer();
                          }
                        }}
                        placeholder="أدخل الإجابة الرقمية..."
                        className="w-full p-4 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none text-center text-2xl"
                        dir="ltr"
                        autoFocus
                        disabled={showResult}
                      />
                      <p className="text-sm text-gray-500 text-center">اضغط Enter للتحقق</p>
                    </div>
                  );
                }

                // Default text input for other types
                return (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={selectedAnswer}
                      onChange={(e) => setSelectedAnswer(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && selectedAnswer) {
                          checkAnswer();
                        }
                      }}
                      placeholder={
                        currentQuestion.type === 'FILL_BLANK' ? 'أكمل الفراغ...' :
                        currentQuestion.type === 'SHORT_ANSWER' ? 'اكتب إجابتك القصيرة...' :
                        currentQuestion.type === 'ESSAY' ? 'اكتب إجابتك المفصلة...' :
                        'أدخل إجابتك...'
                      }
                      className="w-full p-4 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none text-right"
                      dir="rtl"
                      autoFocus
                      disabled={showResult}
                    />
                    {currentQuestion.type === 'ESSAY' && (
                      <p className="text-sm text-gray-500">الحد الأدنى: 50 حرف</p>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Result Display */}
          {showResult && (
            <div className="space-y-3">
              {currentQuestion.type === 'MCQ' && currentQuestion.options ? (
                currentQuestion.options.map((option, index) => (
                  <div
                    key={index}
                    className={`w-full text-right p-4 rounded-lg border-2 ${
                      String(index) === currentQuestion.correctAnswer
                        ? 'border-green-500 bg-green-50'
                        : selectedAnswer === String(index)
                        ? 'border-red-500 bg-red-50'
                        : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center">
                      <span className="flex-1">{option}</span>
                      {String(index) === currentQuestion.correctAnswer && (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      )}
                      {selectedAnswer === String(index) && String(index) !== currentQuestion.correctAnswer && (
                        <XCircle className="h-5 w-5 text-red-600" />
                      )}
                    </div>
                  </div>
                ))
              ) : currentQuestion.type === 'TRUE_FALSE' ? (
                <div className="flex gap-4">
                  <div className={`flex-1 p-4 rounded-lg border-2 ${
                    (selectedAnswer === 'صح' || selectedAnswer === 'true') && isCorrect ? 'border-green-500 bg-green-50' :
                    (selectedAnswer === 'صح' || selectedAnswer === 'true') && !isCorrect ? 'border-red-500 bg-red-50' :
                    (currentQuestion.correctAnswer === 'true' || currentQuestion.correctAnswer === 'صح') ? 'border-green-500 bg-green-50' :
                    'border-gray-200'
                  }`}>
                    ✓ صح
                  </div>
                  <div className={`flex-1 p-4 rounded-lg border-2 ${
                    (selectedAnswer === 'خطأ' || selectedAnswer === 'false') && isCorrect ? 'border-green-500 bg-green-50' :
                    (selectedAnswer === 'خطأ' || selectedAnswer === 'false') && !isCorrect ? 'border-red-500 bg-red-50' :
                    (currentQuestion.correctAnswer === 'false' || currentQuestion.correctAnswer === 'خطأ') ? 'border-green-500 bg-green-50' :
                    'border-gray-200'
                  }`}>
                    ✗ خطأ
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className={`p-4 rounded-lg border-2 ${
                    isCorrect ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'
                  }`}>
                    <p className="font-medium">إجابتك: {selectedAnswer}</p>
                  </div>
                  {!isCorrect && currentQuestion.correctAnswer && (
                    <div className="p-4 rounded-lg border-2 border-green-500 bg-green-50">
                      <p className="font-medium">الإجابة الصحيحة: {currentQuestion.correctAnswer}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Result feedback */}
          {showResult && (
            <div className={`mt-6 p-4 rounded-lg ${
              isCorrect
                ? 'bg-green-50 border border-green-200'
                : 'bg-red-50 border border-red-200'
            }`}>
              <div className="flex items-center mb-2">
                {isCorrect ? (
                  <>
                    <CheckCircle className="h-5 w-5 text-green-600 ml-2" />
                    <span className="font-bold text-green-800">إجابة صحيحة! 🎉</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 text-red-600 ml-2" />
                    <span className="font-bold text-red-800">إجابة خاطئة</span>
                  </>
                )}
              </div>

              {currentQuestion.explanation && (
                <p className="text-sm text-gray-700">
                  <strong>الشرح:</strong> {currentQuestion.explanation}
                </p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="mt-6 flex justify-center">
            {!showResult ? (
              <Button
                variant="primary"
                onClick={checkAnswer}
                disabled={!selectedAnswer}
                size="lg"
              >
                تحقق من الإجابة
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={nextQuestion}
                size="lg"
              >
                {currentIndex < questions.length - 1 ? 'السؤال التالي' : 'إنهاء التمارين'}
              </Button>
            )}
          </div>
        </Card>

        {/* Score Summary */}
        {totalAnswered > 0 && (
          <div className="mt-6 text-center text-gray-600">
            <p className="text-sm">
              معدل النجاح الحالي: {Math.round((score / totalAnswered) * 100)}%
            </p>
          </div>
        )}
      </div>
    </div>
  );
}