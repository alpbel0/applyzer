import { z } from "zod";

import { isAdminAuthenticated } from "@/lib/auth/admin";
import {
  claimEmailForSending,
  completeEmailSending,
  failEmailSending,
  getEmailApplication,
  updateEmailDraftType,
} from "@/lib/db/emails";
import { resolveEmailDeliveryTarget } from "@/lib/email/demo-guard";
import { sendGmailMessage } from "@/lib/email/send";
import { recommendationSchema } from "@/lib/schemas/evaluation";

const emailIdSchema = z.object({ emailId: z.uuid() }).strict();
const updateDraftSchema = emailIdSchema
  .extend({ draftType: recommendationSchema })
  .strict();

async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function PATCH(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Yetkisiz erişim." }, { status: 401 });
  }
  const parsed = updateDraftSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return Response.json({ error: "Geçersiz taslak seçimi." }, { status: 400 });
  }

  try {
    const record = await getEmailApplication(parsed.data.emailId);
    if (!record) {
      return Response.json(
        { error: "Mail taslağı bulunamadı." },
        { status: 404 },
      );
    }
    if (record.email.is_sent || record.email.provider_id) {
      return Response.json(
        { error: "Gönderilmiş veya gönderilmekte olan mail değiştirilemez." },
        { status: 409 },
      );
    }
    const draft = await updateEmailDraftType({
      emailId: parsed.data.emailId,
      fullName: record.application.full_name,
      draftType: parsed.data.draftType,
    });
    if (!draft) {
      return Response.json(
        { error: "Mail taslağı değiştirilemedi." },
        { status: 409 },
      );
    }
    return Response.json({ draft });
  } catch (error) {
    console.error("Email draft update failed", error);
    return Response.json(
      { error: "Mail taslağı değiştirilemedi." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Yetkisiz erişim." }, { status: 401 });
  }
  const parsed = emailIdSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return Response.json({ error: "Geçersiz mail taslağı." }, { status: 400 });
  }

  let record: Awaited<ReturnType<typeof getEmailApplication>>;
  try {
    record = await getEmailApplication(parsed.data.emailId);
  } catch (error) {
    console.error("Email application lookup failed", error);
    return Response.json(
      { error: "Mail bilgileri alınamadı." },
      { status: 500 },
    );
  }
  if (!record) {
    return Response.json(
      { error: "Mail taslağı bulunamadı." },
      { status: 404 },
    );
  }
  if (record.email.is_sent) {
    return Response.json(
      { error: "Bu mail zaten gönderilmiş." },
      { status: 409 },
    );
  }
  if (record.email.provider_id) {
    return Response.json(
      { error: "Bu mail şu anda gönderiliyor." },
      { status: 409 },
    );
  }

  let target: ReturnType<typeof resolveEmailDeliveryTarget>;
  try {
    target = resolveEmailDeliveryTarget(record.application.email);
  } catch (error) {
    console.error("Email environment validation failed", error);
    return Response.json(
      { error: "Gmail ortam değişkenleri geçersiz." },
      { status: 500 },
    );
  }

  const claimId = `sending:${crypto.randomUUID()}`;
  let claimed: Awaited<ReturnType<typeof claimEmailForSending>>;
  try {
    claimed = await claimEmailForSending({
      emailId: parsed.data.emailId,
      claimId,
      demoMode: target.demoMode,
    });
  } catch (error) {
    console.error("Email send claim failed", error);
    return Response.json(
      { error: "Mail gönderimi başlatılamadı." },
      { status: 500 },
    );
  }
  if (!claimed) {
    return Response.json(
      { error: "Mail daha önce gönderilmiş veya şu anda gönderiliyor." },
      { status: 409 },
    );
  }

  let providerId: string;
  try {
    ({ providerId } = await sendGmailMessage({
      to: target.recipient,
      subject: claimed.subject,
      body: claimed.body,
    }));
  } catch (error) {
    console.error("Gmail send failed", error);
    try {
      await failEmailSending({
        emailId: claimed.id,
        claimId,
        error: "Gmail gönderimi başarısız oldu.",
      });
    } catch (recordError) {
      console.error("Email failure could not be recorded", recordError);
    }
    return Response.json(
      { error: "Mail Gmail üzerinden gönderilemedi." },
      { status: 502 },
    );
  }

  try {
    const sent = await completeEmailSending({
      emailId: claimed.id,
      claimId,
      providerId,
    });
    return Response.json({
      status: "sent",
      sent_at: sent.sent_at,
      demo_mode: sent.demo_mode,
    });
  } catch (error) {
    console.error("Sent email could not be finalized", error);
    return Response.json(
      {
        error: "Mail gönderildi ancak kayıt tamamlanamadı. Tekrar göndermeyin.",
      },
      { status: 500 },
    );
  }
}
