import type { IepDraftState } from "../data/iepDraft";

export type SessionType = "chat" | "iep";

export interface SessionAttachmentMeta {
  fileName: string;
  charCount: number;
  truncated: boolean;
}

export interface StoredChatMessage {
  id: string;
  role: "user" | "assistant" | "error";
  /** Visible text, as rendered in the transcript. */
  text: string;
  /**
   * The exact wire content sent to Ollama for this turn (hidden preamble +
   * attachment text + visible text), user turns only. Persisted so a resumed
   * session's next request carries the same context the original one did.
   */
  outgoingContent?: string;
  attachment?: SessionAttachmentMeta;
  createdAt: number;
}

interface SessionRecordBase {
  id: string;
  schemaVersion: 1;
  title: string;
  /** null = uncategorized */
  projectId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface ChatSessionRecord extends SessionRecordBase {
  type: "chat";
  /** Library prompt id this chat was started from; null for "Ask DittoEd". */
  promptId: string | null;
  surface: "prompt" | "assistant";
  messages: StoredChatMessage[];
}

export interface IepSessionRecord extends SessionRecordBase {
  type: "iep";
  currentStep: number;
  draft: IepDraftState;
}

export type SessionRecord = ChatSessionRecord | IepSessionRecord;

/** Lightweight projection for list views — no message/draft body. */
export interface SessionSummary {
  id: string;
  type: SessionType;
  title: string;
  projectId: string | null;
  createdAt: number;
  updatedAt: number;
  itemCount: number;
  preview?: string;
  pinned: boolean;
  /** Chat sessions only — lets "resume" route without fetching the full body. */
  promptId?: string | null;
  surface?: "prompt" | "assistant";
}

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

/** A reusable attachment a teacher has uploaded before, so it can be re-attached without re-uploading. */
export interface SavedFile {
  id: string;
  fileName: string;
  text: string;
  truncated: boolean;
  addedAt: number;
}
