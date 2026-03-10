import { useState, useEffect } from 'react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function MarketPanel() {
  const [positions, setPositions] = useState(null);
  const [protocols, setProtocols] = useState(null);
  const [swapForm, setSwapForm] = useState({ fromToken: 'USDT', toToken: 'WETH', amount: '' });
  const [lendForm, setLendForm] = useState({ action: 'supply', token: 'USDT', amount: '' });
  const [quote, setQuote] = useState(null);
  const [executing, setExecuting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  async function fetchData() {
    try {
      const [posRes, protoRes] = await Promise.all([
        fetch(`${API}/api/defi/positions`).then((r) => r.json()),
        fetch(`${API}/api/defi/protocols`).then((r) => r.json()),
      ]);
      if (posRes.success) setPositions(posRes.data);
      if (protoRes.success) setProtocols(protoRes.data);
    } catch (e) {
      console.warn('DeFi data fetch failed:', e.message);
    } finally {
      setLoading(false);
    }
  }

  async function getQuote() {
    try {
      const { fromToken, toToken, amount } = swapForm;
      if (!amount) return;
      const res = await fetch(`${API}/api/defi/quote?fromToken=${fromToken}&toToken=${toToken}&amount=${amount}`);
      const data = await res.json();
      if (data.success) setQuote(data.data);
    } catch (e) {
      console.warn('Quote failed:', e.message);
    }
  }

  async function executeSwap() {
    setExecuting(true);
    try {
      const res = await fetch(`${API}/api/defi/swap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(swapForm),
      });
      const data = await res.json();
      if (data.success) alert(`Swap success! TX: ${data.txHash}`);
      else alert(`Swap failed: ${data.error}`);
    } catch (e) {
      alert(`Error: ${e.message}`);
    } finally {
      setExecuting(false);
    }
  }

  async function executeLend() {
    setExecuting(true);
    try {
      const res = await fetch(`${API}/api/defi/lend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lendForm),
      });
      const data = await res.json();
      if (data.success) {
        alert(`${lendForm.action} success! TX: ${data.txHash}`);
        fetchData();
      } else {
        alert(`${lendForm.action} failed: ${data.error}`);
      }
    } catch (e) {
      alert(`Error: ${e.message}`);
    } finally {
      setExecuting(false);
    }
  }

  if (loading) return <div className="panel market-panel"><h3>DeFi</h3><p className="loading">Loading protocols...</p></div>;

  return (
    <div className="panel market-panel">
      <h3>DeFi Operations</h3>

      {/* Protocol Status */}
      {protocols && (
        <div className="protocol-badges">
          {Object.entries(protocols).map(([name, active]) => (
            <span key={name} className={`proto-badge ${active ? 'active' : 'inactive'}`}>
              {name}: {active ? 'ON' : 'OFF'}
            </span>
          ))}
        </div>
      )}

      {/* Aave Positions */}
      {positions && !positions.error && (
        <div className="positions-section">
          <h4>Aave Positions</h4>
          <div className="positions-grid">
            <div className="pos-item">
              <span className="pos-label">Collateral</span>
              <span className="pos-value">{positions.totalCollateralBase || '0'}</span>
            </div>
            <div className="pos-item">
              <span className="pos-label">Debt</span>
              <span className="pos-value">{positions.totalDebtBase || '0'}</span>
            </div>
            <div className="pos-item">
              <span className="pos-label">Available Borrow</span>
              <span className="pos-value">{positions.availableBorrowsBase || '0'}</span>
            </div>
            <div className={`pos-item health-factor ${parseFloat(positions.healthFactor) < 1.5 ? 'warning' : ''}`}>
              <span className="pos-label">Health Factor</span>
              <span className="pos-value">{positions.healthFactor || 'N/A'}</span>
            </div>
          </div>
        </div>
      )}

      {/* Swap Section */}
      <details className="defi-section" open>
        <summary>Swap (Velora DEX)</summary>
        <div className="swap-form">
          <div className="swap-inputs">
            <select value={swapForm.fromToken} onChange={(e) => setSwapForm({ ...swapForm, fromToken: e.target.value })}>
              {['USDT', 'WETH', 'USDC', 'DAI'].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <span className="swap-arrow">-&gt;</span>
            <select value={swapForm.toToken} onChange={(e) => setSwapForm({ ...swapForm, toToken: e.target.value })}>
              {['WETH', 'USDT', 'USDC', 'DAI'].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <input
            type="text"
            placeholder="Amount"
            value={swapForm.amount}
            onChange={(e) => { setSwapForm({ ...swapForm, amount: e.target.value }); setQuote(null); }}
          />
          <div className="swap-actions">
            <button onClick={getQuote} disabled={!swapForm.amount}>Get Quote</button>
            <button onClick={executeSwap} disabled={executing || !swapForm.amount} className="btn-confirm">
              {executing ? 'Swapping...' : 'Execute Swap'}
            </button>
          </div>
          {quote && (
            <div className="quote-result">
              <p>{quote.amountIn} {quote.fromToken} = ~{quote.estimatedOut} {quote.toToken}</p>
              <p className="quote-fee">Est. fee: {quote.estimatedFee}</p>
            </div>
          )}
        </div>
      </details>

      {/* Lending Section */}
      <details className="defi-section">
        <summary>Lending (Aave V3)</summary>
        <div className="lend-form">
          <select value={lendForm.action} onChange={(e) => setLendForm({ ...lendForm, action: e.target.value })}>
            <option value="supply">Supply</option>
            <option value="withdraw">Withdraw</option>
            <option value="borrow">Borrow</option>
            <option value="repay">Repay</option>
          </select>
          <select value={lendForm.token} onChange={(e) => setLendForm({ ...lendForm, token: e.target.value })}>
            {['USDT', 'WETH', 'USDC', 'DAI'].map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input
            type="text"
            placeholder="Amount"
            value={lendForm.amount}
            onChange={(e) => setLendForm({ ...lendForm, amount: e.target.value })}
          />
          <button onClick={executeLend} disabled={executing || !lendForm.amount} className="btn-confirm">
            {executing ? 'Processing...' : `${lendForm.action.charAt(0).toUpperCase() + lendForm.action.slice(1)}`}
          </button>
        </div>
      </details>
    </div>
  );
}
