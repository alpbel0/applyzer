import type { AuthInfo } from "@modelcontextprotocol/server";
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z } from "zod";

import { requestApplicationReevaluation } from "@/lib/applications/reevaluate";
import { MCP_ADMIN_SCOPE, verifyMcpAccessToken } from "@/lib/auth/mcp-oauth";
import {
  getAdminApplicationDetail,
  getAdminApplications,
} from "@/lib/db/admin";
import { evaluateText } from "@/lib/evaluation/evaluate";
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
        description:
          "Başvuruları en güncel değerlendirme sonucu ve durumuyla listeler.",
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
      "get_application_detail",
      {
        description:
          "Bir başvurunun formunu, değerlendirme geçmişini ve enrichment sonuçlarını getirir. CV dosyasını döndürmez.",
        inputSchema: z.object({ application_id: z.uuid() }),
      },
      async ({ application_id }) => {
        const detail = await getAdminApplicationDetail(application_id);
        return detail ? toolJson(detail) : toolError("Başvuru bulunamadı.");
      },
    );

    server.registerTool(
      "evaluate_text",
      {
        description:
          "OpenRouter maliyeti doğurur. En fazla 100.000 karakterlik aday/CV metnini mevcut Applyzer rubric ve değerlendirme promptuyla değerlendirir; kayıtlı enrichment kullanmaz.",
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
        description:
          "OpenRouter maliyeti doğurur. Kayıtlı PDF ile mevcut enrichment verisini yeniden kullanarak değerlendirmeyi tekrar başlatır; enrichment kaynaklarını yeniden çekmez.",
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
