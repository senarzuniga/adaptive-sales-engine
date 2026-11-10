/* Shared CMD/EXE entry point. No npm, PowerShell quoting or unrelated HTTP reuse. */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const marker = path.join(root, 'public', 'ase-instance.json');
const stateFile = path.join(os.tmpdir(), 'adaptive-sales-engine-launch.json');
const logFile = path.join(os.tmpdir(), 'adaptive-sales-engine-vite.log');
const ports = Array.from({ length: 11 }, (_, i) => 8080 + i);

function launchCandidates(state) {
  let saved;
  try {
    const url = new URL(state?.url);
    if (state.root === root && url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)
      && !url.username && !url.password && ports.includes(Number(url.port))) {
      saved = `http://127.0.0.1:${url.port}/`;
    }
  } catch { /* Missing or invalid prior launch. */ }
  return [...new Set([saved, ...ports.map((p) => `http://127.0.0.1:${p}/`)].filter(Boolean))];
}

async function isAse(url, expectedRoot = root) {
  try {
    const [page, identity, module] = await Promise.all([
      fetch(url, { signal: AbortSignal.timeout(5000) }),
      fetch(new URL('/ase-instance.json', url), { signal: AbortSignal.timeout(5000) }),
      fetch(new URL('/src/main.tsx', url), { signal: AbortSignal.timeout(5000) }),
    ]);
    if (!page.ok || !identity.ok || !module.ok) return false;
    const [html, info, source] = await Promise.all([page.text(), identity.json(), module.text()]);
    return html.includes('/@vite/client') && /id=["']root["']/.test(html)
      && !html.includes('Directory listing for')
      && info.application === 'adaptive-sales-engine' && info.root === expectedRoot
      && source.includes('/src/App.tsx');
  } catch { return false; }
}

function freePort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.listen(port, '127.0.0.1', () => server.close(() => resolve(true)));
  });
}

async function openChrome(url) {
  const chrome = [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA]
    .filter(Boolean).map((base) => path.join(base, 'Google', 'Chrome', 'Application', 'chrome.exe'))
    .find((file) => fs.existsSync(file));
  if (!chrome) throw new Error(`Chrome no encontrado. ASE disponible en ${url}`);
  await new Promise((resolve, reject) => {
    const browser = spawn(chrome, [url], { detached: true, stdio: 'ignore' });
    browser.once('error', reject);
    browser.once('spawn', () => { browser.unref(); resolve(); });
  });
}

async function launch({ noBrowser = false } = {}) {
  const vite = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');
  if (!fs.existsSync(vite)) throw new Error('Falta Vite. Instala las dependencias del proyecto.');
  // Local runtime fingerprint; excludes other apps and generic directory servers.
  const identity = JSON.stringify({ application: 'adaptive-sales-engine', root });
  if (!fs.existsSync(marker) || fs.readFileSync(marker, 'utf8') !== identity) fs.writeFileSync(marker, identity);
  let state;
  try { state = JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch { /* First launch. */ }
  let url;
  const candidates = launchCandidates(state);
  for (const candidate of candidates) {
    if (await isAse(candidate)) { url = candidate; break; }
  }
  let server;
  if (!url) {
    let port;
    for (const candidate of ports) if (await freePort(candidate)) { port = candidate; break; }
    if (!port) throw new Error('Todos los puertos 8080-8090 estan ocupados. No se cerraron procesos ajenos.');
    url = `http://127.0.0.1:${port}/`;
    const log = fs.openSync(logFile, 'a');
    try {
      server = spawn(process.execPath, [vite, '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
        cwd: root, detached: true, windowsHide: true, stdio: ['ignore', log, log],
      });
      await new Promise((resolve, reject) => { server.once('spawn', resolve); server.once('error', reject); });
      server.unref();
    } finally { fs.closeSync(log); }
    const deadline = Date.now() + 45000;
    while (!(await isAse(url))) {
      if (Date.now() >= deadline || server.exitCode !== null) throw new Error(`Vite no arranco correctamente. Consulta ${logFile}`);
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }
  const result = { root, url, verified: true, serverPid: server?.pid || state?.serverPid || null, logFile };
  fs.writeFileSync(stateFile, JSON.stringify(result, null, 2));
  if (!noBrowser) await openChrome(url);
  console.log(JSON.stringify({ ...result, browserLaunched: !noBrowser }));
  return result;
}

module.exports = { isAse, freePort, launch, launchCandidates };
if (require.main === module) launch({ noBrowser: process.argv.includes('--no-browser') }).catch((error) => {
  console.error(`ASE ERROR: ${error.message}`);
  process.exitCode = 1;
});