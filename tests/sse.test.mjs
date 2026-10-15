import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const source = ts.transpileModule(await readFile('src/api/inference/sse.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { ChatStreamDecoder } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const encode = text => new TextEncoder().encode(text);
test('handles every byte boundary including Unicode and CRLF', () => {
  const bytes = encode('data: {"choices":[{"delta":{"content":"café 📝"}}]}\r\n\r\ndata: [DONE]\r\n\r\n');
  for (let split = 0; split <= bytes.length; split++) {
    const chunks = [], parser = new ChatStreamDecoder(text => chunks.push(text));
    parser.push(bytes.slice(0, split)); parser.push(bytes.slice(split)); parser.end();
    assert.equal(chunks.join(''), 'café 📝'); assert.equal(parser.done, true);
  }
});
test('excludes reasoning and rejects truncated completion', () => {
  const chunks = [], parser = new ChatStreamDecoder(text => chunks.push(text));
  parser.push(encode('data: {"choices":[{"delta":{"reasoning_content":"private reasoning"}}]}\n\n'));
  assert.deepEqual(chunks, []);
  assert.throws(() => parser.end(), /before completion/);
});
test('surfaces runtime errors and rejects malformed data', () => {
  const parser = new ChatStreamDecoder(() => {});
  assert.throws(() => parser.push(encode('data: {"error":{"message":"insufficient memory"}}\n\n')), /insufficient memory/);
  assert.throws(() => new ChatStreamDecoder(() => {}).push(encode('data: broken\n\n')), SyntaxError);
});
