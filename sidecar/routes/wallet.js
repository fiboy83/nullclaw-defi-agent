/**
 * Wallet Routes - Token balances, transfers, address
 */
import { Router } from 'express';
import * as wdk from '../wdk-mock.js';

const router = Router();

let wallet = null;

async function ensureWallet() {
  if (!wallet) wallet = await wdk.initWallet();
  return wallet;
}

router.get('/balances', async (_req, res) => {
  try {
    const w = await ensureWallet();
    const balances = await wdk.getBalances(w);
    res.json({ success: true, data: balances, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/address', async (_req, res) => {
  try {
    const w = await ensureWallet();
    res.json({ success: true, data: { address: w.address, network: w.network }, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/send', async (req, res) => {
  try {
    const { to, amount, token } = req.body;
    if (!to || !amount || !token) {
      return res.status(400).json({ success: false, error: 'Missing required fields: to, amount, token' });
    }
    const w = await ensureWallet();
    const receipt = await wdk.sendTransaction(w, { to, amount, token });

    req.app.locals.broadcast({
      type: 'agent_action',
      action: 'send',
      summary: `Sent ${amount} ${token} to ${to.slice(0, 10)}...`,
      data: receipt,
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true, data: receipt });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
