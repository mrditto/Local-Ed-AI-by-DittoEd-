import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useChat } from "../hooks/useChat";
import { checkConnection } from "../api/anythingllm";
import { DisclaimerFooter } from "./DisclaimerFooter";
import { VerifyFooter } from "./VerifyFooter";
import { Button } from "./ui/Button";
import { Spinner } from "./ui/Spinner";
import type { Prompt } from "../prompts";

interface ChatPanelProps {
  prompt: Prompt;
  onBack: () => void;
  initialMessage?: string;
}

type ConnectionState = "checking" | "ok" | "error";

export function ChatPanel({ prompt, onBack, initialMessage }: ChatPanelProps) {
  const { messages, isSending, sendMessage } = useChat();
  const [draft, setDraft] = useState(initialMessage ? "" : prompt.template);
  const [connectionState, setConnectionState] = useState<ConnectionState>("checking");
  const [connectionMessage, setConnectionMessage] = useState<string>("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const hasSentInitialMessage = useRef(false);

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

  useEffect(() => {
    if (connectionState !== "ok" || hasSentInitialMessage.current) return;
    const message = initialMessage?.trim();
    if (!message) return;
    hasSentInitialMessage.current = true;
    void sendMessage(message);
  }, [connectionState, initialMessage, sendMessage]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (connectionState !== "ok") return;
    const text = draft;
    setDraft("");
    await sendMessage(text);
  }

  return (
    <div className="chat-panel">
      <header className="chat-panel-header">
        <Button variant="ghost" onClick={onBack}>
          ← Back to library
        </Button>
        <h2>{prompt.title}</h2>
      </header>

      {connectionState === "checking" && <Spinner label="Checking AnythingLLM connection…" />}

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
          placeholder="Edit the prompt or type your own message…"
          disabled={connectionState !== "ok" || isSending}
        />
        <Button type="submit" disabled={connectionState !== "ok" || isSending || !draft.trim()}>
          Send
        </Button>
      </form>
    </div>
  );
}
