'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/services/api';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Loading from '@/components/ui/Loading';
import {
  CheckCircle, XCircle, Clock, Award, AlertCircle,
  Flag, ChevronLeft, ChevronRight, List
} from 'lucide-react';

interface Question {
  id: string;
  question: string;
  type: string;
  options?: string[];
  correctAnswer: string;
  explanation?: string;
}

interface QuestionStatus {
  answered: boolean;
  flagged: boolean;
  answer?: string;
}

export default function QuizAttemptPage() {
  const params = useParams();
  const router = useRouter();
  const attemptId = params.attemptId as string;

  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [questionStatus, setQuestionStatus] = useState<Record<number, QuestionStatus>>({});
  const [showSummary, setShowSummary] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [startTime] = useState(Date.now());
  const [error, setError] = useState('');

  // ✅ دالة ذكية لتحديد نوع السؤال
  const detectQuestionType = (question: Question): string => {
    const q = question.question.toLowerCase();

    // 1. تحقق من TRUE_FALSE
    if (
      question.type === 'TRUE_FALSE' ||
      q.includes('صح أم خطأ') ||
      q.includes('صح او خطأ') ||
      q.includes('صحيح أم خاطئ') ||
      q.includes('هل') ||
      (q.includes('يقبل القسمة') && !question.options) ||
      (q.includes('العدد') && q.includes('على') && !question.options)
    ) {
      return 'TRUE_FALSE';
    }

    // 2. تحقق من MCQ
    if (question.options && question.options.length > 2) {
      return 'MCQ';
    }

    // 3. تحقق من FILL_BLANK
    if (
      question.type === 'FILL_BLANK' ||
      q.includes('أكمل') ||
      q.includes('___') ||
      q.includes('املأ الفراغ')
    ) {
      return 'FILL_BLANK';
    }

    // 4. Default: SHORT_ANSWER
    return question.type || 'SHORT_ANSWER';
  };

  useEffect(() => {
    fetchQuizDetails();
  }, [attemptId]);

  const fetchQuizDetails = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/quiz/${attemptId}/details`);

      if (response.data.success) {
        const quizData = response.data.data;
        const rawQuestions = quizData.questions || [];

        // ✅ Filter invalid questions
        const validRawQuestions = rawQuestions.filter((q: any) => {
          const question = q.question || '';
          if (!question || question.length < 10) return false;
          if (question.includes('[') || question.includes(']')) return false;
          if (!q.correctAnswer) return false;
          return true;
        });

        // تحويل options من string إلى array إذا لزم الأمر
        const processedQuestions = validRawQuestions.map((q: any) => ({
          ...q,
          options: typeof q.options === 'string'
            ? JSON.parse(q.options)
            : (Array.isArray(q.options) ? q.options : [])
        }));

        console.log(`✅ Frontend: ${rawQuestions.length} received, ${processedQuestions.length} valid`);

        setQuestions(processedQuestions);

        // Initialize question status
        const initialStatus: Record<number, QuestionStatus> = {};
        processedQuestions.forEach((_: any, index: number) => {
          initialStatus[index] = { answered: false, flagged: false };
        });
        setQuestionStatus(initialStatus);

        if (processedQuestions.length === 0) {
          setError('لا توجد أسئلة صالحة في هذا الاختبار');
        }
      } else {
        setError('فشل تحميل الاختبار');
      }
    } catch (error: any) {
      console.error('Error fetching quiz:', error);
      setError(error.response?.data?.error?.message || 'فشل تحميل الاختبار');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = (answer: string) => {
    setQuestionStatus({
      ...questionStatus,
      [currentIndex]: {
        ...questionStatus[currentIndex],
        answered: true,
        answer
      }
    });
  };

  const toggleFlag = () => {
    setQuestionStatus({
      ...questionStatus,
      [currentIndex]: {
        ...questionStatus[currentIndex],
        flagged: !questionStatus[currentIndex].flagged
      }
    });
  };

  const goToQuestion = (index: number) => {
    setCurrentIndex(index);
    setShowSummary(false);
  };

  const nextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setShowSummary(true);
    }
  };

  const previousQuestion = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const skipQuestion = () => {
    nextQuestion();
  };

  const submitQuiz = async () => {
    const timeSpent = Math.floor((Date.now() - startTime) / 1000);

    let correctCount = 0;
    questions.forEach((q, index) => {
      const status = questionStatus[index];
      if (status?.answered && status.answer === q.correctAnswer) {
        correctCount++;
      }
    });

    setScore(correctCount);
    setShowResult(true);

    try {
      await api.post(`/quiz/complete/${attemptId}`, {
        answers: Object.entries(questionStatus)
          .filter(([_, status]) => status.answered)
          .map(([index, status]) => ({
            questionId: questions[parseInt(index)].id,
            answer: status.answer || '',
            timeSpent: Math.floor(timeSpent / questions.length)
          }))
      });
    } catch (error) {
      console.error('Error submitting quiz:', error);
    }
  };

  // Summary Stats
  const getStats = () => {
    const answered = Object.values(questionStatus).filter(s => s.answered).length;
    const flagged = Object.values(questionStatus).filter(s => s.flagged).length;
    const skipped = questions.length - answered;
    return { answered, flagged, skipped };
  };

  if (loading) {
    return <Loading fullScreen text="جاري تحميل الاختبار..." />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-purple-50 flex items-center justify-center p-4">
        <Card className="p-8 max-w-md text-center">
          <AlertCircle className="h-16 w-16 text-error-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">خطأ</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <Button onClick={() => router.push('/quiz/comprehensive')} variant="primary">
            العودة
          </Button>
        </Card>
      </div>
    );
  }

  if (showResult) {
    const percentage = Math.round((score / questions.length) * 100);
    const passed = percentage >= 60;
    const stats = getStats();

    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-purple-50 py-8">
        <div className="container mx-auto px-4 max-w-2xl">
          <Card className="p-8 text-center">
            <div className="mb-6">
              {passed ? (
                <Award className="h-20 w-20 text-success-600 mx-auto" />
              ) : (
                <XCircle className="h-20 w-20 text-error-600 mx-auto" />
              )}
            </div>

            <h1 className="text-3xl font-bold mb-4">
              {passed ? '🎉 أحسنت!' : '📚 حاول مرة أخرى'}
            </h1>

            <div className="mb-8">
              <div className="text-6xl font-bold text-primary-600 mb-2">
                {percentage}%
              </div>
              <p className="text-gray-600 mb-4">
                {score} من {questions.length} إجابة صحيحة
              </p>

              {/* إحصائيات إضافية */}
              <div className="grid grid-cols-3 gap-4 mt-6 text-sm">
                <div className="bg-success-50 p-3 rounded">
                  <div className="font-bold text-success-700">{stats.answered}</div>
                  <div className="text-success-600">مُجاب</div>
                </div>
                <div className="bg-warning-50 p-3 rounded">
                  <div className="font-bold text-warning-700">{stats.flagged}</div>
                  <div className="text-warning-600">معلّم</div>
                </div>
                <div className="bg-gray-100 p-3 rounded">
                  <div className="font-bold text-gray-700">{stats.skipped}</div>
                  <div className="text-gray-600">متخطى</div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <Button onClick={() => router.push('/quiz/comprehensive')} variant="primary" className="w-full">
                اختبار جديد
              </Button>
              <Button onClick={() => router.push('/progress')} variant="outline" className="w-full">
                مراجعة الأخطاء
              </Button>
              <Button onClick={() => router.push('/dashboard')} variant="outline" className="w-full">
                العودة للرئيسية
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // Summary View
  if (showSummary) {
    const stats = getStats();
    const unanswered = questions.map((_, idx) => ({ idx, status: questionStatus[idx] }))
      .filter(({ status }) => !status?.answered);
    const flaggedQuestions = questions.map((_, idx) => ({ idx, status: questionStatus[idx] }))
      .filter(({ status }) => status?.flagged);

    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-purple-50 py-8">
        <div className="container mx-auto px-4 max-w-4xl">
          <Card className="p-8">
            <h1 className="text-3xl font-bold mb-6 text-center">ملخص الاختبار</h1>

            {/* إحصائيات */}
            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <div className="bg-success-50 p-6 rounded-lg text-center">
                <CheckCircle className="h-10 w-10 text-success-600 mx-auto mb-2" />
                <div className="text-3xl font-bold text-success-700 mb-1">{stats.answered}</div>
                <div className="text-success-600">أسئلة مُجابة</div>
              </div>
              <div className="bg-warning-50 p-6 rounded-lg text-center">
                <Flag className="h-10 w-10 text-warning-600 mx-auto mb-2" />
                <div className="text-3xl font-bold text-warning-700 mb-1">{stats.flagged}</div>
                <div className="text-warning-600">أسئلة معلّمة</div>
              </div>
              <div className="bg-gray-100 p-6 rounded-lg text-center">
                <AlertCircle className="h-10 w-10 text-gray-600 mx-auto mb-2" />
                <div className="text-3xl font-bold text-gray-700 mb-1">{stats.skipped}</div>
                <div className="text-gray-600">أسئلة متخطاة</div>
              </div>
            </div>

            {/* تحذيرات */}
            {unanswered.length > 0 && (
              <div className="bg-error-50 border border-error-200 rounded-lg p-4 mb-6">
                <div className="flex items-start">
                  <AlertCircle className="h-5 w-5 text-error-600 mt-0.5 mr-3" />
                  <div>
                    <p className="font-bold text-error-800 mb-2">
                      لديك {unanswered.length} أسئلة لم تُجب عليها
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {unanswered.slice(0, 10).map(({ idx }) => (
                        <button
                          key={idx}
                          onClick={() => goToQuestion(idx)}
                          className="px-3 py-1 bg-white border border-error-300 rounded text-sm hover:bg-error-100"
                        >
                          السؤال {idx + 1}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {flaggedQuestions.length > 0 && (
              <div className="bg-warning-50 border border-warning-200 rounded-lg p-4 mb-6">
                <div className="flex items-start">
                  <Flag className="h-5 w-5 text-warning-600 mt-0.5 mr-3" />
                  <div>
                    <p className="font-bold text-warning-800 mb-2">
                      أسئلة معلّمة للمراجعة ({flaggedQuestions.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {flaggedQuestions.map(({ idx }) => (
                        <button
                          key={idx}
                          onClick={() => goToQuestion(idx)}
                          className="px-3 py-1 bg-white border border-warning-300 rounded text-sm hover:bg-warning-100"
                        >
                          السؤال {idx + 1}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* خريطة الأسئلة */}
            <div className="mb-8">
              <h3 className="font-bold mb-4">خريطة الأسئلة</h3>
              <div className="grid grid-cols-10 gap-2">
                {questions.map((_, idx) => {
                  const status = questionStatus[idx];
                  return (
                    <button
                      key={idx}
                      onClick={() => goToQuestion(idx)}
                      className={`relative p-3 rounded text-sm font-medium transition ${
                        status?.answered
                          ? 'bg-success-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      {idx + 1}
                      {status?.flagged && (
                        <Flag className="absolute top-0 right-0 h-3 w-3 text-warning-500" fill="currentColor" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* أزرار */}
            <div className="flex gap-4">
              <Button onClick={() => setShowSummary(false)} variant="outline" className="flex-1">
                <ChevronRight className="h-4 w-4 ml-2" />
                العودة للأسئلة
              </Button>
              <Button onClick={submitQuiz} variant="primary" className="flex-1">
                إنهاء الاختبار
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  if (!currentQuestion) {
    return <div className="min-h-screen flex items-center justify-center"><Loading /></div>;
  }

  const currentStatus = questionStatus[currentIndex];
  const currentAnswer = currentStatus?.answer;
  const stats = getStats();

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-purple-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Header with Stats */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                السؤال {currentIndex + 1} من {questions.length}
              </span>
              <Button
                onClick={() => setShowSummary(true)}
                variant="outline"
                size="sm"
              >
                <List className="h-4 w-4 mr-2" />
                الملخص
              </Button>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-success-600">✓ {stats.answered}</span>
              <span className="text-warning-600">⚑ {stats.flagged}</span>
              <span className="text-gray-600">
                <Clock className="inline h-4 w-4 mr-1" />
                {Math.floor((Date.now() - startTime) / 1000 / 60)}د
              </span>
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-primary-600 h-2 rounded-full transition-all"
              style={{ width: `${(stats.answered / questions.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Question Card */}
        <Card className="p-8 mb-6">
          <div className="flex justify-between items-start mb-6">
            <h2 className="text-2xl font-bold flex-1">{currentQuestion.question}</h2>
            <button
              onClick={toggleFlag}
              className={`p-2 rounded transition ${
                currentStatus?.flagged
                  ? 'text-warning-600 bg-warning-50'
                  : 'text-gray-400 hover:text-warning-600 hover:bg-warning-50'
              }`}
              title={currentStatus?.flagged ? 'إزالة العلامة' : 'وضع علامة'}
            >
              <Flag className="h-6 w-6" fill={currentStatus?.flagged ? 'currentColor' : 'none'} />
            </button>
          </div>

          <div className="space-y-3">
            {/* MCQ & TRUE_FALSE */}
            {detectQuestionType(currentQuestion) === 'TRUE_FALSE' ? (
              <>
                <button
                  onClick={() => handleAnswer('true')}
                  className={`w-full p-4 text-right rounded-lg border-2 transition ${
                    currentAnswer === 'true'
                      ? 'border-primary-600 bg-primary-50'
                      : 'border-gray-300 hover:border-primary-300'
                  }`}
                >
                  ✓ صح
                </button>
                <button
                  onClick={() => handleAnswer('false')}
                  className={`w-full p-4 text-right rounded-lg border-2 transition ${
                    currentAnswer === 'false'
                      ? 'border-primary-600 bg-primary-50'
                      : 'border-gray-300 hover:border-primary-300'
                  }`}
                >
                  ✗ خطأ
                </button>
              </>
            ) : detectQuestionType(currentQuestion) === 'MCQ' && currentQuestion.options ? (
              currentQuestion.options.map((option, index) => (
                <button
                  key={index}
                  onClick={() => handleAnswer(index.toString())}
                  className={`w-full p-4 text-right rounded-lg border-2 transition ${
                    currentAnswer === index.toString()
                      ? 'border-primary-600 bg-primary-50'
                      : 'border-gray-300 hover:border-primary-300'
                  }`}
                >
                  {option}
                </button>
              ))
            ) : (
              /* SHORT_ANSWER & FILL_BLANK */
              <div>
                <input
                  type="text"
                  value={currentAnswer || ''}
                  onChange={(e) => handleAnswer(e.target.value)}
                  placeholder="اكتب إجابتك هنا..."
                  className="w-full p-4 border-2 border-gray-300 rounded-lg focus:border-primary-600 focus:outline-none text-lg"
                  autoFocus
                />
                <p className="text-sm text-gray-500 mt-2">
                  اكتب إجابتك ثم اضغط التالي
                </p>
              </div>
            )}
          </div>
        </Card>

        {/* Navigation */}
        <div className="flex gap-4">
          <Button
            onClick={previousQuestion}
            disabled={currentIndex === 0}
            variant="outline"
          >
            <ChevronRight className="h-4 w-4 ml-2" />
            السابق
          </Button>

          <Button
            onClick={skipQuestion}
            variant="outline"
            className="flex-1"
          >
            تخطي
          </Button>

          <Button
            onClick={nextQuestion}
            variant="primary"
            className="flex-1"
            disabled={!currentAnswer && currentQuestion.type !== 'SHORT_ANSWER' && currentQuestion.type !== 'FILL_BLANK'}
          >
            {currentIndex === questions.length - 1 ? 'الملخص' : 'التالي'}
            <ChevronLeft className="h-4 w-4 mr-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}