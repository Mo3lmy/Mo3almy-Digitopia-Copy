export function getSmartSlidePrompt(slide: any, context: any, grade: number) {
  // Detect slide type
  const isTitle = slide.type === 'title';
  const isContent = slide.type === 'content';
  const isExample = slide.type === 'example';
  const isQuiz = slide.type === 'quiz';

  // Base instruction based on type
  let instruction = '';

  if (isTitle) {
    instruction = `رحب بالطالب وأثر فضوله عن "${slide.title}" في 20 ثانية`;
  } else if (isContent) {
    instruction = `اشرح "${slide.content}" مع إضافة مثال من: ${context?.examples?.[0]?.title || 'الحياة'}`;
  } else if (isExample) {
    instruction = `اشرح هذا المثال خطوة بخطوة وربطه بالواقع`;
  } else if (isQuiz) {
    instruction = `قدم السؤال بطريقة تفاعلية وشجع على التفكير`;
  } else {
    instruction = `اشرح المحتوى بطريقة تعليمية مع أمثلة`;
  }

  return `
أنت معلم للصف ${grade}.
الشريحة: ${slide.title}
${instruction}

قواعد مهمة:
1. لا تقرأ النص فقط - اشرح وأضف قيمة
2. استخدم مثال واحد على الأقل
3. الوقت: ${isTitle ? '20' : isExample ? '45' : '30'} ثانية
4. كن ودوداً ومشجعاً
`;
}