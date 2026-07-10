import { useCallback, useEffect, useState } from "react";
import { PromptLibrary } from "./components/PromptLibrary";
import { ChatPanel } from "./components/ChatPanel";
import { PromptWizard } from "./components/PromptWizard";
import { SettingsPanel } from "./components/SettingsPanel";
import { PersonalizePanel } from "./components/PersonalizePanel";
import { IepFormAssistant } from "./components/IepFormAssistant";
import { loadSettings, saveSettings } from "./config/anythingllm.config";
import { Button } from "./components/ui/Button";
import { prompts, type Prompt } from "./prompts";
import { buildAssistantPreamble } from "./prompts/assistantPreamble";
import { modelTiers } from "./data/modelTiers";
import {
  checkOllamaHealth,
  downloadOllamaInstaller,
  launchOllamaInstaller,
  openInstallerFolder,
  getInstallerPath,
  pullModel,
  type PullProgressUpdate,
} from "./api/ollama";
import { Spinner } from "./components/ui/Spinner";

type View =
  | "library"
  | "wizard"
  | "chat"
  | "assistant"
  | "settings"
  | "personalize"
  | "iep-assistant";

type SetupStage = "checking" | "ollama" | "model" | "ready";

interface InstallerDownloadState {
  status: string;
  downloaded: number;
  total: number | null;
  percent: number;
  indeterminate: boolean;
}

interface ModelDownloadState {
  status: string;
  percent: number;
  indeterminate: boolean;
}

const ASSISTANT_PROMPT: Prompt = {
  id: "ask-dittoed",
  title: "Ask DittoEd",
  description: "",
  category: "engagement",
  template: "",
};

function App() {
  const [activePrompt, setActivePrompt] = useState<Prompt | null>(null);
  const [initialMessage, setInitialMessage] = useState<string | undefined>(undefined);
  const assistantPreamble = buildAssistantPreamble(prompts);
  const [view, setView] = useState<View>("library");
  const [setupStage, setSetupStage] = useState<SetupStage>("checking");
  const [setupError, setSetupError] = useState<string | null>(null);
  const [isRecheckingSetup, setIsRecheckingSetup] = useState(false);
  const [setupBaseUrl, setSetupBaseUrl] = useState(
    () => loadSettings().baseUrl.trim() || "http://localhost:11434",
  );
  const [installerDownloadState, setInstallerDownloadState] = useState<InstallerDownloadState | null>(null);
  const [downloadedInstallerPath, setDownloadedInstallerPath] = useState<string | null>(null);
  const [launchFailed, setLaunchFailed] = useState(false);
  const [isPollingOllamaStartup, setIsPollingOllamaStartup] = useState(false);
  const [selectedStarterModel, setSelectedStarterModel] = useState("phi4-mini:latest");
  const [starterModelDownloadState, setStarterModelDownloadState] = useState<ModelDownloadState | null>(null);
  const [starterModelError, setStarterModelError] = useState<string | null>(null);

  const evaluateLaunchGate = useCallback(async (showFailureState: boolean) => {
    setIsRecheckingSetup(true);
    const settings = loadSettings();
    const normalizedBaseUrl = settings.baseUrl.trim() || "http://localhost:11434";
    setSetupBaseUrl(normalizedBaseUrl);

    try {
      const health = await checkOllamaHealth({
        baseUrl: normalizedBaseUrl,
        timeoutMs: 2_500,
      });

      if (!health.ok) {
        setSetupStage("ollama");
        setSetupError(showFailureState ? health.message : null);
        return;
      }

      if (health.value.length === 0) {
        const preferredModel = modelTiers.find((tier) => tier.id === "recommended")?.model ?? "phi4-mini:latest";
        setSelectedStarterModel(preferredModel);
        setSetupStage("model");
        setSetupError(null);
        return;
      }

      const nextModel = health.value.includes(settings.model)
        ? settings.model
        : health.value.includes("phi4-mini:latest")
          ? "phi4-mini:latest"
          : health.value[0];

      saveSettings({
        baseUrl: normalizedBaseUrl,
        model: nextModel,
      });
      setSetupStage("ready");
      setSetupError(null);
    } finally {
      setIsRecheckingSetup(false);
    }
  }, []);

  useEffect(() => {
    void evaluateLaunchGate(false);
  }, [evaluateLaunchGate]);

  useEffect(() => {
    if (!isPollingOllamaStartup) return;

    let cancelled = false;
    let inFlight = false;
    const checkNow = async () => {
      if (inFlight || cancelled) return;
      inFlight = true;
      const health = await checkOllamaHealth({
        baseUrl: setupBaseUrl,
        timeoutMs: 2_500,
      });
      inFlight = false;
      if (cancelled || !health.ok) return;

      setIsPollingOllamaStartup(false);
      setInstallerDownloadState(null);
      await evaluateLaunchGate(false);
    };

    void checkNow();
    const intervalId = setInterval(() => {
      void checkNow();
    }, 3_000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [evaluateLaunchGate, isPollingOllamaStartup, setupBaseUrl]);

  async function handleInstallOllama() {
    setSetupError(null);
    setLaunchFailed(false);

    // If we already have a downloaded file, skip straight to launch.
    const existingPath = downloadedInstallerPath ?? (await getInstallerPath());
    const skipDownload = downloadedInstallerPath !== null;

    let installerPath = existingPath;

    if (!skipDownload) {
      setInstallerDownloadState({
        status: "Downloading Ollama installer…",
        downloaded: 0,
        total: null,
        percent: 0,
        indeterminate: true,
      });

      const downloadResult = await downloadOllamaInstaller({
        onProgress: (progress) => {
          setInstallerDownloadState({
            status: progress.indeterminate
              ? "Downloading Ollama installer…"
              : `Downloading Ollama installer… ${Math.round(progress.percent)}%`,
            downloaded: progress.downloaded,
            total: progress.total,
            percent: progress.percent,
            indeterminate: progress.indeterminate,
          });
        },
      });

      if (!downloadResult.ok) {
        setInstallerDownloadState(null);
        setSetupError(downloadResult.message);
        return;
      }

      installerPath = downloadResult.value;
      setDownloadedInstallerPath(installerPath);
    }

    // Attempt to launch via native command (not opener, which may block .exe in packaged app).
    const launchResult = await launchOllamaInstaller(installerPath);

    if (!launchResult.ok) {
      // Launch failed — show manual-run message. Do NOT restart the download.
      setInstallerDownloadState(null);
      setLaunchFailed(true);
      // Still start polling in case user runs it themselves.
      setIsPollingOllamaStartup(true);
      return;
    }

    setInstallerDownloadState((current) => ({
      status: "Installer launched. Waiting for Ollama to start…",
      downloaded: current?.downloaded ?? 0,
      total: current?.total ?? null,
      percent: 100,
      indeterminate: false,
    }));
    setIsPollingOllamaStartup(true);
  }

  async function handleDownloadStarterModel() {
    const normalizedBaseUrl = loadSettings().baseUrl.trim() || "http://localhost:11434";
    setSetupBaseUrl(normalizedBaseUrl);
    setStarterModelError(null);
    setStarterModelDownloadState({
      status: "Starting download…",
      percent: 0,
      indeterminate: false,
    });

    const result = await pullModel(selectedStarterModel, {
      baseUrl: normalizedBaseUrl,
      onProgress: (progress: PullProgressUpdate) => {
        setStarterModelDownloadState({
          status: progress.status,
          percent: progress.percent,
          indeterminate: progress.indeterminate ?? false,
        });
      },
    });

    if (!result.ok) {
      setStarterModelDownloadState(null);
      setStarterModelError(`Couldn't download ${selectedStarterModel}. ${result.message}`);
      return;
    }

    saveSettings({
      baseUrl: normalizedBaseUrl,
      model: selectedStarterModel,
    });
    setStarterModelDownloadState(null);
    await evaluateLaunchGate(true);
  }

  function openPrompt(prompt: Prompt) {
    setActivePrompt(prompt);
    setInitialMessage(undefined);
    setView(prompt.fields && prompt.fields.length > 0 ? "wizard" : "chat");
  }

  function openChatFromWizard(message: string) {
    setInitialMessage(message);
    setView("chat");
  }

  function openAssistant() {
    setActivePrompt(ASSISTANT_PROMPT);
    setInitialMessage(undefined);
    setView("assistant");
  }

  function openIepAssistant() {
    setActivePrompt(null);
    setInitialMessage(undefined);
    setView("iep-assistant");
  }

  function backToLibrary() {
    setActivePrompt(null);
    setInitialMessage(undefined);
    setView("library");
  }

  const showSetupFlow = setupStage !== "ready";
  const isStarterModelDownloading = starterModelDownloadState !== null;
  const activeStarterModelDownload = starterModelDownloadState;

  return (
    <main className={`app-shell ${showSetupFlow ? "app-shell-setup" : ""}`.trim()}>
      {showSetupFlow && setupStage === "checking" && (
        <section className="setup-screen">
          <div className="setup-card">
            <Spinner label="Checking Ollama setup…" />
          </div>
        </section>
      )}

      {showSetupFlow && setupStage === "ollama" && (
        <section className="setup-screen">
          <div className="setup-card">
            <h1>Welcome to Local Ed AI</h1>
            <p className="setup-lede">
              Local Ed AI runs on Ollama, a free local AI engine. Nothing you type ever leaves this computer.
            </p>

            {!launchFailed && (
              <Button
                className="setup-primary-button"
                onClick={() => void handleInstallOllama()}
                disabled={installerDownloadState !== null}
              >
                {installerDownloadState
                  ? "Installing Ollama…"
                  : downloadedInstallerPath
                    ? "Run Ollama installer"
                    : "Install Ollama for me"}
              </Button>
            )}

            {installerDownloadState && (
              <div className="model-tier-progress" role="status" aria-live="polite">
                <div className="model-tier-progress-text">
                  <span>{installerDownloadState.status}</span>
                  <span>
                    {installerDownloadState.indeterminate ? "..." : `${Math.round(installerDownloadState.percent)}%`}
                  </span>
                </div>
                <div className="model-tier-progress-bar">
                  <div
                    className={`model-tier-progress-bar-fill ${
                      installerDownloadState.indeterminate ? "model-tier-progress-bar-fill-indeterminate" : ""
                    }`.trim()}
                    style={
                      installerDownloadState.indeterminate
                        ? undefined
                        : { width: `${Math.round(installerDownloadState.percent)}%` }
                    }
                  />
                </div>
              </div>
            )}

            {launchFailed && downloadedInstallerPath && (
              <div className="setup-launch-failed">
                <p className="setup-launch-failed-msg">
                  Installer downloaded — we couldn&apos;t start it automatically.
                </p>
                <div className="setup-launch-failed-actions">
                  <Button
                    className="setup-primary-button"
                    onClick={() => void launchOllamaInstaller(downloadedInstallerPath).then((r) => {
                      if (r.ok) {
                        setLaunchFailed(false);
                        setInstallerDownloadState({
                          status: "Installer launched. Waiting for Ollama to start…",
                          downloaded: 0,
                          total: null,
                          percent: 100,
                          indeterminate: false,
                        });
                      }
                    })}
                  >
                    Try launching again
                  </Button>
                  <button
                    type="button"
                    className="setup-link-button"
                    onClick={() => void openInstallerFolder(downloadedInstallerPath)}
                  >
                    Open the folder containing the installer
                  </button>
                </div>
              </div>
            )}

            {isPollingOllamaStartup && <Spinner label="Waiting for Ollama to come online…" />}

            <button
              type="button"
              className="setup-link-button"
              onClick={() => void evaluateLaunchGate(true)}
              disabled={isRecheckingSetup || installerDownloadState !== null}
            >
              I already have Ollama
            </button>

            {setupError && (
              <div className="connection-banner connection-banner-error">
                {setupError}
                <div className="setup-error-actions">
                  <Button variant="secondary" onClick={() => void evaluateLaunchGate(true)} disabled={isRecheckingSetup}>
                    Retry
                  </Button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {showSetupFlow && setupStage === "model" && (
        <section className="setup-screen">
          <div className="setup-card setup-card-models">
            <h1>Choose your starting model</h1>
            <p className="setup-lede">
              Pick one to get started now. You can install and switch tiers later in Settings.
            </p>
            <div className="settings-model-tiers">
              {modelTiers.map((tier) => {
                const isSelected = selectedStarterModel === tier.model;
                return (
                  <article
                    key={tier.id}
                    className={`model-tier-card ${isSelected ? "model-tier-card-active" : ""}`.trim()}
                  >
                    <div className="model-tier-header">
                      <h3>
                        {tier.label}
                        {tier.badge && <span className="model-tier-badge">{tier.badge}</span>}
                        {isSelected && (
                          <span className="model-tier-check" aria-label="Selected starter model">
                            ✓
                          </span>
                        )}
                      </h3>
                      <span className="model-tier-status model-tier-status-missing">
                        {isSelected ? "Selected" : "Not selected"}
                      </span>
                    </div>
                    <p className="model-tier-model">
                      {tier.model} • {tier.downloadSize}
                    </p>
                    <p className="model-tier-blurb">{tier.blurb}</p>
                    <Button
                      type="button"
                      variant={isSelected ? "secondary" : "primary"}
                      onClick={() => setSelectedStarterModel(tier.model)}
                      disabled={isStarterModelDownloading}
                    >
                      {isSelected ? "Selected" : "Choose this model"}
                    </Button>
                  </article>
                );
              })}
            </div>

            <div className="setup-actions">
              <Button onClick={() => void handleDownloadStarterModel()} disabled={isStarterModelDownloading}>
                {isStarterModelDownloading
                  ? activeStarterModelDownload?.indeterminate
                    ? "Downloading…"
                    : `Downloading (${Math.round(activeStarterModelDownload?.percent ?? 0)}%)`
                  : "Download and finish setup"}
              </Button>
            </div>

            {starterModelDownloadState && (
              <div className="model-tier-progress" role="status" aria-live="polite">
                <div className="model-tier-progress-text">
                  <span>{starterModelDownloadState.status}</span>
                  <span>
                    {starterModelDownloadState.indeterminate
                      ? "..."
                      : `${Math.round(starterModelDownloadState.percent)}%`}
                  </span>
                </div>
                <div className="model-tier-progress-bar">
                  <div
                    className={`model-tier-progress-bar-fill ${
                      starterModelDownloadState.indeterminate ? "model-tier-progress-bar-fill-indeterminate" : ""
                    }`.trim()}
                    style={
                      starterModelDownloadState.indeterminate
                        ? undefined
                        : { width: `${Math.round(starterModelDownloadState.percent)}%` }
                    }
                  />
                </div>
              </div>
            )}

            {starterModelError && <div className="connection-banner connection-banner-error">{starterModelError}</div>}
          </div>
        </section>
      )}

      {!showSetupFlow && view !== "settings" && view !== "personalize" && (
        <div className="app-toolbar">
          <Button variant="ghost" onClick={() => setView("personalize")}>
            Personalize
          </Button>
          <Button variant="ghost" onClick={() => setView("settings")}>
            ⚙ Settings
          </Button>
        </div>
      )}

      {!showSetupFlow && view === "settings" && <SettingsPanel onDone={backToLibrary} />}
      {!showSetupFlow && view === "personalize" && <PersonalizePanel onDone={backToLibrary} />}
      {!showSetupFlow && view === "wizard" && activePrompt && (
        <PromptWizard prompt={activePrompt} onBack={backToLibrary} onGenerate={openChatFromWizard} />
      )}
      {!showSetupFlow && view === "chat" && activePrompt && (
        <ChatPanel prompt={activePrompt} onBack={backToLibrary} initialMessage={initialMessage} />
      )}
      {!showSetupFlow && view === "assistant" && activePrompt && (
        <ChatPanel
          prompt={activePrompt}
          onBack={backToLibrary}
          initialMessage={initialMessage}
          messagePreamble={assistantPreamble}
        />
      )}
      {!showSetupFlow && view === "iep-assistant" && <IepFormAssistant onBack={backToLibrary} />}
      {!showSetupFlow && view === "library" && (
        <PromptLibrary
          onSelectPrompt={openPrompt}
          onAskAssistant={openAssistant}
          onOpenIepAssistant={openIepAssistant}
        />
      )}
    </main>
  );
}

export default App;
