// Pure unit tests of the proxy-trust setting parser (no server, no DB). Run: npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trustProxySetting } from '../src/rateLimit.js';

test('trustProxySetting defaults to loopback and private networks (nginx on this host or the Docker network)', () => {
  assert.equal(trustProxySetting(undefined), 'loopback, uniquelocal');
  assert.equal(trustProxySetting(''), 'loopback, uniquelocal');
});

test('trustProxySetting maps "false" to false, digits to a hop count, anything else to the string', () => {
  assert.equal(trustProxySetting('false'), false);
  assert.equal(trustProxySetting('1'), 1);
  assert.equal(trustProxySetting('10.0.0.0/8'), '10.0.0.0/8');
});
