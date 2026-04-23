import { AnalysisRepository, AnalysisRunRecord } from '../domain/analysis/analysisSnapshot.js';
import { getTable, setTable } from '../db/client.js';

export function createAnalysisRepository(): AnalysisRepository {
  return {
    async save(record: AnalysisRunRecord) {
      const list = getTable('analysis_runs');
      const idx = list.findIndex((r: any) => r.analysis_id === record.analysisId);
      const row = {
        analysis_id: record.analysisId,
        kind: record.kind,
        symbol: record.symbol || null,
        market: record.market || null,
        status: record.status,
        prompt_version: record.promptVersion,
        model: record.model,
        input_snapshot_path: record.inputSnapshotPath || null,
        output_payload: JSON.stringify(record.outputPayload),
        created_at: record.createdAt || new Date().toISOString()
      };
      
      if (idx !== -1) {
        list[idx] = row;
      } else {
        list.push(row);
      }
      setTable('analysis_runs', list);
    },

    async getById(analysisId: string) {
      const list = getTable('analysis_runs');
      const row = list.find((r: any) => r.analysis_id === analysisId);
      if (!row) return null;
      return mapRowToRecord(row);
    },

    async getLatestStockAnalysis(symbol: string, market: string) {
      const list = getTable('analysis_runs');
      const filtered = list.filter((r: any) => r.kind === 'stock' && r.symbol === symbol && r.market === market);
      filtered.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      if (filtered.length === 0) return null;
      return mapRowToRecord(filtered[0]);
    },

    async listRecent(options: { limit?: number; kind?: 'stock' | 'market' }) {
      const list = getTable('analysis_runs');
      let filtered = list;
      
      if (options.kind) {
        filtered = filtered.filter((r: any) => r.kind === options.kind);
      }
      
      filtered.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      if (options.limit) {
        filtered = filtered.slice(0, options.limit);
      }

      return filtered.map(mapRowToRecord);
    }
  };
}

function mapRowToRecord(row: any): AnalysisRunRecord {
  return {
    analysisId: row.analysis_id,
    kind: row.kind,
    symbol: row.symbol,
    market: row.market,
    status: row.status,
    promptVersion: row.prompt_version,
    model: row.model,
    inputSnapshotPath: row.input_snapshot_path,
    outputPayload: row.output_payload ? JSON.parse(row.output_payload) : {},
    createdAt: row.created_at
  };
}
