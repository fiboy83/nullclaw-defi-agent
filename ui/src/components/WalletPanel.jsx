/**
 * WalletPanel - WDK wallet balances and DeFi positions
 */
import React, { useState, useEffect, useCallback } from 'react';

const TOKEN_META = {
  USDT: { icon: '\uD83D\uDCB5', name: 'Tether USD', color: '#26A17B' },
  XAUT: { icon: '\uD83E\uDE99', name: 'Tether Gold', color: '#FFD700' },
  ETH: { icon: '\u2B21', name: 'Ethereum', color: '#627EEA' },
};

export default function WalletPanel() {
  const [balances, setBalances] = useState(null);
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toastMsg, setToastMsg] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [balRes, posRes] = await Promise.all([
        fetch('/api/wallet/balances').then((r) => r.json()),
        fetch('/api/defi/positions').then((r) => r.json()),
      ]);
      if (balRes.success) setBalances(balRes.data);
      if (posRes.success) setPositions(posRes.data);
    } catch (e) {
      console.warn('Wallet data fetch failed:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  return (
    <div className="wallet-panel">
      <h2 className="panel-title">
        <span className="panel-icon">\uD83D\uDCB0</span> Wallet
      </h2>

      <button
        className="btn btn-connect"
        onClick={() => showToast('WDK integration coming soon')}
      >
        <span className="btn-icon">\uD83D\uDD17</span>
        Connect Wallet
      </button>

      <div className="balances-section">
        <h3 className="section-title">Holdings</h3>
        {loading ? (
          <div className="loading-shimmer">Loading balances...</div>
        ) : balances ? (
          <div className="balance-list">
            {Object.entries(balances).map(([token, amount]) => {
              const meta = TOKEN_META[token] || { icon: '\uD83D\uDCB1', name: token, color: '#888' };
              return (
                <div key={token} className="balance-row">
                  <div className="balance-token">
                    <span className="token-icon" style={{ color: meta.color }}>
                      {meta.icon}
                    </span>
                    <div className="token-info">
                      <span className="token-symbol">{token}</span>
                      <span className="token-name">{meta.name}</span>
                    </div>
                  </div>
                  <div className="balance-amount">
                    <span className="amount-value">{amount}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">No wallet connected</div>
        )}
      </div>

      <div className="positions-section">
        <h3 className="section-title">Active Positions</h3>
        {positions.length > 0 ? (
          <div className="position-list">
            {positions.map((pos) => (
              <div key={pos.id} className="position-card">
                <div className="position-header">
                  <span className="position-protocol">{pos.protocol}</span>
                </div>
                <div className="position-details">
                  <div className="position-row">
                    <span className="label">Asset</span>
                    <span className="value">{pos.token || pos.pair}</span>
                  </div>
                  <div className="position-row">
                    <span className="label">Amount</span>
                    <span className="value">${pos.amount}</span>
                  </div>
                  <div className="position-row">
                    <span className="label">APY</span>
                    <span className="value accent">{pos.apy}</span>
                  </div>
                  <div className="position-row">
                    <span className="label">Earned</span>
                    <span className="value earned">+${pos.earned}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">No active positions</div>
        )}
      </div>

      {toastMsg && (
        <div className="toast">
          <span className="toast-icon">\u2139\uFE0F</span>
          {toastMsg}
        </div>
      )}
    </div>
  );
}
