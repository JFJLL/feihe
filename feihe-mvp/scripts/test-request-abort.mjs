import assert from 'node:assert/strict';
import { test } from 'node:test';
import http from 'node:http';
import { once } from 'node:events';
import { NodeRequest } from 'srvx/node';
import { createAppRscHandler } from '../node_modules/vinext/dist/server/app-rsc-handler.js';
import { cloneRequestWithUrl, cloneRequestWithHeaders } from '../node_modules/vinext/dist/server/request-pipeline.js';

for (const complete of [false, true]) {
  test(`request abort: ${complete ? 'complete' : 'partial'} POST cancelled during cold setup never clones a closed body`, async () => {
    let begin, release;
    const entered = new Promise(resolve => { begin = resolve; });
    const setup = new Promise(resolve => { release = resolve; });
    let finished;
    const outcome = new Promise(resolve => { finished = resolve; });
    const handler = createAppRscHandler({ registerCacheAdapters() {}, ensureInstrumentation: async () => { begin(); await setup; }, basePath: '' });
    const server = http.createServer(async (req, res) => {
      const closed = once(res, 'close');
      const pending = handler(new NodeRequest({ req, res }));
      await closed; release();
      try { const response = await pending; finished({ status: response.status }); }
      catch (error) { finished({ error: error.message }); }
    });
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    const client = http.request({ hostname: '127.0.0.1', port: server.address().port, path: '/api/metrics', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': complete ? '2' : '10000' } });
    client.on('error', () => {}); client.write('{}'); if (complete) client.end();
    await entered; client.destroy();
    const result = await outcome;
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    assert.deepEqual(result, { status: 499 });
  });
}
test('request transport: an active POST retains its actual body and headers through URL/header cloning', async () => {
  const server = http.createServer(async (req, res) => {
    try {
      const original = new NodeRequest({ req, res });
      const moved = cloneRequestWithUrl(original, new URL('/normalized', original.url).toString());
      const request = cloneRequestWithHeaders(moved, new Headers(moved.headers));
      const body = await request.json();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ body, actor: request.headers.get('x-probe-actor'), path: new URL(request.url).pathname }));
    } catch (error) { res.writeHead(500); res.end(error.message); }
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  try {
    const response = await fetch('http://127.0.0.1:' + server.address().port + '/transport-probe', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-probe-actor': 'user-editor' }, body: JSON.stringify({ amount: 0.005, enabled: true }) });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { body: { amount: 0.005, enabled: true }, actor: 'user-editor', path: '/normalized' });
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
