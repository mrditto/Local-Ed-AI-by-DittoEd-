import { useEffect, useRef, useState } from "react";
import { Button } from "./ui/Button";
import { openFeedbackEmail } from "../utils/feedback";

const THANKS_RESET_MS = 6000;

/** A one-click "email this error to Brad" link shown under error bubbles —
 * no flag/note step needed, since the error text itself is the report. */
export function ErrorReportLink({ errorText }: { errorText: string }) {
  const [isEmailing, setIsEmailing] = useState(false);
  const [justEmailed, setJustEmailed] = useState(false);
  const [actionError, setActionError] = useState("");
  const resetRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (resetRef.current) window.clearTimeout(resetRef.current);
    };
  }, []);

  async function handleSend() {
    setActionError("");
    setIsEmailing(true);
    try {
      await openFeedbackEmail({
        subject: "Local Ed AI — error report",
        quoted: { label: "The error", text: errorText },
      });
      setJustEmailed(true);
      if (resetRef.current) window.clearTimeout(resetRef.current);
      resetRef.current = window.setTimeout(() => setJustEmailed(false), THANKS_RESET_MS);
    } catch {
      setActionError("Couldn't open your email app — try again.");
    } finally {
      setIsEmailing(false);
    }
  }

  return (
    <div className="chat-error-report">
      <Button type="button" variant="ghost" disabled={isEmailing} onClick={() => void handleSend()}>
        {isEmailing ? "Opening email…" : "✉️ Email Brad about this error"}
      </Button>
      {actionError && <span className="chat-message-actions-error">{actionError}</span>}
      {justEmailed && <p className="chat-message-flag-thanks">Thanks for letting us know — check your email app to send it.</p>}
    </div>
  );
}
