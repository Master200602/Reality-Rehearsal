import { useNavigate } from 'react-router-dom';
import { Download, RefreshCw, CheckCircle, TrendingUp, AlertTriangle } from 'lucide-react';
import './Report.css';

const Report = () => {
  const navigate = useNavigate();

  const score = 85;
  const categories = [
    { name: 'Technical Accuracy', score: 90, color: '#10b981' },
    { name: 'Communication', score: 82, color: '#3b82f6' },
    { name: 'Confidence', score: 78, color: '#8b5cf6' },
    { name: 'Clarity', score: 88, color: '#ec4899' }
  ];

  const strengths = [
    'Excellent use of the STAR method to structure answers.',
    'Strong grasp of core technical concepts.',
    'Maintained good eye contact and posture.'
  ];

  const improvements = [
    'Try to reduce the use of filler words (um, ah).',
    'Elaborate more on the impact of your actions in scenario questions.',
    'Speak slightly slower to improve clarity.'
  ];

  return (
    <div className="report-page">
      <div className="report-header">
        <h2>Interview Performance Report</h2>
        <p>Review your results and insights to improve for next time.</p>
      </div>

      <div className="report-grid">
        {/* Overall Score */}
        <div className="score-card glass-card">
          <h3>Overall Score</h3>
          <div className="circular-progress">
            <svg viewBox="0 0 100 100">
              <circle className="bg" cx="50" cy="50" r="45"></circle>
              <circle 
                className="progress" 
                cx="50" cy="50" r="45" 
                style={{ strokeDasharray: `${(score / 100) * 283} 283` }}
              ></circle>
            </svg>
            <div className="score-value">
              <span>{score}</span>
              <small>/100</small>
            </div>
          </div>
          <p className="score-text">Great job! You are well-prepared, but there is always room for refinement.</p>
        </div>

        {/* Category Breakdown */}
        <div className="breakdown-card glass-card">
          <h3>Category Breakdown</h3>
          <div className="bars-container">
            {categories.map(cat => (
              <div key={cat.name} className="bar-item">
                <div className="bar-label">
                  <span>{cat.name}</span>
                  <span>{cat.score}%</span>
                </div>
                <div className="bar-track">
                  <div 
                    className="bar-fill" 
                    style={{ width: `${cat.score}%`, backgroundColor: cat.color }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Strengths */}
        <div className="feedback-card glass-card">
          <h3><TrendingUp className="icon-success" /> Key Strengths</h3>
          <ul className="feedback-list">
            {strengths.map((item, i) => (
              <li key={i}>
                <CheckCircle size={18} className="icon-success" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Improvements */}
        <div className="feedback-card glass-card">
          <h3><AlertTriangle className="icon-warning" /> Areas for Improvement</h3>
          <ul className="feedback-list">
            {improvements.map((item, i) => (
              <li key={i}>
                <div className="bullet-warning"></div>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="report-actions">
        <button className="btn-secondary">
          <Download size={20} /> Download PDF
        </button>
        <button className="btn-primary" onClick={() => navigate('/setup')}>
          <RefreshCw size={20} /> Practice Again
        </button>
      </div>
    </div>
  );
};

export default Report;
