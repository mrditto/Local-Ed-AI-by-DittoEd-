import { useCallback, useEffect, useState } from "react";
import { loadSettings, saveSettings } from "../config/anythingllm.config";
import { checkConnection, listModels, pullModel } from "../api/ollama";
import { modelTiers } from "../data/modelTiers";
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

interface DownloadState {
  model: string;
  status: string;
  percent: number;
  indeterminate: boolean;
}

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
  const [downloadState, setDownloadState] = useState<DownloadState | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

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

  function saveSelectedModel(nextModel: string) {
    const normalizedBaseUrl = baseUrl.trim() || "http://localhost:11434";
    saveSettings({
      baseUrl: normalizedBaseUrl,
      model: nextModel,
    });
    setModel(nextModel);
  }

  async function handleDownloadAndSelect(nextModel: string) {
    const normalizedBaseUrl = baseUrl.trim() || "http://localhost:11434";
    setDownloadError(null);
    setDownloadState({
      model: nextModel,
      status: "Starting download…",
      percent: 0,
      indeterminate: false,
    });

    const result = await pullModel(nextModel, {
      baseUrl: normalizedBaseUrl,
      onProgress: (progress) => {
        setDownloadState((current) => {
          if (!current || current.model !== nextModel) {
            return current;
          }
          return {
            model: nextModel,
            status: progress.status,
            percent: progress.percent,
            indeterminate: progress.indeterminate ?? false,
          };
        });
      },
    });

    if (!result.ok) {
      setDownloadState(null);
      setDownloadError(`Couldn't download ${nextModel}. ${result.message}`);
      return;
    }

    await refreshModels(normalizedBaseUrl);
    saveSelectedModel(nextModel);
    setDownloadState(null);
  }

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
  const isDownloadInProgress = downloadState !== null;

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
        <label>Model tier</label>
        <div className="settings-model-tiers">
          {modelTiers.map((tier) => {
            const isInstalled = availableModels.includes(tier.model);
            const isActive = model === tier.model;
            const isDownloadingThisTier = downloadState?.model === tier.model;

            return (
              <article
                key={tier.id}
                className={`model-tier-card ${isActive ? "model-tier-card-active" : ""}`.trim()}
              >
                <div className="model-tier-header">
                  <h3>
                    {tier.label}
                    {tier.badge && <span className="model-tier-badge">{tier.badge}</span>}
                    {isActive && (
                      <span className="model-tier-check" aria-label="Currently selected model">
                        ✓
                      </span>
                    )}
                  </h3>
                  <span
                    className={`model-tier-status ${
                      isInstalled ? "model-tier-status-installed" : "model-tier-status-missing"
                    }`.trim()}
                  >
                    {isInstalled ? "Installed" : "Not installed"}
                  </span>
                </div>
                <p className="model-tier-model">
                  {tier.model} • {tier.downloadSize}
                </p>
                <p className="model-tier-blurb">{tier.blurb}</p>
                {isInstalled ? (
                  <Button
                    type="button"
                    variant={isActive ? "secondary" : "primary"}
                    onClick={() => saveSelectedModel(tier.model)}
                    disabled={isActive || isDownloadInProgress}
                  >
                    Use this model
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void handleDownloadAndSelect(tier.model)}
                    disabled={isDownloadInProgress && !isDownloadingThisTier}
                  >
                    {isDownloadingThisTier
                      ? downloadState.indeterminate
                        ? "Downloading…"
                        : `Downloading (${Math.round(downloadState.percent)}%)`
                      : `Download (${tier.downloadSize})`}
                  </Button>
                )}

                {isDownloadingThisTier && downloadState && (
                  <div className="model-tier-progress" role="status" aria-live="polite">
                    <div className="model-tier-progress-text">
                      <span>{downloadState.status}</span>
                      <span>
                        {downloadState.indeterminate ? "..." : `${Math.round(downloadState.percent)}%`}
                      </span>
                    </div>
                    <div className="model-tier-progress-bar">
                      <div
                        className={`model-tier-progress-bar-fill ${
                          downloadState.indeterminate ? "model-tier-progress-bar-fill-indeterminate" : ""
                        }`.trim()}
                        style={
                          downloadState.indeterminate
                            ? undefined
                            : { width: `${Math.round(downloadState.percent)}%` }
                        }
                      />
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>

        {isRefreshingModels && <Spinner label="Loading installed models…" />}
        {modelLoadError && <span className="settings-hint">{modelLoadError}</span>}
        {downloadError && <div className="connection-banner connection-banner-error">{downloadError}</div>}
      </div>

      <details className="settings-advanced">
        <summary>Advanced</summary>
        <div className="settings-field">
          <div className="settings-field-row">
            <label htmlFor="settings-model">All installed models</label>
            <Button
              type="button"
              variant="ghost"
              onClick={() => void refreshModels(baseUrl)}
              disabled={isRefreshingModels || isDownloadInProgress}
            >
              Refresh
            </Button>
          </div>
          {availableModels.length > 0 && !modelLoadError ? (
            <select
              id="settings-model"
              value={model}
              onChange={(e) => setModel(e.currentTarget.value)}
              disabled={isDownloadInProgress}
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
              disabled={isDownloadInProgress}
            />
          )}
        </div>
      </details>

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
