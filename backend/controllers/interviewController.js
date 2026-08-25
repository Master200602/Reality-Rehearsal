import { GoogleGenerativeAI } from '@google/generative-ai';

// ─────────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────────

/** Extract JSON from raw model text even if wrapped in code fences */
function extractJSON(text) {
  let s = (text || '').trim();
  if (s.includes('```json')) s = s.split('```json')[1].split('```')[0].trim();
  else if (s.includes('```')) s = s.split('```')[1].split('```')[0].trim();
  const match = s.match(/\{[\s\S]*\}/);
  if (match) return JSON.parse(match[0]);
  return JSON.parse(s);
}

/** Returns the initialised Gemini model or null if key is missing/invalid */
function getGeminiModel() {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key.trim() === '' || key === 'your_gemini_api_key_here') return null;
  const genAI = new GoogleGenerativeAI(key);
  return genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
}

// ─────────────────────────────────────────────────────────────────
// PROBLEM 1 & 2 FIX — SEMANTIC ANSWER VALIDATOR
// ─────────────────────────────────────────────────────────────────

/**
 * Trivial / non-answer words that NEVER constitute a valid answer.
 * No matter the question, these are immediately rejected.
 */
const TRIVIAL_WORDS = new Set([
  'yes', 'no', 'ok', 'okay', 'sure', 'fine', 'maybe', 'alright', 'right',
  'yep', 'yup', 'nope', 'nah', 'hmm', 'uhh', 'umm', 'uh', 'ah', 'oh',
  'idk', 'dunno', 'i dont know', "i don't know", 'not sure', 'i guess',
  'perhaps', 'good', 'great', 'cool', 'nice', 'wow', 'true', 'false',
]);

/**
 * Validates whether a candidate's answer is semantically relevant to the question.
 *
 * Returns:
 *   { valid: true }  — accept and advance
 *   { valid: false, status, reprompt }  — reject and re-ask
 */
function validateAnswer(lastQuestion, answer) {
  const raw = (answer || '').trim();
  const lower = raw.toLowerCase().replace(/[^a-z0-9\s']/g, '');
  const words = raw.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  // 1. Empty response
  if (!raw || wordCount === 0) {
    return {
      valid: false, status: 'INVALID',
      reprompt: "I didn't receive any response. Please answer the question.",
    };
  }

  // 2. Single trivial non-answer word
  if (TRIVIAL_WORDS.has(lower.trim())) {
    return {
      valid: false, status: 'INVALID',
      reprompt: `"${raw}" is not an answer to the question. ${buildReprompt(lastQuestion)}`,
    };
  }

  // 3. All words are trivial (e.g. "yes okay sure")
  const allTrivial = words.every(w => TRIVIAL_WORDS.has(w.toLowerCase()));
  if (allTrivial) {
    return {
      valid: false, status: 'INVALID',
      reprompt: `That response doesn't answer the question. ${buildReprompt(lastQuestion)}`,
    };
  }

  // 4. Too short for any meaningful answer (≤ 3 words)
  if (wordCount <= 3) {
    return {
      valid: false, status: 'INCOMPLETE',
      reprompt: `Your response is too brief to be accepted as an answer. ${buildReprompt(lastQuestion)}`,
    };
  }

  // 5. No real English words — gibberish or random chars
  const hasRealWords = /\b(i|my|me|the|a|an|is|was|have|do|did|can|at|in|on|for|with|and|but|to|it|this|that|we|they|used|built|worked|project|because|since|when|how|what|where|who|am|be|been|are|name|year|work|develop|create|study)\b/i.test(raw);
  if (!hasRealWords && wordCount < 6) {
    return {
      valid: false, status: 'INVALID',
      reprompt: `That doesn't appear to be a meaningful response. ${buildReprompt(lastQuestion)}`,
    };
  }

  // 6. Question-specific semantic checks
  const q = (lastQuestion || '').toLowerCase();

  // Introduction / self-intro question: must contain personal info
  if (/\b(introduce|introduction|about yourself|tell me about|who are you|your background)\b/.test(q)) {
    const hasPersonalInfo = /\b(my name|i am|i'm|i work|i study|i have|i've|i'm a|developer|engineer|student|professional|experience|year|skill)\b/i.test(raw);
    if (!hasPersonalInfo) {
      return {
        valid: false, status: 'INCOMPLETE',
        reprompt: 'That does not contain an introduction. Please tell me your name, your role or background, and a brief summary of your experience.',
      };
    }
  }

  // Name question: must include a name pattern
  if (/\b(your name|what is your name|call you|who am i speaking)\b/.test(q)) {
    const hasName = /\b(my name is|i am|i'm|name's|call me|i go by)\b/i.test(raw) || /\b[A-Z][a-z]+\b/.test(raw);
    if (!hasName) {
      return {
        valid: false, status: 'INCOMPLETE',
        reprompt: "That doesn't provide your name. Please tell me your full name.",
      };
    }
  }

  // Age question: must include a number
  if (/\b(age|how old|years old)\b/.test(q) && !/\b\d{1,3}\b/.test(raw)) {
    return {
      valid: false, status: 'INVALID',
      reprompt: 'That does not answer the question about your age. Please provide your age as a number.',
    };
  }

  // Experience / years question: must include a number or time expression
  if (/\b(years of experience|how many years|how long have you)\b/.test(q)) {
    const hasTimeRef = /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|year|month|fresher|fresh|recent)\b/i.test(raw);
    if (!hasTimeRef) {
      return {
        valid: false, status: 'INCOMPLETE',
        reprompt: `Your answer doesn't mention your experience duration. ${buildReprompt(lastQuestion)}`,
      };
    }
  }

  return { valid: true, status: 'VALID', reprompt: null };
}

/** Builds a focused re-prompt sentence from the last question text */
function buildReprompt(lastQuestion) {
  if (!lastQuestion) return 'Please answer the question properly.';
  const shortened = lastQuestion.length > 140
    ? lastQuestion.slice(0, 140) + '...'
    : lastQuestion;
  return `To continue, please answer: "${shortened}"`;
}

// ─────────────────────────────────────────────────────────────────
// PROBLEM 3 FIX — API KEY VERIFICATION ENDPOINT HELPER
// ─────────────────────────────────────────────────────────────────

/**
 * Call this route GET /api/interview/verify-key to test if the key works.
 * Safe to expose to your team — does NOT log the actual key.
 */
export const verifyApiKey = async (req, res) => {
  const key = process.env.GEMINI_API_KEY;

  // Check 1: Key is present in .env
  if (!key || key.trim() === '' || key === 'your_gemini_api_key_here') {
    return res.status(200).json({
      status: 'NOT_CONFIGURED',
      working: false,
      message: 'GEMINI_API_KEY is not set in backend/.env. Open backend/.env and replace "your_gemini_api_key_here" with your real key.',
      hint: 'Get a free key at: https://aistudio.google.com/app/apikey',
    });
  }

  if (key.length < 15) {
    return res.status(200).json({
      status: 'INVALID_FORMAT',
      working: false,
      message: 'The key format looks too short to be a valid API key.',
      hint: 'Get a free API key at: https://aistudio.google.com/app/apikey',
    });
  }

  // Check 2: Actually call the API with a minimal test prompt
  try {
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent('Reply with exactly: {"status":"ok"}');
    const text = result.response.text();
    return res.status(200).json({
      status: 'ACTIVE',
      working: true,
      message: 'Gemini API key is valid and working correctly!',
      modelUsed: 'gemini-2.0-flash',
      keyPrefix: key.slice(0, 6) + '...',
    });
  } catch (err) {
    const msg = err.message || '';
    let reason = 'Gemini API Error. The key provided could not be authenticated.';
    if (msg.includes('API_KEY_INVALID') || msg.includes('API key not valid')) {
      reason = 'The key in your .env is invalid or not an AI Studio API key. (Note: Google AI Studio API keys typically start with "AIzaSy..."). Please generate a key at https://aistudio.google.com/app/apikey';
    } else if (msg.includes('quota') || msg.includes('QUOTA') || msg.includes('429')) {
      reason = 'Quota exceeded for this API key. Your free tier rate limit has been reached.';
    } else if (msg.includes('PERMISSION_DENIED')) {
      reason = 'Permission denied. Make sure the Generative Language API is enabled for your project.';
    }
    return res.status(200).json({
      status: 'ERROR',
      working: false,
      message: reason,
      rawError: msg,
    });
  }
};

// ─────────────────────────────────────────────────────────────────
// GENERATE QUESTIONS
// ─────────────────────────────────────────────────────────────────

export const generateQuestions = async (req, res, next) => {
  try {
    const {
      domain = 'Software Engineering',
      difficulty = 'Medium',
      totalQuestions = 5,
      conversationHistory = [],
      userAnswer = '',
      candidateProfile = {},
      resumeText = '',
    } = req.body;

    const candidateName = candidateProfile?.fullName || 'Candidate';
    const targetRole = candidateProfile?.targetRole || domain;
    const skillsList = candidateProfile?.skills?.join(', ') || 'Technical Skills';
    const projectsList = candidateProfile?.projects?.join(', ') || 'Projects listed on resume';

    const interviewerMessages = conversationHistory.filter(m => m.role === 'interviewer');
    const questionNumber = interviewerMessages.length + (userAnswer ? 1 : 0);

    const model = getGeminiModel();

    if (!model) {
      // Fallback mode
      const cleanAnswer = (userAnswer || '').trim().toLowerCase();
      const wordCount = cleanAnswer.split(/\s+/).length;
      const isWeak = wordCount < 5 || TRIVIAL_WORDS.has(cleanAnswer);

      if (questionNumber === 0) {
        return res.status(200).json({
          aiResponse: `Hello ${candidateName}! Welcome to your ${targetRole} interview. Please walk me through one of your key projects from ${projectsList} and explain your specific technical contributions.`,
          questionNumber: 1, isComplete: false, evaluation: null,
        });
      }

      return res.status(200).json({
        aiResponse: isWeak
          ? `That response is too brief. Please elaborate on your ${targetRole} experience with specific technical details.`
          : questionNumber >= totalQuestions
            ? `Thank you ${candidateName}. That concludes the interview. Your report is being generated.`
            : `Good explanation. Building on that — how did you handle performance optimization and error handling in your ${domain} work?`,
        questionNumber: Math.min(questionNumber + (isWeak ? 0 : 1), totalQuestions),
        isComplete: !isWeak && questionNumber >= totalQuestions,
        evaluation: isWeak ? null : { score: 7, feedback: 'Reasonable answer.', strengths: ['Clear'], improvements: ['Add more specifics'] },
      });
    }

    const prompt = `You are a strict senior technical interviewer for ${domain} at ${difficulty} level.
Candidate: ${candidateName} | Role: ${targetRole} | Skills: ${skillsList} | Projects: ${projectsList}
Resume: ${resumeText ? resumeText.slice(0, 2000) : 'Not provided'}
Conversation so far: ${conversationHistory.map(m => `${m.role.toUpperCase()}: ${m.text}`).join('\n') || 'None'}
Candidate latest answer: "${userAnswer || 'None — first turn'}"
Total questions: ${totalQuestions} | Current question index: ${questionNumber + 1}
If the answer is weak or fake, call it out and ask a sharper follow-up.
Return ONLY valid JSON:
{
  "aiResponse": "spoken interviewer response",
  "questionNumber": ${Math.min(questionNumber + (userAnswer ? 1 : 0), totalQuestions)},
  "isComplete": ${questionNumber >= totalQuestions ? 'true' : 'false'},
  "evaluation": ${userAnswer ? '{"score":1-10,"feedback":"...","strengths":["..."],"improvements":["..."]}' : 'null'}
}`;

    const result = await model.generateContent(prompt);
    res.status(200).json(extractJSON(result.response.text()));
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────
// EVALUATE ANSWER
// ─────────────────────────────────────────────────────────────────

export const evaluateAnswer = async (req, res, next) => {
  try {
    const { question, answer, domain } = req.body;
    const model = getGeminiModel();

    if (!model) {
      return res.status(200).json({
        score: 7, feedback: 'Mock evaluation — API key not configured.',
        strengths: ['Attempted answer'], improvements: ['Configure Gemini API key for real evaluation'],
      });
    }

    const result = await model.generateContent(
      `Evaluate this interview answer strictly.
Domain: ${domain}
Question: "${question}"
Answer: "${answer}"
Return ONLY valid JSON: {"score":1-10,"feedback":"...","strengths":["..."],"improvements":["..."]}`
    );
    res.status(200).json(extractJSON(result.response.text()));
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────
// GENERATE REPORT
// ─────────────────────────────────────────────────────────────────

export const generateReport = async (req, res, next) => {
  try {
    const { domain = 'General', difficulty = 'Medium', responses = [], candidateProfile = {} } = req.body;
    const candidateName = candidateProfile?.fullName || 'Candidate';
    const targetRole = candidateProfile?.targetRole || domain;

    const scores = responses.filter(r => typeof r.score === 'number').map(r => r.score);
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 7.5;
    const overall = Math.min(100, Math.max(15, Math.round(avg * 10)));

    const model = getGeminiModel();

    if (!model) {
      return res.status(200).json({
        candidateName, targetRole, overallScore: overall,
        summary: `${candidateName} completed the ${targetRole} interview with an average score of ${overall}/100.`,
        categoryScores: {
          technical: Math.round(overall * 0.95), communication: Math.round(overall * 1.05),
          confidence: Math.round(overall * 0.98), clarity: Math.round(overall * 1.02),
        },
        strengths: ['Completed interview', 'Provided domain knowledge'],
        improvements: ['Add more technical depth', 'Use specific examples'],
        recommendations: [`Study core ${domain} concepts`, 'Practice mock interviews'],
      });
    }

    const result = await model.generateContent(
      `Generate a strict, honest interview performance report.
Candidate: ${candidateName} | Role: ${targetRole} | Domain: ${domain} | Difficulty: ${difficulty}
Computed overall score: ${overall}/100
Responses: ${JSON.stringify(responses.map(r => ({ q: r.question?.slice(0, 80), score: r.score, feedback: r.feedback })), null, 2)}
Return ONLY valid JSON:
{
  "candidateName":"${candidateName}","targetRole":"${targetRole}","overallScore":${overall},
  "summary":"2-3 sentence honest assessment",
  "categoryScores":{"technical":1-100,"communication":1-100,"confidence":1-100,"clarity":1-100},
  "strengths":["3 genuine strengths"],
  "improvements":["3 specific improvements"],
  "recommendations":["3 actionable study tips"]
}`
    );
    res.status(200).json(extractJSON(result.response.text()));
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────
// CORE: CONDUCT CONVERSATION — with full answer validation
// ─────────────────────────────────────────────────────────────────

/**
 * Handles one conversation turn.
 *
 * Response always includes:
 *   validationStatus : 'FIRST_TURN' | 'VALID' | 'INVALID' | 'INCOMPLETE' | 'AMBIGUOUS'
 *   shouldAdvance    : boolean — false means re-ask same question, do NOT save answer
 *   aiResponse       : spoken text (re-prompt OR next question)
 *   questionNumber   : unchanged if shouldAdvance=false
 *   isComplete       : boolean
 *   evaluation       : object | null
 */
export const conductConversation = async (req, res, next) => {
  try {
    const { domain, difficulty, totalQuestions, conversationHistory, userAnswer } = req.body;

    const isFirstTurn = !conversationHistory?.length && !userAnswer;

    // Find last question the interviewer asked (for validation context)
    const lastInterviewerMsg = conversationHistory
      ? [...conversationHistory].reverse().find(m => m.role === 'interviewer')
      : null;
    const lastQuestion = lastInterviewerMsg?.text || '';

    const questionsAsked = conversationHistory
      ? conversationHistory.filter((m, i) => m.role === 'interviewer' && i > 0).length
      : 0;

    // ── STEP 1: Fast deterministic pre-validation (no API call needed) ──
    if (!isFirstTurn && userAnswer) {
      const preValidation = validateAnswer(lastQuestion, userAnswer);
      if (!preValidation.valid) {
        return res.status(200).json({
          validationStatus: preValidation.status,
          shouldAdvance: false,
          aiResponse: preValidation.reprompt,
          questionNumber: questionsAsked,
          isComplete: false,
          evaluation: null,
        });
      }
    }

    // ── STEP 2: Mock fallback when no API key configured ──
    const model = getGeminiModel();
    if (!model) {
      return res.status(200).json(
        getMockTurn(domain, difficulty, totalQuestions, conversationHistory || [], userAnswer)
      );
    }

    // ── STEP 3: Gemini prompt with embedded semantic validation instruction ──
    const historyText = conversationHistory
      ? conversationHistory.map(m => `${m.role === 'interviewer' ? 'Interviewer' : 'Candidate'}: ${m.text}`).join('\n')
      : '(No history)';

    const systemPrompt = `You are a strict Senior Technical Interviewer for ${domain} at ${difficulty} level.
Total questions: ${totalQuestions} | Asked so far: ${questionsAsked}

${!isFirstTurn && userAnswer ? `
=== MANDATORY ANSWER VALIDATION BEFORE RESPONDING ===
Last question you asked:
  "${lastQuestion}"

Candidate's response:
  "${userAnswer}"

Validate whether this response SEMANTICALLY and SUFFICIENTLY answers the question.

REJECT (set shouldAdvance=false) if:
  - Response is a trivial word: "yes", "no", "ok", "sure", "I don't know", "maybe", "fine"
  - Response is completely unrelated to what was asked
  - Response is too vague to contain the requested information
  - For introduction questions: must contain name, role, and some experience context
  - For technical questions: must reference actual technical concepts, not just "I did it"

ACCEPT (set shouldAdvance=true) only if the response genuinely answers what was asked.

If REJECTED:
  - aiResponse: explain exactly what is missing, then re-ask the same question clearly
  - questionNumber: ${questionsAsked}  ← SAME, do not increment
  - shouldAdvance: false
  - evaluation: null

If ACCEPTED:
  - Generate the next sharp follow-up question drilling into specifics of what they said
  - questionNumber: ${questionsAsked + 1}
  - shouldAdvance: true
=== END VALIDATION ===
` : 'FIRST TURN: Greet the candidate and ask the first domain-specific question.'}

Conversation history:
${historyText}

${userAnswer ? `Candidate answer: "${userAnswer}"` : '(First turn)'}

Respond with ONLY raw valid JSON (no markdown, no code fences):
{
  "validationStatus": "${isFirstTurn ? 'FIRST_TURN' : 'VALID or INVALID or INCOMPLETE or AMBIGUOUS'}",
  "shouldAdvance": ${isFirstTurn ? 'true' : 'true or false based on your validation'},
  "aiResponse": "natural spoken response — 2-3 sentences, no bullet points, no markdown",
  "questionNumber": ${isFirstTurn ? 1 : 'same or incremented based on shouldAdvance'},
  "isComplete": ${questionsAsked >= totalQuestions && userAnswer ? 'true' : 'false'},
  "evaluation": ${!isFirstTurn && userAnswer ? '{"score":1-10,"feedback":"...","strengths":["..."],"improvements":["..."]}' : 'null'}
}`;

    const result = await model.generateContent(systemPrompt);
    const data = extractJSON(result.response.text());

    const advance = data.shouldAdvance !== false;

    return res.status(200).json({
      validationStatus: data.validationStatus || 'VALID',
      shouldAdvance: advance,
      aiResponse: String(data.aiResponse || 'Could you clarify your answer?'),
      questionNumber: advance
        ? (Number(data.questionNumber) || questionsAsked + 1)
        : questionsAsked,
      isComplete: advance ? Boolean(data.isComplete) : false,
      evaluation: (advance && data.evaluation) ? {
        score: Number(data.evaluation.score) || 5,
        feedback: String(data.evaluation.feedback || ''),
        strengths: Array.isArray(data.evaluation.strengths) ? data.evaluation.strengths : [],
        improvements: Array.isArray(data.evaluation.improvements) ? data.evaluation.improvements : [],
      } : null,
    });

  } catch (error) {
    console.error('[conductConversation] Error:', error.message);
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────
// MOCK FALLBACK — used when GEMINI_API_KEY is not set
// ─────────────────────────────────────────────────────────────────

function getMockTurn(domain, difficulty, totalQuestions, conversationHistory, userAnswer) {
  const questionsAsked = conversationHistory.filter(
    (m, i) => m.role === 'interviewer' && i > 0
  ).length;
  const isFirstTurn = !conversationHistory.length && !userAnswer;

  if (isFirstTurn) {
    return {
      validationStatus: 'FIRST_TURN', shouldAdvance: true,
      aiResponse: `Welcome to your ${domain} interview at ${difficulty} level. I'll ask you ${totalQuestions} questions. To start — please give me a brief introduction: your name, your background, and what you have been working on recently.`,
      questionNumber: 1, isComplete: false, evaluation: null,
    };
  }

  // Run validation even in mock mode
  const lastQ = [...conversationHistory].reverse().find(m => m.role === 'interviewer')?.text || '';
  const validation = validateAnswer(lastQ, userAnswer);

  if (!validation.valid) {
    return {
      validationStatus: validation.status, shouldAdvance: false,
      aiResponse: validation.reprompt,
      questionNumber: questionsAsked, isComplete: false, evaluation: null,
    };
  }

  if (questionsAsked >= totalQuestions) {
    return {
      validationStatus: 'VALID', shouldAdvance: true,
      aiResponse: `Thank you for your responses throughout this ${domain} interview. That concludes our session. Your performance report is ready!`,
      questionNumber: questionsAsked, isComplete: true,
      evaluation: { score: 8, feedback: 'Good overall responses.', strengths: ['Clear communication'], improvements: ['Add more metrics'] },
    };
  }

  const t = (userAnswer || '').toLowerCase();
  let ack = `Thanks for explaining that.`;
  let next = `What was the most difficult technical challenge you faced in your ${domain} work, and how did you solve it?`;

  if (t.includes('react') || t.includes('vue') || t.includes('angular')) {
    ack = 'You mentioned frontend framework experience.';
    next = 'How did you handle state management and component re-rendering optimisation in that project?';
  } else if (t.includes('node') || t.includes('express') || t.includes('backend')) {
    ack = 'You built backend services.';
    next = 'How did you handle authentication, request validation, and database connection pooling?';
  } else if (t.includes('sql') || t.includes('mongo') || t.includes('database') || t.includes('db')) {
    ack = 'You worked with databases.';
    next = 'What indexing strategies and query optimisation techniques did you apply?';
  } else if (t.includes('python') || t.includes('ml') || t.includes('model') || t.includes('ai')) {
    ack = 'You touched on AI/ML work.';
    next = 'How did you handle data preprocessing, model evaluation, and preventing overfitting?';
  }

  return {
    validationStatus: 'VALID', shouldAdvance: true,
    aiResponse: `${ack} ${next}`,
    questionNumber: questionsAsked + 1, isComplete: false,
    evaluation: {
      score: 8, feedback: 'Good response with relevant technical details.',
      strengths: ['Relevant knowledge', 'Clear explanation'],
      improvements: ['Include specific metrics or benchmarks'],
    },
  };
}
