import { isConfigured, loadSettings, requestTimeoutMs } from "../config/anythingllm.config";
import { fetch } from "@tauri-apps/plugin-http";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { join, tempDir } from "@tauri-apps/api/path";
import { openPath } from "@tauri-apps/plugin-opener";

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

export interface PullProgressUpdate {
  status: string;
  completed: number | null;
  total: number | null;
  percent: number;
  indeterminate?: boolean;
}

export interface DownloadProgressUpdate {
  downloaded: number;
  total: number | null;
  percent: number;
  indeterminate: boolean;
}

interface PullStreamEvent {
  status?: unknown;
  completed?: unknown;
  total?: unknown;
  done?: unknown;
  error?: unknown;
}

interface OllamaDownloadProgressEvent {
  downloaded?: unknown;
  total?: unknown;
}

const NOT_CONFIGURED_MESSAGE =
  "Local Ed AI isn't set up yet — open Settings and add your Ollama address and model.";
const OLLAMA_INSTALLER_BASE_URL = "https://ollama.com";
const OLLAMA_INSTALLER_PATH = "/download/OllamaSetup.exe";

function modelMissingMessage(model: string): string {
  return `The model ${model} isn't downloaded yet. Run 'ollama pull ${model}' or ask your administrator.`;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, "");
}

export function ollamaFetch(
  baseUrl: string,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const headers = new Headers(init?.headers);
  headers.set("Origin", "http://localhost");

  if (init?.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(`${normalizeBaseUrl(baseUrl)}${path}`, {
    ...init,
    headers,
  });
}

function toFiniteNumberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function parsePullLine(line: string): PullStreamEvent | null {
  try {
    return JSON.parse(line) as PullStreamEvent;
  } catch {
    return null;
  }
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
    const res = await ollamaFetch(baseUrl, "/api/tags", {
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

export async function checkOllamaHealth(options?: {
  baseUrl?: string;
  timeoutMs?: number;
}): Promise<OllamaResult<string[]>> {
  const baseUrl = options?.baseUrl ?? loadSettings().baseUrl;
  const timeoutMs = options?.timeoutMs ?? 5_000;
  return fetchTags(baseUrl, timeoutMs);
}

export async function listModels(baseUrlOverride?: string): Promise<string[]> {
  const result = await checkOllamaHealth({ baseUrl: baseUrlOverride, timeoutMs: 5_000 });
  if (!result.ok) {
    throw new Error(result.message);
  }
  return result.value;
}

export async function downloadAndLaunchOllamaInstaller(options?: {
  onProgress?: (progress: DownloadProgressUpdate) => void;
}): Promise<OllamaResult<string>> {
  const installerUrl = `${OLLAMA_INSTALLER_BASE_URL}${OLLAMA_INSTALLER_PATH}`;
  const installerPath = await join(await tempDir(), "OllamaSetup.exe");

  try {
    let downloadedBytes = 0;
    let totalBytes: number | null = null;
    options?.onProgress?.({
      downloaded: 0,
      total: totalBytes,
      percent: 0,
      indeterminate: true,
    });

    const unlisten = await listen<OllamaDownloadProgressEvent>("ollama-download-progress", (event) => {
      const downloaded = toFiniteNumberOrNull(event.payload.downloaded);
      const total = toFiniteNumberOrNull(event.payload.total);
      if (downloaded === null) {
        return;
      }

      downloadedBytes = downloaded;
      totalBytes = total !== null && total > 0 ? total : null;
      const percent =
        totalBytes === null || totalBytes <= 0
          ? 0
          : clampPercent(Math.round((downloadedBytes / totalBytes) * 100));
      options?.onProgress?.({
        downloaded: downloadedBytes,
        total: totalBytes,
        percent,
        indeterminate: totalBytes === null,
      });
    });

    try {
      await invoke("download_ollama_installer", {
        url: installerUrl,
        dest: installerPath,
      });
    } finally {
      unlisten();
    }

    options?.onProgress?.({
      downloaded: downloadedBytes,
      total: totalBytes ?? downloadedBytes,
      percent: 100,
      indeterminate: false,
    });

    await openPath(installerPath);
    return { ok: true, value: installerPath };
  } catch {
    return {
      ok: false,
      error: "unknown",
      message: "Couldn't download or launch the Ollama installer. Please try again.",
    };
  }
}

async function pollUntilModelInstalled(
  baseUrl: string,
  model: string,
  onProgress?: (update: PullProgressUpdate) => void,
): Promise<OllamaResult<void>> {
  const waitingMessage = "Downloading... this can take several minutes";
  onProgress?.({
    status: waitingMessage,
    completed: null,
    total: null,
    percent: 0,
    indeterminate: true,
  });

  while (true) {
    const tagsResult = await fetchTags(baseUrl, 5_000);
    if (!tagsResult.ok) {
      return tagsResult;
    }

    if (tagsResult.value.includes(model)) {
      onProgress?.({
        status: "Download complete.",
        completed: null,
        total: null,
        percent: 100,
        indeterminate: false,
      });
      return { ok: true, value: undefined };
    }

    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
}

async function pullModelWithoutStreaming(
  baseUrl: string,
  model: string,
  onProgress?: (update: PullProgressUpdate) => void,
): Promise<OllamaResult<void>> {
  const res = await ollamaFetch(baseUrl, "/api/pull", {
    method: "POST",
    body: JSON.stringify({
      name: model,
      stream: false,
    }),
  });

  if (!res.ok) {
    const errorText = await safeReadError(res);
    const message =
      errorText.length > 0
        ? `Ollama couldn't start the download: ${errorText}`
        : `Ollama responded with an unexpected status (${res.status}).`;
    return { ok: false, error: "unknown", message };
  }

  return pollUntilModelInstalled(baseUrl, model, onProgress);
}

export async function pullModel(
  model: string,
  options?: {
    baseUrl?: string;
    onProgress?: (update: PullProgressUpdate) => void;
  },
): Promise<OllamaResult<void>> {
  const baseUrl = options?.baseUrl ?? loadSettings().baseUrl;

  try {
    const res = await ollamaFetch(baseUrl, "/api/pull", {
      method: "POST",
      body: JSON.stringify({
        name: model,
        stream: true,
      }),
    });

    if (!res.ok) {
      const errorText = await safeReadError(res);
      const message =
        errorText.length > 0
          ? `Ollama couldn't start the download: ${errorText}`
          : `Ollama responded with an unexpected status (${res.status}).`;
      return { ok: false, error: "unknown", message };
    }

    if (!res.body || typeof res.body.getReader !== "function") {
      return pullModelWithoutStreaming(baseUrl, model, options?.onProgress);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let latestPercent = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;

        const event = parsePullLine(line);
        if (!event) continue;

        if (typeof event.error === "string" && event.error.length > 0) {
          return { ok: false, error: "model_error", message: event.error };
        }

        const completed = toFiniteNumberOrNull(event.completed);
        const total = toFiniteNumberOrNull(event.total);
        if (completed !== null && total !== null && total > 0) {
          latestPercent = clampPercent(Math.round((completed / total) * 100));
        } else if (event.done === true) {
          latestPercent = 100;
        }

        options?.onProgress?.({
          status: typeof event.status === "string" ? event.status : "Downloading model…",
          completed,
          total,
          percent: latestPercent,
          indeterminate: false,
        });
      }
    }

    const tail = `${buffer}${decoder.decode()}`.trim();
    if (tail.length > 0) {
      const event = parsePullLine(tail);
      if (event) {
        if (typeof event.error === "string" && event.error.length > 0) {
          return { ok: false, error: "model_error", message: event.error };
        }
        if (event.done === true) {
          latestPercent = 100;
        }
        options?.onProgress?.({
          status: typeof event.status === "string" ? event.status : "Download complete.",
          completed: toFiniteNumberOrNull(event.completed),
          total: toFiniteNumberOrNull(event.total),
          percent: latestPercent,
          indeterminate: false,
        });
      }
    }

    return { ok: true, value: undefined };
  } catch {
    return {
      ok: false,
      error: "connection_refused",
      message: "Can't reach Ollama. Make sure Ollama is installed and running on this computer.",
    };
  }
}

export async function checkConnection(): Promise<OllamaResult<void>> {
  if (!isConfigured()) {
    return { ok: false, error: "not_configured", message: NOT_CONFIGURED_MESSAGE };
  }

  const settings = loadSettings();
  const tagsResult = await checkOllamaHealth({ baseUrl: settings.baseUrl, timeoutMs: 5_000 });
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
    const res = await ollamaFetch(settings.baseUrl, "/api/chat", {
      method: "POST",
      signal: controller.signal,
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
