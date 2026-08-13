import { z } from "zod";

import { isAdminAuthenticated } from "@/lib/auth/admin";
import {
  createRubricVersionAndRecalculate,
  rubricWeightsSchema,
} from "@/lib/db/rubric";

const requestSchema = z.object({
  weights: rubricWeightsSchema,
  description: z.string().trim().max(160).optional(),
});

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Yetkisiz erişim." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Ağırlıkların toplamı tam %100 olmalıdır." },
      { status: 400 },
    );
  }

  try {
    const result = await createRubricVersionAndRecalculate(parsed.data);
    return Response.json(result, { status: 201 });
  } catch (error) {
    console.error("Rubric version creation failed", error);
    return Response.json(
      { error: "Rubric sürümü kaydedilemedi." },
      { status: 500 },
    );
  }
}
