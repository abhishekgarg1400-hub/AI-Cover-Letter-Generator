/**
 * file-parser.js — Multi-format file reader for Resumes
 * Supports: .txt, .md, .pdf, .docx, and Images (.png, .jpg, .jpeg, .webp)
 */

const FileParser = (() => {
  let pdfJsLoaded = false;
  let mammothLoaded = false;

  /**
   * Ensure PDF.js is loaded from CDN
   */
  async function loadPdfJs() {
    if (window.pdfjsLib) return;

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.crossOrigin = 'anonymous';
      script.onload = () => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        pdfJsLoaded = true;
        resolve();
      };
      script.onerror = () => reject(new Error('Failed to load PDF processing library. Check your connection.'));
      document.head.appendChild(script);
    });
  }

  /**
   * Ensure Mammoth.js is loaded from CDN for DOCX files
   */
  async function loadMammoth() {
    if (window.mammoth) return;

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js';
      script.crossOrigin = 'anonymous';
      script.onload = () => {
        mammothLoaded = true;
        resolve();
      };
      script.onerror = () => reject(new Error('Failed to load DOCX processing library. Check your connection.'));
      document.head.appendChild(script);
    });
  }

  /**
   * Parse a text file (.txt, .md)
   */
  function parseTextFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(new Error('Failed to read text file.'));
      reader.readAsText(file);
    });
  }

  /**
   * Parse a PDF file using PDF.js
   */
  async function parsePdfFile(file) {
    await loadPdfJs();

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += pageText + '\n\n';
    }

    const trimmed = fullText.trim();
    if (!trimmed) {
      throw new Error('PDF file appears to be empty or contains scanned images. Try uploading as an image file instead.');
    }

    return trimmed;
  }

  /**
   * Parse a DOCX file using Mammoth.js
   */
  async function parseDocxFile(file) {
    await loadMammoth();

    const arrayBuffer = await file.arrayBuffer();
    const result = await window.mammoth.extractRawText({ arrayBuffer });
    return result.value.trim();
  }

  /**
   * Extract text from resume image using Gemini Multimodal Vision API
   */
  async function parseImageFile(file) {
    const apiKey = GeminiAPI.getApiKey();
    if (!apiKey) {
      throw new Error('Please set your Gemini API key in settings to process image resumes.');
    }

    // Convert file to base64
    const base64Data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const mimeType = file.type || 'image/jpeg';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const body = {
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: 'Extract and transcribe all text from this resume image accurately. Do not add intro text, commentary, or summaries. Just output the verbatim resume text.'
            },
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Data
              }
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 2048
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error('Failed to analyze resume image with AI vision. Please ensure your API key is valid.');
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text || !text.trim()) {
      throw new Error('Could not extract text from the image. Please ensure the image is clear and legible.');
    }

    return text.trim();
  }

  /**
   * Master entry point to parse any supported file format
   */
  async function parseFile(file) {
    const filename = file.name.toLowerCase();
    const mimeType = file.type.toLowerCase();

    if (filename.endsWith('.pdf') || mimeType === 'application/pdf') {
      return await parsePdfFile(file);
    } else if (filename.endsWith('.docx') || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      return await parseDocxFile(file);
    } else if (
      filename.endsWith('.png') || filename.endsWith('.jpg') || filename.endsWith('.jpeg') || filename.endsWith('.webp') ||
      mimeType.startsWith('image/')
    ) {
      return await parseImageFile(file);
    } else if (filename.endsWith('.txt') || filename.endsWith('.md') || mimeType.startsWith('text/')) {
      return await parseTextFile(file);
    } else {
      throw new Error('Unsupported file format. Please upload a .pdf, .docx, .png, .jpg, or .txt file.');
    }
  }

  return { parseFile };
})();
