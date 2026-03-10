/**
 * NullClaw WDK EVM Integration Layer
 * Receives a pre-initialized WalletAccountEvm from wdk-manager.js
 * Supports: Wallet, Swap (Velora), Lending (Aave), Bridge (USDT0)
 */

import VeloraProtocolEvm from '@tetherto/wdk-protocol-swap-velora-evm';
import AaveProtocolEvm from '@tetherto/wdk-protocol-lending-aave-evm';
import Usdt0ProtocolEvm from '@tetherto/wdk-protocol-bridge-usdt0-evm';

const TOKENS = {
  USDT: process.env.EVM_USDT_ADDRESS || '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06',
  WETH: process.env.EVM_WETH_ADDRESS || '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',
  USDC: process.env.EVM_USDC_ADDRESS || '0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8',
  DAI: process.env.EVM_DAI_ADDRESS || '0xFF34B3d4Aee8ddCd6F9AFFFB6Fe49bD371b8a357',
};

let primaryAccount = null;
let swapProtocol = null;
let lendingProtocol = null;
let bridgeProtocol = null;

/**
 * Receive pre-initialized account from wdk-manager
 * Account is created via: wdk.getAccount('ethereum', 0)
 */
export function initWithAccount(account) {
  primaryAccount = account;
  console.log('[WDK-EVM] Account received from WDK core');

  // Initialize protocols with the proper account
  try {
    swapProtocol = new VeloraProtocolEvm(primaryAccount, { swapMaxFee: 200000000000000n });
    console.log('[WDK-EVM] Velora swap protocol ready');
  } catch (e) { console.warn('[WDK-EVM] Velora swap init skipped:', e.message); }

  try {
    lendingProtocol = new AaveProtocolEvm(primaryAccount);
    console.log('[WDK-EVM] Aave lending protocol ready');
  } catch (e) { console.warn('[WDK-EVM] Aave lending init skipped:', e.message); }

  try {
    bridgeProtocol = new Usdt0ProtocolEvm(primaryAccount);
    console.log('[WDK-EVM] USDT0 bridge protocol ready');
  } catch (e) { console.warn('[WDK-EVM] Bridge init skipped:', e.message); }
}

export async function getAddress() {
  if (!primaryAccount) throw new Error('Wallet not initialized');
  return primaryAccount.getAddress();
}

export async function getBalances() {
  if (!primaryAccount) throw new Error('Wallet not initialized');
  const address = await primaryAccount.getAddress();
  const balances = { ETH: '0' };
  try {
    const ethBalance = await primaryAccount.getBalance();
    balances.ETH = formatBalance(ethBalance, 18);
  } catch (e) { console.warn('[WDK-EVM] ETH balance error:', e.message); }
  for (const [symbol, tokenAddress] of Object.entries(TOKENS)) {
    try {
      const balance = await primaryAccount.getTokenBalance(tokenAddress);
      const decimals = symbol === 'WETH' || symbol === 'DAI' ? 18 : 6;
      balances[symbol] = formatBalance(balance, decimals);
    } catch (e) { balances[symbol] = '0'; }
  }
  return { address, chain: 'evm', network: 'sepolia', balances };
}

export async function sendTransaction({ to, amount, token = 'ETH' }) {
  if (!primaryAccount) throw new Error('Wallet not initialized');
  try {
    let result;
    if (token === 'ETH') {
      result = await primaryAccount.sendTransaction({ to, value: parseBalance(amount, 18).toString() });
    } else {
      const tokenAddress = TOKENS[token];
      if (!tokenAddress) throw new Error('Unknown token: ' + token);
      const decimals = token === 'WETH' || token === 'DAI' ? 18 : 6;
      result = await primaryAccount.transfer({ to, amount: parseBalance(amount, decimals), token: tokenAddress });
    }
    const from = await primaryAccount.getAddress();
    console.log('[WDK-EVM] Sent ' + amount + ' ' + token + ' to ' + to + ' -> tx: ' + result.hash);
    return { success: true, txHash: result.hash, fee: result.fee?.toString(), from, to, amount, token, chain: 'evm', timestamp: new Date().toISOString() };
  } catch (err) {
    console.error('[WDK-EVM] Send failed:', err.message);
    return { success: false, error: err.message };
  }
}

export async function swap({ fromToken, toToken, amount }) {
  if (!swapProtocol) throw new Error('Swap protocol not initialized');
  const tokenIn = TOKENS[fromToken] || fromToken;
  const tokenOut = TOKENS[toToken] || toToken;
  const decimalsIn = fromToken === 'WETH' || fromToken === 'ETH' ? 18 : fromToken === 'DAI' ? 18 : 6;
  const tokenInAmount = parseBalance(amount, decimalsIn);
  try {
    const quote = await swapProtocol.quoteSwap({ tokenIn, tokenOut, tokenInAmount });
    console.log('[WDK-EVM] Swap quote: ' + amount + ' ' + fromToken + ' -> ' + quote.tokenOutAmount + ' ' + toToken);
    const result = await swapProtocol.swap({ tokenIn, tokenOut, tokenInAmount });
    return { success: true, txHash: result.hash, fee: result.fee?.toString(), fromToken, toToken, amountIn: amount, amountOut: result.tokenOutAmount?.toString(), chain: 'evm', timestamp: new Date().toISOString() };
  } catch (err) {
    console.error('[WDK-EVM] Swap failed:', err.message);
    return { success: false, error: err.message };
  }
}

export async function getSwapQuote({ fromToken, toToken, amount }) {
  if (!swapProtocol) throw new Error('Swap protocol not initialized');
  const tokenIn = TOKENS[fromToken] || fromToken;
  const tokenOut = TOKENS[toToken] || toToken;
  const decimalsIn = fromToken === 'WETH' || fromToken === 'ETH' ? 18 : fromToken === 'DAI' ? 18 : 6;
  const quote = await swapProtocol.quoteSwap({ tokenIn, tokenOut, tokenInAmount: parseBalance(amount, decimalsIn) });
  return { fromToken, toToken, amountIn: amount, estimatedOut: quote.tokenOutAmount?.toString(), estimatedFee: quote.fee?.toString() };
}

export async function lend({ action, token, amount }) {
  if (!lendingProtocol) throw new Error('Lending protocol not initialized');
  const tokenAddress = TOKENS[token] || token;
  const decimals = token === 'WETH' || token === 'ETH' ? 18 : token === 'DAI' ? 18 : 6;
  const parsedAmount = parseBalance(amount, decimals);
  try {
    let result;
    switch (action) {
      case 'supply': result = await lendingProtocol.supply({ asset: tokenAddress, amount: parsedAmount }); break;
      case 'withdraw': result = await lendingProtocol.withdraw({ asset: tokenAddress, amount: parsedAmount }); break;
      case 'borrow': result = await lendingProtocol.borrow({ asset: tokenAddress, amount: parsedAmount }); break;
      case 'repay': result = await lendingProtocol.repay({ asset: tokenAddress, amount: parsedAmount }); break;
      default: throw new Error('Unknown lending action: ' + action);
    }
    console.log('[WDK-EVM] Aave ' + action + ': ' + amount + ' ' + token + ' -> tx: ' + result.hash);
    return { success: true, txHash: result.hash, fee: result.fee?.toString(), action, token, amount, chain: 'evm', timestamp: new Date().toISOString() };
  } catch (err) {
    console.error('[WDK-EVM] Lending ' + action + ' failed:', err.message);
    return { success: false, error: err.message };
  }
}

export async function getLendingPositions() {
  if (!lendingProtocol) throw new Error('Lending protocol not initialized');
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
    console.error('[WDK-EVM] Get positions failed:', err.message);
    return { error: err.message };
  }
}

export async function bridge({ toChainId, amount }) {
  if (!bridgeProtocol) throw new Error('Bridge protocol not initialized');
  try {
    const parsedAmount = parseBalance(amount, 6);
    const result = await bridgeProtocol.bridge({ dstChainId: toChainId, amount: parsedAmount });
    console.log('[WDK-EVM] Bridge ' + amount + ' USDT0 to chain ' + toChainId + ' -> tx: ' + result.hash);
    return { success: true, txHash: result.hash, fee: result.fee?.toString(), amount, fromChain: 'sepolia', toChainId, timestamp: new Date().toISOString() };
  } catch (err) {
    console.error('[WDK-EVM] Bridge failed:', err.message);
    return { success: false, error: err.message };
  }
}

export function getProtocolStatus() {
  return { wallet: !!primaryAccount, swap: !!swapProtocol, lending: !!lendingProtocol, bridge: !!bridgeProtocol };
}

function formatBalance(raw, decimals) {
  if (!raw) return '0';
  const str = raw.toString().padStart(decimals + 1, '0');
  const whole = str.slice(0, -decimals) || '0';
  const frac = str.slice(-decimals).replace(/0+$/, '');
  return frac ? whole + '.' + frac : whole;
}

function parseBalance(amount, decimals) {
  const [whole, frac = ''] = amount.toString().split('.');
  const paddedFrac = frac.padEnd(decimals, '0').slice(0, decimals);
  return BigInt(whole + paddedFrac);
}

export { TOKENS };
