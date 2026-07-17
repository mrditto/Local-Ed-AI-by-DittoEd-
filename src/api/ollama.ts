import { isConfigured, loadSettings, requestTimeoutMs } from "../config/anythingllm.config";
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

interface ChatStreamEvent {
  message?: { content?: unknown };
  done?: unknown;
  error?: unknown;
}

interface OllamaDownloadProgressEvent {
  downloaded?: unknown;
  total?: unknown;
}

interface OllamaLineStreamPayload {
  requestId?: unknown;
  line?: unknown;
  done?: unknown;
  error?: unknown;
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

function generateRequestId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function toErrorMessage(err: unknown, fallback: string): string {
  if (typeof err === "string" && err.length > 0) return err;
  if (err instanceof Error && err.message.length > 0) return err.message;
  return fallback;
}

function classifyConnectionError(message: string, timeoutFallback: string): OllamaResult<never> {
  if (/timed out|timeout/i.test(message)) {
    return { ok: false, error: "timeout", message: timeoutFallback };
  }
  return {
    ok: false,
    error: "connection_refused",
    message: "Can't reach Ollama. Make sure Ollama is installed and running on this computer.",
  };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(timeoutMessage));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== null) {
      clearTimeout(timer);
    }
  }
}

export async function ollamaFetch(baseUrl: string, path: string, timeoutMs = 5_000): Promise<OllamaResult<unknown>> {
  try {
    const raw = await withTimeout(
      invoke<string>("ollama_get_json", {
        url: `${normalizeBaseUrl(baseUrl)}${path}`,
      }),
      timeoutMs,
      "Ollama didn't respond in time. Is it still starting up?",
    );
    return { ok: true, value: JSON.parse(raw) as unknown };
  } catch (err) {
    const message = toErrorMessage(err, "Couldn't read Ollama response.");
    if (/didn't respond in time/i.test(message)) {
      return { ok: false, error: "timeout", message };
    }
    if (/unexpected status \(404\)|not found/i.test(message)) {
      return { ok: false, error: "model_missing", message };
    }
    if (/unexpected status/i.test(message)) {
      return { ok: false, error: "unknown", message };
    }
    return classifyConnectionError(message, "Ollama didn't respond in time. Is it still starting up?");
  }
}

async function invokeOllamaLineStream(options: {
  command: "ollama_chat_stream" | "ollama_pull_stream";
  eventName: "ollama-chat-stream" | "ollama-pull-stream";
  url: string;
  bodyJson: string;
  requestId: string;
  timeoutMs: number;
  onLine: (line: string) => void;
}): Promise<void> {
  let done = false;
  let completeResolve: (() => void) | null = null;
  let completeReject: ((error: Error) => void) | null = null;
  let idleTimer: ReturnType<typeof setTimeout> | null = null;

  const completion = new Promise<void>((resolve, reject) => {
    completeResolve = resolve;
    completeReject = reject;
  });

  const clearIdleTimer = () => {
    if (idleTimer !== null) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
  };

  const finishSuccess = () => {
    if (done) return;
    done = true;
    clearIdleTimer();
    completeResolve?.();
  };

  const finishError = (error: Error) => {
    if (done) return;
    done = true;
    clearIdleTimer();
    completeReject?.(error);
  };

  // Idle timeout: reset on every line received so long-running-but-active
  // generations (e.g. a full IEP with many sections) aren't killed by a
  // fixed wall-clock deadline. Only fires if Ollama stops sending data.
  const resetIdleTimer = () => {
    clearIdleTimer();
    idleTimer = setTimeout(() => {
      finishError(new Error("Ollama stream timed out."));
    }, options.timeoutMs);
  };

  resetIdleTimer();

  const unlisten = await listen<OllamaLineStreamPayload>(options.eventName, (event) => {
    const payload = event.payload;
    if (payload.requestId !== options.requestId) {
      return;
    }

    resetIdleTimer();

    if (typeof payload.error === "string" && payload.error.length > 0) {
      finishError(new Error(payload.error));
      return;
    }

    if (typeof payload.line === "string") {
      try {
        options.onLine(payload.line);
      } catch (err) {
        finishError(new Error(toErrorMessage(err, "Failed to process Ollama stream line.")));
        return;
      }
    }

    if (payload.done === true) {
      finishSuccess();
    }
  });

  try {
    const invokePromise = invoke(options.command, {
      url: options.url,
      bodyJson: options.bodyJson,
      requestId: options.requestId,
    }).catch((err) => {
      finishError(new Error(toErrorMessage(err, "Couldn't start Ollama stream.")));
    });

    await completion;
    await invokePromise;
  } finally {
    clearIdleTimer();
    unlisten();
  }
}

async function fetchTags(baseUrl: string, timeoutMs: number): Promise<OllamaResult<string[]>> {
  const result = await ollamaFetch(baseUrl, "/api/tags", timeoutMs);
  if (!result.ok) {
    return result;
  }
  return { ok: true, value: extractModelNames(result.value) };
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

export async function getInstallerPath(): Promise<string> {
  return join(await tempDir(), "OllamaSetup.exe");
}

export async function downloadOllamaInstaller(options?: {
  onProgress?: (progress: DownloadProgressUpdate) => void;
}): Promise<OllamaResult<string>> {
  const installerUrl = `${OLLAMA_INSTALLER_BASE_URL}${OLLAMA_INSTALLER_PATH}`;
  const installerPath = await getInstallerPath();

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

    return { ok: true, value: installerPath };
  } catch (err) {
    return {
      ok: false,
      error: "unknown",
      message: err instanceof Error ? err.message : "Couldn't download the Ollama installer. Please try again.",
    };
  }
}

export async function launchOllamaInstaller(installerPath: string): Promise<OllamaResult<void>> {
  try {
    await invoke("launch_ollama_installer", { path: installerPath });
    return { ok: true, value: undefined };
  } catch (err) {
    return {
      ok: false,
      error: "unknown",
      message: err instanceof Error ? err.message : "Couldn't launch the Ollama installer automatically.",
    };
  }
}

export async function openInstallerFolder(installerPath: string): Promise<void> {
  try {
    const dir = installerPath.replace(/[\\/][^\\/]+$/, "");
    await openPath(dir);
  } catch {
    // best-effort
  }
}

export async function pullModel(
  model: string,
  options?: {
    baseUrl?: string;
    onProgress?: (update: PullProgressUpdate) => void;
  },
): Promise<OllamaResult<void>> {
  const baseUrl = options?.baseUrl ?? loadSettings().baseUrl;
  const requestId = generateRequestId("pull");
  let latestPercent = 0;

  try {
    await invokeOllamaLineStream({
      command: "ollama_pull_stream",
      eventName: "ollama-pull-stream",
      url: `${normalizeBaseUrl(baseUrl)}/api/pull`,
      bodyJson: JSON.stringify({
        name: model,
        stream: true,
      }),
      requestId,
      timeoutMs: requestTimeoutMs,
      onLine: (line) => {
        const event = parsePullLine(line);
        if (!event) return;

        if (typeof event.error === "string" && event.error.length > 0) {
          throw new Error(`MODEL_ERROR:${event.error}`);
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
          indeterminate: completed === null || total === null || total <= 0,
        });
      },
    });

    options?.onProgress?.({
      status: "Download complete.",
      completed: null,
      total: null,
      percent: 100,
      indeterminate: false,
    });

    return { ok: true, value: undefined };
  } catch (err) {
    const message = toErrorMessage(err, "Couldn't download model.");

    if (message.startsWith("MODEL_ERROR:")) {
      return { ok: false, error: "model_error", message: message.replace("MODEL_ERROR:", "") };
    }

    if (/unexpected status \(404\)|not found/i.test(message)) {
      return {
        ok: false,
        error: "model_missing",
        message: modelMissingMessage(model),
      };
    }

    if (/unexpected status/i.test(message)) {
      return { ok: false, error: "unknown", message };
    }

    return classifyConnectionError(message, "Ollama didn't respond in time. Is it still starting up?");
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
  const requestId = generateRequestId("chat");
  let assistantText = "";

  try {
    await invokeOllamaLineStream({
      command: "ollama_chat_stream",
      eventName: "ollama-chat-stream",
      url: `${normalizeBaseUrl(settings.baseUrl)}/api/chat`,
      bodyJson: JSON.stringify({
        model: settings.model,
        messages,
        stream: true,
      }),
      requestId,
      timeoutMs: requestTimeoutMs,
      onLine: (line) => {
        const event = JSON.parse(line) as ChatStreamEvent;

        if (typeof event.error === "string" && event.error.length > 0) {
          throw new Error(`MODEL_ERROR:${event.error}`);
        }

        const chunk = event.message?.content;
        if (typeof chunk === "string") {
          assistantText += chunk;
        }
      },
    });

    if (assistantText.length === 0) {
      return {
        ok: false,
        error: "model_error",
        message: "Ollama returned an empty response.",
      };
    }

    return { ok: true, value: assistantText };
  } catch (err) {
    const message = toErrorMessage(err, "Couldn't reach Ollama.");

    if (message.startsWith("MODEL_ERROR:")) {
      return {
        ok: false,
        error: "model_error",
        message: message.replace("MODEL_ERROR:", ""),
      };
    }

    if (/unexpected status \(404\)|not found/i.test(message)) {
      return {
        ok: false,
        error: "model_missing",
        message: modelMissingMessage(settings.model),
      };
    }

    if (/unexpected status/i.test(message)) {
      return {
        ok: false,
        error: "unknown",
        message,
      };
    }

    return classifyConnectionError(message, "The request took too long. The model may be overloaded — try again.");
  }
}
