/**
 * IGRIS en la barra inferior derecha. Tocarlo despliega el chat de voz y escritura
 * en una ventana emergente anclada abajo a la derecha (nunca tapa datos mientras está cerrado). La imagen es la original del personaje
 * (public/igris/igris.png, fondo transparente).
 */
import { useEffect, useRef, useState } from 'react';
import { assistant, type AssistantAction } from '../../services/assistant';
import { listen, speak, speechInputSupported, speechOutputSupported, stopSpeaking } from '../../services/speech';
import { igrisStore, useSnapshot } from '../../store/igrisStore';
import { useUi } from '../../state/ui';
import { useIsMobile } from '../../state/useIsMobile';
import type { AvatarState } from '../../types/domain';

const AVATAR_SOURCES = ['/igris/igris.png', '/igris.png'];

const STATE_LABEL: Record<AvatarState, string> = {
  idle: 'Disponible',
  listening: 'Escuchando…',
  thinking: 'Pensando…',
  speaking: 'Hablando',
  responding: 'Respondiendo',
  alert: 'Alerta',
};
const STATE_COLOR: Record<AvatarState, string> = {
  idle: '#74b43b',
  listening: '#24aecf',
  thinking: '#0085de',
  speaking: '#74b43b',
  responding: '#74b43b',
  alert: '#d03b3b',
};

const SUGGESTIONS = [
  '¿Cuál es la temperatura actual?',
  '¿Cuál es la humedad de la planta 12?',
  '¿Qué plantas tienen menor humedad?',
  'Compara con y sin bacterias',
  'Estadísticas del T3',
  'Cambios en las últimas 24 horas',
];

interface Msg {
  id: string;
  role: 'user' | 'igris';
  text: string;
  refs?: number;
}

function AvatarImg({ className }: { className: string }) {
  const [i, setI] = useState(0);
  if (i >= AVATAR_SOURCES.length) return <span className={`${className} grid place-items-center text-xs font-bold text-white`}>IGRIS</span>;
  return <img src={AVATAR_SOURCES[i]} alt="IGRIS" draggable={false} onError={() => setI((v) => v + 1)} className={`${className} object-contain`} />;
}

export function AssistantWidget({ onAction }: { onAction: (a: AssistantAction) => void }) {
  const ui = useUi();
  const s = useSnapshot();
  const [open, setOpen] = useState(false);
  // Diseño apilado (móvil / tablet vertical): botón compacto.
  const stacked = useIsMobile();
  const iconOnly = stacked && ui.panelOpen;
  const [msgs, setMsgs] = useState<Msg[]>([
    { id: 'hello', role: 'igris', text: 'Hola, soy IGRIS. Pregúntame por la cámara, una planta o un tratamiento. Puedes escribir o tocar el micrófono.' },
  ]);
  const [input, setInput] = useState('');
  const [voiceOut, setVoiceOut] = useState(speechOutputSupported);
  const [voiceErr, setVoiceErr] = useState<string | null>(null);
  const stopListen = useRef<() => void>();
  const listRef = useRef<HTMLDivElement>(null);
  const state = ui.avatarState;

  // Estado "alerta" breve cuando aparece una alerta crítica nueva.
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    const crit = s.alerts.filter((a) => a.severity === 'critical' && a.state === 'active').map((a) => a.id);
    if (seen.current === null) {
      seen.current = new Set(crit);
      return;
    }
    const fresh = crit.filter((id) => !seen.current!.has(id));
    crit.forEach((id) => seen.current!.add(id));
    if (fresh.length && ui.avatarState === 'idle') {
      ui.setAvatarState('alert');
      const t = setTimeout(() => ui.setAvatarState('idle'), 6000);
      return () => clearTimeout(t);
    }
  }, [s.version]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [msgs, open]);

  async function submit(text: string) {
    const q = text.trim();
    if (!q) return;
    setInput('');
    setMsgs((m) => [...m, { id: `u${Date.now()}`, role: 'user', text: q }]);
    ui.setAvatarState('thinking');
    const reply = await assistant.ask(q, igrisStore.getSnapshot());
    setMsgs((m) => [...m, { id: reply.id, role: 'igris', text: reply.response, refs: reply.dataRefs.length }]);
    if (reply.action) onAction(reply.action);
    if (voiceOut) {
      ui.setAvatarState('speaking');
      speak(reply.response, () => ui.setAvatarState('idle'));
    } else {
      ui.setAvatarState('responding');
      setTimeout(() => ui.setAvatarState('idle'), 2500);
    }
  }

  function toggleMic() {
    setVoiceErr(null);
    if (state === 'listening') {
      stopListen.current?.();
      return;
    }
    stopSpeaking();
    ui.setAvatarState('listening');
    let finalText = '';
    stopListen.current = listen({
      onPartial: (t) => setInput(t),
      onFinal: (t) => {
        finalText = t;
        setInput(t);
      },
      onError: (m) => setVoiceErr(m),
      onEnd: () => {
        if (finalText) submit(finalText);
        else ui.setAvatarState('idle');
      },
    });
  }

  return (
    <>
      {open && (
        <section className="fixed inset-x-2 bottom-2 z-50 flex h-[min(560px,calc(100dvh-1rem))] flex-col md:inset-x-auto md:right-4 md:bottom-3 md:h-[min(470px,calc(100vh-90px))] md:w-[460px] overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-black/5">
          {/* Cabecera con el degradado del logo */}
          <header className="flex shrink-0 items-center gap-3 bg-gradient-to-r from-[#74b43b] via-[#08a1ba] to-[#0085de] px-4 py-3 text-white">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-white/95">
              <AvatarImg className="h-11 w-11" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-base font-bold tracking-[0.15em]">IGRIS</div>
              <div className="flex items-center gap-1.5 text-xs text-white/90">
                <span className="h-2 w-2 rounded-full bg-white" />
                {STATE_LABEL[state]}
              </div>
            </div>
            {speechOutputSupported && (
              <button
                onClick={() => {
                  stopSpeaking();
                  setVoiceOut((v) => !v);
                }}
                className="h-9 rounded-full bg-white/20 px-3 text-xs font-medium hover:bg-white/30"
              >
                {voiceOut ? 'Voz activada' : 'Voz desactivada'}
              </button>
            )}
            <button onClick={() => setOpen(false)} aria-label="Cerrar chat" className="grid h-9 w-9 place-items-center rounded-full bg-white/20 text-lg hover:bg-white/30">
              ×
            </button>
          </header>

          <div ref={listRef} className="scroll-y min-h-0 flex-1 space-y-2.5 bg-[#f6faf2] px-4 py-3">
            {msgs.map((m) => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed ${
                    m.role === 'user' ? 'rounded-br-sm bg-[#0085de] text-white' : 'rounded-bl-sm border border-line bg-white text-ink'
                  }`}
                >
                  {m.text}
                  {m.refs ? <div className="mt-1 text-[10px] text-ink-3">Basado en {m.refs} referencia(s) de datos del sistema</div> : null}
                </div>
              </div>
            ))}
            {state === 'thinking' && <div className="text-xs text-ink-3">IGRIS está consultando los datos…</div>}
          </div>

          <div className="scroll-y flex shrink-0 gap-1.5 overflow-x-auto border-t border-line px-4 pt-2.5 pb-1">
            {SUGGESTIONS.map((q) => (
              <button key={q} onClick={() => submit(q)} className="h-8 shrink-0 rounded-full border border-line-strong px-3 text-xs whitespace-nowrap text-ink-2 hover:border-[#74b43b] hover:text-ink">
                {q}
              </button>
            ))}
          </div>
          {voiceErr && <div className="px-4 text-xs text-warn">{voiceErr}</div>}
          {!speechInputSupported && <div className="px-4 text-[11px] text-ink-3">El micrófono no está disponible en este navegador; usa el chat escrito.</div>}
          <form
            className="flex shrink-0 gap-2 px-4 pt-2 pb-4"
            onSubmit={(e) => {
              e.preventDefault();
              submit(input);
            }}
          >
            <button
              type="button"
              onClick={toggleMic}
              aria-label={state === 'listening' ? 'Detener micrófono' : 'Hablar con IGRIS'}
              className={`relative grid h-12 w-12 shrink-0 place-items-center rounded-full border transition-colors ${
                state === 'listening' ? 'border-celeste bg-celeste/15 text-[#0a7fa0]' : 'border-line-strong bg-panel-2 text-ink-2 hover:text-ink'
              }`}
            >
              {state === 'listening' && <span className="anim-pulse absolute inset-0 rounded-full border-2 border-celeste" />}
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                <rect x="9" y="3" width="6" height="11" rx="3" />
                <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
              </svg>
            </button>
            <input
              autoFocus
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={state === 'listening' ? 'Escuchando…' : 'Escribe tu pregunta…'}
              className="h-12 min-w-0 flex-1 rounded-xl border border-line-strong bg-white px-4 text-sm text-ink outline-none placeholder:text-ink-3 focus:border-[#08a1ba]"
            />
            <button type="submit" className="h-12 rounded-xl bg-accent-ink px-5 text-sm font-semibold text-white hover:bg-[#3f7619]">
              Enviar
            </button>
          </form>
        </section>
      )}


      {/* Botón de BotanIA: pastilla sobria abajo a la derecha. El punto indica el estado (escuchando, hablando…).
          En móvil con el panel abierto queda solo el ícono para no tapar la barra inferior. */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Cerrar chat con BotanIA' : 'Abrir chat con BotanIA'}
        aria-pressed={open}
        className={`dock-btn ${stacked ? 'dock-btn-sm' : ''} ${iconOnly ? 'dock-btn-icon' : ''}`}
      >
        <span className="dock-ico overflow-visible bg-white/90">
          <AvatarImg className="h-[85%] w-[85%]" />
          <span
            className={`absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-[#10261b] ${state === 'listening' || state === 'alert' ? 'anim-blink' : ''}`}
            style={{ background: STATE_COLOR[state] }}
          />
        </span>
        {!iconOnly && <span className="dock-opt">{state !== 'idle' ? STATE_LABEL[state] : stacked ? 'BotanIA' : 'Habla con BotanIA'}</span>}
      </button>
    </>
  );
}