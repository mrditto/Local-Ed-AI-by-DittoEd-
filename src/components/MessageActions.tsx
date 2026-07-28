import { useEffect, useRef, useState } from "react";
import { Document, Packer } from "docx";
import { Button } from "./ui/Button";
import {
  buildDefaultFilename,
  buildDocxNumberingConfig,
  buildDocxParagraphsFromMarkdown,
  buildPdfBytesFromMarkdown,
  copyToClipboard,
  saveGeneratedFile,
} from "../utils/exportMessage";
import { openFeedbackEmail } from "../utils/feedback";

interface MessageActionsProps {
  markdown: string;
  disabled: boolean;
  defaultFilenameSeed: { title?: string; fallbackText: string };
  flagged: boolean;
  onFlag: (note: string) => void;
}

type PendingAction = "copy" | "word" | "pdf" | "email" | null;

const COPIED_RESET_MS = 2000;
const THANKS_RESET_MS = 6000;

export function MessageActions({ markdown, disabled, defaultFilenameSeed, flagged, onFlag }: MessageActionsProps) {
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [copied, setCopied] = useState(false);
  const [actionError, setActionError] = useState<string>("");
  const [showFlagForm, setShowFlagForm] = useState(false);
  const [noteInput, setNoteInput] = useState("");
  const [justEmailed, setJustEmailed] = useState(false);
  const copiedResetRef = useRef<number | null>(null);
  const emailedResetRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copiedResetRef.current) window.clearTimeout(copiedResetRef.current);
      if (emailedResetRef.current) window.clearTimeout(emailedResetRef.current);
    };
  }, []);

  async function handleSendReport() {
    setActionError("");
    setPendingAction("email");
    try {
      await openFeedbackEmail({
        subject: "Local Ed AI — response flagged for review",
        note: noteInput,
        quoted: { label: "The AI's response", text: markdown },
      });
      onFlag(noteInput);
      setShowFlagForm(false);
      setNoteInput("");
      setJustEmailed(true);
      if (emailedResetRef.current) window.clearTimeout(emailedResetRef.current);
      emailedResetRef.current = window.setTimeout(() => setJustEmailed(false), THANKS_RESET_MS);
    } catch {
      setActionError("Couldn't open your email app — try again.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleCopy() {
    setActionError("");
    setPendingAction("copy");
    const ok = await copyToClipboard(markdown);
    setPendingAction(null);
    if (!ok) {
      setActionError("Couldn't copy — try again.");
      return;
    }
    setCopied(true);
    if (copiedResetRef.current) window.clearTimeout(copiedResetRef.current);
    copiedResetRef.current = window.setTimeout(() => setCopied(false), COPIED_RESET_MS);
  }

  async function handleWordExport() {
    setActionError("");
    setPendingAction("word");
    try {
      const doc = new Document({
        numbering: buildDocxNumberingConfig(),
        sections: [{ children: buildDocxParagraphsFromMarkdown(markdown) }],
      });
      const bytes = new Uint8Array(await Packer.toArrayBuffer(doc));
      const result = await saveGeneratedFile(bytes, {
        baseFilename: buildDefaultFilename(defaultFilenameSeed),
        extension: "docx",
        dialogTitle: "Save response as Word document",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      if (!result.ok && !result.cancelled) {
        setActionError("Couldn't save the Word document — try again.");
      }
    } catch {
      setActionError("Couldn't save the Word document — try again.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handlePdfExport() {
    setActionError("");
    setPendingAction("pdf");
    try {
      const bytes = buildPdfBytesFromMarkdown(markdown);
      const result = await saveGeneratedFile(bytes, {
        baseFilename: buildDefaultFilename(defaultFilenameSeed),
        extension: "pdf",
        dialogTitle: "Save response as PDF",
        mimeType: "application/pdf",
      });
      if (!result.ok && !result.cancelled) {
        setActionError("Couldn't save the PDF — try again.");
      }
    } catch {
      setActionError("Couldn't save the PDF — try again.");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="chat-message-actions-block">
      <div className="chat-message-actions">
        <Button
          type="button"
          variant="ghost"
          disabled={disabled || pendingAction !== null}
          onClick={() => void handleCopy()}
        >
          {copied ? "✓ Copied" : "📋 Copy"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={disabled || pendingAction !== null}
          onClick={() => void handleWordExport()}
        >
          {pendingAction === "word" ? "Saving…" : "📄 Word"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={disabled || pendingAction !== null}
          onClick={() => void handlePdfExport()}
        >
          {pendingAction === "pdf" ? "Saving…" : "📕 PDF"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={disabled || pendingAction !== null || flagged}
          onClick={() => setShowFlagForm((prev) => !prev)}
        >
          {flagged ? "🚩 Flagged" : "🚩 Flag for review"}
        </Button>
        {actionError && <span className="chat-message-actions-error">{actionError}</span>}
      </div>

      {showFlagForm && !flagged && (
        <div className="chat-message-flag-form">
          <label htmlFor="flag-note">What was wrong with this response? (optional)</label>
          <textarea
            id="flag-note"
            rows={2}
            value={noteInput}
            placeholder="e.g. factually wrong, unhelpful, biased, inappropriate tone…"
            onChange={(e) => setNoteInput(e.currentTarget.value)}
          />
          <div className="chat-message-flag-form-actions">
            <Button type="button" disabled={pendingAction !== null} onClick={() => void handleSendReport()}>
              {pendingAction === "email" ? "Opening email…" : "✉️ Email Brad about this"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setShowFlagForm(false)}>
              Cancel
            </Button>
          </div>
          <p className="settings-hint">
            Opens your email app with this response pre-filled, addressed to brad@reactallegany.org. Nothing is
            sent automatically — review the draft and hit Send yourself.
          </p>
        </div>
      )}

      {justEmailed && (
        <p className="chat-message-flag-thanks">Thanks for letting us know — check your email app to send it.</p>
      )}
    </div>
  );
}
