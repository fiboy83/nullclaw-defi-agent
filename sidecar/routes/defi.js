/**
 * DeFi Routes - Swap, lend, yield rates, positions
 */
import { Router } from 'express';
import * as wdk from '../wdk-mock.js';

const router = Router();

const MOCK_RATES = {
  aave: {
    USDT: { apy: '4.2%', tvl: '$2.1B', utilization: '78%' },
    ETH: { apy: '3.1%', tvl: '$5.4B', utilization: '62%' },
  },
  velora: {
    'USDT-ETH': { apy: '12.5%', tvl: '$450M', type: 'LP' },
    'USDT-XAUT': { apy: '8.3%', tvl: '$120M', type: 'LP' },
  },
};

const MOCK_POSITIONS = [
  {
    id: 'pos_001',
    protocol: 'aave',
    token: 'USDT',
    amount: '500.00',
    apy: '4.2%',
    earned: '1.75',
    since: '2026-03-01T00:00:00Z',
  },
  {
    id: 'pos_002',
    protocol: 'velora',
    pair: 'USDT-ETH',
    amount: '200.00',
    apy: '12.5%',
    earned: '2.08',
    since: '2026-03-05T00:00:00Z',
  },
];

router.get('/rates', (_req, res) => {
  res.json({
    success: true,
    data: MOCK_RATES,
    timestamp: new Date().toISOString(),
  });
});

router.get('/positions', (_req, res) => {
  res.json({
    success: true,
    data: MOCK_POSITIONS,
    timestamp: new Date().toISOString(),
  });
});

router.post('/swap', async (req, res) => {
  try {
    const { from, to, amount } = req.body;
    if (!from || !to || !amount) {
      return res.status(400).json({ success: false, error: 'Missing required fields: from, to, amount' });
    }

    const receipt = await wdk.swap(null, { from, to, amount });

    req.app.locals.broadcast({
      type: 'agent_action',
      action: 'swap',
      summary: `Swapped ${amount} ${from} -> ${receipt.to.amount} ${to}`,
      data: receipt,
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true, data: receipt });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/lend', async (req, res) => {
  try {
    const { token, amount, protocol } = req.body;
    if (!token || !amount || !protocol) {
      return res.status(400).json({ success: false, error: 'Missing required fields: token, amount, protocol' });
    }

    const receipt = await wdk.lend(null, { token, amount, protocol });

    req.app.locals.broadcast({
      type: 'agent_action',
      action: 'lend',
      summary: `Lent ${amount} ${token} on ${protocol} (${receipt.apy} APY)`,
      data: receipt,
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true, data: receipt });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
