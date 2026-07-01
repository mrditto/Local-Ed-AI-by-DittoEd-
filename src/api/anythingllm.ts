import { anythingLLMConfig, isConfigured } from "../config/anythingllm.config";

/**
 * Thin client for AnythingLLM Desktop's local REST API.
 * Docs: http://localhost:3001/api/docs (when AnythingLLM Desktop is running).
 */

export type ChatResult =
  | { ok: true; text: string }
  | { ok: false; error: AnythingLLMErrorKind; message: string };

export type AnythingLLMErrorKind =
  | "not_configured"
  | "connection_refused"
  | "timeout"
  | "unauthorized"
  | "workspace_not_found"
  | "model_error"
  | "unknown";

function buildHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${anythingLLMConfig.apiKey}`,
  };
}

/**
 * Checks whether AnythingLLM Desktop is reachable at all. Used to give a
 * plain-language status instead of letting a raw fetch error surface.
 */
export async function checkConnection(): Promise<
  { ok: true } | { ok: false; error: AnythingLLMErrorKind; message: string }
> {
  if (!isConfigured()) {
    return {
      ok: false,
      error: "not_configured",
      message:
        "EducatorLLM isn't set up yet — add your AnythingLLM API key and workspace slug to .env.",
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);
    const res = await fetch(`${anythingLLMConfig.baseUrl}/api/v1/workspaces`, {
      method: "GET",
      headers: buildHeaders(),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.status === 401 || res.status === 403) {
      return {
        ok: false,
        error: "unauthorized",
        message: "AnythingLLM rejected the API key. Check the key in Settings > API Keys.",
      };
    }
    if (!res.ok) {
      return {
        ok: false,
        error: "unknown",
        message: `AnythingLLM responded with an unexpected status (${res.status}).`,
      };
    }
    return { ok: true };
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return {
        ok: false,
        error: "timeout",
        message: "AnythingLLM Desktop didn't respond in time. Is it still starting up?",
      };
    }
    return {
      ok: false,
      error: "connection_refused",
      message:
        "Can't reach AnythingLLM Desktop. Make sure it's open and running on this computer.",
    };
  }
}

/**
 * Sends a single chat message to the configured workspace and returns the
 * model's reply. Non-streaming for Phase 1 — streaming can be added later
 * without changing this function's external shape.
 */
export async function sendChatMessage(message: string): Promise<ChatResult> {
  if (!isConfigured()) {
    return {
      ok: false,
      error: "not_configured",
      message:
        "EducatorLLM isn't set up yet — add your AnythingLLM API key and workspace slug to .env.",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), anythingLLMConfig.requestTimeoutMs);

  try {
    const res = await fetch(
      `${anythingLLMConfig.baseUrl}/api/v1/workspace/${anythingLLMConfig.workspaceSlug}/chat`,
      {
        method: "POST",
        headers: buildHeaders(),
        signal: controller.signal,
        body: JSON.stringify({
          message,
          mode: "chat",
        }),
      },
    );
    clearTimeout(timeout);

    if (res.status === 401 || res.status === 403) {
      return {
        ok: false,
        error: "unauthorized",
        message: "AnythingLLM rejected the API key. Check the key in Settings > API Keys.",
      };
    }
    if (res.status === 404) {
      return {
        ok: false,
        error: "workspace_not_found",
        message: `Workspace "${anythingLLMConfig.workspaceSlug}" wasn't found. Check the slug in .env.`,
      };
    }
    if (!res.ok) {
      return {
        ok: false,
        error: "unknown",
        message: `AnythingLLM responded with an unexpected status (${res.status}).`,
      };
    }

    const data = await res.json();

    if (data?.error) {
      return {
        ok: false,
        error: "model_error",
        message: `The model reported an error: ${String(data.error)}`,
      };
    }

    const text = data?.textResponse ?? data?.text ?? "";
    if (!text) {
      return {
        ok: false,
        error: "model_error",
        message: "AnythingLLM returned an empty response.",
      };
    }

    return { ok: true, text };
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
      message:
        "Can't reach AnythingLLM Desktop. Make sure it's open and running on this computer.",
    };
  }
}
