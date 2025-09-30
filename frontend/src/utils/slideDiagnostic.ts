// frontend/src/utils/slideDiagnostic.ts
// أداة تشخيصية لمعرفة سبب عدم ظهور الستايلات في المشروع الفعلي

/**
 * دالة تشخيصية شاملة لفحص مشاكل عرض الشرائح
 * استخدمها في console المتصفح أو في component
 */
export function diagnoseSlideIssue(htmlContent: string, containerId?: string) {
  console.log('🔍 ========== SLIDE DIAGNOSTIC START ==========');
  
  // 1. فحص المحتوى المستلم
  console.group('📄 1. HTML Content Analysis');
  console.log('Length:', htmlContent.length);
  console.log('Type:', typeof htmlContent);
  console.log('Is Escaped:', htmlContent.includes('&lt;') || htmlContent.includes('&gt;'));
  console.log('First 200 chars:', htmlContent.substring(0, 200));
  
  // فحص المكونات
  const components = {
    DOCTYPE: htmlContent.includes('<!DOCTYPE'),
    HTML_TAG: htmlContent.includes('<html'),
    HEAD_TAG: htmlContent.includes('<head'),
    BODY_TAG: htmlContent.includes('<body'),
    STYLE_TAG: htmlContent.includes('<style'),
    INLINE_STYLES: htmlContent.includes('style='),
    GRADIENT: htmlContent.includes('gradient'),
    COLORS: htmlContent.includes('#') || htmlContent.includes('rgb'),
    FONTS: htmlContent.includes('font-family'),
    ANIMATIONS: htmlContent.includes('animation') || htmlContent.includes('@keyframes')
  };
  
  console.table(components);
  
  // عد الستايلات
  const styleMatches = htmlContent.match(/<style[\s\S]*?<\/style>/g);
  console.log('Style blocks found:', styleMatches ? styleMatches.length : 0);
  
  if (styleMatches) {
    styleMatches.forEach((style, i) => {
      console.log(`Style block ${i + 1} length:`, style.length);
    });
  }
  
  console.groupEnd();

  // 2. فحص الـ DOM الحالي
  console.group('🖥️ 2. Current DOM Analysis');
  
  const container = containerId ? document.getElementById(containerId) : document.body;
  if (!container) {
    console.error('Container not found!');
  } else {
    const iframes = container.querySelectorAll('iframe');
    console.log('Iframes found:', iframes.length);
    
    iframes.forEach((iframe, i) => {
      console.group(`Iframe ${i + 1}`);
      console.log('Source:', iframe.src || iframe.srcdoc?.substring(0, 100) || 'empty');
      console.log('Sandbox:', iframe.sandbox.toString());
      console.log('Width:', iframe.offsetWidth);
      console.log('Height:', iframe.offsetHeight);
      
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (iframeDoc) {
          const iframeStyles = iframeDoc.querySelectorAll('style');
          console.log('Styles in iframe:', iframeStyles.length);
          
          const bodyComputed = iframeDoc.body ? window.getComputedStyle(iframeDoc.body) : null;
          if (bodyComputed) {
            console.log('Body background:', bodyComputed.background.substring(0, 50));
            console.log('Body color:', bodyComputed.color);
            console.log('Body font:', bodyComputed.fontFamily);
          }
        } else {
          console.log('Cannot access iframe document (CORS or not loaded)');
        }
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        console.log('Error accessing iframe:', errorMessage);
      }
      
      console.groupEnd();
    });
  }
  
  console.groupEnd();

  // 3. اختبار عرض مباشر
  console.group('🧪 3. Direct Render Test');
  
  // إنشاء iframe اختباري
  const testIframe = document.createElement('iframe');
  testIframe.style.position = 'fixed';
  testIframe.style.top = '50%';
  testIframe.style.left = '50%';
  testIframe.style.transform = 'translate(-50%, -50%)';
  testIframe.style.width = '800px';
  testIframe.style.height = '600px';
  testIframe.style.zIndex = '999999';
  testIframe.style.border = '5px solid red';
  testIframe.style.boxShadow = '0 0 50px rgba(0,0,0,0.5)';
  
  document.body.appendChild(testIframe);
  
  // معالجة HTML
  let processedHTML = htmlContent;
  
  // فك التشفير إذا لزم
  if (processedHTML.includes('&lt;') || processedHTML.includes('&gt;')) {
    console.log('🔧 Decoding HTML...');
    const textarea = document.createElement('textarea');
    textarea.innerHTML = processedHTML;
    processedHTML = textarea.value;
  }
  
  // عرض باستخدام Blob URL
  const blob = new Blob([processedHTML], { type: 'text/html; charset=utf-8' });
  const blobUrl = URL.createObjectURL(blob);
  testIframe.src = blobUrl;
  
  console.log('✅ Test iframe created with red border');
  console.log('📍 If you see styles in this iframe, the problem is in your component');
  console.log('❌ If no styles, the problem is in the HTML content');
  
  // زر لإزالة الاختبار
  const removeButton = document.createElement('button');
  removeButton.textContent = 'إزالة الاختبار';
  removeButton.style.position = 'fixed';
  removeButton.style.top = '10px';
  removeButton.style.left = '10px';
  removeButton.style.zIndex = '999999';
  removeButton.style.padding = '10px 20px';
  removeButton.style.backgroundColor = 'red';
  removeButton.style.color = 'white';
  removeButton.style.border = 'none';
  removeButton.style.borderRadius = '5px';
  removeButton.style.cursor = 'pointer';
  removeButton.onclick = () => {
    testIframe.remove();
    removeButton.remove();
    URL.revokeObjectURL(blobUrl);
    console.log('🧹 Test iframe removed');
  };
  
  document.body.appendChild(removeButton);
  
  console.groupEnd();

  // 4. اقتراحات الحلول
  console.group('💡 4. Suggested Solutions');
  
  const problems = [];
  
  if (!components.DOCTYPE) problems.push('Missing DOCTYPE - Add <!DOCTYPE html>');
  if (!components.STYLE_TAG && !components.INLINE_STYLES) problems.push('No styles found - Check backend generation');
  if (htmlContent.includes('&lt;')) problems.push('HTML is escaped - Need to decode before rendering');
  if (!components.GRADIENT) problems.push('No gradient styles - Check theme generation');
  
  if (problems.length > 0) {
    console.log('🔴 Problems found:');
    problems.forEach(p => console.log(`  - ${p}`));
  } else {
    console.log('✅ HTML content seems OK');
    console.log('🔍 Check the component rendering method');
  }
  
  console.groupEnd();
  
  console.log('🔍 ========== SLIDE DIAGNOSTIC END ==========');
  
  return {
    components,
    problems,
    testIframeCreated: true
  };
}

/**
 * دالة لإصلاح HTML تلقائياً
 */
export function autoFixHTML(html: string): string {
  console.log('🔧 Auto-fixing HTML...');
  
  // 1. فك التشفير
  if (html.includes('&lt;') || html.includes('&gt;')) {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = html;
    html = textarea.value;
    console.log('✅ Decoded HTML entities');
  }
  
  // 2. إضافة DOCTYPE إذا لم يكن موجود
  if (!html.includes('<!DOCTYPE')) {
    html = '<!DOCTYPE html>\n' + html;
    console.log('✅ Added DOCTYPE');
  }
  
  // 3. إضافة style احتياطي إذا لم تكن هناك ستايلات
  if (!html.includes('<style') && !html.includes('style=')) {
    const fallbackStyle = `
    <style>
      body {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        font-family: 'Tajawal', 'Cairo', sans-serif;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        margin: 0;
        direction: rtl;
      }
      .content {
        text-align: center;
        padding: 40px;
      }
      h1 { font-size: 3em; margin-bottom: 20px; }
      h2 { font-size: 2em; margin-bottom: 15px; opacity: 0.9; }
      p { font-size: 1.5em; line-height: 1.8; }
    </style>
    `;
    
    if (html.includes('</head>')) {
      html = html.replace('</head>', fallbackStyle + '</head>');
    } else if (html.includes('<body>')) {
      html = html.replace('<body>', '<head>' + fallbackStyle + '</head><body>');
    } else {
      html = fallbackStyle + html;
    }
    
    console.log('✅ Added fallback styles');
  }
  
  return html;
}

/**
 * دالة لحفظ HTML للفحص اليدوي
 */
export function saveHTMLForInspection(html: string, filename: string = 'slide-debug.html') {
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  console.log(`📥 HTML saved as ${filename} - Open it in browser to check styles`);
}

// تصدير كـ object للاستخدام في console
if (typeof window !== 'undefined') {
  (window as any).slideDebug = {
    diagnose: diagnoseSlideIssue,
    autoFix: autoFixHTML,
    save: saveHTMLForInspection
  };
  
  console.log('🔧 Slide Debug Tools loaded!');
  console.log('Usage in console:');
  console.log('  slideDebug.diagnose(htmlContent)');
  console.log('  slideDebug.autoFix(htmlContent)');
  console.log('  slideDebug.save(htmlContent)');
}