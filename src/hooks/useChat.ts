import { useCallback, useEffect, useRef, useState } from "react";
import { sendChat, type ChatRequestMessage, type OllamaErrorKind } from "../api/ollama";
import type { SessionAttachmentMeta } from "../storage/types";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "error";
  text: string;
  createdAt: number;
  attachment?: SessionAttachmentMeta;
  /** Wire content actually sent for this turn (hiddenPrefix + attachment + text). User messages only. */
  outgoingContent?: string;
  /** Teacher flagged this response as a problem worth reporting. */
  flagged?: boolean;
  /** Optional note the teacher left when flagging. */
  flagNote?: string;
}

interface SendMessageOptions {
  hiddenPrefix?: string;
  attachment?: SessionAttachmentMeta;
}

interface UseChatInitialState {
  messages: ChatMessage[];
  outgoingHistory: ChatRequestMessage[];
}

interface UseChatOptions {
  initialState?: UseChatInitialState;
  /** Fired after each completed turn (success or error) with the full updated transcript — lets a caller persist without useChat knowing about storage. */
  onTurnComplete?: (messages: ChatMessage[], outgoingHistory: ChatRequestMessage[]) => void;
}

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useChat(options?: UseChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => options?.initialState?.messages ?? []);
  const [isSending, setIsSending] = useState(false);
  const [isQueued, setIsQueued] = useState(false);
  const [lastErrorKind, setLastErrorKind] = useState<OllamaErrorKind | null>(null);
  const outgoingHistoryRef = useRef<ChatRequestMessage[]>(options?.initialState?.outgoingHistory ?? []);
  const onTurnCompleteRef = useRef(options?.onTurnComplete);
  onTurnCompleteRef.current = options?.onTurnComplete;

  // Cancels an in-flight generation if this hook's owning component
  // unmounts (e.g. the user navigates away mid-response) — otherwise the
  // request keeps streaming and burning CPU in the background even though
  // nothing is listening to it anymore.
  const abortControllerRef = useRef<AbortController | null>(null);
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // Authoritative synchronous copy of the transcript. React 18 batches state
  // updates even inside async functions, so a value captured via a
  // `setMessages(prev => ...)` closure is not reliably available immediately
  // after the call returns — this ref is, which is what onTurnComplete needs
  // to persist the *complete* turn (prompt + response) rather than racing
  // ahead with a stale/prompt-only array.
  const messagesRef = useRef<ChatMessage[]>(messages);

  const appendMessage = useCallback((message: ChatMessage): ChatMessage[] => {
    const next = [...messagesRef.current, message];
    messagesRef.current = next;
    setMessages(next);
    return next;
  }, []);

  const flagMessage = useCallback((id: string, note: string): void => {
    const next = messagesRef.current.map((m) => (m.id === id ? { ...m, flagged: true, flagNote: note } : m));
    messagesRef.current = next;
    setMessages(next);
  }, []);

  const sendMessage = useCallback(async (text: string, sendOptions?: SendMessageOptions) => {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;

    setLastErrorKind(null);
    const outgoingText = sendOptions?.hiddenPrefix ? `${sendOptions.hiddenPrefix}${trimmed}` : trimmed;
    const userMessage: ChatMessage = {
      id: newId(),
      role: "user",
      text: trimmed,
      createdAt: Date.now(),
      attachment: sendOptions?.attachment,
      outgoingContent: outgoingText,
    };
    appendMessage(userMessage);
    setIsSending(true);
    setIsQueued(false);

    const conversation: ChatRequestMessage[] = [
      ...outgoingHistoryRef.current,
      { role: "user", content: outgoingText },
    ];

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const result = await sendChat(conversation, {
      signal: controller.signal,
      onQueued: () => setIsQueued(true),
    });

    abortControllerRef.current = null;
    setIsQueued(false);

    if (result.ok === false && result.error === "cancelled") {
      // The panel was unmounted mid-generation; there's nothing left to
      // show the abandoned response to, and it was never going to be saved.
      setIsSending(false);
      return;
    }

    outgoingHistoryRef.current = conversation;

    let finalMessages: ChatMessage[];

    if (result.ok) {
      outgoingHistoryRef.current = [
        ...outgoingHistoryRef.current,
        { role: "assistant", content: result.value },
      ];
      finalMessages = appendMessage({
        id: newId(),
        role: "assistant",
        text: result.value,
        createdAt: Date.now(),
      });
    } else {
      setLastErrorKind(result.error);
      finalMessages = appendMessage({
        id: newId(),
        role: "error",
        text: result.message,
        createdAt: Date.now(),
      });
    }

    setIsSending(false);
    onTurnCompleteRef.current?.(finalMessages, outgoingHistoryRef.current);
  }, [isSending, appendMessage]);

  const reset = useCallback(() => {
    messagesRef.current = [];
    setMessages([]);
    setLastErrorKind(null);
    outgoingHistoryRef.current = [];
  }, []);

  return { messages, isSending, isQueued, lastErrorKind, sendMessage, reset, flagMessage };
}
