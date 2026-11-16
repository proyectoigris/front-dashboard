/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 'mock' (por defecto) o 'api' para usar FastAPI + WebSocket. */
  readonly VITE_DATA_SOURCE?: 'mock' | 'api';
}
