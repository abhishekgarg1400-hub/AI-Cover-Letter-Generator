/**
 * pdf-export.js — PDF export using html2pdf.js
 * Generates a clean, professionally formatted PDF of the cover letter.
 */

const PDFExport = (() => {
  let html2pdfLoaded = false;

  /**
   * Ensure html2pdf.js is loaded from CDN.
   */
  async function loadLibrary() {
    if (html2pdfLoaded && window.html2pdf) return;

    return new Promise((resolve, reject) => {
      // Check if already loaded
      if (window.html2pdf) {
        html2pdfLoaded = true;
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.2/html2pdf.bundle.min.js';
      script.integrity = 'sha512-MpDFImlYBSenMkNnFPMIiPJKIyMwFKHLBmQKFHAq8DS3Rq4IVzSaRkBGjLjmhcUgDJkr7eLOCPbG22PnnuB2g==';
      script.crossOrigin = 'anonymous';
      script.onload = () => {
        html2pdfLoaded = true;
        resolve();
      };
      script.onerror = () => reject(new Error('Failed to load PDF library. Please check your internet connection.'));
      document.head.appendChild(script);
    });
  }

  /**
   * Generate and download a PDF from the cover letter text.
   * @param {string} coverLetterText - The plain text or HTML of the cover letter
   */
  async function downloadPDF(coverLetterText) {
    await loadLibrary();

    // Create a clean, styled container for the PDF attached off-screen
    const container = document.createElement('div');
    container.style.cssText = `
      position: absolute;
      left: -9999px;
      top: 0;
      width: 750px;
      background: #ffffff;
      font-family: 'Georgia', 'Times New Roman', serif;
      font-size: 12pt;
      line-height: 1.6;
      color: #1a1a1a;
      padding: 40px;
      box-sizing: border-box;
    `;

    // Convert plain text paragraphs to styled HTML
    const paragraphs = coverLetterText.split(/\n\n+/);
    container.innerHTML = paragraphs
      .map(p => {
        const trimmed = p.trim();
        if (!trimmed) return '';

        const formattedText = trimmed.replace(/\n/g, '<br>');

        // Check if it's a salutation or closing
        if (trimmed.startsWith('Dear ') || trimmed.startsWith('To ')) {
          return `<p style="margin: 0 0 16pt 0; font-size: 12pt;">${formattedText}</p>`;
        }
        if (trimmed.startsWith('Sincerely') || trimmed.startsWith('Best regards') ||
            trimmed.startsWith('Warm regards') || trimmed.startsWith('Regards') ||
            trimmed.startsWith('Thank you') || trimmed.startsWith('Yours')) {
          return `<p style="margin: 20pt 0 4pt 0; font-size: 12pt;">${formattedText}</p>`;
        }

        return `<p style="margin: 0 0 12pt 0; font-size: 12pt; text-align: justify; line-height: 1.6;">${formattedText}</p>`;
      })
      .join('');

    document.body.appendChild(container);

    // Generate filename with date
    const date = new Date();
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const filename = `Cover_Letter_${dateStr}.pdf`;

    // Configure html2pdf options
    const options = {
      margin: [0.75, 0.75, 0.75, 0.75], // inches
      filename: filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        letterRendering: true,
        scrollX: 0,
        scrollY: 0
      },
      jsPDF: {
        unit: 'in',
        format: 'letter',
        orientation: 'portrait'
      }
    };

    try {
      await html2pdf().set(options).from(container).save();
      return true;
    } catch (err) {
      console.error('PDF generation failed:', err);
      throw new Error('Failed to generate PDF. Please try copying the text instead.');
    } finally {
      if (container.parentNode) {
        container.parentNode.removeChild(container);
      }
    }
  }

  return { downloadPDF, loadLibrary };
})();
