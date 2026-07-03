import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useChat } from "../hooks/useChat";
import { checkConnection } from "../api/ollama";
import { DisclaimerFooter } from "./DisclaimerFooter";
import { VerifyFooter } from "./VerifyFooter";
import { Button } from "./ui/Button";
import { Spinner } from "./ui/Spinner";
import type { Prompt } from "../prompts";
import { extractTextFromFile } from "../utils/extractText";

interface ChatPanelProps {
  prompt: Prompt;
  onBack: () => void;
  initialMessage?: string;
  messagePreamble?: string;
}

type ConnectionState = "checking" | "ok" | "error";

interface PendingAttachment {
  fileName: string;
  text: string;
  truncated: boolean;
}

export function ChatPanel({ prompt, onBack, initialMessage, messagePreamble }: ChatPanelProps) {
  const { messages, isSending, sendMessage } = useChat();
  const [draft, setDraft] = useState(initialMessage ? "" : prompt.template);
  const [connectionState, setConnectionState] = useState<ConnectionState>("checking");
  const [connectionMessage, setConnectionMessage] = useState<string>("");
  const [attachment, setAttachment] = useState<PendingAttachment | null>(null);
  const [attachmentError, setAttachmentError] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
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
    (text: string, attachmentPrefix?: string) => {
      const isFirstSessionMessage = !hasSentFirstSessionMessage.current;
      hasSentFirstSessionMessage.current = true;
      const hiddenPrefixParts: string[] = [];
      if (isFirstSessionMessage && messagePreamble) {
        hiddenPrefixParts.push(`${messagePreamble}\n\nTeacher's request: `);
      }
      if (attachmentPrefix) {
        hiddenPrefixParts.push(attachmentPrefix);
      }
      const hiddenPrefix = hiddenPrefixParts.join("");
      if (hiddenPrefix.length > 0) {
        return sendMessage(text, { hiddenPrefix });
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
    const attachmentPrefix = attachment
      ? `Attached document "${attachment.fileName}":\n---\n${attachment.text}\n---\n\n`
      : undefined;
    setDraft("");
    await sendWithPreamble(text, attachmentPrefix);
    setAttachment(null);
    setAttachmentError("");
  }

  function handleAttachClick() {
    setAttachmentError("");
    fileInputRef.current?.click();
  }

  async function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = "";
    if (!file) return;

    const result = await extractTextFromFile(file);
    if (!result.ok) {
      setAttachment(null);
      setAttachmentError(result.message);
      return;
    }

    setAttachment({
      fileName: file.name,
      text: result.text,
      truncated: result.truncated,
    });
    setAttachmentError("");
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
        <div className="chat-input-main">
          {attachment && (
            <div className="attachment-chip">
              <span>
                {attachment.fileName}
                {attachment.truncated ? " (shortened to fit)" : ""}
              </span>
              <button
                type="button"
                className="attachment-chip-remove"
                onClick={() => setAttachment(null)}
                aria-label="Remove attached file"
                disabled={connectionState !== "ok" || isSending}
              >
                ×
              </button>
            </div>
          )}
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
          <div className="attachment-hint">
            Google Doc? Use File → Download → Microsoft Word (.docx), then attach it here.
          </div>
          {attachmentError && <div className="attachment-error">{attachmentError}</div>}
        </div>
        <div className="chat-input-actions">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.txt,.md"
            className="visually-hidden"
            onChange={handleFilePick}
            disabled={connectionState !== "ok" || isSending}
          />
          <Button
            type="button"
            variant="secondary"
            onClick={handleAttachClick}
            disabled={connectionState !== "ok" || isSending}
          >
            📎 Attach
          </Button>
          <Button type="submit" disabled={connectionState !== "ok" || isSending || !draft.trim()}>
            Send
          </Button>
        </div>
      </form>
    </div>
  );
}
