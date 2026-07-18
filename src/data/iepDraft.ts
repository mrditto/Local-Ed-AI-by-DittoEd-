import { mdIepFormSections, type MdIepField, type MdIepSectionSchema } from "./mdIepFormSchema";

export type FieldValue = string | boolean;
export type SectionValues = Record<string, FieldValue>;

export interface IepDraftState {
  version: 1;
  sections: Record<string, SectionValues>;
  repeatableSections: Record<string, SectionValues[]>;
  skippedSectionIds: string[];
}

/** Legacy single-draft localStorage key, pre-dating session history. Read-only now — kept for one-time migration. */
export const LEGACY_IEP_DRAFT_STORAGE_KEY = "educatorllm-iep-form-draft";

export function getDefaultValue(field: MdIepField): FieldValue {
  if (field.kind === "deterministic" && field.inputType === "checkbox") {
    return false;
  }
  return "";
}

export function buildEmptyItem(section: MdIepSectionSchema): SectionValues {
  const item: SectionValues = {};
  section.fields.forEach((field) => {
    item[field.id] = getDefaultValue(field);
    if (field.kind === "narrative") {
      item[`${field.id}__seed`] = "";
    }
  });
  return item;
}

export function buildEmptyRepeatableItems(section: MdIepSectionSchema): SectionValues[] {
  return Array.from({ length: Math.max(1, section.repeatable?.minItems ?? 1) }, () => buildEmptyItem(section));
}

export function buildInitialDraft(): IepDraftState {
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

function mergeWithInitialDraft(parsed: Partial<IepDraftState> | null | undefined): IepDraftState {
  const initial = buildInitialDraft();
  if (!parsed || typeof parsed !== "object") return initial;

  return {
    ...initial,
    sections: { ...initial.sections, ...(parsed.sections ?? {}) },
    repeatableSections: { ...initial.repeatableSections, ...(parsed.repeatableSections ?? {}) },
    skippedSectionIds: Array.isArray(parsed.skippedSectionIds) ? parsed.skippedSectionIds : [],
  };
}

/** Reads the legacy single-draft key. Used only by the one-time history migration. */
export function readLegacyIepDraftFromStorage(): IepDraftState | null {
  try {
    const raw = localStorage.getItem(LEGACY_IEP_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    return mergeWithInitialDraft(JSON.parse(raw) as Partial<IepDraftState>);
  } catch {
    return null;
  }
}

export function stringifyValue(value: FieldValue): string {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return value.trim();
}

export function hasValue(value: FieldValue | undefined): boolean {
  if (typeof value === "boolean") return value;
  return Boolean(value?.trim());
}

export function sectionHasAnswers(draft: IepDraftState, activeSection: MdIepSectionSchema): boolean {
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

/** Best-effort title for a saved IEP session: the student's name if entered, else a generic label. */
export function deriveIepSessionTitle(draft: IepDraftState, fallback = "Untitled IEP draft"): string {
  const studentValues = draft.sections["student-school-information"] ?? {};
  const name = `${String(studentValues.studentFirstName ?? "").trim()} ${String(
    studentValues.studentLastName ?? "",
  ).trim()}`.trim();
  return name || fallback;
}

export function iepAnswerCount(draft: IepDraftState): number {
  let count = 0;
  mdIepFormSections.forEach((section) => {
    if (section.repeatable) {
      (draft.repeatableSections[section.id] ?? []).forEach((item) => {
        if (
          section.fields.some(
            (field) => hasValue(item[field.id]) || (field.kind === "narrative" && hasValue(item[`${field.id}__seed`])),
          )
        ) {
          count += 1;
        }
      });
      return;
    }
    if (sectionHasAnswers(draft, section)) {
      count += 1;
    }
  });
  return count;
}
