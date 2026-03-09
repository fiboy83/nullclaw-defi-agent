/**
 * NullClaw - Main Application Layout
 * 3-column dashboard: Market | Agent Feed | Wallet
 * Header with sentiment badge, footer with branding
 */
import React from 'react';
import { useTheme } from './context/ThemeProvider.jsx';
import MarketPanel from './components/MarketPanel.jsx';
import AgentFeed from './components/AgentFeed.jsx';
import WalletPanel from './components/WalletPanel.jsx';
import SentimentBadge from './components/SentimentBadge.jsx';

export default function App() {
  const { sentiment } = useTheme();

  return (
    <div className="app">
      {/* --- Header --- */}
      <header className="app-header">
        <div className="header-left">
          <h1 className="logo">
            <span className="logo-icon">&#x2726;</span>
            <span className="logo-text">NullClaw</span>
          </h1>
          <span className="logo-sub">DeFi Agent</span>
        </div>
        <div className="header-right">
          <SentimentBadge
            value={sentiment.value}
            classification={sentiment.classification}
          />
          <div className="status-indicator">
            <span className="status-dot active" />
            <span className="status-label">LIVE</span>
          </div>
        </div>
      </header>

      {/* --- Main Dashboard Grid --- */}
      <main className="dashboard grid grid-3">
        <section className="panel panel-market">
          <MarketPanel />
        </section>
        <section className="panel panel-agent">
          <AgentFeed />
        </section>
        <section className="panel panel-wallet">
          <WalletPanel />
        </section>
      </main>

      {/* --- Footer --- */}
      <footer className="app-footer">
        <span>Powered by <strong>NullClaw</strong> &times; <strong>Tether WDK</strong></span>
        <span className="footer-ver">v0.1.0 &middot; Hackathon Galactica</span>
      </footer>
    </div>
  );
}