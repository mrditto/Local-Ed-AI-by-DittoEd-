export type ChatRole = "system" | "user" | "assistant";
export interface ChatRequestMessage {
  role: ChatRole;
  content: string;
}
export type InferenceErrorKind =
  | "not_configured"
  | "connection_refused"
  | "timeout"
  | "model_missing"
  | "model_error"
  | "cancelled"
  | "unknown";
export type InferenceResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: InferenceErrorKind; message: string };
export interface GenerationOptions {
  signal?: AbortSignal;
  onQueued?: () => void;
  /** Incremental text; the completed result remains the authoritative draft. */
  onChunk?: (text: string) => void;
}
