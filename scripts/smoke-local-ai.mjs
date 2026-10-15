import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:net';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Developer-only CPU smoke test. Does not alter app settings or use student data.
const root = fileURLToPath(new URL('../', import.meta.url));
const executable = process.argv[2];
if (!executable) throw new Error('Pass the path to the verified llama-server.exe');
const modelId = process.argv[3] ?? 'qwen3.5-2b-q4-k-m';
const { models } = JSON.parse(await readFile(path.join(root, 'config/local-ai-artifacts.json'), 'utf8'));
const model = models.find(item => item.id === modelId);
if (!model) throw new Error('Unknown model');
const socket = createServer();
await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
const port = socket.address().port;
await new Promise(resolve => socket.close(resolve));
const key = randomBytes(32).toString('hex');
const started = Date.now();
const child = spawn(executable, [
  '-m', path.join(root, 'local-ai-data/models', model.filename),
  '--host', '127.0.0.1', '--port', String(port), '--api-key', key,
  '--no-webui', '-ngl', '0', '-c', '4096', '-np', '1', '-t', '4',
  '--reasoning', 'off',
], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
let failure, logs = '';
child.on('error', error => { failure = error; });
child.stderr.on('data', data => { logs = (logs + data.toString()).slice(-8000); });
const base = `http://127.0.0.1:${port}`;
const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
try {
  let ready = false;
  for (let i = 0; i < 120; i++) {
    if (failure) throw failure;
    if (child.exitCode !== null) throw new Error(`Runtime exited ${child.exitCode}: ${logs}`);
    try { ready = (await fetch(`${base}/health`, { headers, signal: AbortSignal.timeout(1000) })).ok; }
    catch { /* Model is loading. */ }
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  if (!ready) throw new Error(`Runtime did not become ready: ${logs}`);
  const loadMs = Date.now() - started;
  const response = await fetch(`${base}/v1/chat/completions`, {
    method: 'POST', headers, signal: AbortSignal.timeout(120000),
    body: JSON.stringify({ messages: [{ role: 'user', content: 'Give two short steps for a teacher to explain fractions using paper shapes.' }],
      max_tokens: 96, temperature: 0, stream: false }),
  });
  if (!response.ok) throw new Error(`Generation HTTP ${response.status}: ${await response.text()}`);
  const result = await response.json();
  const text = result.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || !text.trim()) throw new Error('Empty generation');
  // Abort an actual streaming request after receiving text, then verify recovery.
  const controller = new AbortController();
  const stream = await fetch(`${base}/v1/chat/completions`, {
    method: 'POST', headers, signal: controller.signal,
    body: JSON.stringify({ messages: [{ role: 'user', content: 'List twenty brief classroom activity ideas.' }],
      max_tokens: 256, temperature: 0, stream: true }),
  });
  if (!stream.ok || !stream.body) throw new Error('Streaming request failed');
  const reader = stream.body.getReader(); let buffer = '', receivedText = false;
  const timeout = setTimeout(() => controller.abort(), 120000);
  try {
    while (!receivedText) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buffer += new TextDecoder().decode(chunk.value);
      let end;
      while ((end = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, end).trim(); buffer = buffer.slice(end + 1);
        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
          const event = JSON.parse(line.slice(6));
          if (event.choices?.[0]?.delta?.content) receivedText = true;
        }
      }
    }
  } finally { clearTimeout(timeout); controller.abort(); reader.releaseLock(); }
  if (!receivedText) throw new Error('No streamed text received');
  const recovery = await fetch(`${base}/v1/chat/completions`, {
    method: 'POST', headers, signal: AbortSignal.timeout(120000),
    body: JSON.stringify({ messages: [{ role: 'user', content: 'Reply with the word ready.' }],
      max_tokens: 16, temperature: 0, stream: false }),
  });
  const recovered = await recovery.json();
  if (!recovery.ok || !recovered.choices?.[0]?.message?.content?.trim())
    throw new Error('Generation did not recover after cancellation');
  console.log(JSON.stringify({ model: modelId, runtime: 'b11146', cpuOnly: true,
    context: 4096, threads: 4, loadMs, elapsedMs: Date.now() - started,
    streamReceivedText: receivedText, recoveryAfterAbort: true,
    text, usage: result.usage, timings: result.timings }, null, 2));
} finally {
  child.kill();
  await new Promise(resolve => { if (!child.pid || child.exitCode !== null) resolve(); else child.once('exit', resolve); });
}
