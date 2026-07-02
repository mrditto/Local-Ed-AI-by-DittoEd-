import { isValidPrompt, type Prompt } from "./schema";

// Eagerly import every JSON file in data/ at build time. Adding a new prompt
// is just: drop a new .json file in data/ that matches the Prompt shape.
const modules = import.meta.glob<Record<string, unknown>>("./data/*.json", {
  eager: true,
  import: "default",
});

function loadPrompts(): Prompt[] {
  const loaded: Prompt[] = [];
  const seenIds = new Set<string>();

  for (const [path, raw] of Object.entries(modules)) {
    if (!isValidPrompt(raw)) {
      throw new Error(
        `Invalid prompt in ${path} — must have id, title, description, category, and template.`,
      );
    }
    if (seenIds.has(raw.id)) {
      throw new Error(`Duplicate prompt id "${raw.id}" found in ${path}.`);
    }
    seenIds.add(raw.id);
    loaded.push(raw);
  }

  return loaded.sort((a, b) => a.title.localeCompare(b.title));
}

export const prompts: Prompt[] = loadPrompts();

export function getPromptById(id: string): Prompt | undefined {
  return prompts.find((p) => p.id === id);
}

export type { Prompt, PromptCategory, PromptField } from "./schema";
