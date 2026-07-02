import { useState } from "react";
import { Button } from "./ui/Button";
import type { Prompt, PromptField } from "../prompts";

interface PromptWizardProps {
  prompt: Prompt;
  onBack: () => void;
  onGenerate: (message: string) => void;
}

function buildInitialValues(fields: PromptField[]): Record<string, string> {
  return fields.reduce<Record<string, string>>((acc, field) => {
    acc[field.id] = "";
    return acc;
  }, {});
}

function composeMessage(
  template: string,
  fields: PromptField[],
  values: Record<string, string>,
): string {
  return fields.reduce((message, field) => {
    const token = `{${field.id}}`;
    return message.split(token).join((values[field.id] ?? "").trim());
  }, template);
}

export function PromptWizard({ prompt, onBack, onGenerate }: PromptWizardProps) {
  const fields = prompt.fields ?? [];
  const [values, setValues] = useState<Record<string, string>>(() => buildInitialValues(fields));

  const canGenerate = fields.every(
    (field) => !field.required || (values[field.id] ?? "").trim().length > 0,
  );

  function updateField(fieldId: string, value: string) {
    setValues((prev) => ({
      ...prev,
      [fieldId]: value,
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canGenerate) return;
    onGenerate(composeMessage(prompt.template, fields, values));
  }

  return (
    <div className="wizard-panel">
      <header className="wizard-header">
        <Button variant="ghost" onClick={onBack}>
          ← Back to library
        </Button>
        <h2>{prompt.title}</h2>
      </header>

      <form className="wizard-form" onSubmit={handleSubmit}>
        {fields.map((field) => (
          <div key={field.id} className="settings-field">
            <label htmlFor={`wizard-${field.id}`}>
              {field.label}
              {field.required ? " *" : ""}
            </label>

            {field.type === "textarea" && (
              <textarea
                id={`wizard-${field.id}`}
                value={values[field.id] ?? ""}
                onChange={(e) => updateField(field.id, e.currentTarget.value)}
                placeholder={field.placeholder}
                rows={6}
              />
            )}

            {field.type === "text" && (
              <input
                id={`wizard-${field.id}`}
                type="text"
                value={values[field.id] ?? ""}
                onChange={(e) => updateField(field.id, e.currentTarget.value)}
                placeholder={field.placeholder}
              />
            )}

            {field.type === "select" && (
              <select
                id={`wizard-${field.id}`}
                value={values[field.id] ?? ""}
                onChange={(e) => updateField(field.id, e.currentTarget.value)}
              >
                <option value="">{field.placeholder ?? "Select an option"}</option>
                {field.options?.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            )}
          </div>
        ))}

        <div className="wizard-actions">
          <Button type="submit" disabled={!canGenerate}>
            Generate
          </Button>
        </div>
      </form>
    </div>
  );
}
