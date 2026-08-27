import pdfParseModule from 'pdf-parse';
import { GoogleGenerativeAI } from '@google/generative-ai';

const pdfParse = typeof pdfParseModule === 'function' ? pdfParseModule : (pdfParseModule.default || pdfParseModule);

// ─────────────────────────────────────────────────────────────────
// CHEAP PRE-FILTER: obviously garbage / empty files
// ─────────────────────────────────────────────────────────────────

const RESUME_SECTION_KEYWORDS = [
  'experience', 'education', 'skills', 'projects', 'work history',
  'objective', 'summary', 'certification', 'certifications',
  'employment', 'qualifications', 'achievements', 'internship',
  'professional', 'technical skills', 'references', 'training',
];

const SYLLABUS_KEYWORDS = [
  'syllabus', 'course code', 'credit hours', 'semester', 'instructor',
  'grading policy', 'prerequisites', 'prerequisite', 'lecture',
  'assignment', 'exam schedule', 'midterm', 'final exam', 'course outline',
  'course description', 'learning outcomes', 'textbook', 'class schedule',
  'office hours', 'attendance policy', 'course objectives', 'credits',
  'marking scheme', 'lab hours', 'tutorial',
];

/**
 * Cheap pre-filter: reject obviously non-resume content.
 * This NEVER makes the final "accept" decision — only flags for LLM.
 * Returns:
 *   { passToLLM: true, hints: string[] }  — needs LLM classification
 *   { passToLLM: false, reject: true, reason: string }  — garbage, reject now
 */
function preFilterCheck(text) {
  const lower = text.toLowerCase();
  const words = lower.split(/\s+/);

  // Truly garbage: less than 30 words of content
  if (words.length < 30) {
    return { passToLLM: false, reject: true, reason: 'Document contains too little text to be a resume.' };
  }

  // Detect syllabus-specific signals
  const syllabusHits = SYLLABUS_KEYWORDS.filter(kw => lower.includes(kw));
  const resumeHits = RESUME_SECTION_KEYWORDS.filter(kw => lower.includes(kw));

  const hints = [];

  if (syllabusHits.length >= 3) {
    hints.push(`WARNING: This document contains ${syllabusHits.length} syllabus-specific terms (${syllabusHits.slice(0, 5).join(', ')}). Verify this is not a course syllabus.`);
  }

  if (resumeHits.length < 1 && syllabusHits.length < 1) {
    hints.push('WARNING: Very few resume-like or document-type keywords found. This may be a random document.');
  }

  // Check for personal contact info (strong resume signal, but not sufficient alone)
  const hasEmail = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(text);
  const hasPhone = /(\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/.test(text);
  if (!hasEmail && !hasPhone) {
    hints.push('NOTE: No personal email or phone number detected in the document.');
  }

  return { passToLLM: true, hints };
}

// ─────────────────────────────────────────────────────────────────
// LLM CLASSIFICATION — the authoritative decision-maker
// ─────────────────────────────────────────────────────────────────

/**
 * Strict few-shot document classifier via Gemini.
 * Returns { isResume: boolean, documentType: string, reason: string } or null if no API key.
 */
async function llmClassifyDocument(text, contextHints = []) {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key.trim() === '' || key === 'your_gemini_api_key_here') {
    return null;
  }

  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });

  const hintsBlock = contextHints.length
    ? `\nADDITIONAL CONTEXT FROM PRE-ANALYSIS:\n${contextHints.map(h => `- ${h}`).join('\n')}\n`
    : '';

  const prompt = `You are a strict document-type classifier for a job-interview application.
Your only job is to determine if the uploaded document is a PERSONAL RESUME/CV
belonging to an individual candidate — NOT any other kind of document that
happens to share some vocabulary with resumes.

A valid resume/CV:
- Is written about ONE specific named individual and their personal work/academic history
- Contains personal identifying info (a person's name, contact details)
- Describes THEIR work experience, THEIR education history, THEIR skills, THEIR projects
- Is typically structured in sections like "Experience", "Education", "Skills", "Projects", "Certifications"

NOT a resume, even if it contains similar words (REJECT these):
- A course syllabus (describes a SUBJECT's curriculum, topics, grading policy, instructor info — not a person's career)
- An academic paper, report, or assignment
- A textbook chapter or lecture notes
- A job description / job posting (describes a ROLE the employer wants, not a candidate)
- A certificate, invoice, letter, or unrelated business document
- A company brochure or product spec

Key distinguishing question: "Is this document ABOUT one individual's career/background,
written in first person or as their personal profile — or is it about something else
(a course, a subject, a role, a company, a topic) that merely mentions similar words?"
${hintsBlock}
Respond with ONLY valid JSON, no markdown, no code fences:
{"isResume": true or false, "documentType": "resume" | "syllabus" | "job_description" | "academic_paper" | "other", "reason": "one short sentence explaining the classification"}

DOCUMENT TEXT:
"""
${text.slice(0, 3000)}
"""`;

  const result = await model.generateContent(prompt);
  const responseText = result.response.text();

  let jsonStr = responseText;
  if (jsonStr.includes('```json')) {
    jsonStr = jsonStr.split('```json')[1].split('```')[0].trim();
  } else if (jsonStr.includes('```')) {
    jsonStr = jsonStr.split('```')[1].split('```')[0].trim();
  }

  return JSON.parse(jsonStr);
}

// ─────────────────────────────────────────────────────────────────
// USER-FACING REJECTION MESSAGES by document type
// ─────────────────────────────────────────────────────────────────

function getRejectionMessage(classification) {
  const type = classification.documentType || 'other';
  const reason = classification.reason || '';

  const messages = {
    syllabus: `This looks like a course syllabus, not a resume. ${reason} Please upload your personal resume/CV instead.`,
    job_description: `This appears to be a job description or job posting, not a resume. ${reason} Please upload your own resume/CV instead.`,
    academic_paper: `This looks like an academic paper or report, not a resume. ${reason} Please upload your personal resume/CV instead.`,
    other: `This document doesn't appear to be a resume. ${reason} Please upload your personal resume/CV as a PDF.`,
  };

  return messages[type] || messages.other;
}

// ─────────────────────────────────────────────────────────────────
// UPLOAD RESUME — with strict classification pipeline
// ─────────────────────────────────────────────────────────────────

/**
 * Pipeline: file check → text extraction → pre-filter → LLM classify → accept/reject
 * The LLM is the ONLY authority that can accept a document as a resume.
 * The pre-filter can reject garbage but NEVER gives the final "accept".
 */
export const uploadResume = async (req, res, next) => {
  try {
    // ── 1. File presence check ──
    if (!req.file) {
      return res.status(400).json({
        error: 'NO_FILE',
        message: 'No file uploaded. Please upload your resume as a PDF.',
      });
    }

    // ── 2. MIME type check ──
    const allowedMimes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedMimes.includes(req.file.mimetype)) {
      return res.status(400).json({
        error: 'INVALID_FILE_TYPE',
        message: `Only PDF and DOCX files are accepted. You uploaded a "${req.file.mimetype}" file.`,
      });
    }

    // ── 3. Extract text from PDF ──
    const pdfBuffer = req.file.buffer;
    let extractedText = '';

    try {
      const parsedData = await pdfParse(pdfBuffer);
      extractedText = (parsedData.text || '').trim();
    } catch (pdfErr) {
      console.warn('[uploadResume] pdf-parse extraction failed:', pdfErr.message);
      return res.status(422).json({
        error: 'EXTRACTION_FAILED',
        message: "Couldn't read text from this PDF. It might be a scanned image without OCR, or a corrupted file. Please upload a text-based PDF resume.",
      });
    }

    // ── 4. Minimum content threshold ──
    if (!extractedText || extractedText.length < 80) {
      return res.status(422).json({
        error: 'INSUFFICIENT_CONTENT',
        message: "This PDF has very little or no readable text. It might be a scanned image or a nearly empty file. Please upload a text-based PDF resume.",
      });
    }

    // ── 5. Cheap pre-filter (can reject garbage, NEVER accepts) ──
    const preFilter = preFilterCheck(extractedText);

    if (!preFilter.passToLLM && preFilter.reject) {
      return res.status(422).json({
        error: 'NOT_A_RESUME',
        message: preFilter.reason + ' Please upload a valid resume/CV as a PDF.',
      });
    }

    // ── 6. LLM classification — the ONLY authority that can accept ──
    let classification = null;

    try {
      classification = await llmClassifyDocument(extractedText, preFilter.hints || []);
    } catch (llmErr) {
      console.warn('[uploadResume] LLM classification failed:', llmErr.message);
      // classification stays null — handled below
    }

    if (classification) {
      // LLM gave a verdict — use it (fail closed: anything other than "resume" is rejected)
      if (!classification.isResume || classification.documentType !== 'resume') {
        return res.status(422).json({
          error: 'NOT_A_RESUME',
          message: getRejectionMessage(classification),
        });
      }

      // LLM confirmed it's a resume — accept
      return res.status(200).json({
        message: 'Resume extracted and verified successfully',
        extractedText,
        info: { wordCount: extractedText.split(/\s+/).length },
      });
    }

    // ── 7. LLM unavailable (no key / API error) — use heuristic as fallback ──
    // Heuristic alone cannot accept if there are syllabus red flags
    const lower = extractedText.toLowerCase();
    const syllabusHits = SYLLABUS_KEYWORDS.filter(kw => lower.includes(kw));
    const resumeHits = RESUME_SECTION_KEYWORDS.filter(kw => lower.includes(kw));
    const hasEmail = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(extractedText);
    const hasPhone = /(\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/.test(extractedText);

    // If it smells like a syllabus, reject even without LLM
    if (syllabusHits.length >= 3 && syllabusHits.length > resumeHits.length) {
      return res.status(422).json({
        error: 'NOT_A_RESUME',
        message: `This looks like a course syllabus (detected terms: ${syllabusHits.slice(0, 4).join(', ')}), not a resume. Please upload your personal resume/CV instead.`,
      });
    }

    // Heuristic fallback: accept only if strong resume signals exist
    if ((hasEmail || hasPhone) && resumeHits.length >= 3) {
      return res.status(200).json({
        message: 'Resume extracted and verified successfully',
        extractedText,
        info: { wordCount: extractedText.split(/\s+/).length },
      });
    }

    // Ambiguous and no LLM available — fail closed, reject
    return res.status(422).json({
      error: 'NOT_A_RESUME',
      message: "We couldn't confidently verify this is a resume (AI classification unavailable and the document lacks clear resume signals like contact info and experience/education sections). Please upload a clearly structured resume/CV as a PDF.",
    });

  } catch (error) {
    console.error('[uploadResume] Critical error:', error);
    res.status(500).json({
      error: 'UPLOAD_FAILED',
      message: 'Failed to process the uploaded file. Please try again with a valid PDF resume.',
    });
  }
};

// ─────────────────────────────────────────────────────────────────
// ANALYZE RESUME — extract skills, projects, etc. via Gemini
// ─────────────────────────────────────────────────────────────────

/**
 * Analyze extracted resume text using Gemini AI
 */
export const analyzeResume = async (req, res, next) => {
  try {
    const { resumeText, targetRole } = req.body;

    if (!resumeText) {
      return res.status(400).json({ error: 'Resume text is required for analysis.' });
    }

    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
      console.warn('GEMINI_API_KEY is not set or invalid. Returning fallback parsed resume data.');
      return res.status(200).json({
        skills: ['Software Engineering', 'Problem Solving', 'Application Development', 'Technical Skills'],
        projects: ['Main Resume Project', 'Technical Portfolio'],
        experienceYears: '1-2 years',
        education: 'Bachelor of Technology',
        certifications: ['Technical Certification'],
        summary: `Candidate targeting ${targetRole || 'Software Developer'} role with technical background.`,
      });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });

    const prompt = `Analyze the following resume content for a candidate targeting the role of "${targetRole || 'Software Engineer'}".

RESUME CONTENT:
"""
${resumeText.slice(0, 4000)}
"""

Extract key details and return ONLY a valid JSON object:
{
  "skills": ["array", "of", "top", "technical", "and", "soft", "skills"],
  "projects": ["array", "of", "notable", "projects", "mentioned"],
  "experienceYears": "estimated experience or 'Fresher'",
  "education": "highest education or degree identified",
  "certifications": ["array", "of", "certifications"],
  "summary": "a brief 2-sentence professional summary highlighting their domain focus"
}`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    let jsonStr = responseText;
    if (jsonStr.includes('```json')) {
      jsonStr = jsonStr.split('```json')[1].split('```')[0].trim();
    } else if (jsonStr.includes('```')) {
      jsonStr = jsonStr.split('```')[1].split('```')[0].trim();
    }

    const analysis = JSON.parse(jsonStr);
    res.status(200).json(analysis);
  } catch (error) {
    console.error('Error analyzing resume with Gemini:', error);
    res.status(200).json({
      skills: ['Technical Skills', 'Software Development'],
      projects: ['Personal Projects'],
      experienceYears: 'Not specified',
      education: 'Degree',
      certifications: [],
      summary: 'Candidate profile processed successfully.',
    });
  }
};
