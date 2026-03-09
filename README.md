# NullClaw DeFi Agent

**Autonomous DeFi Portfolio Manager** powered by NullClaw (Zig) + Tether WDK

> Hackathon Galactica: WDK Edition -- DoraHacks x Tether

## Architecture

```
+--------------------------------------------+
|     Sovereign UI (React + Vite)            |
|  Dynamic sentiment-driven color theming    |
|  Fear=Red  Neutral=Blue  Greed=Green       |
+-------------------+------------------------+
                    | WebSocket + REST
+-------------------v------------------------+
|     NullClaw Agent (Zig binary, ~678KB)    |
|  Market analysis | Risk management         |
|  Yield optimization | Autonomous decisions |
+-------------------+------------------------+
                    | HTTP calls
+-------------------v------------------------+
|     WDK Sidecar (Node.js/Express)          |
|  Wallet ops | DeFi execution | Market data |
|  CoinGecko + Fear&Greed Index feeds        |
+--------------------------------------------+
```

## Quick Start (Project IDX)

1. **Import to IDX** via GitHub or upload this folder
2. IDX reads `dev.nix` and auto-installs Node.js 20 + dependencies
3. Preview starts automatically -- the dashboard opens in the web panel

### Manual Setup

```bash
# 1. Install all dependencies (root + sidecar + ui)
npm run setup

# 2. Copy environment file
cp env.example .env

# 3. Start development (Sidecar + UI with hot reload)
npm run dev

# 4. Build & preview production
npm run preview

# 5. Start everything including agent binary
npm start
```

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run setup` | Install deps for root, sidecar, and UI |
| `npm run dev` | Start sidecar + UI in dev mode (hot reload) |
| `npm run dev:ui` | Start only the Vite dev server |
| `npm run dev:sidecar` | Start only the Express API server |
| `npm run build` | Build UI for production |
| `npm run preview` | Build + serve production preview |
| `npm start` | Production orchestrator (all services) |

## Project Structure

```
nullclaw-defi-agent/
|-- nullclaw              # Zig binary (AI agent runtime)
|-- package.json          # Root orchestrator scripts
|-- start.js              # Production boot sequence
|-- env.example           # Environment variables template
|
|-- agent/                # Agent configuration
|   |-- config.json       # Tools, skills, risk limits
|   |-- identity.md       # Agent personality & rules
|   +-- memory/           # Persistent agent memory
|
|-- sidecar/              # WDK REST API (Node.js)
|   |-- package.json
|   |-- server.js         # Express + WebSocket server
|   |-- wdk-mock.js       # Mock WDK (replace with real SDK)
|   +-- routes/
|       |-- wallet.js     # /api/wallet/* endpoints
|       |-- defi.js       # /api/defi/* endpoints
|       +-- market.js     # /api/market/* (CoinGecko, F&G)
|
+-- ui/                   # Sovereign Dashboard (Vite + React)
    |-- package.json
    |-- vite.config.js
    |-- index.html
    +-- src/
        |-- main.jsx
        |-- App.jsx
        |-- styles/
        |   +-- global.css        # Dynamic CSS variables
        |-- context/
        |   +-- ThemeProvider.jsx  # Sentiment -> CSS vars
        |-- hooks/
        |   |-- useSentiment.js    # Fear & Greed polling
        |   +-- useWebSocket.js    # Real-time WS hook
        +-- components/
            |-- MarketPanel.jsx    # Prices + sentiment gauge
            |-- AgentFeed.jsx      # Agent activity log
            |-- WalletPanel.jsx    # Balances + positions
            +-- SentimentBadge.jsx # Header mood indicator
```

## Sentiment-Driven Theming

The UI automatically shifts colors based on the Fear & Greed Index:

| Sentiment | Score | Theme Colors |
|-----------|-------|--------------|
| Fear | 0-25 | Crimson red, dark bg, pulse animations |
| Cautious | 26-45 | Amber/orange, subtle warnings |
| Neutral | 46-55 | Tether blue (#0098D9), clean default |
| Greed | 56-75 | Neon green (#39FF14), glow effects |
| Extreme Greed | 76-100 | Gold (#FFD700), celebration mode |

Transitions are smooth (1.5s cubic-bezier) -- the dashboard "breathes" with the market.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/market/prices | BTC, ETH, XAUT live prices |
| GET | /api/market/sentiment | Fear & Greed Index |
| GET | /api/market/summary | Combined prices + sentiment + theme |
| GET | /api/wallet/balances | Token balances |
| GET | /api/wallet/address | Wallet address |
| POST | /api/wallet/send | Send tokens |
| GET | /api/defi/rates | Yield rates (Aave, Velora) |
| POST | /api/defi/swap | Execute token swap |
| POST | /api/defi/lend | Lend tokens for yield |
| GET | /api/defi/positions | Active DeFi positions |
| GET | /api/health | Service health check |

## Tech Stack

- **Agent Runtime**: NullClaw (Zig) -- 678KB binary, 2ms boot, 1MB RAM
- **Wallet Layer**: Tether WDK (JavaScript SDK)
- **API Server**: Express.js + WebSocket (ws)
- **Dashboard**: React 18 + Vite 5
- **Data Feeds**: CoinGecko (prices), Alternative.me (sentiment)

## License

Apache-2.0
