import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const analyticsEvents = sqliteTable("analytics_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  day: text("day").notNull().default(sql`(date('now'))`),
  eventName: text("event_name").notNull(),
  section: text("section"),
  query: text("query"),
  resultCount: integer("result_count"),
  assetId: text("asset_id"),
  assetName: text("asset_name"),
  variant: text("variant"),
  color: text("color"),
}, (table) => [
  index("idx_analytics_events_day_event").on(table.day, table.eventName),
  index("idx_analytics_events_zero_query").on(table.query).where(sql`${table.eventName} = 'zero_result'`),
]);
