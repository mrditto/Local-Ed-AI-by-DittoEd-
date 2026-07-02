import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useChat } from "../hooks/useChat";
import { checkConnection } from "../api/ollama";
import { DisclaimerFooter } from "./DisclaimerFooter";
import { VerifyFooter } from "./VerifyFooter";
import { Button } from "./ui/Button";
import { Spinner } from "./ui/Spinner";
import type { Prompt } from "../prompts";

interface ChatPanelProps {
  prompt: Prompt;
  onBack: () => void;
  initialMessage?: string;
  messagePreamble?: string;
}

type ConnectionState = "checking" | "ok" | "error";

export function ChatPanel({ prompt, onBack, initialMessage, messagePreamble }: ChatPanelProps) {
  const { messages, isSending, sendMessage } = useChat();
  const [draft, setDraft] = useState(initialMessage ? "" : prompt.template);
  const [connectionState, setConnectionState] = useState<ConnectionState>("checking");
  const [connectionMessage, setConnectionMessage] = useState<string>("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const hasSentInitialMessage = useRef(false);
  const hasSentFirstSessionMessage = useRef(false);

  useEffect(() => {
    let cancelled = false;
    checkConnection().then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setConnectionState("ok");
      } else {
        setConnectionState("error");
        setConnectionMessage(result.message);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendWithPreamble = useCallback(
    (text: string) => {
      const isFirstSessionMessage = !hasSentFirstSessionMessage.current;
      hasSentFirstSessionMessage.current = true;
      if (isFirstSessionMessage && messagePreamble) {
        return sendMessage(text, {
          hiddenPrefix: `${messagePreamble}\n\nTeacher's request: `,
        });
      }
      return sendMessage(text);
    },
    [messagePreamble, sendMessage],
  );

  useEffect(() => {
    if (connectionState !== "ok" || hasSentInitialMessage.current) return;
    const message = initialMessage?.trim();
    if (!message) return;
    hasSentInitialMessage.current = true;
    void sendWithPreamble(message);
  }, [connectionState, initialMessage, sendWithPreamble]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (connectionState !== "ok") return;
    const text = draft;
    setDraft("");
    await sendWithPreamble(text);
  }

  return (
    <div className="chat-panel">
      <header className="chat-panel-header">
        <Button variant="ghost" onClick={onBack}>
          ← Back to library
        </Button>
        <h2>{prompt.title}</h2>
      </header>

      {connectionState === "checking" && <Spinner label="Checking Ollama connection…" />}

      {connectionState === "error" && (
        <div className="connection-banner connection-banner-error">{connectionMessage}</div>
      )}

      <div className="chat-messages">
        {messages.map((msg) => (
          <div key={msg.id} className={`chat-message chat-message-${msg.role}`}>
            {msg.role === "assistant" ? (
              <div className="chat-message-markdown">
                <ReactMarkdown>{msg.text}</ReactMarkdown>
              </div>
            ) : (
              <p>{msg.text}</p>
            )}
            {msg.role === "assistant" && <DisclaimerFooter />}
            {msg.role === "assistant" && prompt.category === "sped" && <VerifyFooter />}
          </div>
        ))}
        {isSending && <Spinner label="Thinking…" />}
        <div ref={bottomRef} />
      </div>

      <form className="chat-input-row" onSubmit={handleSubmit}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.currentTarget.value)}
          rows={4}
          placeholder={
            prompt.template.trim().length > 0
              ? "Edit the prompt or type your own message…"
              : "Describe what you need help with…"
          }
          disabled={connectionState !== "ok" || isSending}
        />
        <Button type="submit" disabled={connectionState !== "ok" || isSending || !draft.trim()}>
          Send
        </Button>
      </form>
    </div>
  );
}
