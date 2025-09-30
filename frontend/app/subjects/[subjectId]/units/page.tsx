'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChevronRight, BookOpen, Clock, ChevronDown, Layers } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { API_BASE_URL } from '@/config/api.config';

interface Lesson {
  id: string;
  title: string;
  titleAr: string;
  titleEn: string;
  order: number;
  duration: number;
  difficulty: string;
}

interface Unit {
  id: string;
  title: string;
  titleAr: string;
  titleEn: string;
  order: number;
  description?: string;
  lessons?: Lesson[];
}

interface Subject {
  id: string;
  name: string;
  nameAr: string;
}

export default function UnitsPage() {
  const params = useParams();
  const router = useRouter();
  const [units, setUnits] = useState<Unit[]>([]);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedUnit, setExpandedUnit] = useState<string | null>(null);
  const [loadingLessons, setLoadingLessons] = useState<string | null>(null);

  useEffect(() => {
    fetchSubjectAndUnits();
  }, [params.subjectId]);

  const fetchSubjectAndUnits = async () => {
    try {
      // Fetch subject details (with auth)
      const token = localStorage.getItem('token');
      const subjectResponse = await fetch(
        `${API_BASE_URL}/api/v1/subjects/${params.subjectId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      const subjectData = await subjectResponse.json();
      if (subjectData?.success) {
        setSubject(subjectData.data);
      }

      // Fetch units (no auth needed)
      const unitsResponse = await fetch(
        `${API_BASE_URL}/api/v1/content/subjects/${params.subjectId}/units`
      );
      const unitsData = await unitsResponse.json();

      if (unitsData?.success) {
        setUnits(unitsData.data);
        // Auto-expand first unit if exists
        if (unitsData.data.length > 0) {
          const firstUnitId = unitsData.data[0].id;
          setExpandedUnit(firstUnitId);
          fetchLessonsForUnit(firstUnitId);
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLessonsForUnit = async (unitId: string) => {
    setLoadingLessons(unitId);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/content/units/${unitId}/lessons`
      );
      const data = await response.json();

      if (data?.success) {
        setUnits(prev => prev.map(unit =>
          unit.id === unitId
            ? { ...unit, lessons: data.data }
            : unit
        ));
      }
    } catch (error) {
      console.error('Error fetching lessons:', error);
    } finally {
      setLoadingLessons(null);
    }
  };

  const handleUnitClick = (unitId: string) => {
    if (expandedUnit === unitId) {
      setExpandedUnit(null);
    } else {
      setExpandedUnit(unitId);
      // Fetch lessons if not already loaded
      const unit = units.find(u => u.id === unitId);
      if (!unit?.lessons) {
        fetchLessonsForUnit(unitId);
      }
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
          <p className="mt-4 text-gray-700 font-medium">جاري تحميل الوحدات الدراسية...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-2 text-sm">
            <button
              onClick={() => router.push('/subjects')}
              className="text-gray-600 hover:text-blue-600 transition-colors"
            >
              المواد الدراسية
            </button>
            <ChevronRight className="h-4 w-4 text-gray-400" />
            <span className="text-gray-900 font-medium">
              {subject?.nameAr || subject?.name || 'المادة'}
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            وحدات {subject?.nameAr || subject?.name}
          </h1>
          <p className="text-gray-600">
            {units.length} وحدات دراسية متاحة
          </p>
        </div>

        {/* Units List */}
        <div className="space-y-4">
          {units.map((unit) => (
            <Card key={unit.id} className="overflow-hidden">
              {/* Unit Header */}
              <div
                className="p-6 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => handleUnitClick(unit.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Layers className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-800">
                        الوحدة {unit.order}: {unit.titleAr || unit.title}
                      </h2>
                      <p className="text-sm text-gray-500 mt-1">
                        {unit.titleEn}
                      </p>
                      {unit.description && (
                        <p className="text-sm text-gray-600 mt-2">
                          {unit.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                      {unit.lessons?.length || 0} دروس
                    </span>
                    <ChevronDown
                      className={`h-5 w-5 text-gray-400 transform transition-transform ${
                        expandedUnit === unit.id ? 'rotate-180' : ''
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Lessons List */}
              {expandedUnit === unit.id && (
                <div className="border-t bg-gray-50 px-6 py-4">
                  {loadingLessons === unit.id ? (
                    <div className="text-center py-4">
                      <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                      <p className="text-sm text-gray-600 mt-2">جاري تحميل الدروس...</p>
                    </div>
                  ) : unit.lessons && unit.lessons.length > 0 ? (
                    <div className="space-y-3">
                      {unit.lessons.map((lesson) => (
                        <div
                          key={lesson.id}
                          className="bg-white p-4 rounded-lg border hover:shadow-md transition-all cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/lesson/${lesson.id}`);
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                                <BookOpen className="h-5 w-5 text-blue-600" />
                              </div>
                              <div>
                                <h3 className="font-semibold text-gray-800">
                                  الدرس {lesson.order}: {lesson.titleAr || lesson.title}
                                </h3>
                                <div className="flex items-center gap-3 mt-1">
                                  <span className="flex items-center gap-1 text-sm text-gray-500">
                                    <Clock className="h-4 w-4" />
                                    {lesson.duration || 45} دقيقة
                                  </span>
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${getDifficultyColor(lesson.difficulty)}`}>
                                    {lesson.difficulty === 'EASY' ? 'سهل' :
                                     lesson.difficulty === 'HARD' ? 'صعب' : 'متوسط'}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <Button size="sm" variant="primary">
                              ابدأ الدرس
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-gray-500 py-4">
                      لا توجد دروس متاحة في هذه الوحدة
                    </p>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>

        {/* Empty State */}
        {units.length === 0 && (
          <Card className="p-12 text-center">
            <Layers className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">لا توجد وحدات دراسية</h3>
            <p className="text-gray-500">لم يتم إضافة أي وحدات لهذه المادة بعد</p>
          </Card>
        )}
      </div>
    </div>
  );
}