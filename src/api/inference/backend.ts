import type { ChatRequestMessage, GenerationOptions, InferenceResult } from "./types";
import { checkConnection, listModels, sendChat } from "../ollama";
import { integratedBackend } from "./integrated";

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
export const integratedBuild = import.meta.env.VITE_INTEGRATED_AI === "true";
export const activeBackend: InferenceBackend = integratedBuild ? integratedBackend : ollamaBackend;
