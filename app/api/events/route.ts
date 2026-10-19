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

const allowedOrigins = new Set([
  "https://directum-icon-library.kunivaman.chatgpt.site",
  "https://directum-design.desserg.ru",
]);

function corsHeaders(request: Request) {
  const origin = request.headers.get("origin");
  return origin && allowedOrigins.has(origin)
    ? {
        "access-control-allow-origin": origin,
        "access-control-allow-methods": "POST, OPTIONS",
        "access-control-allow-headers": "content-type",
        "access-control-max-age": "86400",
        vary: "Origin",
      }
    : {};
}

function response(request: Request, status: number, headers: HeadersInit = {}) {
  return new Response(null, { status, headers: { ...corsHeaders(request), ...headers } });
}

export async function OPTIONS(request: Request) {
  const origin = request.headers.get("origin");
  return origin && allowedOrigins.has(origin) ? response(request, 204) : response(request, 403);
}

function shortText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) || null : null;
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && !allowedOrigins.has(origin)) return response(request, 403);
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && !["same-origin", "same-site", "none"].includes(fetchSite) && !origin) {
    return response(request, 403);
  }
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return response(request, 415);
  }
  const length = Number(request.headers.get("content-length") || 0);
  if (length > 2048) return response(request, 413);

  let input: Record<string, unknown>;
  try {
    input = await request.json();
  } catch {
    return response(request, 400);
  }

  const eventName = shortText(input.event, 40);
  if (!eventName || !allowedEvents.has(eventName)) return response(request, 400);

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
    return response(request, 204);
  } catch (error) {
    console.error("analytics_event_failed", error);
    return response(request, 503, { "retry-after": "30" });
  }
}
