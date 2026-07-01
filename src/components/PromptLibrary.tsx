import { prompts, type Prompt } from "../prompts";
import { PromptCard } from "./PromptCard";

interface PromptLibraryProps {
  onSelectPrompt: (prompt: Prompt) => void;
}

export function PromptLibrary({ onSelectPrompt }: PromptLibraryProps) {
  return (
    <div className="prompt-library">
      <header className="prompt-library-header">
        <h1>EducatorLLM</h1>
        <p>Pick a prompt to get started. Everything runs locally — nothing leaves this computer.</p>
      </header>
      <div className="prompt-grid">
        {prompts.map((prompt) => (
          <PromptCard key={prompt.id} prompt={prompt} onSelect={onSelectPrompt} />
        ))}
      </div>
    </div>
  );
}
