/**
 * pdf-export.js — Robust Dual-Engine PDF Export
 * Uses html2pdf.js + jsPDF direct vector text fallback.
 */

const PDFExport = (() => {
  let html2pdfLoaded = false;

  /**
   * Ensure html2pdf.js / jsPDF library is loaded.
   */
  async function loadLibrary() {
    if (window.html2pdf || window.jsPDF || (window.jspdf && window.jspdf.jsPDF)) {
      html2pdfLoaded = true;
      return true;
    }

    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'js/html2pdf.bundle.min.js';
      script.onload = () => {
        html2pdfLoaded = true;
        resolve(true);
      };
      script.onerror = () => {
        // Fall back to CDN if local script tag fails
        const cdnScript = document.createElement('script');
        cdnScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.2/html2pdf.bundle.min.js';
        cdnScript.onload = () => {
          html2pdfLoaded = true;
          resolve(true);
        };
        cdnScript.onerror = () => resolve(false);
        document.head.appendChild(cdnScript);
      };
      document.head.appendChild(script);
    });
  }

  /**
   * Vector text PDF fallback using jsPDF
   */
  function generateVectorPDF(coverLetterText, filename) {
    const jsPDFConstructor = window.jsPDF || (window.jspdf && window.jspdf.jsPDF);
    if (!jsPDFConstructor) return false;

    try {
      const doc = new jsPDFConstructor({
        orientation: 'portrait',
        unit: 'in',
        format: 'letter'
      });

      const margin = 0.75; // 0.75 in margins
      const pageWidth = 8.5;
      const pageHeight = 11;
      const maxLineWidth = pageWidth - (margin * 2); // 7 inches wide

      doc.setFont('times', 'normal');
      doc.setFontSize(12);
      doc.setTextColor(26, 26, 26);

      let y = margin;
      const lineHeight = 0.24;

      const paragraphs = coverLetterText.split(/\n\n+/);
      for (let i = 0; i < paragraphs.length; i++) {
        const trimmed = paragraphs[i].trim();
        if (!trimmed) continue;

        // Split paragraph into lines wrapped to page width
        const lines = doc.splitTextToSize(trimmed, maxLineWidth);

        for (const line of lines) {
          if (y + lineHeight > pageHeight - margin) {
            doc.addPage();
            y = margin;
          }
          doc.text(line, margin, y);
          y += lineHeight;
        }

        y += 0.16; // paragraph gap
      }

      doc.save(filename);
      return true;
    } catch (err) {
      console.warn('Vector PDF generation error:', err);
      return false;
    }
  }

  /**
   * Master Entry: Download Cover Letter PDF
   */
  async function downloadPDF(coverLetterText) {
    if (!coverLetterText || !coverLetterText.trim()) {
      throw new Error('No cover letter text to export.');
    }

    await loadLibrary();

    const date = new Date();
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const filename = `Cover_Letter_${dateStr}.pdf`;

    // 1. Try html2pdf layout-rendered PDF
    if (window.html2pdf) {
      const container = document.createElement('div');
      container.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 750px;
        z-index: -99999;
        opacity: 0.01;
        pointer-events: none;
        background: #ffffff;
        font-family: 'Georgia', 'Times New Roman', serif;
        font-size: 12pt;
        line-height: 1.65;
        color: #1a1a1a;
        padding: 40px;
        box-sizing: border-box;
      `;

      const paragraphs = coverLetterText.split(/\n\n+/);
      container.innerHTML = paragraphs
        .map(p => {
          const trimmed = p.trim();
          if (!trimmed) return '';

          const formattedText = trimmed.replace(/\n/g, '<br>');

          if (trimmed.startsWith('Dear ') || trimmed.startsWith('To ')) {
            return `<p style="margin: 0 0 16pt 0; font-size: 12pt;">${formattedText}</p>`;
          }
          if (trimmed.startsWith('Sincerely') || trimmed.startsWith('Best regards') ||
              trimmed.startsWith('Warm regards') || trimmed.startsWith('Regards') ||
              trimmed.startsWith('Thank you') || trimmed.startsWith('Yours')) {
            return `<p style="margin: 20pt 0 4pt 0; font-size: 12pt;">${formattedText}</p>`;
          }

          return `<p style="margin: 0 0 12pt 0; font-size: 12pt; text-align: justify; line-height: 1.65;">${formattedText}</p>`;
        })
        .join('');

      document.body.appendChild(container);

      const options = {
        margin: [0.75, 0.75, 0.75, 0.75],
        filename: filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
          windowWidth: 800,
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
        console.warn('html2pdf failed, falling back to direct vector PDF...', err);
      } finally {
        if (container.parentNode) {
          container.parentNode.removeChild(container);
        }
      }
    }

    // 2. Fallback to vector jsPDF text document
    const vectorSuccess = generateVectorPDF(coverLetterText, filename);
    if (vectorSuccess) return true;

    // 3. Fallback to native print
    console.warn('Opening native print dialog as ultimate fallback');
    window.print();
    return true;
  }

  return { downloadPDF, loadLibrary };
})();
