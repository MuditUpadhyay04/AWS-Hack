/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the roadmap backend. Unset = use the bundled mock. */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
