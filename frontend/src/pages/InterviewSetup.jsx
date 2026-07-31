import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Play, Briefcase, Zap, List, AlertCircle, Mic } from 'lucide-react';
import { generateQuestions } from '../services/api';
import './InterviewSetup.css';

const domains = [
  'Software Engineering', 'Data Science', 'Product Management',
  'Marketing', 'Finance', 'Healthcare', 'Education', 'General'
];

const InterviewSetup = () => {
  const navigate = useNavigate();
  const [domain, setDomain] = useState(domains[0]);
  const [difficulty, setDifficulty] = useState('Medium');
  const [questionsCount, setQuestionsCount] = useState(5);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleStart = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // Call the real backend API to generate questions
      const questions = await generateQuestions(domain, difficulty, questionsCount);

      // Navigate to interview with the generated questions
      navigate('/interview', {
        state: {
          domain,
          difficulty,
          questionsCount,
          questions: Array.isArray(questions) ? questions : [],
        },
      });
    } catch (err) {
      console.error('Failed to generate questions:', err);
      setError('Failed to generate questions. Please check your backend server is running and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="setup-page">
      <div className="setup-container">
        <div className="setup-header text-center">
          <h2><Settings className="inline-icon" /> Interview Setup</h2>
          <p>Configure your AI interview session</p>
        </div>

        <div className="setup-content">
          <form className="setup-form glass-card" onSubmit={handleStart}>

            {error && (
              <div className="error-banner">
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}

            <div className="form-group">
              <label><Briefcase className="label-icon" /> Select Domain</label>
              <div className="custom-select-wrapper">
                <select
                  className="custom-select"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                >
                  {domains.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label><Zap className="label-icon" /> Difficulty Level</label>
              <div className="difficulty-toggles">
                {['Easy', 'Medium', 'Hard'].map(level => (
                  <button
                    key={level}
                    type="button"
                    className={`toggle-btn ${difficulty === level ? 'active' : ''}`}
                    onClick={() => setDifficulty(level)}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>
                <span><List className="label-icon" /> Number of Questions</span>
                <span className="count-badge">{questionsCount}</span>
              </label>
              <input
                type="range"
                min="3"
                max="15"
                value={questionsCount}
                onChange={(e) => setQuestionsCount(parseInt(e.target.value))}
                className="custom-slider"
              />
              <div className="slider-labels">
                <span>3</span>
                <span>15</span>
              </div>
            </div>

            <button type="submit" className="btn-primary start-btn" disabled={isLoading}>
              {isLoading ? (
                <>
                  <span className="loading-spinner"></span>
                  Generating Questions...
                </>
              ) : (
                <>Start Session <Play size={20} fill="currentColor" /></>
              )}
            </button>
          </form>

          <div className="setup-preview glass-card">
            <h3>Session Preview</h3>
            <div className="preview-items">
              <div className="preview-item">
                <span className="preview-label">Domain</span>
                <span className="preview-value gradient-text">{domain}</span>
              </div>
              <div className="preview-item">
                <span className="preview-label">Difficulty</span>
                <span className="preview-value">{difficulty}</span>
              </div>
              <div className="preview-item">
                <span className="preview-label">Questions</span>
                <span className="preview-value">{questionsCount}</span>
              </div>
              <div className="preview-item">
                <span className="preview-label">Est. Time</span>
                <span className="preview-value">~{questionsCount * 3} mins</span>
              </div>
            </div>
            <div className="preview-info">
              <p><Mic size={16} /> Make sure your microphone is ready. The AI interviewer will speak questions aloud, and you'll answer using your voice.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InterviewSetup;
