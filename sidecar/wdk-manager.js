/**
 * NullClaw WDK Manager -- Unified Multi-Chain Wallet Orchestrator
 * Uses WDK core: new WDK(seed) -> registerWallet -> registerProtocol -> getAccount
 */

import WDK from '@tetherto/wdk';
import WalletManagerEvm from '@tetherto/wdk-wallet-evm';
import WalletManagerSolana from '@tetherto/wdk-wallet-solana';
import VeloraProtocolEvm from '@tetherto/wdk-protocol-swap-velora-evm';
import AaveProtocolEvm from '@tetherto/wdk-protocol-lending-aave-evm';
import Usdt0ProtocolEvm from '@tetherto/wdk-protocol-bridge-usdt0-evm';

import * as evmModule from './wdk-evm.js';
import * as solanaModule from './wdk-solana.js';

const chainModules = { evm: evmModule, solana: solanaModule };

let wdk = null;
let initialized = false;

export async function initAll(phrase) {
  if (!phrase) throw new Error('WDK_MNEMONIC is required.');

  const evmRpc = process.env.EVM_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';
  const solRpc = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';

  console.log('[WDK-MGR] Initializing WDK core...');
  wdk = new WDK(phrase);

  // Register wallet managers
  try {
    wdk.registerWallet('ethereum', WalletManagerEvm, { provider: evmRpc });
    console.log('[WDK-MGR] Registered EVM wallet (Sepolia)');
  } catch (err) {
    console.error('[WDK-MGR] EVM wallet registration failed:', err.message);
  }

  try {
    wdk.registerWallet('solana', WalletManagerSolana, { provider: solRpc });
    console.log('[WDK-MGR] Registered Solana wallet (Devnet)');
  } catch (err) {
    console.error('[WDK-MGR] Solana wallet registration failed:', err.message);
  }

  // Register DeFi protocols
  try {
    wdk.registerProtocol('ethereum', 'velora', VeloraProtocolEvm, { swapMaxFee: 200000000000000n });
    console.log('[WDK-MGR] Registered Velora swap protocol');
  } catch (err) { console.warn('[WDK-MGR] Velora skipped:', err.message); }

  try {
    wdk.registerProtocol('ethereum', 'aave', AaveProtocolEvm, {});
    console.log('[WDK-MGR] Registered Aave lending protocol');
  } catch (err) { console.warn('[WDK-MGR] Aave skipped:', err.message); }

  try {
    wdk.registerProtocol('ethereum', 'usdt0-bridge', Usdt0ProtocolEvm, {});
    console.log('[WDK-MGR] Registered USDT0 bridge protocol');
  } catch (err) { console.warn('[WDK-MGR] Bridge skipped:', err.message); }

  // Derive accounts via WDK core (returns proper WalletAccount objects)
  const results = {};
  const errors = {};
  console.log('[WDK-MGR] Deriving accounts...');

  try {
    const evmAccount = await wdk.getAccount('ethereum', 0);
    const evmAddress = await evmAccount.getAddress();
    console.log('[WDK-MGR] EVM account:', evmAddress);
    evmModule.initWithAccount(evmAccount);
    results.evm = { address: evmAddress, chain: 'evm', network: 'sepolia', chainId: 11155111 };
  } catch (err) {
    errors.evm = err.message;
    console.error('[WDK-MGR] EVM account failed:', err.message);
  }

  try {
    const solAccount = await wdk.getAccount('solana', 0);
    const solAddress = await solAccount.getAddress();
    console.log('[WDK-MGR] Solana account:', solAddress);
    solanaModule.initWithAccount(solAccount);
    results.solana = { address: solAddress, chain: 'solana', network: 'devnet' };
  } catch (err) {
    errors.solana = err.message;
    console.error('[WDK-MGR] Solana account failed:', err.message);
  }

  initialized = Object.keys(results).length > 0;
  if (!initialized) {
    throw new Error('No chain wallets could be initialized: ' + JSON.stringify(errors));
  }

  console.log('[WDK-MGR] Multi-chain wallet ready (' + Object.keys(results).length + ' chains)');
  return { initialized: true, chains: results, errors: Object.keys(errors).length > 0 ? errors : undefined };
}

export function getChainWallet(chain) {
  const wallet = chainModules[chain.toLowerCase()];
  if (!wallet) throw new Error('Unsupported chain: ' + chain);
  return wallet;
}

export async function getAllBalances() {
  if (!initialized) throw new Error('WDK not initialized.');
  const all = {};
  for (const [name, w] of Object.entries(chainModules)) {
    try { all[name] = await w.getBalances(); } catch (e) { all[name] = { error: e.message }; }
  }
  return all;
}

export async function getAllAddresses() {
  if (!initialized) throw new Error('WDK not initialized.');
  const addrs = {};
  for (const [name, w] of Object.entries(chainModules)) {
    try { addrs[name] = await w.getAddress(); } catch (e) { addrs[name] = null; }
  }
  return addrs;
}

export async function crossChainSummary() {
  if (!initialized) throw new Error('WDK not initialized.');
  const balances = await getAllBalances();
  const addresses = await getAllAddresses();
  const portfolio = { timestamp: new Date().toISOString(), chains: {}, totalTokens: {} };
  for (const [chainName, balanceData] of Object.entries(balances)) {
    if (balanceData.error) {
      portfolio.chains[chainName] = { status: 'error', error: balanceData.error };
      continue;
    }
    portfolio.chains[chainName] = {
      status: 'active', address: addresses[chainName],
      network: balanceData.network, balances: balanceData.balances,
    };
    if (balanceData.balances) {
      for (const [token, amount] of Object.entries(balanceData.balances)) {
        const num = parseFloat(amount) || 0;
        if (!portfolio.totalTokens[token]) portfolio.totalTokens[token] = { total: 0, chains: {} };
        portfolio.totalTokens[token].total += num;
        portfolio.totalTokens[token].chains[chainName] = num;
      }
    }
  }
  portfolio.protocols = {};
  for (const [cn, w] of Object.entries(chainModules)) {
    try { portfolio.protocols[cn] = w.getProtocolStatus(); } catch (e) { portfolio.protocols[cn] = { error: e.message }; }
  }
  return portfolio;
}

export async function send(chain, params) { return getChainWallet(chain).sendTransaction(params); }

export function getEvmDefi() {
  return {
    swap: evmModule.swap, getSwapQuote: evmModule.getSwapQuote,
    lend: evmModule.lend, getLendingPositions: evmModule.getLendingPositions,
    bridge: evmModule.bridge,
  };
}

export function generateSeedPhrase() { return WDK.getRandomSeedPhrase(); }
export function isReady() { return initialized; }
export function getSupportedChains() { return Object.keys(chainModules); }

export async function dispose() {
  if (wdk) {
    try { await wdk.dispose(); } catch (e) { console.warn('[WDK-MGR] Dispose:', e.message); }
    wdk = null;
    initialized = false;
  }
}
