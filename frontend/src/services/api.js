import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // You can add auth tokens here if needed
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export const checkHealth = () => api.get('/health');

export const generateQuestions = (domain, difficulty, count) => 
  api.post('/interview/generate-questions', { domain, difficulty, count });

export const evaluateAnswer = (question, answer, domain) =>
  api.post('/interview/evaluate-answer', { question, answer, domain });

export const generateReport = (data) =>
  api.post('/interview/generate-report', data);

export default api;
