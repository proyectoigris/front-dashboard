/**
 * Voz (prototipo) con Web Speech API del navegador.
 * OJO: el reconocimiento en Chrome usa servicios en la nube (requiere internet).
 * Para la Raspberry Pi sin conexión se reemplazará por STT local (p. ej. Vosk /
 * whisper.cpp) y TTS local (p. ej. Piper) expuestos por el backend.
 */

type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

const Ctor = (window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition })
  .SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: new () => Recognition }).webkitSpeechRecognition;

export const speechInputSupported = !!Ctor;
export const speechOutputSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

export function listen(handlers: {
  onPartial: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (msg: string) => void;
  onEnd: () => void;
}): () => void {
  if (!Ctor) {
    handlers.onError('Este navegador no soporta reconocimiento de voz.');
    handlers.onEnd();
    return () => {};
  }
  const rec = new Ctor();
  rec.lang = 'es-CL';
  rec.interimResults = true;
  rec.continuous = false;
  rec.onresult = (e) => {
    let text = '';
    let final = false;
    for (let i = 0; i < e.results.length; i++) {
      text += e.results[i][0].transcript;
      if (e.results[i].isFinal) final = true;
    }
    if (final) handlers.onFinal(text.trim());
    else handlers.onPartial(text);
  };
  rec.onerror = (e) =>
    handlers.onError(e.error === 'not-allowed' ? 'Permiso de micrófono denegado.' : e.error === 'network' ? 'El reconocimiento de voz requiere conexión.' : `Error de voz: ${e.error}`);
  rec.onend = handlers.onEnd;
  rec.start();
  return () => rec.stop();
}

export function speak(text: string, onEnd: () => void) {
  if (!speechOutputSupported) return onEnd();
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/±/g, 'más menos').replace(/%/g, ' por ciento'));
  u.lang = 'es-ES';
  const voice = window.speechSynthesis.getVoices().find((v) => v.lang.startsWith('es'));
  if (voice) u.voice = voice;
  u.rate = 1.05;
  u.onend = onEnd;
  u.onerror = onEnd;
  window.speechSynthesis.speak(u);
}

export function stopSpeaking() {
  if (speechOutputSupported) window.speechSynthesis.cancel();
}
