import { timingSafeEqual } from "node:crypto";

import { z } from "zod";

import { processApplicationLinks } from "@/lib/worker/process-application";

const workerRequestSchema = z.object({
  application_id: z.uuid().optional(),
});

function hasValidWorkerSecret(request: Request) {
  const expected = process.env.WORKER_SECRET;
  const authorization = request.headers.get("authorization") ?? "";
  const supplied = authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : "";

  if (!expected || !supplied) return false;
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  return (
    expectedBytes.length === suppliedBytes.length &&
    timingSafeEqual(expectedBytes, suppliedBytes)
  );
}

export async function POST(request: Request) {
  if (!hasValidWorkerSecret(request)) {
    return Response.json({ error: "Yetkisiz istek." }, { status: 401 });
  }

  let body: unknown = {};
  if (
    (request.headers.get("content-type") ?? "")
      .toLowerCase()
      .includes("application/json")
  ) {
    try {
      body = await request.json();
    } catch {
      return Response.json(
        { error: "Geçersiz istek gövdesi." },
        { status: 400 },
      );
    }
  }

  const parsed = workerRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Geçersiz başvuru kimliği." },
      { status: 400 },
    );
  }

  const result = await processApplicationLinks(parsed.data.application_id);
  if (!result) {
    return Response.json({ status: "idle" });
  }

  return Response.json(result);
}
