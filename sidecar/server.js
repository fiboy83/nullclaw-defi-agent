/**
 * NullClaw WDK Sidecar - REST API wrapping Tether WDK
 * Provides wallet operations, DeFi interactions, and market data
 * WebSocket server for real-time UI updates
 */
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';

import walletRoutes from './routes/wallet.js';
import defiRoutes from './routes/defi.js';
import marketRoutes from './routes/market.js';

dotenv.config({ path: '../.env' });

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const server = createServer(app);
const wss = new WebSocketServer({ server });

export function broadcast(data) {
  const payload = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(payload);
    }
  });
}

wss.on('connection', (ws) => {
  console.log('UI client connected via WebSocket');

  ws.send(JSON.stringify({
    type: 'system',
    message: 'Connected to NullClaw WDK Sidecar',
    timestamp: new Date().toISOString(),
  }));

  ws.on('close', () => {
    console.log('UI client disconnected');
  });
});

app.locals.broadcast = broadcast;

app.use('/api/wallet', walletRoutes);
app.use('/api/defi', defiRoutes);
app.use('/api/market', marketRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), clients: wss.clients.size });
});

server.listen(PORT, () => {
  console.log(`\nWDK Sidecar running on :${PORT}`);
  console.log(`   REST API  -> http://localhost:${PORT}/api`);
  console.log(`   WebSocket -> ws://localhost:${PORT}`);
  console.log('');
});
