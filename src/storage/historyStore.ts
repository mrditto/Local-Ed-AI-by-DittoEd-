import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import {
  buildInitialDraft,
  deriveIepSessionTitle,
  iepAnswerCount,
  readLegacyIepDraftFromStorage,
  type IepDraftState,
} from "../data/iepDraft";
import type {
  ChatSessionRecord,
  IepSessionRecord,
  Project,
  SavedFile,
  SessionRecord,
  SessionSummary,
  SessionType,
  StoredChatMessage,
} from "./types";

const DB_NAME = "educatorllm-history";
const DB_VERSION = 2;
const DEBOUNCE_MS = 400;
const PREVIEW_MAX_CHARS = 120;
const LEGACY_MIGRATION_MARKER_KEY = "educatorllm-iep-migration-done";
const MAX_SAVED_FILES = 50;

interface HistoryDBSchema extends DBSchema {
  sessionSummaries: { key: string; value: SessionSummary };
  sessionBodies: { key: string; value: SessionRecord };
  projects: { key: string; value: Project };
  savedFiles: { key: string; value: SavedFile };
}

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function truncate(text: string, max: number): string {
  const trimmed = text.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
}

/** Pinned sessions first, then most-recently-updated. */
function sortSummaries(summaries: SessionSummary[]): SessionSummary[] {
  return summaries.sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt);
}

let dbPromise: Promise<IDBPDatabase<HistoryDBSchema>> | null = null;

function getDb(): Promise<IDBPDatabase<HistoryDBSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<HistoryDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("sessionSummaries")) {
          db.createObjectStore("sessionSummaries", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("sessionBodies")) {
          db.createObjectStore("sessionBodies", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("projects")) {
          db.createObjectStore("projects", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("savedFiles")) {
          db.createObjectStore("savedFiles", { keyPath: "id" });
        }
      },
    });
  }
  return dbPromise;
}

// Per-session trailing debounce so rapid edits (e.g. every IEP-field keystroke)
// coalesce into one IndexedDB write instead of one per change.
const pendingSaves = new Map<string, ReturnType<typeof setTimeout>>();

function debounceSave(key: string, run: () => Promise<void>): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = pendingSaves.get(key);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      pendingSaves.delete(key);
      run().then(resolve, reject);
    }, DEBOUNCE_MS);
    pendingSaves.set(key, timer);
  });
}

async function writeChatTurnNow(id: string, patch: { messages: StoredChatMessage[]; title?: string }): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(["sessionBodies", "sessionSummaries"], "readwrite");
  const bodyStore = tx.objectStore("sessionBodies");
  const summaryStore = tx.objectStore("sessionSummaries");

  const existingBody = await bodyStore.get(id);
  if (!existingBody || existingBody.type !== "chat") {
    await tx.done;
    return;
  }

  const now = Date.now();
  const nextBody: ChatSessionRecord = {
    ...existingBody,
    messages: patch.messages,
    title: patch.title ?? existingBody.title,
    updatedAt: now,
  };
  await bodyStore.put(nextBody);

  const existingSummary = await summaryStore.get(id);
  const lastMessage = patch.messages[patch.messages.length - 1];
  const nextSummary: SessionSummary = {
    id,
    type: "chat",
    title: nextBody.title,
    projectId: existingSummary?.projectId ?? existingBody.projectId,
    createdAt: existingSummary?.createdAt ?? existingBody.createdAt,
    updatedAt: now,
    itemCount: patch.messages.length,
    preview: lastMessage ? truncate(lastMessage.text, PREVIEW_MAX_CHARS) : undefined,
    pinned: existingSummary?.pinned ?? false,
    promptId: nextBody.promptId,
    surface: nextBody.surface,
  };
  await summaryStore.put(nextSummary);

  await tx.done;
}

async function writeIepDraftNow(
  id: string,
  patch: { draft: IepDraftState; currentStep: number; title?: string },
): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(["sessionBodies", "sessionSummaries"], "readwrite");
  const bodyStore = tx.objectStore("sessionBodies");
  const summaryStore = tx.objectStore("sessionSummaries");

  const existingBody = await bodyStore.get(id);
  if (!existingBody || existingBody.type !== "iep") {
    await tx.done;
    return;
  }

  const now = Date.now();
  const title = patch.title ?? existingBody.title;
  const nextBody: IepSessionRecord = {
    ...existingBody,
    draft: patch.draft,
    currentStep: patch.currentStep,
    title,
    updatedAt: now,
  };
  await bodyStore.put(nextBody);

  const existingSummary = await summaryStore.get(id);
  const answered = iepAnswerCount(patch.draft);
  const nextSummary: SessionSummary = {
    id,
    type: "iep",
    title,
    projectId: existingSummary?.projectId ?? existingBody.projectId,
    createdAt: existingSummary?.createdAt ?? existingBody.createdAt,
    updatedAt: now,
    itemCount: answered,
    preview: `${answered} section${answered === 1 ? "" : "s"} answered`,
    pinned: existingSummary?.pinned ?? false,
  };
  await summaryStore.put(nextSummary);

  await tx.done;
}

async function runLegacyIepMigration(): Promise<void> {
  if (typeof localStorage === "undefined") return;
  if (localStorage.getItem(LEGACY_MIGRATION_MARKER_KEY)) return;

  try {
    const legacyDraft = readLegacyIepDraftFromStorage();
    if (legacyDraft && iepAnswerCount(legacyDraft) > 0) {
      const title = deriveIepSessionTitle(legacyDraft, "Recovered draft");
      const id = await createIepSession({ title });
      await writeIepDraftNow(id, { draft: legacyDraft, currentStep: 0, title });
    }
  } finally {
    // Set the marker even on failure so a corrupt legacy value can't retry-loop forever.
    localStorage.setItem(LEGACY_MIGRATION_MARKER_KEY, "1");
  }
}

let initPromise: Promise<void> | null = null;

export function initHistoryStore(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      await getDb();
      await runLegacyIepMigration();
    })();
  }
  return initPromise;
}

export async function listSessionSummaries(filter?: {
  projectId?: string | null;
  type?: SessionType;
}): Promise<SessionSummary[]> {
  const db = await getDb();
  let all = await db.getAll("sessionSummaries");
  if (filter?.projectId !== undefined) {
    all = all.filter((s) => s.projectId === filter.projectId);
  }
  if (filter?.type) {
    all = all.filter((s) => s.type === filter.type);
  }
  return sortSummaries(all);
}

/**
 * Full-text search across session titles/previews and full message/draft
 * content. Reads all session bodies in one bulk query — fine at the scale
 * of one teacher's personal history, and only runs on-demand (not on every
 * render), so it doesn't compromise the "don't load everything at startup"
 * goal the summary/body split exists for.
 */
export async function searchSessions(query: string): Promise<SessionSummary[]> {
  const q = query.trim().toLowerCase();
  if (!q) return listSessionSummaries();

  const db = await getDb();
  const [summaries, bodies] = await Promise.all([db.getAll("sessionSummaries"), db.getAll("sessionBodies")]);
  const bodyById = new Map(bodies.map((b) => [b.id, b]));

  const matches = summaries.filter((s) => {
    if (s.title.toLowerCase().includes(q)) return true;
    if (s.preview?.toLowerCase().includes(q)) return true;

    const body = bodyById.get(s.id);
    if (!body) return false;

    if (body.type === "chat") {
      return body.messages.some((m) => m.role !== "error" && m.text.toLowerCase().includes(q));
    }

    const sections = [...Object.values(body.draft.sections), ...Object.values(body.draft.repeatableSections).flat()];
    return sections.some((values) =>
      Object.values(values).some((value) => typeof value === "string" && value.toLowerCase().includes(q)),
    );
  });

  return sortSummaries(matches);
}

export async function getSessionBody(id: string): Promise<SessionRecord | null> {
  const db = await getDb();
  const record = await db.get("sessionBodies", id);
  return record ?? null;
}

export async function createChatSession(init: {
  title: string;
  promptId: string | null;
  surface: "prompt" | "assistant";
}): Promise<string> {
  const db = await getDb();
  const id = newId();
  const now = Date.now();

  const body: ChatSessionRecord = {
    id,
    schemaVersion: 1,
    type: "chat",
    title: init.title,
    projectId: null,
    promptId: init.promptId,
    surface: init.surface,
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
  const summary: SessionSummary = {
    id,
    type: "chat",
    title: init.title,
    projectId: null,
    createdAt: now,
    updatedAt: now,
    itemCount: 0,
    pinned: false,
    promptId: init.promptId,
    surface: init.surface,
  };

  const tx = db.transaction(["sessionBodies", "sessionSummaries"], "readwrite");
  await Promise.all([
    tx.objectStore("sessionBodies").put(body),
    tx.objectStore("sessionSummaries").put(summary),
    tx.done,
  ]);

  return id;
}

export function saveChatTurn(id: string, patch: { messages: StoredChatMessage[]; title?: string }): Promise<void> {
  // Chat turns write immediately: a debounced save could drop the final
  // assistant-reply write (e.g. on unmount/navigation), leaving history with
  // an incomplete, prompt-only transcript. IEP drafts still debounce because
  // they fire on every keystroke.
  return writeChatTurnNow(id, patch);
}

export async function createIepSession(init: { title: string }): Promise<string> {
  const db = await getDb();
  const id = newId();
  const now = Date.now();

  const body: IepSessionRecord = {
    id,
    schemaVersion: 1,
    type: "iep",
    title: init.title,
    projectId: null,
    createdAt: now,
    updatedAt: now,
    currentStep: 0,
    draft: buildInitialDraft(),
  };
  const summary: SessionSummary = {
    id,
    type: "iep",
    title: init.title,
    projectId: null,
    createdAt: now,
    updatedAt: now,
    itemCount: 0,
    pinned: false,
  };

  const tx = db.transaction(["sessionBodies", "sessionSummaries"], "readwrite");
  await Promise.all([
    tx.objectStore("sessionBodies").put(body),
    tx.objectStore("sessionSummaries").put(summary),
    tx.done,
  ]);

  return id;
}

export function saveIepDraft(
  id: string,
  patch: { draft: IepDraftState; currentStep: number; title?: string },
): Promise<void> {
  return debounceSave(`iep:${id}`, () => writeIepDraftNow(id, patch));
}

export async function renameSession(id: string, title: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(["sessionBodies", "sessionSummaries"], "readwrite");
  const bodyStore = tx.objectStore("sessionBodies");
  const summaryStore = tx.objectStore("sessionSummaries");
  const now = Date.now();

  const body = await bodyStore.get(id);
  if (body) await bodyStore.put({ ...body, title, updatedAt: now });

  const summary = await summaryStore.get(id);
  if (summary) await summaryStore.put({ ...summary, title, updatedAt: now });

  await tx.done;
}

export async function setSessionPinned(id: string, pinned: boolean): Promise<void> {
  const db = await getDb();
  const summary = await db.get("sessionSummaries", id);
  if (!summary) return;
  await db.put("sessionSummaries", { ...summary, pinned });
}

export async function moveSessionToProject(id: string, projectId: string | null): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(["sessionBodies", "sessionSummaries"], "readwrite");
  const bodyStore = tx.objectStore("sessionBodies");
  const summaryStore = tx.objectStore("sessionSummaries");
  const now = Date.now();

  const body = await bodyStore.get(id);
  if (body) await bodyStore.put({ ...body, projectId, updatedAt: now });

  const summary = await summaryStore.get(id);
  if (summary) await summaryStore.put({ ...summary, projectId, updatedAt: now });

  await tx.done;
}

export async function deleteSession(id: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(["sessionBodies", "sessionSummaries"], "readwrite");
  await Promise.all([
    tx.objectStore("sessionBodies").delete(id),
    tx.objectStore("sessionSummaries").delete(id),
    tx.done,
  ]);
}

export async function listProjects(): Promise<Project[]> {
  const db = await getDb();
  const all = await db.getAll("projects");
  return all.sort((a, b) => a.name.localeCompare(b.name));
}

export async function createProject(name: string): Promise<string> {
  const db = await getDb();
  const id = newId();
  const now = Date.now();
  await db.put("projects", { id, name, createdAt: now, updatedAt: now });
  return id;
}

export async function renameProject(id: string, name: string): Promise<void> {
  const db = await getDb();
  const existing = await db.get("projects", id);
  if (!existing) return;
  await db.put("projects", { ...existing, name, updatedAt: Date.now() });
}

// Ungroups member sessions rather than deleting them — a project is an
// organizational label, not a content-owning container.
export async function deleteProject(id: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(["sessionSummaries", "sessionBodies", "projects"], "readwrite");
  const summaryStore = tx.objectStore("sessionSummaries");
  const bodyStore = tx.objectStore("sessionBodies");

  const allSummaries = await summaryStore.getAll();
  const affected = allSummaries.filter((s) => s.projectId === id);
  for (const summary of affected) {
    await summaryStore.put({ ...summary, projectId: null });
    const body = await bodyStore.get(summary.id);
    if (body) await bodyStore.put({ ...body, projectId: null });
  }

  await tx.objectStore("projects").delete(id);
  await tx.done;
}

// ---------------------------------------------------------------------------
// Saved files (reusable attachment library)
// ---------------------------------------------------------------------------

export async function listSavedFiles(): Promise<SavedFile[]> {
  const db = await getDb();
  const all = await db.getAll("savedFiles");
  return all.sort((a, b) => b.addedAt - a.addedAt);
}

/** Adds a file to the reuse library, or just bumps its recency if the same name+length was already saved. */
export async function saveFileToLibrary(input: { fileName: string; text: string; truncated: boolean }): Promise<void> {
  const db = await getDb();
  const all = await db.getAll("savedFiles");
  const existing = all.find((f) => f.fileName === input.fileName && f.text.length === input.text.length);

  if (existing) {
    await db.put("savedFiles", { ...existing, addedAt: Date.now() });
    return;
  }

  await db.put("savedFiles", {
    id: newId(),
    fileName: input.fileName,
    text: input.text,
    truncated: input.truncated,
    addedAt: Date.now(),
  });

  const updated = await db.getAll("savedFiles");
  if (updated.length > MAX_SAVED_FILES) {
    const oldest = updated.sort((a, b) => a.addedAt - b.addedAt)[0];
    await db.delete("savedFiles", oldest.id);
  }
}

export async function deleteSavedFile(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("savedFiles", id);
}
