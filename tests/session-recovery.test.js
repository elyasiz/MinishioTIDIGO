import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/ledger.js';
import { signSession, verifySession } from '../server/auth.js';
import { api, ApiError, requiresManagerLogin } from '../src/api.js';

function configure() {
  process.env.ADMIN_PASSWORD = 'admin-test-password-123456';
  process.env.VIEWER_PASSWORD = 'viewer-test-password-12345';
  process.env.SESSION_SECRET = 'session-test-secret-12345678901234567890';
  process.env.BLOB_READ_WRITE_TOKEN = 'unused-test-token';
}

async function attempt(cookie) {
  const req = {
    method: 'POST', url: '/api/ledger?action=income', query: { action: 'income' },
    headers: { origin: 'https://tidigo.test', host: 'tidigo.test', 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: { date: '2026-10-23', amount: 115000, description: 'Contoh pemasukan', receipt: { type: 'text/plain', data: 'YnVrdGk=' } },
  };
  const res = { headers: {}, setHeader(name, value) { this.headers[name] = value; }, status(status) { this.statusCode = status; return this; }, json(body) { this.body = body; return this; } };
  await handler(req, res);
  return res;
}

test('missing and expired sessions return a recoverable 401 before reading or writing the ledger', async t => {
  configure();
  let response = await attempt();
  assert.equal(response.statusCode, 401);
  assert.equal(response.body.code, 'SESSION_EXPIRED');
  const realNow = Date.now;
  const startedAt = realNow();
  const token = signSession('admin');
  t.mock.method(Date, 'now', () => startedAt + 9 * 3600000);
  assert.equal(verifySession(token), null);
  response = await attempt('tidigo_session=' + token);
  assert.equal(response.statusCode, 401);
  assert.equal(response.body.code, 'SESSION_EXPIRED');
});

test('viewer sessions still cannot save income or upload evidence', async () => {
  configure();
  const response = await attempt('tidigo_session=' + signSession('viewer'));
  assert.equal(response.statusCode, 403);
  assert.equal(response.body.code, 'ADMIN_REQUIRED');
  assert.equal(response.headers['Set-Cookie'], undefined);
});

test('client keeps authentication error details and sends session requests without caching', async () => {
  let sentOptions;
  const fetcher = async (_url, options) => {
    sentOptions = options;
    return Response.json({ error: 'Masuk kembali', code: 'SESSION_EXPIRED' }, { status: 401 });
  };
  await assert.rejects(api('session', undefined, fetcher), error => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 401);
    assert.ok(requiresManagerLogin(error));
    return true;
  });
  assert.equal(sentOptions.credentials, 'same-origin');
  assert.equal(sentOptions.cache, 'no-store');
});

test('wrong passwords, invalid forms and unrelated forbidden requests do not trigger a write retry', async () => {
  assert.equal(requiresManagerLogin(new ApiError('Kata sandi salah.', 401)), false);
  assert.equal(requiresManagerLogin(new ApiError('Permintaan dari situs lain ditolak.', 403)), false);
  assert.equal(requiresManagerLogin(new ApiError('Nominal tidak valid.', 400)), false);
  let calls = 0;
  await assert.rejects(api('income', { amount: 1 }, async () => {
    calls++;
    return Response.json({ error: 'Masuk kembali', code: 'SESSION_EXPIRED' }, { status: 401 });
  }));
  assert.equal(calls, 1);
});
