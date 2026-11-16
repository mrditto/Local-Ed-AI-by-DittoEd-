import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import fs from "node:fs/promises";
import ts from "typescript";
async function harness(deferred = false) {
  const calls = { options: [], recognize: 0, terminated: 0 };
  const context = vm.createContext({
    URL,
    DOMException,
    window: { location: { href: "http://tauri.localhost/" } },
  });
  const engine = new vm.SyntheticModule(
    ["createWorker", "OEM"],
    function () {
      this.setExport("OEM", { LSTM_ONLY: 1 });
      this.setExport("createWorker", async (_language, _mode, options) => {
        calls.options.push(options);
        return {
          recognize: () => {
            calls.recognize++;
            return deferred
              ? new Promise(() => {})
              : Promise.resolve({ data: { text: " Recognized text " } });
          },
          terminate: async () => {
            calls.terminated++;
          },
        };
      });
    },
    { context },
  );
  await engine.link(() => {});
  await engine.evaluate();
  const source = await fs.readFile(new URL("../src/utils/ocrText.ts", import.meta.url), "utf8");
  const module = new vm.SourceTextModule(
    ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      context,
      initializeImportMeta: (meta) => {
        meta.env = { BASE_URL: "/" };
      },
      importModuleDynamically: async () => engine,
    },
  );
  await module.link(() => {});
  await module.evaluate();
  return { api: module.namespace, calls };
}
test("OCR explicitly uses local workers/core/English assets and releases the worker", async () => {
  const { api, calls } = await harness();
  assert.equal(
    await api.recognizeCanvas({ width: 100, height: 100 }, new AbortController().signal),
    "Recognized text",
  );
  assert.equal(calls.options[0].workerPath, "http://tauri.localhost/ocr/worker.min.js");
  assert.equal(calls.options[0].langPath, "http://tauri.localhost/ocr/");
  assert.equal(calls.options[0].corePath, "http://tauri.localhost/ocr/");
  assert.equal(calls.options[0].cacheMethod, "none");
  assert.equal(calls.options[0].gzip, false);
  assert.equal(calls.terminated, 1);
});
test("cancellation rejects a pending recognition, releases the worker and permits recovery", async () => {
  const { api, calls } = await harness(true);
  const controller = new AbortController();
  const pending = api.recognizeCanvas({ width: 100, height: 100 }, controller.signal);
  for (let i = 0; i < 20 && !calls.recognize; i++)
    await new Promise((resolve) => setTimeout(resolve, 1));
  assert.equal(calls.recognize, 1);
  await assert.rejects(
    api.recognizeCanvas({ width: 100, height: 100 }, new AbortController().signal),
    /Another page/,
  );
  const cancelled = assert.rejects(pending, /Cancelled/);
  controller.abort();
  await cancelled;
  assert.ok(calls.terminated >= 1);
  const next = new AbortController();
  next.abort();
  await assert.rejects(api.recognizeCanvas({ width: 100, height: 100 }, next.signal), /Cancelled/);
  // A fresh non-deferred harness confirms a successful retry; the browser test also retries on the same module.
  const ready = await harness();
  assert.equal(
    await ready.api.recognizeCanvas({ width: 100, height: 100 }, new AbortController().signal),
    "Recognized text",
  );
});
test("oversized/empty page canvases are rejected before initializing OCR", async () => {
  const { api, calls } = await harness();
  for (const canvas of [
    { width: 0, height: 0 },
    { width: 3000, height: 3000 },
  ])
    await assert.rejects(api.recognizeCanvas(canvas, new AbortController().signal), /large/);
  assert.equal(calls.options.length, 0);
});
