import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Mic, Video, StopCircle, SkipForward, Clock, ShieldAlert } from 'lucide-react';
import './InterviewSession.css';

const InterviewSession = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { domain = 'General', difficulty = 'Medium', questionsCount = 5 } = location.state || {};

  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(120); // 2 mins per question
  const [isRecording, setIsRecording] = useState(false);
  const [answer, setAnswer] = useState('');

  // Dummy questions for now
  const questions = [
    `Tell me about a time you faced a challenge in ${domain} and how you overcame it.`,
    `What are the key considerations when designing a scalable system for ${domain}?`,
    `How do you handle disagreements with stakeholders regarding a ${difficulty.toLowerCase()} technical decision?`
  ];

  const totalQuestions = Math.min(questionsCount, questions.length);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [currentQIndex]);

  const handleNext = () => {
    if (currentQIndex < totalQuestions - 1) {
      setCurrentQIndex(prev => prev + 1);
      setTimeLeft(120);
      setAnswer('');
    } else {
      navigate('/report');
    }
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="session-page">
      <div className="session-header glass-card">
        <div className="session-meta">
          <span className="badge">{domain}</span>
          <span className="badge">{difficulty}</span>
        </div>
        <div className={`timer ${timeLeft < 30 ? 'warning' : ''}`}>
          <Clock size={20} />
          <span>{formatTime(timeLeft)}</span>
        </div>
      </div>

      <div className="session-layout">
        <div className="main-panel glass-card">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${((currentQIndex + 1) / totalQuestions) * 100}%` }}
            ></div>
          </div>
          
          <div className="question-header">
            <h3>Question {currentQIndex + 1} of {totalQuestions}</h3>
          </div>
          
          <div className="question-text">
            {questions[currentQIndex]}
          </div>

          <div className="answer-area">
            <textarea
              className="answer-input"
              placeholder="Your answer will be transcribed here when you speak..."
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows="6"
            ></textarea>
          </div>

          <div className="controls">
            <button 
              className={`record-btn ${isRecording ? 'recording' : ''}`}
              onClick={() => setIsRecording(!isRecording)}
            >
              {isRecording ? <StopCircle size={24} /> : <Mic size={24} />}
              {isRecording ? 'Stop Recording' : 'Start Recording'}
            </button>
            
            <button className="next-btn" onClick={handleNext}>
              {currentQIndex === totalQuestions - 1 ? 'Finish Interview' : 'Next Question'} 
              <SkipForward size={20} />
            </button>
          </div>
        </div>

        <div className="side-panel">
          <div className="video-feed glass-card">
            <div className="video-placeholder">
              <Video size={48} className="video-icon" />
              <p>Camera Feed</p>
            </div>
            <div className="analysis-overlay">
              <div className="analysis-badge good">Good Posture</div>
              <div className="analysis-badge neutral">Eye Contact: 85%</div>
            </div>
          </div>

          <div className="feedback-panel glass-card">
            <h4>Live Feedback</h4>
            <ul className="feedback-list">
              <li>
                <ShieldAlert size={16} className="text-warning" />
                Speak a bit slower for clarity.
              </li>
              <li>
                <ShieldAlert size={16} className="text-success" />
                Great use of STAR method.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InterviewSession;
