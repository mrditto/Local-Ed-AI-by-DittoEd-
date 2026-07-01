import { Card } from "./ui/Card";
import type { Prompt } from "../prompts";

const CATEGORY_LABEL: Record<Prompt["category"], string> = {
  planning: "Planning",
  assessment: "Assessment",
  feedback: "Feedback",
  communication: "Communication",
  engagement: "Engagement",
  differentiation: "Differentiation",
};

interface PromptCardProps {
  prompt: Prompt;
  onSelect: (prompt: Prompt) => void;
}

export function PromptCard({ prompt, onSelect }: PromptCardProps) {
  return (
    <Card className="prompt-card" role="button" tabIndex={0}
      onClick={() => onSelect(prompt)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(prompt);
        }
      }}
    >
      <span className="prompt-card-category">{CATEGORY_LABEL[prompt.category]}</span>
      <h3 className="prompt-card-title">{prompt.title}</h3>
      <p className="prompt-card-description">{prompt.description}</p>
    </Card>
  );
}
