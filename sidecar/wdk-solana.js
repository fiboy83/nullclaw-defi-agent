/**
 * NullClaw WDK Solana Integration Layer
 * Receives a pre-initialized WalletAccountSolana from wdk-manager.js
 * Supports: SOL transfers, SPL token transfers
 */

let primaryAccount = null;

/**
 * Receive pre-initialized account from wdk-manager
 * Account is created via: wdk.getAccount('solana', 0)
 */
export function initWithAccount(account) {
  primaryAccount = account;
  console.log('[WDK-SOL] Account received from WDK core');
}

export async function getAddress() {
  if (!primaryAccount) throw new Error('Solana wallet not initialized');
  return primaryAccount.getAddress();
}

export async function getBalances() {
  if (!primaryAccount) throw new Error('Solana wallet not initialized');
  const address = await primaryAccount.getAddress();
  const balances = { SOL: '0' };
  try {
    const solBalance = await primaryAccount.getBalance();
    balances.SOL = formatBalance(solBalance, 9);
  } catch (e) { console.warn('[WDK-SOL] SOL balance error:', e.message); }
  const splTokens = {
    USDT: process.env.SOL_USDT_ADDRESS,
    USDC: process.env.SOL_USDC_ADDRESS,
  };
  for (const [symbol, mint] of Object.entries(splTokens)) {
    if (!mint) continue;
    try {
      const balance = await primaryAccount.getTokenBalance(mint);
      balances[symbol] = formatBalance(balance, 6);
    } catch (e) { balances[symbol] = '0'; }
  }
  return { address, chain: 'solana', network: 'devnet', balances };
}

export async function sendTransaction({ to, amount, token = 'SOL' }) {
  if (!primaryAccount) throw new Error('Solana wallet not initialized');
  try {
    let result;
    if (token === 'SOL') {
      result = await primaryAccount.transfer({ to, amount: parseBalance(amount, 9) });
    } else {
      const mintMap = { USDT: process.env.SOL_USDT_ADDRESS, USDC: process.env.SOL_USDC_ADDRESS };
      const mint = mintMap[token];
      if (!mint) throw new Error('Unknown SPL token: ' + token);
      result = await primaryAccount.transfer({ to, amount: parseBalance(amount, 6), token: mint });
    }
    const from = await primaryAccount.getAddress();
    console.log('[WDK-SOL] Sent ' + amount + ' ' + token + ' to ' + to + ' -> tx: ' + result.hash);
    return { success: true, txHash: result.hash, fee: result.fee?.toString(), from, to, amount, token, chain: 'solana', timestamp: new Date().toISOString() };
  } catch (err) {
    console.error('[WDK-SOL] Send failed:', err.message);
    return { success: false, error: err.message };
  }
}

export function getProtocolStatus() {
  return { wallet: !!primaryAccount };
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
