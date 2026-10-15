import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { Button } from "./ui/Button";
import { Spinner } from "./ui/Spinner";

interface ModelStatus { id: string; filename: string; bytes: number; installed: boolean }
interface SetupStatus { models: ModelStatus[]; selected: string | null; active: string | null }
export function IntegratedSetup({ onDone, autoLoad = false }: { onDone: () => void; autoLoad?: boolean }) {
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let disposed = false;
    void (async () => {
      try {
        const next = await invoke<SetupStatus>("integrated_setup_status");
        if (disposed) return;
        setStatus(next);
        if (autoLoad && next.selected) {
          setBusy("Verifying and loading your model…");
          await invoke("select_integrated_model", { modelId: next.selected });
          if (!disposed) onDone();
        }
      } catch (e) { if (!disposed) setError(String(e)); }
      finally { if (!disposed) setBusy(null); }
    })();
    return () => { disposed = true; };
    // Startup only; subsequent model changes are explicit actions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function run(model: ModelStatus, importing: boolean) {
    setError("");
    try {
      const path = importing ? await open({ multiple: false, filters: [{ name: "GGUF model", extensions: ["gguf"] }] }) : null;
      if (importing && typeof path !== "string") return;
      setBusy(importing ? "Copying and verifying model…" : "Verifying and loading model…");
      if (importing) await invoke("import_integrated_model", { modelId: model.id, source: path });
      await invoke("select_integrated_model", { modelId: model.id });
      setStatus(await invoke<SetupStatus>("integrated_setup_status"));
    } catch (e) { setError(String(e)); setStatus(await invoke<SetupStatus>("integrated_setup_status")); }
    finally { setBusy(null); }
  }
  return <section className="setup-screen"><div className="setup-card setup-card-models">
    <h1>Local Ed AI integrated setup</h1>
    <p className="setup-lede">The local AI engine and default Qwen3.5 4B model are included. Draft offline without installing another AI application.</p>
    <p>The included model is verified before loading. Optional local imports use the exact Q4_K_M files below and preserve your original files.</p>
    <div className="settings-model-tiers">{status?.models.map(model => <article className="model-tier-card" key={model.id}>
      <h3>{model.id.includes("4b") ? "Qwen3.5 4B — default" : "Qwen3.5 2B — smaller model"}</h3>
      <p>{model.filename} · {(model.bytes / 1e9).toFixed(2)} GB</p>
      <p>{status.active === model.id ? "Loaded" : model.installed ? "Available" : "Import needed"}</p>
      <Button disabled={Boolean(busy)} onClick={() => void run(model, true)}>Import local GGUF</Button>{" "}
      {model.installed && <Button variant="secondary" disabled={Boolean(busy) || status.active === model.id} onClick={() => void run(model, false)}>Load this model</Button>}
    </article>)}</div>
    {busy && <><Spinner label={busy} /><Button variant="secondary" onClick={() => void invoke("cancel_integrated_setup")}>Cancel</Button></>}
    {error && <div className="connection-banner connection-banner-error" role="alert">{error}</div>}
    {!status && !busy && <p>Model setup unavailable. Close and reopen the app to retry.</p>}
    {status?.active && !busy && <Button onClick={onDone}>Continue to educator tools</Button>}
    <p className="settings-hint">Models: Apache 2.0. Inference engine: llama.cpp MIT. This is a development build; hardware and educator quality evaluation are still pending.</p>
  </div></section>;
}
