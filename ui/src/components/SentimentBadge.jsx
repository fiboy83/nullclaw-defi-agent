/**
 * SentimentBadge - Displays current market mood in header
 * Pulses and glows based on sentiment level
 */
import React from 'react';

export default function SentimentBadge({ value, classification }) {
  const label = classification || 'Loading';

  return (
    <div className={`sentiment-badge badge pulse`} title={`Fear & Greed: ${value}`}>
      <span className="badge-value">{value ?? '--'}</span>
      <span className="badge-label">{label}</span>
    </div>
  );
}
