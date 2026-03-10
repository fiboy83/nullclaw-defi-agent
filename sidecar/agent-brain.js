/**
 * NullClaw Agent Brain -- LLM-Powered Autonomous DeFi Decision Engine
 * 
 * This is the core intelligence layer that makes NullClaw an "agent" not just a "tool".
 * Uses OpenAI GPT to analyze portfolio state + market conditions and propose
 * autonomous DeFi actions with human-in-the-loop confirmation.
 * 
 * Decision types:
 * - rebalance: Portfolio allocation adjustments
 * - yield-optimize: Move funds to higher yield protocols
 * - risk-alert: Warn about health factor / liquidation risk
 * - swap-opportunity: Favorable swap conditions detected
 * - bridge-suggestion: Cross-chain arbitrage or rebalancing
 */

import OpenAI from 'openai';
import * as wdkManager from './wdk-manager.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

// Decision history (in-memory, persists per session)
const decisionHistory = [];
const MAX_HISTORY = 100;

// Pending decisions awaiting user confirmation
const pendingDecisions = new Map();

// Agent configuration
const AGENT_CONFIG = {
  analysisInterval: 60_000, // Analyze every 60s
  optimizeInterval: 300_000, // Deep optimize every 5min
  riskThresholds: {
    healthFactorWarning: 1.5,
    healthFactorCritical: 1.1,
    maxSingleTradePercent: 0.2, // Max 20% of portfolio per trade
    minBalanceKeep: 0.01, // Always keep some gas
  },
  model: process.env.LLM_MODEL || 'gpt-4o-mini',
};

/**
 * System prompt for the DeFi agent brain
 */
const SYSTEM_PROMPT = `You are NullClaw, an autonomous DeFi agent brain. You analyze portfolio data and market conditions to make intelligent DeFi decisions.

Your capabilities via Tether WDK:
- Swap tokens via Velora DEX (EVM)
- Supply/borrow/repay on Aave lending (EVM)
- Bridge USDT0 across EVM chains
- Transfer tokens on EVM and Solana

Rules:
1. NEVER risk more than 20% of portfolio in a single action
2. ALWAYS maintain minimum gas reserves (0.01 ETH, 0.05 SOL)
3. Health factor below 1.5 = WARNING, below 1.1 = CRITICAL action needed
4. Prefer testnet-safe suggestions (we're on Sepolia + Devnet)
5. Every decision must include clear reasoning

Respond ONLY with valid JSON in this exact format:
{
  "decisions": [
    {
      "type": "rebalance|yield-optimize|risk-alert|swap-opportunity|bridge-suggestion",
      "priority": "low|medium|high|critical",
      "title": "Short description",
      "reasoning": "Why this action makes sense",
      "action": {
        "method": "swap|lend|bridge|send|none",
        "params": {}
      },
      "estimatedImpact": "Expected outcome description"
    }
  ],
  "marketSummary": "Brief market context",
  "portfolioHealth": "healthy|warning|critical"
}`;

/**
 * Analyze portfolio and generate decisions
 * This is the main brain loop
 */
export async function analyze(broadcastFn = null) {
  if (!process.env.OPENAI_API_KEY) {
    console.log('[BRAIN] No OPENAI_API_KEY set, skipping analysis');
    return null;
  }

  if (!wdkManager.isReady()) {
    console.log('[BRAIN] WDK not ready, skipping analysis');
    return null;
  }

  try {
    // Gather current state
    const portfolio = await wdkManager.crossChainSummary();
    let lendingPositions = null;

    try {
      const evmDefi = wdkManager.getEvmDefi();
      lendingPositions = await evmDefi.getLendingPositions();
    } catch (e) {
      // Lending might not be initialized
    }

    const statePrompt = buildStatePrompt(portfolio, lendingPositions);

    // Ask LLM for analysis
    const completion = await openai.chat.completions.create({
      model: AGENT_CONFIG.model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: statePrompt },
      ],
      temperature: 0.3, // Low temp for consistent decisions
      max_tokens: 1500,
      response_format: { type: 'json_object' },
    });

    const response = JSON.parse(completion.choices[0].message.content);

    // Process decisions
    const decisions = response.decisions || [];
    for (const decision of decisions) {
      const id = `dec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      decision.id = id;
      decision.timestamp = new Date().toISOString();
      decision.status = 'pending_confirmation';

      // Store pending decision for user confirmation
      pendingDecisions.set(id, decision);

      // Add to history
      decisionHistory.unshift(decision);
      if (decisionHistory.length > MAX_HISTORY) decisionHistory.pop();
    }

    const result = {
      ...response,
      timestamp: new Date().toISOString(),
      decisionsCount: decisions.length,
    };

    // Broadcast via WebSocket if available
    if (broadcastFn && decisions.length > 0) {
      broadcastFn('agent:decisions', result);
    }

    console.log(`[BRAIN] Analysis complete: ${decisions.length} decisions, health: ${response.portfolioHealth}`);
    return result;
  } catch (err) {
    console.error('[BRAIN] Analysis failed:', err.message);
    return { error: err.message };
  }
}

/**
 * Build the state prompt for LLM analysis
 */
function buildStatePrompt(portfolio, lendingPositions) {
  let prompt = `Current Portfolio State (${new Date().toISOString()}):\n\n`;

  // Chain balances
  prompt += `== Multi-Chain Balances ==\n`;
  for (const [chain, data] of Object.entries(portfolio.chains)) {
    if (data.status === 'error') {
      prompt += `${chain}: ERROR - ${data.error}\n`;
      continue;
    }
    prompt += `${chain.toUpperCase()} (${data.network}) - Address: ${data.address}\n`;
    if (data.balances) {
      for (const [token, amount] of Object.entries(data.balances)) {
        prompt += `  ${token}: ${amount}\n`;
      }
    }
  }

  // Aggregated tokens
  prompt += `\n== Cross-Chain Token Totals ==\n`;
  for (const [token, info] of Object.entries(portfolio.totalTokens)) {
    prompt += `${token}: ${info.total} (across: ${Object.entries(info.chains).map(([c, a]) => `${c}=${a}`).join(', ')})\n`;
  }

  // Protocol status
  prompt += `\n== Protocol Status ==\n`;
  for (const [chain, status] of Object.entries(portfolio.protocols)) {
    prompt += `${chain}: swap=${status.swap}, lending=${status.lending}, bridge=${status.bridge}\n`;
  }

  // Lending positions
  if (lendingPositions && !lendingPositions.error) {
    prompt += `\n== Aave Lending Positions ==\n`;
    prompt += `Total Collateral: ${lendingPositions.totalCollateralBase}\n`;
    prompt += `Total Debt: ${lendingPositions.totalDebtBase}\n`;
    prompt += `Available Borrows: ${lendingPositions.availableBorrowsBase}\n`;
    prompt += `Health Factor: ${lendingPositions.healthFactor}\n`;
    prompt += `LTV: ${lendingPositions.ltv}\n`;
  }

  // Recent decisions for context
  const recentDecisions = decisionHistory.slice(0, 5);
  if (recentDecisions.length > 0) {
    prompt += `\n== Recent Decisions (last ${recentDecisions.length}) ==\n`;
    for (const d of recentDecisions) {
      prompt += `[${d.timestamp}] ${d.type} (${d.priority}): ${d.title} -> ${d.status}\n`;
    }
  }

  prompt += `\nAnalyze the portfolio and suggest actionable DeFi decisions. Consider risk management, yield optimization, and cross-chain rebalancing opportunities. Remember we are on TESTNET (Sepolia + Devnet).`;

  return prompt;
}

/**
 * Confirm and execute a pending decision
 */
export async function confirmDecision(decisionId) {
  const decision = pendingDecisions.get(decisionId);
  if (!decision) {
    return { success: false, error: 'Decision not found or already processed' };
  }

  try {
    decision.status = 'executing';
    let result = null;

    const evmDefi = wdkManager.getEvmDefi();

    switch (decision.action?.method) {
      case 'swap':
        result = await evmDefi.swap(decision.action.params);
        break;
      case 'lend':
        result = await evmDefi.lend(decision.action.params);
        break;
      case 'bridge':
        result = await evmDefi.bridge(decision.action.params);
        break;
      case 'send':
        const chain = decision.action.params.chain || 'evm';
        result = await wdkManager.send(chain, decision.action.params);
        break;
      case 'none':
        result = { success: true, note: 'Informational only, no action needed' };
        break;
      default:
        result = { success: false, error: `Unknown method: ${decision.action?.method}` };
    }

    decision.status = result?.success ? 'executed' : 'failed';
    decision.result = result;
    decision.executedAt = new Date().toISOString();
    pendingDecisions.delete(decisionId);

    // Update history
    const histIdx = decisionHistory.findIndex((d) => d.id === decisionId);
    if (histIdx >= 0) decisionHistory[histIdx] = decision;

    console.log(`[BRAIN] Decision ${decisionId} ${decision.status}`);
    return { success: true, decision };
  } catch (err) {
    decision.status = 'failed';
    decision.error = err.message;
    pendingDecisions.delete(decisionId);
    console.error(`[BRAIN] Decision execution failed:`, err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Reject a pending decision
 */
export function rejectDecision(decisionId) {
  const decision = pendingDecisions.get(decisionId);
  if (!decision) {
    return { success: false, error: 'Decision not found' };
  }

  decision.status = 'rejected';
  decision.rejectedAt = new Date().toISOString();
  pendingDecisions.delete(decisionId);

  const histIdx = decisionHistory.findIndex((d) => d.id === decisionId);
  if (histIdx >= 0) decisionHistory[histIdx] = decision;

  return { success: true, decision };
}

/**
 * Get decision history
 */
export function getHistory(limit = 20) {
  return decisionHistory.slice(0, limit);
}

/**
 * Get all pending decisions
 */
export function getPending() {
  return Array.from(pendingDecisions.values());
}

/**
 * Get agent config
 */
export function getConfig() {
  return { ...AGENT_CONFIG };
}
