import { Router } from 'express';
import { getTable, setTable } from '../db/client.js';

const router = Router();

router.post('/journal', async (req, res) => {
  const { symbol, market, action, price_at_decision, confidence, reasoning, analysis_id } = req.body;
  try {
    const list = getTable('decision_journal');
    const newId = list.length > 0 ? Math.max(...list.map((i: any) => i.id || 0)) + 1 : 1;
    list.push({
      id: newId,
      symbol, 
      market, 
      action, 
      price_at_decision, 
      confidence, 
      reasoning, 
      analysis_id: analysis_id || null,
      created_at: new Date().toISOString()
    });
    setTable('decision_journal', list);
    
    res.json({ success: true, id: newId });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/journal', async (req, res) => {
  try {
    const list = getTable('decision_journal');
    list.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    res.json({ items: list.slice(0, 50) });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
