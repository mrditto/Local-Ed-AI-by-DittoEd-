/**
 * Configuration for talking directly to a locally running Ollama instance.
 *
 * Values are stored on this machine via localStorage (set through the in-app
 * Settings screen), with Vite env vars (.env) as build-time fallbacks for
 * development. Nothing here is ever sent anywhere except localhost — there
 * is no cloud fallback.
 */

export interface OllamaSettings {
  /** Base URL of the Ollama local REST API. */
  baseUrl: string;
  /** Model name to use for chat requests. */
  model: string;
}

const STORAGE_KEY = "educatorllm-settings";

function readEnv(value: string | undefined, fallback: string): string {
  return value && value.length > 0 ? value : fallback;
}

/** Build-time defaults from .env — used in dev, empty in packaged builds. */
export const envDefaults: OllamaSettings = {
  baseUrl: readEnv(import.meta.env.VITE_OLLAMA_BASE_URL, "http://localhost:11434"),
  model: readEnv(import.meta.env.VITE_OLLAMA_MODEL, "phi4-mini:latest"),
};

/** Loads saved settings, falling back to .env defaults per field. */
export function loadSettings(): OllamaSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<OllamaSettings>;
      return {
        baseUrl:
          typeof parsed.baseUrl === "string" && parsed.baseUrl.length > 0
            ? parsed.baseUrl
            : envDefaults.baseUrl,
        model:
          typeof parsed.model === "string" && parsed.model.length > 0
            ? parsed.model
            : envDefaults.model,
      };
    }
  } catch {
    // Corrupt storage — fall back to env defaults.
  }
  return { ...envDefaults };
}

export function saveSettings(settings: OllamaSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function isConfigured(): boolean {
  const s = loadSettings();
  return s.baseUrl.trim().length > 0;
}

/** Request timeout in ms before we treat a chat call as hung.
 *  QA on 2026-07-01 measured ~50s for a first response on typical school
 *  hardware (model cold-load + generation), so 60s was too tight. */
export const requestTimeoutMs = 120_000;
