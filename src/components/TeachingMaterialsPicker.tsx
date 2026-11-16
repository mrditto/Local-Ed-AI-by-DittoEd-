import { useEffect, useRef, useState } from "react";
import { TeachingMaterialImport } from "./TeachingMaterialImport";
import { Button } from "./ui/Button";
import { listSavedFiles, saveFileToLibrary } from "../storage/historyStore";
import type { SavedFile } from "../storage/types";
import {
  MATERIAL_ROLES,
  type CurriculumContext,
  type TeachingSource,
} from "../utils/curriculumContext";

interface Props {
  value: CurriculumContext;
  onChange: (value: CurriculumContext) => void;
  onBusyChange: (busy: boolean) => void;
}

export function TeachingMaterialsPicker({ value, onChange, onBusyChange }: Props) {
  const [library, setLibrary] = useState<SavedFile[]>([]);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);
  const latestValue = useRef(value);
  latestValue.current = value;
  useEffect(() => {
    let active = true;
    void listSavedFiles()
      .then((files) => {
        if (active) setLibrary(files);
      })
      .catch(() => {
        if (active)
          setNotice("Saved materials could not be loaded. You can still paste an excerpt.");
      });
    return () => {
      active = false;
    };
  }, []);

  function update(id: string, patch: Partial<TeachingSource>) {
    setNotice("");
    onChange({
      ...latestValue.current,
      sources: latestValue.current.sources.map((source) =>
        source.id === id
          ? {
              ...source,
              ...patch,
              ...((patch.text !== undefined ||
                patch.scope !== undefined ||
                patch.label !== undefined) &&
              source.reviewed !== undefined &&
              patch.reviewed === undefined
                ? { reviewed: false }
                : {}),
            }
          : source,
      ),
    });
  }

  function add() {
    if (value.sources.length >= 3) return;
    onChange({
      ...value,
      sources: [
        ...value.sources,
        {
          id: crypto.randomUUID(),
          role: "content",
          label: "",
          scope: "",
          text: "",
        },
      ],
    });
  }

  async function save(source: TeachingSource) {
    setSaving(true);
    onBusyChange(true);
    setNotice("");
    try {
      await saveFileToLibrary({
        fileName: `${source.label.trim()} — ${source.scope.trim()}`,
        text: source.text.trim(),
        truncated: false,
      });
      setNotice(
        "Saved locally for reuse. The current draft will also retain the excerpts you send.",
      );
      try {
        setLibrary(await listSavedFiles());
      } catch {
        /* Saving succeeded even if refreshing failed. */
      }
    } catch {
      setNotice(
        "Could not save this excerpt. Your text is still here; retry or continue without saving.",
      );
    } finally {
      setSaving(false);
      onBusyChange(false);
    }
  }

  return (
    <fieldset className="teaching-materials" disabled={saving}>
      <legend>My teaching materials</legend>
      <p>
        Paste short excerpts, import selected text, or choose saved text. Give each source a role.
        Enable English OCR to read text from photos/scans. Diagrams and whole-book searching are not
        supported.
      </p>
      <details>
        <summary>Using your materials</summary>
        <p>
          Use relevant excerpts you may use for teaching under permission, a license or an
          applicable exception such as fair use. Education is not a blanket copyright exception.
          Follow publisher and school requirements. Leave out unnecessary student identifiers.
        </p>
        <p>
          Text is processed locally. Sending it includes it in the saved conversation. Removing a
          library item does not remove excerpts already saved in history. Review the draft for
          accuracy and alignment.
        </p>
      </details>
      <div className="settings-field">
        <label htmlFor="curriculum-target">Learning target to preserve</label>
        <input
          id="curriculum-target"
          value={value.target}
          onChange={(e) => onChange({ ...value, target: e.currentTarget.value })}
        />
      </div>
      <div className="settings-field">
        <label htmlFor="curriculum-essentials">
          Essential vocabulary, sequence or teaching approach (optional)
        </label>
        <textarea
          id="curriculum-essentials"
          rows={2}
          value={value.essentials}
          onChange={(e) => onChange({ ...value, essentials: e.currentTarget.value })}
        />
      </div>
      <p>
        Stay aligned with my materials: keep the target and essential content while adapting
        supports.
      </p>
      <label>
        <input
          type="checkbox"
          checked={value.extensions}
          onChange={(e) => onChange({ ...value, extensions: e.currentTarget.checked })}
        />{" "}
        Allow clearly labeled extensions beyond my materials
      </label>
      {value.sources.map((source, index) => (
        <fieldset key={source.id} className="teaching-source">
          <legend>Source S{index + 1}</legend>
          <TeachingMaterialImport
            sourceId={source.id}
            disabled={importingId !== null && importingId !== source.id}
            onBusyChange={(busy) => {
              setImportingId(busy ? source.id : null);
              onBusyChange(busy);
            }}
            onImport={(result) => update(source.id, result)}
            onFailure={() => update(source.id, { reviewed: false })}
          />
          <fieldset className="source-edit-controls" disabled={importingId !== null}>
            <legend className="visually-hidden">Review source S{index + 1}</legend>
            <div className="settings-field">
              <label htmlFor={`source-${source.id}-library`}>
                Start from saved text (optional)
              </label>
              <select
                id={`source-${source.id}-library`}
                value=""
                onChange={(e) => {
                  const saved = library.find((file) => file.id === e.currentTarget.value);
                  if (saved) {
                    update(source.id, {
                      label: saved.fileName,
                      text: saved.text,
                      scope: "",
                      reviewed: false,
                    });
                    setNotice(
                      saved.truncated
                        ? "This saved file was shortened during import. Select a relevant excerpt below and describe its actual scope before generating."
                        : "Review the saved text and enter its page/section description before generating.",
                    );
                  }
                }}
              >
                <option value="">Choose saved text…</option>
                {library.map((file) => (
                  <option key={file.id} value={file.id}>
                    {file.fileName}
                    {file.truncated ? " (shortened import)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="settings-field">
              <label htmlFor={`source-${source.id}-role`}>Use this source as</label>
              <select
                id={`source-${source.id}-role`}
                value={source.role}
                onChange={(e) =>
                  update(source.id, { role: e.currentTarget.value as TeachingSource["role"] })
                }
              >
                {Object.entries(MATERIAL_ROLES).map(([role, label]) => (
                  <option key={role} value={role}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="settings-field">
              <label htmlFor={`source-${source.id}-title`}>Source title / edition</label>
              <input
                id={`source-${source.id}-title`}
                value={source.label}
                onChange={(e) => update(source.id, { label: e.currentTarget.value })}
              />
            </div>
            <div className="settings-field">
              <label htmlFor={`source-${source.id}-scope`}>
                Pages or section included (use a description if page numbers are unknown)
              </label>
              <input
                id={`source-${source.id}-scope`}
                value={source.scope}
                onChange={(e) => update(source.id, { scope: e.currentTarget.value })}
              />
            </div>
            <div className="settings-field">
              <label htmlFor={`source-${source.id}-text`}>
                Review and edit the exact excerpt to send
              </label>
              <textarea
                id={`source-${source.id}-text`}
                rows={5}
                value={source.text}
                onChange={(e) => update(source.id, { text: e.currentTarget.value })}
              />
            </div>
            {source.reviewed !== undefined && (
              <label>
                <input
                  type="checkbox"
                  checked={source.reviewed}
                  onChange={(e) => update(source.id, { reviewed: e.currentTarget.checked })}
                />
                I reviewed this source’s extracted text and page/section description. Images,
                diagrams and table layout may be missing.
              </label>
            )}
            <Button
              type="button"
              variant="secondary"
              disabled={
                !source.label.trim() ||
                !source.scope.trim() ||
                !source.text.trim() ||
                source.reviewed === false
              }
              onClick={() => void save(source)}
            >
              Save excerpt for reuse
            </Button>{" "}
            <Button
              type="button"
              variant="ghost"
              onClick={() =>
                onChange({
                  ...value,
                  sources: value.sources.filter((item) => item.id !== source.id),
                })
              }
            >
              Remove source S{index + 1}
            </Button>
          </fieldset>
        </fieldset>
      ))}
      <Button
        type="button"
        variant="secondary"
        disabled={value.sources.length >= 3 || importingId !== null}
        onClick={add}
      >
        Add source excerpt
      </Button>
      <p role="status">{saving ? "Saving excerpt…" : notice}</p>
    </fieldset>
  );
}
