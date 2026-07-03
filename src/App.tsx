import { useState } from "react";
import { PromptLibrary } from "./components/PromptLibrary";
import { ChatPanel } from "./components/ChatPanel";
import { PromptWizard } from "./components/PromptWizard";
import { SettingsPanel } from "./components/SettingsPanel";
import { PersonalizePanel } from "./components/PersonalizePanel";
import { isConfigured } from "./config/anythingllm.config";
import { Button } from "./components/ui/Button";
import { prompts, type Prompt } from "./prompts";
import { buildAssistantPreamble } from "./prompts/assistantPreamble";

type View = "library" | "wizard" | "chat" | "assistant" | "settings" | "personalize";

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

  function openAssistant() {
    setActivePrompt(ASSISTANT_PROMPT);
    setInitialMessage(undefined);
    setView("assistant");
  }

  function backToLibrary() {
    setActivePrompt(null);
    setInitialMessage(undefined);
    setView("library");
  }

  return (
    <main className="app-shell">
      {view !== "settings" && view !== "personalize" && (
        <div className="app-toolbar">
          <Button variant="ghost" onClick={() => setView("personalize")}>
            Personalize
          </Button>
          <Button variant="ghost" onClick={() => setView("settings")}>
            ⚙ Settings
          </Button>
        </div>
      )}

      {view === "settings" && <SettingsPanel onDone={backToLibrary} />}
      {view === "personalize" && <PersonalizePanel onDone={backToLibrary} />}
      {view === "wizard" && activePrompt && (
        <PromptWizard prompt={activePrompt} onBack={backToLibrary} onGenerate={openChatFromWizard} />
      )}
      {view === "chat" && activePrompt && (
        <ChatPanel prompt={activePrompt} onBack={backToLibrary} initialMessage={initialMessage} />
      )}
      {view === "assistant" && activePrompt && (
        <ChatPanel
          prompt={activePrompt}
          onBack={backToLibrary}
          initialMessage={initialMessage}
          messagePreamble={assistantPreamble}
        />
      )}
      {view === "library" && (
        <PromptLibrary onSelectPrompt={openPrompt} onAskAssistant={openAssistant} />
      )}
    </main>
  );
}

export default App;
