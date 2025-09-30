// frontend/src/components/SlideViewer.tsx
// مكون عرض الشرائح - الحل النهائي مع إصلاح مشكلة التحميل المستمر

import { useEffect, useRef, useState } from 'react';

interface SlideViewerProps {
  htmlContent: string;
  className?: string;
}

/**
 * مكون عرض الشرائح المحسن
 */
export function SlideViewer({ htmlContent, className = '' }: SlideViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(false); // تغيير القيمة الافتراضية إلى false
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // تنظيف أي timeout سابق
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (!htmlContent) {
      console.log('⚠️ No HTML content provided');
      setIsLoading(false);
      return;
    }

    console.log('🎨 SlideViewer: Processing slide HTML...');
    console.log('📏 HTML Length:', htmlContent.length);
    
    displaySlide();

    // تنظيف عند unmount
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [htmlContent]);

  /**
   * عرض الشريحة باستخدام iframe
   */
  const displaySlide = () => {
    if (!iframeRef.current || !htmlContent) {
      console.error('❌ No iframe ref or content');
      setIsLoading(false);
      return;
    }

    // بدء التحميل
    setIsLoading(true);
    console.log('⏳ Starting to load slide...');

    // معالجة HTML
    const processedHTML = processHTML(htmlContent);
    console.log('✅ HTML processed, length:', processedHTML.length);

    // استخدام blob URL
    const blob = new Blob([processedHTML], { type: 'text/html; charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);
    console.log('📦 Blob URL created');

    // إضافة listeners للـ iframe
    const iframe = iframeRef.current;
    
    // دالة لإنهاء التحميل
    const finishLoading = () => {
      console.log('✅ Slide loaded successfully!');
      setIsLoading(false);
      
      // تنظيف
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      // تنظيف blob URL بعد قليل
      setTimeout(() => {
        URL.revokeObjectURL(blobUrl);
        console.log('🧹 Blob URL cleaned');
      }, 100);
    };

    // تعيين onload handler
    iframe.onload = () => {
      console.log('📄 iframe onload triggered');
      finishLoading();
    };

    // في حالة فشل onload، استخدم timeout كـ fallback
    timeoutRef.current = setTimeout(() => {
      console.log('⏰ Loading timeout reached, forcing completion');
      finishLoading();
    }, 2000); // انتظر ثانيتين كحد أقصى

    // تعيين المصدر
    iframe.src = blobUrl;
    console.log('🔗 Blob URL assigned to iframe');
  };

  /**
   * معالجة HTML وإصلاح أي مشاكل
   */
  const processHTML = (html: string): string => {
    console.log('🔧 Processing HTML...');
    
    // 1. فك التشفير إذا لزم
    if (html.includes('&lt;') || html.includes('&gt;')) {
      console.log('🔓 Decoding escaped HTML...');
      const textarea = document.createElement('textarea');
      textarea.innerHTML = html;
      html = textarea.value;
      
      // فك تشفير مزدوج إذا لزم
      if (html.includes('&lt;') || html.includes('&gt;')) {
        textarea.innerHTML = html;
        html = textarea.value;
      }
    }

    // 2. التحقق من وجود المكونات الأساسية
    const checks = {
      hasDoctype: html.includes('<!DOCTYPE'),
      hasHtml: html.includes('<html'),
      hasHead: html.includes('<head'),
      hasBody: html.includes('<body'),
      hasStyles: html.includes('<style') || html.includes('<link'),
      hasGradient: html.includes('gradient')
    };

    console.log('📊 HTML Structure:', checks);

    // 3. إصلاح المشاكل
    if (!checks.hasDoctype || !checks.hasHtml || !checks.hasHead || !checks.hasBody) {
      console.log('🔧 Wrapping incomplete HTML...');
      html = wrapInCompleteHTML(html);
    }

    // 4. إضافة الستايلات إذا لم تكن موجودة
    if (!checks.hasStyles || !checks.hasGradient) {
      console.log('🎨 Injecting missing styles...');
      html = injectStyles(html);
    }

    // 5. التأكد من وجود meta tags
    if (!html.includes('viewport')) {
      html = html.replace('<head>', '<head>\n<meta name="viewport" content="width=device-width, initial-scale=1.0">');
    }

    if (!html.includes('charset')) {
      html = html.replace('<head>', '<head>\n<meta charset="UTF-8">');
    }

    console.log('✅ HTML processing complete');
    return html;
  };

  /**
   * إضافة الستايلات المطلوبة
   */
  const injectStyles = (html: string): string => {
    const styleTag = `
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      
      body {
        width: 100vw;
        height: 100vh;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        font-family: 'Cairo', 'Tajawal', sans-serif;
        display: flex;
        align-items: center;
        justify-content: center;
        direction: rtl;
        padding: 40px;
        overflow: hidden;
        text-align: center;
      }
      
      h1, h2, h3, h4, h5, h6 { 
        color: white; 
        margin-bottom: 20px; 
        text-shadow: 2px 2px 8px rgba(0,0,0,0.3);
      }
      
      h1 { font-size: 3em; }
      h2 { font-size: 2.5em; }
      h3 { font-size: 2em; }
      
      p { 
        color: white; 
        font-size: 1.5em; 
        line-height: 1.8; 
        margin-bottom: 20px;
      }
      
      ul { list-style: none; padding: 0; }
      
      li {
        color: white;
        font-size: 1.3em;
        margin: 15px 0;
        padding-right: 30px;
        position: relative;
        text-align: right;
      }
      
      li::before {
        content: "✦";
        position: absolute;
        right: 0;
        color: #ffd700;
        font-size: 1.2em;
      }
      
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
      
      body > * { animation: fadeIn 0.8s ease-out; }
    </style>`;

    if (html.includes('</head>')) {
      return html.replace('</head>', styleTag + '\n</head>');
    } else if (html.includes('<body')) {
      return html.replace('<body', '<head>' + styleTag + '</head>\n<body');
    } else {
      return '<head>' + styleTag + '</head>\n' + html;
    }
  };

  /**
   * لف HTML غير الكامل في document كامل
   */
  const wrapInCompleteHTML = (content: string): string => {
    return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&family=Tajawal:wght@400;700&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            width: 100vw;
            height: 100vh;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            font-family: 'Cairo', 'Tajawal', sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            direction: rtl;
            padding: 40px;
            text-align: center;
        }
        
        h1, h2, h3, p, li { 
            color: white; 
            animation: fadeIn 0.8s ease-out;
        }
        
        h1 { 
            font-size: 3em; 
            margin-bottom: 20px; 
            text-shadow: 2px 2px 8px rgba(0,0,0,0.3);
        }
        
        h2 { 
            font-size: 2em; 
            margin-bottom: 15px; 
            opacity: 0.95;
        }
        
        p { 
            font-size: 1.5em; 
            line-height: 1.8; 
            margin-bottom: 20px;
        }
        
        ul { 
            list-style: none; 
            padding: 0; 
            text-align: right;
        }
        
        li {
            font-size: 1.3em;
            margin: 15px 0;
            padding-right: 30px;
            position: relative;
        }
        
        li::before {
            content: "✦";
            position: absolute;
            right: 0;
            color: #ffd700;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
    </style>
</head>
<body>
    <div class="slide-container">
        ${content}
    </div>
</body>
</html>`;
  };

  // إذا لم يكن هناك محتوى
  if (!htmlContent) {
    return (
      <div className={`flex items-center justify-center h-full bg-gray-100 rounded-lg ${className}`}>
        <div className="text-center">
          <div className="text-gray-400 text-4xl mb-4">📄</div>
          <p className="text-gray-500 text-xl">لا يوجد محتوى للعرض</p>
        </div>
      </div>
    );
  }

  // عرض الشريحة (بدون loading state طويل)
  return (
    <div className={`relative w-full h-full ${className}`} style={{ minHeight: '600px' }}>
      {/* Loading overlay قصير جداً */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-90 rounded-lg z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">جاري تحميل الشريحة...</p>
          </div>
        </div>
      )}
      
      {/* iframe دائماً موجود */}
      <iframe
        ref={iframeRef}
        className="w-full h-full border-0 rounded-lg bg-white"
        title="slide-content"
        sandbox="allow-scripts allow-same-origin"
        style={{ 
          visibility: isLoading ? 'hidden' : 'visible',
          minHeight: '600px' 
        }}
      />
    </div>
  );
}

// تصدير المكون
export default SlideViewer;