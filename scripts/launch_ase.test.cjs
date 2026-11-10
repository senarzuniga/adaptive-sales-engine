const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { isAse, freePort, launchCandidates } = require('./launch_ase.cjs');
const root = require('node:path').resolve(__dirname, '..');

test('uses only the canonical IPv4 origin and keeps launcher navigation generic', () => {
  const candidates = launchCandidates({ root, url: 'http://localhost:8083/offer-pricing?offer=OFF-2026-S138' });
  assert.equal(candidates[0], 'http://127.0.0.1:8083/');
  assert.equal(candidates.length, 11);
  assert.ok(candidates.every(url => /^http:\/\/127\.0\.0\.1:80(?:8[0-9]|90)\/$/.test(url)));
  assert.equal(launchCandidates({ root, url: 'http://127.0.0.1:8082/' })[0], 'http://127.0.0.1:8082/');
});

test('ignores saved URLs from another root, remote hosts, protocols or unsupported ports', () => {
  for (const state of [
    { root: 'another-root', url: 'http://localhost:8083/' },
    ...['http://example.com:8083/', 'https://localhost:8083/', 'http://localhost:9000/', 'broken'].map(url => ({ root, url })),
  ]) assert.equal(launchCandidates(state)[0], 'http://127.0.0.1:8080/');
});

async function fixture(t, responder) {
  const server = http.createServer(responder);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }));
  return { url: `http://127.0.0.1:${server.address().port}/`, port: server.address().port };
}

test('rejects HTTP 200 directory listings', async (t) => {
  const { url } = await fixture(t, (_, res) => res.end('<title>Directory listing for /</title>'));
  assert.equal(await isAse(url, 'test-root'), false);
});

test('accepts only matching repository identity and a transformed React entry', async (t) => {
  const { url } = await fixture(t, (req, res) => {
    if (req.url === '/ase-instance.json') res.end(JSON.stringify({ application: 'adaptive-sales-engine', root: 'test-root' }));
    else if (req.url === '/src/main.tsx') res.end('import App from "/src/App.tsx";');
    else res.end('<script src="/@vite/client"></script><div id="root"></div>');
  });
  assert.equal(await isAse(url, 'test-root'), true);
  assert.equal(await isAse(url, 'another-repo'), false);
});

test('rejects an erroring React entry even if the HTML shell responds', async (t) => {
  const { url } = await fixture(t, (req, res) => {
    if (req.url === '/src/main.tsx') { res.writeHead(500); res.end('Compile error'); }
    else if (req.url === '/ase-instance.json') res.end(JSON.stringify({ application: 'adaptive-sales-engine', root: 'test-root' }));
    else res.end('<script src="/@vite/client"></script><div id="root"></div>');
  });
  assert.equal(await isAse(url, 'test-root'), false);
});

test('does not select an occupied port for strict Vite startup', async (t) => {
  const { port } = await fixture(t, (_, res) => res.end('Other service'));
  assert.equal(await freePort(port), false);
});