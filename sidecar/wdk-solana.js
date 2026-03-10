/**
 * NullClaw WDK Solana Integration Layer
 * Real Tether WDK SDK -- Solana chain operations
 * Supports: Wallet, SOL transfers, SPL token transfers
 */

import WalletManagerSolana from '@tetherto/wdk-wallet-solana';

// Solana Devnet known token mints
const SPL_TOKENS = {
  USDT: process.env.SOL_USDT_MINT || 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  USDC: process.env.SOL_USDC_MINT || '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
};

let walletManager = null;
let primaryAccount = null;
let _solBalanceErrorLogged = false;

/**
 * Initialize with account from WDK core (called by wdk-manager.js)
 */
export function initWithAccount(account) {
  primaryAccount = account;
  console.log('[WDK-SOL] Account received from WDK core');
}

/**
 * Fallback: Initialize Solana wallet from seed phrase directly
 */
export async function initWallet(seedPhrase) {
  const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';

  try {
    // WDK docs: config key is 'rpcUrl', NOT 'provider'
    walletManager = new WalletManagerSolana(seedPhrase, {
      rpcUrl,
    });

    primaryAccount = walletManager.getAccount(0);
    const address = await primaryAccount.getAddress();

    console.log('[WDK-SOL] Wallet initialized on Devnet');
    console.log(`[WDK-SOL] Address: ${address}`);

    return {
      address,
      chain: 'solana',
      network: 'devnet',
    };
  } catch (err) {
    console.error('[WDK-SOL] Init failed:', err.message);
    throw err;
  }
}

/**
 * Get wallet address
 */
export async function getAddress() {
  if (!primaryAccount) throw new Error('Solana wallet not initialized');
  return primaryAccount.getAddress();
}

/**
 * Get all balances (native SOL + SPL tokens)
 */
export async function getBalances() {
  if (!primaryAccount) throw new Error('Solana wallet not initialized');

  const address = await primaryAccount.getAddress();
  const balances = { SOL: '0' };

  try {
    const solBalance = await primaryAccount.getBalance();
    balances.SOL = formatLamports(solBalance);
    _solBalanceErrorLogged = false; // reset on success
  } catch (e) {
    // Log only once to avoid spamming every heartbeat
    if (!_solBalanceErrorLogged) {
      console.warn('[WDK-SOL] SOL balance unavailable:', e.message);
      _solBalanceErrorLogged = true;
    }
  }

  // SPL token balances
  for (const [symbol, mint] of Object.entries(SPL_TOKENS)) {
    try {
      const balance = await primaryAccount.getTokenBalance(mint);
      const decimals = 6;
      balances[symbol] = formatBalance(balance, decimals);
    } catch (e) {
      balances[symbol] = '0';
    }
  }

  return { address, chain: 'solana', network: 'devnet', balances };
}

/**
 * Send native SOL or SPL token
 */
export async function sendTransaction({ to, amount, token = 'SOL' }) {
  if (!primaryAccount) throw new Error('Solana wallet not initialized');

  try {
    let result;

    if (token === 'SOL') {
      const lamports = parseSol(amount);
      result = await primaryAccount.sendTransaction({
        to,
        value: lamports.toString(),
      });
    } else {
      const mint = SPL_TOKENS[token];
      if (!mint) throw new Error(`Unknown SPL token: ${token}`);
      const parsedAmount = parseBalance(amount, 6);
      result = await primaryAccount.sendToken(mint, to, parsedAmount);
    }

    console.log(`[WDK-SOL] Sent ${amount} ${token} to ${to} -> tx: ${result.hash}`);
    return {
      success: true,
      txHash: result.hash,
      fee: result.fee?.toString(),
      from: await primaryAccount.getAddress(),
      to,
      amount,
      token,
      chain: 'solana',
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    console.error(`[WDK-SOL] Send failed:`, err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Get protocol status
 */
export function getProtocolStatus() {
  return {
    wallet: !!primaryAccount,
    swap: false,
    lending: false,
    bridge: false,
  };
}

// -- Helpers --

function formatLamports(lamports) {
  if (!lamports) return '0';
  const str = lamports.toString().padStart(10, '0');
  const whole = str.slice(0, -9) || '0';
  const frac = str.slice(-9).replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : whole;
}

function formatBalance(raw, decimals) {
  if (!raw) return '0';
  const str = raw.toString().padStart(decimals + 1, '0');
  const whole = str.slice(0, -decimals) || '0';
  const frac = str.slice(-decimals).replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : whole;
}

function parseSol(amount) {
  const [whole, frac = ''] = amount.toString().split('.');
  const paddedFrac = frac.padEnd(9, '0').slice(0, 9);
  return BigInt(whole + paddedFrac);
}

function parseBalance(amount, decimals) {
  const [whole, frac = ''] = amount.toString().split('.');
  const paddedFrac = frac.padEnd(decimals, '0').slice(0, decimals);
  return BigInt(whole + paddedFrac);
}

export { WalletManagerSolana, SPL_TOKENS };
