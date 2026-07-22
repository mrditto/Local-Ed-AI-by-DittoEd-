import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useChat, type ChatMessage } from "../hooks/useChat";
import { checkConnection, type ChatRequestMessage } from "../api/ollama";
import { DisclaimerFooter } from "./DisclaimerFooter";
import { VerifyFooter } from "./VerifyFooter";
import { MessageActions } from "./MessageActions";
import { Button } from "./ui/Button";
import { Spinner } from "./ui/Spinner";
import type { Prompt } from "../prompts";
import { extractTextFromFile } from "../utils/extractText";
import {
  buildPersonalizationPreamble,
  lengthInstruction,
  loadPersonalization,
  toneInstruction,
  type Personalization,
} from "../config/personalization";
import { createChatSession, getSessionBody, listSavedFiles, saveChatTurn, saveFileToLibrary } from "../storage/historyStore";
import type { SavedFile, SessionAttachmentMeta, StoredChatMessage } from "../storage/types";

interface ChatPanelProps {
  prompt: Prompt;
  onBack: () => void;
  initialMessage?: string;
  messagePreamble?: string;
  surface: "prompt" | "assistant";
  resumeSessionId?: string;
}

type ConnectionState = "checking" | "ok" | "error";

interface PendingAttachment {
  fileName: string;
  text: string;
  truncated: boolean;
}

interface ChatResumeState {
  messages: ChatMessage[];
  outgoingHistory: ChatRequestMessage[];
}

function deriveOutgoingHistory(messages: ChatMessage[]): ChatRequestMessage[] {
  const history: ChatRequestMessage[] = [];
  for (const msg of messages) {
    if (msg.role === "user") {
      history.push({ role: "user", content: msg.outgoingContent ?? msg.text });
    } else if (msg.role === "assistant") {
      history.push({ role: "assistant", content: msg.text });
    }
  }
  return history;
}

function deriveChatSessionTitle(prompt: Prompt, messages: ChatMessage[]): string {
  const firstUser = messages.find((m) => m.role === "user");
  const trimmed = firstUser?.text.trim() ?? "";
  if (!trimmed) return prompt.title;
  const snippet = trimmed.length > 40 ? `${trimmed.slice(0, 40)}…` : trimmed;
  return `${prompt.title}: ${snippet}`;
}

function toStoredMessages(messages: ChatMessage[]): StoredChatMessage[] {
  return messages.map((m) => ({
    id: m.id,
    role: m.role,
    text: m.text,
    createdAt: m.createdAt,
    attachment: m.attachment,
    outgoingContent: m.outgoingContent,
  }));
}

/** Loads a resumed session's messages before mounting the chat itself — useChat's initial state is only read once, on mount. */
export function ChatPanel(props: ChatPanelProps) {
  const { resumeSessionId, prompt, onBack } = props;
  const [resumeState, setResumeState] = useState<ChatResumeState | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(Boolean(resumeSessionId));

  useEffect(() => {
    if (!resumeSessionId) return;
    let cancelled = false;
    (async () => {
      const record = await getSessionBody(resumeSessionId);
      if (cancelled) return;
      if (record && record.type === "chat") {
        setResumeState({
          messages: record.messages,
          outgoingHistory: deriveOutgoingHistory(record.messages),
        });
      }
      setIsLoadingSession(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [resumeSessionId]);

  if (isLoadingSession) {
    return (
      <div className="chat-panel">
        <header className="chat-panel-header">
          <Button variant="ghost" onClick={onBack}>
            ← Back to library
          </Button>
          <h2>{prompt.title}</h2>
        </header>
        <Spinner label="Loading chat…" />
      </div>
    );
  }

  return (
    <ChatPanelBody
      {...props}
      initialSessionId={resumeSessionId ?? null}
      initialState={resumeState ?? undefined}
    />
  );
}

interface ChatPanelBodyProps extends ChatPanelProps {
  initialSessionId: string | null;
  initialState?: ChatResumeState;
}

function ChatPanelBody({
  prompt,
  onBack,
  initialMessage,
  messagePreamble,
  surface,
  initialSessionId,
  initialState,
}: ChatPanelBodyProps) {
  const sessionIdRef = useRef<string | null>(initialSessionId);
  // Guards against creating two sessions if messages change again before the
  // first createChatSession promise resolves.
  const sessionCreationRef = useRef<Promise<string> | null>(null);

  const { messages, isSending, sendMessage, reset } = useChat({ initialState });

  // Persist the full transcript straight from the live `messages` array
  // whenever it changes. Saving from `messages` (rather than a turn-complete
  // callback) guarantees history keeps both the teacher prompt and the LLM
  // response, and never a prompt-only snapshot.
  useEffect(() => {
    if (messages.length === 0) return;
    let cancelled = false;
    void (async () => {
      if (!sessionIdRef.current) {
        if (!sessionCreationRef.current) {
          sessionCreationRef.current = createChatSession({
            title: deriveChatSessionTitle(prompt, messages),
            promptId: surface === "assistant" ? null : prompt.id,
            surface,
          });
        }
        sessionIdRef.current = await sessionCreationRef.current;
      }
      // A newer `messages` render superseded this one — let its effect write
      // the complete transcript instead of racing a stale snapshot in behind it.
      if (cancelled) return;
      await saveChatTurn(sessionIdRef.current, {
        messages: toStoredMessages(messages),
        title: deriveChatSessionTitle(prompt, messages),
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [messages, prompt, surface]);
  const [personalization] = useState(() => loadPersonalization());
  const [draft, setDraft] = useState(initialMessage ? "" : prompt.template);
  const [tone, setTone] = useState<Personalization["tone"]>(personalization.tone);
  const [length, setLength] = useState<Personalization["length"]>(personalization.length);
  const [connectionState, setConnectionState] = useState<ConnectionState>("checking");
  const [connectionMessage, setConnectionMessage] = useState<string>("");
  const [attachment, setAttachment] = useState<PendingAttachment | null>(null);
  const [attachmentError, setAttachmentError] = useState<string>("");
  const [showLibraryPicker, setShowLibraryPicker] = useState(false);
  const [libraryFiles, setLibraryFiles] = useState<SavedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const hasSentInitialMessage = useRef(false);
  const hasSentFirstSessionMessage = useRef(messages.length > 0);
  const lastAppliedTone = useRef<Personalization["tone"] | null>(null);
  const lastAppliedLength = useRef<Personalization["length"] | null>(null);

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
    (text: string, attachmentPrefix?: string, attachmentMeta?: SessionAttachmentMeta) => {
      const isFirstSessionMessage = !hasSentFirstSessionMessage.current;
      hasSentFirstSessionMessage.current = true;
      const hiddenPrefixParts: string[] = [];
      if (isFirstSessionMessage) {
        const personalizationPreamble = buildPersonalizationPreamble(personalization, {
          tone,
          length,
        });
        if (messagePreamble) {
          hiddenPrefixParts.push(`${messagePreamble}\n\n`);
        }
        if (personalizationPreamble) {
          hiddenPrefixParts.push(`${personalizationPreamble}\n\n`);
        }
        if (messagePreamble || personalizationPreamble) {
          hiddenPrefixParts.push("Teacher's request: ");
        }
        lastAppliedTone.current = tone;
        lastAppliedLength.current = length;
      } else {
        const toneChanged = lastAppliedTone.current !== tone;
        const lengthChanged = lastAppliedLength.current !== length;
        if (toneChanged || lengthChanged) {
          hiddenPrefixParts.push(
            `(From now on: ${toneInstruction(tone)} ${lengthInstruction(length)}) `,
          );
          lastAppliedTone.current = tone;
          lastAppliedLength.current = length;
        }
      }
      if (attachmentPrefix) {
        hiddenPrefixParts.push(attachmentPrefix);
      }
      const hiddenPrefix = hiddenPrefixParts.join("");
      const sendOptions = {
        ...(hiddenPrefix.length > 0 ? { hiddenPrefix } : {}),
        ...(attachmentMeta ? { attachment: attachmentMeta } : {}),
      };
      return sendMessage(text, sendOptions);
    },
    [length, messagePreamble, personalization, sendMessage, tone],
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
    const attachmentMeta: SessionAttachmentMeta | undefined = attachment
      ? { fileName: attachment.fileName, charCount: attachment.text.length, truncated: attachment.truncated }
      : undefined;
    setDraft("");
    await sendWithPreamble(text, attachmentPrefix, attachmentMeta);
    setAttachment(null);
    setAttachmentError("");
  }

  function handleAttachClick() {
    setAttachmentError("");
    setShowLibraryPicker(false);
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
    void saveFileToLibrary({ fileName: file.name, text: result.text, truncated: result.truncated });
  }

  async function handleOpenLibraryPicker() {
    setAttachmentError("");
    const files = await listSavedFiles();
    setLibraryFiles(files);
    setShowLibraryPicker((prev) => !prev);
  }

  function handlePickFromLibrary(file: SavedFile) {
    setAttachment({ fileName: file.fileName, text: file.text, truncated: file.truncated });
    setShowLibraryPicker(false);
  }

  function handleNewChat() {
    reset();
    sessionIdRef.current = null;
    sessionCreationRef.current = null;
    setDraft(prompt.template);
    setAttachment(null);
    setAttachmentError("");
    setShowLibraryPicker(false);
    hasSentFirstSessionMessage.current = false;
    hasSentInitialMessage.current = true;
    lastAppliedTone.current = null;
    lastAppliedLength.current = null;
  }

  return (
    <div className="chat-panel">
      <header className="chat-panel-header">
        <Button variant="ghost" onClick={onBack}>
          ← Back to library
        </Button>
        <h2>{prompt.title}</h2>
        <Button variant="ghost" className="chat-panel-new-chat" onClick={handleNewChat} disabled={isSending}>
          + New chat
        </Button>
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
            {msg.role === "assistant" && (
              <MessageActions
                markdown={msg.text}
                disabled={isSending}
                defaultFilenameSeed={{ title: deriveChatSessionTitle(prompt, messages), fallbackText: msg.text }}
              />
            )}
            {msg.role === "assistant" && <DisclaimerFooter />}
            {msg.role === "assistant" && prompt.category === "sped" && <VerifyFooter />}
          </div>
        ))}
        {isSending && <Spinner label="Thinking…" />}
        <div ref={bottomRef} />
      </div>

      <div className="chat-personalization-row">
        <div className="settings-field chat-personalization-field">
          <label htmlFor="chat-tone">Tone</label>
          <select
            id="chat-tone"
            value={tone}
            onChange={(e) => setTone(e.currentTarget.value as Personalization["tone"])}
            disabled={connectionState !== "ok" || isSending}
          >
            <option value="professional">Professional</option>
            <option value="friendly">Friendly</option>
            <option value="casual">Casual</option>
          </select>
        </div>
        <div className="settings-field chat-personalization-field">
          <label htmlFor="chat-length">Length</label>
          <select
            id="chat-length"
            value={length}
            onChange={(e) => setLength(e.currentTarget.value as Personalization["length"])}
            disabled={connectionState !== "ok" || isSending}
          >
            <option value="short">Short</option>
            <option value="standard">Standard</option>
            <option value="detailed">Detailed</option>
          </select>
        </div>
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
          {showLibraryPicker && (
            <div className="chat-library-picker">
              {libraryFiles.length === 0 ? (
                <p className="settings-hint">No saved files yet — attach a file to add one.</p>
              ) : (
                <ul className="history-saved-files-list">
                  {libraryFiles.map((file) => (
                    <li key={file.id} className="history-saved-file-row">
                      <button
                        type="button"
                        className="chat-library-picker-item"
                        onClick={() => handlePickFromLibrary(file)}
                      >
                        {file.fileName}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
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
          <Button
            type="button"
            variant="secondary"
            onClick={() => void handleOpenLibraryPicker()}
            disabled={connectionState !== "ok" || isSending}
          >
            From library
          </Button>
          <Button type="submit" disabled={connectionState !== "ok" || isSending || !draft.trim()}>
            Send
          </Button>
        </div>
      </form>
    </div>
  );
}
