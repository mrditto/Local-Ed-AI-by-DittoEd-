/**
 * Configuration for talking to a locally running AnythingLLM Desktop instance.
 *
 * All values come from Vite env vars (see .env.example). Nothing here is
 * ever sent anywhere except localhost — there is no cloud fallback.
 */

function readEnv(value: string | undefined, fallback: string): string {
  return value && value.length > 0 ? value : fallback;
}

export const anythingLLMConfig = {
  /** Base URL of the AnythingLLM Desktop local REST API. */
  baseUrl: readEnv(import.meta.env.VITE_ANYTHINGLLM_BASE_URL, "http://localhost:3001"),

  /** Developer API key, generated in AnythingLLM Desktop > Settings > API Keys. */
  apiKey: readEnv(import.meta.env.VITE_ANYTHINGLLM_API_KEY, ""),

  /** Workspace slug that holds the educator-facing model/prompt config. */
  workspaceSlug: readEnv(import.meta.env.VITE_ANYTHINGLLM_WORKSPACE_SLUG, ""),

  /** Request timeout in ms before we treat a chat call as hung.
   *  QA on 2026-07-01 measured ~50s for a first response on typical school
   *  hardware (model cold-load + generation), so 60s was too tight. */
  requestTimeoutMs: 120_000,
};

export function isConfigured(): boolean {
  return anythingLLMConfig.apiKey.length > 0 && anythingLLMConfig.workspaceSlug.length > 0;
}
