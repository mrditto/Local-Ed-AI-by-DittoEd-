import { prompts, type Prompt, type PromptCategory } from "../prompts";
import { CATEGORY_LABEL } from "../prompts/categoryLabels";
import { PromptCard } from "./PromptCard";

interface PromptLibraryProps {
  onSelectPrompt: (prompt: Prompt) => void;
}

export function PromptLibrary({ onSelectPrompt }: PromptLibraryProps) {
  const categoryOrder: PromptCategory[] = [
    "planning",
    "assessment",
    "feedback",
    "communication",
    "differentiation",
    "engagement",
  ];

  const sections = categoryOrder
    .map((category) => ({
      category,
      prompts: prompts.filter((prompt) => prompt.category === category),
    }))
    .filter((section) => section.prompts.length > 0);

  return (
    <div className="prompt-library">
      <header className="prompt-library-header">
        <h1>EducatorLLM</h1>
        <p>Pick a prompt to get started. Everything runs locally — nothing leaves this computer.</p>
      </header>
      <div className="prompt-library-sections">
        {sections.map(({ category, prompts: categoryPrompts }) => (
          <section key={category} className="prompt-library-section">
            <h2 className="prompt-library-section-title">{CATEGORY_LABEL[category]}</h2>
            <div className="prompt-grid">
              {categoryPrompts.map((prompt) => (
                <PromptCard key={prompt.id} prompt={prompt} onSelect={onSelectPrompt} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
