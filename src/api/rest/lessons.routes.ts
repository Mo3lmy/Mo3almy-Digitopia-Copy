
// ✨ النسخة المحدثة مع Teaching Assistant + Slides + Voice

import { Router, Request, Response } from 'express';
import { prisma } from '../../config/database.config';
import { authenticate } from '../middleware/auth.middleware';
import { successResponse, errorResponse } from '../../utils/response.utils';
import asyncHandler from 'express-async-handler';
import rateLimit from 'express-rate-limit';

// ============= IMPORTS FOR SLIDES & VOICE =============
import { slideService, type SlideContent } from '../../services/slides/slide.service';
import { voiceService } from '../../services/voice/voice.service';

// =============   QUEUE IMPORTS =============
import slideQueue from '../../services/queue/slide-generation.queue';

// =============   TEACHING ASSISTANT IMPORT =============
import {
  teachingAssistant,
  type InteractionType,
  createTeachingAPIHandler
} from '../../services/teaching/teaching-assistant.service';

// =============   CACHE IMPORT =============
import { enrichedContentCache } from '../../services/cache/enriched-content.cache';

import { z } from 'zod';

const router = Router();

// Helper function to ensure bullets are strings - OLD VERSION (COMMENTED)
/*
const ensureString = (item: any): string => {
  // إذا كان string، أرجعه مباشرة
  if (typeof item === 'string') return item;

  // إذا كان null أو undefined
  if (!item) return '';

  // إذا كان object
  if (typeof item === 'object') {
    // حاول استخراج النص من الحقول المختلفة
    const text = item.title || item.description || item.content ||
                 item.text || item.summary || item.example || '';

    // تحقق من أن النص لا يحتوي على placeholder
    if (text && !text.includes('[') && !text.includes(']')) {
      return text;
    }

    // إذا كان هناك حقول متعددة، اجمعها
    if (item.title && item.description) {
      const combined = `${item.title}: ${item.description}`;
      // تحقق من عدم وجود placeholders
      if (!combined.includes('[') && !combined.includes(']')) {
        return combined;
      }
    }

    // إذا كان هناك problem و solution (للأمثلة)
    if (item.problem && item.solution) {
      return `${item.problem} - ${item.solution}`;
    }

    // كملاذ أخير، حاول أي حقل نصي
    const anyText = Object.values(item).find(v =>
      typeof v === 'string' && v.length > 0 &&
      !v.includes('[') && !v.includes(']')
    );
    if (anyText) return anyText as string;

    // إذا فشل كل شيء، أرجع string فارغ بدلاً من [object Object]
    return '';
  }

  // لأي نوع آخر
  return String(item);
};
*/

// دالة محسّنة لتحويل أي نوع بيانات إلى نص قابل للعرض
const ensureString = (item: any): string => {
  // إذا كان نص، أرجعه مباشرة
  if (typeof item === 'string') return item;

  // إذا كان null أو undefined
  if (!item) return '';

  // إذا كان رقم أو boolean
  if (typeof item === 'number' || typeof item === 'boolean') {
    return String(item);
  }

  // إذا كان object
  if (typeof item === 'object') {
    // جرب الحقول المعتادة أولاً
    if (item.title) return item.title;
    if (item.description) return item.description;
    if (item.content) return item.content;
    if (item.text) return item.text;
    if (item.name) return item.name;
    if (item.value) return item.value;

    // للأمثلة التعليمية
    if (item.problem && item.solution) {
      return `${item.problem} - الحل: ${item.solution}`;
    }

    // للتمارين
    if (item.question) {
      return item.question;
    }

    // للنصائح
    if (item.tip) return item.tip;
    if (item.note) return item.note;

    // إذا كان array
    if (Array.isArray(item)) {
      return item.map(i => ensureString(i)).join(', ');
    }

    // كملاذ أخير، لا ترجع [object Object]
    // بدلاً من ذلك، ارجع نص فارغ أو وصف بسيط
    return ''; // أفضل من [object Object]
  }

  // أي حالة أخرى
  return '';
};

// دالة لتنظيف مصفوفة من البيانات وتحويلها لنصوص
const cleanBullets = (items: any): string[] => {
  if (!Array.isArray(items)) return [];

  return items
    .map(item => ensureString(item))
    .filter(text => text && text.length > 0); // احذف الفراغات
};

// Clean slide data to ensure all fields are strings
const cleanSlideData = (slide: any): any => {
  const ensureStringClean = (item: any): string => {
    if (typeof item === 'string') return item;
    if (!item) return '';
    if (typeof item === 'object') {
      return item.title || item.description || item.content ||
             item.summary || item.text || JSON.stringify(item);
    }
    return String(item);
  };

  return {
    ...slide,
    content: ensureStringClean(slide.content),
    bullets: slide.bullets?.map(ensureStringClean),
    subtitle: ensureStringClean(slide.subtitle || ''),
    title: ensureStringClean(slide.title || '')
  };
};

// Rate limiter for status endpoint - 30 req/min
const statusRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: 'Too many status requests, please try again later'
});

// ============= EXISTING VALIDATION SCHEMAS =============

// Validation schemas for slides
const slideGenerationSchema = z.object({
  type: z.enum(['title', 'content', 'bullet', 'image', 'equation', 'quiz', 'summary']).optional(),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  content: z.string().optional(),
  bullets: z.array(z.string()).optional(),
  imageUrl: z.string().url().optional(),
  equation: z.string().optional(),
  quiz: z.object({
    question: z.string(),
    options: z.array(z.string()),
    correctIndex: z.number().optional()
  }).optional(),
  theme: z.enum(['default', 'dark', 'kids']).optional(),
  generateVoice: z.boolean().optional()
});

// Validation schema for voice generation
const voiceGenerationSchema = z.object({
  voiceId: z.string().optional(),
  speed: z.number().min(0.5).max(2).optional(),
  stability: z.number().min(0).max(1).optional(),
  similarityBoost: z.number().min(0).max(1).optional()
});

// =============   TEACHING VALIDATION SCHEMAS =============

// Teaching script generation schema
const teachingScriptSchema = z.object({
  slideContent: z.object({
    type: z.string().optional(),
    title: z.string().optional(),
    subtitle: z.string().optional(),
    content: z.string().optional(),
    bullets: z.array(z.string()).optional(),
    quiz: z.any().optional(),
    metadata: z.any().optional()
  }).optional(),
  generateVoice: z.boolean().optional(),
  options: z.object({
    voiceStyle: z.enum(['friendly', 'formal', 'energetic']).optional(),
    paceSpeed: z.enum(['slow', 'normal', 'fast']).optional(),
    useAnalogies: z.boolean().optional(),
    useStories: z.boolean().optional(),
    needMoreDetail: z.boolean().optional(),
    needExample: z.boolean().optional(),
    needProblem: z.boolean().optional(),
    problemDifficulty: z.enum(['easy', 'medium', 'hard']).optional()
  }).optional()
});

// Student interaction schema
const interactionSchema = z.object({
  type: z.string(), // أي نوع تفاعل
  slideContent: z.any().optional(),
  currentSlide: z.any().optional(),
  context: z.any().optional()
});

// Smart lesson generation schema
const smartLessonSchema = z.object({
  theme: z.enum(['default', 'dark', 'kids']).optional(),
  generateVoice: z.boolean().optional(),
  teachingOptions: z.object({
    voiceStyle: z.enum(['friendly', 'formal', 'energetic']).optional(),
    paceSpeed: z.enum(['slow', 'normal', 'fast']).optional(),
    useAnalogies: z.boolean().optional(),
    useStories: z.boolean().optional()
  }).optional()
});

// Store generation status (in production, use Redis)
const voiceGenerationStatus = new Map<string, any>();
const teachingSessionStatus = new Map<string, any>(); //  
//   Initialize Teaching API handler
const teachingAPI = createTeachingAPIHandler();

// =============   TEACHING ASSISTANT ENDPOINTS =============

/**
 * @route   POST /api/v1/lessons/:id/teaching/script
 * @desc    Generate teaching script for a slide
 * @access  Private
 */
router.post(
  '/:id/teaching/script',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.user!.userId;
    
    // Validate request
    const validationResult = teachingScriptSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      res.status(400).json(
        errorResponse('VALIDATION_ERROR', 'بيانات غير صحيحة', validationResult.error.issues)
      );
      return;
    }
    
    const data = validationResult.data;
    
    // Get user grade
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { grade: true, firstName: true }
    });
    
    if (!user) {
      res.status(404).json(
        errorResponse('USER_NOT_FOUND', 'المستخدم غير موجود')
      );
      return;
    }
    
    // Check if slideContent is provided, if not try to get it from slideId or slideIndex
    let slideContent = data.slideContent;

    // If slideId or slideIndex is provided instead of slideContent, create default content
    if (!slideContent && (req.body.slideId || req.body.slideIndex !== undefined)) {
      try {
        // Get lesson with content to extract slides
        const lesson = await prisma.lesson.findUnique({
          where: { id },
          include: { content: true }
        });

        if (!lesson?.content) {
          res.status(404).json(
            errorResponse('LESSON_NOT_FOUND', 'الدرس غير موجود')
          );
          return;
        }

        // Create a default slide content based on lesson
        slideContent = {
          type: 'content',
          title: lesson.titleAr || lesson.title,
          content: lesson.content.summary || lesson.description || 'محتوى الدرس',
          bullets: []
        };

        // Try to get key points
        if (lesson.keyPoints) {
          try {
            const keyPoints = typeof lesson.keyPoints === 'string'
              ? JSON.parse(lesson.keyPoints)
              : lesson.keyPoints;
            if (Array.isArray(keyPoints)) {
              slideContent.bullets = keyPoints;
            }
          } catch (e) {
            console.warn('Failed to parse key points:', e);
          }
        }

      } catch (error) {
        console.error('Error fetching slide content:', error);
        slideContent = {
          type: 'content',
          title: 'محتوى الدرس',
          content: 'شرح الدرس',
          bullets: []
        };
      }
    }

    // Validate slideContent exists
    if (!slideContent) {
      res.status(400).json(
        errorResponse('MISSING_SLIDE_CONTENT', 'محتوى الشريحة مطلوب')
      );
      return;
    }

    console.log('🎓 Generating teaching script for lesson:', id, 'with content:', JSON.stringify(slideContent, null, 2));

    // Force intelligent mode
    const forceIntelligent = true;

    // Generate teaching script with error handling
    let teachingScript;
    try {
      teachingScript = await teachingAssistant.generateTeachingScript({
        slideContent,
        lessonId: id,
        studentGrade: user.grade || 6,
        studentName: user.firstName || 'الطالب',
        // IMPORTANT: Tell it NOT to just read
        interactionType: data.options?.needExample ? 'example' :
                        data.options?.needProblem ? 'problem' :
                        data.options?.needMoreDetail ? 'more_detail' :
                        slideContent.type === 'example' ? 'example' : 'explain',
        ...data.options
      });

      console.log('📊 Generated script:', {
        length: teachingScript.script.length,
        words: teachingScript.script.split(' ').length,
        isReading: teachingScript.script.includes(slideContent?.content || '') // Check if just reading
      });
    } catch (scriptError) {
      console.error('❌ Teaching script generation failed:', scriptError);

      // Return a fallback script
      teachingScript = {
        script: `مرحباً ${user.firstName || 'بالطالب'}، دعنا نتعلم عن ${slideContent?.title || 'هذا الموضوع'}`,
        duration: 10,
        keyPoints: [],
        examples: [],
        problem: null,
        visualCues: [],
        interactionPoints: [],
        emotionalTone: 'encouraging',
        nextSuggestions: ['المتابعة للشريحة التالية']
      };
    }
    
    // Generate voice if requested
    let audioUrl: string | null = null;

    if (data.generateVoice && teachingScript.script) {
      try {
        const voiceResult = await voiceService.textToSpeech(teachingScript.script);

        if (voiceResult.success) {
          audioUrl = voiceResult.audioUrl || null;
          console.log('✅ Voice generated successfully');
        } else {
          // Voice failed but we continue without it
          console.log('⚠️ Voice not available:', voiceResult.error);
          // Don't set error - just continue without audio
        }
      } catch (voiceError) {
        // Unexpected error - log but continue
        console.log('⚠️ Voice generation skipped due to error');
      }
    }
    
    // Always return success response
    res.json(
      successResponse({
        lessonId: id,
        script: teachingScript.script,
        duration: teachingScript.duration,
        keyPoints: teachingScript.keyPoints,
        examples: teachingScript.examples,
        problem: teachingScript.problem,
        visualCues: teachingScript.visualCues,
        interactionPoints: teachingScript.interactionPoints,
        emotionalTone: teachingScript.emotionalTone,
        nextSuggestions: teachingScript.nextSuggestions,
        audioUrl: audioUrl // Will be null if voice failed
      }, 'Teaching script generated successfully')
    );
  })
);

/**
 * @route   POST /api/v1/lessons/:id/teaching/interaction
 * @desc    Handle student interaction
 * @access  Private
 */
router.post(
  '/:id/teaching/interaction',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.user!.userId;
    
    // Validate request
    const validationResult = interactionSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      res.status(400).json(
        errorResponse('VALIDATION_ERROR', 'بيانات غير صحيحة', validationResult.error.issues)
      );
      return;
    }
    
    const data = validationResult.data;

    // ✅ تم إزالة workaround - userMessage الآن يأتي مباشرة في context
    if (!data.context) {
      data.context = {};
    }

    // 🔴🔴🔴 CRITICAL DEBUG LOGS 🔴🔴🔴
    console.log('\n🔴🔴🔴 TEACHING INTERACTION RECEIVED 🔴🔴🔴');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Lesson ID:', id);
    console.log('User ID:', userId);
    console.log('Request Type:', data.type);
    console.log('Has SlideContent:', !!data.slideContent);
    console.log('Has Context:', !!data.context);
    console.log('Context UserMessage:', data.context?.userMessage || 'NOT FOUND!');
    console.log('Full Context:', JSON.stringify(data.context, null, 2));
    console.log('🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴\n');

    // Warning if userMessage is missing
    if (!data.context?.userMessage) {
      console.error('⚠️ WARNING: userMessage is missing from context!');
      console.log('Full data received:', JSON.stringify(data, null, 2));
    }

    // توحيد البيانات للتوافق
    const slideContent = data.slideContent || data.currentSlide || {
      type: 'content',
      title: 'محتوى تفاعلي',
      content: 'درس'
    };

    // تحويل type للـ enum المطلوب
    const validTypes = ['explain', 'more_detail', 'example', 'problem', 'repeat',
                       'continue', 'stop', 'quiz', 'summary', 'motivate',
                       'simplify', 'application'];

    const interactionType = validTypes.includes(data.type) ? data.type : 'explain';

    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { grade: true, firstName: true }
    });

    if (!user) {
      res.status(404).json(
        errorResponse('USER_NOT_FOUND', 'المستخدم غير موجود')
      );
      return;
    }

    try {
      // Handle interaction - returns TeachingScript
      const teachingScript = await teachingAssistant.handleStudentInteraction(
        interactionType as InteractionType,
        slideContent,
        id,
        user.grade || 6,
        {
          studentName: user.firstName,
          ...data.context
        }
      );

      // Generate voice (optional, handle errors gracefully)
      let audioUrl = null;
      try {
        const voiceResult = await voiceService.textToSpeech(teachingScript.script);
        audioUrl = voiceResult.audioUrl;
      } catch (voiceError) {
        console.log('Voice generation skipped:', voiceError);
      }

      // Format as InteractionResponse
      const interactionResponse = {
        type: data.type,
        message: teachingScript.script,
        script: teachingScript.script,
        duration: teachingScript.duration || 5,
        audioUrl: audioUrl,
        action: 'continue',
        emotionalTone: teachingScript.emotionalTone || 'friendly',
        nextSuggestions: teachingScript.nextSuggestions || []
      };

      res.json(
        successResponse(interactionResponse, 'Interaction handled successfully')
      );
    } catch (error) {
      console.error('Error in teaching interaction:', error);

      // Return a fallback response
      res.json(
        successResponse({
          type: data.type,
          message: 'دعني أساعدك في فهم هذا الموضوع بشكل أفضل.',
          script: 'دعني أساعدك في فهم هذا الموضوع بشكل أفضل.',
          duration: 5,
          audioUrl: null,
          action: 'continue',
          emotionalTone: 'supportive',
          nextSuggestions: ['اطلب مثال', 'اشرح أكثر', 'تابع']
        }, 'Interaction handled with fallback')
      );
    }
  })
);

/**
 * @route   POST /api/v1/lessons/:id/teaching/problem
 * @desc    Generate educational problem
 * @access  Private
 */
router.post(
  '/:id/teaching/problem',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.user!.userId;
    const { 
      topic, 
      difficulty = 'medium',
      generateVoice = true 
    } = req.body;
    
    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { grade: true, firstName: true }
    });
    
    if (!user) {
      res.status(404).json(
        errorResponse('USER_NOT_FOUND', 'المستخدم غير موجود')
      );
      return;
    }
    
    // Generate problem
    const response = await teachingAssistant.generateTeachingScript({
      slideContent: { title: topic },
      lessonId: id,
      studentGrade: user.grade || 6,
      studentName: user.firstName,
      needProblem: true,
      problemDifficulty: difficulty as 'easy' | 'medium' | 'hard'
    });
    
    // Generate voice if requested
    let audioUrl: string | null = null;
    if (generateVoice && response.script) {
      const voiceResult = await voiceService.textToSpeech(response.script);
      if (voiceResult.success) {
        audioUrl = voiceResult.audioUrl || null;
      }
    }
    
    res.json(
      successResponse({
        lessonId: id,
        script: response.script,
        problem: response.problem,
        duration: response.duration,
        audioUrl
      }, 'Problem generated successfully')
    );
  })
);

// ============= DYNAMIC SLIDE SYSTEM FUNCTIONS =============

// دالة لحساب العدد الأمثل للشرائح حسب المحتوى
const calculateOptimalSlideCount = (lesson: any, enrichedData: any, userGrade?: number): number => {
  let baseCount = 5; // الحد الأدنى (عنوان + مقدمة + محتوى + ملخص + خاتمة)

  // أضف شرائح حسب المحتوى المتاح
  if (enrichedData?.examples?.length > 0) {
    baseCount += Math.min(3, enrichedData.examples.length); // حتى 3 شرائح للأمثلة
  }

  if (enrichedData?.realWorldApplications?.length > 0) {
    baseCount += 1;
  }

  if (enrichedData?.exercises?.length > 0) {
    baseCount += Math.min(2, Math.ceil(enrichedData.exercises.length / 3));
  }

  if (enrichedData?.educationalStories?.length > 0) {
    baseCount += 1;
  }

  if (enrichedData?.challenges?.length > 0) {
    baseCount += 1;
  }

  if (enrichedData?.commonMistakes?.length > 0) {
    baseCount += 1;
  }

  if (enrichedData?.studentTips?.length > 0) {
    baseCount += 1;
  }

  // حسب صعوبة الدرس
  if (lesson.difficulty === 'HARD') {
    baseCount += 2; // شرائح إضافية للشرح
  } else if (lesson.difficulty === 'EASY') {
    baseCount = Math.max(5, baseCount - 1);
  }

  // حسب الصف الدراسي
  const grade = userGrade || 6;
  if (grade <= 6) {
    baseCount += 1; // شرائح إضافية للصغار (ألعاب، صور)
  }

  return Math.min(25, Math.max(8, baseCount)); // بين 8-25 شريحة
};

// دالة لتقسيم النص الطويل إلى شرائح متعددة
const splitContentIntoSlides = (content: string, maxSlides: number): string[] => {
  if (!content) return [];

  // تقسيم حسب الفقرات أولاً
  const paragraphs = content.split(/\n\n+/).filter(p => p.trim().length > 0);

  if (paragraphs.length <= maxSlides) {
    return paragraphs;
  }

  // إذا الفقرات أكثر من العدد المطلوب، ادمج بعضها
  const slides: string[] = [];
  const itemsPerSlide = Math.ceil(paragraphs.length / maxSlides);

  for (let i = 0; i < paragraphs.length; i += itemsPerSlide) {
    const chunk = paragraphs.slice(i, i + itemsPerSlide).join('\n\n');

    // تأكد أن الشريحة ليست طويلة جداً (حد أقصى 500 حرف)
    if (chunk.length > 500) {
      slides.push(chunk.substring(0, 500) + '...');
    } else {
      slides.push(chunk);
    }
  }

  return slides;
};

// دالة لبناء شرائح ديناميكية حسب المحتوى
const buildDynamicSlides = async (
  lesson: any,
  enrichedData: any,
  targetSlideCount: number,
  userGrade?: number
): Promise<SlideContent[]> => {
  const slides: SlideContent[] = [];

  // 1. الشريحة الأولى - العنوان (دائماً)
  slides.push({
    type: 'title',
    title: lesson.titleAr || lesson.title,
    subtitle: lesson.unit?.subject?.nameAr || lesson.unit?.subject?.name || ''
  });

  // 2. المقدمة (إذا وُجدت)
  if (lesson.description) {
    slides.push({
      type: 'content',
      title: 'مقدمة الدرس',
      content: lesson.description
    });
  }

  // 3. الأهداف التعليمية (إذا وُجدت)
  if (enrichedData?.learningObjectives && enrichedData.learningObjectives.length > 0) {
    slides.push({
      type: 'bullet',
      title: '🎯 أهداف الدرس',
      subtitle: 'بنهاية هذا الدرس ستكون قادراً على:',
      bullets: cleanBullets(enrichedData.learningObjectives)
    });
  }

  // 4. المحتوى الأساسي - قسّمه لشرائح متعددة إذا كان طويلاً
  if (lesson.content?.fullText || lesson.content?.summary) {
    const mainContent = lesson.content.fullText || lesson.content.summary;
    const contentChunks = splitContentIntoSlides(
      mainContent,
      Math.max(2, Math.floor(targetSlideCount * 0.3)) // 30% للمحتوى الأساسي
    );

    contentChunks.forEach((chunk, i) => {
      slides.push({
        type: 'content',
        title: i === 0 ? 'الشرح الأساسي' : `تابع: ${lesson.titleAr || lesson.title}`,
        content: chunk
      });
    });
  }

  // 5. الأمثلة - ديناميكي حسب المتاح
  if (enrichedData?.examples && enrichedData.examples.length > 0) {
    // شريحة لكل مثال (حد أقصى 3)
    const richExamples = enrichedData.examples.filter((ex: any) =>
      ex && (ex.problem || ex.description || ex.title || ex.content)
    );

    for (let i = 0; i < Math.min(3, richExamples.length); i++) {
      const example = richExamples[i];
      const exampleBullets = [];

      if (example.solution) exampleBullets.push(`الحل: ${ensureString(example.solution)}`);
      if (example.explanation) exampleBullets.push(`الشرح: ${ensureString(example.explanation)}`);

      slides.push({
        type: 'example',
        title: `📝 مثال ${i + 1}`,
        content: ensureString(example.problem || example.description || example.content),
        bullets: exampleBullets.length > 0 ? exampleBullets : undefined
      });
    }
  }

  // 6. التمارين التفاعلية
  if (enrichedData?.exercises && enrichedData.exercises.length > 0) {
    const exercise = enrichedData.exercises[0];
    if (exercise.type === 'multiple_choice' && exercise.options) {
      slides.push({
        type: 'quiz',
        title: '📋 تمرين تفاعلي',
        quiz: {
          question: exercise.question,
          options: exercise.options,
          correctIndex: exercise.correctAnswer || 0,
          explanation: exercise.explanation
        }
      });
    }
  }

  // 7. إضافة شرائح حسب الحاجة للوصول للعدد المستهدف
  const currentCount = slides.length;

  if (currentCount < targetSlideCount - 2) { // -2 للملخص والخاتمة
    // أضف شرائح إضافية حسب المتاح

    if (enrichedData?.realWorldApplications?.length > 0) {
      slides.push({
        type: 'bullet',
        title: '🌍 التطبيقات في الحياة الواقعية',
        bullets: cleanBullets(enrichedData.realWorldApplications.slice(0, 5))
      });
    }

    if (enrichedData?.commonMistakes?.length > 0) {
      slides.push({
        type: 'bullet',
        title: '⚠️ أخطاء شائعة يجب تجنبها',
        bullets: cleanBullets(enrichedData.commonMistakes.slice(0, 4))
      });
    }

    if (enrichedData?.studentTips?.length > 0) {
      slides.push({
        type: 'tips',
        title: '💡 نصائح للدراسة',
        bullets: cleanBullets(enrichedData.studentTips.slice(0, 4))
      });
    }

    if (enrichedData?.educationalStories?.length > 0) {
      const story = enrichedData.educationalStories[0];
      const storyContent = ensureString(story.story || story.content || story);
      if (storyContent && storyContent.length > 20) {
        slides.push({
          type: 'story',
          title: '📖 قصة تعليمية',
          subtitle: story.title || 'دعنا نتعلم من خلال القصة',
          content: storyContent
        });
      }
    }

    if (enrichedData?.challenges?.length > 0) {
      const challenge = enrichedData.challenges[0];
      const challengeContent = ensureString(challenge.question || challenge.description || challenge);
      if (challengeContent && challengeContent.length > 20) {
        slides.push({
          type: 'interactive',
          title: '🏆 تحدي للمتميزين',
          content: challengeContent
        });
      }
    }

    if (enrichedData?.funFacts?.length > 0) {
      slides.push({
        type: 'bullet',
        title: '🎓 هل تعلم؟',
        bullets: cleanBullets(enrichedData.funFacts.slice(0, 3))
      });
    }
  }

  // 8. الملخص (دائماً)
  const keyPoints = JSON.parse(lesson.keyPoints || '[]');
  slides.push({
    type: 'summary',
    title: 'ملخص الدرس',
    subtitle: lesson.titleAr || lesson.title,
    bullets: cleanBullets(keyPoints.slice(0, 5))
  });

  // 9. الخاتمة والتشجيع (دائماً)
  slides.push({
    type: 'content',
    title: '🎉 أحسنت!',
    content: `لقد أكملت درس "${lesson.titleAr || lesson.title}" بنجاح. استمر في التعلم والممارسة!`
  });

  return slides;
};

/**
 * @route   POST /api/v1/lessons/:id/teaching/smart-lesson
 * @desc    Generate complete smart lesson with teaching scripts
 * @access  Private
 */
router.post(
  '/:id/teaching/smart-lesson',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.user!.userId;
    
    // Validate request
    const validationResult = smartLessonSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      res.status(400).json(
        errorResponse('VALIDATION_ERROR', 'بيانات غير صحيحة', validationResult.error.issues)
      );
      return;
    }
    
    const data = validationResult.data;
    
    // Get user and lesson info
    const [user, lesson] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { grade: true, firstName: true }
      }),
      prisma.lesson.findUnique({
        where: { id },
        include: {
          content: true,
          unit: {
            include: {
              subject: true
            }
          }
        }
      })
    ]);
    
    if (!user) {
      res.status(404).json(
        errorResponse('USER_NOT_FOUND', 'المستخدم غير موجود')
      );
      return;
    }
    
    if (!lesson) {
      res.status(404).json(
        errorResponse('LESSON_NOT_FOUND', 'الدرس غير موجود')
      );
      return;
    }
    
    // ============= USE DYNAMIC SLIDE SYSTEM =============

    // Parse enriched content first
    let enrichedData: any = null;
    let hasRichContent = false;

    if (lesson.content?.enrichedContent) {
      try {
        enrichedData = typeof lesson.content.enrichedContent === 'string'
          ? JSON.parse(lesson.content.enrichedContent)
          : lesson.content.enrichedContent;

        // تحقق من جودة البيانات
        hasRichContent = enrichedData && (
          (enrichedData.examples?.length > 0) ||
          (enrichedData.realWorldApplications?.length > 0) ||
          (enrichedData.studentTips?.length > 0) ||
          (enrichedData.educationalStories?.length > 0)
        );

        console.log('📊 Enriched content quality check:', {
          hasExamples: enrichedData.examples?.length || 0,
          hasApplications: enrichedData.realWorldApplications?.length || 0,
          hasTips: enrichedData.studentTips?.length || 0,
          hasStories: enrichedData.educationalStories?.length || 0,
          hasChallenges: enrichedData.challenges?.length || 0,
          hasCommonMistakes: enrichedData.commonMistakes?.length || 0
        });

      } catch (e) {
        console.warn('Failed to parse enriched content:', e);
      }
    }

    // Calculate optimal slide count based on content
    const optimalSlideCount = calculateOptimalSlideCount(lesson, enrichedData, user?.grade || undefined);
    console.log(`🎯 Optimal slide count for this lesson: ${optimalSlideCount} slides`);

    // Build slides dynamically using the new system
    const slides = await buildDynamicSlides(lesson, enrichedData, optimalSlideCount, user?.grade || undefined);

    // Add grade metadata to all slides for adaptive theming
    const userGrade = user?.grade || 6;
    slides.forEach(slide => {
      slide.metadata = {
        ...slide.metadata,
        grade: userGrade
      };
    });

    // Log generated slides details
    console.log(`📊 Generated ${slides.length} slides for grade ${userGrade}:`);
    slides.forEach((slide, i) => {
      console.log(`  ${i + 1}. ${slide.type}: ${slide.title}`);
    });

    // Quality metrics for the generated slides
    const essentialSlides = slides.filter(s => s.type === 'title' || s.type === 'summary').length;
    const contentSlides = slides.filter(s => s.type === 'content').length;
    const exampleSlides = slides.filter(s => s.type === 'example').length;
    const interactiveSlides = slides.filter(s => s.type === 'quiz' || s.type === 'interactive').length;
    const bulletSlides = slides.filter(s => s.type === 'bullet' || s.type === 'tips').length;

    console.log(`📈 Slide quality metrics:
  - Essential slides: ${essentialSlides}
  - Content slides: ${contentSlides}
  - Example slides: ${exampleSlides}
  - Interactive slides: ${interactiveSlides}
  - Bullet/Tips slides: ${bulletSlides}
  - Total slides: ${slides.length}
    `);

    // Warning if content quality is low
    if (!hasRichContent) {
      console.log('⚠️ Enriched content insufficient for lesson:', id);
      console.log('💡 Consider enriching the content for better learning experience');
    }

    // OLD CODE COMMENTED OUT - KEEPING FOR REFERENCE
    /*
    // 1. Title slide
    slides.push({
      type: 'title',
      title: lesson.titleAr || lesson.title,
      subtitle: lesson.unit.subject.nameAr || lesson.unit.subject.name
    });
    */

    /* OLD STATIC SLIDE BUILDING CODE - REPLACED BY DYNAMIC SYSTEM
    // 2. Introduction slide (if description exists)
    if (lesson.description) {
      slides.push({
        type: 'content',
        title: 'مقدمة الدرس',
        content: lesson.description
      });
    }

    // 3. Main content slide
    if (lesson.content?.summary) {
      slides.push({
        type: 'content',
        title: 'شرح المفهوم الأساسي',
        content: lesson.content.summary
      });
    }

    // 4. Key points slide
    if (keyPoints.length > 0) {
      slides.push({
        type: 'bullet',
        title: 'النقاط الرئيسية',
        bullets: cleanBullets(keyPoints)
      });
    }

    // 5. Examples slides - بناء شريحة مفصلة لكل مثال مهم
    if (enrichedData?.examples && enrichedData.examples.length > 0) {
      // خذ أفضل الأمثلة (التي بها تفاصيل)
      const richExamples = enrichedData.examples.filter((ex: any) =>
        ex && (ex.problem || ex.description || ex.title || ex.content)
      );

      if (richExamples.length > 0) {
        // بناء شريحة لكل مثال مهم (حد أقصى 2)
        for (let i = 0; i < Math.min(2, richExamples.length); i++) {
          const example = richExamples[i];

          // شريحة مثال تفصيلية
          const exampleBullets = [];
          if (example.solution) exampleBullets.push(`الحل: ${ensureString(example.solution)}`);
          if (example.explanation) exampleBullets.push(`التفسير: ${ensureString(example.explanation)}`);
          if (example.steps) exampleBullets.push(`الخطوات: ${ensureString(example.steps)}`);
          if (example.result) exampleBullets.push(`النتيجة: ${ensureString(example.result)}`);

          slides.push({
            type: 'example',
            title: ensureString(example.type) || ensureString(example.title) || `مثال ${i + 1}`,
            content: ensureString(example.problem || example.description || example.content),
            bullets: exampleBullets.length > 0 ? exampleBullets : undefined
          });
        }

        // إذا كان هناك أمثلة إضافية، اجمعها في شريحة واحدة
        if (richExamples.length > 2) {
          const additionalExamples = richExamples.slice(2, 5);
          slides.push({
            type: 'bullet',
            title: 'أمثلة إضافية',
            bullets: cleanBullets(additionalExamples)
          });
        }
      }
    }

    // 6. Real world applications - بمحتوى حقيقي
    if (enrichedData?.realWorldApplications && enrichedData.realWorldApplications.length > 0) {
      const apps = cleanBullets(enrichedData.realWorldApplications.slice(0, 5));

      if (apps.length > 0) {
        slides.push({
          type: 'bullet',
          title: '🌍 التطبيقات في الحياة الواقعية',
          subtitle: 'كيف نستخدم هذا المفهوم في حياتنا اليومية؟',
          bullets: apps
        });
      }
    }

    // 7. Student tips slide (using new tips type)
    if (enrichedData?.studentTips && enrichedData.studentTips.length > 0) {
      const validTips = cleanBullets(enrichedData.studentTips.slice(0, 4));

      if (validTips.length > 0) {
        slides.push({
          type: 'tips',
          title: 'نصائح للطلاب',
          bullets: validTips
        });
      }
    }

    // 8. Educational story slide - محسنة
    if (enrichedData?.educationalStories && enrichedData.educationalStories.length > 0) {
      const story = enrichedData.educationalStories[0];
      if (story) {
        const storyContent = ensureString(story.story || story.content || story);
        if (storyContent && storyContent.length > 20) {
          slides.push({
            type: 'story',
            title: '📖 قصة تعليمية',
            subtitle: story.title || 'دعنا نتعلم من خلال القصة',
            content: storyContent,
            metadata: { duration: 20 }
          });
        }
      }
    }

    // 8.5 Challenges slide - للطلاب المتميزين
    if (enrichedData?.challenges && enrichedData.challenges.length > 0) {
      const challenge = enrichedData.challenges[0];
      if (challenge) {
        const challengeContent = ensureString(challenge.question || challenge.description || challenge);
        const hints = challenge.hints ? cleanBullets(challenge.hints) : [];

        if (challengeContent && challengeContent.length > 20) {
          slides.push({
            type: 'interactive',  // استخدام interactive بدلاً من challenge
            title: '🏆 تحدي للمتميزين',
            content: challengeContent,
            bullets: hints.length > 0 ? hints : undefined,
            metadata: { duration: 15 }
          });
        }
      }
    }

    // 9. Common mistakes slide
    if (enrichedData?.commonMistakes && enrichedData.commonMistakes.length > 0) {
      const validMistakes = cleanBullets(enrichedData.commonMistakes.slice(0, 4));

      if (validMistakes.length > 0) {
        slides.push({
          type: 'bullet',
          title: 'الأخطاء الشائعة وكيفية تجنبها',
          bullets: validMistakes
        });
      }
    }

    // 10. Practice exercise slide
    if (enrichedData?.exercises && enrichedData.exercises.length > 0) {
      const exercise = enrichedData.exercises[0];
      if (exercise.type === 'multiple_choice' && exercise.options) {
        slides.push({
          type: 'quiz',
          title: 'تمرين تطبيقي',
          quiz: {
            question: exercise.question,
            options: exercise.options,
            correctIndex: exercise.correctAnswer || 0,
            explanation: exercise.explanation
          }
        });
      } else {
        slides.push({
          type: 'content',
          title: 'تمرين تطبيقي',
          content: exercise.question || exercise.description || 'تمرين للتطبيق'
        });
      }
    }

    // 11. Fun facts slide (if available)
    if (enrichedData?.funFacts && enrichedData.funFacts.length > 0) {
      const validFacts = cleanBullets(enrichedData.funFacts.slice(0, 3));

      if (validFacts.length > 0) {
        slides.push({
          type: 'bullet',
          title: 'هل تعلم؟',
          bullets: validFacts
        });
      }
    }

    // 12. Quick review slide
    if (enrichedData?.quickReview) {
      slides.push({
        type: 'content',
        title: 'مراجعة سريعة',
        content: enrichedData.quickReview
      });
    }

    // 13. Summary slide (always last)
    slides.push({
      type: 'summary',
      title: 'خلاصة الدرس',
      subtitle: lesson.titleAr || lesson.title,
      bullets: cleanBullets(keyPoints.slice(0, 5))
    });
    END OF OLD STATIC CODE - ALL REPLACED BY DYNAMIC SYSTEM ABOVE */

    // Store generation status
    const statusKey = `smart_${id}_${userId}`;
    teachingSessionStatus.set(statusKey, {
      status: 'generating',
      progress: 0,
      totalSlides: slides.length,
      startedAt: new Date()
    });
    
    // Generate in background
    const generateSmartLesson = async () => {
      try {
        // Generate HTML slides with adaptive theme
        console.log(`🎨 Using adaptive theme for grade ${user.grade || 7}`);
        const htmlSlides = slideService.generateLessonSlides(
          slides,
          'adaptive',  // Always use adaptive theme
          user.grade || 7
        );
        console.log(`✅ Generated ${htmlSlides.length} HTML slides with adaptive theme`);

        // Generate teaching scripts
        const teachingScripts = await teachingAssistant.generateLessonScripts(
          slides,
          id,
          user.grade || 6,
          user.firstName
        );
        
        // Generate voices if requested
        const audioUrls: string[] = [];
        if (data.generateVoice) {
          for (const script of teachingScripts) {
            const voiceResult = await voiceService.textToSpeech(script.script);
            audioUrls.push(voiceResult.audioUrl || '');
          }
        }
        
        // Update status
        teachingSessionStatus.set(statusKey, {
          status: 'completed',
          progress: 100,
          totalSlides: slides.length,
          htmlSlides,
          slides: slides.map(cleanSlideData),  // تنظيف بيانات الشرائح قبل الحفظ
          teachingScripts,
          audioUrls,
          completedAt: new Date()
        });
        
      } catch (error: any) {
        teachingSessionStatus.set(statusKey, {
          status: 'failed',
          error: error.message,
          failedAt: new Date()
        });
      }
    };
    
    // Start generation
    generateSmartLesson();
    
    res.json(
      successResponse({
        lessonId: id,
        statusId: statusKey,
        totalSlides: slides.length,
        message: 'بدء توليد الدرس الذكي. استخدم endpoint الحالة لمتابعة التقدم'
      }, 'Smart lesson generation started')
    );
  })
);

/**
 * @route   GET /api/v1/lessons/:id/teaching/status
 * @desc    Get smart lesson generation status
 * @access  Private
 */
router.get(
  '/:id/teaching/status',
  statusRateLimiter,
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.user!.userId;
    const statusKey = `smart_${id}_${userId}`;
    
    const status = teachingSessionStatus.get(statusKey);
    
    if (!status) {
      res.json(
        successResponse({
          lessonId: id,
          status: 'idle',
          message: 'لا توجد عملية توليد نشطة'
        }, 'No active generation')
      );
      return;
    }
    
    // If completed, return full data
    if (status.status === 'completed') {
      res.json(
        successResponse({
          lessonId: id,
          status: 'completed',
          slides: status.slides || status.htmlSlides,
          teachingScripts: status.teachingScripts.map((s: any) => ({
            script: s.script,
            duration: s.duration,
            keyPoints: s.keyPoints,
            examples: s.examples,
            problem: s.problem,
            visualCues: s.visualCues,
            emotionalTone: s.emotionalTone
          })),
          audioUrls: status.audioUrls,
          totalSlides: status.totalSlides
        }, 'Smart lesson ready')
      );
      
      // Clean up status after retrieval
      teachingSessionStatus.delete(statusKey);
    } else {
      res.json(
        successResponse({
          lessonId: id,
          status: status.status,
          progress: status.progress,
          error: status.error
        }, 'Generation status')
      );
    }
  })
);

/**
 * @route   POST /api/v1/lessons/:id/teaching/assistant
 * @desc    Interact with teaching assistant
 * @access  Private
 */
router.post(
  '/:id/teaching/assistant',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { interactionType, context } = req.body;

    const response = await teachingAssistant.handleStudentInteraction(
      interactionType,
      context?.currentSlide || {},
      id,
      req.user!.grade || 6,
      context
    );

    res.json(successResponse(response, 'Teaching assistant response'));
  })
);

/**
 * @route   GET /api/v1/lessons/:id/teaching/stats
 * @desc    Get teaching assistant statistics
 * @access  Private
 */
router.get(
  '/:id/teaching/stats',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const stats = teachingAssistant.getHealthStatus();

    res.json(
      successResponse({
        lessonId: req.params.id,
        ...stats
      }, 'Teaching statistics retrieved')
    );
  })
);

/**
 * @route   POST /api/v1/lessons/:id/teaching/clear-cache
 * @desc    Clear teaching assistant cache
 * @access  Private (Admin only in production)
 */
router.post(
  '/:id/teaching/clear-cache',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    // In production, check for admin role
    // if (req.user!.role !== 'ADMIN') {
    //   return res.status(403).json(
    //     errorResponse('FORBIDDEN', 'غير مصرح')
    //   );
    // }
    
    teachingAssistant.clearCache();
    
    res.json(
      successResponse({
        message: 'تم مسح الذاكرة المؤقتة بنجاح'
      }, 'Cache cleared')
    );
  })
);

// ============= ENHANCED EXISTING ENDPOINTS =============

/**
 * @route   GET /api/v1/lessons/:id/slides
 * @desc    Generate all slides for a lesson (ENHANCED with teaching option)
 * @access  Private
 */
router.get(
  '/:id/slides',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const {
      theme = 'default',
      generateVoice = 'false',  // Default to false for performance
      generateTeaching = 'false' // Default to false for performance
    } = req.query as {
      theme?: string;
      generateVoice?: string;
      generateTeaching?: string;
    };
    const userId = req.user!.userId;
    
    // Get user and lesson
    const [user, lesson] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { grade: true, firstName: true }
      }),
      prisma.lesson.findUnique({
        where: { id },
        include: {
          unit: {
            include: {
              subject: true
            }
          },
          content: true
        }
      })
    ]);
    
    if (!lesson) {
      res.status(404).json(
        errorResponse('LESSON_NOT_FOUND', 'الدرس غير موجود')
      );
      return;
    }
    
    // Parse JSON fields
    const keyPoints = JSON.parse(lesson.keyPoints || '[]');
    
    // Build dynamic slide content based on enriched data
    const slides: SlideContent[] = [];

    // Get enriched content
    let enrichedData: any = null;
    if (lesson.content?.enrichedContent) {
      try {
        enrichedData = typeof lesson.content.enrichedContent === 'string'
          ? JSON.parse(lesson.content.enrichedContent)
          : lesson.content.enrichedContent;
      } catch (e) {
        console.warn('Failed to parse enriched content in slides endpoint:', e);
      }
    }

    // Determine user theme
    const userGrade = user?.grade || 6;

    // 1. Title slide
    slides.push({
      type: 'title',
      title: lesson.titleAr || lesson.title,
      subtitle: lesson.unit.subject.nameAr || lesson.unit.subject.name,
      metadata: { duration: 5, grade: userGrade }
    });

    // 2. Introduction slide
    if (lesson.description) {
      slides.push({
        type: 'content',
        title: 'مقدمة الدرس',
        content: lesson.description,
        metadata: { duration: 10, grade: userGrade }
      });
    }

    // 3. Main content slide
    if (lesson.content?.summary) {
      slides.push({
        type: 'content',
        title: 'شرح المفهوم الأساسي',
        content: lesson.content.summary,
        metadata: { duration: 15, grade: userGrade }
      });
    }

    // 4. Key points slide
    if (keyPoints.length > 0) {
      slides.push({
        type: 'bullet',
        title: 'النقاط الرئيسية',
        bullets: cleanBullets(keyPoints),
        metadata: { duration: 12, grade: userGrade }
      });
    }

    // 5. One example slide (not multiple)
    if (enrichedData?.examples && enrichedData.examples.length > 0) {
      const firstExample = enrichedData.examples[0];
      if (firstExample.problem && firstExample.solution) {
        slides.push({
          type: 'example',
          title: firstExample.type || 'مثال تطبيقي',
          content: firstExample.problem,
          bullets: [
            `الحل: ${firstExample.solution}`,
            firstExample.explanation ? `الشرح: ${firstExample.explanation}` : null
          ].filter(Boolean) as string[],
          metadata: { duration: 10, grade: userGrade }
        });
      }
    }

    // 6. One quiz slide (most important for engagement)
    if (enrichedData?.exercises && enrichedData.exercises.length > 0) {
      const exercise = enrichedData.exercises[0];
      if (exercise.type === 'MCQ' && exercise.options) {
        const cleanOptions = exercise.options.map((opt: string) =>
          opt.replace(/^[أ-د]\)\s*/, '')
        );
        const answerIndex = ['أ', 'ب', 'ج', 'د'].indexOf(exercise.correctAnswer?.charAt(0) || 'أ');

        slides.push({
          type: 'quiz',
          title: 'تمرين تفاعلي',
          quiz: {
            question: exercise.question,
            options: cleanOptions,
            correctIndex: answerIndex >= 0 ? answerIndex : 0,
            explanation: exercise.explanation
          },
          metadata: { duration: 20, grade: userGrade }
        });
      }
    }

    // 13. Summary slide (always last)
    slides.push({
      type: 'summary',
      title: 'خلاصة الدرس',
      subtitle: lesson.titleAr || lesson.title,
      bullets: cleanBullets(keyPoints.slice(0, 5)),
      metadata: { duration: 10, grade: userGrade }
    });

    // Only generate voice/teaching for small lessons to avoid timeout
    const shouldGenerateVoice = generateVoice === 'true' && slides.length <= 7;
    const shouldGenerateTeaching = generateTeaching === 'true' && slides.length <= 7;

    // Use Queue for large lessons or when voice/teaching is requested
    const shouldUseQueue = slides.length > 5 || shouldGenerateVoice || shouldGenerateTeaching;

    if (shouldUseQueue) {
      // تأكد من الحصول على userId الصحيح من JWT
      const jwtUserId = req.user!.userId;

      // تحقق من أن userId موجود وصحيح
      if (!jwtUserId || typeof jwtUserId !== 'string') {
        console.error('❌ Invalid userId from JWT:', jwtUserId);
        res.status(401).json(
          errorResponse('AUTH_ERROR', 'Invalid user authentication')
        );
        return;
      }

      console.log(`🔐 JWT User ID: ${jwtUserId}, Type: ${typeof jwtUserId}`);

      // تأكد من وجود المستخدم في قاعدة البيانات
      const dbUser = await prisma.user.findUnique({
        where: { id: jwtUserId },
        select: { id: true, firstName: true, grade: true }
      });

      if (!dbUser) {
        console.error(`❌ User ${jwtUserId} not found in database`);
        res.status(401).json(
          errorResponse('USER_NOT_FOUND', 'User not found')
        );
        return;
      }

      console.log(`✅ Verified user: ${dbUser.id}`);

      // أضف الـ job مع userId الصحيح
      const jobId = await slideQueue.addJob({
        lessonId: id,
        userId: dbUser.id, // استخدم ID من قاعدة البيانات
        slides,
        theme: 'adaptive', // استخدم دائماً التصميم التكيفي
        generateVoice: shouldGenerateVoice,
        generateTeaching: shouldGenerateTeaching,
        userGrade: dbUser.grade || 6,
        userName: dbUser.firstName || 'الطالب',
        sessionId: `session-${dbUser.id}-${Date.now()}` // لا تستخدم headers
      });

      console.log(`📋 Job ${jobId}: lessonId=${id}, userId=${dbUser.id}`);

      res.json(
        successResponse({
          jobId,
          lessonId: id,
          lessonTitle: lesson.titleAr || lesson.title,
          totalSlides: slides.length,
          estimatedDuration: slides.reduce((total, slide) =>
            total + (slide.metadata?.duration || 10), 0
          ),
          theme: 'adaptive',
          status: 'processing',
          message: 'جاري توليد الشرائح... سيتم إشعارك عند الانتهاء'
        }, 'Slide generation started')
      );
      return;
    }

    // CRITICAL FIX: تأكد من إضافة grade لكل شريحة قبل التوليد
    slides.forEach(slide => {
      if (!slide.metadata) slide.metadata = {};
      slide.metadata.grade = user?.grade || 7;
    });

    // For small lessons without voice, generate synchronously with adaptive theme
    const htmlSlides = slideService.generateLessonSlides(slides, 'adaptive', user?.grade || 7);

    // تحقق من أن HTML تم توليده بشكل صحيح
    console.log(`✅ Generated ${htmlSlides.length} HTML slides for grade ${user?.grade || 7}`);
    console.log(`📊 First slide length: ${htmlSlides[0]?.length || 0} chars`);
    console.log(`🎨 Contains styles: ${htmlSlides[0]?.includes('<style>') ? 'YES' : 'NO'}`);

    // Animation styles are now included in generateAdaptiveCSS, no need to add separately
    
    res.json(
      successResponse({
        lessonId: id,
        lessonTitle: lesson.titleAr || lesson.title,
        totalSlides: htmlSlides.length,
        estimatedDuration: slides.reduce((total, slide) =>
          total + (slide.metadata?.duration || 10), 0
        ),
        theme: 'adaptive',
        hasVoice: shouldGenerateVoice,
        hasTeaching: shouldGenerateTeaching,
        slides: htmlSlides.map((html, index) => {
          // CRITICAL: تأكد من أن HTML يُرسل كـ string نقي
          if (typeof html !== 'string') {
            console.error(`❌ Slide ${index} is not a string:`, typeof html);
            html = String(html);
          }

          return {
            number: index + 1,
            type: slides[index].type,
            title: slides[index].title,
            subtitle: slides[index].subtitle,
            content: slides[index].content,
            bullets: slides[index].bullets,
            metadata: slides[index].metadata,
            duration: slides[index].metadata?.duration || 10,
            html: html, // HTML نقي بدون escaping
            audioUrl: undefined,
            teachingScript: undefined
          };
        })
      }, 'Slides generated successfully')
    );
  })
);

// ============= ALL EXISTING ENDPOINTS REMAIN UNCHANGED =============
// [All other existing endpoints stay exactly as they were...]
// - POST /lessons/:id/slides/generate
// - GET /lessons/:id/slides/:slideNumber
// - POST /lessons/:id/slides/:slideNumber/voice
// - POST /lessons/:id/voice/generate-all
// - GET /lessons/:id/voice/status
// - GET /lessons/:id/voice/list
// - GET /lessons/subject/:subjectId
// - GET /lessons/unit/:unitId
// - POST /lessons/:id/start
// - POST /lessons/:id/complete
// - GET /lessons/:id/content
// - GET /lessons/:id/slides/themes

// Endpoint خاص للتطوير فقط - بدون authentication
if (process.env.NODE_ENV === 'development') {
  router.get('/test', async (req, res) => {
    try {
      const lessons = await prisma.lesson.findMany({
        include: {
          unit: {
            include: {
              subject: true
            }
          }
        },
        take: 20
      });
      
      res.json({
        success: true,
        data: lessons
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch lessons'
      });
    }
  });
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const lessons = await prisma.lesson.findMany({
      include: {
        unit: {
          include: {
            subject: true
          }
        }
      },
      take: 20
    });

    res.json(
      successResponse({
        lessons,
        total: lessons.length
      }, 'Lessons retrieved')
    );
  } catch (error) {
    res.status(500).json(
      errorResponse('FETCH_FAILED', 'Failed to fetch lessons')
    );
  }
});

/**
 * @route   GET /api/v1/lessons/user-progress
 * @desc    Get user's overall lesson progress
 * @access  Private
 */
router.get('/user-progress', authenticate, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;

  // Get all lessons with progress
  const lessons = await prisma.lesson.findMany({
    include: {
      progress: {
        where: { userId }
      }
    }
  });

  // Calculate statistics
  const totalLessons = lessons.length;
  const completedLessons = lessons.filter((l: any) =>
    l.progress.some((p: any) => p.status === 'COMPLETED')
  ).length;
  const inProgressLessons = lessons.filter((l: any) =>
    l.progress.some((p: any) => p.status === 'IN_PROGRESS')
  ).length;
  const notStartedLessons = totalLessons - completedLessons - inProgressLessons;

  // Group by subject
  const subjectProgress = await prisma.subject.findMany({
    include: {
      units: {
        include: {
          lessons: {
            include: {
              progress: {
                where: { userId }
              }
            }
          }
        }
      }
    }
  });

  const subjectStats = subjectProgress.map((subject: any) => {
    const allLessons = subject.units.flatMap((unit: any) => unit.lessons);
    return {
      subject: subject.nameAr || subject.name,
      subjectId: subject.id,
      total: allLessons.length,
      completed: allLessons.filter((l: any) =>
        l.progress.some((p: any) => p.status === 'COMPLETED')
      ).length,
      inProgress: allLessons.filter((l: any) =>
        l.progress.some((p: any) => p.status === 'IN_PROGRESS')
      ).length
    };
  });

  res.json(successResponse({
    totalLessons,
    completedLessons,
    inProgressLessons,
    notStartedLessons,
    completionPercentage: totalLessons > 0
      ? Math.round((completedLessons / totalLessons) * 100)
      : 0,
    subjectProgress: subjectStats
  }, 'User progress retrieved successfully'));
}));

/**
 * @route   GET /api/v1/lessons/:id
 * @desc    Get lesson details by ID
 * @access  Public
 *   UPDATED: Now uses caching for enriched content
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    //   Try to get from cache first
    const cachedContent = await enrichedContentCache.getEnrichedContent(id);

    if (cachedContent) {
      // Get lesson metadata (not cached)
      const lesson = await prisma.lesson.findUnique({
        where: { id },
        include: {
          unit: {
            include: {
              subject: true
            }
          }
        }
      });

      if (!lesson) {
        return res.status(404).json(
          errorResponse('LESSON_NOT_FOUND', 'الدرس غير موجود')
        );
      }

      // Parse keyPoints from lesson
      let keyPoints = [];
      try {
        keyPoints = JSON.parse(lesson.keyPoints || '[]');
      } catch (e) {
        keyPoints = [];
      }

      return res.json(
        successResponse({
          id: lesson.id,
          title: lesson.title,
          titleAr: lesson.titleAr,
          titleEn: lesson.titleEn,
          description: lesson.description,
          order: lesson.order,
          duration: lesson.duration,
          difficulty: lesson.difficulty,
          isPublished: lesson.isPublished,
          publishedAt: lesson.publishedAt,
          summary: lesson.summary,
          keyPoints,
          estimatedMinutes: lesson.estimatedMinutes || 45,
          unit: {
            id: lesson.unit.id,
            title: lesson.unit.title,
            titleAr: lesson.unit.titleAr,
            titleEn: lesson.unit.titleEn,
            subject: {
              id: lesson.unit.subject.id,
              name: lesson.unit.subject.name,
              nameAr: lesson.unit.subject.nameAr,
              nameEn: lesson.unit.subject.nameEn,
              grade: lesson.unit.subject.grade
            }
          },
          content: cachedContent,
          hasSlides: true,
          hasQuiz: true,
          hasChat: true,
          isEnriched: cachedContent.enrichmentLevel > 0,
          fromCache: true //   Indicate data is from cache
        }, 'Lesson retrieved successfully (cached)')
      );
    }

    // Fallback to original logic if not cached
    const lesson = await prisma.lesson.findUnique({
      where: { id },
      include: {
        unit: {
          include: {
            subject: true
          }
        },
        content: true
      }
    });

    if (!lesson) {
      res.status(404).json(
        errorResponse('LESSON_NOT_FOUND', 'الدرس غير موجود')
      );
      return;
    }

    // Parse JSON fields safely
    let keyPoints = [];
    let summary = lesson.summary;
    let estimatedMinutes = lesson.estimatedMinutes || 45;

    try {
      keyPoints = JSON.parse(lesson.keyPoints || '[]');
    } catch (e) {
      keyPoints = [];
    }

    // Helper function to safely parse JSON
    const safeParseJSON = (data: any, fallback: any = null) => {
      if (!data) return fallback;
      if (typeof data === 'object') return data;
      try {
        return JSON.parse(data);
      } catch {
        return fallback;
      }
    };

    // Process enriched content if available
    let enrichedData = null;
    if (lesson.content) {
      // Parse all JSON fields in content - use 'any' type to allow dynamic properties
      const parsedContent: any = {
        id: lesson.content.id,
        fullText: lesson.content.fullText,
        summary: lesson.content.summary,
        keyPoints: safeParseJSON(lesson.content.keyPoints, []),
        examples: safeParseJSON(lesson.content.examples, []),
        exercises: safeParseJSON(lesson.content.exercises, []),
        enrichmentLevel: lesson.content.enrichmentLevel || 0,
        // Initialize enriched fields with defaults
        realWorldApplications: [],
        commonMistakes: [],
        studentTips: [],
        educationalStories: [],
        challenges: [],
        visualAids: [],
        funFacts: [],
        quickReview: null
      };

      // Parse enrichedContent if it exists
      if (lesson.content.enrichedContent) {
        enrichedData = safeParseJSON(lesson.content.enrichedContent, {});
      }

      // If enriched content exists, use it as the primary source
      const enrichmentLevel = lesson.content.enrichmentLevel ?? 0;
      if (enrichedData && enrichmentLevel > 0) {
        parsedContent.examples = enrichedData.examples || parsedContent.examples;
        parsedContent.exercises = enrichedData.exercises || parsedContent.exercises;
        parsedContent.realWorldApplications = enrichedData.realWorldApplications || [];
        parsedContent.commonMistakes = enrichedData.commonMistakes || [];
        parsedContent.studentTips = enrichedData.studentTips || [];
        parsedContent.educationalStories = enrichedData.educationalStories || [];
        parsedContent.challenges = enrichedData.challenges || [];
        parsedContent.visualAids = enrichedData.visualAids || [];
        parsedContent.funFacts = enrichedData.funFacts || [];
        parsedContent.quickReview = enrichedData.quickReview || null;
      }

      lesson.content = parsedContent;
    }

    res.json(
      successResponse({
        id: lesson.id,
        title: lesson.title,
        titleAr: lesson.titleAr,
        titleEn: lesson.titleEn,
        description: lesson.description,
        order: lesson.order,
        duration: lesson.duration,
        difficulty: lesson.difficulty,
        isPublished: lesson.isPublished,
        publishedAt: lesson.publishedAt,
        summary,
        keyPoints,
        estimatedMinutes,
        unit: {
          id: lesson.unit.id,
          title: lesson.unit.title,
          titleAr: lesson.unit.titleAr,
          titleEn: lesson.unit.titleEn,
          subject: {
            id: lesson.unit.subject.id,
            name: lesson.unit.subject.name,
            nameAr: lesson.unit.subject.nameAr,
            nameEn: lesson.unit.subject.nameEn,
            grade: lesson.unit.subject.grade
          }
        },
        content: lesson.content,
        enrichedContent: enrichedData, // Include the full enriched content separately
        hasSlides: true,
        hasQuiz: true,
        hasChat: true,
        isEnriched: (lesson.content?.enrichmentLevel ?? 0) > 0
      }, 'Lesson retrieved successfully')
    );
  } catch (error: any) {
    console.error('Error fetching lesson:', error);
    res.status(500).json(
      errorResponse('FETCH_FAILED', 'Failed to fetch lesson details')
    );
  }
});

// =============   CACHE MANAGEMENT ENDPOINTS =============

/**
 * @route   POST /api/v1/lessons/:id/cache/invalidate
 * @desc    Invalidate cache for a specific lesson
 * @access  Private (Admin)
 */
router.post(
  '/:id/cache/invalidate',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const invalidated = enrichedContentCache.invalidateLesson(id);

    res.json(
      successResponse({
        lessonId: id,
        invalidated
      }, invalidated ? 'Cache invalidated successfully' : 'Cache entry not found')
    );
  })
);

/**
 * @route   GET /api/v1/lessons/cache/stats
 * @desc    Get cache statistics
 * @access  Private
 */
router.get(
  '/cache/stats',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const stats = enrichedContentCache.getStats();

    res.json(
      successResponse(stats, 'Cache statistics retrieved')
    );
  })
);

/**
 * @route   POST /api/v1/lessons/cache/clear
 * @desc    Clear all cache
 * @access  Private (Admin)
 */
router.post(
  '/cache/clear',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    // In production, check for admin role
    // if (req.user!.role !== 'ADMIN') {
    //   return res.status(403).json(
    //     errorResponse('FORBIDDEN', 'غير مصرح')
    //   );
    // }

    enrichedContentCache.clearAll();

    res.json(
      successResponse({
        message: 'تم مسح جميع الذاكرة المؤقتة بنجاح'
      }, 'All cache cleared')
    );
  })
);

/**
 * @route   POST /api/v1/lessons/cache/warmup
 * @desc    Warm up cache with popular lessons
 * @access  Private
 */
router.post(
  '/cache/warmup',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    await enrichedContentCache.warmUpCache();

    res.json(
      successResponse({
        message: 'تم تسخين الذاكرة المؤقتة بنجاح'
      }, 'Cache warmed up successfully')
    );
  })
);

/**
 * @route   POST /api/v1/lessons/:id/slides/generate-single
 * @desc    Generate a single slide on demand (for chat integration)
 * @access  Private
 */
router.post(
  '/:id/slides/generate-single',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { topic, context, type = 'explanation' } = req.body;
    const userId = req.user!.userId;

    // الحصول على بيانات المستخدم
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { grade: true, firstName: true }
    });

    if (!user) {
      res.status(404).json(
        errorResponse('USER_NOT_FOUND', 'المستخدم غير موجود')
      );
      return;
    }

    // تحديد الثيم المناسب حسب العمر (نستخدم ثيم محايد حالياً)
    const determineTheme = (grade: number | null): string => {
      const ageGroup = !grade ? 'primary' :
                       grade <= 6 ? 'primary' :
                       grade <= 9 ? 'preparatory' :
                       'secondary';
      // نستخدم ثيم الذكور كثيم افتراضي حالياً
      // يمكن إضافة حقل gender في قاعدة البيانات لاحقاً
      return `${ageGroup}-male`;
    };

    // نستخدم دائماً التصميم التكيفي
    // const theme = determineTheme(user.grade); // غير مطلوب الآن

    // بناء محتوى الشريحة حسب النوع
    let slideContent: SlideContent;

    switch (type) {
      case 'explanation':
        slideContent = {
          type: 'content',
          title: topic,
          content: context?.content || ''
        };
        break;

      case 'example':
        slideContent = {
          type: 'bullet',
          title: `أمثلة على ${topic}`,
          bullets: context?.examples || []
        };
        break;

      case 'quiz':
        slideContent = {
          type: 'quiz',
          title: topic,
          quiz: context?.quiz || {
            question: `سؤال حول ${topic}`,
            options: ['خيار 1', 'خيار 2', 'خيار 3', 'خيار 4']
          }
        };
        break;

      default:
        slideContent = {
          type: 'content',
          title: topic,
          content: ''
        };
    }

    // Force intelligent mode
    const forceIntelligent = true;

    // توليد HTML للشريحة مع التصميم التكيفي
    slideContent.metadata = {
      ...slideContent.metadata,
      grade: user.grade || 7
    };
    const slideHtml = slideService.generateSlideHTML(slideContent, 'adaptive');

    // توليد الأسكريبت التعليمي مع معالجة الأخطاء
    let script;
    try {
      script = await teachingAssistant.generateTeachingScript({
        slideContent,
        lessonId: id,
        studentGrade: user.grade || 6,
        studentName: user.firstName || 'الطالب',
        // IMPORTANT: Tell it NOT to just read
        interactionType: slideContent.type === 'example' ? 'example' : 'explain'
      });

      console.log('📊 Generated script:', {
        length: script.script.length,
        words: script.script.split(' ').length,
        isReading: script.script.includes(slideContent?.content || '') // Check if just reading
      });
    } catch (scriptError) {
      console.error('❌ Single slide script generation failed:', scriptError);

      // Fallback script
      script = {
        script: `مرحباً ${user.firstName || 'بالطالب'}، دعنا نتعلم عن ${topic}. سأشرح لك هذا الموضوع بطريقة مبسطة وممتعة.`,
        duration: 15,
        keyPoints: [],
        examples: [],
        problem: null,
        visualCues: [],
        interactionPoints: [],
        emotionalTone: 'encouraging',
        nextSuggestions: []
      };
    }

    // توليد الصوت
    const voiceResult = await voiceService.textToSpeech(script.script);

    // إنشاء بيانات التزامن البسيطة (مؤقتاً)
    const generateBasicSyncData = (duration: number) => ({
      start: 0,
      end: duration || 10,
      words: [], // يمكن إضافة تحليل أعمق لاحقاً
      highlights: []
    });

    res.json(
      successResponse({
        lessonId: id,
        slide: {
          html: slideHtml,
          content: slideContent,
          theme: 'adaptive'
        },
        script: script.script,
        audioUrl: voiceResult.audioUrl,
        duration: script.duration,
        syncTimestamps: generateBasicSyncData(script.duration || 10)
      }, 'Slide generated successfully')
    );
  })
);

// =============   QUEUE STATUS ENDPOINTS =============

/**
 * @route   GET /api/v1/lessons/:id/slides/status/:jobId
 * @desc    Get slide generation job status
 * @access  Private
 */
router.get(
  '/:id/slides/status/:jobId',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { id, jobId } = req.params;

    const status = await slideQueue.getStatus(jobId);

    if (!status) {
      res.status(404).json(
        errorResponse('JOB_NOT_FOUND', 'Job not found')
      );
      return;
    }

    // If completed, get cached results
    if (status.status === 'completed') {
      const results = await slideQueue.getResults(id, req.user!.userId);

      if (results) {
        res.json(
          successResponse({
            jobId,
            lessonId: id,
            status: 'completed',
            slides: results.htmlSlides.map((html: string, index: number) => ({
              number: index + 1,
              html,
              audioUrl: results.audioUrls?.[index],
              script: results.teachingScripts?.[index]?.script,
              duration: results.teachingScripts?.[index]?.duration || 10
            })),
            totalSlides: results.htmlSlides.length,
            processingTime: results.processingTime
          }, 'Slides ready')
        );
        return;
      }
    }

    res.json(
      successResponse({
        jobId,
        ...status
      }, 'Job status retrieved')
    );
  })
);

/**
 * @route   GET /api/v1/lessons/slides/job/:jobId
 * @desc    Get slide generation job status by job ID
 * @access  Private
 */
router.get(
  '/slides/job/:jobId',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { jobId } = req.params;
    const userId = req.user!.userId;

    console.log(`📋 Checking job ${jobId} for user ${userId}`);

    const status = await slideQueue.getStatus(jobId);

    if (!status) {
      res.status(404).json(
        errorResponse('JOB_NOT_FOUND', 'Job not found')
      );
      return;
    }

    console.log(`📊 Job ${jobId} status: ${status.status}`);

    // If completed, get cached results with fallback
    if (status.status === 'completed' && status.lessonId) {
      console.log(`🔍 Looking for results: lesson=${status.lessonId}, user=${userId}`);

      const results = await slideQueue.getResults(status.lessonId, userId);

      if (results) {
        console.log(`✅ Found results with ${results.htmlSlides?.length} slides`);

        const slides = results.htmlSlides.map((html: string, index: number) => {
          const originalSlide = results.processedSlides?.[index] || {};

          return {
            number: index + 1,
            type: originalSlide.type || (index === 0 ? 'title' : 'content'),
            title: originalSlide.title || `شريحة ${index + 1}`,
            subtitle: originalSlide.subtitle,
            content: originalSlide.content || originalSlide.text || '',
            bullets: originalSlide.bullets || [],
            imageUrl: originalSlide.imageUrl,
            equation: originalSlide.equation,
            quiz: originalSlide.quiz,
            html,
            audioUrl: results.audioUrls?.[index],
            script: results.teachingScripts?.[index]?.script,
            duration: results.teachingScripts?.[index]?.duration || 10
          };
        });

        res.json(
          successResponse({
            jobId,
            lessonId: status.lessonId,
            status: 'completed',
            slides,
            totalSlides: slides.length,
            processingTime: results.processingTime
          }, 'Slides ready')
        );
        return;
      } else {
        console.log('❌ No cached results found, even with fallback');
      }
    }

    // Return current status
    res.json(
      successResponse({
        jobId,
        lessonId: status.lessonId,
        status: status.status,
        progress: status.progress,
        currentSlide: status.currentSlide,
        totalSlides: status.totalSlides
      }, 'Job status retrieved')
    );
  })
);

/**
 * @route   POST /api/v1/lessons/:id/slides/cancel/:jobId
 * @desc    Cancel slide generation job
 * @access  Private
 */
router.post(
  '/:id/slides/cancel/:jobId',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { jobId } = req.params;

    // Cancellation not implemented in simplified queue
    const cancelled = false;

    if (!cancelled) {
      res.status(404).json(
        errorResponse('JOB_NOT_FOUND', 'Job not found or already completed')
      );
      return;
    }

    res.json(
      successResponse({
        jobId,
        cancelled: true
      }, 'Job cancelled successfully')
    );
  })
);

/**
 * @route   GET /api/v1/lessons/queue/stats
 * @desc    Get queue statistics
 * @access  Private
 */
router.get(
  '/queue/stats',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    // Stats not implemented in simplified queue
    const stats = {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      total: 0
    };

    res.json(
      successResponse(stats, 'Queue statistics retrieved')
    );
  })
);

// ============= SLIDE TRACKING ENDPOINTS =============

/**
 * @route   POST /api/v1/lessons/:id/slides/:slideId/track
 * @desc    Track slide view progress
 * @access  Private
 */
router.post(
  '/:id/slides/:slideId/track',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { id, slideId } = req.params;
    const { duration, completed } = req.body;
    const userId = req.user!.userId;

    try {
      // Store slide tracking data - in production use database
      // For now, just log the tracking
      console.log(`📊 Slide tracking - User: ${userId}, Lesson: ${id}, Slide: ${slideId}, Duration: ${duration}s, Completed: ${completed}`);

      // Here you would typically store this in a slide_views table
      // await prisma.slideView.create({
      //   data: {
      //     userId,
      //     lessonId: id,
      //     slideId,
      //     duration,
      //     completed,
      //     viewedAt: new Date()
      //   }
      // });

      res.json(
        successResponse({
          slideId,
          duration,
          completed,
          tracked: true
        }, 'Slide view tracked successfully')
      );
    } catch (error) {
      console.error('Error tracking slide view:', error);
      res.status(500).json(
        errorResponse('TRACKING_FAILED', 'Failed to track slide view')
      );
    }
  })
);

/**
 * @route   POST /api/v1/lessons/:id/slides/:slideId/answer
 * @desc    Submit quiz answer for a slide
 * @access  Private
 */
router.post(
  '/:id/slides/:slideId/answer',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { id, slideId } = req.params;
    const { answer } = req.body;
    const userId = req.user!.userId;

    try {
      // In a real implementation, you would:
      // 1. Get the correct answer from the database
      // 2. Compare with user's answer
      // 3. Store the result
      // 4. Update user's progress/points

      // For now, simulate a correct answer check
      const isCorrect = Math.random() > 0.3; // 70% chance of being correct for testing
      const points = isCorrect ? 10 : 0;

      console.log(`✅ Quiz answer - User: ${userId}, Lesson: ${id}, Slide: ${slideId}, Answer: ${answer}, Correct: ${isCorrect}`);

      res.json(
        successResponse({
          correct: isCorrect,
          points,
          explanation: isCorrect ? 'إجابة صحيحة! أحسنت.' : 'إجابة غير صحيحة. حاول مرة أخرى.',
          slideId,
          answer
        }, isCorrect ? 'Correct answer!' : 'Incorrect answer')
      );
    } catch (error) {
      console.error('Error submitting quiz answer:', error);
      res.status(500).json(
        errorResponse('ANSWER_SUBMISSION_FAILED', 'Failed to submit answer')
      );
    }
  })
);

/**
 * @route   GET /api/v1/lessons/:id/slides/progress
 * @desc    Get user's progress through lesson slides
 * @access  Private
 */
router.get(
  '/:id/slides/progress',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.user!.userId;

    try {
      // In a real implementation, you would query slide_views table
      // For now, return mock progress data
      const totalSlides = 10; // This would come from counting actual slides
      const viewedSlides = 7;  // This would come from database
      const completedSlides = 5;

      res.json(
        successResponse({
          lessonId: id,
          totalSlides,
          viewedSlides,
          completedSlides,
          progressPercentage: Math.round((completedSlides / totalSlides) * 100),
          currentSlide: viewedSlides,
          nextSlide: viewedSlides < totalSlides ? viewedSlides + 1 : null
        }, 'Progress retrieved successfully')
      );
    } catch (error) {
      console.error('Error getting slide progress:', error);
      res.status(500).json(
        errorResponse('PROGRESS_FETCH_FAILED', 'Failed to get progress')
      );
    }
  })
);

// ============= COMPLETE LESSON ENDPOINT =============
// Endpoint to mark a lesson as complete
router.post('/:id/complete',
  authenticate,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = (req.user as any)?.userId;

      if (!userId) {
        res.status(401).json(
          errorResponse('UNAUTHORIZED', 'User not authenticated')
        );
        return;
      }

      // Get the lesson to verify it exists and get duration
      const lesson = await prisma.lesson.findUnique({
        where: { id }
      });

      if (!lesson) {
        res.status(404).json(
          errorResponse('LESSON_NOT_FOUND', 'Lesson not found')
        );
        return;
      }

      // Calculate lesson duration (default 30 minutes if not specified)
      const lessonDuration = lesson.duration || 30;

      // Update or create Progress record
      const progress = await prisma.progress.upsert({
        where: {
          userId_lessonId: {
            userId,
            lessonId: id
          }
        },
        update: {
          status: 'COMPLETED',
          completedAt: new Date(),
          completionRate: 100,
          lastAccessedAt: new Date()
        },
        create: {
          userId,
          lessonId: id,
          status: 'COMPLETED',
          completedAt: new Date(),
          completionRate: 100,
          lastAccessedAt: new Date()
        }
      });

      // Get current StudentContext
      const existingContext = await prisma.studentContext.findUnique({
        where: { userId }
      });

      // Update StudentContext
      const updatedContext = await prisma.studentContext.upsert({
        where: { userId },
        update: {
          totalSessions: (existingContext?.totalSessions || 0) + 1,
          totalLearningTime: (existingContext?.totalLearningTime || 0) + lessonDuration,
          lastInteractionTime: new Date(),
          // Add the lesson to masteredTopics if not already there
          masteredTopics: JSON.stringify(
            existingContext?.masteredTopics
              ? JSON.parse(existingContext.masteredTopics as string).includes(lesson.title)
                ? JSON.parse(existingContext.masteredTopics as string)
                : [...JSON.parse(existingContext.masteredTopics as string), lesson.title]
              : [lesson.title]
          ),
          // Update recent topics
          recentTopics: JSON.stringify([
            lesson.title,
            ...(existingContext?.recentTopics
              ? JSON.parse(existingContext.recentTopics as string).filter(
                  (topic: string) => topic !== lesson.title
                )
              : []).slice(0, 4) // Keep last 5 topics
          ])
        },
        create: {
          userId,
          learningStyle: 'visual',
          totalSessions: 1,
          totalLearningTime: lessonDuration,
          lastInteractionTime: new Date(),
          masteredTopics: JSON.stringify([lesson.title]),
          recentTopics: JSON.stringify([lesson.title]),
          strugglingTopics: JSON.stringify([]),
          correctAnswers: 0,
          wrongAnswers: 0,
          averageScore: 0,
          streakCount: 0,
          longestStreak: 0,
          currentMood: 'neutral',
          averageConfidence: 70,
          averageEngagement: 80,
          questionsAsked: 0,
          hintsRequested: 0,
          breaksRequested: 0,
          currentLevel: 1,
          sessionsCompleted: 0
        }
      });

      res.status(200).json(
        successResponse({
          progress: {
            lessonId: progress.lessonId,
            status: progress.status,
            completionRate: progress.completionRate,
            completedAt: progress.completedAt
          },
          context: {
            sessionsCompleted: updatedContext.sessionsCompleted,
            totalLearningTime: updatedContext.totalLearningTime,
            masteredTopics: updatedContext.masteredTopics,
            recentTopics: updatedContext.recentTopics
          }
        }, 'Lesson marked as complete successfully')
      );
    } catch (error) {
      console.error('Error completing lesson:', error);
      res.status(500).json(
        errorResponse('COMPLETE_FAILED', 'Failed to mark lesson as complete')
      );
    }
  })
);

// Save lesson progress
router.post('/:id/progress',
  authenticate,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { slideIndex, totalSlides, progressPercentage } = req.body;
      const userId = (req.user as any)?.userId;

      if (!userId) {
        res.status(401).json(
          errorResponse('UNAUTHORIZED', 'User not authenticated')
        );
        return;
      }

      // Update or create Progress record
      const progress = await prisma.progress.upsert({
        where: {
          userId_lessonId: {
            userId,
            lessonId: id
          }
        },
        update: {
          completionRate: progressPercentage || 0,
          lastAccessedAt: new Date(),
          status: progressPercentage >= 100 ? 'COMPLETED' : 'IN_PROGRESS'
        },
        create: {
          userId,
          lessonId: id,
          status: 'IN_PROGRESS',
          completionRate: progressPercentage || 0,
          lastAccessedAt: new Date()
        }
      });

      res.json(
        successResponse({
          progress: {
            lessonId: progress.lessonId,
            status: progress.status,
            completionRate: progress.completionRate
          }
        }, 'Progress saved successfully')
      );
    } catch (error) {
      console.error('Error saving progress:', error);
      res.status(500).json(
        errorResponse('PROGRESS_SAVE_FAILED', 'Failed to save progress')
      );
    }
  })
);

export default router;