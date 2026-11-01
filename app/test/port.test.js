import assert from 'node:assert/strict';
import { test } from 'node:test';
import { startTestServer } from './helpers.js';

// Render (and similar hosts) tell the app its port in PORT; APP_PORT stays the project's own variable.
test('the server listens on PORT when APP_PORT is not set', async () => {
  const server = await startTestServer({ port: 3104, db: 'radiozk_test_port', env: { APP_PORT: undefined, PORT: '3104' } });
  try {
    const res = await fetch(`${server.base}/api/health`);
    assert.equal(res.status, 200);
  } finally {
    server.stop();
  }
});
