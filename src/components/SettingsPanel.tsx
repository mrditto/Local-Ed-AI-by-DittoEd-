import { useState } from "react";
import { loadSettings, saveSettings } from "../config/anythingllm.config";
import { checkConnection } from "../api/anythingllm";
import { Button } from "./ui/Button";
import { Spinner } from "./ui/Spinner";

interface SettingsPanelProps {
  onDone: () => void;
}

type TestState =
  | { kind: "idle" }
  | { kind: "testing" }
  | { kind: "success" }
  | { kind: "failure"; message: string };

/**
 * One-time (per machine) connection setup. Intended for the person setting
 * up EducatorLLM — teachers shouldn't normally need to see this screen.
 * Values are stored locally on this computer and never sent anywhere else.
 */
export function SettingsPanel({ onDone }: SettingsPanelProps) {
  const initial = loadSettings();
  const [baseUrl, setBaseUrl] = useState(initial.baseUrl);
  const [apiKey, setApiKey] = useState(initial.apiKey);
  const [workspaceSlug, setWorkspaceSlug] = useState(initial.workspaceSlug);
  const [testState, setTestState] = useState<TestState>({ kind: "idle" });

  async function handleSaveAndTest() {
    saveSettings({
      baseUrl: baseUrl.trim() || "http://localhost:3001",
      apiKey: apiKey.trim(),
      workspaceSlug: workspaceSlug.trim(),
    });
    setTestState({ kind: "testing" });
    const result = await checkConnection();
    if (result.ok) {
      setTestState({ kind: "success" });
    } else {
      setTestState({ kind: "failure", message: result.message });
    }
  }

  const canSave = apiKey.trim().length > 0 && workspaceSlug.trim().length > 0;

  return (
    <div className="settings-panel">
      <header className="settings-header">
        <h2>Connection Settings</h2>
        <p>
          EducatorLLM talks to AnythingLLM Desktop running on this computer. Enter the
          connection details once — they're saved on this machine only and never sent
          anywhere else.
        </p>
      </header>

      <div className="settings-field">
        <label htmlFor="settings-api-key">AnythingLLM API key</label>
        <input
          id="settings-api-key"
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.currentTarget.value)}
          placeholder="Found in AnythingLLM Desktop under Settings → API Keys"
        />
      </div>

      <div className="settings-field">
        <label htmlFor="settings-workspace">Workspace</label>
        <input
          id="settings-workspace"
          type="text"
          value={workspaceSlug}
          onChange={(e) => setWorkspaceSlug(e.currentTarget.value)}
          placeholder="Workspace slug, e.g. my-workspace"
        />
      </div>

      <div className="settings-field">
        <label htmlFor="settings-base-url">AnythingLLM address</label>
        <input
          id="settings-base-url"
          type="text"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.currentTarget.value)}
          placeholder="http://localhost:3001"
        />
        <span className="settings-hint">
          Leave as-is unless AnythingLLM runs on a different port.
        </span>
      </div>

      <div className="settings-actions">
        <Button onClick={handleSaveAndTest} disabled={!canSave || testState.kind === "testing"}>
          Save &amp; test connection
        </Button>
        {testState.kind === "success" && (
          <Button variant="secondary" onClick={onDone}>
            Done — back to library
          </Button>
        )}
      </div>

      {testState.kind === "testing" && <Spinner label="Testing connection…" />}
      {testState.kind === "success" && (
        <div className="connection-banner connection-banner-success">
          Connected to AnythingLLM — you're all set.
        </div>
      )}
      {testState.kind === "failure" && (
        <div className="connection-banner connection-banner-error">{testState.message}</div>
      )}
    </div>
  );
}
