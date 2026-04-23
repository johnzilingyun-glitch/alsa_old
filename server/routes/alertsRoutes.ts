import { Router } from 'express';
import { getTable, setTable } from '../db/client.js';

const router = Router();

router.get('/alerts/', async (req, res) => {
  try {
    const list = getTable('alerts');
    list.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/alerts/', async (req, res) => {
  try {
    const list = getTable('alerts');
    const newId = list.length > 0 ? Math.max(...list.map((i: any) => i.id || 0)) + 1 : 1;
    list.push({
      id: newId,
      ...req.body,
      status: 'active',
      created_at: new Date().toISOString()
    });
    setTable('alerts', list);
    res.json({ success: true, id: newId });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/alerts/:id', async (req, res) => {
  try {
    let list = getTable('alerts');
    list = list.filter((i: any) => i.id !== Number(req.params.id));
    setTable('alerts', list);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
