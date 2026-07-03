export interface Personalization {
  name: string;
  preferredName: string;
  role: string;
  school: string;
  tone: "professional" | "friendly" | "casual";
  length: "short" | "standard" | "detailed";
}

const STORAGE_KEY = "educatorllm-personalization";

const defaultPersonalization: Personalization = {
  name: "",
  preferredName: "",
  role: "",
  school: "",
  tone: "professional",
  length: "standard",
};

function isTone(value: unknown): value is Personalization["tone"] {
  return value === "professional" || value === "friendly" || value === "casual";
}

function isLength(value: unknown): value is Personalization["length"] {
  return value === "short" || value === "standard" || value === "detailed";
}

export function loadPersonalization(): Personalization {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Personalization>;
      return {
        name: typeof parsed.name === "string" ? parsed.name : defaultPersonalization.name,
        preferredName:
          typeof parsed.preferredName === "string"
            ? parsed.preferredName
            : defaultPersonalization.preferredName,
        role: typeof parsed.role === "string" ? parsed.role : defaultPersonalization.role,
        school: typeof parsed.school === "string" ? parsed.school : defaultPersonalization.school,
        tone: isTone(parsed.tone) ? parsed.tone : defaultPersonalization.tone,
        length: isLength(parsed.length) ? parsed.length : defaultPersonalization.length,
      };
    }
  } catch {
    // Corrupt storage — use defaults.
  }
  return { ...defaultPersonalization };
}

export function savePersonalization(personalization: Personalization): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(personalization));
}

export function toneInstruction(tone: Personalization["tone"]): string {
  switch (tone) {
    case "friendly":
      return "Use a warm, friendly tone.";
    case "casual":
      return "Use a relaxed, casual tone.";
    default:
      return "Use a professional tone suitable for school and district communication.";
  }
}

export function lengthInstruction(length: Personalization["length"]): string {
  switch (length) {
    case "short":
      return "Keep responses brief — a few sentences or a compact list.";
    case "detailed":
      return "Be very detailed and thorough — include explanations, examples, and step-by-step structure.";
    default:
      return "Use a moderate response length.";
  }
}

export function buildPersonalizationPreamble(
  personalization: Personalization,
  overrides?: {
    tone?: Personalization["tone"];
    length?: Personalization["length"];
  },
): string {
  const name = personalization.name.trim();
  const preferredName = personalization.preferredName.trim();
  const role = personalization.role.trim();
  const school = personalization.school.trim();
  const tone = overrides?.tone ?? personalization.tone;
  const length = overrides?.length ?? personalization.length;
  const isDefault =
    name.length === 0 &&
    preferredName.length === 0 &&
    role.length === 0 &&
    school.length === 0 &&
    tone === "professional" &&
    length === "standard";

  if (isDefault) {
    return "";
  }

  const lines: string[] = ["About the teacher you are helping:"];
  if (name) {
    lines.push(`their name is ${name}.`);
  }
  if (preferredName) {
    lines.push(`Address them as ${preferredName}.`);
  }
  if (role && school) {
    lines.push(`They are a ${role} at ${school}. Tailor content to that role.`);
  } else if (role) {
    lines.push(`They are a ${role}. Tailor content to that role.`);
  } else if (school) {
    lines.push(`They work at ${school}.`);
  }

  lines.push(toneInstruction(tone));
  lines.push(lengthInstruction(length));

  return lines.join(" ");
}
