import { openUrl } from "@tauri-apps/plugin-opener";

export const FEEDBACK_EMAIL = "brad@reactallegany.org";

const MAX_QUOTED_CHARS = 1200;

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n[…truncated]`;
}

function buildMailto(subject: string, body: string): string {
  return `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/**
 * Opens the user's own default email app with a pre-filled draft addressed
 * to FEEDBACK_EMAIL. This is the only "reporting" mechanism in the app —
 * Local Ed AI has no backend and sends no telemetry, so nothing is
 * transmitted here. It's a handoff to whatever mail client is installed;
 * nothing is actually sent unless the teacher reviews the draft and hits
 * Send themselves.
 */
export async function openFeedbackEmail(options: {
  subject: string;
  note?: string;
  quoted?: { label: string; text: string };
}): Promise<void> {
  const lines: string[] = [
    "Before sending: please check this doesn't include a student's name or other identifying details.",
    "",
  ];
  if (options.note?.trim()) {
    lines.push("What happened:", options.note.trim(), "");
  }
  if (options.quoted?.text.trim()) {
    lines.push(`${options.quoted.label}:`, truncate(options.quoted.text.trim(), MAX_QUOTED_CHARS), "");
  }
  lines.push("— sent from Local Ed AI");

  await openUrl(buildMailto(options.subject, lines.join("\n")));
}
