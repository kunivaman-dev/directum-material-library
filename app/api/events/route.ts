import { recordAnalyticsEvent, type AnalyticsEvent } from "../../../db/analytics";

const allowedEvents = new Set([
  "search",
  "zero_result",
  "icon_open",
  "logo_open",
  "download_svg",
  "download_png",
  "logo_download",
  "copy_svg",
  "copy_link",
  "figma_open",
]);

function shortText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) || null : null;
}

export async function POST(request: Request) {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && !["same-origin", "same-site", "none"].includes(fetchSite)) {
    return new Response(null, { status: 403 });
  }
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return new Response(null, { status: 415 });
  }
  const length = Number(request.headers.get("content-length") || 0);
  if (length > 2048) return new Response(null, { status: 413 });

  let input: Record<string, unknown>;
  try {
    input = await request.json();
  } catch {
    return new Response(null, { status: 400 });
  }

  const eventName = shortText(input.event, 40);
  if (!eventName || !allowedEvents.has(eventName)) return new Response(null, { status: 400 });

  const resultCount = Number.isInteger(input.resultCount) && Number(input.resultCount) >= 0
    ? Math.min(Number(input.resultCount), 10000)
    : null;
  const event: AnalyticsEvent = {
    eventName,
    section: shortText(input.section, 24),
    query: eventName === "zero_result" ? shortText(input.query, 120)?.toLocaleLowerCase("ru") ?? null : null,
    resultCount,
    assetId: shortText(input.assetId, 80),
    assetName: shortText(input.assetName, 120),
    variant: shortText(input.variant, 32),
    color: shortText(input.color, 32),
  };

  try {
    await recordAnalyticsEvent(event);
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("analytics_event_failed", error);
    return new Response(null, { status: 503, headers: { "retry-after": "30" } });
  }
}
