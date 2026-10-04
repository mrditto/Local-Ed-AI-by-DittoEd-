import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Build-time preparation only. Never downloads models or activates a backend.
const root = fileURLToPath(new URL('../', import.meta.url));
const { runtime } = JSON.parse(await readFile(path.join(root, 'config/local-ai-artifacts.json'), 'utf8'));
const destination = path.join(root, 'local-ai-data/runtime');
const archive = path.join(destination, `${runtime.tag}-windows-x64.zip`);
const partial = `${archive}.${randomUUID()}.partial`;
const matches = bytes => bytes.length === runtime.bytes &&
  createHash('sha256').update(bytes).digest('hex') === runtime.sha256;
await mkdir(destination, { recursive: true });
let valid = false;
try { valid = matches(await readFile(archive)); } catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
if (!valid) {
  const response = await fetch(runtime.url);
  if (!response.ok) throw new Error(`Runtime download failed: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!matches(bytes)) throw new Error('Runtime archive size or SHA-256 mismatch. Nothing installed.');
  try {
    await writeFile(partial, bytes, { flag: 'wx' });
    await rename(partial, archive);
  } finally { await rm(partial, { force: true }); }
}
console.log(`Verified pinned runtime archive: ${archive}`);
