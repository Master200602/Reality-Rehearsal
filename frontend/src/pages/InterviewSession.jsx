import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Mic, MicOff, Volume2, Loader, AlertCircle, LogOut, Send, Play } from 'lucide-react';
import useSpeech from '../hooks/useSpeech';
import { sendConversationTurn } from '../services/api';
import './InterviewSession.css';

/**
 * Conversational AI Interview Session — Hybrid Voice & Text
 */
const InterviewSession = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    domain = 'General',
    difficulty = 'Medium',
    questionsCount = 5,
  } = location.state || {};

  // ─── State ───
  const [isStarted, setIsStarted] = useState(false);
  const [phase, setPhase] = useState('idle'); // idle | greeting | speaking | listening | thinking | complete
  const [conversationHistory, setConversationHistory] = useState([]);
  const [responses, setResponses] = useState([]);
  const [questionNumber, setQuestionNumber] = useState(0);
  const [error, setError] = useState('');
  const [textInput, setTextInput] = useState('');

  // ─── Speech hook ───
  const {
    transcript,
    interimTranscript,
    isListening,
    speechError,
    startListening,
    stopListening,
    resetTranscript,
    getTranscript,
    speak,
    stopSpeaking,
    isSpeechSupported,
  } = useSpeech();

  // ─── Refs ───
  const chatEndRef = useRef(null);
  const isProcessingRef = useRef(false);
  const conversationHistoryRef = useRef([]);

  useEffect(() => {
    conversationHistoryRef.current = conversationHistory;
  }, [conversationHistory]);

  // ─── Live Sync Spoken Speech to textInput ───
  useEffect(() => {
    const liveText = (transcript + ' ' + interimTranscript).trim();
    if (liveText) {
      setTextInput(liveText);
    }
  }, [transcript, interimTranscript]);

  // ─── Auto-scroll chat ───
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversationHistory, transcript, interimTranscript, textInput]);

  /**
   * User clicks "Start Conversation" — unlocks Chrome Media & starts AI greeting
   */
  const handleStartSession = async () => {
    setIsStarted(true);
    try {
      if (navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(t => t.stop());
      }
    } catch (e) {
      console.warn('Mic permission error:', e);
    }
    getAIResponse('', []);
  };

  /**
   * Core conversation turn handler
   */
  const getAIResponse = async (userAnswer, history) => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    let updatedHistory = [...history];
    if (userAnswer) {
      updatedHistory = [...history, { role: 'candidate', text: userAnswer }];
      setConversationHistory(updatedHistory);
    }

    setPhase('thinking');
    setError('');
    setTextInput('');
    resetTranscript();

    try {
      const response = await sendConversationTurn({
        domain,
        difficulty,
        totalQuestions: questionsCount,
        conversationHistory: updatedHistory,
        userAnswer: userAnswer || '',
      });

      const { aiResponse, questionNumber: qNum, isComplete, evaluation } = response;

      if (evaluation && userAnswer) {
        const lastAiMsg = [...updatedHistory].reverse().find(m => m.role === 'interviewer');
        setResponses(prev => [...prev, {
          question: lastAiMsg?.text || 'Interview question',
          answer: userAnswer,
          score: evaluation.score || 5,
          feedback: evaluation.feedback || '',
          strengths: evaluation.strengths || [],
          improvements: evaluation.improvements || [],
        }]);
      }

      setQuestionNumber(qNum || 0);

      const newHistory = [...updatedHistory, { role: 'interviewer', text: aiResponse }];
      setConversationHistory(newHistory);

      if (isComplete) {
        setPhase('speaking');
        try { await speak(aiResponse); } catch (e) { /* ignore */ }
        setPhase('complete');

        setTimeout(() => {
          navigate('/report', {
            state: { domain, difficulty, responses },
          });
        }, 2000);
      } else {
        // Speak AI response
        setPhase('speaking');
        try {
          await speak(aiResponse);
        } catch (e) {
          console.warn('TTS error:', e);
        }

        // Transition to listening
        setPhase('listening');
        resetTranscript();
        startListening(4000, handleSilenceTimeout);
      }
    } catch (err) {
      console.error('Conversation turn failed:', err);
      setError('Failed to connect to AI server. Type or click "Start Mic" to try again.');
      setPhase('listening');
    } finally {
      isProcessingRef.current = false;
    }
  };

  /**
   * Silence timeout callback
   */
  const handleSilenceTimeout = () => {
    const text = textInput.trim() || (transcript + ' ' + interimTranscript).trim() || getTranscript();
    if (text) {
      stopListening();
      getAIResponse(text, conversationHistoryRef.current);
    }
  };

  /**
   * Manual Start/Pause Mic
   */
  const handleToggleMic = () => {
    if (isListening) {
      stopListening();
    } else {
      resetTranscript();
      startListening(4000, handleSilenceTimeout);
    }
  };

  /**
   * Manual Submit (Voice or Typed)
   */
  const handleManualSubmit = (e) => {
    if (e) e.preventDefault();
    const text = textInput.trim() || (transcript + ' ' + interimTranscript).trim() || getTranscript();
    if (!text) {
      setError('Please speak your answer or type it in the input box.');
      return;
    }
    stopListening();
    getAIResponse(text, conversationHistoryRef.current);
  };

  /**
   * End Interview
   */
  const handleEndInterview = () => {
    stopListening();
    stopSpeaking();
    navigate('/report', {
      state: { domain, difficulty, responses },
    });
  };

  if (!isSpeechSupported) {
    return (
      <div className="session-page">
        <div className="unsupported-card glass-card">
          <AlertCircle size={48} />
          <h2>Browser Not Supported</h2>
          <p>Your browser doesn't support Web Speech API. Please use <strong>Google Chrome</strong>.</p>
          <button className="btn-primary" onClick={() => navigate('/setup')}>Go Back</button>
        </div>
      </div>
    );
  }

  // Initial user gesture screen to unlock Chrome media & microphone
  if (!isStarted) {
    return (
      <div className="session-page">
        <div className="start-card glass-card text-center">
          <div className="start-icon">
            <Volume2 size={48} />
          </div>
          <h2>Ready to Begin Your Interview?</h2>
          <p>
            You will be interviewing for <strong>{domain}</strong> ({difficulty} level).
            The AI interviewer will greet you and speak questions aloud.
          </p>
          <button className="btn-primary start-session-btn" onClick={handleStartSession}>
            Start Conversation <Play size={20} fill="currentColor" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="session-page">
      {/* Header */}
      <div className="session-header glass-card">
        <div className="session-meta">
          <span className="badge">{domain}</span>
          <span className="badge">{difficulty}</span>
          {questionNumber > 0 && (
            <span className="badge">Q {Math.min(questionNumber, questionsCount)}/{questionsCount}</span>
          )}
        </div>
        <div className="header-right">
          <div className={`status-indicator ${phase}`}>
            <span className="status-dot"></span>
            <span className="status-text">
              {phase === 'greeting' && 'Starting...'}
              {phase === 'speaking' && 'Interviewer Speaking'}
              {phase === 'listening' && (isListening ? '🔴 Listening' : 'Ready for Answer')}
              {phase === 'thinking' && 'Analyzing...'}
              {phase === 'complete' && 'Complete'}
            </span>
          </div>
          <button className="end-btn" onClick={handleEndInterview} title="End Interview">
            <LogOut size={18} />
          </button>
        </div>
      </div>

      {/* Progress */}
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${(questionNumber / questionsCount) * 100}%` }}></div>
      </div>

      {/* Main Content */}
      <div className="session-main">
        {/* Avatar */}
        <div className="avatar-section">
          <div className={`ai-avatar ${
            phase === 'speaking' ? 'avatar-speaking' :
            phase === 'listening' && isListening ? 'avatar-listening' :
            phase === 'thinking' || phase === 'greeting' ? 'avatar-thinking' :
            'avatar-idle'
          }`}>
            <div className="avatar-ring ring-1"></div>
            <div className="avatar-ring ring-2"></div>
            <div className="avatar-ring ring-3"></div>
            <div className="avatar-core">
              {phase === 'speaking' && <Volume2 size={28} />}
              {phase === 'listening' && <Mic size={28} />}
              {(phase === 'thinking' || phase === 'greeting') && <Loader size={28} className="spin" />}
              {phase === 'complete' && <span className="avatar-check">✓</span>}
            </div>
          </div>
          <span className="avatar-label">AI Interviewer</span>
        </div>

        {/* Chat Transcript */}
        <div className="conversation-area">
          <div className="chat-scroll">
            {conversationHistory.map((msg, i) => (
              <div key={i} className={`chat-bubble ${msg.role === 'interviewer' ? 'bubble-ai' : 'bubble-user'}`}>
                <span className="bubble-role">{msg.role === 'interviewer' ? '🎙️ Interviewer' : '👤 You'}</span>
                <p className="bubble-text">{msg.text}</p>
              </div>
            ))}

            {/* LIVE REAL-TIME BUBBLE */}
            {phase === 'listening' && (textInput || transcript || interimTranscript) && (
              <div className="chat-bubble bubble-user bubble-live">
                <span className="bubble-role">👤 You {isListening ? '(speaking live... 🔴)' : '(typing...)'}</span>
                <p className="bubble-text">
                  {textInput || (
                    <>
                      {transcript && <span className="final-word">{transcript} </span>}
                      {interimTranscript && <span className="interim-word">{interimTranscript}</span>}
                    </>
                  )}
                </p>
              </div>
            )}

            {phase === 'thinking' && (
              <div className="chat-bubble bubble-ai bubble-thinking">
                <span className="bubble-role">🎙️ Interviewer</span>
                <div className="thinking-dots"><span></span><span></span><span></span></div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>
        </div>

        {/* Error or Mic Diagnostic */}
        {(error || speechError) && (
          <div className="error-message">
            <AlertCircle size={16} />
            <span>
              {error || (speechError === 'no-speech' ? 'No voice detected. You can type your answer below or click Mic.' : `Microphone error (${speechError}). You can type below.`)}
            </span>
          </div>
        )}

        {/* Voice & Text Hybrid Controls */}
        <div className="controls">
          {phase === 'listening' && (
            <form onSubmit={handleManualSubmit} className="input-form">
              <button
                type="button"
                className={`mic-btn ${isListening ? 'active' : ''}`}
                onClick={handleToggleMic}
                title={isListening ? 'Pause Mic' : 'Start Mic'}
              >
                {isListening ? <MicOff size={20} /> : <Mic size={20} />}
                <span>{isListening ? 'Listening...' : 'Mic'}</span>
              </button>

              <input
                type="text"
                className="chat-input"
                placeholder={isListening ? 'Speak or type your answer here...' : 'Type or speak your answer...'}
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
              />

              <button
                type="submit"
                className="done-btn"
                disabled={!textInput.trim()}
              >
                <Send size={18} />
                Send
              </button>
            </form>
          )}

          {phase === 'speaking' && (
            <div className="speaking-indicator">
              <Volume2 size={20} />
              <span>Interviewer is speaking...</span>
            </div>
          )}

          {(phase === 'thinking' || phase === 'greeting') && (
            <div className="thinking-indicator">
              <Loader size={20} className="spin" />
              <span>{phase === 'greeting' ? 'Starting interview...' : 'Analyzing your answer...'}</span>
            </div>
          )}

          {phase === 'complete' && (
            <div className="complete-indicator">
              <span>✅ Interview complete! Redirecting to report...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InterviewSession;
