/**
 * NullClaw WDK Manager -- Unified Multi-Chain Wallet Orchestrator
 * Single entry point for EVM + Solana wallet operations
 * One seed phrase -> multiple chain wallets
 */

import WDK from '@tetherto/wdk';
import * as evmWallet from './wdk-evm.js';
import * as solanaWallet from './wdk-solana.js';

const chains = {
  evm: evmWallet,
  solana: solanaWallet,
};

let initialized = false;
let seedPhrase = null;

/**
 * Initialize all chain wallets from a single seed phrase
 * This is the core WDK integration -- one seed, multiple chains
 */
export async function initAll(phrase) {
  if (!phrase) {
    throw new Error('SEED_PHRASE is required. Set it in your .env file.');
  }

  seedPhrase = phrase;
  const results = {};
  const errors = {};

  console.log('[WDK-MGR] Initializing multi-chain wallets...');

  // Initialize EVM wallet
  try {
    results.evm = await evmWallet.initWallet(seedPhrase);
    console.log(`[WDK-MGR] EVM ready: ${results.evm.address}`);
  } catch (err) {
    errors.evm = err.message;
    console.error(`[WDK-MGR] EVM init failed: ${err.message}`);
  }

  // Initialize Solana wallet
  try {
    results.solana = await solanaWallet.initWallet(seedPhrase);
    console.log(`[WDK-MGR] Solana ready: ${results.solana.address}`);
  } catch (err) {
    errors.solana = err.message;
    console.error(`[WDK-MGR] Solana init failed: ${err.message}`);
  }

  initialized = Object.keys(results).length > 0;

  if (!initialized) {
    throw new Error('No chain wallets could be initialized: ' + JSON.stringify(errors));
  }

  console.log(`[WDK-MGR] Multi-chain wallet ready (${Object.keys(results).length} chains)`);

  return {
    initialized: true,
    chains: results,
    errors: Object.keys(errors).length > 0 ? errors : undefined,
  };
}

/**
 * Get wallet module for a specific chain
 */
export function getChainWallet(chain) {
  const wallet = chains[chain.toLowerCase()];
  if (!wallet) {
    throw new Error(`Unsupported chain: ${chain}. Supported: ${Object.keys(chains).join(', ')}`);
  }
  return wallet;
}

/**
 * Get balances across ALL chains
 */
export async function getAllBalances() {
  if (!initialized) throw new Error('WDK not initialized. Call initAll() first.');

  const allBalances = {};

  for (const [chainName, wallet] of Object.entries(chains)) {
    try {
      allBalances[chainName] = await wallet.getBalances();
    } catch (err) {
      allBalances[chainName] = { error: err.message };
    }
  }

  return allBalances;
}

/**
 * Get addresses for all chains
 */
export async function getAllAddresses() {
  if (!initialized) throw new Error('WDK not initialized. Call initAll() first.');

  const addresses = {};

  for (const [chainName, wallet] of Object.entries(chains)) {
    try {
      addresses[chainName] = await wallet.getAddress();
    } catch (err) {
      addresses[chainName] = null;
    }
  }

  return addresses;
}

/**
 * Cross-chain portfolio summary
 * Aggregates all chain data into a single view for the agent brain
 */
export async function crossChainSummary() {
  if (!initialized) throw new Error('WDK not initialized. Call initAll() first.');

  const balances = await getAllBalances();
  const addresses = await getAllAddresses();

  // Build portfolio summary
  const portfolio = {
    timestamp: new Date().toISOString(),
    chains: {},
    totalTokens: {},
  };

  for (const [chainName, balanceData] of Object.entries(balances)) {
    if (balanceData.error) {
      portfolio.chains[chainName] = { status: 'error', error: balanceData.error };
      continue;
    }

    portfolio.chains[chainName] = {
      status: 'active',
      address: addresses[chainName],
      network: balanceData.network,
      balances: balanceData.balances,
    };

    // Aggregate same tokens across chains (e.g., USDT on EVM + Solana)
    if (balanceData.balances) {
      for (const [token, amount] of Object.entries(balanceData.balances)) {
        const numAmount = parseFloat(amount) || 0;
        if (!portfolio.totalTokens[token]) {
          portfolio.totalTokens[token] = { total: 0, chains: {} };
        }
        portfolio.totalTokens[token].total += numAmount;
        portfolio.totalTokens[token].chains[chainName] = numAmount;
      }
    }
  }

  // Get protocol status per chain
  portfolio.protocols = {};
  for (const [chainName, wallet] of Object.entries(chains)) {
    try {
      portfolio.protocols[chainName] = wallet.getProtocolStatus();
    } catch (e) {
      portfolio.protocols[chainName] = { error: e.message };
    }
  }

  return portfolio;
}

/**
 * Send transaction on a specific chain
 */
export async function send(chain, params) {
  const wallet = getChainWallet(chain);
  return wallet.sendTransaction(params);
}

/**
 * Get EVM-specific DeFi operations
 */
export function getEvmDefi() {
  return {
    swap: evmWallet.swap,
    getSwapQuote: evmWallet.getSwapQuote,
    lend: evmWallet.lend,
    getLendingPositions: evmWallet.getLendingPositions,
    bridge: evmWallet.bridge,
  };
}

/**
 * Generate new seed phrase (for first-time setup)
 */
export function generateSeedPhrase(wordCount = 12) {
  return WDK.getRandomSeedPhrase(wordCount);
}

/**
 * Check if manager is initialized
 */
export function isReady() {
  return initialized;
}

/**
 * Get supported chains list
 */
export function getSupportedChains() {
  return Object.keys(chains);
}
