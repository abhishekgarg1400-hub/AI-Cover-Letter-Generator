/**
 * file-parser.js — Ultra-robust Multi-Format Resume Extractor
 * Supports: .pdf, .docx, .doc, .png, .jpg, .jpeg, .webp, .txt, .md
 */

const FileParser = (() => {

  /**
   * Parse plain text (.txt, .md)
   */
  function parseTextFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result || '');
      reader.onerror = () => reject(new Error('Failed to read text file.'));
      reader.readAsText(file);
    });
  }

  /**
   * Raw text extraction fallback from binary ArrayBuffer
   */
  function extractRawPrintableText(arrayBuffer) {
    try {
      const bytes = new Uint8Array(arrayBuffer);
      let str = '';
      const len = Math.min(bytes.length, 500000); // cap at 500KB for speed
      for (let i = 0; i < len; i++) {
        str += String.fromCharCode(bytes[i]);
      }

      // Extract PDF Tj/TJ literals
      const matches = str.match(/\(([^)]+)\)\s*Tj/g) || [];
      if (matches.length > 5) {
        const text = matches.map(m => m.replace(/^\(/, '').replace(/\)\s*Tj$/, '')).join(' ');
        if (text.length > 50) return text.trim();
      }

      // General printable ASCII cleanup
      const cleaned = str.replace(/[^\x20-\x7E\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim();
      const words = cleaned.split(' ').filter(w => w.length > 1 && !/^[0-9]+$/.test(w));
      return words.join(' ').substring(0, 5000);
    } catch (e) {
      return '';
    }
  }

  /**
   * Parse PDF file using preloaded PDF.js or raw fallback
   */
  async function parsePdfFile(file) {
    const arrayBuffer = await file.arrayBuffer();

    if (window.pdfjsLib) {
      try {
        const loadingTask = window.pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        let fullText = '';

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map(item => item.str).join(' ');
          fullText += pageText + '\n\n';
        }

        const trimmed = fullText.trim();
        if (trimmed && trimmed.length > 10) return trimmed;
      } catch (err) {
        console.warn('PDF.js parsing warning:', err);
      }
    }

    // Direct fallback
    const rawText = extractRawPrintableText(arrayBuffer);
    if (rawText && rawText.length > 20) return rawText;

    // Last resort text reader
    const txt = await parseTextFile(file);
    const cleaned = txt.replace(/[^\x20-\x7E\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim();
    if (cleaned.length > 20) return cleaned;

    throw new Error('Unable to extract text from this PDF. Please copy and paste your resume text directly.');
  }

  /**
   * Parse Word file (.docx, .doc) using Mammoth.js or raw fallback
   */
  async function parseDocxFile(file) {
    const arrayBuffer = await file.arrayBuffer();

    if (window.mammoth) {
      try {
        const result = await window.mammoth.extractRawText({ arrayBuffer });
        if (result.value && result.value.trim()) {
          return result.value.trim();
        }
      } catch (err) {
        console.warn('Mammoth DOCX parsing warning:', err);
      }
    }

    // Direct fallback
    const rawText = extractRawPrintableText(arrayBuffer);
    if (rawText && rawText.length > 20) return rawText;

    throw new Error('Unable to extract text from Word document. Please copy and paste your resume text directly.');
  }

  /**
   * Extract text from Image file using Gemini Vision API
   */
  async function parseImageFile(file) {
    const apiKey = GeminiAPI.getApiKey();
    if (!apiKey) {
      throw new Error('Please set your Gemini API key in Settings (⚙️) to analyze image resumes.');
    }

    const base64Data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result || '';
        const base64 = result.split(',')[1] || '';
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    let activeModel = 'gemini-1.5-flash';
    if (GeminiAPI.fetchValidModelsForKey) {
      try {
        const models = await GeminiAPI.fetchValidModelsForKey(apiKey);
        if (models && models.length > 0) activeModel = models[0];
      } catch (e) {}
    }

    const mimeType = file.type || 'image/jpeg';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${activeModel}:generateContent?key=${apiKey}`;

    const body = {
      contents: [
        {
          role: 'user',
          parts: [
            { text: 'Extract and transcribe all text from this resume image. Output only the verbatim text.' },
            { inlineData: { mimeType: mimeType, data: base64Data } }
          ]
        }
      ],
      generationConfig: { temperature: 0.1, maxOutputTokens: 2048 }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error('Failed to process image resume with AI. Check your API key and connection.');
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text || !text.trim()) {
      throw new Error('Could not extract legible text from this image.');
    }

    return text.trim();
  }

  /**
   * Master Entry Point
   */
  async function parseFile(file) {
    if (!file) throw new Error('No file selected.');

    const name = (file.name || '').toLowerCase();
    const type = (file.type || '').toLowerCase();

    console.log(`Processing uploaded file: ${name} (${type}, ${file.size} bytes)`);

    if (name.endsWith('.pdf') || type === 'application/pdf') {
      return await parsePdfFile(file);
    }

    if (name.endsWith('.docx') || name.endsWith('.doc') || type.includes('word') || type.includes('officedocument')) {
      return await parseDocxFile(file);
    }

    if (name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.webp') || type.startsWith('image/')) {
      return await parseImageFile(file);
    }

    // Default plain text / markdown / unknown
    return await parseTextFile(file);
  }

  return { parseFile };
})();
