export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const incoming = new URL(request.url);
  const destination = new URL("/icons.html", incoming.origin);
  destination.search = incoming.search;
  return Response.redirect(destination, 308);
}
