import type { ChatRequestMessage, GenerationOptions, InferenceResult } from "./types";
import { checkConnection, listModels, sendChat } from "../ollama";

/** Transport owns request isolation, serialization and cancellation. */
export interface InferenceBackend {
  readonly id: "ollama" | "integrated";
  checkConnection(): Promise<InferenceResult<void>>;
  listModels(baseUrlOverride?: string): Promise<string[]>;
  sendChat(messages: ChatRequestMessage[], options?: GenerationOptions): Promise<InferenceResult<string>>;
}

const ollamaBackend: InferenceBackend = {
  id: "ollama",
  checkConnection,
  listModels,
  sendChat,
};

// Keep the existing engine until packaged integrated inference is validated.
export const activeBackend: InferenceBackend = ollamaBackend;
