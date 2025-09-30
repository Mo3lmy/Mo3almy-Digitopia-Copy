// src/services/slides/slide.service.ts
// نسخة مبسطة ومضمونة 100% لعمل الستايلات

export interface SlideContent {
  type: 'title' | 'content' | 'bullet' | 'image' | 'equation' | 'quiz' | 'summary' | 'interactive' | 'video' | 'code' | 'tips' | 'story' | 'example';
  title?: string;
  subtitle?: string;
  content?: string;
  bullets?: string[];
  imageUrl?: string;
  equation?: string;
  quiz?: {
    question: string;
    options: string[];
    correctIndex?: number;
    explanation?: string;
  };
  metadata?: {
    duration?: number;
    grade?: number;
  };
}

export class SlideService {
  
  /**
   * الدالة الرئيسية لتوليد HTML للشريحة
   */
  generateSlideHTML(content: SlideContent, themeName: string = 'adaptive'): string {
    const grade = content.metadata?.grade || 7;
    
    console.log(`🎨 Generating slide: type=${content.type}, grade=${grade}`);
    
    // توليد HTML كامل مع الستايلات
    const fullHTML = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${content.title || 'شريحة تعليمية'}</title>
    
    <!-- Google Fonts -->
    <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&family=Cairo:wght@400;700&display=swap" rel="stylesheet">

    <!-- KaTeX for Math Equations -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css" integrity="sha384-n8MVd4RsNIU0tAv4ct0nTaAbDJwPJzDEaqSD1odI+WdtXRGWt2kTvGFasHpSy3SV" crossorigin="anonymous">
    <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js" integrity="sha384-XjKyOOlGwcjNTAIQHIpgOno0Hl1YQqzUOEleOLALmuqehneUG+vnGctmUb0ZY0l8" crossorigin="anonymous"></script>
    <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js" integrity="sha384-+VBxd3r6XgURycqtZ117nYw44OOcIax56Z4dCRWbxyPt0Koah1uHoK0o4+/RRE05" crossorigin="anonymous"></script>

    <style>
        /* Reset & Base Styles */
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        html, body {
            width: 100%;
            height: 100%;
            overflow: hidden;
            direction: rtl;
            font-family: 'Tajawal', 'Cairo', 'Segoe UI', sans-serif;
        }
        
        /* Theme Colors Based on Grade */
        :root {
            --primary: ${grade <= 6 ? '#FF6B6B' : grade <= 9 ? '#6C5CE7' : '#2D3436'};
            --secondary: ${grade <= 6 ? '#4ECDC4' : grade <= 9 ? '#00CEC9' : '#0984E3'};
            --accent: ${grade <= 6 ? '#FFE66D' : grade <= 9 ? '#FD79A8' : '#00B894'};
            --gradient: ${this.getGradientByGrade(grade)};
            --font-size-title: ${grade <= 6 ? '3em' : grade <= 9 ? '2.5em' : '2.2em'};
            --font-size-content: ${grade <= 6 ? '1.5em' : grade <= 9 ? '1.3em' : '1.2em'};
            --border-radius: ${grade <= 6 ? '25px' : grade <= 9 ? '15px' : '10px'};
            --shadow: ${grade <= 6 ? '0 20px 60px rgba(0,0,0,0.3)' : '0 10px 30px rgba(0,0,0,0.15)'};
        }
        
        /* Animations for Kids */
        ${grade <= 6 ? `
        @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-20px); }
        }
        
        @keyframes bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
        }
        
        @keyframes slideIn {
            from { 
                opacity: 0;
                transform: translateX(-50px);
            }
            to {
                opacity: 1;
                transform: translateX(0);
            }
        }
        
        .animate-float {
            animation: float 3s ease-in-out infinite;
        }
        
        .animate-bounce {
            animation: bounce 2s ease-in-out infinite;
        }
        
        .animate-slide {
            animation: slideIn 0.5s ease forwards;
        }
        ` : ''}
        
        /* Slide Container */
        .slide {
            width: 100vw;
            height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 40px;
            background: var(--gradient);
            position: relative;
        }
        
        /* Title Styles */
        .slide-title {
            font-size: var(--font-size-title);
            color: white;
            text-align: center;
            margin-bottom: 30px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
            ${grade <= 6 ? 'animation: bounce 2s ease-in-out infinite;' : ''}
        }
        
        /* Content Container */
        .slide-content {
            background: rgba(255, 255, 255, 0.95);
            padding: 40px;
            border-radius: var(--border-radius);
            box-shadow: var(--shadow);
            max-width: 900px;
            width: 100%;
        }
        
        /* Text Content */
        .content-text {
            font-size: var(--font-size-content);
            line-height: 1.8;
            color: #2c3e50;
        }
        
        /* Bullet Points */
        .bullet-list {
            list-style: none;
            padding: 0;
        }
        
        .bullet-item {
            display: flex;
            align-items: flex-start;
            margin: 20px 0;
            ${grade <= 6 ? 'animation: slideIn 0.5s ease forwards;' : ''}
        }
        
        .bullet-icon {
            font-size: 1.5em;
            margin-left: 15px;
            color: var(--accent);
            ${grade <= 6 ? 'animation: bounce 2s ease-in-out infinite;' : ''}
        }
        
        .bullet-text {
            flex: 1;
            font-size: var(--font-size-content);
            line-height: 1.6;
            color: #2c3e50;
            padding: 10px;
            background: linear-gradient(90deg, rgba(103, 126, 234, 0.1) 0%, transparent 100%);
            border-right: 4px solid var(--primary);
            border-radius: 5px;
        }
        
        /* Quiz Styles */
        .quiz-container {
            text-align: center;
        }
        
        .quiz-question {
            font-size: var(--font-size-title);
            color: var(--primary);
            margin-bottom: 40px;
        }
        
        .quiz-options {
            display: grid;
            grid-template-columns: ${grade <= 6 ? '1fr' : 'repeat(2, 1fr)'};
            gap: 20px;
        }
        
        .quiz-option {
            padding: 20px;
            background: white;
            border: 2px solid var(--primary);
            border-radius: var(--border-radius);
            font-size: var(--font-size-content);
            cursor: pointer;
            transition: all 0.3s ease;
        }
        
        .quiz-option:hover {
            background: var(--primary);
            color: white;
            transform: scale(1.05);
        }

        /* Equation Styles */
        .equation-container {
            background: rgba(255, 255, 255, 0.15);
            backdrop-filter: blur(10px);
            padding: 40px 60px;
            border-radius: var(--border-radius);
            border: 2px solid rgba(255, 255, 255, 0.3);
            font-size: 2.5em;
            color: white;
            display: inline-block;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        }

        .equation-container .katex-display {
            margin: 0;
            font-size: 1.2em;
        }

        .equation-container .katex {
            color: white !important;
        }

        /* Decorations for Kids */
        ${grade <= 6 ? `
        .decoration {
            position: absolute;
            font-size: 3em;
            opacity: 0.3;
            animation: float 4s ease-in-out infinite;
        }
        
        .decoration-1 { top: 10%; left: 5%; animation-delay: 0s; }
        .decoration-2 { top: 60%; right: 5%; animation-delay: 1s; }
        .decoration-3 { bottom: 10%; left: 10%; animation-delay: 2s; }
        ` : ''}
    </style>
</head>
<body>
    ${this.generateSlideBody(content, grade)}

    <!-- KaTeX Auto-render Script -->
    <script>
        document.addEventListener("DOMContentLoaded", function() {
            if (typeof renderMathInElement !== 'undefined') {
                renderMathInElement(document.body, {
                    delimiters: [
                        {left: '$$', right: '$$', display: true},
                        {left: '$', right: '$', display: false},
                        {left: '\\\\(', right: '\\\\)', display: false},
                        {left: '\\\\[', right: '\\\\]', display: true}
                    ],
                    throwOnError: false
                });
            }
        });
    </script>
</body>
</html>`;

    console.log('✅ Generated HTML with embedded styles');
    return fullHTML;
  }

  /**
   * توليد محتوى الشريحة حسب النوع
   */
  private generateSlideBody(content: SlideContent, grade: number): string {
    const isKids = grade <= 6;

    switch (content.type) {
      case 'title':
        return this.generateTitleSlide(content, grade);
      case 'content':
        return this.generateContentSlide(content, grade);
      case 'bullet':
        return this.generateBulletSlide(content, grade);
      case 'equation':
        return this.generateEquationSlide(content, grade);
      case 'quiz':
        return this.generateQuizSlide(content, grade);
      case 'summary':
        return this.generateSummarySlide(content, grade);
      default:
        return this.generateContentSlide(content, grade);
    }
  }

  /**
   * شريحة العنوان
   */
  private generateTitleSlide(content: SlideContent, grade: number): string {
    const isKids = grade <= 6;
    const icons = ['🌟', '🎈', '🚀', '💡', '🎯'];
    const randomIcon = isKids ? icons[Math.floor(Math.random() * icons.length)] : '';
    
    return `
    <div class="slide">
        ${isKids ? `
        <div class="decoration decoration-1">🌟</div>
        <div class="decoration decoration-2">🎈</div>
        <div class="decoration decoration-3">🚀</div>
        ` : ''}
        
        <h1 class="slide-title">
            ${content.title || 'عنوان الدرس'}
        </h1>
        
        ${content.subtitle ? `
        <h2 style="color: rgba(255,255,255,0.9); font-size: 1.8em; font-weight: 300;">
            ${content.subtitle}
        </h2>
        ` : ''}
        
        ${isKids ? `
        <div style="margin-top: 30px; font-size: 4em;">
            ${randomIcon}
        </div>
        ` : ''}
    </div>`;
  }

  /**
   * شريحة المحتوى
   */
  private generateContentSlide(content: SlideContent, grade: number): string {
    return `
    <div class="slide">
        ${content.title ? `
        <h2 style="color: white; font-size: 2.5em; margin-bottom: 30px;">
            ${content.title}
        </h2>
        ` : ''}
        
        <div class="slide-content">
            <div class="content-text">
                ${content.content || 'محتوى الشريحة يظهر هنا'}
            </div>
        </div>
    </div>`;
  }

  /**
   * شريحة النقاط
   */
  private generateBulletSlide(content: SlideContent, grade: number): string {
    const bullets = content.bullets || ['نقطة أولى', 'نقطة ثانية', 'نقطة ثالثة'];
    const icons = grade <= 6 ? ['🌟', '🎯', '💡', '🚀', '✨'] : ['•', '◆', '▪', '→', '✓'];
    
    return `
    <div class="slide">
        ${content.title ? `
        <h2 style="color: white; font-size: 2.5em; margin-bottom: 30px;">
            ${content.title}
        </h2>
        ` : ''}
        
        <div class="slide-content">
            <ul class="bullet-list">
                ${bullets.map((bullet, i) => `
                <li class="bullet-item" ${grade <= 6 ? `style="animation-delay: ${i * 0.1}s;"` : ''}>
                    <span class="bullet-icon">${icons[i % icons.length]}</span>
                    <div class="bullet-text">${bullet}</div>
                </li>
                `).join('')}
            </ul>
        </div>
    </div>`;
  }

  /**
   * شريحة المعادلة الرياضية
   */
  private generateEquationSlide(content: SlideContent, grade: number): string {
    const equation = content.equation || 'E = mc^2';
    const isKids = grade <= 6;

    return `
    <div class="slide">
        ${content.title ? `
        <h2 style="color: white; font-size: 2.5em; margin-bottom: 30px;">
            ${isKids ? '🔢 ' : ''}${content.title}
        </h2>
        ` : ''}

        <div class="slide-content" style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
            <div class="equation-container">
                $$${equation}$$
            </div>

            ${content.content ? `
            <div style="margin-top: 40px; color: rgba(255,255,255,0.95); font-size: 1.4em; text-align: center; max-width: 80%;">
                ${content.content}
            </div>
            ` : ''}
        </div>

        ${isKids ? `
        <div style="margin-top: 30px; font-size: 2em;">
            🧮 ✖️ ➕ ➖ ➗
        </div>
        ` : ''}
    </div>`;
  }

  /**
   * شريحة الاختبار
   */
  private generateQuizSlide(content: SlideContent, grade: number): string {
    const quiz = content.quiz || {
      question: 'ما هو السؤال؟',
      options: ['الخيار الأول', 'الخيار الثاني', 'الخيار الثالث', 'الخيار الرابع']
    };
    
    return `
    <div class="slide">
        <div class="slide-content quiz-container">
            <h2 class="quiz-question">
                ${grade <= 6 ? '🤔 ' : ''}${quiz.question}
            </h2>
            
            <div class="quiz-options">
                ${quiz.options.map((option, i) => `
                <button class="quiz-option">
                    <span style="font-weight: bold; margin-left: 10px;">
                        ${String.fromCharCode(65 + i)}
                    </span>
                    ${option}
                </button>
                `).join('')}
            </div>
        </div>
    </div>`;
  }

  /**
   * شريحة الملخص
   */
  private generateSummarySlide(content: SlideContent, grade: number): string {
    const points = content.bullets || ['النقطة الأولى', 'النقطة الثانية', 'النقطة الثالثة'];
    
    return `
    <div class="slide">
        <h2 style="color: white; font-size: 2.5em; margin-bottom: 30px;">
            ${grade <= 6 ? '🎉 ' : ''}${content.title || 'ملخص الدرس'}
        </h2>
        
        <div class="slide-content">
            <ul style="list-style: none; padding: 0;">
                ${points.map(point => `
                <li style="margin: 20px 0; padding-right: 30px; position: relative;">
                    <span style="position: absolute; right: 0; color: var(--primary); font-size: 1.5em;">✓</span>
                    <span style="font-size: var(--font-size-content);">${point}</span>
                </li>
                `).join('')}
            </ul>
        </div>
        
        ${grade <= 6 ? `
        <div style="color: white; margin-top: 30px; font-size: 2em;">
            🏆 أحسنت! لقد أنجزت الدرس
        </div>
        ` : ''}
    </div>`;
  }

  /**
   * الحصول على التدرج اللوني حسب العمر
   */
  private getGradientByGrade(grade: number): string {
    if (grade <= 6) {
      // ابتدائي - ألوان زاهية
      return 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    } else if (grade <= 9) {
      // إعدادي - ألوان متوسطة
      return 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)';
    } else {
      // ثانوي - ألوان احترافية
      return 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)';
    }
  }

  /**
   * توليد مجموعة شرائح لدرس كامل
   */
  generateLessonSlides(slides: SlideContent[], themeName: string = 'adaptive', grade?: number): string[] {
    return slides.map(slide => {
      if (!slide.metadata) slide.metadata = {};
      if (grade) slide.metadata.grade = grade;
      return this.generateSlideHTML(slide, themeName);
    });
  }
}

// Export singleton instance
export const slideService = new SlideService();