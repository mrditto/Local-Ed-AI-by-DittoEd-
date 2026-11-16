import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import fs from "node:fs/promises";
import ts from "typescript";
const code = ts.transpileModule(
  await fs.readFile(new URL("../src/utils/curriculumSources.ts", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } },
).outputText;
const module = new vm.SourceTextModule(code);
await module.link(() => {
  throw Error("Unexpected import");
});
await module.evaluate();
const { sourcesForResponse, withCurriculumSourceNotes } = module.namespace;
const sources = [
  {
    sourceId: "S1",
    title: "Student reference",
    section: "Energy paragraph",
    role: "Student content / reference",
  },
];

test("source descriptions survive serialization and follow-up without attaching future sources to past answers", () => {
  const messages = JSON.parse(
    JSON.stringify([
      { role: "user", curriculumSources: sources },
      { role: "assistant" },
      { role: "user" },
      { role: "assistant" },
      { role: "user", curriculumSources: [{ ...sources[0], title: "Different unit" }] },
      { role: "assistant" },
    ]),
  );
  assert.equal(sourcesForResponse(messages, 1)[0].title, "Student reference");
  assert.equal(sourcesForResponse(messages, 3)[0].title, "Student reference");
  assert.equal(sourcesForResponse(messages, 5)[0].title, "Different unit");
  assert.equal(sourcesForResponse([{ role: "user" }, { role: "assistant" }], 1).length, 0);
  assert.equal(
    sourcesForResponse(
      [
        { role: "user", curriculumSources: sources },
        { role: "user", curriculumSources: [] },
        { role: "assistant" },
      ],
      2,
    ).length,
    0,
  );
});

test("exports retain source labels and review limits without copying source excerpts", () => {
  const markdown = withCurriculumSourceNotes("Lesson draft", sources);
  assert.match(markdown, /Materials supplied for this draft/);
  assert.match(markdown, /S1: Student reference/);
  assert.match(markdown, /Energy paragraph/);
  assert.match(markdown, /not verified citations/);
  assert.equal(withCurriculumSourceNotes("Original", []), "Original");
});

test("source labels cannot inject active markdown into export notes", () => {
  const markdown = withCurriculumSourceNotes("Draft", [
    { ...sources[0], title: "[click](https://example.invalid)\n# fake heading" },
  ]);
  assert.equal(markdown.includes("\n# fake heading"), false);
  assert.equal(markdown.includes("- S1: [click]"), false);
});
