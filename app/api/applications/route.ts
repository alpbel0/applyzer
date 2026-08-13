export function POST() {
  return Response.json(
    { error: "Başvuru alımı henüz etkin değil." },
    { status: 503 },
  );
}
