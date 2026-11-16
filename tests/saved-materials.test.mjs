import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs/promises';
import ts from 'typescript';

async function library(initial = [], failWrites = false) {
  const records = new Map(initial.map(record => [record.id, { ...record }]));
  const context = vm.createContext({ setTimeout, clearTimeout, Date, Math });
  const db = {
    getAll: async () => [...records.values()].map(record => ({ ...record })),
    put: async (_store, record) => {
      if (failWrites) throw new Error('Storage unavailable');
      records.set(record.id, { ...record });
    },
    delete: async (_store, id) => records.delete(id),
  };
  const idb = new vm.SyntheticModule(['openDB'], function () {
    this.setExport('openDB', async () => db);
  }, { context });
  const iepNames = ['buildInitialDraft', 'deriveIepSessionTitle', 'iepAnswerCount', 'readLegacyIepDraftFromStorage'];
  const iep = new vm.SyntheticModule(iepNames, function () {
    for (const name of iepNames) this.setExport(name, () => { throw new Error('Unexpected IEP call'); });
  }, { context });
  const source = await fs.readFile(new URL('../src/storage/historyStore.ts', import.meta.url), 'utf8');
  const module = new vm.SourceTextModule(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText, { context });
  await module.link(name => {
    if (name === 'idb') return idb;
    assert.equal(name, '../data/iepDraft');
    return iep;
  });
  await module.evaluate();
  return module.namespace;
}

const previous = { id: 'existing', fileName: 'Unit.txt', text: 'Heat moves.', truncated: false, addedAt: 1 };

test('same-name, same-length revised material retains its actual new content', async () => {
  const store = await library([previous]);
  await store.saveFileToLibrary({ fileName: 'Unit.txt', text: 'Light moves', truncated: false });
  const saved = await store.listSavedFiles();
  assert.equal(saved.length, 2);
  assert.ok(saved.some(record => record.text === 'Light moves'));
  assert.ok(saved.some(record => record.text === previous.text));
});

test('identical material reuses the existing record and refreshes recency', async () => {
  const store = await library([previous]);
  await store.saveFileToLibrary({ fileName: previous.fileName, text: previous.text, truncated: false });
  const saved = await store.listSavedFiles();
  assert.equal(saved.length, 1);
  assert.equal(saved[0].id, previous.id);
  assert.ok(saved[0].addedAt > previous.addedAt);
});

test('complete and truncated excerpts are not confused when text matches', async () => {
  const store = await library([{ ...previous, truncated: true }]);
  await store.saveFileToLibrary({ fileName: previous.fileName, text: previous.text, truncated: false });
  const saved = await store.listSavedFiles();
  assert.equal(saved.length, 2);
  assert.ok(saved.some(record => !record.truncated));
});

test('failed storage writes reject instead of reporting a successful save', async () => {
  const store = await library([], true);
  await assert.rejects(store.saveFileToLibrary({ fileName: 'Unit.txt', text: 'Reference', truncated: false }), /Storage unavailable/);
});

test('removing one saved version preserves other resources', async () => {
  const store = await library([previous, { ...previous, id: 'another', text: 'Other text.' }]);
  await store.deleteSavedFile(previous.id);
  const saved = await store.listSavedFiles();
  assert.equal(saved.length, 1);
  assert.equal(saved[0].id, 'another');
});
