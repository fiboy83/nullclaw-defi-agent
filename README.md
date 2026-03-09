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

## Quick Start

```bash
# 1. Install dependencies
npm run setup

# 2. Copy environment file
cp env.example .env

# 3. Make NullClaw binary executable (if present)
chmod +x ./nullclaw

# 4. Start development (Sidecar + UI with hot reload)
npm run dev

# 5. Start everything including agent
npm start
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

## Tech Stack

- **Agent Runtime**: NullClaw (Zig) -- 678KB binary, 2ms boot, 1MB RAM
- **Wallet Layer**: Tether WDK (JavaScript SDK)
- **API Server**: Express.js + WebSocket (ws)
- **Dashboard**: React 18 + Vite 5
- **Data Feeds**: CoinGecko (prices), Alternative.me (sentiment)

## License

Apache-2.0
