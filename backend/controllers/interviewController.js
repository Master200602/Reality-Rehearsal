import { GoogleGenerativeAI } from '@google/generative-ai';

// Controller functions
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
    console.error('Error generating questions:', error);
    next(error);
  }
};

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
    console.error('Error evaluating answer:', error);
    next(error);
  }
};

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
    console.error('Error generating report:', error);
    next(error);
  }
};
