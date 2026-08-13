import { z } from "zod";

import { isAdminAuthenticated } from "@/lib/auth/admin";
import { requestApplicationReevaluation } from "@/lib/applications/reevaluate";

export const maxDuration = 300;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Yetkisiz erişim." }, { status: 401 });
  }
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) {
    return Response.json({ error: "Geçersiz başvuru." }, { status: 400 });
  }

  let claimed: boolean;
  try {
    claimed = await requestApplicationReevaluation(id);
  } catch (error) {
    console.error("Reevaluation claim failed", error);
    return Response.json(
      { error: "Yeniden değerlendirme başlatılamadı." },
      { status: 500 },
    );
  }
  if (!claimed) {
    return Response.json(
      { error: "Başvuru zaten işleniyor veya bulunamadı." },
      { status: 409 },
    );
  }

  return Response.json({ status: "evaluating" }, { status: 202 });
}
