import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Custom hook for Web Speech API — Speech-to-Text + Text-to-Speech
 * 
 * Order of Function Declarations:
 * 1. resetSilenceTimer
 * 2. killExistingRecognition
 * 3. initRecognition
 * 4. startListening (depends on initRecognition)
 * 5. stopListening
 * 6. speak / stopSpeaking
 */
const useSpeech = () => {
  // ─── Speech-to-Text state ───
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState('');

  // ─── Text-to-Speech state ───
  const [isSpeaking, setIsSpeaking] = useState(false);

  // ─── Refs ───
  const recognitionRef = useRef(null);
  const isAbortedRef = useRef(false);
  const finalTranscriptRef = useRef('');
  const shouldListenRef = useRef(false);
  const silenceTimerRef = useRef(null);
  const silenceCallbackRef = useRef(null);
  const silenceTimeoutMsRef = useRef(3000);
  const hasSpokenWordsRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const ttsKeepAliveRef = useRef(null);

  // ─── Browser support check ───
  const SpeechRecognition = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
  const isSpeechSupported = !!SpeechRecognition && typeof window !== 'undefined' && !!window.speechSynthesis;

  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);

  /**
   * 1. Reset silence timer
   */
  const resetSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }

    if (hasSpokenWordsRef.current && silenceCallbackRef.current) {
      silenceTimerRef.current = setTimeout(() => {
        if (silenceCallbackRef.current && shouldListenRef.current) {
          console.log('[Speech] Silence detected, triggering callback...');
          silenceCallbackRef.current();
        }
      }, silenceTimeoutMsRef.current);
    }
  }, []);

  /**
   * 2. Safely stop existing recognition instance
   */
  const killExistingRecognition = useCallback(() => {
    shouldListenRef.current = false;
    isAbortedRef.current = true;
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onstart = null;
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.abort();
      } catch (e) {
        // ignore
      }
      recognitionRef.current = null;
    }
  }, []);

  /**
   * 3. Initialize SpeechRecognition instance
   */
  const initRecognition = useCallback(() => {
    if (!SpeechRecognition) return null;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      console.log('[Speech] Microphone active and listening...');
      setIsListening(true);
      setSpeechError('');
    };

    recognition.onresult = (event) => {
      let final = '';
      let interim = '';

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript + ' ';
        } else {
          interim += result[0].transcript;
        }
      }

      const combinedFinal = final.trim();
      finalTranscriptRef.current = combinedFinal;
      setTranscript(combinedFinal);
      setInterimTranscript(interim);

      if (combinedFinal || interim) {
        hasSpokenWordsRef.current = true;
      }

      resetSilenceTimer();
    };

    recognition.onerror = (event) => {
      console.warn('[Speech] Recognition error:', event.error);
      setSpeechError(event.error);
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setIsListening(false);
        shouldListenRef.current = false;
      }
    };

    recognition.onend = () => {
      console.log('[Speech] Recognition ended.');
      if (shouldListenRef.current && !isAbortedRef.current) {
        try {
          recognition.start();
        } catch (e) {
          // Already running
        }
      } else {
        setIsListening(false);
      }
    };

    return recognition;
  }, [SpeechRecognition, resetSilenceTimer]);

  /**
   * 4. Start listening for speech (depends on initRecognition and killExistingRecognition)
   */
  const startListening = useCallback((silenceTimeoutMs = 3000, onSilenceTimeout = null) => {
    if (!SpeechRecognition) {
      console.error('[Speech] SpeechRecognition not supported');
      return;
    }

    killExistingRecognition();

    silenceTimeoutMsRef.current = silenceTimeoutMs;
    silenceCallbackRef.current = onSilenceTimeout;
    hasSpokenWordsRef.current = false;
    isAbortedRef.current = false;
    shouldListenRef.current = true;

    finalTranscriptRef.current = '';
    setTranscript('');
    setInterimTranscript('');
    setSpeechError('');

    const recognition = initRecognition();
    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (e) {
      console.error('[Speech] Failed to start recognition:', e);
      setIsListening(false);
      shouldListenRef.current = false;
    }
  }, [SpeechRecognition, initRecognition, killExistingRecognition]);

  /**
   * 5. Stop listening
   */
  const stopListening = useCallback(() => {
    killExistingRecognition();
    setIsListening(false);
    setInterimTranscript('');
  }, [killExistingRecognition]);

  const resetTranscript = useCallback(() => {
    finalTranscriptRef.current = '';
    setTranscript('');
    setInterimTranscript('');
    hasSpokenWordsRef.current = false;
  }, []);

  const getTranscript = useCallback(() => {
    return (finalTranscriptRef.current + ' ' + (interimTranscript || '')).trim();
  }, [interimTranscript]);

  /**
   * 6. Speak text aloud using SpeechSynthesis
   */
  const speak = useCallback((text) => {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !window.speechSynthesis || !text) {
        resolve();
        return;
      }

      window.speechSynthesis.cancel();
      if (ttsKeepAliveRef.current) clearInterval(ttsKeepAliveRef.current);

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      const voices = window.speechSynthesis.getVoices();
      const englishVoice = voices.find(v => 
        v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Natural'))
      ) || voices.find(v => v.lang.startsWith('en'));
      
      if (englishVoice) {
        utterance.voice = englishVoice;
      }

      let isFinished = false;
      const finish = () => {
        if (!isFinished) {
          isFinished = true;
          if (ttsKeepAliveRef.current) clearInterval(ttsKeepAliveRef.current);
          setIsSpeaking(false);
          resolve();
        }
      };

      const wordCount = text.split(/\s+/).length;
      const maxTimeMs = Math.max(4000, (wordCount / 2.5) * 1000 + 3000);
      const safetyTimer = setTimeout(() => {
        console.warn('[Speech] TTS safety timeout triggered');
        window.speechSynthesis.cancel();
        finish();
      }, maxTimeMs);

      utterance.onstart = () => {
        setIsSpeaking(true);
        ttsKeepAliveRef.current = setInterval(() => {
          if (window.speechSynthesis.speaking) {
            window.speechSynthesis.pause();
            window.speechSynthesis.resume();
          }
        }, 5000);
      };

      utterance.onend = () => {
        clearTimeout(safetyTimer);
        finish();
      };

      utterance.onerror = (e) => {
        console.warn('[Speech] TTS error:', e);
        clearTimeout(safetyTimer);
        finish();
      };

      try {
        window.speechSynthesis.speak(utterance);
      } catch (e) {
        console.error('[Speech] TTS speak exception:', e);
        clearTimeout(safetyTimer);
        finish();
      }
    });
  }, []);

  const stopSpeaking = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.speechSynthesis?.cancel();
    }
    if (ttsKeepAliveRef.current) clearInterval(ttsKeepAliveRef.current);
    setIsSpeaking(false);
  }, []);

  useEffect(() => {
    return () => {
      killExistingRecognition();
      if (ttsKeepAliveRef.current) clearInterval(ttsKeepAliveRef.current);
      if (typeof window !== 'undefined') {
        window.speechSynthesis?.cancel();
      }
    };
  }, [killExistingRecognition]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
  }, []);

  return {
    transcript,
    interimTranscript,
    isListening,
    speechError,
    startListening,
    stopListening,
    resetTranscript,
    getTranscript,
    isSpeaking,
    speak,
    stopSpeaking,
    isSpeechSupported,
  };
};

export default useSpeech;
