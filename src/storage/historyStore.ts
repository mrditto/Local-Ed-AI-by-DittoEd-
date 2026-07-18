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
  SessionRecord,
  SessionSummary,
  SessionType,
  StoredChatMessage,
} from "./types";

const DB_NAME = "educatorllm-history";
const DB_VERSION = 1;
const DEBOUNCE_MS = 400;
const PREVIEW_MAX_CHARS = 120;
const LEGACY_MIGRATION_MARKER_KEY = "educatorllm-iep-migration-done";

interface HistoryDBSchema extends DBSchema {
  sessionSummaries: { key: string; value: SessionSummary };
  sessionBodies: { key: string; value: SessionRecord };
  projects: { key: string; value: Project };
}

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function truncate(text: string, max: number): string {
  const trimmed = text.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
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
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
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
  return debounceSave(`chat:${id}`, () => writeChatTurnNow(id, patch));
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
