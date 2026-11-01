import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

// Test files run in parallel and each starts real servers on fixed ports; two files on one port fail at random.
test('no two backend test servers share a port', () => {
  const dir = new URL('./', import.meta.url);
  const uses = new Map();
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.test.js'))) {
    for (const [, port] of readFileSync(new URL(file, dir), 'utf8').matchAll(/startTestServer\(\{[^}]*?port:\s*(\d+)/g)) {
      uses.set(port, [...(uses.get(port) ?? []), file]);
    }
  }
  assert.ok(uses.size >= 4, 'found the known test servers (3100-3103)');
  const clashes = [...uses].filter(([, files]) => files.length > 1);
  assert.deepEqual(clashes, [], 'ports used by more than one start');
});
