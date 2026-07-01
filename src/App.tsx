import { useState } from "react";
import { PromptLibrary } from "./components/PromptLibrary";
import { ChatPanel } from "./components/ChatPanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { isConfigured } from "./config/anythingllm.config";
import { Button } from "./components/ui/Button";
import type { Prompt } from "./prompts";

type View = "library" | "chat" | "settings";

function App() {
  const [activePrompt, setActivePrompt] = useState<Prompt | null>(null);
  // First launch on an unconfigured machine goes straight to Settings.
  const [view, setView] = useState<View>(isConfigured() ? "library" : "settings");

  function openPrompt(prompt: Prompt) {
    setActivePrompt(prompt);
    setView("chat");
  }

  function backToLibrary() {
    setActivePrompt(null);
    setView("library");
  }

  return (
    <main className="app-shell">
      {view !== "settings" && (
        <div className="app-toolbar">
          <Button variant="ghost" onClick={() => setView("settings")}>
            ⚙ Settings
          </Button>
        </div>
      )}

      {view === "settings" && <SettingsPanel onDone={backToLibrary} />}
      {view === "chat" && activePrompt && (
        <ChatPanel prompt={activePrompt} onBack={backToLibrary} />
      )}
      {view === "library" && <PromptLibrary onSelectPrompt={openPrompt} />}
    </main>
  );
}

export default App;
