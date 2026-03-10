/**
 * NullClaw DeFi Routes
 * Real WDK protocol endpoints -- Swap (Velora), Lending (Aave), Bridge (USDT0)
 */

import { Router } from 'express';
import * as wdkManager from '../wdk-manager.js';

const router = Router();
const defi = () => wdkManager.getEvmDefi();

/**
 * POST /api/defi/swap
 * Swap tokens via Velora DEX
 * Body: { fromToken, toToken, amount }
 */
router.post('/swap', async (req, res) => {
  try {
    const { fromToken, toToken, amount } = req.body;
    if (!fromToken || !toToken || !amount) {
      return res.status(400).json({ success: false, error: 'Required: fromToken, toToken, amount' });
    }
    const result = await defi().swap({ fromToken, toToken, amount });
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/defi/quote
 * Get swap quote without executing
 * Query: ?fromToken=USDT&toToken=WETH&amount=100
 */
router.get('/quote', async (req, res) => {
  try {
    const { fromToken, toToken, amount } = req.query;
    if (!fromToken || !toToken || !amount) {
      return res.status(400).json({ success: false, error: 'Required query: fromToken, toToken, amount' });
    }
    const quote = await defi().getSwapQuote({ fromToken, toToken, amount });
    res.json({ success: true, data: quote });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/defi/lend
 * Aave lending operations
 * Body: { action: 'supply'|'withdraw'|'borrow'|'repay', token, amount }
 */
router.post('/lend', async (req, res) => {
  try {
    const { action, token, amount } = req.body;
    if (!action || !token || !amount) {
      return res.status(400).json({ success: false, error: 'Required: action, token, amount' });
    }
    const validActions = ['supply', 'withdraw', 'borrow', 'repay'];
    if (!validActions.includes(action)) {
      return res.status(400).json({ success: false, error: `action must be: ${validActions.join(', ')}` });
    }
    const result = await defi().lend({ action, token, amount });
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/defi/positions
 * Get Aave lending positions and health factor
 */
router.get('/positions', async (req, res) => {
  try {
    const positions = await defi().getLendingPositions();
    res.json({ success: true, data: positions });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/defi/bridge
 * Bridge USDT0 to another EVM chain
 * Body: { toChainId, amount }
 */
router.post('/bridge', async (req, res) => {
  try {
    const { toChainId, amount } = req.body;
    if (!toChainId || !amount) {
      return res.status(400).json({ success: false, error: 'Required: toChainId, amount' });
    }
    const result = await defi().bridge({ toChainId, amount });
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/defi/protocols
 * Get status of all DeFi protocol integrations
 */
router.get('/protocols', async (req, res) => {
  try {
    const evmWallet = wdkManager.getChainWallet('evm');
    const status = evmWallet.getProtocolStatus();
    res.json({ success: true, data: status });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
