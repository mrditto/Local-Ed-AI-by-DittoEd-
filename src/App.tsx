import { useState } from "react";
import { PromptLibrary } from "./components/PromptLibrary";
import { ChatPanel } from "./components/ChatPanel";
import { PromptWizard } from "./components/PromptWizard";
import { SettingsPanel } from "./components/SettingsPanel";
import { isConfigured } from "./config/anythingllm.config";
import { Button } from "./components/ui/Button";
import type { Prompt } from "./prompts";

type View = "library" | "wizard" | "chat" | "settings";

function App() {
  const [activePrompt, setActivePrompt] = useState<Prompt | null>(null);
  const [initialMessage, setInitialMessage] = useState<string | undefined>(undefined);
  // First launch on an unconfigured machine goes straight to Settings.
  const [view, setView] = useState<View>(isConfigured() ? "library" : "settings");

  function openPrompt(prompt: Prompt) {
    setActivePrompt(prompt);
    setInitialMessage(undefined);
    setView(prompt.fields && prompt.fields.length > 0 ? "wizard" : "chat");
  }

  function openChatFromWizard(message: string) {
    setInitialMessage(message);
    setView("chat");
  }

  function backToLibrary() {
    setActivePrompt(null);
    setInitialMessage(undefined);
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
      {view === "wizard" && activePrompt && (
        <PromptWizard prompt={activePrompt} onBack={backToLibrary} onGenerate={openChatFromWizard} />
      )}
      {view === "chat" && activePrompt && (
        <ChatPanel prompt={activePrompt} onBack={backToLibrary} initialMessage={initialMessage} />
      )}
      {view === "library" && <PromptLibrary onSelectPrompt={openPrompt} />}
    </main>
  );
}

export default App;
