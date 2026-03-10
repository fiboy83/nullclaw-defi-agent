# NullClaw -- Autonomous DeFi Agent

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Hackathon: Galactica WDK 2026](https://img.shields.io/badge/Hackathon-Galactica%20WDK%202026-purple.svg)](https://dorahacks.io/hackathon/hackathon-galactica-wdk-2026-01)
[![WDK: Tether](https://img.shields.io/badge/WDK-Tether-green.svg)](https://docs.wdk.tether.io)

An autonomous DeFi agent that uses **Tether WDK** for multi-chain wallet operations and an **LLM-powered brain** to make intelligent, human-confirmed DeFi decisions across EVM and Solana.

---

## Architecture

```
+----------------------------------------------------------+
|                    NullClaw Agent                         |
|                                                          |
|  +------------------+    +---------------------------+   |
|  |   Agent Brain    |    |     React Dashboard       |   |
|  |   (LLM/GPT)     |    |  - Multi-chain wallet     |   |
|  |                  |    |  - DeFi operations         |   |
|  |  Analyze -> Plan |    |  - Decision feed           |   |
|  |  -> Confirm      |    |  - Confirm/Reject modal    |   |
|  +--------+---------+    +-------------+-------------+   |
|           |                            |                 |
|           v                            v                 |
|  +--------------------------------------------------+    |
|  |             Express + WebSocket Server            |    |
|  |  /api/wallet  /api/defi  /api/agent  /api/market  |    |
|  +--------------------------------------------------+    |
|           |                                              |
|           v                                              |
|  +--------------------------------------------------+    |
|  |            WDK Manager (Orchestrator)             |    |
|  |  One seed phrase -> Multiple chain wallets        |    |
|  +--------------------------------------------------+    |
|           |                            |                 |
|           v                            v                 |
|  +-----------------+        +-------------------+        |
|  |   WDK EVM       |        |   WDK Solana      |        |
|  | - Wallet        |        | - Wallet          |        |
|  | - Velora Swap   |        | - SOL Transfers   |        |
|  | - Aave Lending  |        | - SPL Tokens      |        |
|  | - USDT0 Bridge  |        |                   |        |
|  | (Sepolia)       |        | (Devnet)          |        |
|  +-----------------+        +-------------------+        |
+----------------------------------------------------------+
```

## WDK Integration

NullClaw uses **6 Tether WDK modules** for real on-chain operations:

| Module | Purpose | Chain |
|--------|---------|-------|
| `@tetherto/wdk` | Core SDK, seed phrase management | All |
| `@tetherto/wdk-wallet-evm` | EVM wallet (accounts, transfers, ERC20) | Ethereum Sepolia |
| `@tetherto/wdk-wallet-solana` | Solana wallet (accounts, SOL, SPL tokens) | Solana Devnet |
| `@tetherto/wdk-protocol-swap-velora-evm` | DEX swaps via Velora | EVM |
| `@tetherto/wdk-protocol-lending-aave-evm` | Lending/borrowing via Aave V3 | EVM |
| `@tetherto/wdk-protocol-bridge-usdt0-evm` | Cross-chain USDT0 bridging | EVM |

**Key design**: One BIP-39 seed phrase derives wallets on both EVM and Solana through the WDK Manager orchestrator, enabling true multi-chain self-custody from a single secret.

## Agent Intelligence (LLM Brain)

The agent brain analyzes portfolio state every 60 seconds and proposes autonomous actions:

- **Rebalance** -- Adjust portfolio allocation across chains
- **Yield Optimize** -- Move funds to higher-yield Aave positions
- **Risk Alert** -- Warn when health factor drops below thresholds
- **Swap Opportunity** -- Identify favorable Velora swap conditions
- **Bridge Suggestion** -- Cross-chain arbitrage or rebalancing

Every decision requires **human confirmation** before execution (Confirm/Reject in the UI). The agent never executes autonomously without user approval.

## Quick Start

### Prerequisites

- Node.js >= 20.0.0
- npm

### 1. Clone & Install

```bash
git clone https://github.com/fiboy83/nullclaw-defi-agent.git
cd nullclaw-defi-agent
npm run install:all
```

### 2. Configure Environment

```bash
cp env.example .env
```

Edit `.env` with your values:

```bash
# REQUIRED: Your testnet wallet seed phrase
SEED_PHRASE=your twelve word seed phrase here

# OPTIONAL: Enable AI agent brain
OPENAI_API_KEY=sk-your-key-here
```

> **IMPORTANT**: Use a dedicated testnet wallet. Never use your main wallet's seed phrase!

### 3. Get Testnet Tokens

| Chain | Faucet | Token |
|-------|--------|-------|
| Sepolia ETH | [sepoliafaucet.com](https://sepoliafaucet.com) | ETH |
| Sepolia USDT | [Aave Faucet](https://app.aave.com/faucet/) | USDT, USDC, DAI |
| Solana Devnet | [faucet.solana.com](https://faucet.solana.com) | SOL |

### 4. Run

```bash
npm run dev
```

This starts:
- **Sidecar API** on `http://localhost:3001` (backend + WebSocket)
- **Dashboard UI** on `http://localhost:5173` (React + Vite)

### Project IDX

Import directly from GitHub into [Project IDX](https://idx.dev). The `dev.nix` file auto-configures the environment.

## API Endpoints

### Wallet
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/wallet/portfolio` | Cross-chain portfolio summary |
| GET | `/api/wallet/balances` | All chain balances |
| GET | `/api/wallet/balances/:chain` | Single chain balances |
| POST | `/api/wallet/send` | Send tokens (any chain) |

### DeFi
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/defi/swap` | Swap via Velora |
| GET | `/api/defi/quote` | Get swap quote |
| POST | `/api/defi/lend` | Aave supply/withdraw/borrow/repay |
| GET | `/api/defi/positions` | Aave positions & health factor |
| POST | `/api/defi/bridge` | Bridge USDT0 |

### Agent
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/agent/analyze` | Trigger LLM analysis |
| GET | `/api/agent/pending` | Pending decisions |
| POST | `/api/agent/confirm/:id` | Confirm & execute |
| POST | `/api/agent/reject/:id` | Reject decision |
| GET | `/api/agent/history` | Decision history |

## Project Structure

```
nullclaw-defi-agent/
|-- package.json            # Monorepo root
|-- env.example             # Environment template
|-- dev.nix                 # Project IDX config
|-- LICENSE                 # Apache 2.0
|
|-- agent/
|   |-- config.json         # Chain configs, protocols, risk params
|   |-- identity.md         # Agent personality
|
|-- sidecar/
|   |-- server.js           # Express + WebSocket + agent loop
|   |-- agent-brain.js      # LLM decision engine
|   |-- wdk-manager.js      # Multi-chain orchestrator
|   |-- wdk-evm.js          # WDK EVM integration
|   |-- wdk-solana.js       # WDK Solana integration
|   |-- routes/
|       |-- wallet.js        # Wallet endpoints
|       |-- defi.js          # DeFi endpoints
|       |-- market.js        # Market data endpoints
|
|-- ui/
    |-- src/
        |-- components/
        |   |-- WalletPanel.jsx    # Multi-chain wallet UI
        |   |-- MarketPanel.jsx    # DeFi operations UI
        |   |-- AgentFeed.jsx      # Decision feed + confirm/reject
        |-- hooks/
        |-- context/
        |-- styles/
```

## Hackathon Track

**Galactica WDK Hackathon 2026** -- Autonomous DeFi Agent Track

- Framework: NullClaw (custom)
- Wallet SDK: Tether WDK
- Chains: EVM (Sepolia) + Solana (Devnet)
- LLM: OpenAI GPT-4o-mini
- License: Apache 2.0

## Third-Party Disclosures

This project uses the following open-source dependencies:

- **Tether WDK** (`@tetherto/wdk-*`) -- Apache 2.0 -- Wallet and DeFi protocol SDK
- **OpenAI Node SDK** (`openai`) -- Apache 2.0 -- LLM API client
- **Express** (`express`) -- MIT -- HTTP server framework
- **Vite** (`vite`) -- MIT -- Frontend build tool
- **React** (`react`) -- MIT -- UI library
- **ws** (`ws`) -- MIT -- WebSocket library

All third-party licenses are compatible with Apache 2.0.

## License

Licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE) for full text.
