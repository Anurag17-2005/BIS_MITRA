import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from './api';
import { mergeTranscriptParts } from './voiceMerge';
import { t } from './i18n';

function speechRecognitionCtor() {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

/**
 * Voice input: browser dictation by default (matches dashboard EN / हिन्दी).
 * Falls back to server STT only when Web Speech is unavailable.
 */
export default function VoiceMicInput({
  uiLang = 'en',
  disabled = false,
  onAppend,
  onError,
  className = '',
  embedded = false,
}) {
  const [state, setState] = useState('idle');
  const [statusMsg, setStatusMsg] = useState('');
  const speechRef = useRef(null);
  const speechBaseRef = useRef('');
  const recordingRef = useRef(false);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);

  const speechLang = uiLang === 'hi' ? 'hi-IN' : 'en-IN';
  const webSpeechOk = Boolean(speechRecognitionCtor());

  const stopSpeech = useCallback(() => {
    try { speechRef.current?.stop?.(); } catch { /* ignore */ }
    speechRef.current = null;
  }, []);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => () => {
    stopSpeech();
    stopStream();
  }, [stopSpeech, stopStream]);

  const sendRecording = useCallback(async () => {
    const parts = chunksRef.current.splice(0, chunksRef.current.length);
    if (!parts.length) return;
    setState('processing');
    try {
      const blob = new Blob(parts, { type: parts[0]?.type || 'audio/webm' });
      const languageMode = uiLang === 'hi' ? 'hi' : 'en';
      const result = await api.transcribeAudio(blob, { languageMode, highAccuracy: false });
      onAppend?.(result.text, { interim: false });
      setStatusMsg('');
    } catch (e) {
      const msg = e.message || t(uiLang, 'voiceFailed');
      setStatusMsg(msg);
      onError?.(msg);
    } finally {
      recordingRef.current = false;
      setState('idle');
    }
  }, [onAppend, onError, uiLang]);

  const startWebSpeech = useCallback(() => {
    const SR = speechRecognitionCtor();
    if (!SR) return false;
    speechBaseRef.current = '';
    const rec = new SR();
    rec.lang = speechLang;
    rec.interimResults = true;
    rec.continuous = true;
    rec.onresult = (event) => {
      let interim = '';
      let finalText = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const part = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += part;
        else interim += part;
      }
      if (interim) {
        onAppend?.(
          mergeTranscriptParts(speechBaseRef.current, interim, { interim: true }),
          { interim: true, replace: true },
        );
      }
      if (finalText) {
        speechBaseRef.current = mergeTranscriptParts(speechBaseRef.current, finalText);
        onAppend?.(speechBaseRef.current, { interim: false, replace: true });
      }
    };
    rec.onerror = (ev) => {
      if (ev.error === 'not-allowed') {
        setStatusMsg(t(uiLang, 'micDenied'));
        onError?.(t(uiLang, 'micDenied'));
      } else if (ev.error === 'no-speech') {
        setStatusMsg(t(uiLang, 'noSpeech'));
      } else {
        setStatusMsg(t(uiLang, 'voiceFailed'));
      }
      recordingRef.current = false;
      setState('idle');
    };
    rec.onend = () => {
      recordingRef.current = false;
      setState('idle');
    };
    speechRef.current = rec;
    recordingRef.current = true;
    setState('recording');
    rec.start();
    return true;
  }, [onAppend, onError, speechLang, uiLang]);

  const startMediaRecorder = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';
    const recorder = new MediaRecorder(stream, { mimeType: mime });
    chunksRef.current = [];
    recorder.ondataavailable = (ev) => {
      if (ev.data?.size) chunksRef.current.push(ev.data);
    };
    recorder.onstop = async () => {
      stopStream();
      await sendRecording();
    };
    recorder.start();
    recordingRef.current = true;
    setState('recording');
    speechRef.current = { stop: () => recorder.stop() };
  }, [sendRecording, stopStream]);

  const start = useCallback(async () => {
    if (disabled || state === 'processing') return;
    setStatusMsg('');
    if (webSpeechOk && startWebSpeech()) return;
    try {
      await startMediaRecorder();
    } catch (e) {
      if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
        setStatusMsg(t(uiLang, 'micDenied'));
        onError?.(t(uiLang, 'micDenied'));
        return;
      }
      onError?.(e.message || t(uiLang, 'voiceUnsupported'));
    }
  }, [disabled, webSpeechOk, startWebSpeech, startMediaRecorder, onError, uiLang, state]);

  const stop = useCallback(() => {
    recordingRef.current = false;
    stopSpeech();
    if (speechRef.current?.stop) {
      try { speechRef.current.stop(); } catch { /* ignore */ }
    }
    setState('idle');
  }, [stopSpeech]);

  const toggle = () => {
    if (state === 'recording') stop();
    else start();
  };

  const stateClass = state === 'recording' ? 'is-recording' : state === 'processing' ? 'is-processing' : '';
  const btnClass = embedded
    ? `bp-input-tool bp-voice-btn ${stateClass}`
    : `bp-voice-btn ${stateClass}`;

  if (embedded) {
    return (
      <>
        <button
          type="button"
          className={btnClass}
          disabled={disabled || state === 'processing'}
          title={state === 'recording' ? t(uiLang, 'voiceStop') : t(uiLang, 'voice')}
          onClick={toggle}
        >
          {state === 'processing' && <span className="bp-voice-spin" aria-hidden />}
          {state === 'recording' && <span className="bp-voice-pulse" aria-hidden />}
          <span>{state === 'recording' ? '⏹' : state === 'processing' ? '…' : '🎤'}</span>
        </button>
      </>
    );
  }

  return (
    <div className={`bp-voice-wrap ${className}`}>
      <button
        type="button"
        className={`bp-voice-btn ${stateClass}`}
        disabled={disabled || state === 'processing'}
        title={state === 'recording' ? t(uiLang, 'voiceStop') : t(uiLang, 'voice')}
        onClick={toggle}
      >
        {state === 'processing' && <span className="bp-voice-spin" aria-hidden />}
        {state === 'recording' && <span className="bp-voice-pulse" aria-hidden />}
        <span>{state === 'recording' ? '⏹' : state === 'processing' ? '…' : '🎤'}</span>
      </button>
      {statusMsg && <small className="bp-voice-status">{statusMsg}</small>}
    </div>
  );
}
