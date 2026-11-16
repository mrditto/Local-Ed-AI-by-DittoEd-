import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import fs from "node:fs/promises";
import ts from "typescript";
const source = await fs.readFile(
  new URL("../src/utils/extractTeachingMaterial.ts", import.meta.url),
  "utf8",
);
async function extractor(pages = ["Page one", "Page two"], word = "Word reference") {
  const counts = { destroy: 0, cleanup: 0, read: [] };
  const context = vm.createContext({ URL, Uint8Array });
  const pdf = new vm.SyntheticModule(
    ["GlobalWorkerOptions", "getDocument"],
    function () {
      this.setExport("GlobalWorkerOptions", {});
      this.setExport("getDocument", () => ({
        destroy: async () => {
          counts.destroy++;
        },
        promise: Promise.resolve({
          numPages: pages.length,
          getPage: async (number) => {
            counts.read.push(number);
            return {
              cleanup: () => {
                counts.cleanup++;
              },
              getTextContent: async () => ({ items: [{ str: pages[number - 1], hasEOL: true }] }),
            };
          },
        }),
      }));
    },
    { context },
  );
  const docx = new vm.SyntheticModule(
    ["extractRawText"],
    function () {
      this.setExport("extractRawText", async () => {
        if (word === null) throw Error("damaged");
        return { value: word };
      });
    },
    { context },
  );
  const module = new vm.SourceTextModule(
    ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      context,
      initializeImportMeta: (meta) => {
        meta.url = "file:///test/material.ts";
      },
    },
  );
  await module.link((name) => (name === "mammoth" ? docx : pdf));
  await module.evaluate();
  return { extract: module.namespace.extractTeachingMaterial, counts };
}
const file = (name, text = "reference", size = 20) => ({
  name,
  size,
  text: async () => text,
  arrayBuffer: async () => new ArrayBuffer(0),
});
const options = () => ({ firstPage: 1, lastPage: 1, signal: new AbortController().signal });
test("PDF extracts only selected file pages with labels and destroys worker resources", async () => {
  const h = await extractor();
  const result = await h.extract(file("Unit.pdf"), { ...options(), firstPage: 2, lastPage: 2 });
  assert.equal(result.ok, true);
  assert.match(result.text, /PDF file page 2/);
  assert.match(result.text, /Page two/);
  assert.equal(result.text.includes("Page one"), false);
  assert.deepEqual(h.counts.read, [2]);
  assert.equal(h.counts.cleanup, 1);
  assert.equal(h.counts.destroy, 1);
});
test("empty/scanned and out-of-range PDF pages fail rather than provide incomplete references", async () => {
  const h = await extractor([""]);
  const scan = await h.extract(file("scan.pdf"), options());
  assert.equal(scan.ok, false);
  assert.match(scan.error, /no readable text/);
  const range = await h.extract(file("unit.pdf"), { ...options(), lastPage: 2 });
  assert.equal(range.ok, false);
  assert.match(range.error, /has 1 file pages/);
  assert.equal(h.counts.destroy, 2);
});
test("invalid page ranges, large files and unsupported photos fail clearly", async () => {
  const h = await extractor();
  for (const patch of [{ firstPage: 0 }, { lastPage: 11 }, { firstPage: 1.5 }])
    assert.equal((await h.extract(file("unit.pdf"), { ...options(), ...patch })).ok, false);
  assert.match((await h.extract(file("unit.txt", "x", 9 * 1024 * 1024), options())).error, /8 MB/);
  assert.match((await h.extract(file("photo.png"), options())).error, /OCR/);
});
test("long text and DOCX imports reject without shortening; damaged DOCX reports failure", async () => {
  const h = await extractor();
  const text = await h.extract(file("unit.txt", "x".repeat(12001)), options());
  assert.equal(text.ok, false);
  assert.match(text.error, /Nothing was shortened/);
  const docx = await h.extract(file("guide.docx"), options());
  assert.equal(docx.ok, true);
  assert.equal(docx.scope, "");
  assert.equal(docx.text, "Word reference");
  assert.equal((await (await extractor([], null)).extract(file("bad.docx"), options())).ok, false);
});
test("cancelled imports do not return a successful replacement", async () => {
  const h = await extractor();
  const controller = new AbortController();
  controller.abort();
  const result = await h.extract(file("unit.pdf"), { ...options(), signal: controller.signal });
  assert.equal(result.ok, false);
  assert.match(result.error, /cancelled/);
  assert.equal(h.counts.destroy, 0);
});
