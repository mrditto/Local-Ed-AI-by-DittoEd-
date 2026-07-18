import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { Spinner } from "./ui/Spinner";
import {
  createProject,
  deleteProject,
  deleteSavedFile,
  deleteSession,
  listProjects,
  listSavedFiles,
  listSessionSummaries,
  moveSessionToProject,
  renameProject,
  renameSession,
  searchSessions,
  setSessionPinned,
} from "../storage/historyStore";
import type { Project, SavedFile, SessionSummary } from "../storage/types";

interface HistoryPanelProps {
  onBack: () => void;
  onResumeSession: (summary: SessionSummary) => void;
}

const TYPE_ICON: Record<SessionSummary["type"], string> = {
  chat: "💬",
  iep: "📋",
};

const TYPE_LABEL: Record<SessionSummary["type"], string> = {
  chat: "Chat",
  iep: "IEP draft",
};

const SEARCH_DEBOUNCE_MS = 250;

function formatRelativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const minute = 60_000;
  const hour = 3_600_000;
  const day = 86_400_000;
  if (diff < minute) return "just now";
  if (diff < hour) return `${Math.round(diff / minute)}m ago`;
  if (diff < day) return `${Math.round(diff / hour)}h ago`;
  if (diff < day * 7) return `${Math.round(diff / day)}d ago`;
  return new Date(ms).toLocaleDateString();
}

function formatBytes(chars: number): string {
  return chars < 1000 ? `${chars} chars` : `${(chars / 1000).toFixed(1)}k chars`;
}

export function HistoryPanel({ onBack, onResumeSession }: HistoryPanelProps) {
  const [allSummaries, setAllSummaries] = useState<SessionSummary[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [savedFiles, setSavedFiles] = useState<SavedFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<"all" | "uncategorized" | string>("all");
  const [searchInput, setSearchInput] = useState("");
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [renamingProjectId, setRenamingProjectId] = useState<string | null>(null);
  const [projectNameDraft, setProjectNameDraft] = useState("");
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null);
  const [sessionTitleDraft, setSessionTitleDraft] = useState("");
  const [movingSessionId, setMovingSessionId] = useState<string | null>(null);
  const [confirmDeleteSessionId, setConfirmDeleteSessionId] = useState<string | null>(null);

  const refresh = useCallback(async (query: string) => {
    const trimmed = query.trim();
    const [nextSummaries, nextProjects, nextFiles] = await Promise.all([
      trimmed ? searchSessions(trimmed) : listSessionSummaries(),
      listProjects(),
      listSavedFiles(),
    ]);
    setAllSummaries(nextSummaries);
    setProjects(nextProjects);
    setSavedFiles(nextFiles);
    setIsLoading(false);
  }, []);

  // Loads immediately on mount; debounces subsequent search-as-you-type so
  // IndexedDB isn't re-queried on every keystroke.
  const isFirstRun = useRef(true);
  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      void refresh(searchInput);
      return;
    }
    const timer = setTimeout(() => {
      void refresh(searchInput);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput, refresh]);

  const visibleSummaries = allSummaries.filter((s) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "uncategorized") return s.projectId === null;
    return s.projectId === activeFilter;
  });

  const activeProject = projects.find((p) => p.id === activeFilter) ?? null;

  async function handleCreateProject() {
    const name = newProjectName.trim();
    setIsCreatingProject(false);
    setNewProjectName("");
    if (!name) return;
    const id = await createProject(name);
    setActiveFilter(id);
    await refresh(searchInput);
  }

  async function handleRenameProject(id: string) {
    const name = projectNameDraft.trim();
    setRenamingProjectId(null);
    if (name) await renameProject(id, name);
    await refresh(searchInput);
  }

  async function handleDeleteProject(id: string) {
    await deleteProject(id);
    if (activeFilter === id) setActiveFilter("all");
    await refresh(searchInput);
  }

  async function handleRenameSession(id: string) {
    const title = sessionTitleDraft.trim();
    setRenamingSessionId(null);
    if (title) await renameSession(id, title);
    await refresh(searchInput);
  }

  async function handleTogglePin(summary: SessionSummary) {
    await setSessionPinned(summary.id, !summary.pinned);
    await refresh(searchInput);
  }

  async function handleMoveSession(id: string, projectId: string) {
    await moveSessionToProject(id, projectId === "" ? null : projectId);
    setMovingSessionId(null);
    await refresh(searchInput);
  }

  async function handleDeleteSession(id: string) {
    await deleteSession(id);
    setConfirmDeleteSessionId(null);
    await refresh(searchInput);
  }

  async function handleDeleteSavedFile(id: string) {
    await deleteSavedFile(id);
    await refresh(searchInput);
  }

  return (
    <div className="history-panel">
      <header className="wizard-header">
        <Button variant="ghost" onClick={onBack}>
          ← Back to library
        </Button>
        <h2>History</h2>
      </header>

      <div className="settings-field history-search-field">
        <input
          type="search"
          value={searchInput}
          placeholder="Search chats and IEP drafts…"
          onChange={(e) => setSearchInput(e.currentTarget.value)}
        />
      </div>

      <div className="history-chip-row">
        <button
          type="button"
          className={`history-chip ${activeFilter === "all" ? "history-chip-active" : ""}`.trim()}
          onClick={() => setActiveFilter("all")}
        >
          All
        </button>
        <button
          type="button"
          className={`history-chip ${activeFilter === "uncategorized" ? "history-chip-active" : ""}`.trim()}
          onClick={() => setActiveFilter("uncategorized")}
        >
          Uncategorized
        </button>
        {projects.map((project) => (
          <button
            key={project.id}
            type="button"
            className={`history-chip ${activeFilter === project.id ? "history-chip-active" : ""}`.trim()}
            onClick={() => setActiveFilter(project.id)}
          >
            {project.name}
          </button>
        ))}
        {isCreatingProject ? (
          <span className="history-inline-edit">
            <input
              autoFocus
              type="text"
              value={newProjectName}
              placeholder="Project name"
              onChange={(e) => setNewProjectName(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleCreateProject();
                if (e.key === "Escape") {
                  setIsCreatingProject(false);
                  setNewProjectName("");
                }
              }}
            />
            <Button type="button" variant="secondary" onClick={() => void handleCreateProject()}>
              Add
            </Button>
          </span>
        ) : (
          <button type="button" className="history-chip history-chip-new" onClick={() => setIsCreatingProject(true)}>
            + New project
          </button>
        )}
      </div>

      {activeProject && (
        <div className="history-project-actions">
          {renamingProjectId === activeProject.id ? (
            <span className="history-inline-edit">
              <input
                autoFocus
                type="text"
                value={projectNameDraft}
                onChange={(e) => setProjectNameDraft(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleRenameProject(activeProject.id);
                  if (e.key === "Escape") setRenamingProjectId(null);
                }}
              />
              <Button type="button" variant="secondary" onClick={() => void handleRenameProject(activeProject.id)}>
                Save
              </Button>
            </span>
          ) : (
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setRenamingProjectId(activeProject.id);
                  setProjectNameDraft(activeProject.name);
                }}
              >
                Rename project
              </Button>
              <Button type="button" variant="ghost" onClick={() => void handleDeleteProject(activeProject.id)}>
                Delete project
              </Button>
            </>
          )}
        </div>
      )}

      {isLoading && <Spinner label="Loading history…" />}

      {!isLoading && visibleSummaries.length === 0 && (
        <p className="settings-hint history-empty">
          {searchInput.trim()
            ? "No chats or IEP drafts match that search."
            : "Nothing here yet. Chats and IEP drafts you start will be saved automatically."}
        </p>
      )}

      <div className="history-grid">
        {visibleSummaries.map((summary) => (
          <Card key={summary.id} className="history-card">
            <div
              className="history-card-open"
              role="button"
              tabIndex={0}
              onClick={() => onResumeSession(summary)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onResumeSession(summary);
                }
              }}
            >
              <span className="history-card-type">
                {summary.pinned ? "★ " : ""}
                {TYPE_ICON[summary.type]} {TYPE_LABEL[summary.type]}
              </span>
              <h3 className="history-card-title">{summary.title}</h3>
              <p className="history-card-meta">
                {formatRelativeTime(summary.updatedAt)} • {summary.itemCount}{" "}
                {summary.type === "chat" ? "message" : "section"}
                {summary.itemCount === 1 ? "" : "s"}
              </p>
              {summary.preview && <p className="history-card-preview">{summary.preview}</p>}
            </div>

            {renamingSessionId === summary.id ? (
              <div className="history-inline-edit">
                <input
                  autoFocus
                  type="text"
                  value={sessionTitleDraft}
                  onChange={(e) => setSessionTitleDraft(e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleRenameSession(summary.id);
                    if (e.key === "Escape") setRenamingSessionId(null);
                  }}
                />
                <Button type="button" variant="secondary" onClick={() => void handleRenameSession(summary.id)}>
                  Save
                </Button>
              </div>
            ) : movingSessionId === summary.id ? (
              <div className="settings-field history-inline-edit">
                <select
                  autoFocus
                  defaultValue={summary.projectId ?? ""}
                  onChange={(e) => void handleMoveSession(summary.id, e.currentTarget.value)}
                  onBlur={() => setMovingSessionId(null)}
                >
                  <option value="">Uncategorized</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : confirmDeleteSessionId === summary.id ? (
              <div className="history-confirm-row">
                <span>Delete this {summary.type === "chat" ? "chat" : "draft"}?</span>
                <Button type="button" variant="secondary" onClick={() => void handleDeleteSession(summary.id)}>
                  Delete
                </Button>
                <Button type="button" variant="ghost" onClick={() => setConfirmDeleteSessionId(null)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="history-card-actions">
                <Button type="button" variant="ghost" onClick={() => void handleTogglePin(summary)}>
                  {summary.pinned ? "Unpin" : "Pin"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setRenamingSessionId(summary.id);
                    setSessionTitleDraft(summary.title);
                  }}
                >
                  Rename
                </Button>
                <Button type="button" variant="ghost" onClick={() => setMovingSessionId(summary.id)}>
                  Move
                </Button>
                <Button type="button" variant="ghost" onClick={() => setConfirmDeleteSessionId(summary.id)}>
                  Delete
                </Button>
              </div>
            )}
          </Card>
        ))}
      </div>

      {savedFiles.length > 0 && (
        <details className="settings-advanced history-saved-files">
          <summary>Saved files ({savedFiles.length})</summary>
          <ul className="history-saved-files-list">
            {savedFiles.map((file) => (
              <li key={file.id} className="history-saved-file-row">
                <span>
                  {file.fileName}
                  <span className="settings-hint"> — {formatBytes(file.text.length)}</span>
                </span>
                <Button type="button" variant="ghost" onClick={() => void handleDeleteSavedFile(file.id)}>
                  Delete
                </Button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
