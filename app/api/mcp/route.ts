import type { AuthInfo } from "@modelcontextprotocol/server";
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z } from "zod";

import { requestApplicationReevaluation } from "@/lib/applications/reevaluate";
import {
  ApplicationSubmissionError,
  submitApplication,
} from "@/lib/applications/submit";
import { MCP_ADMIN_SCOPE, verifyMcpAccessToken } from "@/lib/auth/mcp-oauth";
import {
  getAdminApplicationDetail,
  getAdminApplications,
} from "@/lib/db/admin";
import { evaluateText } from "@/lib/evaluation/evaluate";
import { consumeMcpRateLimit } from "@/lib/mcp/rate-limit";
import { BONUS_TOOLS, OFFICE_DAY_OPTIONS } from "@/lib/schemas/application";

export const maxDuration = 300;
export const runtime = "nodejs";

const MAX_MCP_CV_SIZE_BYTES = 3 * 1024 * 1024;
const MAX_BASE64_LENGTH = Math.ceil(MAX_MCP_CV_SIZE_BYTES / 3) * 4 + 4;
const ADMIN_TOOLS = new Set([
  "list_applications",
  "get_application_detail",
  "evaluate_text",
  "reevaluate_application",
]);

const submitApplicationSchema = z.object({
  full_name: z.string().trim().min(1),
  email: z.email(),
  department_year: z.string().trim().min(1),
  technologies: z.string().trim().min(1),
  bonus_tools: z.array(z.enum(BONUS_TOOLS)).default([]),
  links: z.string().trim().max(3000).optional(),
  self_introduction: z.string().trim().min(1).max(600),
  llm_experience: z.string().trim().min(1).max(1500),
  office_days_per_week: z.enum(OFFICE_DAY_OPTIONS),
  location_note: z.string().trim().max(300).optional(),
  privacy_consent: z.literal(true),
  cv_file_name: z.string().trim().min(1).max(255),
  cv_base64: z.string().min(1).max(MAX_BASE64_LENGTH),
});

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

function isAdmin(context: { http?: { authInfo?: AuthInfo } }) {
  return context.http?.authInfo?.scopes.includes(MCP_ADMIN_SCOPE) === true;
}

function decodePdfBase64(value: string) {
  if (
    value.length > MAX_BASE64_LENGTH ||
    !/^[A-Za-z0-9+/]*={0,2}$/u.test(value)
  ) {
    throw new Error("CV geçerli base64 biçiminde değil.");
  }
  const bytes = new Uint8Array(Buffer.from(value, "base64"));
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_MCP_CV_SIZE_BYTES) {
    throw new Error("MCP üzerinden CV en fazla 3 MiB olabilir.");
  }
  return bytes;
}

const baseHandler = createMcpHandler(
  (server) => {
    server.registerTool(
      "submit_application",
      {
        description:
          "Kovan Startup Studio staj başvurusu oluşturur. Araç herkese açıktır. privacy_consent yalnızca aday veri işleme metnini kabul ettiyse true olmalıdır. PDF base64 olarak ve en fazla 3 MiB gönderilir. Adaya yalnızca başvuru numarası döner.",
        inputSchema: submitApplicationSchema,
      },
      async (input) => {
        try {
          const cvBytes = decodePdfBase64(input.cv_base64);
          const result = await submitApplication({
            form: {
              full_name: input.full_name,
              email: input.email,
              department_year: input.department_year,
              technologies: input.technologies,
              bonus_tools: input.bonus_tools,
              links: input.links,
              self_introduction: input.self_introduction,
              llm_experience: input.llm_experience,
              office_days_per_week: input.office_days_per_week,
              location_note: input.location_note,
              privacy_consent: input.privacy_consent,
              cv: {
                name: input.cv_file_name,
                size: cvBytes.byteLength,
                type: "application/pdf",
              },
            },
            cvBytes,
          });
          return toolJson({
            application_number: result.application_number,
            status: "received",
          });
        } catch (error) {
          if (error instanceof ApplicationSubmissionError) {
            return toolError(error.message);
          }
          return toolError(
            error instanceof Error ? error.message : "Başvuru oluşturulamadı.",
          );
        }
      },
    );

    server.registerTool(
      "list_applications",
      {
        description:
          "Admin girişi gerektirir. Başvuruları en güncel değerlendirme sonucu ve durumuyla listeler.",
        inputSchema: z.object({
          status: z
            .enum(["pending", "evaluating", "done", "failed"])
            .optional(),
          recommendation: z.enum(["yes", "maybe", "no"]).optional(),
          limit: z.number().int().min(1).max(100).default(50),
        }),
      },
      async ({ status, recommendation, limit }, context) => {
        if (!isAdmin(context)) return toolError("Admin yetkisi gerekli.");
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
          "Admin girişi gerektirir. Bir başvurunun formunu, değerlendirme geçmişini ve enrichment sonuçlarını getirir. CV dosyasını döndürmez.",
        inputSchema: z.object({ application_id: z.uuid() }),
      },
      async ({ application_id }, context) => {
        if (!isAdmin(context)) return toolError("Admin yetkisi gerekli.");
        const detail = await getAdminApplicationDetail(application_id);
        return detail ? toolJson(detail) : toolError("Başvuru bulunamadı.");
      },
    );

    server.registerTool(
      "evaluate_text",
      {
        description:
          "Admin girişi gerektirir ve OpenRouter maliyeti doğurur. En fazla 100.000 karakterlik aday/CV metnini mevcut Applyzer rubric ve değerlendirme promptuyla değerlendirir; kayıtlı enrichment kullanmaz.",
        inputSchema: z.object({
          candidate_text: z.string().trim().min(1).max(100_000),
          office_days_per_week: z.enum(OFFICE_DAY_OPTIONS).optional(),
        }),
      },
      async ({ candidate_text, office_days_per_week }, context) => {
        if (!isAdmin(context)) return toolError("Admin yetkisi gerekli.");
        const result = await evaluateText({
          candidateText: candidate_text,
          officeDaysPerWeek: office_days_per_week,
        });
        return toolJson(result);
      },
    );

    server.registerTool(
      "reevaluate_application",
      {
        description:
          "Admin girişi gerektirir ve OpenRouter maliyeti doğurur. Kayıtlı PDF ile mevcut enrichment verisini yeniden kullanarak değerlendirmeyi tekrar başlatır; enrichment kaynaklarını yeniden çekmez.",
        inputSchema: z.object({ application_id: z.uuid() }),
      },
      async ({ application_id }, context) => {
        if (!isAdmin(context)) return toolError("Admin yetkisi gerekli.");
        const claimed = await requestApplicationReevaluation(application_id);
        return claimed
          ? toolJson({ application_id, status: "evaluating" })
          : toolError("Başvuru bulunamadı veya zaten işleniyor.");
      },
    );
  },
  {
    serverInfo: { name: "applyzer", version: "1.0.0" },
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

const optionalAuthHandler = withMcpAuth(baseHandler, verifyToken, {
  required: false,
  resourceMetadataPath: "/.well-known/oauth-protected-resource",
});

const adminAuthHandler = withMcpAuth(baseHandler, verifyToken, {
  required: true,
  requiredScopes: [MCP_ADMIN_SCOPE],
  resourceMetadataPath: "/.well-known/oauth-protected-resource",
});

async function requestedTool(request: Request) {
  if (request.method !== "POST") return null;
  try {
    const body = (await request.clone().json()) as {
      method?: unknown;
      params?: { name?: unknown };
    };
    return body.method === "tools/call" && typeof body.params?.name === "string"
      ? body.params.name
      : null;
  } catch {
    return null;
  }
}

function rateLimitResponse(request: Request) {
  return request
    .clone()
    .json()
    .then((body: { id?: unknown }) =>
      Response.json(
        {
          jsonrpc: "2.0",
          id: body.id ?? null,
          error: {
            code: -32000,
            message: "Bu ağdan saatlik MCP başvuru sınırına ulaşıldı.",
          },
        },
        { status: 429 },
      ),
    );
}

export async function POST(request: Request) {
  const tool = await requestedTool(request);
  if (tool && ADMIN_TOOLS.has(tool)) return adminAuthHandler(request);
  if (tool === "submit_application") {
    try {
      if (!(await consumeMcpRateLimit(request.headers, "submit", 5))) {
        return rateLimitResponse(request);
      }
    } catch (error) {
      console.error("MCP rate limit check failed", error);
      return Response.json(
        {
          jsonrpc: "2.0",
          id: null,
          error: { code: -32603, message: "Başvuru şu anda alınamıyor." },
        },
        { status: 503 },
      );
    }
  }
  return optionalAuthHandler(request);
}

export const GET = optionalAuthHandler;
export const DELETE = optionalAuthHandler;
