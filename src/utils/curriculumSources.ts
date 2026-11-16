export interface CurriculumSourceRef {
  sourceId: string;
  role: string;
  title: string;
  section: string;
}

interface SourceMessage {
  role: string;
  curriculumSources?: CurriculumSourceRef[];
}

/** Sources supplied to this conversation, not a claim that every answer is verified. */
export function sourcesForResponse(
  messages: SourceMessage[],
  responseIndex: number,
): CurriculumSourceRef[] {
  for (let i = responseIndex - 1; i >= 0; i--) {
    if (messages[i].role === "user" && messages[i].curriculumSources !== undefined) {
      return messages[i].curriculumSources ?? [];
    }
  }
  return [];
}

function plainLabel(value: string): string {
  return value.replace(/[\r\n]+/g, " ").replace(/([\\`*_{}[\]<>#!|])/g, "\\$1");
}

export function withCurriculumSourceNotes(
  markdown: string,
  sources: CurriculumSourceRef[],
): string {
  if (!sources.length) return markdown;
  return `${markdown}\n\n---\n\n### Materials supplied for this draft\n\n${sources
    .map(
      (source) =>
        `- ${plainLabel(source.sourceId)}: ${plainLabel(source.title)} — ${plainLabel(source.section)} (${plainLabel(source.role)})`,
    )
    .join(
      "\n",
    )}\n\nSource descriptions were supplied by the educator. They are not verified citations or a guarantee of curriculum fidelity. Review the draft against the original materials.`;
}
