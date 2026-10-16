import { env } from "cloudflare:workers";

export type AnalyticsEvent = {
  eventName: string;
  section: string | null;
  query: string | null;
  resultCount: number | null;
  assetId: string | null;
  assetName: string | null;
  variant: string | null;
  color: string | null;
};

export async function recordAnalyticsEvent(event: AnalyticsEvent) {
  if (!env.DB) throw new Error("D1 binding DB is unavailable");
  await env.DB.prepare(`
    INSERT INTO analytics_events
      (event_name, section, query, result_count, asset_id, asset_name, variant, color)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    event.eventName,
    event.section,
    event.query,
    event.resultCount,
    event.assetId,
    event.assetName,
    event.variant,
    event.color,
  ).run();
}
