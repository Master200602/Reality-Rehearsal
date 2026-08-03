import express from 'express';
<<<<<<< HEAD
import { generateQuestions, evaluateAnswer, generateReport, conductConversation } from '../controllers/interviewController.js';
=======
import { conductConversation, generateQuestions, evaluateAnswer, generateReport } from '../controllers/interviewController.js';
>>>>>>> ce543e9 (Candidate form)

const router = express.Router();

router.post('/conversation', conductConversation);
router.post('/generate-questions', generateQuestions);
router.post('/evaluate-answer', evaluateAnswer);
router.post('/generate-report', generateReport);
router.post('/conversation', conductConversation);

export default router;
