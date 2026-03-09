/**
 * AgentFeed - Real-time activity log from NullClaw agent
 * Scrollable feed showing agent decisions, analysis, and actions
 */
import React, { useState, useEffect, useRef } from 'react';
import { useWebSocket } from '../hooks/useWebSocket.js';

const ACTION_ICONS = {
  system: '\uD83D\uDD0C',
  market_update: '\uD83D\uDCCA',
  agent_action: '\uD83E\uDD16',
  swap: '\uD83D\uDD04',
  lend: '\uD83C\uDFE6',
  send: '\uD83D\uDCE4',
  analysis: '\uD83E\uDDE0',
  alert: '\u26A0\uFE0F',
};

function formatTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '--:--:--';
  }
}

const DEMO_ENTRIES = [
  { type: 'system', message: 'NullClaw DeFi Agent initialized', timestamp: new Date().toISOString(), _id: 'demo-1' },
  { type: 'agent_action', action: 'analysis', message: 'Scanning market conditions...', timestamp: new Date().toISOString(), _id: 'demo-2' },
  { type: 'agent_action', action: 'analysis', message: 'Portfolio allocation: 60% USDT, 25% ETH, 15% XAUT', timestamp: new Date().toISOString(), _id: 'demo-3' },
  { type: 'agent_action', action: 'analysis', message: 'Risk assessment: Conservative stance due to market sentiment', timestamp: new Date().toISOString(), _id: 'demo-4' },
  { type: 'agent_action', action: 'analysis', message: 'Monitoring Velora LP yields at 12.5% APY', timestamp: new Date().toISOString(), _id: 'demo-5' },
  { type: 'agent_action', message: 'Recommendation: Maintain current positions. Risk/reward below threshold.', timestamp: new Date().toISOString(), _id: 'demo-6' },
];

export default function AgentFeed() {
  const { messages, isConnected } = useWebSocket();
  const feedRef = useRef(null);
  const [entries, setEntries] = useState(DEMO_ENTRIES);

  useEffect(() => {
    if (messages.length > 0) {
      setEntries(messages);
    }
  }, [messages]);

  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [entries]);

  return (
    <div className="agent-feed">
      <h2 className="panel-title">
        <span className="panel-icon">\uD83E\uDD16</span> Agent Feed
        <span className={`connection-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
          {isConnected ? 'LIVE' : 'OFFLINE'}
        </span>
      </h2>

      <div className="feed-scroll" ref={feedRef}>
        {entries.map((entry) => {
          const icon = ACTION_ICONS[entry.action] || ACTION_ICONS[entry.type] || '\u25CF';
          return (
            <div key={entry._id} className={`feed-entry feed-${entry.type}`}>
              <span className="feed-icon">{icon}</span>
              <div className="feed-content">
                <span className="feed-message">{entry.message}</span>
                <span className="feed-time">
                  {formatTime(entry.timestamp || entry._received)}
                </span>
              </div>
            </div>
          );
        })}

        <div className="feed-entry feed-thinking">
          <span className="feed-icon">\uD83E\uDD16</span>
          <div className="feed-content">
            <span className="thinking-dots">
              <span>.</span><span>.</span><span>.</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
