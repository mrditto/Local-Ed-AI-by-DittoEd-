import { useCallback, useEffect, useState } from "react";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { Spinner } from "./ui/Spinner";
import {
  createProject,
  deleteProject,
  deleteSession,
  listProjects,
  listSessionSummaries,
  moveSessionToProject,
  renameProject,
  renameSession,
} from "../storage/historyStore";
import type { Project, SessionSummary } from "../storage/types";

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

export function HistoryPanel({ onBack, onResumeSession }: HistoryPanelProps) {
  const [summaries, setSummaries] = useState<SessionSummary[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<"all" | "uncategorized" | string>("all");
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [renamingProjectId, setRenamingProjectId] = useState<string | null>(null);
  const [projectNameDraft, setProjectNameDraft] = useState("");
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null);
  const [sessionTitleDraft, setSessionTitleDraft] = useState("");
  const [movingSessionId, setMovingSessionId] = useState<string | null>(null);
  const [confirmDeleteSessionId, setConfirmDeleteSessionId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [nextSummaries, nextProjects] = await Promise.all([listSessionSummaries(), listProjects()]);
    setSummaries(nextSummaries);
    setProjects(nextProjects);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const visibleSummaries = summaries.filter((s) => {
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
    await refresh();
  }

  async function handleRenameProject(id: string) {
    const name = projectNameDraft.trim();
    setRenamingProjectId(null);
    if (name) await renameProject(id, name);
    await refresh();
  }

  async function handleDeleteProject(id: string) {
    await deleteProject(id);
    if (activeFilter === id) setActiveFilter("all");
    await refresh();
  }

  async function handleRenameSession(id: string) {
    const title = sessionTitleDraft.trim();
    setRenamingSessionId(null);
    if (title) await renameSession(id, title);
    await refresh();
  }

  async function handleMoveSession(id: string, projectId: string) {
    await moveSessionToProject(id, projectId === "" ? null : projectId);
    setMovingSessionId(null);
    await refresh();
  }

  async function handleDeleteSession(id: string) {
    await deleteSession(id);
    setConfirmDeleteSessionId(null);
    await refresh();
  }

  return (
    <div className="history-panel">
      <header className="wizard-header">
        <Button variant="ghost" onClick={onBack}>
          ← Back to library
        </Button>
        <h2>History</h2>
      </header>

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
          Nothing here yet. Chats and IEP drafts you start will be saved automatically.
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
    </div>
  );
}
