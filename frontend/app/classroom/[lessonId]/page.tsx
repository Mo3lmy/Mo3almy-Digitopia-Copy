'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Hand, Play, Pause, ChevronLeft, ChevronRight, MessageCircle, Loader, Sparkles, CheckCircle, Save } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useTeachingAssistant } from '@/hooks/useTeachingAssistant';
import api from '@/services/api';
import SlideViewer from '@/src/components/SlideViewer';
import { studentContextManager } from '@/services/studentContext';
import toast from 'react-hot-toast';
import { useActivityTracker } from '@/hooks/useActivityTracker';
import { API_BASE_URL } from '@/config/api.config';

// Type definitions
interface ApiResponse {
  success: boolean;
  data?: any;
  message?: string;
}

interface InteractionResponseExtended {
  message: string;
  type: string;
  script?: string;
  audioUrl?: string;
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

//  Type for chat message
interface ChatMessage {
  sender: 'user' | 'assistant' | 'system';
  message: string;
  timestamp: Date;
  suggestions?: string[];
}

// Global abort controller لإيقاف polling القديم
let activePollingController: AbortController | null = null;

export default function InteractiveClassroom() {
  const params = useParams();
  const router = useRouter();
  const lessonId = params.lessonId as string;

  // State
  const [slides, setSlides] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isWaitingForHelp, setIsWaitingForHelp] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [quickSuggestions, setQuickSuggestions] = useState<string[]>([]); //
  const [isCompleting, setIsCompleting] = useState(false);
  const [isSavingProgress, setIsSavingProgress] = useState(false);

  // States للتشغيل التلقائي
  const [autoPlayEnabled, setAutoPlayEnabled] = useState(false);
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [audioProgress, setAudioProgress] = useState<number>(0);
  const [isAudioLoading, setIsAudioLoading] = useState(false); 

  // Refs
  const audioRef = useRef<HTMLAudioElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null); //  للـ auto-scroll

  // استخدم الـ Hooks الموجودة
  const ws = useWebSocket(lessonId);
  const teaching = useTeachingAssistant(lessonId);
  const { startLessonTracking, stopLessonTracking, trackActivity } = useActivityTracker();

  // Current slide
  const currentSlide = slides[currentIndex] || null;

  // دالة لحساب مدة الصوت الحقيقية
  const getAudioDuration = useCallback((): Promise<number> => {
    return new Promise((resolve) => {
      if (audioRef.current) {
        if (audioRef.current.duration && !isNaN(audioRef.current.duration)) {
          resolve(audioRef.current.duration);
          return;
        }

        const handleLoadedMetadata = () => {
          if (audioRef.current) {
            const duration = audioRef.current.duration;
            if (!isNaN(duration)) {
              audioRef.current.removeEventListener('loadedmetadata', handleLoadedMetadata);
              resolve(duration);
            }
          }
        };

        audioRef.current.addEventListener('loadedmetadata', handleLoadedMetadata);

        setTimeout(() => {
          audioRef.current?.removeEventListener('loadedmetadata', handleLoadedMetadata);
          resolve(15);
        }, 3000);
      } else {
        resolve(15);
      }
    });
  }, []);

  /**
   * دالة لتحويل محتوى الشريحة إلى HTML كامل
   */
  const generateHTMLFromSlide = (slide: any): string => {
    // إذا كان هناك HTML جاهز، أرجعه
    if (slide.html) {
      return slide.html;
    }

    // إنشاء HTML من المحتوى العادي
    let bodyContent = '';
    
    if (slide.title) {
      bodyContent += `<h1 style="color: white; font-size: 3em; margin-bottom: 20px; text-shadow: 2px 2px 8px rgba(0,0,0,0.3);">${slide.title}</h1>`;
    }
    
    if (slide.subtitle) {
      bodyContent += `<h2 style="color: white; font-size: 2em; margin-bottom: 15px; opacity: 0.95;">${slide.subtitle}</h2>`;
    }
    
    if (slide.content) {
      bodyContent += `<p style="color: white; font-size: 1.5em; line-height: 1.8; margin-bottom: 20px;">${slide.content}</p>`;
    }
    
    if (slide.bullets && slide.bullets.length > 0) {
      bodyContent += '<ul style="list-style: none; padding: 0; text-align: right;">';
      slide.bullets.forEach((bullet: string, index: number) => {
        bodyContent += `
          <li style="color: white; font-size: 1.3em; margin: 15px 0; padding-right: 30px; position: relative; animation: slideIn ${0.5 + index * 0.2}s ease-out;">
            <span style="position: absolute; right: 0; color: #ffd700; font-size: 1.2em;">✦</span>
            ${bullet}
          </li>`;
      });
      bodyContent += '</ul>';
    }

    // إنشاء HTML كامل مع الستايلات
    const fullHTML = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&family=Cairo:wght@400;700&display=swap" rel="stylesheet">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            width: 100vw;
            height: 100vh;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            font-family: 'Tajawal', 'Cairo', 'Segoe UI', sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            direction: rtl;
            padding: 40px;
            overflow: hidden;
        }
        
        .slide-container {
            text-align: center;
            max-width: 90%;
            width: 100%;
        }
        
        h1, h2, h3, p, li {
            animation: fadeIn 0.8s ease-out;
        }
        
        @keyframes fadeIn {
            from { 
                opacity: 0; 
                transform: translateY(20px); 
            }
            to { 
                opacity: 1; 
                transform: translateY(0); 
            }
        }
        
        @keyframes slideIn {
            from { 
                opacity: 0; 
                transform: translateX(50px); 
            }
            to { 
                opacity: 1; 
                transform: translateX(0); 
            }
        }

        .slide-container::before {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 70%);
            animation: rotate 30s linear infinite;
            pointer-events: none;
        }
        
        @keyframes rotate {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="slide-container">
        ${bodyContent}
    </div>
</body>
</html>`;

    return fullHTML;
  };

  //  Auto-scroll للشات عند رسالة جديدة
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Initialize
  useEffect(() => {
    loadSlides();

    // Start lesson tracking
    startLessonTracking(lessonId);

    // Join lesson عبر WebSocket
    if (ws.isConnected) {
      ws.emit('join_lesson', { lessonId });
    }

    // استمع للأحداث
    ws.on('slide_ready', (data: any) => {
      console.log('Slide ready:', data);
    });

    ws.on('teaching_script_ready', (data: any) => {
      if (data.audioUrl && audioRef.current) {
        audioRef.current.src = data.audioUrl;
        audioRef.current.play();
      }
    });

    //  معالج chat_response
    ws.on('chat_response', (data: any) => {
      console.log('Chat response received:', data);

      setChatMessages(prev => [...prev, {
        sender: 'assistant',
        message: data.message,
        timestamp: new Date(),
        suggestions: data.suggestions
      }]);

      setIsWaitingForHelp(false);

      // إذا كان هناك اقتراحات، اعرضها
      if (data.suggestions && data.suggestions.length > 0) {
        setQuickSuggestions(data.suggestions);
      }
    });

    // معالج chat_error
    ws.on('chat_error', (data: any) => {
      console.error('Chat error:', data);

      setChatMessages(prev => [...prev, {
        sender: 'system',
        message: data.message || 'عذراً، حدث خطأ. حاول مرة أخرى.',
        timestamp: new Date()
      }]);

      setIsWaitingForHelp(false);
    });

    //  معالج additional_slide_ready من chat response
    ws.on('additional_slide_ready', (data: any) => {
      console.log('Additional slide ready from chat:', data);

      if (data.slide) {
        setSlides(prev => {
          const newSlides = [...prev];
          const insertIndex = data.insertAfter ?? currentIndex;

          // أضف الشريحة الجديدة
          const newSlide = {
            ...data.slide,
            isGenerated: true,
            order: insertIndex + 1
          };

          newSlides.splice(insertIndex + 1, 0, newSlide);
          return newSlides;
        });

        setChatMessages(prev => [...prev, {
          sender: 'system',
          message: '✨ تم إضافة شريحة توضيحية جديدة',
          timestamp: new Date()
        }]);

        setQuickSuggestions(['انتقل للشريحة الجديدة', 'استمر في الشرح']);
      }
    });

    //  تحسين معالجة الشرائح الإضافية (الموجودة)
    ws.on('additional_slides_ready', (data: any) => {
      if (data.success && data.htmlSlides) {
        setSlides(prev => {
          const newSlides = [...prev];
          const insertIndex = data.insertAfterIndex ?? currentIndex;
          
          // حوّل HTML slides إلى كائنات
          const parsedSlides = data.htmlSlides.map((html: string, i: number) => ({
            type: data.type || 'content',
            title: data.topic,
            html: html,
            isGenerated: true,
            order: insertIndex + i + 1
          }));
          
          newSlides.splice(insertIndex + 1, 0, ...parsedSlides);
          return newSlides;
        });

        setChatMessages(prev => [...prev, {
          sender: 'assistant',
          message: `✅ تم إضافة ${data.count} شرائح ${
            data.type === 'example' ? 'أمثلة' : 
            data.type === 'exercise' ? 'تمارين' : 
            'شرح إضافي'
          } بنجاح!`,
          timestamp: new Date()
        }]);

        //  اقترح الانتقال للشريحة الجديدة
        setQuickSuggestions(['انتقل للشريحة الجديدة', 'استمر في الشرح', 'أريد المزيد']);
      }
    });

    //  معالجة تأكيد رفع اليد - بدون رد تلقائي!
    ws.on('hand_raised_acknowledged', (data: any) => {
      console.log('✋ Hand raise acknowledged:', data);

      // عرض الاقتراحات فقط - بدون رسالة رد تلقائية
      if (data.suggestions?.length > 0) {
        setQuickSuggestions(data.suggestions);
      }

      // لا نضيف أي رسالة هنا - فقط التأكيد
    });

    // معالج الشريحة المولدة من الشات
    ws.on('new_slide_generated', (data: any) => {
      console.log('📑 New slide received from chat:', data);

      if (data.slide && data.shouldAdd) {
        // أضف الشريحة للعرض
        setSlides(prevSlides => {
          const newSlides = [...prevSlides];
          const insertIndex = data.insertAfter || currentIndex;

          // Create slide object with HTML
          const newSlide = {
            id: data.slide.id || `generated_${Date.now()}`,
            type: data.slide.type || 'content',
            title: data.slide.title,
            content: data.slide.content,
            html: data.slide.html,
            order: insertIndex + 1,
            isGenerated: true
          };

          // Insert after current slide
          newSlides.splice(insertIndex + 1, 0, newSlide);
          return newSlides;
        });

        // Add confirmation message
        setChatMessages(prev => [...prev, {
          sender: 'system',
          message: `✨ تم إضافة شريحة "${data.slide.title}" للعرض`,
          timestamp: new Date()
        }]);

        // Suggestions for next action
        setQuickSuggestions([
          'انتقل للشريحة الجديدة',
          'أريد شريحة أخرى',
          'استمر في الدرس'
        ]);

        // Optional: Navigate to new slide after 1 second
        setTimeout(() => {
          setCurrentIndex(prev => prev + 1);
        }, 1500);
      }
    });

    // معالجة رد المساعدة القديم (إذا كان موجوداً)
    ws.on('help_response', (data: any) => {
      setIsWaitingForHelp(false);
      setShowChat(true);

      // إضافة رسالة فقط إذا كانت ردًا على سؤال حقيقي
      if (data.message && data.message.length > 20) {
        setChatMessages(prev => [...prev, {
          sender: 'assistant',
          message: data.message,
          suggestions: data.suggestions,
          timestamp: new Date()
        }]);
      }

      if (data.suggestions?.length > 0) {
        setQuickSuggestions(data.suggestions);
      }
    });

    return () => {
      ws.removeAllListeners();
      if (activePollingController) {
        activePollingController.abort();
        activePollingController = null;
      }
      // Stop lesson tracking on unmount
      stopLessonTracking();
    };
  }, [lessonId, ws.isConnected]);

  // تحميل الشرائح
  const loadSlides = async () => {
    try {
      setLoading(true);

      // أوقف أي polling سابق
      if (activePollingController) {
        activePollingController.abort();
        activePollingController = null;
      }

      // أنشئ controller جديد للدرس الحالي
      activePollingController = new AbortController();
      const signal = activePollingController.signal;

      // جرب أولاً الحصول على الشرائح الموجودة
      try {
        const response = await api.get<ApiResponse>(`/lessons/${lessonId}/slides`);
        if (response.data?.success && response.data.data?.slides?.length > 0) {
          setSlides(response.data.data.slides);
          setLoading(false);
          activePollingController = null;

          // Track first slide view
          if (response.data.data.slides.length > 0) {
            trackActivity('slide_viewed', {
              lessonId,
              slideIndex: 0,
              slideContent: response.data.data.slides[0]?.title || 'Slide 1',
              direction: 'initial'
            });
          }
          return;
        }
      } catch (error) {
        // تجاهل - سنولد شرائح جديدة
      }

      // ولّد شرائح جديدة
      setGenerating(true);
      setGenerationProgress(10);

      const generateResponse = await api.post<ApiResponse>(`/lessons/${lessonId}/teaching/smart-lesson`, {
        theme: 'default',
        generateVoice: true,
        teachingOptions: {
          voiceStyle: 'friendly',
          paceSpeed: 'normal',
          useAnalogies: true,
          useStories: true
        }
      });

      if (generateResponse.data?.success) {
        let attempts = 0;
        const maxAttempts = 40;
        let delay = 10000;

        const checkStatus = async (): Promise<boolean> => {
          if (signal.aborted) {
            return true;
          }

          if (attempts >= maxAttempts) {
            throw new Error('Generation timeout');
          }

          attempts++;
          const progress = Math.min(10 + (attempts * 2.25), 90);
          setGenerationProgress(progress);

          try {
            await new Promise<void>((resolve, reject) => {
              const jitter = Math.random() * 0.4 - 0.2;
              const jitteredDelay = delay * (1 + jitter);
              const timeout = setTimeout(resolve, jitteredDelay);

              const abortHandler = () => {
                clearTimeout(timeout);
                reject(new Error('Aborted'));
              };
              signal.addEventListener('abort', abortHandler, { once: true });
            });

            if (signal.aborted) {
              return true;
            }

            const status = await api.get<ApiResponse>(`/lessons/${lessonId}/teaching/status`);

            if (status.data?.data?.status === 'completed' && status.data.data.slides) {
              setGenerationProgress(100);
              setSlides(status.data.data.slides);
              setGenerating(false);
              setLoading(false);
              activePollingController = null;

              // Track first slide view for generated slides
              if (status.data.data.slides.length > 0) {
                trackActivity('slide_viewed', {
                  lessonId,
                  slideIndex: 0,
                  slideContent: status.data.data.slides[0]?.title || 'Slide 1',
                  direction: 'initial'
                });
              }
              return true;
            } else if (status.data?.data?.status === 'failed') {
              activePollingController = null;
              throw new Error(status.data.data.error || 'Generation failed');
            }

            return false;

          } catch (error: any) {
            if (error.message === 'Aborted') {
              return true;
            }

            if (error.response?.status === 429) {
              delay = Math.min(delay * 2, 60000);
              console.log(`Rate limited, waiting ${delay/1000} seconds...`);
            }

            return false;
          }
        };

        const pollForStatus = async () => {
          while (attempts < maxAttempts && !signal.aborted) {
            const completed = await checkStatus();
            if (completed) break;
          }
        };

        await pollForStatus();
      }
    } catch (error: any) {
      console.error('Error loading slides:', error);
      setLoading(false);
      setGenerating(false);
      activePollingController = null;

      setSlides([
        { id: '1', type: 'title', title: 'مرحباً في الدرس', content: 'جاري التحميل...', order: 1 }
      ]);
    }
  };

  // تشغيل/إيقاف الشرح
  const handlePlayPause = async () => {
    const newPlayState = !isPlaying;
    setIsPlaying(newPlayState);
    setAutoPlayEnabled(newPlayState);

    if (newPlayState && currentSlide) {
      setIsAudioLoading(true);

      const slideContent = {
        type: currentSlide.type || 'content',
        title: currentSlide.title || '',
        content: currentSlide.content || '',
        bullets: currentSlide.bullets || []
      };

      try {
        const script = await teaching.generateScript(slideContent);
        console.log('📝 Generated script:', script);
        console.log('🔊 Audio URL:', script?.audioUrl);

        if (script?.audioUrl && audioRef.current) {
          // إضافة البروتوكول والهوست إذا كان URL نسبي
          let audioUrl = script.audioUrl;
          if (audioUrl.startsWith('/audio/')) {
            // URL نسبي، استخدم الـ backend URL الصحيح
            audioUrl = `${API_BASE_URL}${audioUrl}`;
          }
          console.log('🔊 Full Audio URL:', audioUrl);

          // إضافة crossOrigin للتعامل مع CORS
          audioRef.current.crossOrigin = 'anonymous';
          audioRef.current.preload = 'auto';
          audioRef.current.src = audioUrl;

          // تنظيف الأحداث القديمة أولاً
          audioRef.current.onloadedmetadata = null;
          audioRef.current.onended = null;
          audioRef.current.ontimeupdate = null;
          audioRef.current.onerror = null;

          // إضافة الأحداث الجديدة
          audioRef.current.onloadedmetadata = async () => {
            const duration = await getAudioDuration();
            setAudioDuration(duration);
            console.log(`🎵 Audio duration: ${duration} seconds`);
          };

          audioRef.current.onended = () => {
            if (autoPlayEnabled && currentIndex < slides.length - 1) {
              console.log('🎵 Audio ended, moving to next slide...');
              setTimeout(() => {
                nextSlide();
              }, 500);
            } else if (currentIndex === slides.length - 1) {
              setAutoPlayEnabled(false);
              setIsPlaying(false);

              setChatMessages(prev => [...prev, {
                sender: 'system',
                message: '🎉 رائع! لقد أكملت جميع الشرائح بنجاح',
                timestamp: new Date()
              }]);
            }
          };

          audioRef.current.ontimeupdate = () => {
            if (audioRef.current) {
              const progress = (audioRef.current.currentTime / audioRef.current.duration) * 100;
              setAudioProgress(progress);
            }
          };

          audioRef.current.onerror = () => {
            console.error('❌ Audio failed to load, URL:', script.audioUrl);
            setIsAudioLoading(false);
            setAudioDuration(0);

            if (autoPlayEnabled) {
              console.log('⏱️ Using fallback timer (15 seconds)...');
              setTimeout(() => {
                if (currentIndex < slides.length - 1) {
                  nextSlide();
                }
              }, 15000);
            }
          };

          // محاولة التشغيل مع معالجة الأخطاء
          try {
            await audioRef.current.play();
            console.log('▶️ Audio playing...');
          } catch (playError) {
            console.error('❌ Failed to play audio:', playError);
            setIsAudioLoading(false);

            // Fallback للتايمر
            if (autoPlayEnabled) {
              setTimeout(() => {
                if (currentIndex < slides.length - 1) {
                  nextSlide();
                }
              }, 15000);
            }
          }
        } else {
          console.log('⏱️ No audio, using timer (15 seconds)...');
          if (autoPlayEnabled) {
            setTimeout(() => {
              if (currentIndex < slides.length - 1) {
                nextSlide();
              }
            }, 15000);
          }
        }
      } catch (error) {
        console.error('❌ Error in handlePlayPause:', error);
      } finally {
        setIsAudioLoading(false);
      }
    } else {
      setAutoPlayEnabled(false);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setAudioProgress(0);
    }
  };

  // Complete lesson function
  const completeLesson = async () => {
    setIsCompleting(true);
    try {
      // Call the complete endpoint
      const response = await fetch(`${API_BASE_URL}/lessons/${lessonId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();

        // Update student context
        await studentContextManager.updateContext('lesson_completed', {
          lessonId,
          completedAt: new Date().toISOString(),
          totalSlides: slides.length,
          completionRate: 100
        });

        // Show success message
        toast.success('🎉 أحسنت! لقد أكملت الدرس بنجاح', {
          duration: 4000,
          position: 'top-center'
        });

        // Redirect after a short delay
        setTimeout(() => {
          router.push('/dashboard');
        }, 2000);
      } else {
        throw new Error('Failed to complete lesson');
      }
    } catch (error) {
      console.error('Error completing lesson:', error);
      toast.error('حدث خطأ في حفظ إكمال الدرس');
    } finally {
      setIsCompleting(false);
    }
  };

  // Save progress function
  const saveProgress = async () => {
    setIsSavingProgress(true);
    try {
      // Calculate progress percentage
      const progressPercentage = Math.round(((currentIndex + 1) / slides.length) * 100);

      // Update progress via API
      const response = await fetch(`${API_BASE_URL}/lessons/${lessonId}/progress`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          slideIndex: currentIndex,
          totalSlides: slides.length,
          progressPercentage
        })
      });

      if (response.ok) {
        // Update student context
        await studentContextManager.updateContext('progress_saved', {
          lessonId,
          slideIndex: currentIndex,
          progressPercentage,
          savedAt: new Date().toISOString()
        });

        toast.success('تم حفظ التقدم بنجاح ✅', {
          duration: 2000,
          position: 'bottom-center'
        });
      } else {
        throw new Error('Failed to save progress');
      }
    } catch (error) {
      console.error('Error saving progress:', error);
      toast.error('حدث خطأ في حفظ التقدم');
    } finally {
      setIsSavingProgress(false);
    }
  };

  //  رفع اليد محسّن
  const handleRaiseHand = () => {
    const newState = !isHandRaised;
    setIsHandRaised(newState);

    if (newState) {
      //   أوقف الصوت
      setIsPlaying(false);
      if (audioRef.current) {
        audioRef.current.pause();
      }

      //   فتح الشات تلقائياً
      setShowChat(true);

      //   رسالة ترحيب ذكية
      const welcomeMessage = `مرحباً! 👋 
لاحظت أنك رفعت يدك عند شريحة "${currentSlide?.title || 'هذا الجزء'}". 
كيف يمكنني مساعدتك؟`;

      setChatMessages(prev => [...prev, {
        sender: 'assistant',
        message: welcomeMessage,
        timestamp: new Date()
      }]);

      //   اقتراحات ذكية بناءً على نوع الشريحة
      const suggestions = currentSlide?.type === 'problem' 
        ? ['أحتاج تلميح', 'اشرح الحل خطوة بخطوة', 'أعطني مثال مشابه']
        : currentSlide?.type === 'content'
        ? ['اشرح بطريقة أبسط', 'أعطني مثال', 'أريد تمرين']
        : ['اشرح مرة أخرى', 'أعطني مثال', 'لم أفهم هذا الجزء'];

      setQuickSuggestions(suggestions);

      // أرسل للـ WebSocket - بدون سؤال تلقائي!
      ws.emit('student_hand_raised', {
        lessonId,
        currentSlideIndex: currentIndex,
        currentSlideContent: {
          type: currentSlide?.type,
          title: currentSlide?.title,
          content: currentSlide?.content,
          bullets: currentSlide?.bullets
        }
        // لا نرسل question هنا - انتظر حتى يكتب الطالب سؤاله
      });

      // ركز على input الشات
      setTimeout(() => {
        const chatInput = document.querySelector('input[type="text"]') as HTMLInputElement;
        if (chatInput) {
          chatInput.focus();
        }
      }, 100);

      setIsWaitingForHelp(false); // لا نحتاج الانتظار
    } else {
      //   عند خفض اليد
      setChatMessages(prev => [...prev, {
        sender: 'system',
        message: '✋ تم خفض يدك',
        timestamp: new Date()
      }]);
      setQuickSuggestions([]);
    }
  };

  //  إرسال رسالة محسّن
  const sendMessage = async () => {
    if (!inputMessage.trim()) return;

    const lower = inputMessage.toLowerCase();

    //   معالجة محسنة لطلبات الشرائح
    if (lower.includes('شرائح') || lower.includes('مزيد') || lower.includes('أكثر')) {
      let type: 'explanation' | 'example' | 'exercise' = 'explanation';

      if (lower.includes('مثال') || lower.includes('أمثلة')) type = 'example';
      else if (lower.includes('تمرين') || lower.includes('تمارين') || lower.includes('مسائل')) type = 'exercise';
      else if (lower.includes('شرح')) type = 'explanation';

      ws.emit('generate_additional_slides', {
        topic: currentSlide?.title || inputMessage.replace(/شرائح|مزيد|أكثر/g, '').trim(),
        lessonId,
        slideType: type,
        insertAfterIndex: currentIndex
      });

      setChatMessages(prev => [...prev, 
        {
          sender: 'user',
          message: inputMessage,
          timestamp: new Date()
        },
        {
          sender: 'assistant',
          message: `⏳ جاري إنشاء ${
            type === 'example' ? 'أمثلة تطبيقية' :
            type === 'exercise' ? 'تمارين تفاعلية' :
            'شرح إضافي'
          }...`,
          timestamp: new Date()
        }
      ]);

      setInputMessage('');
      return;
    }

    // أضف رسالة المستخدم
    setChatMessages(prev => [...prev, {
      sender: 'user',
      message: inputMessage,
      timestamp: new Date()
    }]);

    //   تحليل محسن لنوع التفاعل
    let interactionType = 'explain';
    if (lower.includes('مثال') || lower.includes('مثل')) interactionType = 'example';
    else if (lower.includes('تمرين') || lower.includes('مسأله') || lower.includes('حل')) interactionType = 'problem';
    else if (lower.includes('بسط') || lower.includes('ابسط') || lower.includes('سهل')) interactionType = 'simplify';
    else if (lower.includes('كرر') || lower.includes('اعد') || lower.includes('تاني')) interactionType = 'repeat';
    else if (lower.includes('ملخص') || lower.includes('تلخيص')) interactionType = 'summary';
    else if (lower.includes('ليه') || lower.includes('لماذا')) interactionType = 'socratic';
    else if (lower.includes('تلميح') || lower.includes('hint')) interactionType = 'hint';

    //  Debug: تتبع مسار السؤال
    console.log('=== SENDING MESSAGE ===');
    console.log('Input Message:', inputMessage);
    console.log('Interaction Type:', interactionType);
    console.log('Current Slide:', currentSlide?.title);
    console.log('=====================');

    //   إرسال الرسالة عبر WebSocket مع currentSlideContent
    if (ws && ws.isConnected) {
      console.log('Sending message via WebSocket with slide content');
      ws.emit('chat_message', {
        message: inputMessage,
        lessonId: lessonId,
        currentSlideContent: currentSlide, // مهم جداً!
        currentSlideIndex: currentIndex,
        conversationHistory: chatMessages.slice(-10) // آخر 10 رسائل
      });

      setIsWaitingForHelp(true);
      setInputMessage('');
      return; // انتظر الرد من WebSocket
    }

    // Fallback للـ Teaching Assistant API
    try {
      const response = await teaching.handleInteraction(interactionType as any, {
        currentSlide: {
          type: currentSlide?.type || 'content',
          title: currentSlide?.title || '',
          content: currentSlide?.content || '',
          bullets: currentSlide?.bullets || []
        },
        userMessage: inputMessage 
      } as any) as InteractionResponseExtended | null;

      if (response) {
        setChatMessages(prev => [...prev, {
          sender: 'assistant',
          message: response.script || response.message || 'شكراً لسؤالك',
          timestamp: new Date()
        }]);

        //   حدث الاقتراحات إذا كانت موجودة
        if (response.suggestions && response.suggestions.length > 0) {
          setQuickSuggestions(response.suggestions);
        }

        // إذا كان هناك صوت، شغله
        if (response.audioUrl && audioRef.current) {
          audioRef.current.src = response.audioUrl;
          audioRef.current.play();
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setChatMessages(prev => [...prev, {
        sender: 'assistant',
        message: 'عذراً، حدث خطأ. حاول مرة أخرى أو اطلب مساعدة بطريقة مختلفة.',
        timestamp: new Date()
      }]);
    }

    setInputMessage('');
  };

  //   دالة للتعامل مع Quick Actions
  const handleQuickAction = (suggestion: string) => {
    setInputMessage(suggestion);
    setQuickSuggestions([]); // امسح الاقتراحات
    // أرسل مباشرة
    setTimeout(() => {
      const input = document.querySelector('input[type="text"]') as HTMLInputElement;
      if (input) {
        input.focus();
        sendMessage();
      }
    }, 100);
  };

  // التنقل بين الشرائح
  const nextSlide = async () => {
    if (currentIndex < slides.length - 1) {
      const newIndex = currentIndex + 1;

      // Track slide change
      trackActivity('slide_viewed', {
        lessonId,
        slideIndex: newIndex,
        slideContent: slides[newIndex]?.title || `Slide ${newIndex + 1}`,
        direction: 'next'
      });

      setCurrentIndex(newIndex);
      setAudioProgress(0);

      if (autoPlayEnabled) {
        const nextSlideData = slides[newIndex];

        if (nextSlideData) {
          setIsAudioLoading(true);

          const slideContent = {
            type: nextSlideData.type || 'content',
            title: nextSlideData.title || '',
            content: nextSlideData.content || '',
            bullets: nextSlideData.bullets || []
          };

          try {
            const script = await teaching.generateScript(slideContent);

            if (script?.audioUrl && audioRef.current) {
              console.log('🔊 Loading audio for slide:', nextSlideData.title);

              // إضافة البروتوكول والهوست إذا كان URL نسبي
              let audioUrl = script.audioUrl;
              if (audioUrl.startsWith('/audio/')) {
                audioUrl = `${API_BASE_URL}${audioUrl}`;
              }

              audioRef.current.crossOrigin = 'anonymous';
              audioRef.current.preload = 'auto';
              audioRef.current.src = audioUrl;

              // تنظيف الأحداث القديمة
              audioRef.current.onloadedmetadata = null;
              audioRef.current.onended = null;
              audioRef.current.onerror = null;

              // إضافة أحداث جديدة للشريحة التالية
              audioRef.current.onloadedmetadata = async () => {
                const duration = await getAudioDuration();
                setAudioDuration(duration);
                console.log(`🎵 Next slide audio duration: ${duration} seconds`);
              };

              audioRef.current.onended = () => {
                if (autoPlayEnabled && newIndex < slides.length - 1) {
                  console.log('🎵 Audio ended, moving to next slide...');
                  setTimeout(() => {
                    nextSlide();
                  }, 500);
                } else if (newIndex === slides.length - 1) {
                  setAutoPlayEnabled(false);
                  setIsPlaying(false);
                  setChatMessages(prev => [...prev, {
                    sender: 'system',
                    message: '🎉 انتهى العرض! أحسنت',
                    timestamp: new Date()
                  }]);
                }
              };

              audioRef.current.ontimeupdate = () => {
                if (audioRef.current) {
                  const progress = (audioRef.current.currentTime / audioRef.current.duration) * 100;
                  setAudioProgress(progress);
                }
              };

              audioRef.current.onerror = () => {
                console.error('❌ Next slide audio failed');
                setAudioDuration(0);
                // استخدم التايمر كبديل
                if (autoPlayEnabled) {
                  setTimeout(() => {
                    if (newIndex < slides.length - 1) {
                      nextSlide();
                    }
                  }, 15000);
                }
              };

              try {
                await audioRef.current.play();
                console.log('▶️ Playing next slide audio');
              } catch (playError) {
                console.error('❌ Failed to play next audio:', playError);
                // Fallback للتايمر
                if (autoPlayEnabled) {
                  setTimeout(() => {
                    if (newIndex < slides.length - 1) {
                      nextSlide();
                    }
                  }, 15000);
                }
              }
            } else {
              console.log('⏱️ No audio for next slide, using timer...');
              if (autoPlayEnabled) {
                setTimeout(() => {
                  if (newIndex < slides.length - 1) {
                    nextSlide();
                  }
                }, 15000);
              }
            }
          } catch (error) {
            console.error('❌ Error loading next slide audio:', error);
            // Fallback للتايمر
            if (autoPlayEnabled) {
              setTimeout(() => {
                if (newIndex < slides.length - 1) {
                  nextSlide();
                }
              }, 15000);
            }
          } finally {
            setIsAudioLoading(false);
          }
        }
      }
    }
  };

  const previousSlide = () => {
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;

      // Track slide change
      trackActivity('slide_viewed', {
        lessonId,
        slideIndex: newIndex,
        slideContent: slides[newIndex]?.title || `Slide ${newIndex + 1}`,
        direction: 'previous'
      });

      setCurrentIndex(newIndex);
      setIsPlaying(false);
      if (audioRef.current) {
        audioRef.current.pause();
      }
    }
  };

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      setAutoPlayEnabled(false);
      setIsPlaying(false);
    };
  }, []);

  // Loading screen
  if (loading || generating) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader className="w-12 h-12 animate-spin text-primary-500 mx-auto mb-4" />
          <p className="text-lg mb-2">
            {generating ? 'جاري توليد الشرائح التفاعلية...' : 'جاري تحضير الفصل...'}
          </p>
          {generating && (
            <>
              <div className="w-64 mx-auto bg-gray-200 rounded-full h-2 mb-2">
                <div
                  className="bg-primary-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${generationProgress}%` }}
                />
              </div>
              <p className="text-sm text-gray-600">
                {generationProgress < 30 && "تحليل المحتوى..."}
                {generationProgress >= 30 && generationProgress < 60 && "توليد الشرائح..."}
                {generationProgress >= 60 && generationProgress < 90 && "إضافة التفاعلات..."}
                {generationProgress >= 90 && "يكاد ينتهي..."}
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  // Main UI
  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm p-4 flex justify-between items-center">
        <Button variant="ghost" onClick={() => router.back()}>
          رجوع
        </Button>

        <h1 className="text-xl font-bold">الفصل التفاعلي</h1>

        <Button
          variant={isHandRaised ? 'primary' : 'outline'}
          onClick={handleRaiseHand}
          className="transition-all duration-300"
        >
          <Hand className={`h-4 w-4 ml-2 ${isHandRaised ? 'animate-pulse' : ''}`} />
          {isHandRaised ? 'يدك مرفوعة' : 'ارفع يدك'}
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 flex">
        {/* الشريحة - 70% */}
        <div className="flex-1 p-4">
          <Card className="h-full p-6 flex flex-col">
            {/* محتوى الشريحة */}
            <div className="flex-1 overflow-hidden">
              {currentSlide ? (
                <div className="h-full">
                  <SlideViewer 
                    htmlContent={generateHTMLFromSlide(currentSlide)} 
                    className="h-full"
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400">
                  لا توجد شرائح
                </div>
              )}
            </div>

            {/* أدوات التحكم */}
            <div className="mt-4 pt-4 border-t flex justify-between items-center">
              <div className="flex gap-2 items-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={previousSlide}
                  disabled={currentIndex === 0}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>

                <span className="px-3 py-2 text-sm">
                  {currentIndex + 1} / {slides.length || 1}
                </span>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={nextSlide}
                  disabled={currentIndex === slides.length - 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex gap-2 items-center">
                {/* Save Progress Button - Always visible */}
                <Button
                  variant="outline"
                  onClick={saveProgress}
                  disabled={isSavingProgress || slides.length === 0}
                  className="transition-all duration-200"
                >
                  {isSavingProgress ? (
                    <>
                      <Loader className="h-4 w-4 ml-2 animate-spin" />
                      جاري الحفظ...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 ml-2" />
                      حفظ التقدم
                    </>
                  )}
                </Button>

                {/* Complete Lesson Button - Only on last slide */}
                {currentIndex === slides.length - 1 && slides.length > 0 && (
                  <Button
                    variant="primary"
                    onClick={completeLesson}
                    disabled={isCompleting}
                    className="bg-green-600 hover:bg-green-700 text-white transition-all duration-200"
                  >
                    {isCompleting ? (
                      <>
                        <Loader className="h-4 w-4 ml-2 animate-spin" />
                        جاري الحفظ...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 ml-2" />
                        أنهيت الدرس
                      </>
                    )}
                  </Button>
                )}

                {/* Play/Pause Button */}
                <Button
                  variant={isPlaying ? 'secondary' : 'primary'}
                  onClick={handlePlayPause}
                  disabled={!currentSlide}
                >
                  {isPlaying ? (
                    <>
                      <Pause className="h-4 w-4 ml-2" />
                      إيقاف
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 ml-2" />
                      تشغيل الشرح
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* شريط التقدم للصوت */}
            {isPlaying && audioDuration > 0 && (
              <div className="mt-4 space-y-2">
                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-blue-600 h-full transition-all duration-300"
                    style={{ width: `${audioProgress}%` }}
                  />
                </div>

                <div className="flex justify-between text-xs text-gray-600">
                  <span>{audioRef.current ? Math.floor(audioRef.current.currentTime) : 0}s</span>
                  <span>{Math.floor(audioDuration)}s</span>
                </div>

                {isAudioLoading && (
                  <div className="text-center text-sm text-blue-600">
                    جاري تحميل الصوت...
                  </div>
                )}
              </div>
            )}

            {isPlaying && !audioDuration && !isAudioLoading && (
              <div className="mt-2 text-center text-sm text-yellow-600">
                سيتم الانتقال للشريحة التالية بعد 15 ثانية
              </div>
            )}
          </Card>
        </div>

        {/* المساعد الذكي - 30% */}
        <div className={`transition-all duration-300 ${showChat ? 'w-96' : 'w-96'} bg-white border-l p-4 flex flex-col`}>
          <h2 className="font-bold mb-4 flex items-center justify-between">
            <span className="flex items-center">
              <MessageCircle className="h-5 w-5 ml-2" />
              المساعد الذكي
            </span>
            {isHandRaised && (
              <Sparkles className="h-4 w-4 text-yellow-500 animate-pulse" />
            )}
          </h2>

          {/*   Quick Actions */}
          {quickSuggestions.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {quickSuggestions.map((suggestion, i) => (
                <button
                  key={i}
                  onClick={() => handleQuickAction(suggestion)}
                  className="px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-xs hover:bg-primary-200 transition-colors"
                  disabled={!isHandRaised}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          {/* الرسائل */}
          <div ref={chatContainerRef} className="flex-1 overflow-y-auto mb-4 p-2">
            {chatMessages.length === 0 ? (
              <div className="text-center text-gray-400 mt-8">
                <p className="text-lg">مرحباً! أنا هنا للمساعدة 🎓</p>
                <p className="text-sm mt-2">ارفع يدك واسأل أي سؤال</p>
                <p className="text-xs mt-4 text-gray-300">
                  يمكنني الشرح، إعطاء أمثلة، حل مسائل، وأكثر!
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {chatMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-lg text-sm animate-fadeIn ${
                      msg.sender === 'user'
                        ? 'bg-primary-500 text-white mr-8'
                        : msg.sender === 'assistant'
                        ? 'bg-gray-100'
                        : 'bg-yellow-50 text-center text-xs'
                    }`}
                  >
                    {msg.message}
                    {/*   عرض الاقتراحات في الرسالة */}
                    {msg.suggestions && msg.suggestions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {msg.suggestions.map((sugg, idx) => (
                          <button
                            key={idx}
                            onClick={() => {
                              setInputMessage(sugg);
                              // Focus على input
                              const input = document.querySelector('input[type="text"]') as HTMLInputElement;
                              if (input) input.focus();
                            }}
                            className="px-2 py-1 bg-white border border-gray-300 rounded-full text-xs hover:bg-gray-50 transition-colors"
                          >
                            {sugg}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* إدخال الرسالة */}
          <div className="flex gap-2">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              placeholder={isHandRaised ? "اكتب سؤالك..." : "ارفع يدك أولاً للسؤال"}
              className="flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              disabled={!isHandRaised}
            />
            <Button
              onClick={sendMessage}
              disabled={!inputMessage.trim() || !isHandRaised}
              size="sm"
              className="min-w-[60px]"
            >
              إرسال
            </Button>
          </div>

          {!isHandRaised && (
            <p className="text-xs text-gray-500 mt-2 text-center animate-pulse">
              ارفع يدك من الأعلى للتفاعل مع المساعد الذكي ✋
            </p>
          )}
        </div>
      </div>

      {/* Audio element مخفي */}
      <audio ref={audioRef} onEnded={() => setIsPlaying(false)} />

      {/* WebSocket Status (for debugging) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute bottom-4 left-4 text-xs text-gray-500">
          WS: {ws.isConnected ? '🟢' : '🔴'}
        </div>
      )}

      {/* Styles for animations */}
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}