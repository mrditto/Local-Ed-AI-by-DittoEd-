import { useEffect, useRef, useState } from "react";
import { Button } from "./ui/Button";
import { extractTeachingMaterial } from "../utils/extractTeachingMaterial";

interface Props {
  disabled: boolean;
  sourceId: string;
  onImport: (result: { label: string; scope: string; text: string; reviewed: boolean }) => void;
  onFailure: () => void;
  onBusyChange: (busy: boolean) => void;
}

export function TeachingMaterialImport({
  sourceId,
  disabled,
  onImport,
  onFailure,
  onBusyChange,
}: Props) {
  const [firstPage, setFirstPage] = useState("1"),
    [lastPage, setLastPage] = useState("1");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);

  async function pick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    onBusyChange(true);
    setError("");
    try {
      const result = await extractTeachingMaterial(file, {
        firstPage: Number(firstPage),
        lastPage: Number(lastPage),
        signal: controller.signal,
      });
      if (!result.ok) {
        setError(result.error);
        onFailure();
      } else {
        onImport({ label: file.name, text: result.text, scope: result.scope, reviewed: false });
      }
    } finally {
      active.current = null;
      setBusy(false);
      onBusyChange(false);
    }
  }

  return (
    <div className="material-file-import">
      <p>
        Import one file into this source. PDF defaults to file page 1; choose its range before
        importing. All formats extract text only, not diagrams, images or reliable table layout.
      </p>
      <div className="settings-field">
        <label htmlFor={`${sourceId}-first-page`}>First PDF file page</label>
        <input
          id={`${sourceId}-first-page`}
          type="number"
          min="1"
          step="1"
          value={firstPage}
          disabled={busy || disabled}
          onChange={(e) => setFirstPage(e.currentTarget.value)}
        />
        <label htmlFor={`${sourceId}-last-page`}>Last PDF file page</label>
        <input
          id={`${sourceId}-last-page`}
          type="number"
          min="1"
          step="1"
          value={lastPage}
          disabled={busy || disabled}
          onChange={(e) => setLastPage(e.currentTarget.value)}
        />
        <label htmlFor={`${sourceId}-import`}>Import file for this source (up to 8 MB)</label>
        <input
          id={`${sourceId}-import`}
          type="file"
          accept=".pdf,.docx,.txt,.md"
          disabled={busy || disabled}
          onChange={(e) => void pick(e)}
        />
      </div>
      {busy && (
        <>
          <p role="status">Reading selected text…</p>
          <Button type="button" variant="secondary" onClick={() => active.current?.abort()}>
            Cancel import
          </Button>
        </>
      )}
      {error && (
        <p role="alert" className="attachment-error">
          {error} Previous source text remains unchanged; review it before continuing.
        </p>
      )}
    </div>
  );
}
