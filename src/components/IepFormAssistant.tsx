import { useEffect, useMemo, useState } from "react";
import {
  AlignmentType,
  Document,
  Footer,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { sendChat } from "../api/ollama";
import { Button } from "./ui/Button";
import {
  IEP_TEAM_DETERMINATIONS_LABEL,
  SPED_HIDDEN_PREFIX_GUARDRAIL,
  mdIepFormSections,
  type MdIepField,
  type MdIepSectionSchema,
} from "../data/mdIepFormSchema";

interface IepFormAssistantProps {
  onBack: () => void;
}

type FieldValue = string | boolean;
type SectionValues = Record<string, FieldValue>;

interface IepDraftState {
  version: 1;
  sections: Record<string, SectionValues>;
  repeatableSections: Record<string, SectionValues[]>;
  skippedSectionIds: string[];
}

const STORAGE_KEY = "educatorllm-iep-form-draft";
const DRAFT_FOOTER_TEXT =
  "DRAFT - generated with Local Ed AI. Requires review and approval by the full IEP team. Not an eligibility, placement, or disciplinary determination.";

function getDefaultValue(field: MdIepField): FieldValue {
  if (field.kind === "deterministic" && field.inputType === "checkbox") {
    return false;
  }
  return "";
}

function buildEmptyItem(section: MdIepSectionSchema): SectionValues {
  const item: SectionValues = {};
  section.fields.forEach((field) => {
    item[field.id] = getDefaultValue(field);
    if (field.kind === "narrative") {
      item[`${field.id}__seed`] = "";
    }
  });
  return item;
}

function buildEmptyRepeatableItems(section: MdIepSectionSchema): SectionValues[] {
  return Array.from({ length: Math.max(1, section.repeatable?.minItems ?? 1) }, () => buildEmptyItem(section));
}

function buildInitialDraft(): IepDraftState {
  const sections: Record<string, SectionValues> = {};
  const repeatableSections: Record<string, SectionValues[]> = {};

  mdIepFormSections.forEach((section) => {
    if (section.repeatable) {
      repeatableSections[section.id] = buildEmptyRepeatableItems(section);
      return;
    }
    sections[section.id] = buildEmptyItem(section);
  });

  return {
    version: 1,
    sections,
    repeatableSections,
    skippedSectionIds: [],
  };
}

function computeAge(dateOfBirth: string, fallbackAgeText: string): number | null {
  if (dateOfBirth) {
    const dob = new Date(`${dateOfBirth}T00:00:00`);
    if (!Number.isNaN(dob.getTime())) {
      const now = new Date();
      let age = now.getFullYear() - dob.getFullYear();
      const m = now.getMonth() - dob.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age -= 1;
      return age;
    }
  }

  const parsed = Number.parseInt(fallbackAgeText, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function readDraftFromStorage(): IepDraftState {
  const initial = buildInitialDraft();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initial;
    const parsed = JSON.parse(raw) as Partial<IepDraftState>;
    if (!parsed || typeof parsed !== "object") return initial;

    const merged: IepDraftState = {
      ...initial,
      sections: { ...initial.sections, ...(parsed.sections ?? {}) },
      repeatableSections: { ...initial.repeatableSections, ...(parsed.repeatableSections ?? {}) },
      skippedSectionIds: Array.isArray(parsed.skippedSectionIds) ? parsed.skippedSectionIds : [],
    };

    return merged;
  } catch {
    return initial;
  }
}

function stringifyValue(value: FieldValue): string {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return value.trim();
}

function hasValue(value: FieldValue | undefined): boolean {
  if (typeof value === "boolean") return value;
  return Boolean(value?.trim());
}

function sectionHasAnswers(draft: IepDraftState, activeSection: MdIepSectionSchema): boolean {
  const itemHasAnswers = (values: SectionValues | undefined) =>
    activeSection.fields.some((field) => {
      if (hasValue(values?.[field.id])) {
        return true;
      }
      if (field.kind === "narrative" && hasValue(values?.[`${field.id}__seed`])) {
        return true;
      }
      return false;
    });

  if (activeSection.repeatable) {
    return (draft.repeatableSections[activeSection.id] ?? []).some((item) => itemHasAnswers(item));
  }

  return itemHasAnswers(draft.sections[activeSection.id]);
}

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function IepFormAssistant({ onBack }: IepFormAssistantProps) {
  const [draft, setDraft] = useState<IepDraftState>(() => readDraftFromStorage());
  const [currentStep, setCurrentStep] = useState(0);
  const [isPrinting, setIsPrinting] = useState(false);
  const [draftingKey, setDraftingKey] = useState<string | null>(null);
  const [draftError, setDraftError] = useState<string>("");
  const [exportMessage, setExportMessage] = useState<string>("");
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);

  const studentSectionValues = draft.sections["student-school-information"] ?? {};
  const computedAge = computeAge(
    String(studentSectionValues.dateOfBirth ?? ""),
    String(studentSectionValues.studentAge ?? ""),
  );

  const visibleSections = useMemo(
    () =>
      mdIepFormSections.filter((section) => {
        if (section.transitionAgeGate === 14) {
          return computedAge !== null && computedAge >= 14;
        }
        return true;
      }),
    [computedAge],
  );

  useEffect(() => {
    if (currentStep > visibleSections.length) {
      setCurrentStep(visibleSections.length);
    }
  }, [currentStep, visibleSections.length]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  }, [draft]);

  useEffect(() => {
    const handleAfterPrint = () => setIsPrinting(false);
    window.addEventListener("afterprint", handleAfterPrint);
    return () => window.removeEventListener("afterprint", handleAfterPrint);
  }, []);

  const isReviewStep = currentStep === visibleSections.length;
  const section = isReviewStep ? null : visibleSections[currentStep];

  function markSectionCompleted(sectionId: string) {
    setDraft((prev) => ({
      ...prev,
      skippedSectionIds: prev.skippedSectionIds.filter((id) => id !== sectionId),
    }));
  }

  function setSingleSectionField(sectionId: string, fieldId: string, value: FieldValue) {
    setDraft((prev) => ({
      ...prev,
      sections: {
        ...prev.sections,
        [sectionId]: {
          ...(prev.sections[sectionId] ?? {}),
          [fieldId]: value,
        },
      },
    }));
    markSectionCompleted(sectionId);
  }

  function setRepeatableField(sectionId: string, itemIndex: number, fieldId: string, value: FieldValue) {
    setDraft((prev) => {
      const existing = prev.repeatableSections[sectionId] ?? [];
      const nextItems = existing.map((item, idx) =>
        idx === itemIndex
          ? {
              ...item,
              [fieldId]: value,
            }
          : item,
      );

      return {
        ...prev,
        repeatableSections: {
          ...prev.repeatableSections,
          [sectionId]: nextItems,
        },
        skippedSectionIds: prev.skippedSectionIds.filter((id) => id !== sectionId),
      };
    });
  }

  async function handleDraftWithAi(
    activeSection: MdIepSectionSchema,
    field: MdIepField,
    itemIndex?: number,
  ) {
    if (field.kind !== "narrative") return;

    const key = `${activeSection.id}:${itemIndex ?? "single"}:${field.id}`;
    const dataSource = activeSection.repeatable
      ? draft.repeatableSections[activeSection.id]?.[itemIndex ?? 0]
      : draft.sections[activeSection.id];
    const seed = String(dataSource?.[`${field.id}__seed`] ?? "").trim();
    if (!seed) {
      setDraftError("Add seed notes first, then click Draft with AI.");
      return;
    }

    setDraftError("");
    setExportMessage("");
    setDraftingKey(key);

    const studentName = `${String(studentSectionValues.studentFirstName ?? "").trim()} ${String(
      studentSectionValues.studentLastName ?? "",
    ).trim()}`.trim();
    const prompt =
      `${SPED_HIDDEN_PREFIX_GUARDRAIL}\n\n` +
      `Draft a concise Maryland IEP form response.\n` +
      `Section: ${activeSection.title}\n` +
      `Field: ${field.label}\n` +
      `Context: ${field.aiPromptContext}\n` +
      `Student reference: ${studentName || "[Student]"}\n\n` +
      `Teacher seed notes:\n${seed}\n\n` +
      "Return only the drafted field text.";

    const result = await sendChat([{ role: "user", content: prompt }]);
    setDraftingKey(null);

    if (!result.ok) {
      setDraftError(result.message);
      return;
    }

    if (activeSection.repeatable) {
      setRepeatableField(activeSection.id, itemIndex ?? 0, field.id, result.value.trim());
      return;
    }
    setSingleSectionField(activeSection.id, field.id, result.value.trim());
  }

  function advanceToNextStep() {
    setCurrentStep((prev) => Math.min(prev + 1, visibleSections.length));
  }

  function discardAndSkipSection(activeSection: MdIepSectionSchema) {
    setDraft((prev) => ({
      ...prev,
      sections: activeSection.repeatable
        ? prev.sections
        : {
            ...prev.sections,
            [activeSection.id]: buildEmptyItem(activeSection),
          },
      repeatableSections: activeSection.repeatable
        ? {
            ...prev.repeatableSections,
            [activeSection.id]: buildEmptyRepeatableItems(activeSection),
          }
        : prev.repeatableSections,
      skippedSectionIds: Array.from(new Set([...prev.skippedSectionIds, activeSection.id])),
    }));
    setShowSkipConfirm(false);
    advanceToNextStep();
  }

  function skipCurrentSection() {
    if (!section) return;
    if (sectionHasAnswers(draft, section)) {
      setShowSkipConfirm(true);
      return;
    }
    discardAndSkipSection(section);
  }

  function addRepeatableItem(activeSection: MdIepSectionSchema) {
    if (!activeSection.repeatable) return;
    setDraft((prev) => ({
      ...prev,
      repeatableSections: {
        ...prev.repeatableSections,
        [activeSection.id]: [
          ...(prev.repeatableSections[activeSection.id] ?? []),
          buildEmptyItem(activeSection),
        ],
      },
      skippedSectionIds: prev.skippedSectionIds.filter((id) => id !== activeSection.id),
    }));
  }

  function removeRepeatableItem(activeSection: MdIepSectionSchema, itemIndex: number) {
    if (!activeSection.repeatable) return;
    setDraft((prev) => {
      const items = prev.repeatableSections[activeSection.id] ?? [];
      if (items.length <= activeSection.repeatable!.minItems) {
        return prev;
      }
      return {
        ...prev,
        repeatableSections: {
          ...prev.repeatableSections,
          [activeSection.id]: items.filter((_, idx) => idx !== itemIndex),
        },
      };
    });
  }

  function renderField(
    activeSection: MdIepSectionSchema,
    field: MdIepField,
    values: SectionValues,
    onFieldChange: (fieldId: string, value: FieldValue) => void,
    itemIndex?: number,
  ) {
    const inputId = `${activeSection.id}-${itemIndex ?? "single"}-${field.id}`;
    const value = values[field.id] ?? getDefaultValue(field);

    if (field.kind === "deterministic") {
      return (
        <div key={inputId} className="settings-field">
          <label htmlFor={inputId}>
            {field.label}
            {field.required ? " *" : ""}
          </label>
          {field.inputType === "text" && (
            <input
              id={inputId}
              type="text"
              value={String(value)}
              placeholder={field.placeholder}
              onChange={(e) => onFieldChange(field.id, e.currentTarget.value)}
            />
          )}
          {field.inputType === "date" && (
            <input
              id={inputId}
              type="date"
              value={String(value)}
              onChange={(e) => onFieldChange(field.id, e.currentTarget.value)}
            />
          )}
          {field.inputType === "select" && (
            <select
              id={inputId}
              value={String(value)}
              onChange={(e) => onFieldChange(field.id, e.currentTarget.value)}
            >
              <option value="">Select an option</option>
              {field.options?.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          )}
          {field.inputType === "checkbox" && (
            <label className="iep-checkbox-row">
              <input
                id={inputId}
                type="checkbox"
                checked={Boolean(value)}
                onChange={(e) => onFieldChange(field.id, e.currentTarget.checked)}
              />
              <span>Checked</span>
            </label>
          )}
          {field.helpText && <div className="settings-hint">{field.helpText}</div>}
        </div>
      );
    }

    const seedFieldId = `${field.id}__seed`;
    const seedValue = String(values[seedFieldId] ?? "");
    const draftValue = String(values[field.id] ?? "");
    const narrativeDraftKey = `${activeSection.id}:${itemIndex ?? "single"}:${field.id}`;

    return (
      <div key={inputId} className="settings-field iep-narrative-field">
        <label htmlFor={`${inputId}-seed`}>
          {field.label}
          {field.required ? " *" : ""}
        </label>
        <textarea
          id={`${inputId}-seed`}
          rows={5}
          value={seedValue}
          placeholder={field.placeholder ?? "Seed notes for drafting"}
          onChange={(e) => onFieldChange(seedFieldId, e.currentTarget.value)}
        />
        <div className="iep-narrative-actions">
          <Button
            type="button"
            variant="secondary"
            disabled={draftingKey !== null}
            onClick={() => handleDraftWithAi(activeSection, field, itemIndex)}
          >
            {draftingKey === narrativeDraftKey ? "Drafting..." : "Draft with AI"}
          </Button>
        </div>
        <textarea
          id={`${inputId}-draft`}
          rows={7}
          value={draftValue}
          placeholder="Draft appears here. Edit before export."
          onChange={(e) => onFieldChange(field.id, e.currentTarget.value)}
        />
      </div>
    );
  }

  function buildReviewRows(activeSection: MdIepSectionSchema): Array<{ label: string; value: string }> {
    if (activeSection.repeatable) {
      const items = draft.repeatableSections[activeSection.id] ?? [];
      const rows: Array<{ label: string; value: string }> = [];
      items.forEach((item, index) => {
        rows.push({
          label: `${activeSection.repeatable!.itemLabel} ${index + 1}`,
          value: "",
        });
        activeSection.fields.forEach((field) => {
          if (field.kind === "narrative") {
            rows.push({
              label: `- ${field.label}`,
              value: stringifyValue(item[field.id] ?? ""),
            });
            return;
          }
          rows.push({
            label: `- ${field.label}`,
            value: stringifyValue(item[field.id] ?? getDefaultValue(field)),
          });
        });
      });
      return rows;
    }

    const values = draft.sections[activeSection.id] ?? {};
    return activeSection.fields.map((field) => ({
      label: field.label,
      value:
        field.kind === "narrative"
          ? stringifyValue(values[field.id] ?? "")
          : stringifyValue(values[field.id] ?? getDefaultValue(field)),
    }));
  }

  async function handleWordExport() {
    const content: Paragraph[] = [];

    content.push(
      new Paragraph({
        text: "Maryland IEP Draft (MSDE MdIEP July 2020)",
        heading: HeadingLevel.TITLE,
      }),
    );
    content.push(new Paragraph({ text: "" }));

    visibleSections.forEach((activeSection) => {
      content.push(
        new Paragraph({
          text: activeSection.title,
          heading: HeadingLevel.HEADING_1,
        }),
      );

      buildReviewRows(activeSection).forEach((row) => {
        if (!row.value) return;
        content.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `${row.label}: `,
                bold: true,
              }),
              new TextRun({
                text: row.value,
              }),
            ],
          }),
        );
      });

      content.push(new Paragraph({ text: "" }));
    });

    const footer = new Footer({
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: DRAFT_FOOTER_TEXT,
              size: 18,
            }),
          ],
        }),
      ],
    });

    const doc = new Document({
      sections: [
        {
          footers: {
            default: footer,
          },
          children: content,
        },
      ],
    });

    const bytes = new Uint8Array(await Packer.toArrayBuffer(doc));

    if (isTauriRuntime()) {
      const filePath = await save({
        title: "Save IEP draft as Word document",
        defaultPath: "md-iep-draft.docx",
        filters: [{ name: "Word", extensions: ["docx"] }],
      });
      if (!filePath) return;
      await writeFile(filePath, bytes);
      setExportMessage(`Saved Word draft to ${filePath}`);
      return;
    }

    const blob = new Blob([bytes], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "md-iep-draft.docx";
    a.click();
    URL.revokeObjectURL(url);
    setExportMessage("Downloaded Word draft.");
  }

  function handlePdfExport() {
    setIsPrinting(true);
    window.setTimeout(() => {
      window.print();
    }, 40);
  }

  return (
    <div className={`iep-assistant-panel ${isPrinting ? "iep-assistant-print-mode" : ""}`}>
      <header className="wizard-header">
        <Button variant="ghost" onClick={onBack}>
          ← Back to library
        </Button>
        <h2>IEP Form Assistant</h2>
      </header>

      <div className="iep-progress">
        <div className="iep-progress-text">
          {isReviewStep
            ? `Review (${visibleSections.length}/${visibleSections.length})`
            : `Section ${currentStep + 1} of ${visibleSections.length}`}
        </div>
        <div className="iep-progress-bar">
          <div
            className="iep-progress-bar-fill"
            style={{
              width: `${(Math.min(currentStep + (isReviewStep ? 1 : 0), visibleSections.length) / Math.max(visibleSections.length, 1)) * 100}%`,
            }}
          />
        </div>
      </div>

      {!isReviewStep && section && (
        <div className="wizard-form iep-section-form">
          <h3>{section.title}</h3>
          <p className="settings-hint">{section.description}</p>
          {section.teamDetermination && (
            <p className="iep-team-determination-label">{IEP_TEAM_DETERMINATIONS_LABEL}</p>
          )}

          {!section.repeatable && (
            <>
              {section.fields.map((field) =>
                renderField(section, field, draft.sections[section.id] ?? {}, (fieldId, value) =>
                  setSingleSectionField(section.id, fieldId, value),
                ),
              )}
            </>
          )}

          {section.repeatable && (
            <div className="iep-repeatable-group">
              {(draft.repeatableSections[section.id] ?? []).map((item, itemIndex) => (
                <div key={`${section.id}-item-${itemIndex}`} className="iep-repeatable-item">
                  <div className="iep-repeatable-item-header">
                    <h4>
                      {section.repeatable!.itemLabel} {itemIndex + 1}
                    </h4>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => removeRepeatableItem(section, itemIndex)}
                      disabled={
                        (draft.repeatableSections[section.id] ?? []).length <= section.repeatable!.minItems
                      }
                    >
                      Remove
                    </Button>
                  </div>
                  {section.fields.map((field) =>
                    renderField(section, field, item, (fieldId, value) =>
                      setRepeatableField(section.id, itemIndex, fieldId, value),
                    itemIndex),
                  )}
                </div>
              ))}
              <Button type="button" variant="secondary" onClick={() => addRepeatableItem(section)}>
                {section.repeatable.addLabel}
              </Button>
            </div>
          )}

          {draftError && <div className="connection-banner connection-banner-error">{draftError}</div>}

          <div className="wizard-actions iep-wizard-actions">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
              disabled={currentStep === 0}
            >
              Previous
            </Button>
            <div className="iep-wizard-actions-right">
              <Button type="button" variant="secondary" onClick={skipCurrentSection}>
                Skip section
              </Button>
              <Button
                type="button"
                onClick={() => setCurrentStep((prev) => Math.min(prev + 1, visibleSections.length))}
              >
                {currentStep === visibleSections.length - 1 ? "Review" : "Next"}
              </Button>
            </div>
          </div>

          {showSkipConfirm && (
            <div className="iep-skip-confirm-backdrop" role="presentation">
              <div className="iep-skip-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="iep-skip-confirm-title">
                <h4 id="iep-skip-confirm-title">This section has answers. Keep them or discard?</h4>
                <div className="iep-skip-confirm-actions">
                  <Button
                    type="button"
                    onClick={() => {
                      markSectionCompleted(section.id);
                      setShowSkipConfirm(false);
                      advanceToNextStep();
                    }}
                  >
                    Keep answers &amp; continue
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => discardAndSkipSection(section)}>
                    Discard &amp; skip
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {isReviewStep && (
        <div className="wizard-form iep-review">
          <h3>Review Completed IEP Draft</h3>
          <p className="settings-hint">
            Review each section before export. Use edit links to jump back to any section.
          </p>
          {visibleSections.map((activeSection, index) => (
            <section key={activeSection.id} className="iep-review-section">
              <div className="iep-review-section-header">
                <h4>{activeSection.title}</h4>
                <Button type="button" variant="ghost" onClick={() => setCurrentStep(index)}>
                  Edit
                </Button>
              </div>
              {draft.skippedSectionIds.includes(activeSection.id) && !sectionHasAnswers(draft, activeSection) ? (
                <p className="settings-hint">Skipped by user.</p>
              ) : (
                <dl className="iep-review-grid">
                  {buildReviewRows(activeSection).map((row, rowIndex) => (
                    <div key={`${activeSection.id}-${rowIndex}`} className="iep-review-row">
                      <dt>{row.label}</dt>
                      <dd>{row.value || "—"}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </section>
          ))}

          <div className="iep-export-actions">
            <Button type="button" onClick={() => void handleWordExport()}>
              Download Word (.docx)
            </Button>
            <Button type="button" variant="secondary" onClick={handlePdfExport}>
              Save as PDF
            </Button>
          </div>
          {exportMessage && <div className="connection-banner connection-banner-success">{exportMessage}</div>}
        </div>
      )}

      <div className="iep-export-footer">{DRAFT_FOOTER_TEXT}</div>
    </div>
  );
}
