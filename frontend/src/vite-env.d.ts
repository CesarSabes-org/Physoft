/// <reference types="vite/client" />

/** App version from frontend/package.json, injected at build time by vite.config.ts */
declare const __APP_VERSION__: string

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  // Agregar más variables de entorno según sea necesario
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
