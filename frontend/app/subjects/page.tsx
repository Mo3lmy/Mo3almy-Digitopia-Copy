'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, Calculator, Atom, Globe, Palette, Brain } from 'lucide-react';
import useAuthStore from '@/stores/useAuthStore';
import Card from '@/components/ui/Card';
import { API_BASE_URL } from '@/config/api.config';

interface Subject {
  id: string;
  name: string;
  nameAr: string;
  nameEn: string;
  description: string;
  grade: number;
  order: number;
}

export default function SubjectsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSubjects();
  }, []);

  const fetchSubjects = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_BASE_URL}/api/v1/subjects?grade=${user?.grade || 6}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      const data = await response.json();
      if (data?.success) {
        setSubjects(data.data);
      }
    } catch (error) {
      console.error('Error fetching subjects:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSubjectIcon = (name: string) => {
    const nameLower = name.toLowerCase();
    if (nameLower.includes('رياض') || nameLower.includes('math')) return <Calculator className="h-8 w-8" />;
    if (nameLower.includes('علوم') || nameLower.includes('science')) return <Atom className="h-8 w-8" />;
    if (nameLower.includes('جغراف') || nameLower.includes('تاريخ')) return <Globe className="h-8 w-8" />;
    if (nameLower.includes('فن') || nameLower.includes('art')) return <Palette className="h-8 w-8" />;
    if (nameLower.includes('عرب') || nameLower.includes('لغ')) return <Brain className="h-8 w-8" />;
    return <BookOpen className="h-8 w-8" />;
  };

  const getSubjectColor = (index: number) => {
    const colors = [
      'bg-blue-500',
      'bg-purple-500',
      'bg-green-500',
      'bg-yellow-500',
      'bg-red-500',
      'bg-indigo-500'
    ];
    return colors[index % colors.length];
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-700 font-medium">جاري تحميل المواد الدراسية...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-gray-800 mb-3">المواد الدراسية</h1>
          <p className="text-gray-600 text-lg">اختر المادة التي تريد دراستها للصف {user?.grade || 6}</p>
        </div>

        {/* Subjects Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {subjects.map((subject, index) => (
            <Card
              key={subject.id}
              className="relative overflow-hidden cursor-pointer transform transition-all duration-300 hover:scale-105 hover:shadow-2xl"
              onClick={() => router.push(`/subjects/${subject.id}/units`)}
            >
              {/* Colored Header */}
              <div className={`${getSubjectColor(index)} p-6 text-white`}>
                <div className="flex items-center justify-between">
                  {getSubjectIcon(subject.nameAr || subject.name)}
                  <span className="text-xs bg-white/20 px-2 py-1 rounded-full">
                    الصف {subject.grade}
                  </span>
                </div>
                <h2 className="text-2xl font-bold mt-4">
                  {subject.nameAr || subject.name}
                </h2>
                <p className="text-sm mt-1 opacity-90">
                  {subject.nameEn}
                </p>
              </div>

              {/* Content */}
              <div className="p-6">
                <p className="text-gray-600 text-sm line-clamp-2">
                  {subject.description || `دراسة منهج ${subject.nameAr || subject.name} للصف ${subject.grade}`}
                </p>

                <div className="flex items-center justify-between mt-6">
                  <button className="text-blue-600 font-medium text-sm flex items-center gap-1 hover:gap-2 transition-all">
                    ابدأ الدراسة
                    <span>←</span>
                  </button>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    متاح الآن
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Empty State */}
        {subjects.length === 0 && (
          <Card className="p-16 text-center">
            <BookOpen className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">لا توجد مواد دراسية</h3>
            <p className="text-gray-500">لا توجد مواد دراسية متاحة للصف {user?.grade || 6} حالياً</p>
          </Card>
        )}
      </div>
    </div>
  );
}