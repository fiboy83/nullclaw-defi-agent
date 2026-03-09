/**
 * Market Routes - Price data and sentiment analysis
 * Fetches live data from CoinGecko + Alternative.me Fear & Greed Index
 * Falls back to mock data on API errors
 */
import { Router } from 'express';

const router = Router();

const MOCK_PRICES = {
  bitcoin: { usd: 67250.00, usd_24h_change: -2.4 },
  ethereum: { usd: 3420.50, usd_24h_change: -1.8 },
  'tether-gold': { usd: 2645.00, usd_24h_change: 0.3 },
};

const MOCK_SENTIMENT = {
  value: 25,
  value_classification: 'Extreme Fear',
};

function getTheme(value) {
  if (value <= 25) return 'fear';
  if (value <= 45) return 'cautious';
  if (value <= 55) return 'neutral';
  if (value <= 75) return 'greed';
  return 'extreme-greed';
}

router.get('/prices', async (_req, res) => {
  try {
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,tether-gold&vs_currencies=usd&include_24hr_change=true'
    );
    if (!response.ok) throw new Error(`CoinGecko API error: ${response.status}`);
    const data = await response.json();
    res.json({ success: true, data, source: 'coingecko', timestamp: new Date().toISOString() });
  } catch (err) {
    console.warn('CoinGecko fetch failed, using mock data:', err.message);
    res.json({ success: true, data: MOCK_PRICES, source: 'mock', timestamp: new Date().toISOString() });
  }
});

router.get('/sentiment', async (_req, res) => {
  try {
    const response = await fetch('https://api.alternative.me/fng/?limit=1');
    if (!response.ok) throw new Error(`F&G API error: ${response.status}`);
    const json = await response.json();
    const entry = json.data?.[0];
    if (!entry) throw new Error('No sentiment data returned');
    const value = parseInt(entry.value, 10);
    const classification = entry.value_classification;
    const theme = getTheme(value);
    res.json({
      success: true,
      data: { value, classification, theme },
      source: 'alternative.me',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Sentiment fetch failed, using mock data:', err.message);
    const value = MOCK_SENTIMENT.value;
    res.json({
      success: true,
      data: { value, classification: MOCK_SENTIMENT.value_classification, theme: getTheme(value) },
      source: 'mock',
      timestamp: new Date().toISOString(),
    });
  }
});

router.get('/summary', async (req, res) => {
  try {
    const [pricesRes, sentimentRes] = await Promise.all([
      fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,tether-gold&vs_currencies=usd&include_24hr_change=true')
        .then(r => r.ok ? r.json() : Promise.reject(new Error('CoinGecko error')))
        .catch(() => MOCK_PRICES),
      fetch('https://api.alternative.me/fng/?limit=1')
        .then(r => r.ok ? r.json() : Promise.reject(new Error('F&G error')))
        .then(json => {
          const entry = json.data?.[0];
          return entry
            ? { value: parseInt(entry.value, 10), classification: entry.value_classification }
            : MOCK_SENTIMENT;
        })
        .catch(() => MOCK_SENTIMENT),
    ]);

    const theme = getTheme(sentimentRes.value);

    req.app.locals.broadcast({
      type: 'market_update',
      data: {
        prices: pricesRes,
        sentiment: { ...sentimentRes, theme },
      },
      timestamp: new Date().toISOString(),
    });

    res.json({
      success: true,
      data: {
        prices: pricesRes,
        sentiment: { ...sentimentRes, theme },
        theme,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
