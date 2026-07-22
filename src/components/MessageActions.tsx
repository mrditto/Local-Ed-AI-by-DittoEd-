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

interface MessageActionsProps {
  markdown: string;
  disabled: boolean;
  defaultFilenameSeed: { title?: string; fallbackText: string };
}

type PendingAction = "copy" | "word" | "pdf" | null;

const COPIED_RESET_MS = 2000;

export function MessageActions({ markdown, disabled, defaultFilenameSeed }: MessageActionsProps) {
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [copied, setCopied] = useState(false);
  const [actionError, setActionError] = useState<string>("");
  const copiedResetRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copiedResetRef.current) window.clearTimeout(copiedResetRef.current);
    };
  }, []);

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
      {actionError && <span className="chat-message-actions-error">{actionError}</span>}
    </div>
  );
}
