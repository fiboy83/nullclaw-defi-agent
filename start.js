#!/usr/bin/env node
/**
 * NullClaw DeFi Agent - Production Orchestrator
 * Boots: WDK Sidecar -> NullClaw Agent -> UI Server
 */
import { spawn } from 'child_process';
import { existsSync, chmodSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dirname || '.');

const PROCS = [
  {
    name: 'Sidecar',
    cmd: 'node',
    args: ['server.js'],
    cwd: resolve(ROOT, 'sidecar'),
    delay: 0,
  },
  {
    name: 'NullClaw',
    cmd: resolve(ROOT, 'nullclaw'),
    args: ['--config', resolve(ROOT, 'agent/config.json')],
    cwd: ROOT,
    delay: 2000,
    optional: true,
  },
  {
    name: 'UI',
    cmd: 'npx',
    args: ['vite', 'preview', '--host', '0.0.0.0', '--port', '5173'],
    cwd: resolve(ROOT, 'ui'),
    delay: 3000,
  },
];

const children = [];

async function boot() {
  console.log('\n=== NullClaw DeFi Agent ===\n');

  const binPath = resolve(ROOT, 'nullclaw');
  if (existsSync(binPath)) {
    try { chmodSync(binPath, 0o755); } catch {}
  }

  for (const proc of PROCS) {
    if (proc.delay) await sleep(proc.delay);

    if (proc.optional && !existsSync(proc.cmd)) {
      console.log(`[${proc.name}] Binary not found at ${proc.cmd}, skipping...`);
      continue;
    }

    console.log(`[${proc.name}] Starting...`);
    const child = spawn(proc.cmd, proc.args, {
      cwd: proc.cwd,
      stdio: 'inherit',
      env: { ...process.env, FORCE_COLOR: '1' },
    });

    child.on('error', (err) => {
      console.error(`[${proc.name}] Error: ${err.message}`);
    });

    child.on('exit', (code) => {
      console.log(`[${proc.name}] Exited with code ${code}`);
    });

    children.push(child);
  }

  console.log('\nAll services booted. Press Ctrl+C to stop.\n');
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

process.on('SIGINT', () => {
  console.log('\nShutting down...');
  children.forEach((c) => c.kill('SIGTERM'));
  process.exit(0);
});

process.on('SIGTERM', () => {
  children.forEach((c) => c.kill('SIGTERM'));
  process.exit(0);
});

boot();
