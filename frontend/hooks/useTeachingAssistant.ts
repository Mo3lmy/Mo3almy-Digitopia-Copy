import { useState, useCallback } from 'react';
import api from '@/services/api';

// Types for Teaching Assistant
export type InteractionType =
  | 'explain'
  | 'more_detail'
  | 'example'
  | 'problem'
  | 'repeat'
  | 'continue'
  | 'stop'
  | 'quiz'
  | 'summary'
  | 'motivate'
  | 'simplify'
  | 'application';

interface TeachingScript {
  script: string;
  duration: number;
  keyPoints?: string[];
  examples?: string[];
  problem?: {
    question: string;
    solution: string;
    hints?: string[];
  };
  visualCues?: string[];
  interactionPoints?: string[];
  emotionalTone?: string;
  nextSuggestions?: string[];
  audioUrl?: string;
}

interface SlideContent {
  type?: string;
  title?: string;
  subtitle?: string;
  content?: string;
  bullets?: string[];
  quiz?: any;
  metadata?: any;
}

interface TeachingOptions {
  voiceStyle?: 'friendly' | 'formal' | 'energetic';
  paceSpeed?: 'slow' | 'normal' | 'fast';
  useAnalogies?: boolean;
  useStories?: boolean;
  needMoreDetail?: boolean;
  needExample?: boolean;
  needProblem?: boolean;
  problemDifficulty?: 'easy' | 'medium' | 'hard';
}

interface InteractionResponse {
  message: string;
  type: string;
  script?: string;  //   أضفت هذا للتوافق مع Backend
  audioUrl?: string;  //   أضفت هذا للصوت
  suggestions?: string[];
  example?: string;
  problem?: {
    question: string;
    solution: string;
    hints?: string[];
  };
  visualization?: string;
  additionalContent?: string;
}

export function useTeachingAssistant(lessonId: string) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentScript, setCurrentScript] = useState<TeachingScript | null>(null);
  const [interactionHistory, setInteractionHistory] = useState<string[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);

  // Generate teaching script for slide content
  const generateScript = useCallback(async (
    slideContent: SlideContent,
    options?: TeachingOptions
  ): Promise<TeachingScript | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.post<{ success: boolean; data: TeachingScript; message?: string }>(
        `/lessons/${lessonId}/teaching/script`,
        {
          slideContent,
          generateVoice: true,
          options
        }
      );

      if (response.data?.success) {
        const script = response.data.data;
        setCurrentScript(script);

        // Add to interaction history
        if (script.script) {
          setInteractionHistory(prev => [...prev, script.script]);
        }

        return script;
      } else {
        throw new Error(response.data?.message || 'Failed to generate script');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate teaching script';
      setError(errorMessage);
      console.error('Teaching script generation error:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [lessonId]);

  // Handle student interaction - 🔧 التعديل الرئيسي هنا
  const handleInteraction = useCallback(async (
    type: InteractionType,
    context?: {
      currentSlide?: SlideContent;
      userMessage?: string;  //   أضفت هذا للـ TypeScript
      previousScript?: string;
    }
  ): Promise<InteractionResponse | null> => {
    setIsLoading(true);
    setError(null);

    try {
      // 🎯 التعديل المهم: إرسال البيانات بالشكل الصحيح
      const requestBody = {
        type,
        slideContent: context?.currentSlide || {
          type: 'content',
          title: 'محتوى الدرس',
          content: 'شرح تفاعلي'
        },
        // ✅ تم إزالة userMessage من root level - الآن فقط في context
        context: {
          userMessage: context?.userMessage,  // ✅ userMessage في المكان الصحيح فقط
          previousScript: context?.previousScript || currentScript?.script,
          sessionHistory: interactionHistory.slice(-5), // Last 5 interactions
          // 🔧 إضافة معلومات إضافية للسياق
          lessonId,
          slideTitle: context?.currentSlide?.title,
          slideType: context?.currentSlide?.type
        }
      };

      //   Log للتأكد من إرسال البيانات (للتطوير فقط)
      if (process.env.NODE_ENV === 'development') {
        console.log('=== Teaching Assistant Request ===');
        console.log(JSON.stringify(requestBody, null, 2));
        console.log('UserMessage in context:', requestBody.context?.userMessage);
        console.log('================================');
      }

      const response = await api.post<{ success: boolean; data: InteractionResponse; message?: string }>(
        `/lessons/${lessonId}/teaching/interaction`,
        requestBody
      );

      if (response.data?.success) {
        const interaction = response.data.data;

        // Add to interaction history
        if (interaction.message || interaction.script) {
          setInteractionHistory(prev => [...prev, interaction.message || interaction.script || '']);
        }

        return interaction;
      } else {
        throw new Error(response.data?.message || 'Failed to process interaction');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to process interaction';
      setError(errorMessage);
      console.error('Interaction error:', err);
      
      //   Fallback response في حالة الفشل
      return {
        message: 'عذراً، حدث خطأ. يمكنك المحاولة مرة أخرى أو طلب المساعدة بطريقة مختلفة.',
        type: 'error',
        suggestions: ['اشرح مرة أخرى', 'أعطني مثال', 'ساعدني في الفهم']
      };
    } finally {
      setIsLoading(false);
    }
  }, [lessonId, currentScript, interactionHistory]);

  // Play voice narration -   تحسينات
  const playVoice = useCallback(async (audioUrl?: string) => {
    if (!audioUrl && !currentScript?.audioUrl) {
      setError('No audio available');
      return;
    }

    const url = audioUrl || currentScript?.audioUrl;
    if (!url) return;

    setIsPlaying(true);

    try {
      //   إنشاء audio element مع إعدادات أفضل
      const audio = new Audio(url);
      audio.volume = 0.8;  // صوت مناسب
      audio.playbackRate = 1.0;  // سرعة طبيعية

      audio.addEventListener('ended', () => {
        setIsPlaying(false);
      });

      audio.addEventListener('error', (e) => {
        console.error('Audio playback error:', e);
        setError('Failed to play audio');
        setIsPlaying(false);
      });

      await audio.play();
      
      //   حفظ reference للـ audio element للتحكم لاحقاً
      (window as any).__currentAudio = audio;
    } catch (err) {
      console.error('Voice playback error:', err);
      setError('Failed to play voice');
      setIsPlaying(false);
    }
  }, [currentScript]);

  // Stop voice narration -   تحسين
  const stopVoice = useCallback(() => {
    //   إيقاف الصوت الفعلي
    const audio = (window as any).__currentAudio;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      delete (window as any).__currentAudio;
    }
    setIsPlaying(false);
  }, []);

  // Generate problem based on current content
  const generateProblem = useCallback(async (
    difficulty: 'easy' | 'medium' | 'hard' = 'medium',
    slideContent?: SlideContent  //   أضفت slideContent كـ parameter
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.post<{ success: boolean; data: any; message?: string }>(
        `/lessons/${lessonId}/teaching/problem`,
        {
          difficulty,
          currentSlide: slideContent || currentScript,  //   استخدم slideContent إذا تم تمريره
          lessonId  //   أضف lessonId
        }
      );

      if (response.data?.success) {
        return response.data.data;
      } else {
        throw new Error(response.data?.message || 'Failed to generate problem');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate problem';
      setError(errorMessage);
      console.error('Problem generation error:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [lessonId, currentScript]);

  // Clear interaction history
  const clearHistory = useCallback(() => {
    setInteractionHistory([]);
    setCurrentScript(null);
    setError(null);
    //   إيقاف الصوت عند المسح
    stopVoice();
  }, [stopVoice]);

  // Get teaching statistics
  const getStats = useCallback(async () => {
    try {
      const response = await api.get<{ success: boolean; data: any }>(`/lessons/${lessonId}/teaching/stats`);

      if (response.data?.success) {
        return response.data.data;
      }
      return null;
    } catch (err) {
      console.error('Failed to get teaching stats:', err);
      return null;
    }
  }, [lessonId]);

  //   دالة إضافية لتوليد شرائح إضافية
  const generateAdditionalSlides = useCallback(async (
    topic: string,
    slideType: 'explanation' | 'example' | 'exercise'
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.post<{ success: boolean; data: any; message?: string }>(
        `/lessons/${lessonId}/teaching/additional-slides`,
        {
          topic,
          slideType,
          lessonId,
          currentContext: interactionHistory.slice(-3)
        }
      );

      if (response.data?.success) {
        return response.data.data;
      }
      return null;
    } catch (err) {
      console.error('Failed to generate additional slides:', err);
      setError('فشل توليد الشرائح الإضافية');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [lessonId, interactionHistory]);

  return {
    // State
    isLoading,
    error,
    currentScript,
    interactionHistory,
    isPlaying,

    // Actions
    generateScript,
    handleInteraction,
    playVoice,
    stopVoice,
    generateProblem,
    clearHistory,
    getStats,
    generateAdditionalSlides
  };
}