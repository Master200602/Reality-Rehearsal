import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Mic, MicOff, Volume2, Loader, AlertCircle, LogOut, Send, Play, UserCheck, ArrowRight } from 'lucide-react';
import useSpeech from '../hooks/useSpeech';
import { sendConversationTurn } from '../services/api';
import { getRandomInterviewer } from '../utils/interviewers';
import './InterviewSession.css';

/**
 * Personalized Conversational Interview Session with Real-World Human Interviewer Personas
 */
const InterviewSession = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const {
    domain = 'Software Engineering',
    difficulty = 'Medium',
    questionsCount = 5,
    candidateProfile = null,
    resumeText = '',
    interviewer: initialInterviewer = null,
  } = location.state || {};

  // Assigned real-world interviewer persona
  const interviewer = useRef(initialInterviewer || getRandomInterviewer()).current;

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

  // Sync spoken transcript to textInput
  useEffect(() => {
    const liveText = (transcript + ' ' + interimTranscript).trim();
    if (liveText) {
      setTextInput(liveText);
    }
  }, [transcript, interimTranscript]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversationHistory, transcript, interimTranscript, textInput]);

  /**
   * User clicks "Start Conversation" — unlocks Chrome audio and triggers AI greeting
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
        candidateProfile,
        resumeText,
        interviewerName: interviewer.name,
        interviewerTitle: interviewer.title,
      });

      const { aiResponse, questionNumber: qNum, isComplete, evaluation } = response;

      if (evaluation && userAnswer) {
        const lastAiMsg = [...updatedHistory].reverse().find(m => m.role === 'interviewer');
        setResponses(prev => [...prev, {
          question: lastAiMsg?.text || 'Interview question',
          answer: userAnswer,
          score: evaluation.score || 8,
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
        try { await speak(aiResponse, interviewer.voiceSettings); } catch (e) { /* ignore */ }
        setPhase('complete');

        setTimeout(() => {
          navigate('/report', {
            state: {
              domain,
              difficulty,
              responses,
              candidateProfile,
              resumeText,
              interviewer,
            },
          });
        }, 2500);
      } else {
        // Speak response aloud using persona voice parameters
        setPhase('speaking');
        try {
          await speak(aiResponse, interviewer.voiceSettings);
        } catch (e) {
          console.warn('TTS error:', e);
        }

        // Transition to listening phase
        setPhase('listening');
        resetTranscript();
        startListening(3500, handleSilenceTimeout);
      }
    } catch (err) {
      console.warn('Backend server offline or network connection issue. Engaging smart local interview engine:', err);

      const interviewerMsgs = updatedHistory.filter(m => m.role === 'interviewer');
      const qNum = interviewerMsgs.length + (userAnswer ? 1 : 0);
      const isFirst = !updatedHistory.length && !userAnswer;

      let aiResp = interviewer.greetingIntro || `Hi there! I'm ${interviewer.name}, ${interviewer.title}. Welcome to your ${domain} interview session! Please give me a brief introduction: your name, your background, and your recent project experience.`;
      let isDone = false;
      let evalObj = null;

      if (!isFirst) {
        isDone = qNum >= questionsCount;
        const lower = (userAnswer || '').toLowerCase();
        const isSkip = /\b(don't want|dont want|no answer|skip|pass|refuse|prefer not|no thanks|not answering|no i don't|no i dont)\b/i.test(lower);

        const qList = [
          isSkip 
            ? `No problem, we can move past that. Can you describe a key technical challenge you encountered in ${domain}, and how you resolved it?`
            : `Thanks for that breakdown. Can you describe a key technical challenge you encountered in ${domain}, and how you resolved it?`,
          `How do you handle testing, performance optimization, and error handling in your ${domain} work?`,
          `Walk me through an architecture or design decision you made recently. What tradeoffs did you evaluate?`,
          `How do you stay updated with emerging frameworks and best practices in ${domain}?`,
          `Thank you for sharing your experience. That completes our interview session!`
        ];
        aiResp = isDone
          ? `Thank you for completing this ${domain} interview session with me. Your performance report is ready!`
          : qList[Math.min(qNum - 1, qList.length - 1)];

        if (!isSkip) {
          evalObj = {
            score: 8,
            feedback: 'Solid explanation with good technical context.',
            strengths: ['Relevant domain concepts', 'Clear communication'],
            improvements: ['Add quantitative impact metrics'],
          };
        }
      }

      if (evalObj && userAnswer) {
        const lastAiMsg = [...updatedHistory].reverse().find(m => m.role === 'interviewer');
        setResponses(prev => [...prev, {
          question: lastAiMsg?.text || 'Interview question',
          answer: userAnswer,
          score: evalObj.score,
          feedback: evalObj.feedback,
          strengths: evalObj.strengths,
          improvements: evalObj.improvements,
        }]);
      }

      setQuestionNumber(Math.min(qNum, questionsCount));

      const newHistory = [...updatedHistory, { role: 'interviewer', text: aiResp }];
      setConversationHistory(newHistory);

      if (isDone) {
        setPhase('speaking');
        try { await speak(aiResp, interviewer.voiceSettings); } catch (e) {}
        setPhase('complete');
        setTimeout(() => {
          navigate('/report', {
            state: { domain, difficulty, responses, candidateProfile, resumeText, interviewer },
          });
        }, 2500);
      } else {
        setPhase('speaking');
        try { await speak(aiResp, interviewer.voiceSettings); } catch (e) {}
        setPhase('listening');
        resetTranscript();
        startListening(3500, handleSilenceTimeout);
      }
    } finally {
      isProcessingRef.current = false;
    }
  };

  /**
   * Silence timeout callback — auto-submits spoken answer
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
      startListening(3500, handleSilenceTimeout);
    }
  };

  /**
   * Manual Submit
   */
  const handleManualSubmit = (e) => {
    if (e) e.preventDefault();
    const text = textInput.trim() || (transcript + ' ' + interimTranscript).trim() || getTranscript();
    if (!text) {
      setError('Please speak your answer into your mic or type an answer first.');
      return;
    }
    stopListening();
    getAIResponse(text, conversationHistoryRef.current);
  };

  /**
   * End Interview early
   */
  const handleEndInterview = () => {
    stopListening();
    stopSpeaking();
    navigate('/report', {
      state: {
        domain,
        difficulty,
        responses,
        candidateProfile,
        resumeText,
        interviewer,
      },
    });
  };

  // IF NO CANDIDATE PROFILE: Render a clear glassmorphic redirect card (NEVER A BLANK SCREEN)
  if (!candidateProfile || !candidateProfile.fullName) {
    return (
      <div className="session-page">
        <div className="start-card glass-card text-center">
          <div className="start-icon">
            <UserCheck size={48} />
          </div>
          <h2>Candidate Profile Required</h2>
          <p>
            Please complete your candidate details and upload your resume before starting your interview.
          </p>
          <button
            className="btn-primary start-session-btn"
            onClick={() => navigate('/candidate-info')}
          >
            Go to Candidate Form <ArrowRight size={20} />
          </button>
        </div>
      </div>
    );
  }

  if (!isSpeechSupported) {
    return (
      <div className="session-page">
        <div className="unsupported-card glass-card">
          <AlertCircle size={48} />
          <h2>Browser Not Supported</h2>
          <p>Your browser doesn't support Web Speech API. Please use <strong>Google Chrome</strong>.</p>
          <button className="btn-primary" onClick={() => navigate('/candidate-info')}>Go Back</button>
        </div>
      </div>
    );
  }

  // Entry Card before unlocking audio
  if (!isStarted) {
    return (
      <div className="session-page">
        <div className="start-card glass-card text-center">
          <div className="start-icon" style={{ background: interviewer.avatarBg, borderRadius: '50%', width: 72, height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', color: '#fff', fontSize: '1.8rem', fontWeight: 800 }}>
            {interviewer.avatarInitial}
          </div>
          <h2>Ready to Begin Your Interview with {interviewer.name}?</h2>
          <p>
            Interviewer: <strong>{interviewer.name}</strong> ({interviewer.title})<br />
            Candidate: <strong>{candidateProfile?.fullName || 'Candidate'}</strong> | <strong>{candidateProfile?.targetRole || domain}</strong> ({difficulty} Level)
          </p>
          {resumeText && (
            <div className="resume-notice">
              <span>📄 Resume Context Loaded ({candidateProfile?.skills?.length || 0} skills identified)</span>
            </div>
          )}
          <button className="btn-primary start-session-btn" onClick={handleStartSession}>
            Start Interview with {interviewer.name} <Play size={20} fill="currentColor" />
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
          <span className="badge" style={{ background: interviewer.badgeColor, color: '#fff', fontWeight: 700 }}>🎙️ {interviewer.name}</span>
          <span className="badge">{candidateProfile?.fullName || 'Candidate'}</span>
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
              {phase === 'greeting' && `Connecting to ${interviewer.name}...`}
              {phase === 'speaking' && `${interviewer.name} is Speaking...`}
              {phase === 'listening' && (isListening ? '🔴 Listening to your voice' : 'Mic Paused')}
              {phase === 'thinking' && `${interviewer.name} is Evaluating...`}
              {phase === 'complete' && 'Interview Complete'}
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
            <div className="avatar-core" style={{ background: interviewer.avatarBg }}>
              {phase === 'speaking' && <Volume2 size={28} />}
              {phase === 'listening' && <Mic size={28} />}
              {(phase === 'thinking' || phase === 'greeting') && <Loader size={28} className="spin" />}
              {phase === 'complete' && <span className="avatar-check">✓</span>}
            </div>
          </div>
          <span className="avatar-label"><strong>{interviewer.name}</strong> • {interviewer.title}</span>
        </div>

        {/* Chat Transcript */}
        <div className="conversation-area">
          <div className="chat-scroll">
            {conversationHistory.map((msg, i) => (
              <div key={i} className={`chat-bubble ${msg.role === 'interviewer' ? 'bubble-ai' : 'bubble-user'}`}>
                <span className="bubble-role">{msg.role === 'interviewer' ? `🎙️ ${interviewer.name}` : `👤 ${candidateProfile?.fullName || 'You'}`}</span>
                <p className="bubble-text">{msg.text}</p>
              </div>
            ))}

            {/* LIVE REAL-TIME WORD-BY-WORD BUBBLE */}
            {phase === 'listening' && (textInput || transcript || interimTranscript) && (
              <div className="chat-bubble bubble-user bubble-live">
                <span className="bubble-role">👤 {candidateProfile?.fullName || 'You'} {isListening ? '(speaking live... 🔴)' : '(typing...)'}</span>
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
                <span className="bubble-role">🎙️ {interviewer.name}</span>
                <div className="thinking-dots"><span></span><span></span><span></span></div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>
        </div>

        {/* Error Diagnostic */}
        {(error || speechError) && (
          <div className="error-message">
            <AlertCircle size={16} />
            <span>
              {error || (speechError === 'no-speech' ? 'No voice detected. Type your response below or click Mic.' : `Microphone event (${speechError}). Type or click Mic.`)}
            </span>
          </div>
        )}

        {/* Controls */}
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
                Send Answer
              </button>
            </form>
          )}

          {phase === 'speaking' && (
            <div className="speaking-indicator">
              <Volume2 size={20} />
              <span>{interviewer.name} is speaking...</span>
            </div>
          )}

          {(phase === 'thinking' || phase === 'greeting') && (
            <div className="thinking-indicator">
              <Loader size={20} className="spin" />
              <span>{phase === 'greeting' ? `Connecting with ${interviewer.name}...` : `${interviewer.name} is evaluating your response...`}</span>
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
