import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Custom hook for Web Speech API — Speech-to-Text + Text-to-Speech
 * 
 * Speech-to-Text: Uses SpeechRecognition (with webkit prefix for Chrome)
 * Text-to-Speech: Uses SpeechSynthesis
 */
const useSpeech = () => {
  // ─── Speech-to-Text state ───
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);

  // ─── Text-to-Speech state ───
  const [isSpeaking, setIsSpeaking] = useState(false);

  // ─── Refs ───
  const recognitionRef = useRef(null);
  const finalTranscriptRef = useRef('');
  const shouldListenRef = useRef(false);

  // ─── Browser support check ───
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const isSpeechSupported = !!SpeechRecognition && !!window.speechSynthesis;

  /**
   * Initialize SpeechRecognition instance
   */
  const initRecognition = useCallback(() => {
    if (!SpeechRecognition) return null;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let interim = '';
      let final = '';

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript + ' ';
        } else {
          interim += result[0].transcript;
        }
      }

      if (final) {
        finalTranscriptRef.current += final;
        setTranscript(finalTranscriptRef.current.trim());
      }
      setInterimTranscript(interim);
    };

    recognition.onerror = (event) => {
      console.warn('[Speech] Recognition error:', event.error);
      if (event.error === 'not-allowed') {
        setIsListening(false);
        shouldListenRef.current = false;
      }
      // For 'network' or 'aborted' errors, let onend handle restart
    };

    recognition.onend = () => {
      // Auto-restart if we should still be listening
      // (recognition can stop unexpectedly after silence)
      if (shouldListenRef.current && recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch (e) {
          // Already started — ignore
        }
      } else {
        setIsListening(false);
      }
    };

    return recognition;
  }, [SpeechRecognition]);

  /**
   * Start listening for speech
   */
  const startListening = useCallback(() => {
    if (!SpeechRecognition) {
      console.error('[Speech] SpeechRecognition not supported in this browser');
      return;
    }

    // Reset transcripts for a new listening session
    finalTranscriptRef.current = '';
    setTranscript('');
    setInterimTranscript('');

    // Create a fresh recognition instance
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch (e) { /* ignore */ }
    }
    recognitionRef.current = initRecognition();

    shouldListenRef.current = true;
    setIsListening(true);

    try {
      recognitionRef.current.start();
    } catch (e) {
      console.error('[Speech] Failed to start recognition:', e);
      setIsListening(false);
      shouldListenRef.current = false;
    }
  }, [SpeechRecognition, initRecognition]);

  /**
   * Stop listening for speech
   */
  const stopListening = useCallback(() => {
    shouldListenRef.current = false;
    setIsListening(false);
    setInterimTranscript('');

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Already stopped
      }
    }
  }, []);

  /**
   * Reset transcript state (for moving to next question)
   */
  const resetTranscript = useCallback(() => {
    finalTranscriptRef.current = '';
    setTranscript('');
    setInterimTranscript('');
  }, []);

  /**
   * Speak text aloud using SpeechSynthesis
   * Returns a promise that resolves when speaking is done
   */
  const speak = useCallback((text) => {
    return new Promise((resolve, reject) => {
      if (!window.speechSynthesis) {
        reject(new Error('SpeechSynthesis not supported'));
        return;
      }

      // Cancel any ongoing speech
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      // Try to find a good English voice
      const voices = window.speechSynthesis.getVoices();
      const englishVoice = voices.find(v => 
        v.lang.startsWith('en') && v.name.includes('Google')
      ) || voices.find(v => v.lang.startsWith('en'));
      
      if (englishVoice) {
        utterance.voice = englishVoice;
      }

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => {
        setIsSpeaking(false);
        resolve();
      };
      utterance.onerror = (e) => {
        setIsSpeaking(false);
        // 'interrupted' is normal when we cancel, don't reject for it
        if (e.error !== 'interrupted') {
          reject(e);
        } else {
          resolve();
        }
      };

      window.speechSynthesis.speak(utterance);
    });
  }, []);

  /**
   * Stop speaking immediately
   */
  const stopSpeaking = useCallback(() => {
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      shouldListenRef.current = false;
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch (e) { /* ignore */ }
      }
      window.speechSynthesis?.cancel();
    };
  }, []);

  // Pre-load voices (Chrome loads them async)
  useEffect(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
  }, []);

  return {
    // Speech-to-Text
    transcript,
    interimTranscript,
    isListening,
    startListening,
    stopListening,
    resetTranscript,

    // Text-to-Speech
    isSpeaking,
    speak,
    stopSpeaking,

    // Support
    isSpeechSupported,
  };
};

export default useSpeech;
