export function GET() {
  return Response.json(
    { error: "CV erişimi henüz etkin değil." },
    { status: 503 },
  );
}
