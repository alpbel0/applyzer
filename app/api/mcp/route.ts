export function POST() {
  return Response.json(
    { error: "MCP sunucusu henüz etkin değil." },
    { status: 503 },
  );
}
