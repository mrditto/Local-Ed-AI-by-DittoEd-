import { prompts, type Prompt, type PromptCategory } from "../prompts";
import { CATEGORY_LABEL } from "../prompts/categoryLabels";
import { PromptCard } from "./PromptCard";
import { Card } from "./ui/Card";

interface PromptLibraryProps {
  onSelectPrompt: (prompt: Prompt) => void;
  onAskAssistant: () => void;
  onOpenIepAssistant: () => void;
}

const CATEGORY_ORDER: PromptCategory[] = [
  "planning",
  "assessment",
  "feedback",
  "communication",
  "differentiation",
  "engagement",
  "sped",
  "admin",
];

export function PromptLibrary({ onSelectPrompt, onAskAssistant, onOpenIepAssistant }: PromptLibraryProps) {
  const sections = CATEGORY_ORDER
    .map((category) => ({
      category,
      prompts: prompts.filter((prompt) => prompt.category === category),
    }))
    .filter((section) => section.prompts.length > 0);

  return (
    <div className="prompt-library">
      <header className="prompt-library-header">
        <h1>Local Ed AI</h1>
        <div className="prompt-library-maker">by DittoEd</div>
        <p>
          <span className="prompt-library-tagline">
            Echoing the educator, not replacing the magic.
          </span>
          <br />
          Pick a prompt to get started. Everything runs locally — nothing leaves this computer.
        </p>
      </header>
      <Card
        className="assistant-hero-card"
        role="button"
        tabIndex={0}
        onClick={onAskAssistant}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onAskAssistant();
          }
        }}
      >
        <h2>Not sure where to start?</h2>
        <p>
          Ask DittoEd — describe what you need and it will point you to the right tool or draft
          it for you.
        </p>
      </Card>
      <div className="prompt-library-sections">
        {sections.map(({ category, prompts: categoryPrompts }) => (
          <section key={category} className="prompt-library-section">
            <h2 className="prompt-library-section-title">{CATEGORY_LABEL[category]}</h2>
            <div className="prompt-grid">
              {category === "sped" && (
                <Card
                  className="prompt-card iep-assistant-card"
                  role="button"
                  tabIndex={0}
                  onClick={onOpenIepAssistant}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onOpenIepAssistant();
                    }
                  }}
                >
                  <span className="prompt-card-category">{CATEGORY_LABEL.sped}</span>
                  <h3 className="prompt-card-title">IEP Form Assistant</h3>
                  <p className="prompt-card-description">
                    answer questions section by section, get a completed draft form
                  </p>
                </Card>
              )}
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
