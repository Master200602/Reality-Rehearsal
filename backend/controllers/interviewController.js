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
  return genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
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
 * Questions that the candidate is NOT allowed to refuse or skip — these are
 * required for the interview to make sense (e.g. you can't run an interview
 * without knowing who the candidate is). A refusal here must be pushed back
 * on, not silently accepted as "SKIPPED".
 */
const MANDATORY_QUESTION_PATTERN = /\b(introduce|introduction|about yourself|tell me about (yourself|you)|who are you|your background|your name)\b/i;

/**
 * Validates whether a candidate's answer is semantically relevant to the question.
 *
 * Returns:
 *   { valid: true }  — accept and advance
 *   { valid: false, status, reprompt }  — reject and re-ask
 */
function validateAnswer(lastQuestion, answer, questionsAsked = 0) {
  const raw = (answer || '').trim();
  const lower = raw.toLowerCase().replace(/[^a-z0-9\s']/g, '');
  const words = raw.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  // The very first question of the interview is always treated as mandatory
  // (it's the intro), even if its exact wording doesn't match the pattern.
  const isMandatory = questionsAsked === 0 || MANDATORY_QUESTION_PATTERN.test(lastQuestion || '');

  // 1. Empty response
  if (!raw || wordCount === 0) {
    return {
      valid: false, status: 'INVALID',
      reprompt: isMandatory
        ? "I didn't catch a response. Before we get into the interview, I do need you to introduce yourself — your name, your background, and a bit about what you've been working on."
        : "I didn't receive any response. Please answer the question.",
    };
  }

  // 1b. Explicit refusal or request to skip
  if (/\b(don't want|dont want|no answer|skip|pass|refuse|prefer not|no thanks|not answering|no i don't|no i dont)\b/i.test(raw)) {
    if (isMandatory) {
      // Cannot be skipped — push back like a human interviewer would,
      // and re-ask the same question instead of advancing.
      return {
        valid: false,
        status: 'REFUSED_MANDATORY',
        reprompt: "I understand, but this part isn't optional — before we start the interview, I need a quick introduction from you: your name, your background, and what you've been working on recently. Go ahead whenever you're ready.",
      };
    }
    return {
      valid: true,
      status: 'SKIPPED',
      reprompt: null,
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
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent('Reply with exactly: {"status":"ok"}');
    const text = result.response.text();
    return res.status(200).json({
      status: 'ACTIVE',
      working: true,
      message: 'Gemini API key is valid and working correctly!',
      modelUsed: 'gemini-2.5-flash',
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
        aiResponse: questionNumber >= totalQuestions
          ? `Thank you ${candidateName}. That concludes the interview. Your report is being generated.`
          : isWeak
            ? `Alright, let's move on. How did you handle performance optimization and error handling in your ${domain} work?`
            : `Good explanation. Building on that — how did you handle performance optimization and error handling in your ${domain} work?`,
        questionNumber: Math.min(questionNumber + 1, totalQuestions),
        isComplete: questionNumber >= totalQuestions,
        evaluation: { score: isWeak ? 2 : 7, feedback: isWeak ? 'Very brief response.' : 'Reasonable answer.', strengths: ['Participated'], improvements: ['Add more specifics'] },
      });
    }

    const prompt = `You are a senior, experienced human interviewer conducting a live ${domain} interview at ${difficulty} level. You are warm but professional, sharp but not robotic.
Candidate: ${candidateName} | Role: ${targetRole} | Skills: ${skillsList} | Projects: ${projectsList}
Resume: ${resumeText ? resumeText.slice(0, 2000) : 'Not provided'}
Conversation so far: ${conversationHistory.map(m => `${m.role.toUpperCase()}: ${m.text}`).join('\n') || 'None'}
Candidate latest answer: "${userAnswer || 'None — first turn'}"
Total questions: ${totalQuestions} | Current question index: ${questionNumber + 1}

React to the candidate's actual words — reference specific details they mentioned. Vary your acknowledgments every turn. If their answer is vague, push back conversationally. If they refuse a mandatory question like intro, explain why it matters and re-ask in fresh wording. If they refuse an optional question, accept it and pivot. Never repeat your previous message verbatim. Speak like a real person — 2-4 natural sentences, no bullet points, no markdown.

Return ONLY valid JSON:
{
  "aiResponse": "natural spoken interviewer response",
  "questionNumber": ${Math.min(questionNumber + (userAnswer ? 1 : 0), totalQuestions)},
  "isComplete": ${questionNumber >= totalQuestions ? 'true' : 'false'},
  "evaluation": ${userAnswer ? '{"score":1-10,"feedback":"honest 1-line assessment","strengths":["..."],"improvements":["..."]}' : 'null'}
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

    try {
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
    } catch (geminiError) {
      console.warn('[generateReport] Gemini API error, returning calculated report:', geminiError.message);
      return res.status(200).json({
        candidateName, targetRole, overallScore: overall,
        summary: `${candidateName} demonstrated good proficiency in ${targetRole} during the ${difficulty} session, achieving an overall score of ${overall}/100.`,
        categoryScores: {
          technical: Math.round(overall * 0.95), communication: Math.round(overall * 1.05),
          confidence: Math.round(overall * 0.98), clarity: Math.round(overall * 1.02),
        },
        strengths: ['Effective answer structure', `Good grasp of ${domain} concepts`, 'Strong engagement'],
        improvements: ['Deepen technical implementation details', 'Quantify project achievements', 'Maintain consistent pacing'],
        recommendations: [`Review advanced ${domain} patterns`, 'Practice structured STAR response method', 'Conduct regular mock sessions'],
      });
    }
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────
// CORE: CONDUCT CONVERSATION — natural, non-blocking interviewer
// ─────────────────────────────────────────────────────────────────

/**
 * Handles one conversation turn. ALWAYS advances the interview.
 * The AI responds naturally to whatever the user says — just like
 * a real human interviewer would. No question is ever repeated.
 */
export const conductConversation = async (req, res, next) => {
  try {
    const { domain, difficulty, totalQuestions, conversationHistory, userAnswer, candidateProfile, resumeText, interviewerName = 'Sarah Jenkins', interviewerTitle = 'Lead Technical Recruiter' } = req.body;

    const isFirstTurn = !conversationHistory?.length && !userAnswer;

    const questionsAsked = conversationHistory
      ? conversationHistory.filter((m, i) => m.role === 'interviewer' && i > 0).length
      : 0;

    // ── No pre-validation. Let the AI handle everything naturally. ──

    // ── Mock fallback when no API key configured ──
    const model = getGeminiModel();
    if (!model) {
      return res.status(200).json(
        getMockTurn(domain, difficulty, totalQuestions, conversationHistory || [], userAnswer, interviewerName, interviewerTitle)
      );
    }

    // ── Gemini prompt — behave like a real human interviewer ──
    const historyText = conversationHistory
      ? conversationHistory.map(m => `${m.role === 'interviewer' ? interviewerName : 'Candidate'}: ${m.text}`).join('\n')
      : '(No history)';

    const candidateName = candidateProfile?.fullName || 'Candidate';
    const targetRole = candidateProfile?.targetRole || domain;
    const skillsList = candidateProfile?.skills?.join(', ') || '';
    const projectsList = candidateProfile?.projects?.join(', ') || '';

    const systemPrompt = `You are ${interviewerName}, a senior ${interviewerTitle} conducting a live ${domain} interview at ${difficulty} level. You are warm, professional, sharp, and genuinely human in your interaction style. You have genuine curiosity about the candidate's real-world experiences. You never sound like an automated bot, a script, or a validator repeating error messages.
Interviewer Persona: ${interviewerName} (${interviewerTitle})
Candidate: ${candidateName} | Target Role: ${targetRole}
${skillsList ? `Skills from resume: ${skillsList}` : ''}
${projectsList ? `Projects from resume: ${projectsList}` : ''}
${resumeText ? `Resume excerpt: ${resumeText.slice(0, 1500)}` : ''}
Total questions to ask: ${totalQuestions} | Questions asked so far: ${questionsAsked}

CORE BEHAVIOR RULES

1. React to what the candidate actually said — every time. Never respond with a generic template. Reference a specific detail, word, or claim from their last answer before moving on. A real interviewer listens.

2. Vary your acknowledgments. Never reuse the same opener twice in a session. Instead of always "Thanks for sharing" or "Good explanation," rotate through natural human reactions: "Interesting — ", "Okay, that makes sense.", "Got it, so you were mainly responsible for...", "Hm, walk me through that a bit more.", a short pause-like transition, etc.

3. Ask real follow-ups, not just the next scripted question. If the candidate mentions a specific technology, project, or decision, drill into it before moving to a fresh topic — the way a real interviewer probes ("You said you optimized the query — what was the bottleneck, exactly?"). Only move to an entirely new topic once a thread feels naturally exhausted.

4. Handle weak, evasive, or refusal answers the way a human would — not with an error message.
   - If the answer is thin or vague: push back conversationally ("That's a bit high-level — can you get specific about what you did, versus the team?").
   - If the candidate refuses a mandatory question (e.g. the introduction): do not treat it as skippable. Respond firmly but naturally, like a real interviewer who won't just move on — explain briefly why it matters, then ask again in fresh wording (not a copy-pasted repeat of your last message).
   - If the candidate refuses a non-mandatory question later on: it's fine to accept that and pivot, the way a real interviewer would let some things go.
   - Never phrase a re-ask as literally quoting your own previous sentence back ("please answer: '...'"). A human never does that. Re-ask in new words that still capture the same question.

5. Keep continuity and memory. Refer back to earlier answers when relevant ("Earlier you mentioned you used Redis for caching — does that connect to this scaling problem?"). This is what makes it feel like one continuous conversation instead of isolated Q&A turns.

6. Match tone to the moment. Encourage a nervous-sounding candidate briefly ("No worries, take your time"). Challenge an overconfident or vague answer. Don't praise every answer equally — vary your warmth based on the quality of what was actually said, the way a real evaluator would.

7. Speak like a person, not a document.
   - No bullet points, no markdown, no numbered lists in spoken responses.
   - 2–4 natural sentences per turn, not clinical one-liners.
   - Contractions are fine ("that's", "you've", "let's").
   - Never say things like "Validation failed" or "Response rejected" — say what a human interviewer would actually say in that moment.
   - Never repeat your own exact previous message verbatim, even when the candidate gives the same non-answer twice in a row. Rephrase, add a slightly different angle or reason each time, the way a patient human would.

WHAT TO AVOID (things that break immersion)
- Canned phrases like "That response doesn't answer the question."
- Quoting your own earlier message back to the candidate.
- Treating every refusal identically, regardless of whether the question was mandatory or optional.
- Jumping to a totally unrelated question right after a rich, detailed answer without at least one follow-up.
- Giving the same "Good explanation. Building on that —" transition every turn.
- Long clinical evaluation-style text in the spoken response (save structured scoring for the background evaluation object, not the thing the candidate hears).

${isFirstTurn ? 'This is the FIRST TURN. Greet the candidate warmly by name and ask them to briefly introduce themselves — their name, background, what they have been working on. Keep it natural and inviting.' : ''}

Conversation history:
${historyText}

${userAnswer ? `Candidate's latest response: "${userAnswer}"` : '(First turn — no response yet)'}

Respond with ONLY raw valid JSON (no markdown, no code fences):
{
  "validationStatus": "VALID",
  "shouldAdvance": true,
  "aiResponse": "your natural spoken response — react to what they said, then continue the conversation",
  "questionNumber": ${isFirstTurn ? 1 : questionsAsked + 1},
  "isComplete": ${questionsAsked >= totalQuestions && userAnswer ? 'true' : 'false'},
  "evaluation": ${!isFirstTurn && userAnswer ? '{"score":1-10,"feedback":"honest 1-line assessment of what they said","strengths":["..."],"improvements":["..."]}' : 'null'}
}`;

    try {
      const result = await model.generateContent(systemPrompt);
      const data = extractJSON(result.response.text());

      return res.status(200).json({
        validationStatus: 'VALID',
        shouldAdvance: true,
        aiResponse: String(data.aiResponse || 'Interesting. Let me ask you the next question.'),
        questionNumber: Number(data.questionNumber) || questionsAsked + 1,
        isComplete: Boolean(data.isComplete),
        evaluation: data.evaluation ? {
          score: Number(data.evaluation.score) || 5,
          feedback: String(data.evaluation.feedback || ''),
          strengths: Array.isArray(data.evaluation.strengths) ? data.evaluation.strengths : [],
          improvements: Array.isArray(data.evaluation.improvements) ? data.evaluation.improvements : [],
        } : null,
      });
    } catch (geminiError) {
      console.error('\n========================================');
      console.error('⚠️  GEMINI API CALL FAILED — using scripted fallback, NOT real AI');
      console.error('Reason:', geminiError.message);
      console.error('This usually means: invalid model name, invalid/missing API key, or quota exceeded.');
      console.error('========================================\n');
      return res.status(200).json(
        getMockTurn(domain, difficulty, totalQuestions, conversationHistory || [], userAnswer)
      );
    }

  } catch (error) {
    console.error('[conductConversation] Critical Error:', error.message);
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────
// MOCK FALLBACK — used when GEMINI_API_KEY is not set
// ─────────────────────────────────────────────────────────────────

function getMockTurn(domain, difficulty, totalQuestions, conversationHistory, userAnswer, interviewerName = 'Sarah Jenkins', interviewerTitle = 'Lead Technical Recruiter') {
  const questionsAsked = conversationHistory.filter(
    (m, i) => m.role === 'interviewer' && i > 0
  ).length;
  const isFirstTurn = !conversationHistory.length && !userAnswer;

  if (isFirstTurn) {
    return {
      validationStatus: 'FIRST_TURN', shouldAdvance: true,
      aiResponse: `Hi there! I'm ${interviewerName}, ${interviewerTitle}. Welcome to your ${domain} interview session at ${difficulty} level! To get started — please give me a brief introduction: your name, your background, and what you have been working on recently.`,
      questionNumber: 1, isComplete: false, evaluation: null,
    };
  }

  // NO validation blocking — always advance

  if (questionsAsked >= totalQuestions) {
    return {
      validationStatus: 'VALID', shouldAdvance: true,
      aiResponse: `Thank you for your responses throughout this ${domain} interview. That concludes our session. Your performance report is ready!`,
      questionNumber: questionsAsked, isComplete: true,
      evaluation: { score: 7, feedback: 'Completed the interview session.', strengths: ['Engagement'], improvements: ['Provide more detailed answers'] },
    };
  }

  const lowerAnswer = (userAnswer || '').toLowerCase().trim();
  const isSkipped = /\b(don't want|dont want|no answer|skip|pass|refuse|prefer not|no thanks|not answering|no i don't|no i dont)\b/i.test(lowerAnswer);
  const isTrivial = TRIVIAL_WORDS.has(lowerAnswer.replace(/[^a-z\s]/g, '').trim()) || lowerAnswer.split(/\s+/).length <= 2;

  let ack = '';
  let next = '';
  let score = 7;

  if (isSkipped || (isTrivial && /^(no|nah|nope|no no|nah nah)\s*$/i.test(lowerAnswer))) {
    // Check if this was the intro question (first question after greeting)
    if (questionsAsked <= 1) {
      ack = "Hey, I totally get it — interviews can feel awkward at first. But a quick intro really helps me ask you the right questions. You could just say something like 'Hi, I'm a developer and I've been working on web apps' — nothing fancy needed.";
      next = `So go ahead — what's your name and what have you been working on recently?`;
    } else {
      ack = "No worries, that's okay. Let me ask you something different instead.";
      next = `Tell me about a project you've worked on in ${domain}. What was your role and what technologies did you use?`;
    }
    score = 2;
  } else if (isTrivial) {
    ack = "I appreciate the response, but I'd love to hear a bit more from you.";
    next = `Can you walk me through a specific technical challenge you faced in ${domain} and how you approached solving it?`;
    score = 3;
  } else if (lowerAnswer.includes('react') || lowerAnswer.includes('vue') || lowerAnswer.includes('angular') || lowerAnswer.includes('frontend')) {
    ack = 'You mentioned working with modern frontend frameworks.';
    next = 'How did you handle state management and component re-rendering optimization in that project?';
  } else if (lowerAnswer.includes('node') || lowerAnswer.includes('express') || lowerAnswer.includes('backend') || lowerAnswer.includes('api')) {
    ack = 'You mentioned backend and API development.';
    next = 'How did you structure request validation, authentication, and error handling in your backend services?';
  } else if (lowerAnswer.includes('sql') || lowerAnswer.includes('mongo') || lowerAnswer.includes('database') || lowerAnswer.includes('db')) {
    ack = 'You touched on database management.';
    next = 'What indexing strategies or query optimization techniques did you use to maintain database performance?';
  } else if (lowerAnswer.includes('python') || lowerAnswer.includes('ml') || lowerAnswer.includes('ai') || lowerAnswer.includes('model')) {
    ack = 'You mentioned working with AI and data pipelines.';
    next = 'How did you handle data preprocessing, model evaluation, and preventing overfitting?';
  } else {
    // Dynamically extract words from candidate's text
    const cleanWords = lowerAnswer.split(/\s+/).filter(w => w.length > 3 && !TRIVIAL_WORDS.has(w));
    if (cleanWords.length > 0) {
      const phrase = cleanWords.slice(0, 3).join(', ');
      ack = `Interesting — you touched on ${phrase}.`;
    } else {
      ack = `Got it.`;
    }
    next = `From a technical standpoint in ${domain}, what was the most complex problem you solved recently and what tradeoffs did you evaluate?`;
  }

  return {
    validationStatus: 'VALID', shouldAdvance: true,
    aiResponse: `${ack} ${next}`,
    questionNumber: questionsAsked + 1, isComplete: false,
    evaluation: {
      score,
      feedback: score <= 3 ? 'Candidate chose not to elaborate or gave a very brief response.' : 'Good response with relevant technical context.',
      strengths: score <= 3 ? ['Continued participating in the interview'] : ['Relevant domain knowledge', 'Clear articulation'],
      improvements: score <= 3 ? ['Provide detailed, substantive answers to demonstrate knowledge'] : ['Include specific technical metrics or benchmarks'],
    },
  };
}