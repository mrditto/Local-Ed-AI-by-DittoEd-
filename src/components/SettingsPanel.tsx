import { useCallback, useEffect, useState } from "react";
import { loadSettings, saveSettings } from "../config/anythingllm.config";
import { checkConnection, listModels } from "../api/ollama";
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
 * up DittoEd — teachers shouldn't normally need to see this screen.
 * Values are stored locally on this computer and never sent anywhere else.
 */
export function SettingsPanel({ onDone }: SettingsPanelProps) {
  const initial = loadSettings();
  const [baseUrl, setBaseUrl] = useState(initial.baseUrl);
  const [model, setModel] = useState(initial.model);
  const [testState, setTestState] = useState<TestState>({ kind: "idle" });
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isRefreshingModels, setIsRefreshingModels] = useState(false);
  const [modelLoadError, setModelLoadError] = useState<string | null>(null);

  const refreshModels = useCallback(async (baseUrlOverride: string) => {
    setIsRefreshingModels(true);
    try {
      const models = await listModels(baseUrlOverride.trim() || "http://localhost:11434");
      setAvailableModels(models);
      setModelLoadError(null);
    } catch (err) {
      setAvailableModels([]);
      setModelLoadError(err instanceof Error ? err.message : "Could not load models from Ollama.");
    } finally {
      setIsRefreshingModels(false);
    }
  }, []);

  useEffect(() => {
    void refreshModels(initial.baseUrl);
  }, [initial.baseUrl, refreshModels]);

  async function handleSaveAndTest() {
    saveSettings({
      baseUrl: baseUrl.trim() || "http://localhost:11434",
      model: model.trim() || "phi4-mini:latest",
    });
    setTestState({ kind: "testing" });
    const result = await checkConnection();
    if (result.ok) {
      setTestState({ kind: "success" });
    } else {
      setTestState({ kind: "failure", message: result.message });
    }
  }

  const canSave = baseUrl.trim().length > 0 && model.trim().length > 0;

  return (
    <div className="settings-panel">
      <header className="settings-header">
        <h2>Connection Settings</h2>
        <p>
          Local Ed AI talks directly to Ollama running on this computer. Enter the connection
          details once — they&apos;re saved on this machine only and never sent anywhere else.
        </p>
      </header>

      <div className="settings-field">
        <label htmlFor="settings-base-url">Ollama address</label>
        <input
          id="settings-base-url"
          type="text"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.currentTarget.value)}
          placeholder="http://localhost:11434"
        />
        <span className="settings-hint">
          Leave as-is unless Ollama runs on a different port.
        </span>
      </div>

      <div className="settings-field">
        <div className="settings-field-row">
          <label htmlFor="settings-model">Model</label>
          <Button
            type="button"
            variant="ghost"
            onClick={() => void refreshModels(baseUrl)}
            disabled={isRefreshingModels}
          >
            Refresh
          </Button>
        </div>

        {availableModels.length > 0 && !modelLoadError ? (
          <select
            id="settings-model"
            value={model}
            onChange={(e) => setModel(e.currentTarget.value)}
          >
            {!availableModels.includes(model) && <option value={model}>{model}</option>}
            {availableModels.map((availableModel) => (
              <option key={availableModel} value={availableModel}>
                {availableModel}
              </option>
            ))}
          </select>
        ) : (
          <input
            id="settings-model"
            type="text"
            value={model}
            onChange={(e) => setModel(e.currentTarget.value)}
            placeholder="phi4-mini:latest"
          />
        )}

        {isRefreshingModels && <Spinner label="Loading installed models…" />}
        {modelLoadError && <span className="settings-hint">{modelLoadError}</span>}
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
          Connected to Ollama — you&apos;re all set.
        </div>
      )}
      {testState.kind === "failure" && (
        <div className="connection-banner connection-banner-error">{testState.message}</div>
      )}
    </div>
  );
}
