import { GoogleGenerativeAI } from '@google/generative-ai';

// Controller functions
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
    const skillsList = candidateProfile?.skills?.join(', ') || candidateProfile?.branch || 'Technical Skills';
    const projectsList = candidateProfile?.projects?.join(', ') || 'Projects listed on resume';
    const education = candidateProfile?.education || candidateProfile?.college || 'Higher Education';

    const interviewerMessages = conversationHistory.filter(m => m.role === 'interviewer');
    const questionNumber = interviewerMessages.length + (userAnswer ? 1 : 0);

    // If GEMINI_API_KEY is not configured in .env, use an intelligent rule-based verifier for testing
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
      console.warn('GEMINI_API_KEY is not set in backend/.env. Using strict intelligent rule-based evaluation fallback.');

      if (questionNumber === 0) {
        return res.status(200).json({
          aiResponse: `Hello ${candidateName}! Welcome to your ${targetRole} technical interview. I've reviewed your resume highlighting skills in ${skillsList}. To start our session, please walk me through one of your key projects, such as ${projectsList}, and explain your specific role and technical stack.`,
          questionNumber: 1,
          isComplete: false,
          evaluation: null
        });
      }

      // Strict heuristic answer verification for mock mode
      const cleanAnswer = userAnswer.trim().toLowerCase();
      const isShort = cleanAnswer.split(/\s+/).length < 5;
      const isGibberish = /^(asdf|qwer|test|bla|xyz|fake|idk|dunno|aaaa|1234|abc)$/i.test(cleanAnswer) || cleanAnswer.length < 8;
      const hasContradiction = cleanAnswer.includes('html is programming') || cleanAnswer.includes('css database') || cleanAnswer.includes('fake');

      let turnScore = 7;
      let turnFeedback = "Reasonable response, though additional technical depth would improve your score.";
      let aiText = "";

      if (isShort || isGibberish || hasContradiction) {
        turnScore = 2;
        turnFeedback = "Answer lacked technical substance, was too brief, or contained incorrect statements.";
        aiText = `Hold on, ${candidateName}. That response is quite vague or technically inaccurate. In a real technical interview for a ${targetRole}, giving vague or incorrect answers will hurt your evaluation. Let's focus on your actual experience — can you explain the technical architecture of your project (${projectsList}) step-by-step?`;
      } else {
        turnScore = 8;
        turnFeedback = "Solid technical explanation covering relevant principles.";
        if (questionNumber >= totalQuestions) {
          aiText = `Thank you, ${candidateName}. That concludes our ${targetRole} technical interview today. I've recorded your responses and analyzed your technical accuracy. I am now compiling your detailed performance report.`;
        } else {
          aiText = `Good explanation, ${candidateName}. Let's dive deeper into your resume skills (${skillsList}). When building scale applications for ${targetRole}, how do you handle state management, performance optimization, and error handling under high load?`;
        }
      }

      return res.status(200).json({
        aiResponse: aiText,
        questionNumber: Math.min(questionNumber + 1, totalQuestions),
        isComplete: questionNumber >= totalQuestions,
        evaluation: {
          score: turnScore,
          feedback: turnFeedback,
          strengths: turnScore > 5 ? ["Clear communication"] : [],
          improvements: turnScore <= 5 ? ["Provide real technical details rather than generic answers", "Ensure accurate technical concepts"] : ["Elaborate on quantitative results"]
        }
      });
    }

    // LIVE GEMINI AI ENGINE — Strict Technical Interviewer Prompt
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const systemPrompt = `You are a Strict Senior Technical Interviewer at a top tier tech company conducting a 1-on-1 interview.

CANDIDATE PROFILE:
- Full Name: ${candidateName}
- Target Job Role: ${targetRole}
- Interview Domain: ${domain}
- Difficulty Level: ${difficulty}
- Education: ${education}
- Extracted Skills: ${skillsList}
- Notable Projects: ${projectsList}

RESUME CONTEXT:
"""
${resumeText ? resumeText.slice(0, 3000) : 'No resume file uploaded.'}
"""

CRITICAL EVALUATION & BEHAVIOR RULES:
1. STRICT VERIFICATION: Carefully analyze the candidate's last answer. Do NOT praise or validate fake, vague, incorrect, or gibberish answers.
2. CALL OUT INCORRECT CLAIMS: If the candidate makes false technical claims (e.g. calling HTML a programming language, claiming to build complex ML models with 2 lines of code without explanation, or giving evasive fluff), IMMEDIATELY AND DIRECTLY CORRECT THEM in your spoken response. Explain why it is incorrect and challenge them to answer properly.
3. SCORING RUBRIC (1-10):
   - 1-3: Fake, incorrect, evasive, or gibberish answer.
   - 4-6: Superficial or generic answer lacking technical depth or architecture.
   - 7-8: Good, accurate technical answer with solid reasoning.
   - 9-10: Exceptional, highly detailed answer with deep system knowledge and STAR methodology.
4. CONVERSATIONAL TONE: Address ${candidateName} naturally. Sound like an actual expert interviewer — demanding, articulate, professional, and clear.
5. QUESTION PROGRESSION: Total questions: ${totalQuestions}. Current turn index: ${questionNumber + 1}. If final turn, thank the candidate and state the interview is wrapping up.

Return ONLY a valid JSON object:
{
  "aiResponse": "Your exact spoken response to the candidate. If their answer was fake/wrong, correct them directly and ask a sharp follow-up. If good, acknowledge key points and ask the next technical/scenario question.",
  "questionNumber": ${Math.min(questionNumber + (userAnswer ? 1 : 0), totalQuestions)},
  "isComplete": ${questionNumber >= totalQuestions ? 'true' : 'false'},
  "evaluation": ${userAnswer ? `{
    "score": number 1-10 based on strict rubric,
    "feedback": "strict, honest 1-2 sentence assessment of candidate's answer correctness",
    "strengths": ["array of genuine technical strengths"],
    "improvements": ["array of specific technical gaps identified in answer"]
  }` : 'null'}
}`;

    const conversationContext = conversationHistory.map(m => `${m.role.toUpperCase()}: ${m.text}`).join('\n');
    const fullUserPrompt = `${systemPrompt}\n\nCONVERSATION HISTORY:\n${conversationContext || 'None (Initial turn)'}\n\nCANDIDATE SPOKEN ANSWER TO EVALUATE:\n"${userAnswer || 'None (Interview start)'}"`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Attempt to extract JSON if formatted with backticks
    let jsonStr = responseText;
    if (jsonStr.includes('\`\`\`json')) {
      jsonStr = jsonStr.split('\`\`\`json')[1].split('\`\`\`')[0].trim();
    } else if (jsonStr.includes('\`\`\`')) {
      jsonStr = jsonStr.split('\`\`\`')[1].split('\`\`\`')[0].trim();
    }

    const questions = JSON.parse(jsonStr);
    res.status(200).json(questions);
  } catch (error) {
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
    const responseText = result.response.text();

    let jsonStr = responseText;
    if (jsonStr.includes('\`\`\`json')) {
      jsonStr = jsonStr.split('\`\`\`json')[1].split('\`\`\`')[0].trim();
    } else if (jsonStr.includes('\`\`\`')) {
      jsonStr = jsonStr.split('\`\`\`')[1].split('\`\`\`')[0].trim();
    }

    const evaluation = JSON.parse(jsonStr);
    res.status(200).json(evaluation);
  } catch (error) {
    next(error);
  }
};

export const generateReport = async (req, res, next) => {
  try {
    const {
      domain = 'General',
      difficulty = 'Medium',
      responses = [],
      candidateProfile = {},
      resumeText = '',
    } = req.body;

    const candidateName = candidateProfile?.fullName || 'Candidate';
    const targetRole = candidateProfile?.targetRole || domain;

    let totalScoreSum = 0;
    let validAnswersCount = 0;
    let lowScoreCount = 0;

    responses.forEach(r => {
      if (typeof r.score === 'number') {
        totalScoreSum += r.score;
        validAnswersCount++;
        if (r.score <= 4) lowScoreCount++;
      }
    });

    const avgTurnScore = validAnswersCount > 0 ? (totalScoreSum / validAnswersCount) : 7.5;
    const computedOverallScore = Math.min(100, Math.max(15, Math.round(avgTurnScore * 10)));

    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
      console.warn('GEMINI_API_KEY is not set. Returning mathematical report based on answer evaluations.');
      return res.status(200).json({
        candidateName,
        targetRole,
        overallScore: computedOverallScore,
        summary: lowScoreCount > 0
          ? `${candidateName} attempted the ${targetRole} interview, but several answers lacked technical accuracy or contained superficial claims.`
          : `${candidateName} demonstrated solid technical foundation for ${targetRole}, providing structured answers across key domain topics.`,
        categoryScores: {
          technical: Math.max(20, Math.round(computedOverallScore * 0.95)),
          communication: Math.max(30, Math.round(computedOverallScore * 1.05)),
          confidence: Math.max(25, Math.round(computedOverallScore * 0.98)),
          clarity: Math.max(20, Math.round(computedOverallScore * 1.02))
        },
        strengths: lowScoreCount === 0 ? [
          `Clear communication regarding ${candidateProfile?.skills?.slice(0, 2).join(', ') || 'core concepts'}`,
          "Good response structure and candidate presentation"
        ] : [
          "Completed interview session under timed conditions"
        ],
        improvements: [
          "Ensure all technical claims are accurate and verifiable",
          "Provide concrete architectural details and code-level explanations rather than generic fluff",
          "Practice explaining core computer science and framework fundamentals"
        ],
        recommendations: [
          `Review core technical concepts required for ${targetRole}`,
          "Practice mock technical interviews with focus on accuracy and depth"
        ]
      });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `Generate a strict, honest interview performance report for candidate "${candidateName}" who interviewed for "${targetRole}" (${domain}, ${difficulty} level).

CANDIDATE DETAILS:
- Name: ${candidateName}
- Target Role: ${targetRole}
- Resume Skills: ${JSON.stringify(candidateProfile?.skills || [])}

INTERVIEW QUESTIONS, SPOKEN ANSWERS & EVALUATIONS:
${JSON.stringify(responses, null, 2)}

COMPUTED AVERAGE SCORE FROM ANSWERS: ${computedOverallScore}/100

STRICT REPORT GENERATION RULES:
1. Be completely honest. If candidate gave fake, vague, or incorrect answers, reflect that in low category scores and constructive feedback.
2. Overall score must closely align with computed score (${computedOverallScore}/100).
3. Provide 3 specific strengths, 3 clear areas for improvement, and 3 actionable preparation recommendations for ${targetRole}.

Return ONLY a valid JSON object:
{
  "candidateName": "${candidateName}",
  "targetRole": "${targetRole}",
  "overallScore": ${computedOverallScore},
  "summary": "2-3 sentence honest executive summary",
  "categoryScores": {
    "technical": score 1-100,
    "communication": score 1-100,
    "confidence": score 1-100,
    "clarity": score 1-100
  },
  "strengths": ["array of 3 genuine strengths"],
  "improvements": ["array of 3 areas for improvement"],
  "recommendations": ["array of 3 recommendations"]
}`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    let jsonStr = responseText;
    if (jsonStr.includes('\`\`\`json')) {
      jsonStr = jsonStr.split('\`\`\`json')[1].split('\`\`\`')[0].trim();
    } else if (jsonStr.includes('\`\`\`')) {
      jsonStr = jsonStr.split('\`\`\`')[1].split('\`\`\`')[0].trim();
    }

    const report = JSON.parse(jsonStr);
    res.status(200).json(report);
  } catch (error) {
    console.error('Error generating detailed report:', error);
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
