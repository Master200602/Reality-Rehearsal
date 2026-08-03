import express from 'express';
import multer from 'multer';
import { uploadResume, analyzeResume } from '../controllers/resumeController.js';

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

router.post('/upload', upload.single('resume'), uploadResume);
router.post('/analyze', analyzeResume);

export default router;
