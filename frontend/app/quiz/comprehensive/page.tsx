'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/services/api';
import Button from '@/components/ui/Button';
import Card, { CardHeader, CardContent } from '@/components/ui/Card';
import { Trophy, BookOpen, Target, GraduationCap } from 'lucide-react';
import { motion } from 'framer-motion';

interface QuizTypeOption {
  id: 'comprehensive' | 'unit' | 'subject';
  title: string;
  description: string;
  icon: React.ReactNode;
  defaultQuestions: number;
  color: string;
  features: string[];
}

export default function ComprehensiveQuizPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [selectedType, setSelectedType] = useState<'comprehensive' | 'unit' | 'subject'>('comprehensive');
  const [maxQuestions, setMaxQuestions] = useState(30);
  const [difficulty, setDifficulty] = useState<'EASY' | 'MEDIUM' | 'HARD' | 'MIXED'>('MIXED');
  const [subjects, setSubjects] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedUnit, setSelectedUnit] = useState<string>('');

  const quizTypes: QuizTypeOption[] = [
    {
      id: 'comprehensive',
      title: 'اختبار شامل',
      description: 'اختبر معلوماتك في كل الدروس التي أكملتها',
      icon: <Trophy className="h-12 w-12 text-primary-600" />,
      defaultQuestions: 30,
      color: 'border-primary-500',
      features: [
        '30 سؤال متنوع',
        'من جميع الدروس المكتملة',
        'يحدد مستواك الحقيقي',
        'توزيع متوازن على الدروس'
      ]
    },
    {
      id: 'unit',
      title: 'اختبار Unit',
      description: 'اختبر معلوماتك في unit واحد فقط',
      icon: <BookOpen className="h-12 w-12 text-success-600" />,
      defaultQuestions: 15,
      color: 'border-success-500',
      features: [
        '15 سؤال',
        'من دروس unit واحد',
        'مراجعة مركزة',
        'تقييم متخصص'
      ]
    },
    {
      id: 'subject',
      title: 'اختبار مادة كاملة',
      description: 'اختبر معلوماتك في مادة كاملة',
      icon: <GraduationCap className="h-12 w-12 text-purple-600" />,
      defaultQuestions: 50,
      color: 'border-purple-500',
      features: [
        '50 سؤال شامل',
        'من جميع دروس المادة',
        'تقييم شامل',
        'استعداد للامتحان'
      ]
    }
  ];

  useEffect(() => {
    fetchSubjects();
  }, []);

  const fetchSubjects = async () => {
    try {
      const response = await api.get('/subjects');
      if (response.data.success) {
        setSubjects(response.data.data || []);
      }
    } catch (error) {
      console.error('Error fetching subjects:', error);
    }
  };

  const handleSubjectChange = async (subjectId: string) => {
    setSelectedSubject(subjectId);
    setSelectedUnit('');

    if (subjectId) {
      try {
        const response = await api.get(`/subjects/${subjectId}/units`);
        if (response.data.success) {
          setUnits(response.data.data || []);
        }
      } catch (error) {
        console.error('Error fetching units:', error);
      }
    } else {
      setUnits([]);
    }
  };

  const handleTypeChange = (type: 'comprehensive' | 'unit' | 'subject') => {
    setSelectedType(type);
    const selectedOption = quizTypes.find(q => q.id === type);
    if (selectedOption) {
      setMaxQuestions(selectedOption.defaultQuestions);
    }
  };

  const startQuiz = async () => {
    setLoading(true);
    try {
      let endpoint = '';
      const body: any = { maxQuestions, difficulty };

      switch (selectedType) {
        case 'comprehensive':
          endpoint = '/quiz/comprehensive/start';
          if (selectedSubject) {
            body.subjectId = selectedSubject;
          }
          break;

        case 'unit':
          if (!selectedUnit) {
            alert('يرجى اختيار الوحدة');
            setLoading(false);
            return;
          }
          endpoint = `/quiz/unit/${selectedUnit}/start`;
          break;

        case 'subject':
          if (!selectedSubject) {
            alert('يرجى اختيار المادة');
            setLoading(false);
            return;
          }
          endpoint = `/quiz/subject/${selectedSubject}/start`;
          break;
      }

      const response = await api.post(endpoint, body);

      if (response.data.success) {
        const { attemptId } = response.data.data;
        router.push(`/quiz/attempt/${attemptId}`);
      }
    } catch (error: any) {
      console.error('Error starting quiz:', error);
      alert(error.response?.data?.error?.message || 'فشل إنشاء الاختبار');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-purple-50 py-8">
      <div className="container mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-primary-600 to-purple-600 bg-clip-text text-transparent">
            اختبر نفسك
          </h1>
          <p className="text-gray-600 text-lg">
            اختر نوع الاختبار واختبر معلوماتك
          </p>
        </motion.div>

        {/* Quiz Type Selection */}
        <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto mb-8">
          {quizTypes.map((type, index) => (
            <motion.div
              key={type.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card
                className={`p-6 cursor-pointer transition-all hover:shadow-lg ${
                  selectedType === type.id ? `border-2 ${type.color} shadow-md` : 'border'
                }`}
                onClick={() => handleTypeChange(type.id)}
              >
                <CardContent>
                  <div className="flex justify-center mb-4">
                    {type.icon}
                  </div>
                  <h2 className="text-xl font-bold mb-2 text-center">{type.title}</h2>
                  <p className="text-gray-600 text-center mb-4 text-sm">
                    {type.description}
                  </p>
                  <ul className="space-y-2">
                    {type.features.map((feature, idx) => (
                      <li key={idx} className="text-sm text-gray-700 flex items-center">
                        <span className="text-success-500 mr-2">✓</span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Settings */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="p-6 max-w-4xl mx-auto mb-8">
            <h3 className="text-xl font-bold mb-4">إعدادات الاختبار</h3>

            <div className="grid md:grid-cols-2 gap-6">
              {/* اختيار المادة */}
              {(selectedType === 'comprehensive' || selectedType === 'subject') && (
                <div>
                  <label className="block text-sm font-medium mb-2">
                    المادة {selectedType === 'subject' && <span className="text-red-500">*</span>}
                  </label>
                  <select
                    value={selectedSubject}
                    onChange={(e) => handleSubjectChange(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="">
                      {selectedType === 'comprehensive' ? 'كل المواد' : 'اختر المادة'}
                    </option>
                    {subjects.map(subject => (
                      <option key={subject.id} value={subject.id}>
                        {subject.nameAr || subject.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* اختيار الوحدة */}
              {selectedType === 'unit' && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      المادة <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={selectedSubject}
                      onChange={(e) => handleSubjectChange(e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      <option value="">اختر المادة</option>
                      {subjects.map(subject => (
                        <option key={subject.id} value={subject.id}>
                          {subject.nameAr || subject.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      الوحدة <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={selectedUnit}
                      onChange={(e) => setSelectedUnit(e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      disabled={!selectedSubject}
                    >
                      <option value="">اختر الوحدة</option>
                      {units.map(unit => (
                        <option key={unit.id} value={unit.id}>
                          {unit.titleAr || unit.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {/* عدد الأسئلة */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  عدد الأسئلة
                </label>
                <input
                  type="number"
                  value={maxQuestions}
                  onChange={(e) => setMaxQuestions(parseInt(e.target.value))}
                  min={5}
                  max={selectedType === 'subject' ? 100 : selectedType === 'unit' ? 50 : 100}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  بين 5 و {selectedType === 'subject' ? '100' : selectedType === 'unit' ? '50' : '100'} سؤال
                </p>
              </div>

              {/* مستوى الصعوبة */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  مستوى الصعوبة
                </label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as any)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="MIXED">متنوع (مختلط)</option>
                  <option value="EASY">سهل</option>
                  <option value="MEDIUM">متوسط</option>
                  <option value="HARD">صعب</option>
                </select>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Start Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-center"
        >
          <Button
            onClick={startQuiz}
            loading={loading}
            size="lg"
            className="px-12 py-4 text-lg shadow-lg hover:shadow-xl transition-shadow"
          >
            <Target className="h-6 w-6 mr-2" />
            {loading ? 'جاري الإنشاء...' : 'ابدأ الاختبار'}
          </Button>

          <p className="text-sm text-gray-600 mt-4">
            💡 تأكد من أنك في مكان هادئ ولديك الوقت الكافي
          </p>
        </motion.div>

        {/* Info Box */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="max-w-2xl mx-auto mt-8"
        >
          <Card className="p-6 bg-gradient-to-r from-primary-50 to-purple-50">
            <CardContent>
              <h4 className="font-bold mb-2 flex items-center">
                <span className="text-2xl mr-2">💪</span>
                نصائح للنجاح
              </h4>
              <ul className="space-y-2 text-sm text-gray-700">
                <li>• اقرأ كل سؤال بعناية قبل الإجابة</li>
                <li>• لا تتسرع - خذ وقتك في التفكير</li>
                <li>• إذا لم تعرف الإجابة، انتقل للسؤال التالي وعد لاحقاً</li>
                <li>• ثق بنفسك وقدراتك!</li>
              </ul>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}