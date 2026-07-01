import { useState } from "react";
import { PromptLibrary } from "./components/PromptLibrary";
import { ChatPanel } from "./components/ChatPanel";
import type { Prompt } from "./prompts";

function App() {
  const [activePrompt, setActivePrompt] = useState<Prompt | null>(null);

  return (
    <main className="app-shell">
      {activePrompt ? (
        <ChatPanel prompt={activePrompt} onBack={() => setActivePrompt(null)} />
      ) : (
        <PromptLibrary onSelectPrompt={setActivePrompt} />
      )}
    </main>
  );
}

export default App;
