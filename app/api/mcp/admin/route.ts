import type { AuthInfo } from "@modelcontextprotocol/server";
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z } from "zod";

import { requestApplicationReevaluation } from "@/lib/applications/reevaluate";
import { MCP_ADMIN_SCOPE, verifyMcpAccessToken } from "@/lib/auth/mcp-oauth";
import {
  getAdminApplicationDetail,
  getAdminApplications,
} from "@/lib/db/admin";
import { getActiveRubric } from "@/lib/db/rubric";
import { evaluateText } from "@/lib/evaluation/evaluate";
import {
  compareAdminApplications,
  getAdminCvContent,
  getAdminCvLink,
  getAdminDashboardSummary,
  searchAdminApplications,
} from "@/lib/mcp/admin-tools";
import { OFFICE_DAY_OPTIONS } from "@/lib/schemas/application";

export const maxDuration = 300;
export const runtime = "nodejs";

function toolJson(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
  };
}

function toolError(message: string) {
  return {
    isError: true,
    content: [{ type: "text" as const, text: message }],
  };
}

const baseHandler = createMcpHandler(
  (server) => {
    server.registerTool(
      "list_applications",
      {
        title: "Başvuruları listele",
        description:
          "Başvuruları en güncel değerlendirme sonucu ve durumuyla listeler.",
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
        inputSchema: z.object({
          status: z
            .enum(["pending", "evaluating", "done", "failed"])
            .optional(),
          recommendation: z.enum(["yes", "maybe", "no"]).optional(),
          limit: z.number().int().min(1).max(100).default(50),
        }),
      },
      async ({ status, recommendation, limit }) => {
        const applications = (await getAdminApplications())
          .filter((item) => !status || item.status === status)
          .filter(
            (item) =>
              !recommendation || item.final_recommendation === recommendation,
          )
          .slice(0, limit);
        return toolJson({ applications, count: applications.length });
      },
    );

    server.registerTool(
      "search_applications",
      {
        title: "Başvurularda ara",
        description:
          "Aday adı, bölüm/sınıf veya başvuru numarasıyla arar; durum, öneri ve skor aralığına göre filtreler.",
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
        inputSchema: z
          .object({
            query: z.string().trim().max(120).optional(),
            status: z
              .enum(["pending", "evaluating", "done", "failed"])
              .optional(),
            recommendation: z.enum(["yes", "maybe", "no"]).optional(),
            minimum_score: z.number().min(0).max(100).optional(),
            maximum_score: z.number().min(0).max(100).optional(),
            sort: z
              .enum(["newest", "score_desc", "score_asc"])
              .default("newest"),
            limit: z.number().int().min(1).max(100).default(25),
          })
          .refine(
            (value) =>
              value.minimum_score === undefined ||
              value.maximum_score === undefined ||
              value.minimum_score <= value.maximum_score,
            { message: "minimum_score maximum_score'dan büyük olamaz." },
          ),
      },
      async (input) => {
        const applications = await searchAdminApplications({
          query: input.query,
          status: input.status,
          recommendation: input.recommendation,
          minimumScore: input.minimum_score,
          maximumScore: input.maximum_score,
          sort: input.sort,
          limit: input.limit,
        });
        return toolJson({ applications, count: applications.length });
      },
    );

    server.registerTool(
      "get_application_detail",
      {
        title: "Başvuru detayını getir",
        description:
          "Bir başvurunun formunu, değerlendirme geçmişini ve enrichment sonuçlarını getirir. CV dosyasını döndürmez.",
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
        inputSchema: z.object({ application_id: z.uuid() }),
      },
      async ({ application_id }) => {
        const detail = await getAdminApplicationDetail(application_id);
        return detail ? toolJson(detail) : toolError("Başvuru bulunamadı.");
      },
    );

    server.registerTool(
      "get_application_cv",
      {
        title: "Aday CV'sini getir",
        description:
          "Private Storage'daki aday PDF'ini MCP içine gömülü dosya veya 5 dakika geçerli resource link olarak döndürür. Modelin CV'yi doğrudan okuması için embedded seçin; 2.5 MiB üzerindeki PDF'lerde resource_link kullanın. CV hiçbir zaman public yapılmaz.",
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: false,
        },
        inputSchema: z.object({
          application_id: z.uuid(),
          delivery: z.enum(["embedded", "resource_link"]).default("embedded"),
        }),
      },
      async ({ application_id, delivery }) => {
        if (delivery === "embedded") {
          try {
            const cv = await getAdminCvContent(application_id);
            if (!cv) return toolError("Başvuru bulunamadı.");
            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify(
                    {
                      application_id: cv.application_id,
                      application_number: cv.application_number,
                      candidate_name: cv.candidate_name,
                      file_name: cv.file_name,
                      byte_size: cv.byte_size,
                      delivery: "embedded",
                    },
                    null,
                    2,
                  ),
                },
                {
                  type: "resource" as const,
                  resource: {
                    uri: `applyzer://applications/${cv.application_id}/cv`,
                    mimeType: "application/pdf",
                    blob: cv.base64,
                  },
                },
              ],
            };
          } catch (error) {
            return toolError(
              error instanceof Error
                ? error.message
                : "CV MCP içine eklenemedi.",
            );
          }
        }
        const cv = await getAdminCvLink(application_id);
        if (!cv) return toolError("Başvuru bulunamadı.");
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  application_id: cv.application_id,
                  application_number: cv.application_number,
                  candidate_name: cv.candidate_name,
                  file_name: cv.file_name,
                  expires_in_seconds: cv.expires_in_seconds,
                  expires_at: cv.expires_at,
                },
                null,
                2,
              ),
            },
            {
              type: "resource_link" as const,
              uri: cv.signed_url,
              name: cv.file_name,
              title: `${cv.candidate_name} — CV`,
              description: "5 dakika geçerli private CV indirme bağlantısı",
              mimeType: "application/pdf",
            },
          ],
        };
      },
    );

    server.registerTool(
      "compare_applications",
      {
        title: "Adayları karşılaştır",
        description:
          "2-5 adayı form bilgileri, son değerlendirmeleri, kriter kanıtları ve kaynak durumlarıyla yan yana getirir.",
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
        inputSchema: z.object({
          application_ids: z
            .array(z.uuid())
            .min(2)
            .max(5)
            .refine((ids) => new Set(ids).size >= 2, {
              message: "En az iki farklı application_id gerekli.",
            }),
        }),
      },
      async ({ application_ids }) =>
        toolJson(await compareAdminApplications([...new Set(application_ids)])),
    );

    server.registerTool(
      "get_dashboard_summary",
      {
        title: "Başvuru özetini getir",
        description:
          "Toplam başvuru, durum/öneri dağılımı, ortalama skor ve güvenlik uyarısı sayılarını döndürür.",
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
        inputSchema: z.object({}),
      },
      async () => toolJson(await getAdminDashboardSummary()),
    );

    server.registerTool(
      "get_active_rubric",
      {
        title: "Aktif rubric'i getir",
        description:
          "Değerlendirmede kullanılan aktif rubric sürümünü, açıklamasını ve kriter ağırlıklarını döndürür.",
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
        inputSchema: z.object({}),
      },
      async () => toolJson(await getActiveRubric()),
    );

    server.registerTool(
      "evaluate_text",
      {
        title: "Serbest metni değerlendir",
        description:
          "OpenRouter maliyeti doğurur. En fazla 100.000 karakterlik aday/CV metnini mevcut Applyzer rubric ve değerlendirme promptuyla değerlendirir; kayıtlı enrichment kullanmaz.",
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: true,
        },
        inputSchema: z.object({
          candidate_text: z.string().trim().min(1).max(100_000),
          office_days_per_week: z.enum(OFFICE_DAY_OPTIONS).optional(),
        }),
      },
      async ({ candidate_text, office_days_per_week }) =>
        toolJson(
          await evaluateText({
            candidateText: candidate_text,
            officeDaysPerWeek: office_days_per_week,
          }),
        ),
    );

    server.registerTool(
      "reevaluate_application",
      {
        title: "Başvuruyu yeniden değerlendir",
        description:
          "OpenRouter maliyeti doğurur. Kayıtlı PDF ile mevcut enrichment verisini yeniden kullanarak değerlendirmeyi tekrar başlatır; enrichment kaynaklarını yeniden çekmez.",
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: true,
        },
        inputSchema: z.object({ application_id: z.uuid() }),
      },
      async ({ application_id }) => {
        const claimed = await requestApplicationReevaluation(application_id);
        return claimed
          ? toolJson({ application_id, status: "evaluating" })
          : toolError("Başvuru bulunamadı veya zaten işleniyor.");
      },
    );
  },
  {
    serverInfo: { name: "applyzer-admin", version: "1.0.0" },
    verboseLogs: process.env.NODE_ENV === "development",
  },
);

async function verifyToken(
  _request: Request,
  bearerToken?: string,
): Promise<AuthInfo | undefined> {
  const payload = await verifyMcpAccessToken(bearerToken);
  if (!payload) return undefined;
  return {
    token: bearerToken!,
    scopes: [...payload.scopes],
    clientId: payload.client_id,
    expiresAt: payload.expires_at,
  };
}

const handler = withMcpAuth(baseHandler, verifyToken, {
  required: true,
  requiredScopes: [MCP_ADMIN_SCOPE],
  resourceMetadataPath: "/.well-known/oauth-protected-resource",
});

export const GET = handler;
export const POST = handler;
export const DELETE = handler;
