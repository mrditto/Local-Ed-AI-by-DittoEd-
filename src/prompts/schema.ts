/**
 * Shape of a single prompt in the library. Kept intentionally simple for
 * Phase 1 — no input fields/wizard yet, just a title, a short description
 * for the library grid, and the template text that seeds the chat.
 */
export interface Prompt {
  id: string;
  title: string;
  description: string;
  category: PromptCategory;
  /** Sent to AnythingLLM as the opening message when this prompt is selected. */
  template: string;
}

export type PromptCategory =
  | "planning"
  | "assessment"
  | "feedback"
  | "communication"
  | "engagement";

export function isValidPrompt(value: unknown): value is Prompt {
  if (typeof value !== "object" || value === null) return false;
  const p = value as Record<string, unknown>;
  return (
    typeof p.id === "string" &&
    p.id.length > 0 &&
    typeof p.title === "string" &&
    p.title.length > 0 &&
    typeof p.description === "string" &&
    typeof p.category === "string" &&
    typeof p.template === "string" &&
    p.template.length > 0
  );
}
