import { describe, expect, it } from "vitest";

import {
  getOpenRouterConfig,
  getOpenRouterSummaryConfig,
  normalizeOpenRouterError,
  runOpenRouterRequest,
} from "@/lib/llm/client";

describe("getOpenRouterConfig", () => {
  it("reads the judge model and enables cache only for explicit true", () => {
    expect(
      getOpenRouterConfig({
        OPENROUTER_API_KEY: "secret",
        OPENROUTER_MODEL_JUDGE: "openai/gpt-5.6-luna",
        ENABLE_PROMPT_CACHE: "TRUE",
      }),
    ).toEqual({
      apiKey: "secret",
      model: "openai/gpt-5.6-luna",
      promptCacheEnabled: true,
    });
    expect(
      getOpenRouterConfig({
        OPENROUTER_API_KEY: "secret",
        OPENROUTER_MODEL_JUDGE: "openai/gpt-5.6-luna",
        ENABLE_PROMPT_CACHE: "1",
      }).promptCacheEnabled,
    ).toBe(false);
  });

  it("fails before a request when required configuration is missing", () => {
    expect(() =>
      getOpenRouterConfig({ OPENROUTER_MODEL_JUDGE: "model" }),
    ).toThrow("OPENROUTER_API_KEY");
    expect(() => getOpenRouterConfig({ OPENROUTER_API_KEY: "key" })).toThrow(
      "OPENROUTER_MODEL_JUDGE",
    );
  });

  it("uses the dedicated summary model without prompt caching", () => {
    expect(
      getOpenRouterSummaryConfig({
        OPENROUTER_API_KEY: "secret",
        OPENROUTER_MODEL_SUMMARY: "openai/gpt-5.6-mini",
      }),
    ).toEqual({
      apiKey: "secret",
      model: "openai/gpt-5.6-mini",
      promptCacheEnabled: false,
    });
  });
});

describe("OpenRouter error handling", () => {
  it.each([
    [{ status: 429, message: "rate limited" }, "rate_limit"],
    [{ status: 401, message: "unauthorized" }, "authentication"],
    [{ status: 404, message: "model not found" }, "invalid_model"],
    [{ status: 400, message: "invalid model id" }, "invalid_model"],
    [{ name: "APIConnectionTimeoutError" }, "timeout"],
    [{ status: 500, message: "provider failed" }, "request_failed"],
  ])("classifies %#", (error, expectedKind) => {
    expect(normalizeOpenRouterError(error).kind).toBe(expectedKind);
  });

  it("normalizes rejected requests", async () => {
    await expect(
      runOpenRouterRequest(async () => {
        throw { status: 429 };
      }),
    ).rejects.toMatchObject({ kind: "rate_limit", status: 429 });
  });
});
