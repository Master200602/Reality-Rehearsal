import { GoogleGenerativeAI } from '@google/generative-ai';

// ─── Helper: extract JSON from Gemini response ───
function extractJSON(responseText) {
  let jsonStr = responseText;
  if (jsonStr.includes('```json')) {
    jsonStr = jsonStr.split('```json')[1].split('```')[0].trim();
  } else if (jsonStr.includes('```')) {
    jsonStr = jsonStr.split('```')[1].split('```')[0].trim();
  }
  return JSON.parse(jsonStr);
}

// ─── Existing: Generate Questions ───
export const generateQuestions = async (req, res, next) => {
  try {
    const { domain, difficulty, count } = req.body;
    
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
      console.warn('GEMINI_API_KEY is not set or invalid. Returning mock data.');
      return res.status(200).json([
        { id: '1', question: `Mock Question 1 for ${domain}?`, expectedTopics: ['Topic A', 'Topic B'], difficulty },
        { id: '2', question: `Mock Question 2 for ${domain}?`, expectedTopics: ['Topic C'], difficulty }
      ]);
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `Generate ${count} ${difficulty} interview questions for the domain of ${domain}. 
Return ONLY a valid JSON array where each object has:
- id: a unique string
- question: the question text
- expectedTopics: an array of short strings representing expected topics in the answer
- difficulty: the difficulty level`;

    const result = await model.generateContent(prompt);
    const questions = extractJSON(result.response.text());
    res.status(200).json(questions);
  } catch (error) {
    console.error('Error generating questions:', error);
    next(error);
  }
};

// ─── Existing: Evaluate Answer ───
export const evaluateAnswer = async (req, res, next) => {
  try {
    const { question, answer, domain } = req.body;

    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
      console.warn('GEMINI_API_KEY is not set. Returning mock evaluation.');
      return res.status(200).json({
        score: 7,
        feedback: "This is a mock evaluation feedback.",
        strengths: ["Good effort"],
        improvements: ["Needs more details"]
      });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `Evaluate the following interview answer for the domain: ${domain}.
Question: "${question}"
Answer: "${answer}"

Return ONLY a valid JSON object with the following structure:
{
  "score": a number from 1 to 10 evaluating the answer quality,
  "feedback": "a short paragraph of constructive feedback",
  "strengths": ["array", "of", "strengths"],
  "improvements": ["array", "of", "areas", "to", "improve"]
}`;

    const result = await model.generateContent(prompt);
    const evaluation = extractJSON(result.response.text());
    res.status(200).json(evaluation);
  } catch (error) {
    console.error('Error evaluating answer:', error);
    next(error);
  }
};

// ─── Existing: Generate Report ───
export const generateReport = async (req, res, next) => {
  try {
    const { domain, difficulty, responses, behaviorMetrics } = req.body;

    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
      console.warn('GEMINI_API_KEY is not set. Returning mock report.');
      return res.status(200).json({
        overallScore: 8,
        summary: "Mock report summary for your performance.",
        categoryScores: {
          technical: 8,
          communication: 7,
          confidence: 9,
          clarity: 8
        },
        detailedFeedback: "You did well but could improve in some areas.",
        recommendations: ["Study more mock questions", "Practice speaking clearly"]
      });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `Generate a comprehensive interview performance report based on the following data:
Domain: ${domain}
Difficulty: ${difficulty}
Responses: ${JSON.stringify(responses)}
Behavioral Metrics: ${JSON.stringify(behaviorMetrics)}

Return ONLY a valid JSON object with the following structure:
{
  "overallScore": an overall score from 1 to 10,
  "summary": "a brief executive summary of the performance",
  "categoryScores": {
    "technical": score 1-10,
    "communication": score 1-10,
    "confidence": score 1-10,
    "clarity": score 1-10
  },
  "detailedFeedback": "detailed constructive feedback paragraph",
  "recommendations": ["array", "of", "actionable", "recommendations"]
}`;

    const result = await model.generateContent(prompt);
    const report = extractJSON(result.response.text());
    res.status(200).json(report);
  } catch (error) {
    console.error('Error generating report:', error);
    next(error);
  }
};

// ═══════════════════════════════════════════════════════════════
// NEW: Conversational Interview Endpoint
// ═══════════════════════════════════════════════════════════════

/**
 * Conducts a single turn of the conversational interview.
 * 
 * Input:
 *   - domain: string
 *   - difficulty: string
 *   - totalQuestions: number
 *   - conversationHistory: Array<{ role: 'interviewer'|'candidate', text: string }>
 *   - userAnswer: string (empty on first call to get greeting)
 * 
 * Output:
 *   - aiResponse: string (text for TTS)
 *   - questionNumber: number (current question being asked, 0 for greeting)
 *   - isComplete: boolean
 *   - evaluation: { score, feedback, strengths, improvements } | null
 */
export const conductConversation = async (req, res, next) => {
  try {
    const { domain, difficulty, totalQuestions, conversationHistory, userAnswer } = req.body;

    // ─── Mock fallback when no API key ───
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
      console.warn('GEMINI_API_KEY is not set. Returning mock conversation turn.');
      return res.status(200).json(
        getMockConversationTurn(domain, difficulty, totalQuestions, conversationHistory, userAnswer)
      );
    }

    // ─── Build the Gemini prompt ───
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // Count how many questions have been asked so far
    const questionsAsked = conversationHistory.filter(
      (msg, i) => msg.role === 'interviewer' && i > 0 // exclude greeting
    ).length;

    const isFirstTurn = conversationHistory.length === 0 && !userAnswer;

    const systemPrompt = `You are a professional, friendly interview coach conducting a live voice interview.

INTERVIEW CONTEXT:
- Domain: ${domain}
- Difficulty: ${difficulty}
- Total questions to ask: ${totalQuestions}
- Questions asked so far: ${questionsAsked}

YOUR BEHAVIOR RULES:
1. If this is the FIRST turn (no conversation history), greet the candidate warmly by name is not known so use a generic greeting, introduce yourself briefly, and then ask the FIRST interview question. Combine the greeting and first question in one natural response.
2. For subsequent turns, you receive the candidate's answer. Acknowledge their answer briefly (1 sentence), then ask the NEXT question. Make it conversational — reference their previous answer when relevant to create follow-up questions.
3. When you have asked all ${totalQuestions} questions and received the last answer, thank the candidate, give a brief encouraging closing remark, and indicate the interview is complete.
4. Keep your responses concise and natural — they will be spoken aloud via TTS. Avoid bullet points, markdown, or special formatting.
5. NEVER reveal scores or detailed evaluations during the conversation. Just acknowledge and move on naturally.
6. Speak as a real human interviewer would — use natural transitions like "Great, thanks for sharing that.", "That's interesting, let me ask you about...", "Moving on to our next topic..."

CONVERSATION HISTORY:
${conversationHistory.map(msg => `${msg.role === 'interviewer' ? 'Interviewer' : 'Candidate'}: ${msg.text}`).join('\n') || '(No history yet — this is the first turn)'}

${userAnswer ? `CANDIDATE'S LATEST ANSWER: "${userAnswer}"` : '(First turn — no answer yet)'}

RESPOND WITH ONLY a valid JSON object:
{
  "aiResponse": "Your natural spoken response as the interviewer",
  "questionNumber": ${isFirstTurn ? 1 : questionsAsked + 1},
  "isComplete": ${questionsAsked >= totalQuestions && userAnswer ? 'true' : 'false'},
  "evaluation": ${userAnswer ? '{ "score": 1-10, "feedback": "brief feedback", "strengths": ["strength1"], "improvements": ["improvement1"] }' : 'null'}
}

IMPORTANT: "aiResponse" must read naturally when spoken aloud. No markdown, no bullet points, no asterisks.`;

    const result = await model.generateContent(systemPrompt);
    const responseData = extractJSON(result.response.text());

    // Validate and sanitize the response
    const sanitized = {
      aiResponse: String(responseData.aiResponse || "Let's continue with the interview."),
      questionNumber: Number(responseData.questionNumber) || questionsAsked + 1,
      isComplete: Boolean(responseData.isComplete),
      evaluation: responseData.evaluation ? {
        score: Number(responseData.evaluation.score) || 5,
        feedback: String(responseData.evaluation.feedback || ''),
        strengths: Array.isArray(responseData.evaluation.strengths) ? responseData.evaluation.strengths : [],
        improvements: Array.isArray(responseData.evaluation.improvements) ? responseData.evaluation.improvements : [],
      } : null,
    };

    res.status(200).json(sanitized);
  } catch (error) {
    console.error('Error in conversation turn:', error);
    next(error);
  }
};

/**
 * Mock conversation turns when no API key is available.
 * Simulates a realistic interview flow with pre-written responses.
 */
function getMockConversationTurn(domain, difficulty, totalQuestions, conversationHistory, userAnswer) {
  const questionsAsked = conversationHistory.filter(
    (msg, i) => msg.role === 'interviewer' && i > 0
  ).length;

  const isFirstTurn = conversationHistory.length === 0 && !userAnswer;

  const mockQuestions = [
    `Can you walk me through your background and what drew you to ${domain}?`,
    `What would you say is the most challenging project you've worked on in ${domain}?`,
    `How do you stay updated with the latest trends and best practices in ${domain}?`,
    `Can you describe a situation where you had to solve a difficult problem under pressure?`,
    `Where do you see yourself growing professionally in the next few years?`,
    `Tell me about a time you had to collaborate with a difficult team member.`,
    `What's your approach to learning new technologies or methodologies?`,
    `How do you handle feedback and criticism in your work?`,
    `What do you think sets you apart from other candidates in ${domain}?`,
    `Do you have any questions about the role or the team?`,
  ];

  // First turn: greeting + first question
  if (isFirstTurn) {
    return {
      aiResponse: `Hello! Welcome to your ${domain} interview. I'm your AI interviewer today, and I'll be asking you ${totalQuestions} questions at the ${difficulty} level. Let's keep this conversational and relaxed. So, to start us off — ${mockQuestions[0]}`,
      questionNumber: 1,
      isComplete: false,
      evaluation: null,
    };
  }

  // Check if interview should end
  if (questionsAsked >= totalQuestions) {
    return {
      aiResponse: `Thank you so much for your thoughtful responses throughout this interview. You've given some really solid answers, and I can tell you have a genuine passion for ${domain}. That wraps up our session today. You'll be able to review your detailed performance report on the next screen. Best of luck!`,
      questionNumber: questionsAsked,
      isComplete: true,
      evaluation: userAnswer ? {
        score: 7,
        feedback: "Good response with clear communication.",
        strengths: ["Clear articulation", "Relevant examples"],
        improvements: ["Could provide more specific details"],
      } : null,
    };
  }

  // Normal turn: acknowledge + next question
  const nextQ = mockQuestions[questionsAsked % mockQuestions.length];
  const acknowledgments = [
    "That's a great answer, thank you for sharing that.",
    "Interesting perspective, I appreciate the detail.",
    "Thanks for walking me through that.",
    "That's really insightful, I can see your experience there.",
    "Good answer, I like how you structured your response.",
  ];
  const ack = acknowledgments[questionsAsked % acknowledgments.length];

  return {
    aiResponse: `${ack} Now, ${nextQ}`,
    questionNumber: questionsAsked + 1,
    isComplete: false,
    evaluation: userAnswer ? {
      score: Math.floor(Math.random() * 3) + 6, // 6-8
      feedback: "Mock evaluation — solid response.",
      strengths: ["Good effort"],
      improvements: ["Add more specific examples"],
    } : null,
  };
}
