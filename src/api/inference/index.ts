import { activeBackend } from "./backend";
export type { ChatRequestMessage, ChatRole, GenerationOptions, InferenceErrorKind, InferenceResult } from "./types";
export const checkConnection = activeBackend.checkConnection;
export const listModels = activeBackend.listModels;
export const sendChat = activeBackend.sendChat;
