import { isConfigured, loadSettings, requestTimeoutMs } from "../config/anythingllm.config";

export type ChatRole = "user" | "assistant";

export interface ChatRequestMessage {
  role: ChatRole;
  content: string;
}

export type OllamaResult<T> = { ok: true; value: T } | { ok: false; error: OllamaErrorKind; message: string };

export type OllamaErrorKind =
  | "not_configured"
  | "connection_refused"
  | "timeout"
  | "model_missing"
  | "model_error"
  | "unknown";

const NOT_CONFIGURED_MESSAGE =
  "DittoEd isn't set up yet — open Settings and add your Ollama address and model.";

function modelMissingMessage(model: string): string {
  return `The model ${model} isn't downloaded yet. Run 'ollama pull ${model}' or ask your administrator.`;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, "");
}

function extractModelNames(data: unknown): string[] {
  if (typeof data !== "object" || data === null || !("models" in data)) {
    return [];
  }

  const models = (data as { models?: unknown }).models;
  if (!Array.isArray(models)) {
    return [];
  }

  return models
    .map((entry) => {
      if (typeof entry !== "object" || entry === null || !("name" in entry)) {
        return null;
      }
      const name = (entry as { name?: unknown }).name;
      return typeof name === "string" ? name : null;
    })
    .filter((name): name is string => Boolean(name));
}

async function safeReadError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: unknown };
    return typeof data.error === "string" ? data.error : "";
  } catch {
    return "";
  }
}

async function fetchTags(
  baseUrl: string,
  timeoutMs: number,
): Promise<OllamaResult<string[]>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${normalizeBaseUrl(baseUrl)}/api/tags`, {
      method: "GET",
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return {
        ok: false,
        error: "unknown",
        message: `Ollama responded with an unexpected status (${res.status}).`,
      };
    }

    const data = (await res.json()) as unknown;
    return { ok: true, value: extractModelNames(data) };
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof DOMException && err.name === "AbortError") {
      return {
        ok: false,
        error: "timeout",
        message: "Ollama didn't respond in time. Is it still starting up?",
      };
    }
    return {
      ok: false,
      error: "connection_refused",
      message: "Can't reach Ollama. Make sure Ollama is installed and running on this computer.",
    };
  }
}

export async function listModels(baseUrlOverride?: string): Promise<string[]> {
  const baseUrl = baseUrlOverride ?? loadSettings().baseUrl;
  const result = await fetchTags(baseUrl, 5_000);
  if (!result.ok) {
    throw new Error(result.message);
  }
  return result.value;
}

export async function checkConnection(): Promise<OllamaResult<void>> {
  if (!isConfigured()) {
    return { ok: false, error: "not_configured", message: NOT_CONFIGURED_MESSAGE };
  }

  const settings = loadSettings();
  const tagsResult = await fetchTags(settings.baseUrl, 5_000);
  if (!tagsResult.ok) {
    return tagsResult;
  }

  if (!tagsResult.value.includes(settings.model)) {
    return {
      ok: false,
      error: "model_missing",
      message: modelMissingMessage(settings.model),
    };
  }

  return { ok: true, value: undefined };
}

export async function sendChat(messages: ChatRequestMessage[]): Promise<OllamaResult<string>> {
  if (!isConfigured()) {
    return { ok: false, error: "not_configured", message: NOT_CONFIGURED_MESSAGE };
  }

  const settings = loadSettings();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    const res = await fetch(`${normalizeBaseUrl(settings.baseUrl)}/api/chat`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: settings.model,
        messages,
        stream: false,
      }),
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const errorText = await safeReadError(res);
      if (res.status === 404 || /not found/i.test(errorText)) {
        return {
          ok: false,
          error: "model_missing",
          message: modelMissingMessage(settings.model),
        };
      }

      return {
        ok: false,
        error: "unknown",
        message: `Ollama responded with an unexpected status (${res.status}).`,
      };
    }

    const data = (await res.json()) as {
      error?: unknown;
      message?: { content?: unknown };
    };

    if (typeof data.error === "string" && data.error.length > 0) {
      return {
        ok: false,
        error: "model_error",
        message: `The model reported an error: ${data.error}`,
      };
    }

    if (typeof data.message?.content !== "string" || data.message.content.length === 0) {
      return {
        ok: false,
        error: "model_error",
        message: "Ollama returned an empty response.",
      };
    }

    return { ok: true, value: data.message.content };
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof DOMException && err.name === "AbortError") {
      return {
        ok: false,
        error: "timeout",
        message: "The request took too long. The model may be overloaded — try again.",
      };
    }
    return {
      ok: false,
      error: "connection_refused",
      message: "Can't reach Ollama. Make sure Ollama is installed and running on this computer.",
    };
  }
}
