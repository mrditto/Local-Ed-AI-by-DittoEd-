import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
const root = path.resolve(import.meta.dirname, ".."),
  folder = path.join(root, "dist/ocr");
const pin = JSON.parse(await fs.readFile(path.join(root, "config/ocr-artifacts.json"), "utf8"));
const inventory = JSON.parse(await fs.readFile(path.join(folder, "inventory.json"), "utf8"));
if (inventory.engineVersion !== pin.engineVersion || inventory.coreVersion !== pin.coreVersion)
  throw Error("Wrong OCR runtime versions");
for (const file of [
  "worker.min.js",
  "eng.traineddata",
  "TESSERACT-LICENSE.md",
  "CORE-LICENSE.txt",
  "TESSDATA-LICENSE.txt",
  ...["", "-simd", "-relaxedsimd"].flatMap((variant) => [
    `tesseract-core${variant}-lstm.wasm.js`,
    `tesseract-core${variant}-lstm.wasm`,
  ]),
]) {
  if (!inventory.files.some((item) => item.file === file)) throw Error("Missing OCR asset " + file);
}
for (const item of inventory.files) {
  if (path.basename(item.file) !== item.file) throw Error("Invalid OCR inventory path");
  const data = await fs.readFile(path.join(folder, item.file));
  const hash = createHash("sha256").update(data).digest("hex");
  if (data.length !== item.bytes || hash !== item.sha256)
    throw Error("OCR asset mismatch: " + item.file);
  if (
    item.file === "eng.traineddata" &&
    (hash !== pin.language.sha256 || data.length !== pin.language.bytes)
  )
    throw Error("Wrong English OCR data");
}
console.log(
  `Verified ${inventory.files.length} bundled OCR assets, including language SHA256 and CPU variants.`,
);
