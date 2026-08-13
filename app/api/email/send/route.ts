export function POST() {
  return Response.json(
    { error: "E-posta gönderimi henüz etkin değil." },
    { status: 503 },
  );
}
