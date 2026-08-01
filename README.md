# CoverCraft AI — AI Cover Letter Generator ✉️✨

CoverCraft AI is a modern, single-page web application designed to generate customized, **ATS-optimized cover letters** powered by the **Google Gemini API** (free tier).

---

## 🌟 Key Features

- 📁 **Multi-Format Resume Upload**: Upload or drag-and-drop resumes in **PDF (`.pdf`)**, **Word (`.docx`)**, **Images (`.png`, `.jpg`, `.jpeg`, `.webp`)**, and **Text (`.txt`, `.md`)** formats.
- 👁️ **AI Multimodal Vision OCR**: Automatically transcribes and analyzes text from resume image files.
- 🤖 **AI-Powered Generation**: Generates tailored cover letters using Google Gemini 2.5 Flash.
- ⚡ **Real-Time Streaming**: Streamed response output with an interactive typing animation.
- 🎯 **ATS Keyword Matching**: Real-time extraction of hard/soft skills with visual match badges and match score percentage.
- 🎭 **Tone Presets**: Adjust the tone of your cover letter (Professional, Confident, Friendly, Creative).
- 📌 **Personalization Accordion**: Optional fields to highlight why you want the role, specific company details, or key achievements.
- ✏️ **Edit In Place**: Click to edit your generated cover letter directly in the document canvas.
- 📊 **Live Word Count**: Visual word count indicator with ideal length color coding (200–350 words).
- 📋 **Copy to Clipboard**: One-click copy functionality with instant toast confirmation.
- 📄 **PDF Export**: Download formatted, print-ready PDF cover letters.
- 🌙 **Dark/Light Mode**: Sleek dark mode by default with light mode toggle and theme persistence.
- 🔒 **100% Client-Side Privacy**: Runs completely in the browser. API keys and resume data stay on your device.

---

## 🛠️ Technology Stack

- **Frontend**: HTML5, Vanilla CSS3 (Custom properties, Glassmorphism design system), ES6+ Vanilla JavaScript
- **AI Integration**: Google Gemini 2.5 Flash REST API (via Server-Sent Events / SSE)
- **PDF Generation**: `html2pdf.js`
- **Typography**: Google Fonts (Inter & Outfit)

---

## 🚀 Quick Start

1. **Clone the repository**:
   ```bash
   git clone https://github.com/abhishekgarg1400-hub/AI-Cover-Letter-Generator.git
   cd AI-Cover-Letter-Generator
   ```

2. **Open the Application**:
   Simply open `index.html` in any web browser, or serve it using a simple HTTP server:
   ```bash
   # Using Python
   python -m http.server 8080

   # Or using Node.js / npx
   npx http-server -p 8080
   ```

3. **Set Up Gemini API Key**:
   - Get a free API key from [Google AI Studio](https://aistudio.google.com/apikey).
   - Enter your key when prompted in the app (or via the Settings icon ⚙️).
   - Your key is saved locally in your browser (`localStorage`).

---

## 📝 License

Distributed under the MIT License. See `LICENSE` for more information.
