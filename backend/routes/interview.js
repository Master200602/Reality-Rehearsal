import express from 'express';
import { conductConversation, generateQuestions, evaluateAnswer, generateReport } from '../controllers/interviewController.js';

const router = express.Router();

router.post('/conversation', conductConversation);
router.post('/generate-questions', generateQuestions);
router.post('/evaluate-answer', evaluateAnswer);
router.post('/generate-report', generateReport);

export default router;
