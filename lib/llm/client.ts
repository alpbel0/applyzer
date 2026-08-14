import "server-only";

import OpenAI from "openai";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_TIMEOUT_MS = 55_000;

export type OpenRouterErrorKind =
  | "rate_limit"
  | "timeout"
  | "authentication"
  | "invalid_model"
  | "request_failed";

export class OpenRouterRequestError extends Error {
  constructor(
    readonly kind: OpenRouterErrorKind,
    message: string,
    readonly status: number | null = null,
  ) {
    super(message);
    this.name = "OpenRouterRequestError";
  }
}

export type OpenRouterConfig = {
  apiKey: string;
  model: string;
  promptCacheEnabled: boolean;
};

export function getOpenRouterConfig(
  env: Record<string, string | undefined> = process.env,
): OpenRouterConfig {
  const apiKey = env.OPENROUTER_API_KEY?.trim();
  const model = env.OPENROUTER_MODEL_JUDGE?.trim();
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not configured.");
  if (!model) throw new Error("OPENROUTER_MODEL_JUDGE is not configured.");

  return {
    apiKey,
    model,
    promptCacheEnabled:
      env.ENABLE_PROMPT_CACHE?.trim().toLowerCase() === "true",
  };
}

export function getOpenRouterSummaryConfig(
  env: Record<string, string | undefined> = process.env,
): OpenRouterConfig {
  const apiKey = env.OPENROUTER_API_KEY?.trim();
  const model = env.OPENROUTER_MODEL_SUMMARY?.trim();
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not configured.");
  if (!model) throw new Error("OPENROUTER_MODEL_SUMMARY is not configured.");

  return { apiKey, model, promptCacheEnabled: false };
}

export function createOpenRouterClient(
  config = getOpenRouterConfig(),
  options?: { timeoutMs?: number },
) {
  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: OPENROUTER_BASE_URL,
    timeout: options?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    maxRetries: 0,
  });
}

function errorDetails(error: unknown) {
  if (error === null || typeof error !== "object") {
    return { status: null, name: "", message: String(error) };
  }
  const value = error as {
    status?: unknown;
    name?: unknown;
    message?: unknown;
  };
  return {
    status: typeof value.status === "number" ? value.status : null,
    name: typeof value.name === "string" ? value.name : "",
    message: typeof value.message === "string" ? value.message : "",
  };
}

function diagnosticCode(error: unknown) {
  if (error === null || typeof error !== "object") return null;
  const value = error as { code?: unknown; error?: { code?: unknown } };
  const code = value.code ?? value.error?.code;
  return typeof code === "string" || typeof code === "number" ? code : null;
}

function safeProviderMessage(message: string) {
  return message
    .replace(/Bearer\s+\S+/giu, "Bearer [redacted]")
    .replace(/(?:sk|sb_secret)_[A-Za-z0-9_-]+/gu, "[redacted-key]")
    .slice(0, 1_000);
}

export function normalizeOpenRouterError(error: unknown) {
  if (error instanceof OpenRouterRequestError) return error;
  const details = errorDetails(error);

  if (
    error instanceof OpenAI.APIConnectionTimeoutError ||
    details.name === "APIConnectionTimeoutError" ||
    /timeout|timed out/iu.test(details.message)
  ) {
    return new OpenRouterRequestError(
      "timeout",
      "OpenRouter request timed out.",
      details.status,
    );
  }
  if (details.status === 429) {
    return new OpenRouterRequestError(
      "rate_limit",
      "OpenRouter rate limit was reached.",
      429,
    );
  }
  if (details.status === 401 || details.status === 403) {
    return new OpenRouterRequestError(
      "authentication",
      "OpenRouter authentication failed.",
      details.status,
    );
  }
  if (
    details.status === 404 ||
    ((details.status === 400 || details.status === 422) &&
      /model/iu.test(details.message))
  ) {
    return new OpenRouterRequestError(
      "invalid_model",
      "The configured OpenRouter model is unavailable or invalid.",
      details.status,
    );
  }

  return new OpenRouterRequestError(
    "request_failed",
    "OpenRouter request failed.",
    details.status,
  );
}

export async function runOpenRouterRequest<T>(request: () => Promise<T>) {
  try {
    return await request();
  } catch (error) {
    const details = errorDetails(error);
    const normalized = normalizeOpenRouterError(error);
    console.error(
      `OpenRouter request rejected ${JSON.stringify({
        kind: normalized.kind,
        status: normalized.status,
        errorName: details.name,
        code: diagnosticCode(error),
        providerMessage: safeProviderMessage(details.message),
      })}`,
    );
    throw normalized;
  }
}

export async function verifyOpenRouterConnection() {
  const config = getOpenRouterConfig();
  const client = createOpenRouterClient(config);
  const completion = await runOpenRouterRequest(() =>
    client.chat.completions.create({
      model: config.model,
      messages: [{ role: "user", content: "Merhaba. Yalnızca OK yaz." }],
      max_completion_tokens: 16,
      reasoning_effort: "low",
    }),
  );

  return {
    id: completion.id,
    model: completion.model,
    responded: Boolean(completion.choices[0]?.message),
  };
}
