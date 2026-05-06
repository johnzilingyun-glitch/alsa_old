import type { MarketOverview } from '../types';
import { useUIStore } from '../stores/useUIStore';
import { db } from '../firebase';
import { collection, getDocs, doc, setDoc, query, orderBy, limit, where } from 'firebase/firestore';

export async function getOptimizationLogs(): Promise<any[]> {
  try {
    const response = await fetch(`/api/logs/optimization?t=${Date.now()}`);
    if (response.ok) {
      const contentType = response.headers?.get('content-type');
      if (contentType && contentType.includes('text/html')) {
        return [];
      }
      return await response.json().catch(() => []);
    }
  } catch (err) {
    // Ignore fetch errors
  }
  return [];
}

export async function getHistoryContext(): Promise<any[]> {
  try {
    const q = query(
      collection(db, 'history'),
      orderBy('generatedAt', 'desc'),
      limit(100)
    );
    const querySnapshot = await getDocs(q);
    const history: any[] = [];
    querySnapshot.forEach((docSnap) => {
      try {
        const dataStr = docSnap.data().dataStr;
        if (dataStr) {
          history.push(JSON.parse(dataStr));
        }
      } catch (e) {}
    });
    return history;
  } catch (err: any) {
    console.warn('Failed to fetch history from Firestore:', err);
  }
  return [];
}

export async function getMarketHistoryByDate(date: string, market: string): Promise<MarketOverview | null> {
  try {
    const q = query(
      collection(db, 'history'), 
      orderBy('generatedAt', 'desc'),
      limit(200)
    );
    const snap = await getDocs(q);
    const docs = snap.docs.map(d => JSON.parse(d.data().dataStr));

    for (const parsed of docs) {
      if (parsed.type !== 'market') continue;
      if (parsed.market && parsed.market.toLowerCase() !== market.toLowerCase()) continue;
      
      const genDate = new Date(parsed.generatedAt);
      if (!isNaN(genDate.getTime())) {
        const beijingDate = genDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' });
        if (beijingDate === date) return parsed;
      }
    }
  } catch (err) {
    console.warn('Failed to fetch market history by date:', err);
  }
  return null;
}

export async function getAvailableMarketDates(market: string): Promise<string[]> {
  try {
    const q = query(collection(db, 'history'), orderBy('generatedAt', 'desc'), limit(500));
    const snap = await getDocs(q);
    const dates = new Set<string>();
    const docs = snap.docs.map(d => JSON.parse(d.data().dataStr));

    docs.forEach((parsed) => {
      try {
        if (parsed.type !== 'market') return;
        if (parsed.market && parsed.market.toLowerCase() !== market.toLowerCase()) return;
        const genDate = new Date(parsed.generatedAt);
        if (!isNaN(genDate.getTime())) {
          dates.add(genDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' }));
        }
      } catch {}
    });
    return [...dates];
  } catch (err) {
    console.warn('Failed to fetch available market dates:', err);
    return [];
  }
}

export async function getPreviousStockAnalysis(symbol: string): Promise<any | null> {
  try {
    const history = await getHistoryContext();
    const previous = history
      .filter((item: any) => {
        const isStock = item.type === 'stock' || (item.stockInfo && !item.indices);
        if (!isStock) return false;
        const sym = item.stockInfo?.symbol;
        return sym === symbol;
      })
      .sort((a: any, b: any) => {
        const timeA = new Date(a.generatedAt || a.stockInfo?.lastUpdated || 0).getTime();
        const timeB = new Date(b.generatedAt || b.stockInfo?.lastUpdated || 0).getTime();
        return timeB - timeA;
      });

    return previous.length > 0 ? previous[0] : null;
  } catch (err) {
    console.warn('Failed to get previous stock analysis:', err);
    return null;
  }
}

export async function saveAnalysisToHistory(type: 'market' | 'stock', data: any) {
  try {
    const now = Date.now();
    const id = data.id || `${type}-${now}-${Math.random().toString(36).substr(2, 9)}`;
    const dataToSave = { 
      ...data, 
      id, 
      type,
      generatedAt: data.generatedAt || now 
    };
    
    const dataStr = JSON.stringify(dataToSave);
    if (dataStr.length > 1000000) {
      console.warn('History data exceeds 1MB limit. Pruning discussion history.');
      dataToSave.discussion = undefined;
      dataToSave.messages = undefined;
      // Optional: keep last N messages or just remove it
    }
    
    const finalStr = JSON.stringify(dataToSave);

    await setDoc(doc(db, 'history', id), {
      id,
      type,
      generatedAt: dataToSave.generatedAt,
      dataStr: finalStr
    });
    console.log(`Saved history item ${id} successfully. Size: ${finalStr.length} chars.`);
  } catch (err) {
    console.warn('Failed to save analysis to history:', err);
  }
}


export async function logOptimization(field: string, oldValue: any, newValue: any, description: string) {
  try {
    await fetch('/api/logs/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field, oldValue, newValue, description })
    });
  } catch (err) {
    console.warn('Failed to log optimization:', err);
  }
}
