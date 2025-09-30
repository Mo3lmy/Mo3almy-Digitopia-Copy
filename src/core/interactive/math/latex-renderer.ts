
// الوظيفة: عرض المعادلات الرياضية بشكل تفاعلي باستخدام KaTeX



import katex from 'katex';
// ============= TYPES =============

export interface MathExpression {
  id: string;
  latex: string;
  description?: string;
  type: 'equation' | 'formula' | 'expression' | 'matrix' | 'fraction' | 'integral';
  isInteractive?: boolean;
  steps?: MathStep[];
  variables?: Variable[];
}

export interface MathStep {
  stepNumber: number;
  latex: string;
  explanation: string;
  highlight?: string[]; // أجزاء للتركيز عليها
}

export interface Variable {
  name: string;
  value?: number;
  min?: number;
  max?: number;
  step?: number;
}

export interface RenderOptions {
  displayMode?: boolean; // عرض في سطر منفصل أو inline
  throwOnError?: boolean;
  fontSize?: 'small' | 'normal' | 'large' | 'xlarge';
  color?: string;
  interactive?: boolean;
  showSteps?: boolean;
  enableZoom?: boolean;
}

export interface InteractiveFeatures {
  hover?: boolean; // عرض الشرح عند التمرير
  click?: boolean; // عرض الخطوات عند النقر
  drag?: boolean; // سحب المتغيرات لتغيير القيم
  solve?: boolean; // حل المعادلة خطوة بخطوة
}

// ============= MAIN RENDERER CLASS =============

export class LaTeXMathRenderer {
  private readonly defaultOptions: RenderOptions = {
    displayMode: true,
    throwOnError: false,
    fontSize: 'normal',
    interactive: true,
    showSteps: false,
    enableZoom: true,
  };

  private readonly fontSizeMap = {
    small: '0.8em',
    normal: '1em',
    large: '1.2em',
    xlarge: '1.5em',
  };

  /**
   * عرض معادلة رياضية بسيطة
   */
  renderExpression(
    latex: string,
    options?: RenderOptions
  ): string {
    const opts = { ...this.defaultOptions, ...options };
    
    try {
      const html = katex.renderToString(latex, {
        displayMode: opts.displayMode,
        throwOnError: opts.throwOnError,
        output: 'html',
        strict: false,
        trust: true,
      });

      return this.wrapInContainer(html, opts);
    } catch (error) {
      console.error('LaTeX rendering error:', error);
      return this.renderErrorMessage(latex, error as Error);
    }
  }

  /**
   * عرض معادلة مع خطوات الحل
   */
  renderWithSteps(
    expression: MathExpression,
    options?: RenderOptions
  ): string {
    const opts = { ...this.defaultOptions, ...options, showSteps: true };
    
    let html = '<div class="math-with-steps">';
    
    // عرض المعادلة الأصلية
    html += '<div class="original-equation">';
    html += '<h4>المعادلة:</h4>';
    html += this.renderExpression(expression.latex, { ...opts, fontSize: 'large' });
    html += '</div>';
    
    // عرض الخطوات إذا وجدت
    if (expression.steps && expression.steps.length > 0) {
      html += '<div class="solution-steps">';
      html += '<h4>خطوات الحل:</h4>';
      
      for (const step of expression.steps) {
        html += this.renderStep(step, opts);
      }
      
      html += '</div>';
    }
    
    html += '</div>';
    
    return html;
  }

  /**
   * عرض خطوة واحدة من الحل
   */
  private renderStep(step: MathStep, options: RenderOptions): string {
    let html = '<div class="math-step">';
    
    // رقم الخطوة
    html += `<div class="step-number">خطوة ${step.stepNumber}:</div>`;
    
    // المعادلة
    html += '<div class="step-equation">';
    
    if (step.highlight && step.highlight.length > 0) {
      // تمييز الأجزاء المهمة
      html += this.renderWithHighlight(step.latex, step.highlight, options);
    } else {
      html += this.renderExpression(step.latex, options);
    }
    
    html += '</div>';
    
    // الشرح
    html += `<div class="step-explanation">${step.explanation}</div>`;
    
    html += '</div>';
    
    return html;
  }

  /**
   * عرض معادلة مع تمييز أجزاء معينة
   */
  private renderWithHighlight(
    latex: string,
    highlights: string[],
    options: RenderOptions
  ): string {
    let highlightedLatex = latex;
    
    // إضافة الألوان للأجزاء المميزة
    highlights.forEach((part, index) => {
      const color = this.getHighlightColor(index);
      highlightedLatex = highlightedLatex.replace(
        part,
        `\\colorbox{${color}}{${part}}`
      );
    });
    
    return this.renderExpression(highlightedLatex, options);
  }

  /**
   * عرض معادلة تفاعلية مع متغيرات قابلة للتعديل
   */
  renderInteractiveExpression(
    expression: MathExpression,
    options?: RenderOptions
  ): string {
    const opts = { ...this.defaultOptions, ...options, interactive: true };
    
    let html = '<div class="interactive-math">';
    
    // عرض المعادلة
    html += '<div class="math-display">';
    html += this.renderExpression(expression.latex, opts);
    html += '</div>';
    
    // إضافة عناصر التحكم للمتغيرات
    if (expression.variables && expression.variables.length > 0) {
      html += '<div class="variable-controls">';
      html += '<h5>تعديل المتغيرات:</h5>';
      
      for (const variable of expression.variables) {
        html += this.renderVariableControl(variable);
      }
      
      html += '</div>';
    }
    
    // إضافة أزرار التفاعل
    html += '<div class="math-actions">';
    html += '<button onclick="solveMath()" class="solve-btn">حل المعادلة</button>';
    html += '<button onclick="showSteps()" class="steps-btn">عرض الخطوات</button>';
    html += '<button onclick="resetMath()" class="reset-btn">إعادة تعيين</button>';
    html += '</div>';
    
    html += '</div>';
    
    return html;
  }

  /**
   * عرض عنصر تحكم لمتغير
   */
  private renderVariableControl(variable: Variable): string {
    const min = variable.min || 0;
    const max = variable.max || 10;
    const step = variable.step || 1;
    const value = variable.value || min;
    
    return `
      <div class="variable-control">
        <label>
          <span class="variable-name">${variable.name} = </span>
          <input 
            type="range" 
            min="${min}" 
            max="${max}" 
            step="${step}" 
            value="${value}"
            class="variable-slider"
            data-variable="${variable.name}"
            oninput="updateVariable('${variable.name}', this.value)"
          />
          <span class="variable-value">${value}</span>
        </label>
      </div>
    `;
  }

  /**
   * مجموعة معادلات جاهزة للاستخدام
   */
  getCommonExpressions(): Record<string, MathExpression> {
    return {
      // معادلات جبرية
      quadratic: {
        id: 'quadratic',
        latex: 'ax^2 + bx + c = 0',
        description: 'المعادلة التربيعية العامة',
        type: 'equation',
        variables: [
          { name: 'a', value: 1, min: -10, max: 10 },
          { name: 'b', value: 2, min: -10, max: 10 },
          { name: 'c', value: -3, min: -10, max: 10 },
        ],
        steps: [
          {
            stepNumber: 1,
            latex: 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}',
            explanation: 'نستخدم القانون العام لحل المعادلة التربيعية',
            highlight: ['b^2 - 4ac'],
          },
          {
            stepNumber: 2,
            latex: '\\Delta = b^2 - 4ac',
            explanation: 'نحسب المميز (دلتا) لمعرفة عدد الحلول',
          },
          {
            stepNumber: 3,
            latex: 'x_1 = \\frac{-b + \\sqrt{\\Delta}}{2a}, \\quad x_2 = \\frac{-b - \\sqrt{\\Delta}}{2a}',
            explanation: 'نحسب قيمتي x باستخدام المميز',
          },
        ],
      },
      
      // معادلات المثلثات
      pythagorean: {
        id: 'pythagorean',
        latex: 'a^2 + b^2 = c^2',
        description: 'نظرية فيثاغورس',
        type: 'formula',
        variables: [
          { name: 'a', value: 3, min: 1, max: 20 },
          { name: 'b', value: 4, min: 1, max: 20 },
        ],
      },
      
      // الكسور
      fraction: {
        id: 'fraction',
        latex: '\\frac{a}{b} + \\frac{c}{d} = \\frac{ad + bc}{bd}',
        description: 'جمع الكسور',
        type: 'fraction',
        steps: [
          {
            stepNumber: 1,
            latex: '\\frac{a}{b} + \\frac{c}{d}',
            explanation: 'الكسور الأصلية',
          },
          {
            stepNumber: 2,
            latex: '\\frac{a \\cdot d}{b \\cdot d} + \\frac{c \\cdot b}{d \\cdot b}',
            explanation: 'نوحد المقامات',
          },
          {
            stepNumber: 3,
            latex: '\\frac{ad + bc}{bd}',
            explanation: 'نجمع البسطين على المقام الموحد',
          },
        ],
      },
      
      // المصفوفات
      matrix: {
        id: 'matrix',
        latex: '\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix} \\times \\begin{bmatrix} e & f \\\\ g & h \\end{bmatrix} = \\begin{bmatrix} ae+bg & af+bh \\\\ ce+dg & cf+dh \\end{bmatrix}',
        description: 'ضرب المصفوفات',
        type: 'matrix',
      },
      
      // التكامل
      integral: {
        id: 'integral',
        latex: '\\int_a^b f(x)dx = F(b) - F(a)',
        description: 'النظرية الأساسية للتفاضل والتكامل',
        type: 'integral',
      },
      
      // المتطابقات المثلثية
      trigIdentity: {
        id: 'trig',
        latex: '\\sin^2(x) + \\cos^2(x) = 1',
        description: 'المتطابقة المثلثية الأساسية',
        type: 'formula',
      },
    };
  }

  /**
   * إضافة CSS للتنسيق
   */
  getStyles(): string {
    return `
      <style>
        .math-container {
          padding: 20px;
          background: #f8f9fa;
          border-radius: 8px;
          margin: 10px 0;
          position: relative;
        }
        
        .math-container.interactive {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        
        .math-container .katex {
          font-size: var(--math-font-size, 1em);
        }
        
        .math-container.zoom-enabled {
          cursor: zoom-in;
          transition: transform 0.3s ease;
        }
        
        .math-container.zoom-enabled:hover {
          transform: scale(1.1);
        }
        
        .math-with-steps {
          background: white;
          padding: 20px;
          border-radius: 10px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        .solution-steps {
          margin-top: 20px;
          padding-top: 20px;
          border-top: 2px solid #e0e0e0;
        }
        
        .math-step {
          margin: 15px 0;
          padding: 15px;
          background: #f5f5f5;
          border-radius: 8px;
          border-right: 4px solid #667eea;
        }
        
        .step-number {
          font-weight: bold;
          color: #667eea;
          margin-bottom: 10px;
        }
        
        .step-equation {
          margin: 10px 0;
          text-align: center;
        }
        
        .step-explanation {
          color: #666;
          font-size: 0.9em;
          margin-top: 10px;
        }
        
        .interactive-math {
          background: white;
          padding: 25px;
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.1);
        }
        
        .variable-controls {
          margin: 20px 0;
          padding: 15px;
          background: #f8f9fa;
          border-radius: 8px;
        }
        
        .variable-control {
          margin: 10px 0;
          display: flex;
          align-items: center;
        }
        
        .variable-slider {
          margin: 0 10px;
          width: 200px;
        }
        
        .variable-value {
          font-weight: bold;
          color: #667eea;
          min-width: 30px;
        }
        
        .math-actions {
          margin-top: 20px;
          display: flex;
          gap: 10px;
        }
        
        .math-actions button {
          padding: 10px 20px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-weight: bold;
          transition: all 0.3s;
        }
        
        .solve-btn {
          background: #667eea;
          color: white;
        }
        
        .solve-btn:hover {
          background: #5a67d8;
        }
        
        .steps-btn {
          background: #48bb78;
          color: white;
        }
        
        .reset-btn {
          background: #f56565;
          color: white;
        }
        
        .math-error {
          padding: 15px;
          background: #fee;
          border: 1px solid #fcc;
          border-radius: 8px;
          color: #c00;
        }
        
        /* Highlight colors */
        .katex .highlight-0 { background: rgba(102, 126, 234, 0.3); }
        .katex .highlight-1 { background: rgba(72, 187, 120, 0.3); }
        .katex .highlight-2 { background: rgba(245, 101, 101, 0.3); }
        .katex .highlight-3 { background: rgba(237, 137, 54, 0.3); }
      </style>
    `;
  }

  /**
   * عرض JavaScript للتفاعل
   */
  getScripts(): string {
    return `
      <script>
        // تحديث قيمة المتغير
        function updateVariable(name, value) {
          const valueSpan = document.querySelector(\`[data-variable="\${name}"] ~ .variable-value\`);
          if (valueSpan) {
            valueSpan.textContent = value;
          }
          
          // إعادة حساب المعادلة
          recalculateExpression();
        }
        
        // حل المعادلة
        function solveMath() {
          console.log('Solving equation...');
          // يمكن إضافة منطق الحل هنا
        }
        
        // عرض الخطوات
        function showSteps() {
          const steps = document.querySelector('.solution-steps');
          if (steps) {
            steps.style.display = steps.style.display === 'none' ? 'block' : 'none';
          }
        }
        
        // إعادة تعيين
        function resetMath() {
          document.querySelectorAll('.variable-slider').forEach(slider => {
            slider.value = slider.getAttribute('data-default') || slider.min;
            updateVariable(slider.getAttribute('data-variable'), slider.value);
          });
        }
        
        // إعادة حساب المعادلة
        function recalculateExpression() {
          // يمكن إضافة منطق إعادة الحساب هنا
          console.log('Recalculating...');
        }
        
        // تكبير/تصغير المعادلات
        document.querySelectorAll('.zoom-enabled').forEach(elem => {
          elem.addEventListener('click', function() {
            this.classList.toggle('zoomed');
          });
        });
      </script>
    `;
  }

  /**
   * Helper: لف المحتوى في container
   */
  private wrapInContainer(html: string, options: RenderOptions): string {
    const classes = ['math-container'];
    if (options.interactive) classes.push('interactive');
    if (options.enableZoom) classes.push('zoom-enabled');
    
    const fontSize = this.fontSizeMap[options.fontSize || 'normal'];
    const style = `--math-font-size: ${fontSize};`;
    
    return `
      <div class="${classes.join(' ')}" style="${style}">
        ${html}
      </div>
    `;
  }

  /**
   * Helper: عرض رسالة خطأ
   */
  private renderErrorMessage(latex: string, error: Error): string {
    return `
      <div class="math-error">
        <strong>خطأ في عرض المعادلة:</strong><br>
        <code>${latex}</code><br>
        <small>${error.message}</small>
      </div>
    `;
  }

  /**
   * Helper: الحصول على لون التمييز
   */
  private getHighlightColor(index: number): string {
    const colors = ['yellow', 'lightblue', 'lightgreen', 'pink'];
    return colors[index % colors.length];
  }
}

// Export singleton instance
export const latexRenderer = new LaTeXMathRenderer();