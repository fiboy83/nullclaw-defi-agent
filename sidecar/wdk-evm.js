/**
 * NullClaw WDK EVM Integration Layer
 * Real Tether WDK SDK -- Ethereum/EVM chain operations
 * Supports: Wallet, Swap (Velora), Lending (Aave), Bridge (USDT0)
 */

import WalletManagerEvm, { WalletAccountEvm } from '@tetherto/wdk-wallet-evm';
import VeloraProtocolEvm from '@tetherto/wdk-protocol-swap-velora-evm';
import AaveProtocolEvm from '@tetherto/wdk-protocol-lending-aave-evm';
import Usdt0ProtocolEvm from '@tetherto/wdk-protocol-bridge-usdt0-evm';

// Sepolia testnet token addresses
const TOKENS = {
  USDT: process.env.EVM_USDT_ADDRESS || '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06',
  WETH: process.env.EVM_WETH_ADDRESS || '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',
  USDC: process.env.EVM_USDC_ADDRESS || '0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8',
  DAI: process.env.EVM_DAI_ADDRESS || '0xFF34B3d4Aee8ddCd6F9AFFFB6Fe49bD371b8a357',
};

// Chains where Aave V3 is actually deployed
const AAVE_SUPPORTED_CHAINS = [1, 137, 42161, 10, 43114, 8453, 100, 534352];

let walletManager = null;
let primaryAccount = null;
let swapProtocol = null;
let lendingProtocol = null;
let bridgeProtocol = null;
let _currentChainId = 11155111; // default Sepolia
let _positionsErrorLogged = false;

/**
 * Initialize with account from WDK core (called by wdk-manager.js)
 */
export function initWithAccount(account) {
  primaryAccount = account;
  console.log('[WDK-EVM] Account received from WDK core');
  // Init protocols with the received account
  initProtocols();
}

/**
 * Fallback: Initialize EVM wallet from seed phrase directly
 */
export async function initWallet(seedPhrase) {
  const rpcUrl = process.env.EVM_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';

  try {
    // WDK docs: config key is 'rpcUrl', NOT 'provider'
    walletManager = new WalletManagerEvm(seedPhrase, {
      rpcUrl,
    });

    primaryAccount = walletManager.getAccount(0);
    const address = await primaryAccount.getAddress();

    console.log('[WDK-EVM] Wallet initialized on Sepolia');
    console.log(`[WDK-EVM] Address: ${address}`);

    await initProtocols();

    return {
      address,
      chain: 'evm',
      network: 'sepolia',
      chainId: _currentChainId,
    };
  } catch (err) {
    console.error('[WDK-EVM] Init failed:', err.message);
    throw err;
  }
}

/**
 * Initialize DeFi protocol modules
 */
async function initProtocols() {
  try {
    swapProtocol = new VeloraProtocolEvm(primaryAccount, {
      swapMaxFee: 200000000000000n,
    });
    console.log('[WDK-EVM] Velora swap protocol ready');
  } catch (e) {
    console.warn('[WDK-EVM] Velora swap init skipped:', e.message);
  }

  try {
    lendingProtocol = new AaveProtocolEvm(primaryAccount);
    console.log('[WDK-EVM] Aave lending protocol ready');
  } catch (e) {
    console.warn('[WDK-EVM] Aave lending init skipped:', e.message);
  }

  try {
    bridgeProtocol = new Usdt0ProtocolEvm(primaryAccount);
    console.log('[WDK-EVM] USDT0 bridge protocol ready');
  } catch (e) {
    console.warn('[WDK-EVM] Bridge init skipped:', e.message);
  }
}

/**
 * Get wallet address
 */
export async function getAddress() {
  if (!primaryAccount) throw new Error('Wallet not initialized');
  return primaryAccount.getAddress();
}

/**
 * Get all balances (native ETH + ERC20 tokens)
 */
export async function getBalances() {
  if (!primaryAccount) throw new Error('Wallet not initialized');

  const address = await primaryAccount.getAddress();
  const balances = { ETH: '0' };

  try {
    const ethBalance = await primaryAccount.getBalance();
    balances.ETH = formatBalance(ethBalance, 18);
  } catch (e) {
    console.warn('[WDK-EVM] ETH balance error:', e.message);
  }

  // ERC20 token balances
  for (const [symbol, tokenAddress] of Object.entries(TOKENS)) {
    try {
      const balance = await primaryAccount.getTokenBalance(tokenAddress);
      const decimals = symbol === 'WETH' ? 18 : symbol === 'DAI' ? 18 : 6;
      balances[symbol] = formatBalance(balance, decimals);
    } catch (e) {
      balances[symbol] = '0';
    }
  }

  return { address, chain: 'evm', network: 'sepolia', balances };
}

/**
 * Send native ETH or ERC20 token
 */
export async function sendTransaction({ to, amount, token = 'ETH' }) {
  if (!primaryAccount) throw new Error('Wallet not initialized');

  try {
    let result;

    if (token === 'ETH') {
      result = await primaryAccount.sendTransaction({
        to,
        value: parseBalance(amount, 18).toString(),
      });
    } else {
      const tokenAddress = TOKENS[token];
      if (!tokenAddress) throw new Error(`Unknown token: ${token}`);
      const decimals = token === 'WETH' ? 18 : token === 'DAI' ? 18 : 6;
      result = await primaryAccount.sendToken(tokenAddress, to, parseBalance(amount, decimals));
    }

    console.log(`[WDK-EVM] Sent ${amount} ${token} to ${to} -> tx: ${result.hash}`);
    return {
      success: true,
      txHash: result.hash,
      fee: result.fee?.toString(),
      from: await primaryAccount.getAddress(),
      to,
      amount,
      token,
      chain: 'evm',
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    console.error(`[WDK-EVM] Send failed:`, err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Swap tokens via Velora DEX
 */
export async function swap({ fromToken, toToken, amount }) {
  if (!swapProtocol) throw new Error('Swap protocol not initialized');

  const tokenIn = TOKENS[fromToken] || fromToken;
  const tokenOut = TOKENS[toToken] || toToken;
  const decimalsIn = fromToken === 'WETH' || fromToken === 'ETH' ? 18 : fromToken === 'DAI' ? 18 : 6;
  const tokenInAmount = parseBalance(amount, decimalsIn);

  try {
    const quote = await swapProtocol.quoteSwap({
      tokenIn,
      tokenOut,
      tokenInAmount,
    });

    console.log(`[WDK-EVM] Swap quote: ${amount} ${fromToken} -> ${quote.tokenOutAmount} ${toToken}`);

    const result = await swapProtocol.swap({
      tokenIn,
      tokenOut,
      tokenInAmount,
    });

    return {
      success: true,
      txHash: result.hash,
      fee: result.fee?.toString(),
      fromToken,
      toToken,
      amountIn: amount,
      amountOut: result.tokenOutAmount?.toString(),
      chain: 'evm',
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    console.error(`[WDK-EVM] Swap failed:`, err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Get swap quote without executing
 */
export async function getSwapQuote({ fromToken, toToken, amount }) {
  if (!swapProtocol) throw new Error('Swap protocol not initialized');

  const tokenIn = TOKENS[fromToken] || fromToken;
  const tokenOut = TOKENS[toToken] || toToken;
  const decimalsIn = fromToken === 'WETH' || fromToken === 'ETH' ? 18 : fromToken === 'DAI' ? 18 : 6;

  const quote = await swapProtocol.quoteSwap({
    tokenIn,
    tokenOut,
    tokenInAmount: parseBalance(amount, decimalsIn),
  });

  return {
    fromToken,
    toToken,
    amountIn: amount,
    estimatedOut: quote.tokenOutAmount?.toString(),
    estimatedFee: quote.fee?.toString(),
  };
}

/**
 * Aave lending operations
 */
export async function lend({ action, token, amount }) {
  if (!lendingProtocol) throw new Error('Lending protocol not initialized');

  // Check if current chain supports Aave
  if (!AAVE_SUPPORTED_CHAINS.includes(_currentChainId)) {
    return {
      success: false,
      error: `Aave V3 not available on chain ${_currentChainId} (Sepolia testnet). Lending operations available on mainnet chains.`,
    };
  }

  const tokenAddress = TOKENS[token] || token;
  const decimals = token === 'WETH' || token === 'ETH' ? 18 : token === 'DAI' ? 18 : 6;
  const parsedAmount = parseBalance(amount, decimals);

  try {
    let result;

    switch (action) {
      case 'supply':
        result = await lendingProtocol.supply({ asset: tokenAddress, amount: parsedAmount });
        break;
      case 'withdraw':
        result = await lendingProtocol.withdraw({ asset: tokenAddress, amount: parsedAmount });
        break;
      case 'borrow':
        result = await lendingProtocol.borrow({ asset: tokenAddress, amount: parsedAmount });
        break;
      case 'repay':
        result = await lendingProtocol.repay({ asset: tokenAddress, amount: parsedAmount });
        break;
      default:
        throw new Error(`Unknown lending action: ${action}`);
    }

    console.log(`[WDK-EVM] Aave ${action}: ${amount} ${token} -> tx: ${result.hash}`);
    return {
      success: true,
      txHash: result.hash,
      fee: result.fee?.toString(),
      action,
      token,
      amount,
      chain: 'evm',
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    console.error(`[WDK-EVM] Lending ${action} failed:`, err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Get Aave account data (positions, health factor)
 * Gracefully handles unsupported chains (like Sepolia)
 */
export async function getLendingPositions() {
  if (!lendingProtocol) {
    return { error: 'Lending protocol not initialized', unsupported: true };
  }

  // Graceful check: Aave V3 doesn't support Sepolia
  if (!AAVE_SUPPORTED_CHAINS.includes(_currentChainId)) {
    if (!_positionsErrorLogged) {
      console.log(`[WDK-EVM] Aave V3 not available on chain ${_currentChainId} (testnet) -- skipping positions query`);
      _positionsErrorLogged = true;
    }
    return {
      totalCollateralBase: '0',
      totalDebtBase: '0',
      availableBorrowsBase: '0',
      currentLiquidationThreshold: '0',
      ltv: '0',
      healthFactor: 'N/A',
      chain: 'evm',
      note: 'Aave V3 not available on Sepolia testnet',
      unsupported: true,
    };
  }

  try {
    const data = await lendingProtocol.getAccountData();
    return {
      totalCollateralBase: data.totalCollateralBase?.toString(),
      totalDebtBase: data.totalDebtBase?.toString(),
      availableBorrowsBase: data.availableBorrowsBase?.toString(),
      currentLiquidationThreshold: data.currentLiquidationThreshold?.toString(),
      ltv: data.ltv?.toString(),
      healthFactor: data.healthFactor?.toString(),
      chain: 'evm',
    };
  } catch (err) {
    if (!_positionsErrorLogged) {
      console.error('[WDK-EVM] Get positions failed:', err.message);
      _positionsErrorLogged = true;
    }
    return { error: err.message };
  }
}

/**
 * Bridge USDT0 to another EVM chain
 */
export async function bridge({ toChainId, amount }) {
  if (!bridgeProtocol) throw new Error('Bridge protocol not initialized');

  try {
    const parsedAmount = parseBalance(amount, 6);
    const result = await bridgeProtocol.bridge({
      dstChainId: toChainId,
      amount: parsedAmount,
    });

    console.log(`[WDK-EVM] Bridge ${amount} USDT0 to chain ${toChainId} -> tx: ${result.hash}`);
    return {
      success: true,
      txHash: result.hash,
      fee: result.fee?.toString(),
      amount,
      fromChain: 'sepolia',
      toChainId,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    console.error(`[WDK-EVM] Bridge failed:`, err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Get protocol status
 */
export function getProtocolStatus() {
  return {
    wallet: !!primaryAccount,
    swap: !!swapProtocol,
    lending: !!lendingProtocol,
    bridge: !!bridgeProtocol,
  };
}

// -- Helpers --

function formatBalance(raw, decimals) {
  if (!raw) return '0';
  const str = raw.toString().padStart(decimals + 1, '0');
  const whole = str.slice(0, -decimals) || '0';
  const frac = str.slice(-decimals).replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : whole;
}

function parseBalance(amount, decimals) {
  const [whole, frac = ''] = amount.toString().split('.');
  const paddedFrac = frac.padEnd(decimals, '0').slice(0, decimals);
  return BigInt(whole + paddedFrac);
}

export { TOKENS };
