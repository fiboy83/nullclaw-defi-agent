/**
 * ThemeProvider - Sentiment-driven dynamic theming
 * Sets CSS custom properties on <html> based on Fear & Greed Index
 * Smooth 1.5s transitions between mood shifts
 */
import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { useSentiment } from '../hooks/useSentiment.js';

const THEMES = {
  fear: {
    '--bg-primary': '#1a0a0a',
    '--bg-secondary': '#120505',
    '--surface': '#2a1010',
    '--surface-hover': '#3a1515',
    '--accent': '#ff2d2d',
    '--accent-dim': 'rgba(255, 45, 45, 0.15)',
    '--text': '#ff8a8a',
    '--text-secondary': '#cc6666',
    '--glow': 'rgba(255, 45, 45, 0.3)',
    '--border': 'rgba(255, 45, 45, 0.15)',
  },
  cautious: {
    '--bg-primary': '#0a0a1a',
    '--bg-secondary': '#080815',
    '--surface': '#1a1530',
    '--surface-hover': '#252040',
    '--accent': '#ffaa00',
    '--accent-dim': 'rgba(255, 170, 0, 0.15)',
    '--text': '#ffd480',
    '--text-secondary': '#ccaa66',
    '--glow': 'rgba(255, 170, 0, 0.3)',
    '--border': 'rgba(255, 170, 0, 0.15)',
  },
  neutral: {
    '--bg-primary': '#0a1628',
    '--bg-secondary': '#081220',
    '--surface': '#112240',
    '--surface-hover': '#162d55',
    '--accent': '#0098D9',
    '--accent-dim': 'rgba(0, 152, 217, 0.15)',
    '--text': '#e0f0ff',
    '--text-secondary': '#99bbdd',
    '--glow': 'rgba(0, 152, 217, 0.3)',
    '--border': 'rgba(0, 152, 217, 0.15)',
  },
  greed: {
    '--bg-primary': '#0a1a0a',
    '--bg-secondary': '#051205',
    '--surface': '#102a10',
    '--surface-hover': '#153a15',
    '--accent': '#39FF14',
    '--accent-dim': 'rgba(57, 255, 20, 0.15)',
    '--text': '#a0ffa0',
    '--text-secondary': '#77cc77',
    '--glow': 'rgba(57, 255, 20, 0.3)',
    '--border': 'rgba(57, 255, 20, 0.15)',
  },
  'extreme-greed': {
    '--bg-primary': '#1a1500',
    '--bg-secondary': '#151100',
    '--surface': '#2a2510',
    '--surface-hover': '#3a3518',
    '--accent': '#FFD700',
    '--accent-dim': 'rgba(255, 215, 0, 0.15)',
    '--text': '#ffe680',
    '--text-secondary': '#ccbb66',
    '--glow': 'rgba(255, 215, 0, 0.3)',
    '--border': 'rgba(255, 215, 0, 0.15)',
  },
};

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const sentiment = useSentiment();

  const theme = useMemo(
    () => THEMES[sentiment.theme] || THEMES.neutral,
    [sentiment.theme]
  );

  useEffect(() => {
    const root = document.documentElement;
    root.style.transition = 'all 1.5s ease';
    Object.entries(theme).forEach(([prop, value]) => {
      root.style.setProperty(prop, value);
    });
  }, [theme]);

  const contextValue = useMemo(
    () => ({
      sentiment,
      themeName: sentiment.theme,
      themeVars: theme,
    }),
    [sentiment, theme]
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
