export function POST() {
  return Response.json(
    { error: "Rubric yönetimi henüz etkin değil." },
    { status: 503 },
  );
}
