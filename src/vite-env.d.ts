/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the roadmap backend. Unset = use the bundled mock. */
  readonly VITE_API_BASE_URL?: string;
  // AWS Bedrock vars (VITE_AWS_*) used by the game's level generator are read
  // via Vite's built-in index signature; documented in .env.example.
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
