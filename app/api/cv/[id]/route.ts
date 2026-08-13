import { z } from "zod";

import { isAdminAuthenticated } from "@/lib/auth/admin";
import { createSupabaseAdminClient } from "@/lib/db/client";

const SIGNED_URL_DURATION_SECONDS = 300;

export async function GET(
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

  const supabase = createSupabaseAdminClient();
  const { data: application, error: applicationError } = await supabase
    .from("applications")
    .select("cv_storage_path")
    .eq("id", id)
    .maybeSingle();
  if (applicationError) {
    console.error("CV application lookup failed", applicationError);
    return Response.json(
      { error: "CV bağlantısı oluşturulamadı." },
      { status: 500 },
    );
  }
  if (!application) {
    return Response.json({ error: "Başvuru bulunamadı." }, { status: 404 });
  }

  const { data, error } = await supabase.storage
    .from("cvs")
    .createSignedUrl(application.cv_storage_path, SIGNED_URL_DURATION_SECONDS);
  if (error || !data?.signedUrl) {
    console.error("CV signed URL creation failed", error);
    return Response.json(
      { error: "CV bağlantısı oluşturulamadı." },
      { status: 500 },
    );
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: data.signedUrl,
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}
