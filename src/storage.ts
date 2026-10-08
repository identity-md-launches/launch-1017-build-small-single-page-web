export type Run = { id: number; height: number; perfects: number };
export type Records = { best: number; total: number; runs: Run[] };
export const STORAGE_KEY = 'skyline.blueprint.v1';
export const emptyRecords = (): Records => ({ best: 0, total: 0, runs: [] });
const integer = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

export function parseRecords(raw: string | null): Records {
  try {
    const value = JSON.parse(raw ?? 'null');
    if (!value || !integer(value.best) || !integer(value.total) || !Array.isArray(value.runs)) return emptyRecords();
    const runs: Run[] = value.runs.filter((r: Run) => r && integer(r.id) && r.id > 0 && integer(r.height) && integer(r.perfects) && r.perfects <= r.height)
      .sort((a: Run, b: Run) => b.height - a.height || b.perfects - a.perfects || b.id - a.id).slice(0, 5);
    return { best: Math.max(value.best, ...runs.map(r => r.height)), total: Math.max(value.total, ...runs.map(r => r.id)), runs };
  } catch { return emptyRecords(); }
}

export function finishRun(records: Records, height: number, perfects: number): Records {
  const run = { id: records.total + 1, height, perfects };
  return { best: Math.max(records.best, height), total: run.id,
    runs: [...records.runs, run].sort((a, b) => b.height - a.height || b.perfects - a.perfects || b.id - a.id).slice(0, 5) };
}
