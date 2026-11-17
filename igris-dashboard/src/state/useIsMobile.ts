import { useEffect, useState } from 'react';

/** Teléfonos (bajo el breakpoint `md` de Tailwind, 768 px) y tablets en vertical. */
const QUERY = '(max-width: 767px), (orientation: portrait) and (max-width: 1199px)';

/** true en pantallas angostas o verticales: el dashboard se apila en columna (planta arriba, datos abajo). */
export function useIsMobile() {
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia(QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const on = () => setMobile(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return mobile;
}
