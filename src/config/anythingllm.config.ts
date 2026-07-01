/**
 * Configuration for talking to a locally running AnythingLLM Desktop instance.
 *
 * Values are stored on this machine via localStorage (set through the in-app
 * Settings screen), with Vite env vars (.env) as build-time fallbacks for
 * development. Nothing here is ever sent anywhere except localhost — there
 * is no cloud fallback.
 */

export interface AnythingLLMSettings {
  /** Base URL of the AnythingLLM Desktop local REST API. */
  baseUrl: string;
  /** Developer API key, generated in AnythingLLM Desktop > Settings > API Keys. */
  apiKey: string;
  /** Workspace slug that holds the educator-facing model/prompt config. */
  workspaceSlug: string;
}

const STORAGE_KEY = "educatorllm-settings";

function readEnv(value: string | undefined, fallback: string): string {
  return value && value.length > 0 ? value : fallback;
}

/** Build-time defaults from .env — used in dev, empty in packaged builds. */
export const envDefaults: AnythingLLMSettings = {
  baseUrl: readEnv(import.meta.env.VITE_ANYTHINGLLM_BASE_URL, "http://localhost:3001"),
  apiKey: readEnv(import.meta.env.VITE_ANYTHINGLLM_API_KEY, ""),
  workspaceSlug: readEnv(import.meta.env.VITE_ANYTHINGLLM_WORKSPACE_SLUG, ""),
};

/** Loads saved settings, falling back to .env defaults per field. */
export function loadSettings(): AnythingLLMSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AnythingLLMSettings>;
      return {
        baseUrl:
          typeof parsed.baseUrl === "string" && parsed.baseUrl.length > 0
            ? parsed.baseUrl
            : envDefaults.baseUrl,
        apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : envDefaults.apiKey,
        workspaceSlug:
          typeof parsed.workspaceSlug === "string"
            ? parsed.workspaceSlug
            : envDefaults.workspaceSlug,
      };
    }
  } catch {
    // Corrupt storage — fall back to env defaults.
  }
  return { ...envDefaults };
}

export function saveSettings(settings: AnythingLLMSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function isConfigured(): boolean {
  const s = loadSettings();
  return s.apiKey.length > 0 && s.workspaceSlug.length > 0;
}

/** Request timeout in ms before we treat a chat call as hung.
 *  QA on 2026-07-01 measured ~50s for a first response on typical school
 *  hardware (model cold-load + generation), so 60s was too tight. */
export const requestTimeoutMs = 120_000;
