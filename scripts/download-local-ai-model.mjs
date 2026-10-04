import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readFile, rename, rm, stat } from 'node:fs/promises';
import { Transform, Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Developer validation helper. Product downloads/import/resume require a separate UI.
const root = fileURLToPath(new URL('../', import.meta.url));
const { models } = JSON.parse(await readFile(path.join(root, 'config/local-ai-artifacts.json'), 'utf8'));
const model = models.find(item => item.id === process.argv[2]);
if (!model) throw new Error(`Specify a model ID: ${models.map(item => item.id).join(', ')}`);
const directory = path.join(root, 'local-ai-data/models');
const destination = path.join(directory, model.filename);
await mkdir(directory, { recursive: true });
async function hashFile(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
let verified = false;
try { verified = (await stat(destination)).size === model.bytes && await hashFile(destination) === model.sha256; }
catch (error) { if (error.code !== 'ENOENT') throw error; }
if (!verified) {
  const url = `https://huggingface.co/${model.quantizer}/resolve/${model.revision}/${model.filename}`;
  const response = await fetch(url);
  if (!response.ok || !response.body) throw new Error(`Model download failed: HTTP ${response.status}`);
  const partial = `${destination}.${randomUUID()}.partial`;
  const hash = createHash('sha256'); let bytes = 0;
  const meter = new Transform({ transform(chunk, _encoding, callback) {
    bytes += chunk.length;
    if (bytes > model.bytes) return callback(new Error('Download exceeds pinned model size'));
    hash.update(chunk); callback(null, chunk);
  }});
  console.log(`Downloading ${model.filename}: ${model.bytes} bytes`);
  try {
    await pipeline(Readable.fromWeb(response.body), meter, createWriteStream(partial, { flags: 'wx' }));
    if (bytes !== model.bytes || hash.digest('hex') !== model.sha256)
      throw new Error('Model size or SHA-256 mismatch. Existing model preserved.');
    await rename(partial, destination);
  } finally { await rm(partial, { force: true }); }
}
console.log(`Verified pinned model: ${destination}`);
