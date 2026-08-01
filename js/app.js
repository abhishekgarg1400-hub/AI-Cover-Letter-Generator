/**
 * app.js — Main application logic for the AI Cover Letter Generator
 * Handles DOM management, events, theme, API key modal, generation flow, etc.
 */

document.addEventListener('DOMContentLoaded', () => {
  // ========================================================================
  // DOM REFERENCES
  // ========================================================================
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // Inputs
  const resumeInput = $('#resume-input');
  const jobDescInput = $('#job-desc-input');
  const noteWhyRole = $('#note-why-role');
  const noteRelevantExp = $('#note-relevant-exp');
  const noteCompanyDetail = $('#note-company-detail');
  const generateBtn = $('#generate-btn');

  // Output
  const outputEmpty = $('#output-empty');
  const skeletonContainer = $('#skeleton-container');
  const letterOutput = $('#letter-output');
  const letterDocument = $('#letter-document');
  const wordCountEl = $('#word-count');
  const keywordsSection = $('#keywords-section');
  const keywordsGrid = $('#keywords-grid');
  const keywordsScore = $('#keywords-score');
  const errorMessage = $('#error-message');
  const errorText = $('#error-text');

  // Actions
  const copyBtn = $('#copy-btn');
  const downloadBtn = $('#download-btn');
  const regenerateBtn = $('#regenerate-btn');

  // Modal
  const modalOverlay = $('#api-key-modal');
  const apiKeyInput = $('#api-key-input');
  const saveKeyBtn = $('#save-key-btn');
  const clearKeyBtn = $('#clear-key-btn');
  const apiKeyStatus = $('#api-key-status');
  const modalCloseBtn = $('#modal-close');
  const toggleVisBtn = $('#toggle-visibility');

  // Header
  const themeToggle = $('#theme-toggle');
  const settingsBtn = $('#settings-btn');

  // Accordion
  const accordionTrigger = $('#accordion-trigger');
  const accordionContent = $('#accordion-content');

  // Toast
  const toastContainer = $('#toast-container');

  // State
  let currentAbortController = null;
  let isGenerating = false;

  // ========================================================================
  // INITIALIZATION
  // ========================================================================

  initTheme();
  checkApiKey();

  // ========================================================================
  // THEME TOGGLE
  // ========================================================================

  function initTheme() {
    const saved = localStorage.getItem('theme');
    if (saved) {
      document.documentElement.setAttribute('data-theme', saved);
    } else {
      // Detect system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    }
    updateThemeIcon();
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    updateThemeIcon();
  }

  function updateThemeIcon() {
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    themeToggle.textContent = isDark ? '☀️' : '🌙';
    themeToggle.title = isDark ? 'Switch to light mode' : 'Switch to dark mode';
  }

  themeToggle.addEventListener('click', toggleTheme);

  // ========================================================================
  // API KEY MODAL
  // ========================================================================

  function checkApiKey() {
    if (!GeminiAPI.hasApiKey()) {
      showModal();
    }
    updateApiKeyStatus();
  }

  function showModal() {
    modalOverlay.classList.add('active');
    apiKeyInput.value = GeminiAPI.getApiKey();
    document.body.style.overflow = 'hidden';
    updateApiKeyStatus();
    setTimeout(() => apiKeyInput.focus(), 300);
  }

  function hideModal() {
    modalOverlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  function updateApiKeyStatus() {
    if (GeminiAPI.hasApiKey()) {
      apiKeyStatus.textContent = '✓ API key saved securely in your browser';
      apiKeyStatus.className = 'api-key-status saved';
      clearKeyBtn.style.display = 'inline-flex';
    } else {
      apiKeyStatus.textContent = '⚠ No API key set';
      apiKeyStatus.className = 'api-key-status empty';
      clearKeyBtn.style.display = 'none';
    }
  }

  settingsBtn.addEventListener('click', showModal);
  modalCloseBtn.addEventListener('click', hideModal);

  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) hideModal();
  });

  saveKeyBtn.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    if (!key) {
      showToast('Please enter an API key', 'error');
      return;
    }
    GeminiAPI.setApiKey(key);
    updateApiKeyStatus();
    showToast('API key saved successfully', 'success');
    setTimeout(hideModal, 800);
  });

  clearKeyBtn.addEventListener('click', () => {
    GeminiAPI.clearApiKey();
    apiKeyInput.value = '';
    updateApiKeyStatus();
    showToast('API key removed', 'success');
  });

  // Toggle password visibility
  toggleVisBtn.addEventListener('click', () => {
    const isPassword = apiKeyInput.type === 'password';
    apiKeyInput.type = isPassword ? 'text' : 'password';
    toggleVisBtn.textContent = isPassword ? '🙈' : '👁️';
  });

  // Close modal on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalOverlay.classList.contains('active')) {
      hideModal();
    }
  });

  // ========================================================================
  // ACCORDION — Optional Notes
  // ========================================================================

  accordionTrigger.addEventListener('click', () => {
    const isOpen = accordionTrigger.getAttribute('aria-expanded') === 'true';
    accordionTrigger.setAttribute('aria-expanded', !isOpen);
    accordionContent.classList.toggle('open');
  });

  // ========================================================================
  // FILE UPLOAD & DRAG-AND-DROP — Multi-Format Support (.pdf, .docx, images, .txt)
  // ========================================================================

  const uploadFileBtn = $('#upload-file-btn');
  const resumeFileInput = $('#resume-file-input');

  if (uploadFileBtn && resumeFileInput) {
    uploadFileBtn.addEventListener('click', () => {
      resumeFileInput.click();
    });

    resumeFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) handleProcessResumeFile(file);
      // Reset input so same file can be re-uploaded if needed
      resumeFileInput.value = '';
    });
  }

  ['dragenter', 'dragover'].forEach(evt => {
    resumeInput.addEventListener(evt, (e) => {
      e.preventDefault();
      resumeInput.classList.add('drag-over');
    });
  });

  ['dragleave', 'drop'].forEach(evt => {
    resumeInput.addEventListener(evt, () => {
      resumeInput.classList.remove('drag-over');
    });
  });

  resumeInput.addEventListener('drop', (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleProcessResumeFile(file);
  });

  async function handleProcessResumeFile(file) {
    showToast(`Parsing ${file.name}...`, 'info');
    try {
      const text = await FileParser.parseFile(file);
      resumeInput.value = text;
      showToast(`Successfully extracted text from ${file.name}`, 'success');
      resumeInput.scrollTop = 0;
    } catch (err) {
      console.error('File parsing error:', err);
      showToast(err.message || `Failed to process ${file.name}`, 'error');
    }
  }

  // ========================================================================
  // GENERATE COVER LETTER
  // ========================================================================

  generateBtn.addEventListener('click', handleGenerate);

  async function handleGenerate() {
    // Validate
    if (!GeminiAPI.hasApiKey()) {
      showModal();
      return;
    }

    const resume = resumeInput.value.trim();
    const jobDesc = jobDescInput.value.trim();

    if (!resume) {
      showToast('Please paste your resume', 'error');
      resumeInput.focus();
      return;
    }

    if (!jobDesc) {
      showToast('Please paste the job description', 'error');
      jobDescInput.focus();
      return;
    }

    // Get selected tone
    const toneRadio = document.querySelector('input[name="tone"]:checked');
    const tone = toneRadio ? toneRadio.value : 'professional';

    // Get optional notes
    const notes = {
      whyRole: noteWhyRole?.value.trim() || '',
      relevantExp: noteRelevantExp?.value.trim() || '',
      companyDetail: noteCompanyDetail?.value.trim() || ''
    };

    // Start loading state
    setLoadingState(true);
    hideError();

    // Cancel any previous generation
    if (currentAbortController) {
      currentAbortController.abort();
    }
    currentAbortController = new AbortController();

    try {
      // Start keyword extraction in parallel
      const keywordsPromise = GeminiAPI.extractKeywords(jobDesc);

      // Generate the cover letter with streaming
      letterDocument.textContent = '';
      letterDocument.classList.add('typing-cursor');

      const fullText = await GeminiAPI.generateCoverLetter(
        { resume, jobDescription: jobDesc, notes, tone },
        (chunk) => {
          // Streaming callback — append each chunk
          letterDocument.textContent += chunk;
          updateWordCount(letterDocument.textContent);
          // Auto-scroll to bottom
          letterDocument.scrollTop = letterDocument.scrollHeight;
        },
        currentAbortController.signal
      );

      letterDocument.classList.remove('typing-cursor');
      letterDocument.textContent = fullText;
      updateWordCount(fullText);

      // Show output
      setOutputState('letter');

      // Process keywords
      const keywords = await keywordsPromise;
      if (keywords && keywords.length > 0) {
        const matched = GeminiAPI.matchKeywords(keywords, fullText);
        renderKeywords(matched);
      }

      showToast('Cover letter generated!', 'success');

    } catch (err) {
      letterDocument.classList.remove('typing-cursor');

      if (err.code === 'CANCELLED') return;

      showError(err.message);
      setOutputState('empty');
      console.error('Generation error:', err);

    } finally {
      setLoadingState(false);
      currentAbortController = null;
    }
  }

  // ========================================================================
  // UI STATE MANAGEMENT
  // ========================================================================

  function setLoadingState(loading) {
    isGenerating = loading;
    generateBtn.disabled = loading;
    generateBtn.classList.toggle('loading', loading);

    if (loading) {
      setOutputState('skeleton');
    }
  }

  function setOutputState(state) {
    // state: 'empty' | 'skeleton' | 'letter'
    outputEmpty.style.display = state === 'empty' ? 'block' : 'none';
    skeletonContainer.classList.toggle('active', state === 'skeleton');
    letterOutput.classList.toggle('active', state === 'letter');
  }

  function showError(message) {
    errorText.textContent = message;
    errorMessage.classList.add('active');
  }

  function hideError() {
    errorMessage.classList.remove('active');
  }

  // ========================================================================
  // WORD COUNT
  // ========================================================================

  function updateWordCount(text) {
    const words = text.trim().split(/\s+/).filter(w => w.length > 0).length;
    wordCountEl.textContent = `${words} word${words !== 1 ? 's' : ''}`;

    wordCountEl.classList.remove('warning', 'good');
    if (words > 400) {
      wordCountEl.classList.add('warning');
    } else if (words >= 200 && words <= 350) {
      wordCountEl.classList.add('good');
    }
  }

  // Track edits in the contenteditable output
  letterDocument.addEventListener('input', () => {
    updateWordCount(letterDocument.textContent);
  });

  // ========================================================================
  // ATS KEYWORD BADGES
  // ========================================================================

  function renderKeywords(matchedKeywords) {
    keywordsGrid.innerHTML = '';
    const matchedCount = matchedKeywords.filter(k => k.matched).length;
    const total = matchedKeywords.length;
    const percentage = Math.round((matchedCount / total) * 100);

    // Score badge
    keywordsScore.textContent = `${matchedCount}/${total} matched`;
    keywordsScore.classList.remove('high', 'medium', 'low');
    if (percentage >= 70) keywordsScore.classList.add('high');
    else if (percentage >= 40) keywordsScore.classList.add('medium');
    else keywordsScore.classList.add('low');

    // Render badges (matched first)
    const sorted = [...matchedKeywords].sort((a, b) => b.matched - a.matched);
    sorted.forEach(({ keyword, matched }) => {
      const badge = document.createElement('span');
      badge.className = `keyword-badge ${matched ? 'matched' : 'unmatched'}`;
      badge.innerHTML = `<span class="badge-icon">${matched ? '✓' : '○'}</span> ${escapeHtml(keyword)}`;
      keywordsGrid.appendChild(badge);
    });

    keywordsSection.style.display = 'block';
  }

  // ========================================================================
  // ACTION BUTTONS
  // ========================================================================

  // Copy to clipboard
  copyBtn.addEventListener('click', async () => {
    const text = letterDocument.textContent;
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      showToast('Copied to clipboard!', 'success');
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      showToast('Copied to clipboard!', 'success');
    }
  });

  // Download PDF
  downloadBtn.addEventListener('click', async () => {
    const text = letterDocument.textContent;
    if (!text) return;

    downloadBtn.disabled = true;
    downloadBtn.innerHTML = '<span class="icon">⏳</span> Generating...';

    try {
      await PDFExport.downloadPDF(text);
      showToast('PDF downloaded!', 'success');
    } catch (err) {
      showToast(err.message || 'PDF generation failed', 'error');
    } finally {
      downloadBtn.disabled = false;
      downloadBtn.innerHTML = '<span class="icon">📄</span> Download PDF';
    }
  });

  // Regenerate
  regenerateBtn.addEventListener('click', () => {
    if (!isGenerating) handleGenerate();
  });

  // ========================================================================
  // TOAST NOTIFICATIONS
  // ========================================================================

  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    let icon = '✓';
    if (type === 'error') icon = '✕';
    if (type === 'info') icon = '⏳';
    toast.innerHTML = `
      <span class="toast-icon">${icon}</span>
      <span>${escapeHtml(message)}</span>
    `;
    toastContainer.appendChild(toast);

    // Remove after animation
    setTimeout(() => {
      if (toast.parentNode) toast.remove();
    }, 3200);
  }

  // ========================================================================
  // UTILITIES
  // ========================================================================

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ========================================================================
  // KEYBOARD SHORTCUTS
  // ========================================================================

  document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + Enter to generate
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (!isGenerating) handleGenerate();
    }
  });
});
