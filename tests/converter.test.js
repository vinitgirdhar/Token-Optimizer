// Run: node --test tests/converter.test.js
// Covers converter.js logic that needs no DOM (browser-only paths are tested manually).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = { TextDecoder, console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'converter.js'), 'utf8') + ';this.C = TokenOptimizerConverter;', ctx);
const C = ctx.C;
const buf = (s) => new TextEncoder().encode(s).buffer;

test('estimateTokens approximates BPE counts', () => {
  assert.strictEqual(C.estimateTokens(''), 0);
  assert.strictEqual(C.estimateTokens('The quick brown fox jumps over the lazy dog.'), 10);
  // Whitespace padding is nearly free for modern tokenizers
  assert.ok(C.estimateTokens('a          b') - C.estimateTokens('a b') <= 1);
  assert.strictEqual(C.estimateTokens('你好世界'), 4);
});

test('JSON is minified and fenced, invalid JSON falls back to text', async () => {
  assert.strictEqual(await C.convertFile(buf('{\n  "a": [1, 2]\n}'), 'json'), '```json\n{"a":[1,2]}\n```');
  assert.strictEqual(await C.convertFile(buf('{"a":1}\n{"a":1}'), 'json'), '{"a":1} [x2]');
});

test('logs: ANSI stripped, consecutive duplicates folded', async () => {
  const log = '\x1b[31mERR\x1b[0m retry\nERR retry\nERR retry\nok\n\n\nok';
  assert.strictEqual(await C.convertFile(buf(log), 'log'), 'ERR retry [x3]\nok\n\n\nok');
});

test('settingKey groups extensions under one toggle', () => {
  assert.strictEqual(C.settingKey('jpeg'), 'images');
  assert.strictEqual(C.settingKey('htm'), 'text');
  assert.strictEqual(C.settingKey('pdf'), 'pdf');
});

test('unsupported extension rejects', async () => {
  await assert.rejects(C.convertFile(buf(''), 'exe'));
});
