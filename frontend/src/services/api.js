import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export const checkHealth = () => api.get('/health');

export const uploadResume = (file) => {
  const formData = new FormData();
  formData.append('resume', file);

  return api.post('/resume/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
};

export const analyzeResume = (resumeText, targetRole) =>
  api.post('/resume/analyze', { resumeText, targetRole });

export const sendConversationTurn = (data) =>
  api.post('/interview/conversation', data);

export const generateQuestions = (domain, difficulty, count) => 
  api.post('/interview/generate-questions', { domain, difficulty, count });

export const evaluateAnswer = (question, answer, domain) =>
  api.post('/interview/evaluate-answer', { question, answer, domain });

export const generateReport = (data) =>
  api.post('/interview/generate-report', data);

export default api;
