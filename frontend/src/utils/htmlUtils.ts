/**
 * Decode HTML entities and handle escaped HTML
 */
export function decodeHTML(html: string): string {
  // Check if HTML needs decoding
  if (!html.includes('&lt;') && !html.includes('&gt;') && !html.includes('&quot;')) {
    return html;
  }

  // Create a textarea element for decoding
  const textarea = document.createElement('textarea');
  textarea.innerHTML = html;
  let decoded = textarea.value;

  // If still contains escaped characters, decode again
  if (decoded.includes('&lt;') || decoded.includes('&gt;')) {
    textarea.innerHTML = decoded;
    decoded = textarea.value;
  }

  return decoded;
}

/**
 * Verify if HTML content is valid
 */
export function isValidHTML(html: string): boolean {
  return html.includes('<') && html.includes('>') &&
         (html.includes('<!DOCTYPE') || html.includes('<html') || html.includes('<div'));
}

/**
 * Wrap partial HTML in a full document structure
 */
export function wrapHTMLDocument(content: string, isRTL: boolean = true): string {
  // If already a full document, return as is
  if (content.includes('<!DOCTYPE') || content.includes('<html')) {
    return content;
  }

  return `
    <!DOCTYPE html>
    <html dir="${isRTL ? 'rtl' : 'ltr'}" lang="${isRTL ? 'ar' : 'en'}">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&family=Cairo:wght@400;700&display=swap" rel="stylesheet">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Tajawal', 'Cairo', 'Segoe UI', sans-serif;
          direction: ${isRTL ? 'rtl' : 'ltr'};
          width: 100vw;
          height: 100vh;
          overflow: hidden;
        }
      </style>
    </head>
    <body>
      ${content}
    </body>
    </html>
  `;
}