import { Router } from 'express';
import { getTable, setTable } from '../db/client.js';

const router = Router();

router.get('/watchlist', async (req, res) => {
  try {
    const list = getTable('watchlist');
    const items = list.sort((a: any, b: any) => new Date(b.added_at).getTime() - new Date(a.added_at).getTime());
    res.json({ items });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/watchlist', async (req, res) => {
  const { symbol, name, market } = req.body;
  try {
    const list = getTable('watchlist');
    const exists = list.find((i: any) => i.symbol === symbol && i.market === market);
    if (!exists) {
      list.push({ symbol, name, market, added_at: new Date().toISOString() });
      setTable('watchlist', list);
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/watchlist/:symbol', async (req, res) => {
  const { symbol } = req.params;
  const { market } = req.query;
  try {
    let list = getTable('watchlist');
    if (market) {
      list = list.filter((i: any) => !(i.symbol === symbol && i.market === market as string));
    } else {
      list = list.filter((i: any) => i.symbol !== symbol);
    }
    setTable('watchlist', list);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
