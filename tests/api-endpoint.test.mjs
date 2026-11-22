import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveApiEndpoint } from '../utils/apiEndpoint.mjs';

test('fresh hosted preview uses the existing public backend', () => {
  assert.equal(resolveApiEndpoint(undefined, 'godlykidstesting.netlify.app'), 'https://backendgk2-0.onrender.com/api/');
});
test('hosted preview cannot accidentally call the phone loopback address', () => {
  for (const host of ['localhost', '127.0.0.1', '[::1]'])
    assert.equal(resolveApiEndpoint(`http://${host}:5001`, 'godlykidstesting.netlify.app'), 'https://backendgk2-0.onrender.com/api/');
});
test('local development and a configured remote backend still work', () => {
  assert.equal(resolveApiEndpoint('http://127.0.0.1:5001', 'localhost'), 'http://127.0.0.1:5001');
  assert.equal(resolveApiEndpoint('https://staging.example/api', 'preview.example'), 'https://staging.example/api');
});
