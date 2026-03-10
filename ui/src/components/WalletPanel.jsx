import { useState, useEffect } from 'react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function WalletPanel() {
  const [activeChain, setActiveChain] = useState('all');
  const [portfolio, setPortfolio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sendForm, setSendForm] = useState({ chain: 'evm', to: '', amount: '', token: 'ETH' });
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchPortfolio();
    const interval = setInterval(fetchPortfolio, 30000);
    return () => clearInterval(interval);
  }, []);

  async function fetchPortfolio() {
    try {
      const res = await fetch(`${API}/api/wallet/portfolio`);
      const data = await res.json();
      if (data.success) setPortfolio(data.data);
      else setError(data.error);
    } catch (e) {
      setError('Cannot connect to sidecar');
    } finally {
      setLoading(false);
    }
  }

  async function handleSend(e) {
    e.preventDefault();
    setSending(true);
    try {
      const res = await fetch(`${API}/api/wallet/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sendForm),
      });
      const data = await res.json();
      if (data.success) {
        alert(`Sent! TX: ${data.txHash}`);
        fetchPortfolio();
      } else {
        alert(`Failed: ${data.error}`);
      }
    } catch (e) {
      alert(`Error: ${e.message}`);
    } finally {
      setSending(false);
    }
  }

  if (loading) return <div className="panel wallet-panel"><h3>Wallet</h3><p className="loading">Connecting to WDK...</p></div>;
  if (error) return <div className="panel wallet-panel"><h3>Wallet</h3><p className="error">{error}</p></div>;

  const chains = portfolio?.chains || {};
  const totalTokens = portfolio?.totalTokens || {};

  return (
    <div className="panel wallet-panel">
      <h3>Multi-Chain Wallet</h3>

      {/* Chain tabs */}
      <div className="chain-tabs">
        {['all', 'evm', 'solana'].map((tab) => (
          <button
            key={tab}
            className={`chain-tab ${activeChain === tab ? 'active' : ''}`}
            onClick={() => setActiveChain(tab)}
          >
            {tab === 'all' ? 'All Chains' : tab === 'evm' ? 'EVM (Sepolia)' : 'Solana (Devnet)'}
          </button>
        ))}
      </div>

      {/* Balances */}
      <div className="balances-section">
        {activeChain === 'all' ? (
          <>
            <h4>Cross-Chain Portfolio</h4>
            <div className="token-grid">
              {Object.entries(totalTokens).map(([token, info]) => (
                <div key={token} className="token-card">
                  <span className="token-symbol">{token}</span>
                  <span className="token-amount">{Number(info.total).toFixed(6)}</span>
                  <span className="token-chains">
                    {Object.entries(info.chains)
                      .filter(([, a]) => a > 0)
                      .map(([c]) => c)
                      .join(', ')}
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="chain-info">
              <span className={`chain-status ${chains[activeChain]?.status === 'active' ? 'active' : 'error'}`}>
                {chains[activeChain]?.status || 'unknown'}
              </span>
              <code className="chain-address">{chains[activeChain]?.address || 'N/A'}</code>
            </div>
            <div className="token-grid">
              {chains[activeChain]?.balances &&
                Object.entries(chains[activeChain].balances).map(([token, amount]) => (
                  <div key={token} className="token-card">
                    <span className="token-symbol">{token}</span>
                    <span className="token-amount">{amount}</span>
                  </div>
                ))}
            </div>
          </>
        )}
      </div>

      {/* Send form */}
      <details className="send-section">
        <summary>Send Tokens</summary>
        <form onSubmit={handleSend} className="send-form">
          <select value={sendForm.chain} onChange={(e) => setSendForm({ ...sendForm, chain: e.target.value })}>
            <option value="evm">EVM (Sepolia)</option>
            <option value="solana">Solana (Devnet)</option>
          </select>
          <input
            type="text"
            placeholder="Recipient address"
            value={sendForm.to}
            onChange={(e) => setSendForm({ ...sendForm, to: e.target.value })}
            required
          />
          <input
            type="text"
            placeholder="Amount"
            value={sendForm.amount}
            onChange={(e) => setSendForm({ ...sendForm, amount: e.target.value })}
            required
          />
          <input
            type="text"
            placeholder="Token (ETH, SOL, USDT...)"
            value={sendForm.token}
            onChange={(e) => setSendForm({ ...sendForm, token: e.target.value })}
          />
          <button type="submit" disabled={sending}>{sending ? 'Sending...' : 'Send'}</button>
        </form>
      </details>

      {/* Protocol status */}
      {portfolio?.protocols && (
        <div className="protocol-status">
          <h4>Protocols</h4>
          {Object.entries(portfolio.protocols).map(([chain, status]) => (
            <div key={chain} className="protocol-row">
              <span>{chain}:</span>
              {Object.entries(status).map(([proto, active]) => (
                <span key={proto} className={`proto-badge ${active ? 'active' : ''}`}>
                  {proto}
                </span>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
