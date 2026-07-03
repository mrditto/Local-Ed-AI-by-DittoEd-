import { useRef, useState } from "react";
import { Button } from "./ui/Button";
import type { Prompt, PromptField } from "../prompts";
import { VerifyFooter } from "./VerifyFooter";
import { extractTextFromFile } from "../utils/extractText";

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
  prompt: Prompt,
  fields: PromptField[],
  values: Record<string, string>,
): string {
  const composedTemplate = fields.reduce((message, field) => {
    const token = `{${field.id}}`;
    return message.split(token).join((values[field.id] ?? "").trim());
  }, prompt.template);

  if (!prompt.grounding) {
    return composedTemplate;
  }

  return (
    composedTemplate +
    "\n\nAuthoritative reference guidance — base all standards and criteria ONLY on this:\n" +
    prompt.grounding +
    "\nIf the request requires legal or policy specifics beyond this guidance, do not answer from memory — say it needs verification and refer to the district resources."
  );
}

const REFERRAL_KEYWORDS = [
  "eligibility",
  "suspension",
  "expulsion",
  "due process",
  "evaluation timeline",
  "extended school year",
  "esy",
  "placement change",
];

export function PromptWizard({ prompt, onBack, onGenerate }: PromptWizardProps) {
  const fields = prompt.fields ?? [];
  const [values, setValues] = useState<Record<string, string>>(() => buildInitialValues(fields));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [fieldStatuses, setFieldStatuses] = useState<Record<string, string>>({});
  const [activeAttachmentFieldId, setActiveAttachmentFieldId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canGenerate = fields.every(
    (field) => !field.required || (values[field.id] ?? "").trim().length > 0,
  );
  const hasPolicyKeyword = REFERRAL_KEYWORDS.some((keyword) =>
    Object.values(values)
      .join(" ")
      .toLowerCase()
      .includes(keyword),
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
    onGenerate(composeMessage(prompt, fields, values));
  }

  function handleAttachClick(fieldId: string) {
    setActiveAttachmentFieldId(fieldId);
    fileInputRef.current?.click();
  }

  async function handleAttachmentPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = "";
    if (!file || !activeAttachmentFieldId) return;

    const result = await extractTextFromFile(file);
    if (!result.ok) {
      setFieldErrors((prev) => ({
        ...prev,
        [activeAttachmentFieldId]: result.message,
      }));
      setFieldStatuses((prev) => ({
        ...prev,
        [activeAttachmentFieldId]: "",
      }));
      setActiveAttachmentFieldId(null);
      return;
    }

    updateField(activeAttachmentFieldId, result.text);
    setFieldErrors((prev) => ({
      ...prev,
      [activeAttachmentFieldId]: "",
    }));
    setFieldStatuses((prev) => ({
      ...prev,
      [activeAttachmentFieldId]: result.truncated
        ? `Loaded ${file.name} (shortened to fit).`
        : `Loaded ${file.name}.`,
    }));
    setActiveAttachmentFieldId(null);
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
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.txt,.md"
          className="visually-hidden"
          onChange={handleAttachmentPicked}
        />
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

            {field.type === "textarea" && (
              <div className="field-attachment-controls">
                <Button type="button" variant="secondary" onClick={() => handleAttachClick(field.id)}>
                  Attach file
                </Button>
                <div className="attachment-hint">
                  Google Doc? Use File → Download → Microsoft Word (.docx), then attach it here.
                </div>
                {fieldStatuses[field.id] && (
                  <div className="attachment-status">{fieldStatuses[field.id]}</div>
                )}
                {fieldErrors[field.id] && <div className="attachment-error">{fieldErrors[field.id]}</div>}
              </div>
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

        {hasPolicyKeyword && (
          <div className="wizard-warning-banner">
            <p>
              This looks like a policy or legal question. Local Ed AI drafts documents — it does not
              answer policy questions. Check the resources below or contact your special education
              office.
            </p>
            <VerifyFooter />
          </div>
        )}

        <div className="wizard-actions">
          <Button type="submit" disabled={!canGenerate}>
            Generate
          </Button>
        </div>
      </form>
    </div>
  );
}
