import axios from "axios";
import type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  User,
} from "@/types/auth";

// Create axios instance
const api = axios.create({
  baseURL: `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/v1`,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor to add token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling with smart retry
api.interceptors.response.use(
  (response) => response,
  async (error: any) => {
    const originalRequest = error.config;

    // Handle rate limiting with smart retry (exponential backoff)
    if (error.response?.status === 429) {
      // لا تعيد المحاولة للـ status endpoint - سيتم التعامل معه في classroom page
      if (originalRequest.url?.includes('/teaching/status')) {
        return Promise.reject(error);
      }

      if (!originalRequest._retryCount) {
        originalRequest._retryCount = 0;
      }

      if (originalRequest._retryCount < 3) {
        originalRequest._retryCount++;

        // Exponential backoff: 2s, 4s, 8s
        const delay = Math.pow(2, originalRequest._retryCount) * 1000;

        console.log(`Rate limited, retrying after ${delay/1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));

        return api(originalRequest);
      }
    }

    // Handle 404 for quiz endpoints - use fallback
    if (error.response?.status === 404 && originalRequest.url?.includes('quiz')) {
      console.log('Quiz endpoint not found, using fallback');
      return { data: { success: false, data: null } };
    }

    // Handle 404 for teaching endpoints - use fallback
    if (error.response?.status === 404 && originalRequest.url?.includes('teaching')) {
      console.log('Teaching endpoint not found, using fallback');
      return { data: { success: false, data: null } };
    }

    // Log للـ development
    if (process.env.NODE_ENV === 'development') {
      console.error('API Error:', {
        url: error.config?.url,
        method: error.config?.method,
        status: error.response?.status,
        data: error.response?.data
      });
    }

    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/auth/login";
    }

    // Handle server errors with retry
    if (error.response?.status >= 500 && !originalRequest._serverRetry) {
      originalRequest._serverRetry = true;
      await new Promise(resolve => setTimeout(resolve, 1000));
      return api(originalRequest);
    }

    return Promise.reject(error);
  }
);

// ============= UTILITY FUNCTIONS FOR HTML PROCESSING =============

/**
 * فك تشفير HTML entities والتعامل مع escaped HTML
 */
function decodeHTMLEntities(html: string): string {
  // إذا لم يكن هناك HTML escaped، أرجع النص كما هو
  if (!html.includes('&lt;') && !html.includes('&gt;') && !html.includes('&quot;')) {
    return html;
  }

  console.log('🔧 Decoding HTML entities...');
  
  // استخدام textarea لفك التشفير بشكل آمن
  const textarea = document.createElement('textarea');
  textarea.innerHTML = html;
  let decoded = textarea.value;
  
  // فك تشفير مزدوج إذا لزم الأمر
  if (decoded.includes('&lt;') || decoded.includes('&gt;')) {
    console.log('🔧 Double decoding needed...');
    textarea.innerHTML = decoded;
    decoded = textarea.value;
  }
  
  console.log('✅ HTML decoded successfully');
  return decoded;
}

/**
 * التحقق من صحة HTML والتأكد من وجود الستايلات
 */
function validateSlideHTML(html: string, slideIndex: number): {
  isValid: boolean;
  issues: string[];
  stats: any;
} {
  const issues: string[] = [];
  
  // التحقق الأساسي
  if (!html || typeof html !== 'string') {
    issues.push('HTML is not a valid string');
    return { isValid: false, issues, stats: {} };
  }

  // فحص المكونات الأساسية
  const stats = {
    length: html.length,
    hasDoctype: html.includes('<!DOCTYPE'),
    hasHtml: html.includes('<html'),
    hasHead: html.includes('<head'),
    hasBody: html.includes('<body'),
    hasStyles: html.includes('<style') || html.includes('<link'),
    hasGradient: html.includes('gradient'),
    hasArabicFont: html.includes('Tajawal') || html.includes('Cairo'),
    hasRTL: html.includes('dir="rtl"') || html.includes('direction: rtl'),
    isEscaped: html.includes('&lt;') || html.includes('&gt;')
  };

  // تسجيل المشاكل
  if (!stats.hasDoctype) issues.push('Missing DOCTYPE');
  if (!stats.hasHtml) issues.push('Missing HTML tag');
  if (!stats.hasHead) issues.push('Missing HEAD tag');
  if (!stats.hasBody) issues.push('Missing BODY tag');
  if (!stats.hasStyles) issues.push('No styles found');
  if (!stats.hasGradient) issues.push('No gradient backgrounds');
  if (!stats.hasArabicFont) issues.push('No Arabic fonts');
  if (!stats.hasRTL) issues.push('No RTL support');
  if (stats.isEscaped) issues.push('HTML is escaped');
  if (stats.length < 500) issues.push(`HTML too short (${stats.length} chars)`);

  const isValid = issues.length === 0 || (issues.length <= 2 && stats.hasStyles);
  
  // Log التفاصيل
  console.log(`📊 Slide ${slideIndex + 1} validation:`, {
    isValid,
    stats,
    issues: issues.length > 0 ? issues : 'None'
  });

  return { isValid, issues, stats };
}

/**
 * معالجة HTML للشريحة وإصلاح أي مشاكل
 */
function processSlideHTML(html: string, slideIndex: number): string {
  console.log(`🔄 Processing slide ${slideIndex + 1}...`);

  // 1. فك التشفير إذا لزم
  if (html.includes('&lt;') || html.includes('&gt;')) {
    html = decodeHTMLEntities(html);
  }

  // 2. التحقق من الصحة
  const validation = validateSlideHTML(html, slideIndex);
  
  // 3. إصلاح المشاكل إذا وجدت
  if (!validation.isValid && validation.issues.length > 3) {
    console.warn(`⚠️ Slide ${slideIndex + 1} has multiple issues, attempting fixes...`);
    
    // إذا كان HTML جزئي، قم بلفه في document كامل
    if (!validation.stats.hasDoctype || !validation.stats.hasHtml) {
      console.log('🔧 Wrapping partial HTML in full document...');
      html = wrapInFullDocument(html);
    }
    
    // إضافة الخطوط العربية إذا لم تكن موجودة
    if (!validation.stats.hasArabicFont) {
      console.log('🔧 Adding Arabic fonts...');
      html = html.replace('<head>', `
        <head>
        <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&family=Cairo:wght@400;700&display=swap" rel="stylesheet">
      `);
    }
    
    // إضافة RTL support إذا لم يكن موجود
    if (!validation.stats.hasRTL) {
      console.log('🔧 Adding RTL support...');
      html = html.replace('<html', '<html dir="rtl" lang="ar"');
      if (!html.includes('direction: rtl')) {
        html = html.replace('<style>', '<style>body { direction: rtl; }');
      }
    }
  }

  return html;
}

/**
 * لف HTML جزئي في document كامل
 */
function wrapInFullDocument(partialHTML: string): string {
  return `
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
            font-family: 'Tajawal', 'Cairo', 'Segoe UI', sans-serif;
            direction: rtl;
            width: 100vw;
            height: 100vh;
            overflow: hidden;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .content {
            padding: 40px;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="content">
        ${partialHTML}
    </div>
</body>
</html>`;
}

// ============= API CALLS =============

// Auth API calls
export const authAPI = {
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    const response = await api.post<LoginResponse>("/auth/login", data);
    return response.data;
  },

  register: async (data: RegisterRequest): Promise<RegisterResponse> => {
    const response = await api.post<RegisterResponse>("/auth/register", data);
    return response.data;
  },

  logout: async (): Promise<void> => {
    // Clear local storage
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  },

  getMe: async (): Promise<User> => {
    const response = await api.get<{ data: User }>("/auth/me");
    return response.data.data;
  },

  updateProfile: async (data: Partial<User>): Promise<User> => {
    const response = await api.put<{ data: User }>("/auth/profile", data);
    return response.data.data;
  },
};

// Lesson API calls with enhanced HTML processing
export const lessonAPI = {
  getAllLessons: async (): Promise<any> => {
    const response = await api.get<{ data: any }>("/lessons");
    return response.data.data;
  },

  getLesson: async (id: string): Promise<any> => {
    const response = await api.get<{ data: any }>(`/lessons/${id}`);
    return response.data.data;
  },

  /**
   * جلب شرائح الدرس مع معالجة HTML المحسنة
   * هذه الدالة الرئيسية لحل مشكلة الستايلات
   */
  getLessonSlides: async (id: string): Promise<any> => {
    try {
      console.log(`📥 Fetching slides for lesson ${id}...`);
      
      const response = await api.get<{ data: any }>(`/lessons/${id}/slides`);
      
      // التحقق من صحة الاستجابة
      if (!response.data?.data) {
        console.error('❌ Invalid response structure');
        return null;
      }

      const data = response.data.data;
      
      // التحقق من وجود الشرائح
      if (!data.slides || !Array.isArray(data.slides)) {
        console.error('❌ No slides array in response');
        return data;
      }

      console.log(`📊 Processing ${data.slides.length} slides...`);
      
      // معالجة كل شريحة
      data.slides = data.slides.map((slide: any, index: number) => {
        if (!slide.html) {
          console.error(`❌ Slide ${index + 1} has no HTML content`);
          return slide;
        }

        // معالجة HTML للشريحة
        const originalLength = slide.html.length;
        slide.html = processSlideHTML(slide.html, index);
        const processedLength = slide.html.length;
        
        // Log التغييرات
        if (processedLength !== originalLength) {
          console.log(`✏️ Slide ${index + 1} HTML modified: ${originalLength} -> ${processedLength} chars`);
        }
        
        return slide;
      });

      console.log('✅ All slides processed successfully');
      return data;
      
    } catch (error) {
      console.error('❌ Error fetching slides:', error);
      throw error;
    }
  },

  /**
   * دالة بديلة لجلب الشرائح مع theme محدد
   */
  getSlidesWithTheme: async (id: string, theme: string = 'adaptive'): Promise<any> => {
    try {
      console.log(`📥 Fetching slides with theme: ${theme}`);
      
      const response = await api.get<any>(`/lessons/${id}/slides?theme=${theme}`);

      if (response.data?.success && response.data?.data?.slides) {
        const slides = response.data.data.slides;
        
        console.log(`📄 Got ${slides.length} slides with ${theme} theme`);
        
        // معالجة الشرائح
        response.data.data.slides = slides.map((slide: any, index: number) => {
          if (slide.html) {
            slide.html = processSlideHTML(slide.html, index);
          }
          return slide;
        });
        
        return response.data.data;
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching themed slides:', error);
      return null;
    }
  },

  /**
   * توليد شرائح ذكية جديدة
   */
  generateSmartSlides: async (id: string, options?: any): Promise<any> => {
    try {
      console.log(`🤖 Generating smart slides for lesson ${id}...`);
      
      const response = await api.post<{ data: { slides?: any[] } }>(`/lessons/${id}/slides/generate-smart`, {
        withVoice: options?.withVoice || false,
        withTeaching: options?.withTeaching || true,
        theme: 'adaptive',
        ...options
      });
      
      if (response.data?.data?.slides) {
        // معالجة الشرائح المولدة
        response.data.data.slides = response.data.data.slides.map((slide: any, index: number) => {
          if (slide.html) {
            slide.html = processSlideHTML(slide.html, index);
          }
          return slide;
        });
        
        console.log(`✅ Generated ${response.data.data.slides.length} smart slides`);
      }
      
      return response.data;
      
    } catch (error) {
      console.error('Error generating smart slides:', error);
      throw error;
    }
  },

  startLesson: async (id: string): Promise<any> => {
    const response = await api.post<{ data: any }>(`/lessons/${id}/start`);
    return response.data.data;
  },

  completeLesson: async (id: string): Promise<any> => {
    const response = await api.post<{ data: any }>(`/lessons/${id}/complete`);
    return response.data.data;
  },
};

// Quiz API calls
export const quizAPI = {
  getQuiz: async (lessonId: string): Promise<any> => {
    const response = await api.get<{ data: any }>(`/quiz/lesson/${lessonId}`);
    return response.data.data;
  },

  submitAnswer: async (data: {
    lessonId: string;
    questionId: string;
    answer: string;
  }): Promise<any> => {
    const response = await api.post<{ data: any }>("/quiz/submit", data);
    return response.data.data;
  },

  getResults: async (attemptId: string): Promise<any> => {
    const response = await api.get<{ data: any }>(`/quiz/results/${attemptId}`);
    return response.data.data;
  },
};

// Chat API calls
export const chatAPI = {
  sendMessage: async (lessonId: string, message: string): Promise<any> => {
    const response = await api.post<{ data: any }>(`/chat/${lessonId}`, { message });
    return response.data.data;
  },

  getChatHistory: async (lessonId: string): Promise<any> => {
    const response = await api.get<{ data: any }>(`/chat/${lessonId}/history`);
    return response.data.data;
  },
};

// Achievement API calls
export const achievementAPI = {
  getAchievements: async (): Promise<any> => {
    const response = await api.get<{ data: any }>("/achievements");
    return response.data.data;
  },

  claimReward: async (achievementId: string): Promise<any> => {
    const response = await api.post<{ data: any }>(`/achievements/${achievementId}/claim`);
    return response.data.data;
  },
};

// Teaching API calls
export const teachingAPI = {
  generateScript: async (lessonId: string, slideContent: any, options?: any) => {
    const response = await api.post(`/lessons/${lessonId}/teaching/script`, {
      slideContent,
      generateVoice: true,
      options
    });
    return response.data;
  },

  handleInteraction: async (lessonId: string, type: string, context?: any) => {
    const response = await api.post(`/lessons/${lessonId}/teaching/interaction`, {
      type,
      slideContent: context?.currentSlide,
      context
    });
    return response.data;
  },

  generateSmartLesson: async (lessonId: string) => {
    const response = await api.post(`/lessons/${lessonId}/teaching/generate-smart`);
    return response.data;
  },

  getStatus: async (lessonId: string) => {
    const response = await api.get(`/lessons/${lessonId}/teaching/status`);
    return response.data;
  }
};

// ============= UTILITY FUNCTIONS EXPORTED =============

/**
 * التحقق من صحة HTML content
 * يمكن استخدامها من أي مكان في التطبيق
 */
export const verifySlideHTML = (html: string): boolean => {
  if (!html || typeof html !== 'string') {
    console.error('❌ Invalid HTML: not a string');
    return false;
  }
  
  const checks = {
    hasDoctype: html.includes('<!DOCTYPE'),
    hasHtml: html.includes('<html'),
    hasHead: html.includes('<head'),
    hasBody: html.includes('<body'),
    hasStyles: html.includes('<style'),
    minLength: html.length > 500
  };
  
  const isValid = Object.values(checks).every(check => check === true);
  
  if (!isValid) {
    console.warn('⚠️ HTML validation failed:', checks);
  }
  
  return isValid;
};

/**
 * دالة لتصحيح HTML تلقائياً
 * يمكن استخدامها قبل عرض أي شريحة
 */
export const fixSlideHTML = (html: string): string => {
  return processSlideHTML(html, 0);
};

/**
 * دالة للتحقق من الستايلات في HTML
 */
export const checkSlideStyles = (html: string): {
  hasStyles: boolean;
  hasGradient: boolean;
  hasAnimations: boolean;
  hasArabicFonts: boolean;
} => {
  return {
    hasStyles: html.includes('<style') || html.includes('<link'),
    hasGradient: html.includes('gradient'),
    hasAnimations: html.includes('animation') || html.includes('@keyframes'),
    hasArabicFonts: html.includes('Tajawal') || html.includes('Cairo')
  };
};

export default api;