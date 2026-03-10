/**
 * NullClaw Sidecar Server
 * Express + WebSocket backend with WDK multi-chain wallet + LLM agent brain
 */

import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';

import * as wdkManager from './wdk-manager.js';
import * as agentBrain from './agent-brain.js';
import walletRoutes from './routes/wallet.js';
import defiRoutes from './routes/defi.js';
import marketRoutes from './routes/market.js';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.SIDECAR_PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// --- WebSocket broadcast helper ---
function broadcast(event, data) {
  const message = JSON.stringify({ event, data, timestamp: new Date().toISOString() });
  wss.clients.forEach((client) => {
    if (client.readyState === 1) client.send(message);
  });
}

// --- API Routes ---
app.use('/api/wallet', walletRoutes);
app.use('/api/defi', defiRoutes);
app.use('/api/market', marketRoutes);

// --- Agent Brain Routes ---

/**
 * POST /api/agent/analyze
 * Manually trigger agent analysis
 */
app.post('/api/agent/analyze', async (req, res) => {
  try {
    const result = await agentBrain.analyze(broadcast);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/agent/pending
 * Get all pending decisions awaiting confirmation
 */
app.get('/api/agent/pending', (req, res) => {
  const pending = agentBrain.getPending();
  res.json({ success: true, data: pending });
});

/**
 * POST /api/agent/confirm/:id
 * Confirm and execute a pending decision
 */
app.post('/api/agent/confirm/:id', async (req, res) => {
  try {
    const result = await agentBrain.confirmDecision(req.params.id);
    if (result.success) {
      broadcast('agent:executed', result.decision);
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/agent/reject/:id
 * Reject a pending decision
 */
app.post('/api/agent/reject/:id', (req, res) => {
  const result = agentBrain.rejectDecision(req.params.id);
  if (result.success) {
    broadcast('agent:rejected', result.decision);
  }
  res.json(result);
});

/**
 * GET /api/agent/history
 * Get decision history
 */
app.get('/api/agent/history', (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  const history = agentBrain.getHistory(limit);
  res.json({ success: true, data: history });
});

/**
 * GET /api/agent/config
 * Get agent configuration
 */
app.get('/api/agent/config', (req, res) => {
  res.json({ success: true, data: agentBrain.getConfig() });
});

// --- Health check ---
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    agent: 'NullClaw',
    version: '0.2.0',
    wdkReady: wdkManager.isReady(),
    chains: wdkManager.getSupportedChains(),
    uptime: process.uptime(),
  });
});

// --- WebSocket connection handler ---
wss.on('connection', (ws) => {
  console.log('[WS] Client connected');

  // Send current status on connect
  ws.send(
    JSON.stringify({
      event: 'connected',
      data: {
        agent: 'NullClaw',
        wdkReady: wdkManager.isReady(),
        chains: wdkManager.getSupportedChains(),
      },
    })
  );

  ws.on('message', async (raw) => {
    try {
      const msg = JSON.parse(raw);

      switch (msg.action) {
        case 'analyze':
          const result = await agentBrain.analyze(broadcast);
          ws.send(JSON.stringify({ event: 'agent:analysis', data: result }));
          break;

        case 'confirm':
          const confirmed = await agentBrain.confirmDecision(msg.decisionId);
          broadcast('agent:executed', confirmed);
          break;

        case 'reject':
          const rejected = agentBrain.rejectDecision(msg.decisionId);
          broadcast('agent:rejected', rejected);
          break;

        case 'portfolio':
          const portfolio = await wdkManager.crossChainSummary();
          ws.send(JSON.stringify({ event: 'portfolio', data: portfolio }));
          break;

        default:
          ws.send(JSON.stringify({ event: 'error', data: { message: `Unknown action: ${msg.action}` } }));
      }
    } catch (err) {
      ws.send(JSON.stringify({ event: 'error', data: { message: err.message } }));
    }
  });

  ws.on('close', () => console.log('[WS] Client disconnected'));
});

// --- Agent Brain heartbeat loops ---
let analysisInterval = null;

function startAgentLoop() {
  const config = agentBrain.getConfig();

  // Analysis loop (every 60s)
  analysisInterval = setInterval(async () => {
    try {
      await agentBrain.analyze(broadcast);
    } catch (err) {
      console.error('[LOOP] Analysis error:', err.message);
    }
  }, config.analysisInterval);

  console.log(`[LOOP] Agent brain heartbeat started (every ${config.analysisInterval / 1000}s)`);
}

// --- Boot sequence ---
async function boot() {
  console.log('\n========================================');
  console.log('  NullClaw DeFi Agent v0.2.0');
  console.log('  Powered by Tether WDK + LLM Brain');
  console.log('========================================\n');

  // Initialize WDK wallets
  const mnemonic = process.env.WDK_MNEMONIC;
  if (mnemonic) {
    try {
      const result = await wdkManager.initAll(mnemonic);
      console.log('[BOOT] WDK initialized:', JSON.stringify(result.chains, null, 2));
      broadcast('wdk:ready', result);
    } catch (err) {
      console.error('[BOOT] WDK init failed:', err.message);
      console.log('[BOOT] Running in limited mode (no wallet operations)');
    }
  } else {
    console.warn('[BOOT] No WDK_MNEMONIC set. WDK wallet disabled.');
    console.log('[BOOT] Set WDK_MNEMONIC in .env to enable wallet features.');
  }

  // Start HTTP + WebSocket server
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n[SERVER] Sidecar running on http://0.0.0.0:${PORT}`);
    console.log(`[SERVER] WebSocket on ws://0.0.0.0:${PORT}`);
    console.log(`[SERVER] API docs: GET /api/health\n`);
  });

  // Start agent brain loop if API key is set
  if (process.env.AI_API_KEY) {
    startAgentLoop();
  } else {
    console.log('[BOOT] No AI_API_KEY set. Agent brain disabled.');
    console.log('[BOOT] Set AI_API_KEY in .env to enable autonomous decisions.\n');
  }
}

boot().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[SHUTDOWN] Stopping NullClaw...');
  if (analysisInterval) clearInterval(analysisInterval);
  wss.close();
  server.close();
  process.exit(0);
});
