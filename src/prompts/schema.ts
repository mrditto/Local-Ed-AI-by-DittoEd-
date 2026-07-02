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
  fields?: PromptField[];
}

export interface PromptField {
  id: string;
  label: string;
  type: "text" | "textarea" | "select";
  placeholder?: string;
  options?: string[];
  required?: boolean;
}

export type PromptCategory =
  | "planning"
  | "assessment"
  | "feedback"
  | "communication"
  | "engagement"
  | "differentiation"
  | "sped"
  | "admin";

function isValidPromptField(value: unknown): value is PromptField {
  if (typeof value !== "object" || value === null) return false;
  const field = value as Record<string, unknown>;
  if (typeof field.id !== "string" || field.id.length === 0) return false;
  if (typeof field.label !== "string" || field.label.length === 0) return false;
  if (field.type !== "text" && field.type !== "textarea" && field.type !== "select") return false;
  if (field.placeholder !== undefined && typeof field.placeholder !== "string") return false;
  if (field.required !== undefined && typeof field.required !== "boolean") return false;
  if (field.type === "select") {
    if (!Array.isArray(field.options) || field.options.length === 0) return false;
    return field.options.every((option) => typeof option === "string" && option.length > 0);
  }
  return field.options === undefined;
}

export function isValidPrompt(value: unknown): value is Prompt {
  if (typeof value !== "object" || value === null) return false;
  const p = value as Record<string, unknown>;
  const fieldsAreValid =
    p.fields === undefined ||
    (Array.isArray(p.fields) && p.fields.every((field) => isValidPromptField(field)));
  return (
    typeof p.id === "string" &&
    p.id.length > 0 &&
    typeof p.title === "string" &&
    p.title.length > 0 &&
    typeof p.description === "string" &&
    typeof p.category === "string" &&
    typeof p.template === "string" &&
    p.template.length > 0 &&
    fieldsAreValid
  );
}
