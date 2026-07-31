import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Mic, MicOff, SkipForward, Clock, Send, Volume2, VolumeX, Loader, AlertCircle } from 'lucide-react';
import useSpeech from '../hooks/useSpeech';
import { evaluateAnswer } from '../services/api';
import './InterviewSession.css';

/**
 * Voice state phases for each question:
 * 'speaking'   → AI reads the question aloud (TTS)
 * 'listening'  → User is answering via microphone (STT)
 * 'evaluating' → Answer sent to API for evaluation
 * 'feedback'   → Brief score/feedback shown before next question
 * 'idle'       → Waiting for user action
 */

const InterviewSession = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    domain = 'General',
    difficulty = 'Medium',
    questions: apiQuestions = [],
  } = location.state || {};

  // ─── State ───
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(120);
  const [phase, setPhase] = useState('idle'); // speaking | listening | evaluating | feedback | idle
  const [responses, setResponses] = useState([]);
  const [currentFeedback, setCurrentFeedback] = useState(null);
  const [error, setError] = useState('');

  // ─── Speech hook ───
  const {
    transcript,
    interimTranscript,
    isListening,
    startListening,
    stopListening,
    resetTranscript,
    isSpeaking,
    speak,
    stopSpeaking,
    isSpeechSupported,
  } = useSpeech();

  // ─── Refs ───
  const timerRef = useRef(null);
  const hasSpokenRef = useRef(false);

  // ─── Fallback questions if none provided ───
  const questions = apiQuestions.length > 0
    ? apiQuestions.map(q => (typeof q === 'string' ? q : q.question))
    : [
        `Tell me about your experience in ${domain}.`,
        `What are the key challenges you've faced in ${domain}?`,
        `How do you approach problem-solving in a ${difficulty.toLowerCase()} scenario?`,
      ];

  const totalQuestions = questions.length;
  const currentQuestion = questions[currentQIndex] || '';
  const displayAnswer = transcript + (interimTranscript ? ' ' + interimTranscript : '');

  // ─── Timer ───
  useEffect(() => {
    if (phase === 'listening') {
      setTimeLeft(120);
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            // Time's up — auto-submit
            clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [phase]);

  // Auto-submit when timer hits 0
  useEffect(() => {
    if (timeLeft === 0 && phase === 'listening') {
      handleSubmitAnswer();
    }
  }, [timeLeft, phase]);

  // ─── Auto-speak question when entering a new question ───
  useEffect(() => {
    if (currentQuestion && !hasSpokenRef.current) {
      hasSpokenRef.current = true;
      speakQuestion();
    }
  }, [currentQIndex]);

  /**
   * Speak the current question aloud, then transition to listening
   */
  const speakQuestion = async () => {
    setPhase('speaking');
    setError('');
    resetTranscript();

    try {
      await speak(currentQuestion);
      // After AI finishes speaking, auto-start listening
      setPhase('listening');
      startListening();
    } catch (e) {
      console.warn('TTS error, proceeding to listening:', e);
      setPhase('listening');
      startListening();
    }
  };

  /**
   * Toggle microphone on/off
   */
  const toggleMic = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
      setPhase('listening');
    }
  }, [isListening, startListening, stopListening]);

  /**
   * Submit the current answer for evaluation
   */
  const handleSubmitAnswer = async () => {
    // Stop listening first
    stopListening();
    const finalAnswer = transcript.trim();

    if (!finalAnswer) {
      setError('Please provide an answer before submitting.');
      setPhase('idle');
      return;
    }

    setPhase('evaluating');
    setError('');

    try {
      const evaluation = await evaluateAnswer(currentQuestion, finalAnswer, domain);
      
      const response = {
        question: currentQuestion,
        answer: finalAnswer,
        score: evaluation.score || 5,
        feedback: evaluation.feedback || '',
        strengths: evaluation.strengths || [],
        improvements: evaluation.improvements || [],
      };

      setResponses(prev => [...prev, response]);
      setCurrentFeedback(response);
      setPhase('feedback');
    } catch (err) {
      console.error('Evaluation failed:', err);
      // Still save the response with a default score
      const response = {
        question: currentQuestion,
        answer: finalAnswer,
        score: 5,
        feedback: 'Evaluation unavailable — answer recorded.',
        strengths: [],
        improvements: [],
      };
      setResponses(prev => [...prev, response]);
      setCurrentFeedback(response);
      setPhase('feedback');
    }
  };

  /**
   * Move to the next question or finish the interview
   */
  const handleNext = () => {
    setCurrentFeedback(null);

    if (currentQIndex < totalQuestions - 1) {
      hasSpokenRef.current = false;
      resetTranscript();
      setCurrentQIndex(prev => prev + 1);
    } else {
      // Interview complete — navigate to report
      const allResponses = [...responses];
      if (currentFeedback && !responses.find(r => r.question === currentFeedback.question)) {
        allResponses.push(currentFeedback);
      }
      navigate('/report', {
        state: {
          domain,
          difficulty,
          responses: allResponses,
        },
      });
    }
  };

  /**
   * Skip the current question
   */
  const handleSkip = () => {
    stopListening();
    stopSpeaking();

    const response = {
      question: currentQuestion,
      answer: '(Skipped)',
      score: 0,
      feedback: 'Question was skipped.',
      strengths: [],
      improvements: [],
    };
    setResponses(prev => [...prev, response]);

    if (currentQIndex < totalQuestions - 1) {
      hasSpokenRef.current = false;
      resetTranscript();
      setCurrentQIndex(prev => prev + 1);
    } else {
      navigate('/report', {
        state: {
          domain,
          difficulty,
          responses: [...responses, response],
        },
      });
    }
  };

  /**
   * Replay the question via TTS
   */
  const replayQuestion = () => {
    if (!isSpeaking) {
      speak(currentQuestion);
    } else {
      stopSpeaking();
    }
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // ─── Browser support guard ───
  if (!isSpeechSupported) {
    return (
      <div className="session-page">
        <div className="unsupported-card glass-card">
          <AlertCircle size={48} />
          <h2>Browser Not Supported</h2>
          <p>
            Your browser doesn't support the Web Speech API.
            Please use <strong>Google Chrome</strong> for the best experience.
          </p>
          <button className="btn-primary" onClick={() => navigate('/setup')}>
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="session-page">
      {/* Header bar */}
      <div className="session-header glass-card">
        <div className="session-meta">
          <span className="badge">{domain}</span>
          <span className="badge">{difficulty}</span>
          <span className="badge">Q {currentQIndex + 1}/{totalQuestions}</span>
        </div>
        {phase === 'listening' && (
          <div className={`timer ${timeLeft < 30 ? 'warning' : ''}`}>
            <Clock size={20} />
            <span>{formatTime(timeLeft)}</span>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="progress-bar">
        <div
          className="progress-fill"
          style={{ width: `${((currentQIndex + 1) / totalQuestions) * 100}%` }}
        ></div>
      </div>

      {/* Main content area */}
      <div className="session-main glass-card">

        {/* ── Voice visualizer orb ── */}
        <div className="voice-visualizer-container">
          <div className={`voice-orb ${
            phase === 'speaking' ? 'orb-speaking' :
            phase === 'listening' && isListening ? 'orb-listening' :
            phase === 'evaluating' ? 'orb-evaluating' :
            'orb-idle'
          }`}>
            <div className="orb-ring ring-1"></div>
            <div className="orb-ring ring-2"></div>
            <div className="orb-ring ring-3"></div>
            <div className="orb-core">
              {phase === 'speaking' && <Volume2 size={32} />}
              {phase === 'listening' && <Mic size={32} />}
              {phase === 'evaluating' && <Loader size={32} className="spin" />}
              {phase === 'feedback' && <span className="orb-score">{currentFeedback?.score}</span>}
              {phase === 'idle' && <Mic size={32} />}
            </div>
          </div>
          <p className="voice-status">
            {phase === 'speaking' && 'AI is reading the question...'}
            {phase === 'listening' && (isListening ? '🔴 Listening — speak your answer...' : 'Mic paused. Click to resume.')}
            {phase === 'evaluating' && 'Evaluating your answer...'}
            {phase === 'feedback' && `Score: ${currentFeedback?.score}/10`}
            {phase === 'idle' && 'Ready to begin'}
          </p>
        </div>

        {/* ── Question display ── */}
        <div className="question-section">
          <div className="question-label">
            Question {currentQIndex + 1} of {totalQuestions}
          </div>
          <div className="question-text">
            {currentQuestion}
          </div>
          <button className="replay-btn" onClick={replayQuestion} title="Replay question">
            {isSpeaking ? <VolumeX size={18} /> : <Volume2 size={18} />}
            {isSpeaking ? 'Stop' : 'Replay'}
          </button>
        </div>

        {/* ── Live transcript area ── */}
        {(phase === 'listening' || phase === 'idle') && (
          <div className="transcript-area">
            <label className="transcript-label">Your Answer</label>
            <div className="transcript-box">
              {transcript && <span className="final-text">{transcript}</span>}
              {interimTranscript && <span className="interim-text"> {interimTranscript}</span>}
              {!transcript && !interimTranscript && (
                <span className="transcript-placeholder">
                  {isListening
                    ? 'Listening... Start speaking your answer.'
                    : 'Click the microphone to start answering.'}
                </span>
              )}
            </div>
          </div>
        )}

        {/* ── Feedback display ── */}
        {phase === 'feedback' && currentFeedback && (
          <div className="feedback-card">
            <div className="feedback-score">
              <span className="score-number">{currentFeedback.score}</span>
              <span className="score-max">/10</span>
            </div>
            <p className="feedback-text">{currentFeedback.feedback}</p>
            {currentFeedback.strengths.length > 0 && (
              <div className="feedback-section">
                <strong>✅ Strengths:</strong>
                <ul>{currentFeedback.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
              </div>
            )}
            {currentFeedback.improvements.length > 0 && (
              <div className="feedback-section">
                <strong>💡 Improve:</strong>
                <ul>{currentFeedback.improvements.map((s, i) => <li key={i}>{s}</li>)}</ul>
              </div>
            )}
          </div>
        )}

        {/* ── Error message ── */}
        {error && (
          <div className="error-message">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {/* ── Controls ── */}
        <div className="controls">
          {(phase === 'listening' || phase === 'idle') && (
            <>
              <button
                className={`mic-btn ${isListening ? 'active' : ''}`}
                onClick={toggleMic}
              >
                {isListening ? <MicOff size={22} /> : <Mic size={22} />}
                {isListening ? 'Stop Mic' : 'Start Mic'}
              </button>

              <button
                className="submit-btn"
                onClick={handleSubmitAnswer}
                disabled={!transcript.trim()}
              >
                <Send size={20} />
                Submit Answer
              </button>

              <button className="skip-btn" onClick={handleSkip}>
                <SkipForward size={20} />
                Skip
              </button>
            </>
          )}

          {phase === 'feedback' && (
            <button className="next-btn" onClick={handleNext}>
              {currentQIndex === totalQuestions - 1 ? '📊 View Report' : 'Next Question →'}
            </button>
          )}

          {phase === 'speaking' && (
            <button className="skip-btn" onClick={() => { stopSpeaking(); setPhase('listening'); startListening(); }}>
              <SkipForward size={20} />
              Skip to Answer
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default InterviewSession;
