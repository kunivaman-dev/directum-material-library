export const dynamic = "force-dynamic";

const palettes = {
  directum: { brand: "#FF8000", fade: "#FFD299" },
  esm: { brand: "#2195BE", fade: "#74EAFC" },
  hrpro: { brand: "#A4305A", fade: "#D77598" },
  projects: { brand: "#70AC30", fade: "#96D447" },
  omni: { brand: "#9541C0", fade: "#C99FDF" },
  targets: { brand: "#0043A4", fade: "#79AEF9" },
} as const;

const lineColors = {
  ...Object.fromEntries(Object.entries(palettes).map(([key, value]) => [key, value.brand])),
  black: "#000000",
  white: "#FFFFFF",
} as Record<string, string>;

const singleColorVariants = new Set(["outline", "small-outline", "mono"]);
const variantLabels = new Set(["base", "outline", "small", "small-outline", "mono", "3d"]);

function paintValue(value: string) {
  const normalized = value.trim().toLocaleLowerCase();
  return normalized && normalized !== "none" && normalized !== "transparent" && !normalized.startsWith("url(");
}

function isWhite(value: string) {
  return ["white", "#fff", "#ffffff", "rgb(255,255,255)", "rgb(255, 255, 255)"].includes(
    value.trim().toLocaleLowerCase(),
  );
}

function recolorSingleColor(svg: string, color: string) {
  const values: string[] = [];
  svg.replace(/\b(?:stroke|fill)="([^"]+)"/gi, (_, value) => {
    values.push(value);
    return _;
  });
  svg.replace(/\b(?:stroke|fill):\s*([^;"']+)/gi, (_, value) => {
    values.push(value);
    return _;
  });
  const hasNonWhite = values.some((value) => paintValue(value) && !isWhite(value));
  const replacement = (value: string) =>
    !paintValue(value) || (hasNonWhite && isWhite(value)) ? value : color;
  return svg
    .replace(/\b(stroke|fill)="([^"]+)"/gi, (_, attribute, value) => `${attribute}="${replacement(value)}"`)
    .replace(/\b(stroke|fill):\s*([^;"']+)/gi, (_, attribute, value) => `${attribute}:${replacement(value)}`);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const file = url.searchParams.get("file") || "";
  const variant = url.searchParams.get("variant") || "";
  const color = url.searchParams.get("color") || "directum";
  const singleColor = singleColorVariants.has(variant);

  if (!/^\d+-\d+\.svg$/.test(file) || !variantLabels.has(variant)) {
    return new Response("Invalid icon variant", { status: 400 });
  }
  if (singleColor ? !lineColors[color] : !(color in palettes)) {
    return new Response("Invalid icon color", { status: 400 });
  }

  const sourceUrl = new URL(`/assets/variants/${file}`, url.origin);
  const source = await fetch(sourceUrl);
  if (!source.ok) return new Response("Icon not found", { status: 404 });

  let svg = await source.text();
  if (singleColor) {
    svg = recolorSingleColor(svg, lineColors[color]);
  } else if (color !== "directum") {
    const palette = palettes[color as keyof typeof palettes];
    svg = svg.replace(/#(?:FF8000|FF7A00)/gi, palette.brand).replace(/#FFD299/gi, palette.fade);
  }

  return new Response(svg, {
    headers: {
      "access-control-allow-origin": "*",
      "cache-control": "public, max-age=300, stale-while-revalidate=86400",
      "content-type": "image/svg+xml; charset=utf-8",
    },
  });
}
