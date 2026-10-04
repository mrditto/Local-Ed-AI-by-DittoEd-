import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs/promises';
import ts from 'typescript';

async function harness() {
  const listeners = new Set(), requests = [], cancels = [];
  const context = vm.createContext({ setTimeout, clearTimeout, console, Error });
  const modules = new Map();
  function mock(key, values) {
    modules.set(key, new vm.SyntheticModule(Object.keys(values), function () {
      for (const [name, value] of Object.entries(values)) this.setExport(name, value);
    }, { context }));
  }
  mock('../config/anythingllm.config', {
    isConfigured: () => true,
    loadSettings: () => ({ baseUrl: 'http://localhost:11434', model: 'test-model' }),
    requestTimeoutMs: 1000,
  });
  mock('@tauri-apps/api/core', { invoke: async (command, args) => {
    if (command === 'cancel_ollama_stream') cancels.push(args.requestId);
    if (command === 'ollama_chat_stream') requests.push(args);
  }});
  mock('@tauri-apps/api/event', { listen: async (_name, callback) => {
    listeners.add(callback); return () => listeners.delete(callback);
  }});
  mock('@tauri-apps/api/path', { join: () => '', tempDir: () => '' });
  mock('@tauri-apps/plugin-opener', { openPath: () => {} });
  for (const [key, path] of [
    ['../ollama', 'src/api/ollama.ts'],
    ['./backend', 'src/api/inference/backend.ts'],
    ['entry', 'src/api/inference/index.ts'],
  ]) modules.set(key, new vm.SourceTextModule(ts.transpileModule(await fs.readFile(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText, { context }));
  const entry = modules.get('entry');
  await entry.link(key => { assert.ok(modules.has(key), key); return modules.get(key); });
  await entry.evaluate();
  return { api: entry.namespace, requests, cancels, listeners,
    emit: payload => { for (const callback of listeners) callback({ payload }); } };
}
async function until(predicate) {
  for (let i = 0; i < 100; i++) {
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 1));
  }
  assert.fail('Expected transport activity');
}
function reply(h, id, text) {
  h.emit({ requestId: id, line: JSON.stringify({ message: { content: text } }), done: true });
}
const messages = [{ role: 'user', content: 'Draft a lesson' }];

test('serializes callers, isolates streams, preserves prompt and releases listeners', async () => {
  const h = await harness(), chunks = []; let queued = 0;
  const first = h.api.sendChat(messages, { onChunk: text => chunks.push(text) });
  const second = h.api.sendChat(messages, { onQueued: () => queued++ });
  await until(() => h.requests.length === 1);
  assert.equal(queued, 1);
  const body = JSON.parse(h.requests[0].bodyJson);
  assert.match(body.messages[0].content, /avoid stereotypes/);
  assert.deepEqual(body.messages.slice(1), messages);
  reply(h, 'unrelated', 'Wrong'); reply(h, h.requests[0].requestId, 'First');
  assert.equal((await first).value, 'First'); assert.deepEqual(chunks, ['First']);
  await until(() => h.requests.length === 2);
  reply(h, h.requests[1].requestId, 'Second');
  assert.equal((await second).value, 'Second'); assert.equal(h.listeners.size, 0);
});

test('queued cancellation does not cancel the active request and permits recovery', async () => {
  const h = await harness(), controller = new AbortController();
  const first = h.api.sendChat(messages);
  const second = h.api.sendChat(messages, { signal: controller.signal });
  await until(() => h.requests.length === 1); controller.abort();
  reply(h, h.requests[0].requestId, 'First'); await first;
  assert.equal((await second).error, 'cancelled');
  assert.equal(h.requests.length, 1); assert.equal(h.cancels.length, 0);
  const third = h.api.sendChat(messages); await until(() => h.requests.length === 2);
  reply(h, h.requests[1].requestId, 'Recovered'); assert.equal((await third).value, 'Recovered');
});

test('in-flight cancellation is scoped and ignores stale responses', async () => {
  const h = await harness(), controller = new AbortController();
  const first = h.api.sendChat(messages, { signal: controller.signal });
  await until(() => h.requests.length === 1); controller.abort();
  assert.equal((await first).error, 'cancelled');
  assert.deepEqual(h.cancels, [h.requests[0].requestId]);
  const second = h.api.sendChat(messages); await until(() => h.requests.length === 2);
  reply(h, h.requests[0].requestId, 'Stale'); reply(h, h.requests[1].requestId, 'Fresh');
  assert.equal((await second).value, 'Fresh'); assert.equal(h.listeners.size, 0);
});

test('empty responses and model failures do not wedge the queue', async () => {
  const h = await harness(); const first = h.api.sendChat(messages);
  await until(() => h.requests.length === 1);
  h.emit({ requestId: h.requests[0].requestId, done: true });
  assert.equal((await first).error, 'model_error');
  const second = h.api.sendChat(messages); await until(() => h.requests.length === 2);
  h.emit({ requestId: h.requests[1].requestId, error: 'MODEL_ERROR:missing weights' });
  assert.equal((await second).error, 'model_error');
  const third = h.api.sendChat(messages); await until(() => h.requests.length === 3);
  reply(h, h.requests[2].requestId, 'Recovered'); assert.equal((await third).value, 'Recovered');
});
