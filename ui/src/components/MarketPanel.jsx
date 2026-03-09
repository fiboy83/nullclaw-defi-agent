/**
 * MarketPanel - Live market data + sentiment gauge
 * Shows BTC, ETH, XAUT prices and Fear & Greed visualization
 */
import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeProvider.jsx';

function formatPrice(value) {
  if (!value && value !== 0) return '--';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value);
}

function formatChange(value) {
  if (!value && value !== 0) return '--';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

export default function MarketPanel() {
  const { sentiment } = useTheme();
  const [market, setMarket] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchMarket = async () => {
    try {
      const res = await fetch('/api/market/summary');
      const json = await res.json();
      if (json.success) setMarket(json.data);
    } catch (e) {
      console.warn('Market fetch failed:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMarket();
    const id = setInterval(fetchMarket, 30_000);
    return () => clearInterval(id);
  }, []);

  const prices = market?.prices || {};

  const tokens = [
    { key: 'bitcoin', symbol: 'BTC', icon: '\u20BF' },
    { key: 'ethereum', symbol: 'ETH', icon: '\u2B21' },
    { key: 'tether-gold', symbol: 'XAUT', icon: '\uD83E\uDE99' },
  ];

  const gaugeRotation = sentiment.value
    ? (sentiment.value / 100) * 180 - 90
    : -90;

  return (
    <div className="market-panel">
      <h2 className="panel-title">
        <span className="panel-icon">\uD83D\uDCC8</span> Market
      </h2>

      <div className="sentiment-gauge">
        <div className="gauge-container">
          <svg viewBox="0 0 200 120" className="gauge-svg">
            <path
              d="M 20 100 A 80 80 0 0 1 180 100"
              fill="none"
              stroke="var(--surface)"
              strokeWidth="12"
              strokeLinecap="round"
            />
            <path
              d="M 20 100 A 80 80 0 0 1 180 100"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={`${(sentiment.value / 100) * 251} 251`}
              style={{ filter: 'drop-shadow(0 0 6px var(--glow))' }}
            />
            <line
              x1="100"
              y1="100"
              x2="100"
              y2="30"
              stroke="var(--accent)"
              strokeWidth="2.5"
              strokeLinecap="round"
              transform={`rotate(${gaugeRotation}, 100, 100)`}
              style={{ transition: 'transform 1.5s ease' }}
            />
            <circle cx="100" cy="100" r="5" fill="var(--accent)" />
            <text
              x="100"
              y="88"
              textAnchor="middle"
              fill="var(--text)"
              fontSize="22"
              fontWeight="700"
              fontFamily="JetBrains Mono, monospace"
            >
              {sentiment.value ?? '--'}
            </text>
          </svg>
        </div>
        <div className="gauge-label">
          {sentiment.classification || 'Loading...'}
        </div>
      </div>

      <div className="price-list">
        {loading ? (
          <div className="loading-shimmer">Loading prices...</div>
        ) : (
          tokens.map(({ key, symbol, icon }) => {
            const data = prices[key];
            const price = data?.usd;
            const change = data?.usd_24h_change;
            const isUp = change >= 0;

            return (
              <div key={key} className="price-row">
                <div className="price-token">
                  <span className="token-icon">{icon}</span>
                  <span className="token-symbol">{symbol}</span>
                </div>
                <div className="price-data">
                  <span className="price-value">{formatPrice(price)}</span>
                  <span className={`price-change ${isUp ? 'up' : 'down'}`}>
                    {isUp ? '\u25B2' : '\u25BC'} {formatChange(change)}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="rates-teaser">
        <h3 className="rates-title">Top Yields</h3>
        <div className="rate-row">
          <span>Velora LP</span>
          <span className="rate-value">12.5% APY</span>
        </div>
        <div className="rate-row">
          <span>Aave USDT</span>
          <span className="rate-value">4.2% APY</span>
        </div>
        <div className="rate-row">
          <span>Aave ETH</span>
          <span className="rate-value">3.1% APY</span>
        </div>
      </div>
    </div>
  );
}
