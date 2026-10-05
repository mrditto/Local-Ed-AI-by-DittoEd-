import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { InferenceBackend } from "./backend";
import type { ChatRequestMessage, GenerationOptions, InferenceResult } from "./types";
import { ChatStreamDecoder } from "./sse";
import { BIAS_MITIGATION_GUARDRAIL } from "../ollama";

interface RuntimeStreamEvent { requestId: string; bytes: number[]; started: boolean }

async function generate(messages: ChatRequestMessage[], options?: GenerationOptions): Promise<InferenceResult<string>> {
  if (options?.signal?.aborted) return { ok: false, error: "cancelled", message: "Cancelled." };
  const requestId = crypto.randomUUID();
  let text = "", started = false, parseError: unknown;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;
  const cancel = () => {
    // Native started acknowledgement prevents a cancellation-registration race.
    if (started) void invoke("cancel_ollama_stream", { requestId }).catch(() => {});
  };
  const parser = new ChatStreamDecoder(chunk => { text += chunk; options?.onChunk?.(chunk); });
  const resetTimeout = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { timedOut = true; cancel(); }, 120_000);
  };
  let unlisten: (() => void) | undefined;
  try {
    unlisten = await listen<RuntimeStreamEvent>("integrated-chat-stream", ({ payload }) => {
      if (payload.requestId !== requestId) return;
      if (payload.started) { started = true; resetTimeout(); }
      if (options?.signal?.aborted || timedOut) { cancel(); return; }
      if (parseError) return;
      try { parser.push(Uint8Array.from(payload.bytes)); resetTimeout(); }
      catch (error) { parseError = error; cancel(); }
    });
    if (options?.signal?.aborted) return { ok: false, error: "cancelled", message: "Cancelled." };
    options?.signal?.addEventListener("abort", cancel, { once: true });
    await invoke("integrated_chat_stream", {
      messages: [{ role: "system", content: BIAS_MITIGATION_GUARDRAIL }, ...messages], requestId,
    });
    if (options?.signal?.aborted) return { ok: false, error: "cancelled", message: "Cancelled." };
    if (parseError) throw parseError;
    parser.end();
    if (!text.trim()) return { ok: false, error: "model_error", message: "The integrated model returned an empty draft." };
    return { ok: true, value: text };
  } catch (error) {
    if (timedOut) return { ok: false, error: "timeout", message: "The integrated model stopped responding." };
    if (options?.signal?.aborted) return { ok: false, error: "cancelled", message: "Cancelled." };
    return { ok: false, error: "model_error", message: String(parseError ?? error) };
  } finally { clearTimeout(idleTimer); unlisten?.(); options?.signal?.removeEventListener("abort", cancel); }
}

let tail: Promise<void> = Promise.resolve();
let pending = 0;
export const integratedBackend: InferenceBackend = {
  id: "integrated",
  async checkConnection() {
    try {
      const model = await invoke<string | null>("integrated_runtime_model");
      return model ? { ok: true, value: undefined } :
        { ok: false, error: "not_configured", message: "Choose and load an integrated model first." };
    } catch (error) { return { ok: false, error: "connection_refused", message: String(error) }; }
  },
  async listModels() {
    const model = await invoke<string | null>("integrated_runtime_model");
    return model ? [model] : [];
  },
  async sendChat(messages, options) {
    if (pending > 0) options?.onQueued?.();
    pending++;
    const previous = tail;
    let release!: () => void;
    tail = new Promise(resolve => { release = resolve; });
    try { await previous; return await generate(messages, options); }
    finally { pending--; release(); }
  },
};
