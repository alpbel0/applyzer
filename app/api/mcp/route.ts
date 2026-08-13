import { createMcpHandler } from "mcp-handler";
import { z } from "zod";

import {
  ApplicationSubmissionError,
  submitApplication,
} from "@/lib/applications/submit";
import { consumeMcpRateLimit } from "@/lib/mcp/rate-limit";
import { BONUS_TOOLS, OFFICE_DAY_OPTIONS } from "@/lib/schemas/application";

export const maxDuration = 300;
export const runtime = "nodejs";

const MAX_MCP_CV_SIZE_BYTES = 3 * 1024 * 1024;
const MAX_BASE64_LENGTH = Math.ceil(MAX_MCP_CV_SIZE_BYTES / 3) * 4 + 4;

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
        title: "Staj başvurusu gönder",
        description:
          "Kovan Startup Studio staj başvurusu oluşturur. Araç herkese açıktır. privacy_consent yalnızca aday veri işleme metnini kabul ettiyse true olmalıdır. PDF base64 olarak ve en fazla 3 MiB gönderilir. Adaya yalnızca başvuru numarası döner.",
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: true,
        },
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
  },
  {
    serverInfo: { name: "applyzer-applications", version: "1.0.0" },
    verboseLogs: process.env.NODE_ENV === "development",
  },
);

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
  return baseHandler(request);
}

export const GET = baseHandler;
export const DELETE = baseHandler;
