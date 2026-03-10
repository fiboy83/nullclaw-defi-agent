import { useState, useEffect, useRef } from 'react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';

const PRIORITY_COLORS = {
  critical: '#ff4444',
  high: '#ff8800',
  medium: '#ffcc00',
  low: '#44cc44',
};

const TYPE_ICONS = {
  'rebalance': '[R]',
  'yield-optimize': '[Y]',
  'risk-alert': '[!]',
  'swap-opportunity': '[S]',
  'bridge-suggestion': '[B]',
};

export default function AgentFeed() {
  const [decisions, setDecisions] = useState([]);
  const [pending, setPending] = useState([]);
  const [history, setHistory] = useState([]);
  const [confirming, setConfirming] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const wsRef = useRef(null);

  useEffect(() => {
    fetchPending();
    fetchHistory();
    connectWs();
    return () => wsRef.current?.close();
  }, []);

  function connectWs() {
    try {
      const ws = new WebSocket(WS_URL);
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.event === 'agent:decisions') {
          const newDecisions = msg.data?.decisions || [];
          setDecisions((prev) => [...newDecisions, ...prev].slice(0, 50));
          setPending((prev) => [...newDecisions.filter((d) => d.status === 'pending_confirmation'), ...prev]);
        }
        if (msg.event === 'agent:executed' || msg.event === 'agent:rejected') {
          fetchPending();
          fetchHistory();
        }
      };
      ws.onclose = () => setTimeout(connectWs, 3000);
      wsRef.current = ws;
    } catch (e) {
      console.warn('WebSocket connection failed');
    }
  }

  async function fetchPending() {
    try {
      const res = await fetch(`${API}/api/agent/pending`);
      const data = await res.json();
      if (data.success) setPending(data.data);
    } catch (e) { /* silent */ }
  }

  async function fetchHistory() {
    try {
      const res = await fetch(`${API}/api/agent/history?limit=20`);
      const data = await res.json();
      if (data.success) setHistory(data.data);
    } catch (e) { /* silent */ }
  }

  async function triggerAnalysis() {
    setAnalyzing(true);
    try {
      const res = await fetch(`${API}/api/agent/analyze`, { method: 'POST' });
      const data = await res.json();
      if (data.success && data.data?.decisions) {
        setDecisions((prev) => [...data.data.decisions, ...prev].slice(0, 50));
      }
      fetchPending();
    } catch (e) {
      console.error('Analysis failed:', e);
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleConfirm(id) {
    setConfirming(id);
    try {
      const res = await fetch(`${API}/api/agent/confirm/${id}`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        fetchPending();
        fetchHistory();
      } else {
        alert(`Execution failed: ${data.error}`);
      }
    } catch (e) {
      alert(`Error: ${e.message}`);
    } finally {
      setConfirming(null);
    }
  }

  async function handleReject(id) {
    try {
      await fetch(`${API}/api/agent/reject/${id}`, { method: 'POST' });
      fetchPending();
      fetchHistory();
    } catch (e) {
      console.error('Reject failed:', e);
    }
  }

  return (
    <div className="panel agent-feed">
      <div className="agent-header">
        <h3>NullClaw Brain</h3>
        <button className="analyze-btn" onClick={triggerAnalysis} disabled={analyzing}>
          {analyzing ? 'Analyzing...' : 'Analyze Now'}
        </button>
      </div>

      {/* Pending Decisions - Confirmation Required */}
      {pending.length > 0 && (
        <div className="pending-section">
          <h4>Pending Confirmation ({pending.length})</h4>
          {pending.map((d) => (
            <div key={d.id} className="decision-card pending" style={{ borderLeftColor: PRIORITY_COLORS[d.priority] }}>
              <div className="decision-header">
                <span className="decision-type">{TYPE_ICONS[d.type] || '[?]'} {d.type}</span>
                <span className="decision-priority" style={{ color: PRIORITY_COLORS[d.priority] }}>
                  {d.priority}
                </span>
              </div>
              <h5>{d.title}</h5>
              <p className="decision-reasoning">{d.reasoning}</p>
              {d.action && d.action.method !== 'none' && (
                <div className="decision-action">
                  <code>{d.action.method}: {JSON.stringify(d.action.params)}</code>
                </div>
              )}
              <p className="decision-impact">{d.estimatedImpact}</p>
              <div className="decision-buttons">
                <button
                  className="btn-confirm"
                  onClick={() => handleConfirm(d.id)}
                  disabled={confirming === d.id}
                >
                  {confirming === d.id ? 'Executing...' : 'Confirm & Execute'}
                </button>
                <button className="btn-reject" onClick={() => handleReject(d.id)}>Reject</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Decision History */}
      <div className="history-section">
        <h4>Decision History</h4>
        {history.length === 0 ? (
          <p className="empty-state">No decisions yet. Click "Analyze Now" to start the agent brain.</p>
        ) : (
          history.map((d) => (
            <div
              key={d.id}
              className={`decision-card ${d.status}`}
              style={{ borderLeftColor: PRIORITY_COLORS[d.priority] }}
            >
              <div className="decision-header">
                <span className="decision-type">{TYPE_ICONS[d.type] || '[?]'} {d.type}</span>
                <span className={`decision-status status-${d.status}`}>{d.status}</span>
                <span className="decision-time">{new Date(d.timestamp).toLocaleTimeString()}</span>
              </div>
              <h5>{d.title}</h5>
              <p className="decision-reasoning">{d.reasoning}</p>
              {d.result?.txHash && (
                <p className="decision-tx">TX: <code>{d.result.txHash}</code></p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
