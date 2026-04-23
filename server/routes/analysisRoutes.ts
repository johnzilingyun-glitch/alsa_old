import { Router } from 'express';
import { createAnalysisRepository } from '../repositories/analysisRepository.js';
import { gatewayGenerate } from '../llmGateway.js';
import fs from 'fs/promises';
import path from 'path';

const router = Router();
const repo = createAnalysisRepository();

// In-memory job queue for Node
const jobs = new Map<string, any>();

async function runAnalysisJob(jobId: string, analysisId: string, symbol: string, market: string, model: string, promptVersion: string) {
  try {
    jobs.set(jobId, { status: 'running' });
    
    // Fetch directly from our own Node.js realtime route (which handles all fallbacks and Yahoo logic)
    const port = process.env.PORT || 3000;
    const res = await fetch(`http://127.0.0.1:${port}/api/stock/realtime?symbol=${encodeURIComponent(symbol)}&market=${encodeURIComponent(market)}`);
    if (!res.ok) throw new Error("Failed to fetch stock data");
    const stockData = await res.json();

    if (stockData.error) {
       throw new Error(stockData.error);
    }
    
    // Save snapshot (simulating data lake)
    const snapshotDir = path.join(process.cwd(), 'data', 'snapshots');
    await fs.mkdir(snapshotDir, { recursive: true });
    // Use a simplified schema for the snapshot path
    const snapshotPath = path.join(snapshotDir, `${jobId}.json`);
    await fs.writeFile(snapshotPath, JSON.stringify(stockData, null, 2));

    // Construct LLM Prompt
    const prompt = `Analyze this stock snapshot for ${symbol} (${market}):
Price: ${stockData.regularMarketPrice}
Change: ${stockData.regularMarketChangePercent}%
Indicators: ${JSON.stringify(stockData.indicators || {})}
Fundamentals: ${JSON.stringify(stockData.fundamentalScores || {})}

Please provide a highly structured JSON summary containing a comprehensive fundamental and technical analysis, including an investment thesis and overall sentiment. Keep the JSON payload very clear and easy to parse, matching standard quantitative report formats. Give specific values if available.`;

    const llmRes = await gatewayGenerate(prompt, model);
    
    const finalPayload = {
      snapshot_path: snapshotPath,
      stockInfo: stockData,
      analysis: llmRes.text,
      provider: llmRes.provider
    };

    const record = await repo.getById(analysisId);
    if (record) {
      await repo.save({
        ...record,
        status: 'completed',
        inputSnapshotPath: snapshotPath,
        outputPayload: finalPayload
      });
    }

    jobs.set(jobId, { status: 'completed', result: finalPayload });
  } catch (error: any) {
    console.error(`Analysis job ${jobId} failed:`, error);
    jobs.set(jobId, { status: 'failed', error: error.message });
    const record = await repo.getById(analysisId);
    if (record) {
      await repo.save({ ...record, status: 'failed' });
    }
  }
}

router.post('/analysis/jobs', async (req, res) => {
  const { symbol, market, model, promptVersion } = req.body;
  const analysisId = `ana_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

  try {
    await repo.save({
      analysisId,
      kind: 'stock',
      symbol,
      market,
      status: 'queued',
      promptVersion: promptVersion || 'v1',
      model: model || 'gemini-1.5-flash',
      outputPayload: {}
    });

    // Run background task asynchronously without blocking response
    runAnalysisJob(jobId, analysisId, symbol, market, model || 'gemini-1.5-flash', promptVersion).catch(err => {
      console.error("Background job failed entirely:", err);
    });

    res.status(202).json({
      analysisId,
      jobId,
      status: 'queued'
    });
  } catch (err: any) {
    console.error('Failed to create analysis job:', err);
    res.status(500).json({ error: 'Failed to create analysis job', details: err.message });
  }
});

router.get('/analysis/jobs/:analysisId/:jobId', async (req, res) => {
  const { analysisId, jobId } = req.params;

  try {
    const jobState = jobs.get(jobId);
    if (!jobState) {
       const record = await repo.getById(analysisId);
       if (record && record.status === 'completed') {
           return res.json({ analysisId, status: 'completed', result: record.outputPayload });
       }
       if (record && record.status === 'failed') {
           return res.json({ analysisId, status: 'failed', error: 'Internal failure' });
       }
       return res.status(404).json({ error: 'Job not found' });
    }

    if (jobState.status === 'completed') {
      return res.json({
        analysisId,
        status: 'completed',
        result: jobState.result
      });
    }

    if (jobState.status === 'failed') {
      return res.json({ analysisId, status: 'failed', error: jobState.error });
    }

    res.json({
      analysisId,
      status: jobState.status
    });
  } catch (err: any) {
    console.error('Failed to poll analysis job:', err);
    res.status(500).json({ error: 'Failed to poll analysis job' });
  }
});

router.get('/history/recent', async (req, res) => {
  const limit: number = parseInt((req.query as any).limit) || 20;
  const history = await repo.listRecent({ limit });
  res.json(history);
});

export default router;
