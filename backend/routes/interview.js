import express from 'express';
import { generateQuestions, evaluateAnswer, generateReport } from '../controllers/interviewController.js';

const router = express.Router();

router.post('/generate-questions', generateQuestions);
router.post('/evaluate-answer', evaluateAnswer);
router.post('/generate-report', generateReport);

export default router;
