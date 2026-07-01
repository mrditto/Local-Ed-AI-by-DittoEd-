/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ANYTHINGLLM_BASE_URL: string;
  readonly VITE_ANYTHINGLLM_API_KEY: string;
  readonly VITE_ANYTHINGLLM_WORKSPACE_SLUG: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
