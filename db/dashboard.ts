import { env } from "cloudflare:workers";

export type DashboardPeriod = 7 | 30 | 90;

type SummaryRow = { total_events: number; searches: number; zero_results: number; opens: number; downloads: number; copies: number };
type DailyRow = { day: string; searches: number; opens: number; actions: number };
type AssetRow = { asset_id: string; asset_name: string | null; section: string | null; interactions: number; downloads: number };
type QueryRow = { query: string; attempts: number; last_seen: string };

export type DashboardData = { summary: SummaryRow; daily: DailyRow[]; topAssets: AssetRow[]; zeroQueries: QueryRow[] };

const emptySummary: SummaryRow = { total_events: 0, searches: 0, zero_results: 0, opens: 0, downloads: 0, copies: 0 };

export async function getDashboardData(period: DashboardPeriod): Promise<DashboardData> {
  if (!env.DB) throw new Error("D1 binding DB is unavailable");
  const modifier = `-${period - 1} days`;
  const filter = "day >= date('now', ?)";

  const [summaryResult, dailyResult, assetsResult, queriesResult] = await env.DB.batch([
    env.DB.prepare(`
      SELECT COUNT(*) AS total_events,
        SUM(CASE WHEN event_name IN ('search', 'zero_result') THEN 1 ELSE 0 END) AS searches,
        SUM(CASE WHEN event_name = 'zero_result' THEN 1 ELSE 0 END) AS zero_results,
        SUM(CASE WHEN event_name IN ('icon_open', 'logo_open') THEN 1 ELSE 0 END) AS opens,
        SUM(CASE WHEN event_name IN ('download_svg', 'download_png', 'logo_download') THEN 1 ELSE 0 END) AS downloads,
        SUM(CASE WHEN event_name IN ('copy_svg', 'copy_link') THEN 1 ELSE 0 END) AS copies
      FROM analytics_events WHERE ${filter}
    `).bind(modifier),
    env.DB.prepare(`
      SELECT day,
        SUM(CASE WHEN event_name IN ('search', 'zero_result') THEN 1 ELSE 0 END) AS searches,
        SUM(CASE WHEN event_name IN ('icon_open', 'logo_open') THEN 1 ELSE 0 END) AS opens,
        SUM(CASE WHEN event_name IN ('download_svg', 'download_png', 'logo_download', 'copy_svg', 'copy_link') THEN 1 ELSE 0 END) AS actions
      FROM analytics_events WHERE ${filter}
      GROUP BY day ORDER BY day ASC
    `).bind(modifier),
    env.DB.prepare(`
      SELECT asset_id, MAX(asset_name) AS asset_name, MAX(section) AS section,
        COUNT(*) AS interactions,
        SUM(CASE WHEN event_name IN ('download_svg', 'download_png', 'logo_download') THEN 1 ELSE 0 END) AS downloads
      FROM analytics_events
      WHERE ${filter} AND asset_id IS NOT NULL
      GROUP BY asset_id ORDER BY interactions DESC, asset_id ASC LIMIT 8
    `).bind(modifier),
    env.DB.prepare(`
      SELECT query, COUNT(*) AS attempts, MAX(day) AS last_seen
      FROM analytics_events
      WHERE ${filter} AND event_name = 'zero_result' AND query IS NOT NULL
      GROUP BY query ORDER BY attempts DESC, last_seen DESC LIMIT 10
    `).bind(modifier),
  ]);

  return {
    summary: (summaryResult.results[0] as SummaryRow | undefined) ?? emptySummary,
    daily: dailyResult.results as DailyRow[],
    topAssets: assetsResult.results as AssetRow[],
    zeroQueries: queriesResult.results as QueryRow[],
  };
}
