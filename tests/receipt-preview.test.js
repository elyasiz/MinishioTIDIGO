import test from 'node:test';
import assert from 'node:assert/strict';
import { loadReceipt, receiptUrl } from '../src/receipt-preview.js';
import { requiresManagerLogin } from '../src/api.js';
import handler from '../api/ledger.js';
import { signSession } from '../server/auth.js';

test('image and PDF receipts use the uploaded bytes and original MIME type', async () => {
  for (const [type, kind, body] of [
    ['image/png', 'image', new Uint8Array([137,80,78,71,13,10,26,10])],
    ['image/jpeg', 'image', new Uint8Array([255,216,255,224])],
    ['application/pdf', 'pdf', new TextEncoder().encode('%PDF-1.4\n')],
  ]) {
    const result = await loadReceipt('id', { fetcher: async () => new Response(body, { headers: { 'content-type': type } }) });
    assert.equal(result.kind, kind);
    assert.equal(result.blob.type, type);
    assert.deepEqual(new Uint8Array(await result.blob.arrayBuffer()), body);
    assert.equal(result.text, null);
  }
});

test('TXT and CSV preserve Unicode, line breaks and literal markup as text', async () => {
  const body = 'Bukti édisi merah\n<script>alert("uji")</script>\ntanggal;nominal\n2026-10-23;115000';
  for (const type of ['text/plain; charset=utf-8', 'text/csv; charset=utf-8']) {
    const result = await loadReceipt('id', { fetcher: async () => new Response(body, { headers: { 'content-type': type, 'content-disposition': 'attachment; filename="bukti-uji.txt"' } }) });
    assert.equal(result.kind, 'text');
    assert.equal(result.text, body);
    assert.equal(result.filename, 'bukti-uji.txt');
  }
});

test('preview uses private same-origin requests, no cache and an encoded transaction id', async () => {
  const controller = new AbortController();
  let request;
  await loadReceipt('id&action=source', { signal: controller.signal, fetcher: async (url, options) => {
    request = { url, ...options };
    return new Response('bukti', { headers: { 'content-type': 'text/plain' } });
  } });
  assert.equal(request.url, '/api/ledger?action=receipt&id=id%26action%3Dsource');
  assert.equal(receiptUrl('test id'), '/api/ledger?action=receipt&id=test%20id');
  assert.equal(request.credentials, 'same-origin');
  assert.equal(request.cache, 'no-store');
  assert.equal(request.signal, controller.signal);
});

test('expired sessions request manager login; missing files remain ordinary loading errors', async () => {
  for (const [status, code] of [[401,'SESSION_EXPIRED'], [403,'ADMIN_REQUIRED'], [404,undefined]]) {
    await assert.rejects(loadReceipt('id', { fetcher: async () => Response.json({ error: 'Bukti tidak tersedia', code }, { status }) }), error => {
      assert.equal(error.status, status);
      assert.equal(error.message, 'Bukti tidak tersedia');
      assert.equal(requiresManagerLogin(error), status !== 404);
      return true;
    });
  }
});

test('preview refuses active HTML, unknown types, empty files and oversized attachments', async () => {
  for (const [type, body] of [['text/html','<script>test</script>'], ['application/octet-stream','test'], ['image/png',''], ['text/plain','x'.repeat(2_000_001)]]) {
    await assert.rejects(loadReceipt('id', { fetcher: async () => new Response(body, { headers: { 'content-type': type } }) }));
  }
});

test('receipt endpoint denies unauthenticated and reader access before accessing private storage', async () => {
  process.env.ADMIN_PASSWORD='admin-test-password-123456';
  process.env.VIEWER_PASSWORD='viewer-test-password-12345';
  process.env.SESSION_SECRET='receipt-test-secret-12345678901234567890';
  process.env.BLOB_READ_WRITE_TOKEN='unused-test-token';
  for (const role of [null, 'viewer']) {
    const req = { method:'GET', url:'/api/ledger?action=receipt&id=private-test', query:{action:'receipt',id:'private-test'}, headers:role?{cookie:'tidigo_session='+signSession(role)}:{} };
    const res = { headers:{}, setHeader(name,value){this.headers[name]=value;}, status(value){this.statusCode=value;return this;}, json(value){this.body=value;return this;} };
    await handler(req,res);
    assert.equal(res.statusCode, role ? 403 : 401);
    assert.equal(res.body.code, role ? 'ADMIN_REQUIRED' : 'SESSION_EXPIRED');
    assert.equal(res.headers['Cache-Control'], 'private, no-store');
  }
});
