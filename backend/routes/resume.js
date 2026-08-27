import express from 'express';
import multer from 'multer';
import { uploadResume, analyzeResume } from '../controllers/resumeController.js';

const router = express.Router();

const storage = multer.memoryStorage();

// Restrict file types at the multer layer — only PDF and DOCX
const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    // Pass a custom error message
    const err = new Error('Only PDF files are accepted. Please upload your resume as a PDF.');
    err.code = 'INVALID_FILE_TYPE';
    cb(err, false);
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter,
});

// Wrapper that catches multer errors and returns clean JSON
const uploadMiddleware = (req, res, next) => {
  const multerUpload = upload.single('resume');

  multerUpload(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          error: 'FILE_TOO_LARGE',
          message: 'File size exceeds the 5MB limit. Please upload a smaller PDF.',
        });
      }
      if (err.code === 'INVALID_FILE_TYPE') {
        return res.status(400).json({
          error: 'INVALID_FILE_TYPE',
          message: err.message,
        });
      }
      return res.status(400).json({
        error: 'UPLOAD_ERROR',
        message: `Upload error: ${err.message}`,
      });
    }
    next();
  });
};

router.post('/upload', uploadMiddleware, uploadResume);
router.post('/analyze', analyzeResume);

export default router;
