const { spawn } = require('node:child_process');
const treeKill = require('tree-kill');

/**
 * Windows-friendly dev runner.
 * `concurrently` is great for logs, but on Windows Ctrl+C can leave descendant
 * processes running (e.g. tsx watch → node server) and keep ports bound.
 *
 * This script ensures we always terminate the full process trees.
 */

function spawnNpm(prefix) {
  const cmd = 'npm';
  const args = ['run', 'dev', '--prefix', prefix];

  // On Windows, spawning command shims (npm.cmd) can error with EINVAL depending
  // on environment. `shell: true` consistently resolves this for dev tooling.
  return spawn(cmd, args, {
    stdio: 'inherit',
    env: process.env,
    shell: true,
  });
}

function killTree(pid, signal) {
  return new Promise(resolve => {
    if (!pid) return resolve();
    treeKill(pid, signal, () => resolve());
  });
}

async function shutdown(signal) {
  // Best effort: ask politely first, then force.
  await Promise.all([
    killTree(api.pid, signal),
    killTree(web.pid, signal),
  ]);

  // If anything is still hanging, force-kill.
  setTimeout(() => {
    void killTree(api.pid, 'SIGKILL');
    void killTree(web.pid, 'SIGKILL');
  }, 2000).unref();
}

const api = spawnNpm('mmd-api');
const web = spawnNpm('mmd-frontend');

let shuttingDown = false;
async function handle(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  await shutdown(signal);
}

process.on('SIGINT', () => void handle('SIGINT'));
process.on('SIGTERM', () => void handle('SIGTERM'));

api.on('exit', code => {
  if (!shuttingDown) void handle('SIGTERM');
  process.exitCode = code ?? 0;
});

web.on('exit', code => {
  if (!shuttingDown) void handle('SIGTERM');
  process.exitCode = code ?? 0;
});

