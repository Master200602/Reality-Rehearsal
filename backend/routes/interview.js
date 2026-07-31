import express from 'express';
import { generateQuestions, evaluateAnswer, generateReport, conductConversation } from '../controllers/interviewController.js';

const router = express.Router();

router.post('/generate-questions', generateQuestions);
router.post('/evaluate-answer', evaluateAnswer);
router.post('/generate-report', generateReport);
router.post('/conversation', conductConversation);

export default router;
