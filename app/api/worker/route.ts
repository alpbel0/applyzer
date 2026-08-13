export function POST() {
  return Response.json(
    { error: "Değerlendirme işçisi henüz etkin değil." },
    { status: 503 },
  );
}
