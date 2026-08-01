/**
 * gemini.js — Google Gemini API integration for cover letter generation
 * Uses gemini-2.5-flash via the REST API (free tier)
 */

const GeminiAPI = (() => {
  const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
  const MODEL = 'gemini-2.5-flash';

  /**
   * Build the system prompt using the user's refined instructions.
   */
  function buildSystemPrompt() {
    return `You are an expert career coach and professional writer specializing in ATS-optimized cover letters. Your task is to generate a customized, high-impact cover letter based on the user's resume and the target job description.

### INSTRUCTIONS

1. **Analyze Both Documents Carefully**:
   - Extract 5–7 key hard skills, tools, and technologies from the job description.
   - Identify 3–5 soft skills or traits implied (e.g., leadership, problem-solving, adaptability).
   - Note any unusual requirements that hint at team challenges or company priorities.
   - Cross-reference the resume to find matching experiences and quantifiable achievements.

2. **Structure the Cover Letter** Using This Proven Format:
   - **Opening Hook** (1–2 sentences): Grab attention with a specific achievement, passion, or alignment with the company's mission.
   - **Value Proposition** (2–3 short paragraphs): Connect the user's most relevant experience to the job's core requirements. Use quantifiable results where possible (e.g., "improved efficiency by 30%", "reduced costs by ₹2L").
   - **Company Fit** (1 short paragraph): Show genuine interest by referencing a specific product, value, mission statement, or recent news about the company.
   - **Call to Action** (1 sentence): Politely request an interview or next step.

3. **Tone & Style Guidelines**:
   - Professional yet warm and confident—sound like a real person, not a robot.
   - Avoid clichés and generic phrases like "I am a hard worker" or "I am a team player."
   - Match the tone to the industry (e.g., startup = energetic, finance = polished, tech = confident).
   - Keep it concise: 250–350 words maximum.

4. **ATS Optimization Requirements**:
   - Naturally include 5–8 keywords from the job description (skills, tools, certifications, methodologies).
   - Use standard formatting (no tables, columns, or graphics that ATS might misread).
   - Include a clear salutation (e.g., "Dear Hiring Manager," or "Dear [Company Name] Team,").

5. **Safety & Accuracy Rules** (Critical):
   - **Do NOT invent** any experiences, skills, achievements, dates, or qualifications not explicitly stated in the resume.
   - **Do NOT fabricate** company details, product names, or recent news unless provided in the job description or user notes.
   - If the resume lacks information needed for a strong letter, highlight this gap in your internal reasoning but still generate the best possible letter with available data.
   - If conflicting information exists (e.g., resume says 2 years experience, job requires 5), do not lie—focus on transferable skills and enthusiasm to learn.

6. **Output Format**:
   - Return **ONLY** the cover letter text.
   - Properly formatted with:
     - Salutation (e.g., "Dear Hiring Manager,")
     - 3–4 short paragraphs (no bullet points in the final letter)
     - Professional closing (e.g., "Sincerely, [User's Name]")
   - Do NOT include explanations, notes, or meta-commentary.`;
  }

  /**
   * Build the user message from form inputs.
   */
  function buildUserMessage(resume, jobDescription, notes, tone) {
    let message = `### INPUT CONTEXT\n\n- **User's Resume**:\n"""\n${resume}\n"""\n\n- **Job Description**:\n"""\n${jobDescription}\n"""`;

    // Add optional notes if provided
    const hasNotes = notes && (notes.whyRole || notes.relevantExp || notes.companyDetail);
    if (hasNotes || tone) {
      message += `\n\n- **User's Specific Notes**:`;
      if (notes?.whyRole) {
        message += `\n  - Why they want this role/company: "${notes.whyRole}"`;
      }
      if (notes?.relevantExp) {
        message += `\n  - Most relevant experience: "${notes.relevantExp}"`;
      }
      if (notes?.companyDetail) {
        message += `\n  - Specific company detail noticed: "${notes.companyDetail}"`;
      }
      if (tone) {
        message += `\n  - Preferred tone: "${tone}"`;
      }
    }

    message += `\n\nBegin generating the cover letter now.`;
    return message;
  }

  /**
   * Generate a cover letter using the Gemini API with streaming.
   * @param {Object} params - { resume, jobDescription, notes, tone }
   * @param {Function} onChunk - Callback for each text chunk (for streaming effect)
   * @param {AbortSignal} signal - AbortController signal for cancellation
   * @returns {Promise<string>} - The full generated cover letter text
   */
  async function generateCoverLetter({ resume, jobDescription, notes, tone }, onChunk, signal) {
    const apiKey = getApiKey();
    if (!apiKey) {
      throw new GeminiError('API key not found. Please set your Gemini API key.', 'NO_KEY');
    }

    const systemPrompt = buildSystemPrompt();
    const userMessage = buildUserMessage(resume, jobDescription, notes, tone);

    const url = `${API_BASE}/${MODEL}:streamGenerateContent?alt=sse&key=${apiKey}`;

    const body = {
      system_instruction: {
        parts: [{ text: systemPrompt }]
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: userMessage }]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        topP: 0.9,
        maxOutputTokens: 2048
      }
    };

    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal
      });
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new GeminiError('Generation cancelled.', 'CANCELLED');
      }
      throw new GeminiError('Network error. Please check your internet connection.', 'NETWORK');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const status = response.status;

      if (status === 429) {
        throw new GeminiError(
          'Rate limit exceeded. Please wait a moment and try again.',
          'RATE_LIMIT'
        );
      } else if (status === 400) {
        const msg = errorData?.error?.message || 'Invalid request.';
        throw new GeminiError(`Bad request: ${msg}`, 'BAD_REQUEST');
      } else if (status === 403) {
        throw new GeminiError(
          'Invalid API key. Please check your Gemini API key in settings.',
          'INVALID_KEY'
        );
      } else {
        throw new GeminiError(
          `API error (${status}): ${errorData?.error?.message || 'Unknown error'}`,
          'API_ERROR'
        );
      }
    }

    // Stream the response using SSE
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process SSE lines
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep the incomplete line in buffer

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6).trim();
          if (!jsonStr || jsonStr === '[DONE]') continue;

          try {
            const parsed = JSON.parse(jsonStr);
            const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              fullText += text;
              if (onChunk) onChunk(text);
            }
          } catch {
            // Skip malformed JSON chunks
          }
        }
      }
    }

    if (!fullText.trim()) {
      throw new GeminiError('No content was generated. Please try again.', 'EMPTY_RESPONSE');
    }

    return fullText.trim();
  }

  /**
   * Extract ATS keywords from the job description using Gemini.
   * Falls back to regex-based extraction if API call fails.
   */
  async function extractKeywords(jobDescription) {
    const apiKey = getApiKey();
    if (!apiKey) return extractKeywordsFallback(jobDescription);

    const url = `${API_BASE}/${MODEL}:generateContent?key=${apiKey}`;

    const body = {
      contents: [
        {
          role: 'user',
          parts: [{
            text: `Extract the top 8-12 important ATS keywords (hard skills, tools, technologies, certifications, methodologies) from this job description. Return them as a JSON array of strings, nothing else. No markdown formatting, just the raw JSON array.

Job Description:
"""
${jobDescription}
"""`
          }]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 256
      }
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!response.ok) return extractKeywordsFallback(jobDescription);

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

      // Extract JSON array from response
      const match = text.match(/\[[\s\S]*?\]/);
      if (match) {
        const keywords = JSON.parse(match[0]);
        return keywords.filter(k => typeof k === 'string').map(k => k.trim());
      }
    } catch {
      // Fall through to fallback
    }

    return extractKeywordsFallback(jobDescription);
  }

  /**
   * Fallback: extract keywords using common tech/business term patterns.
   */
  function extractKeywordsFallback(text) {
    const commonKeywords = [
      // Programming & Tech
      'JavaScript', 'TypeScript', 'Python', 'Java', 'C\\+\\+', 'C#', 'Ruby', 'Go', 'Rust', 'Swift', 'Kotlin',
      'React', 'Angular', 'Vue', 'Node\\.js', 'Express', 'Django', 'Flask', 'Spring Boot', 'Next\\.js',
      'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'Terraform', 'CI/CD', 'Jenkins', 'Git',
      'SQL', 'NoSQL', 'MongoDB', 'PostgreSQL', 'MySQL', 'Redis', 'GraphQL', 'REST API',
      'Machine Learning', 'Deep Learning', 'NLP', 'Computer Vision', 'TensorFlow', 'PyTorch',
      'Agile', 'Scrum', 'Kanban', 'DevOps', 'Microservices', 'Cloud Computing',
      // Business & Soft
      'Project Management', 'Product Management', 'Data Analysis', 'Data Science',
      'Leadership', 'Communication', 'Problem Solving', 'Teamwork', 'Collaboration',
      'Excel', 'Power BI', 'Tableau', 'Salesforce', 'SAP', 'Jira', 'Confluence',
      'Marketing', 'SEO', 'SEM', 'Content Strategy', 'UX/UI', 'Figma', 'Adobe',
      // Certifications
      'PMP', 'AWS Certified', 'Scrum Master', 'Six Sigma', 'ITIL', 'CPA', 'CFA'
    ];

    const found = [];
    const textLower = text.toLowerCase();

    for (const keyword of commonKeywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      if (regex.test(text)) {
        // Get the original casing from the text
        const match = text.match(regex);
        if (match) found.push(match[0]);
      }
    }

    // Also extract capitalized multi-word terms that look like skills
    const capitalPattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g;
    let m;
    while ((m = capitalPattern.exec(text)) !== null) {
      if (!found.includes(m[1]) && found.length < 12) {
        found.push(m[1]);
      }
    }

    return [...new Set(found)].slice(0, 12);
  }

  /**
   * Check which keywords from the JD appear in the generated cover letter.
   */
  function matchKeywords(keywords, coverLetterText) {
    const letterLower = coverLetterText.toLowerCase();
    return keywords.map(keyword => ({
      keyword,
      matched: letterLower.includes(keyword.toLowerCase())
    }));
  }

  // --- API Key Management ---

  function getApiKey() {
    return localStorage.getItem('gemini_api_key') || '';
  }

  function setApiKey(key) {
    localStorage.setItem('gemini_api_key', key.trim());
  }

  function hasApiKey() {
    return !!getApiKey();
  }

  function clearApiKey() {
    localStorage.removeItem('gemini_api_key');
  }

  // --- Custom Error Class ---

  class GeminiError extends Error {
    constructor(message, code) {
      super(message);
      this.name = 'GeminiError';
      this.code = code;
    }
  }

  // Public API
  return {
    generateCoverLetter,
    extractKeywords,
    matchKeywords,
    getApiKey,
    setApiKey,
    hasApiKey,
    clearApiKey,
    GeminiError
  };
})();
