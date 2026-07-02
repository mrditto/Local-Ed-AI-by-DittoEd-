import { useCallback, useEffect, useRef, useState } from "react";
import { sendChat, type ChatRequestMessage, type OllamaErrorKind } from "../api/ollama";

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
  const [isSending, setIsSending] = useState(false);
  const [lastErrorKind, setLastErrorKind] = useState<OllamaErrorKind | null>(null);
  const historyRef = useRef<ChatMessage[]>([]);

  useEffect(() => {
    historyRef.current = messages;
  }, [messages]);

  const sendMessage = useCallback(async (text: string, options?: SendMessageOptions) => {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;

    setLastErrorKind(null);
    setMessages((prev) => [...prev, { id: newId(), role: "user", text: trimmed }]);
    setIsSending(true);

    const outgoingText = options?.hiddenPrefix ? `${options.hiddenPrefix}${trimmed}` : trimmed;
    const conversation: ChatRequestMessage[] = historyRef.current
      .filter((message) => message.role !== "error")
      .map((message) => ({
        role: message.role === "assistant" ? "assistant" : "user",
        content: message.text,
      }));
    conversation.push({ role: "user", content: outgoingText });

    const result = await sendChat(conversation);

    if (result.ok) {
      setMessages((prev) => [...prev, { id: newId(), role: "assistant", text: result.value }]);
    } else {
      setLastErrorKind(result.error);
      setMessages((prev) => [...prev, { id: newId(), role: "error", text: result.message }]);
    }

    setIsSending(false);
  }, [isSending]);

  const reset = useCallback(() => {
    setMessages([]);
    setLastErrorKind(null);
    historyRef.current = [];
  }, []);

  return { messages, isSending, lastErrorKind, sendMessage, reset };
}
