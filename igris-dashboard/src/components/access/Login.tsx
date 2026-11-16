/**
 * Pantalla de ingreso de clientes. CONCEPTO: verifica contra una lista fija de cuentas
 * en el navegador (lib/demoAuth.ts). La validación real se hará en el servidor local (fase siguiente).
 */
import { useState, type FormEvent } from 'react';
import { checkLogin } from '../../lib/demoAuth';

/** Difumina los bordes del video para que no se note el rectángulo. */
const MASK = 'radial-gradient(ellipse 50% 50% at 50% 50%, #000 62%, transparent 100%)';

/** Entrar sin cuenta: va directo al dashboard de demostración (datos simulados). */
export function GuestButton({ onClick, onDark = false }: { onClick: () => void; onDark?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-12 w-full items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition-colors ${
        onDark ? 'text-white ring-1 ring-white/30 hover:bg-white/10' : 'border border-line-strong text-ink-2 hover:border-[#08a1ba] hover:bg-[#f1f8ea] hover:text-ink'
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </svg>
      <span>
        Entrar como invitado <span className="font-normal opacity-75">(Datos Simulados)</span>
      </span>
    </button>
  );
}

export function Login({ onBack, onEnter, onGuest }: { onBack: () => void; onEnter: (user: string) => void; onGuest: () => void }) {
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');
  const [videoOk, setVideoOk] = useState(true);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!user.trim() || !pass) {
      setError('Escribe tu usuario y tu clave.');
      return;
    }
    // La clave no se guarda ni se envía a ningún lado: solo se compara su huella SHA-256.
    const name = checkLogin(user, pass);
    setPass('');
    if (!name) {
      setError('Usuario o clave incorrectos.');
      return;
    }
    onEnter(name);
  };

  return (
    <div
      className="grid h-full overflow-y-auto md:grid-cols-[1fr_1.1fr]"
      // Con video: fondo del mismo gris claro del video (más claro al centro, como su viñeta), para que se vea continuo.
      style={videoOk ? { background: 'radial-gradient(ellipse 60% 70% at 26% 50%, #f1f1ef 0%, #ebebe6 55%, #e3e4dd 100%)' } : undefined}
    >
      {/* Lado izquierdo: identidad */}
      <div className="relative hidden flex-col justify-between overflow-hidden p-10 md:flex">
        <button onClick={onBack} className={`flex h-10 w-fit items-center gap-2 rounded-full px-3 text-sm ${videoOk ? 'text-ink-2 ring-1 ring-black/15 hover:bg-black/5' : 'text-white/80 ring-1 ring-white/25 hover:bg-white/10'}`}>
          ‹ Volver al inicio
        </button>
        <div className="relative grid place-items-center">
          {!videoOk && <div className="absolute h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(166,224,122,0.35),transparent_70%)]" />}
          {/* Video en loop (public/igris/login.mp4). Si no existe o no se puede reproducir, se muestra el personaje. */}
          {videoOk ? (
            <video
              src="/igris/login.mp4"
              autoPlay
              loop
              muted
              playsInline
              preload="auto"
              aria-hidden
              onError={() => setVideoOk(false)}
              // Bordes difuminados: el video se funde con el fondo, sin marco.
              style={{ maskImage: MASK, WebkitMaskImage: MASK }}
              className="relative max-h-[80vh] w-full max-w-[760px] object-cover"
            />
          ) : (
            <img src="/igris/igris.png" alt="" draggable={false} className="anim-float relative max-h-[340px] w-auto drop-shadow-[0_20px_40px_rgba(0,0,0,0.4)]" />
          )}
        </div>
        <p className={`max-w-sm text-sm ${videoOk ? 'text-ink-2' : 'text-white/75'}`}>Monitoreo de suelo, ambiente y biología de tus plantas, en vivo y en un solo lugar.</p>
      </div>

      {/* Lado derecho: formulario */}
      <div className="grid place-items-center p-6">
        <form onSubmit={submit} className={`w-full max-w-md rounded-3xl bg-white p-8 ${videoOk ? 'shadow-[0_10px_40px_rgba(15,36,26,0.12)] ring-1 ring-black/5' : 'shadow-2xl'}`}>
          <button type="button" onClick={onBack} className="mb-4 text-sm text-ink-3 hover:text-ink md:hidden">
            ‹ Volver al inicio
          </button>
          <img src="/igris/logo-recorte.png" alt="IGRIS" className="h-16 w-auto" draggable={false} />
          <h1 className="mt-6 text-2xl font-semibold text-ink">Ingresa a tu dashboard</h1>
          <p className="mt-1 text-sm text-ink-3">Usa el usuario y la clave que te entregó el equipo IGRIS.</p>

          <label className="mt-6 block text-sm font-medium text-ink-2" htmlFor="login-user">
            Usuario
          </label>
          <input
            id="login-user"
            autoComplete="username"
            value={user}
            onChange={(e) => {
              setUser(e.target.value);
              setError('');
            }}
            className="mt-1.5 h-12 w-full rounded-xl border border-line-strong px-4 text-ink outline-none focus:border-[#08a1ba] focus:ring-2 focus:ring-[#08a1ba]/30"
            placeholder="tu.usuario"
          />

          <label className="mt-4 block text-sm font-medium text-ink-2" htmlFor="login-pass">
            Clave
          </label>
          <input
            id="login-pass"
            type="password"
            autoComplete="current-password"
            value={pass}
            onChange={(e) => {
              setPass(e.target.value);
              setError('');
            }}
            className="mt-1.5 h-12 w-full rounded-xl border border-line-strong px-4 text-ink outline-none focus:border-[#08a1ba] focus:ring-2 focus:ring-[#08a1ba]/30"
            placeholder="••••••••"
          />

          {error && <p className="mt-3 text-sm text-crit">{error}</p>}

          <button
            type="submit"
            className="mt-6 h-12 w-full rounded-xl bg-gradient-to-r from-[#74b43b] via-[#08a1ba] to-[#0085de] text-sm font-semibold text-white shadow-lg hover:brightness-110"
          >
            Ingresar
          </button>

          <div className="my-5 flex items-center gap-3 text-xs text-ink-3">
            <span className="h-px flex-1 bg-line-strong" /> o <span className="h-px flex-1 bg-line-strong" />
          </div>
          <GuestButton onClick={onGuest} />

          <p className="mt-5 rounded-xl bg-[#fff6e0] px-4 py-3 text-xs leading-relaxed text-[#7a5200]">
            <b>Versión de concepto:</b> los datos del dashboard son simulados. La verificación de la clave se hará en el servidor en una próxima versión.
          </p>
        </form>
      </div>
    </div>
  );
}
