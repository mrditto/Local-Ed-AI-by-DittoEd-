import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
const root = path.resolve(import.meta.dirname, "..");
const pin = JSON.parse(await fs.readFile(path.join(root, "config/ocr-artifacts.json"), "utf8"));
const cache = path.join(root, "local-ai-data/ocr"),
  output = path.join(root, "public/ocr");
const offline = process.argv.includes("--offline");
const digest = (data) => createHash("sha256").update(data).digest("hex");
await fs.mkdir(cache, { recursive: true });
await fs.mkdir(output, { recursive: true });
for (const [name, version] of [
  ["tesseract.js", pin.engineVersion],
  ["tesseract.js-core", pin.coreVersion],
]) {
  const pkg = JSON.parse(
    await fs.readFile(path.join(root, "node_modules", name, "package.json"), "utf8"),
  );
  if (pkg.version !== version)
    throw Error(`Unexpected ${name} version ${pkg.version}; expected ${version}`);
}
const dataPath = path.join(cache, "eng.traineddata");
let language = await fs.readFile(dataPath).catch(() => null);
if (!language) {
  if (offline)
    throw Error("OCR language data missing. Run npm run ocr:assets once before an offline build.");
  const response = await fetch(pin.language.url, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw Error("OCR language download failed: " + response.status);
  language = Buffer.from(await response.arrayBuffer());
  if (language.length !== pin.language.bytes || digest(language) !== pin.language.sha256)
    throw Error("OCR language integrity check failed");
  await fs.writeFile(dataPath, language);
}
if (language.length !== pin.language.bytes || digest(language) !== pin.language.sha256)
  throw Error("Cached OCR language integrity check failed");
const licensePath = path.join(cache, "TESSDATA-LICENSE.txt");
let license = await fs.readFile(licensePath).catch(() => null);
if (!license) {
  if (offline) throw Error("OCR license missing; run npm run ocr:assets");
  const response = await fetch(pin.language.licenseUrl, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw Error("OCR license download failed");
  license = Buffer.from(await response.arrayBuffer());
  if (!license.toString().includes("Apache License")) throw Error("Unexpected OCR license");
  await fs.writeFile(licensePath, license);
}
const files = [
  ["worker.min.js", path.join(root, "node_modules/tesseract.js/dist/worker.min.js")],
  ["TESSERACT-LICENSE.md", path.join(root, "node_modules/tesseract.js/LICENSE.md")],
  ["CORE-LICENSE.txt", path.join(root, "node_modules/tesseract.js-core/LICENSE")],
  ["eng.traineddata", dataPath],
  ["TESSDATA-LICENSE.txt", licensePath],
];
for (const name of await fs.readdir(path.join(root, "node_modules/tesseract.js-core"))) {
  if (/^tesseract-core[-\w]*\.wasm(?:\.js)?$/.test(name))
    files.push([name, path.join(root, "node_modules/tesseract.js-core", name)]);
}
const inventory = [];
for (const [name, source] of files) {
  const bytes = await fs.readFile(source);
  await fs.writeFile(path.join(output, name), bytes);
  inventory.push({ file: name, bytes: bytes.length, sha256: digest(bytes) });
}
await fs.writeFile(
  path.join(output, "inventory.json"),
  JSON.stringify(
    {
      engineVersion: pin.engineVersion,
      coreVersion: pin.coreVersion,
      language: pin.language,
      files: inventory,
    },
    null,
    2,
  ),
);
console.log(
  `Staged ${inventory.length} local OCR files (${inventory.reduce((sum, item) => sum + item.bytes, 0)} bytes), including English data and licenses. No runtime CDN paths needed.`,
);
