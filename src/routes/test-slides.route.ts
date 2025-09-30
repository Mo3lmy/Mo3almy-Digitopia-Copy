import { Router, Request, Response } from 'express';
import { SlideService } from '../services/slides/slide.service';

const router = Router();
const slideService = new SlideService();

// Test endpoint for generating slides without authentication
router.post('/test/slides/generate', async (req: Request, res: Response) => {
  try {
    const { subject, topic, theme = 'adaptive', grade = 7, metadata = {} } = req.body;

    // Ensure grade is in metadata
    if (!metadata.grade) {
      metadata.grade = grade;
    }

    console.log('🎯 Test slide generation request:', {
      subject,
      topic,
      theme,
      grade: metadata.grade,
      useAdaptive: theme === 'adaptive'
    });

    // Generate test slides for the topic
    const slides = [];

    // Title slide
    slides.push({
      type: 'title',
      html: slideService.generateSlideHTML({
        type: 'title',
        title: topic,
        subtitle: subject,
        metadata: { grade: metadata.grade }
      }, theme)
    });

    // Content slide
    slides.push({
      type: 'content',
      html: slideService.generateSlideHTML({
        type: 'content',
        title: `مقدمة عن ${topic}`,
        content: `هذا درس تجريبي عن ${topic} في مادة ${subject}. سنتعلم المفاهيم الأساسية والتطبيقات العملية.`,
        metadata: { grade: metadata.grade }
      }, theme)
    });

    // Bullet points slide
    slides.push({
      type: 'bullet',
      html: slideService.generateSlideHTML({
        type: 'bullet',
        title: 'النقاط الرئيسية',
        bullets: [
          `المفهوم الأول في ${topic}`,
          `المفهوم الثاني وتطبيقاته`,
          `أمثلة عملية من الحياة`,
          `تمارين وأنشطة تفاعلية`
        ],
        metadata: { grade: metadata.grade }
      }, theme)
    });

    // Example slide
    slides.push({
      type: 'example',
      html: slideService.generateSlideHTML({
        type: 'example',
        title: 'مثال تطبيقي',
        content: `مثال على ${topic}`,
        metadata: { grade: metadata.grade }
      } as any, theme)
    });

    // Quiz slide
    slides.push({
      type: 'quiz',
      html: slideService.generateSlideHTML({
        type: 'quiz',
        title: 'اختبر معلوماتك',
        content: `ما هو ${topic}؟`,
        metadata: { grade: metadata.grade }
      } as any, theme)
    });

    // Summary slide
    slides.push({
      type: 'summary',
      html: slideService.generateSlideHTML({
        type: 'summary',
        title: 'ملخص الدرس',
        content: `تعلمنا عن ${topic}، فهمنا المفاهيم الأساسية، طبقنا الأمثلة العملية`,
        metadata: { grade: metadata.grade }
      } as any, theme)
    });

    res.json({
      success: true,
      data: {
        slides,
        totalSlides: slides.length,
        theme: theme === 'adaptive' ? `adaptive-grade-${metadata.grade}` : theme,
        grade: metadata.grade
      }
    });

  } catch (error) {
    console.error('Error generating test slides:', error);
    res.status(500).json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Failed to generate slides',
        code: 'SLIDE_GENERATION_ERROR'
      }
    });
  }
});

// Test endpoint مع logging مفصل
router.get('/test/slides/preview/:type', async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    const { grade = 7 } = req.query;

    const slideService = new SlideService();

    // توليد شريحة اختبارية حسب النوع
    const testContent: any = {
      type: type as any,
      title: 'عنوان تجريبي',
      subtitle: 'العنوان الفرعي',
      content: 'هذا محتوى تجريبي للشريحة',
      metadata: {
        grade: parseInt(grade as string),
        theme: 'adaptive'
      }
    };

    // إضافة محتوى خاص حسب النوع
    if (type === 'bullet') {
      testContent.bullets = [
        'النقطة الأولى المهمة',
        'النقطة الثانية التوضيحية',
        'النقطة الثالثة للتطبيق'
      ];
    } else if (type === 'quiz') {
      testContent.quiz = {
        question: 'ما هو الجواب الصحيح؟',
        options: ['الخيار الأول', 'الخيار الثاني', 'الخيار الثالث', 'الخيار الرابع'],
        correctAnswer: 0
      };
    }

    // توليد HTML مع التأكد من التصميم التكيفي
    const html = slideService.generateSlideHTML(testContent, 'adaptive');

    // Log للتحقق
    console.log('📝 Generated HTML length:', html.length);
    console.log('🎨 Contains adaptive styles:', html.includes('adaptive'));
    console.log('🎯 Grade level:', grade);

    // إرسال HTML كاملاً
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);

  } catch (error) {
    console.error('Error in preview:', error);
    res.status(500).json({ error: 'Failed to generate preview' });
  }
});

export default router;