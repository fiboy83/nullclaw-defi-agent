/**
 * NullClaw Wallet Routes
 * Multi-chain wallet endpoints powered by WDK Manager
 */

import { Router } from 'express';
import * as wdkManager from '../wdk-manager.js';

const router = Router();

/**
 * GET /api/wallet/balances
 * Get balances across ALL chains
 */
router.get('/balances', async (req, res) => {
  try {
    const balances = await wdkManager.getAllBalances();
    res.json({ success: true, data: balances });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/wallet/balances/:chain
 * Get balances for a specific chain (evm or solana)
 */
router.get('/balances/:chain', async (req, res) => {
  try {
    const wallet = wdkManager.getChainWallet(req.params.chain);
    const balances = await wallet.getBalances();
    res.json({ success: true, data: balances });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/wallet/address/:chain
 * Get wallet address for a specific chain
 */
router.get('/address/:chain', async (req, res) => {
  try {
    const wallet = wdkManager.getChainWallet(req.params.chain);
    const address = await wallet.getAddress();
    res.json({ success: true, data: { chain: req.params.chain, address } });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/wallet/addresses
 * Get all wallet addresses
 */
router.get('/addresses', async (req, res) => {
  try {
    const addresses = await wdkManager.getAllAddresses();
    res.json({ success: true, data: addresses });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/wallet/send
 * Send tokens on a specific chain
 * Body: { chain, to, amount, token? }
 */
router.post('/send', async (req, res) => {
  try {
    const { chain, to, amount, token } = req.body;

    if (!chain || !to || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Required: chain, to, amount',
      });
    }

    const result = await wdkManager.send(chain, { to, amount, token });
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/wallet/portfolio
 * Combined cross-chain portfolio view
 */
router.get('/portfolio', async (req, res) => {
  try {
    const portfolio = await wdkManager.crossChainSummary();
    res.json({ success: true, data: portfolio });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/wallet/status
 * WDK initialization and protocol status
 */
router.get('/status', async (req, res) => {
  try {
    const ready = wdkManager.isReady();
    const chains = wdkManager.getSupportedChains();
    res.json({ success: true, data: { ready, chains } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
