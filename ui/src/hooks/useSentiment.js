/**
 * Sentiment hook - polls Fear & Greed Index via sidecar
 * Also listens to WebSocket for real-time updates
 */
import { useState, useEffect, useCallback } from 'react';
import { useWebSocket } from './useWebSocket.js';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const POLL_INTERVAL = 30000;

const DEFAULT_SENTIMENT = {
  value: 50,
  classification: 'Neutral',
  theme: 'neutral',
};

export function useSentiment() {
  const [sentiment, setSentiment] = useState(DEFAULT_SENTIMENT);
  const { lastMessage } = useWebSocket();

  const fetchSentiment = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/market/sentiment`);
      if (!res.ok) throw new Error('Fetch failed');
      const json = await res.json();
      if (json.success && json.data) {
        setSentiment(json.data);
      }
    } catch (err) {
      console.warn('[Sentiment] Poll failed:', err.message);
    }
  }, []);

  // Poll on interval
  useEffect(() => {
    fetchSentiment();
    const interval = setInterval(fetchSentiment, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchSentiment]);

  // Update from WebSocket market_update messages
  useEffect(() => {
    if (lastMessage?.type === 'market_update' && lastMessage.data?.sentiment) {
      setSentiment(lastMessage.data.sentiment);
    }
  }, [lastMessage]);

  return sentiment;
}
