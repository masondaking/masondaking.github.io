/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_OPENAI_BASE_URL?: string;
  readonly VITE_ANTHROPIC_BASE_URL?: string;
  readonly VITE_GEMINI_BASE_URL?: string;
  readonly VITE_DEEPSEEK_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
