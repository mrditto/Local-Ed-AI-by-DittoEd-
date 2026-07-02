import { useCallback, useRef, useState } from "react";
import { sendChatMessage, type AnythingLLMErrorKind } from "../api/anythingllm";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "error";
  text: string;
}

interface SendMessageOptions {
  hiddenPrefix?: string;
}

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // One AnythingLLM thread per chat session — keeps context small and
  // prevents history bleeding between prompts/sessions.
  const sessionIdRef = useRef(`edu-${newId()}`);
  const [isSending, setIsSending] = useState(false);
  const [lastErrorKind, setLastErrorKind] = useState<AnythingLLMErrorKind | null>(null);

  const sendMessage = useCallback(async (text: string, options?: SendMessageOptions) => {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;

    setLastErrorKind(null);
    setMessages((prev) => [...prev, { id: newId(), role: "user", text: trimmed }]);
    setIsSending(true);

    const outgoingText = options?.hiddenPrefix ? `${options.hiddenPrefix}${trimmed}` : trimmed;
    const result = await sendChatMessage(outgoingText, sessionIdRef.current);

    if (result.ok) {
      setMessages((prev) => [...prev, { id: newId(), role: "assistant", text: result.text }]);
    } else {
      setLastErrorKind(result.error);
      setMessages((prev) => [...prev, { id: newId(), role: "error", text: result.message }]);
    }

    setIsSending(false);
  }, [isSending]);

  const reset = useCallback(() => {
    setMessages([]);
    setLastErrorKind(null);
    sessionIdRef.current = `edu-${newId()}`;
  }, []);

  return { messages, isSending, lastErrorKind, sendMessage, reset };
}
