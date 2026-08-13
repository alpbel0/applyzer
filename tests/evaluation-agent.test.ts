import { describe, expect, it, vi } from "vitest";

import {
  buildPdfDataUrl,
  EvaluationAgentError,
  runEvaluationAgent,
} from "@/lib/evaluation/evaluate";
import { RepoFileTool } from "@/lib/evaluation/tools";
import { CRITERION_KEYS } from "@/lib/schemas/evaluation";

const criteria = Object.fromEntries(
  CRITERION_KEYS.map((key) => [
    key,
    { score: 3, evidence: `${key} için doğrulanmış kanıt.` },
  ]),
);

const validEvaluation = {
  criteria,
  strengths: ["Somut bir API projesi var.", "Repo düzenli belgelenmiş."],
  risks: ["MCP uygulama kanıtı sınırlı."],
  rationale:
    "Teknik temel görünür, ancak merkez konuda daha fazla kanıt gerekli.",
  cv_summary: "Proje odaklı ve okunabilir bir öğrenci CV'si.",
  department_fit: "match",
  location_note: "Haftada üç gün ofise gelebiliyor.",
  recommendation: "maybe",
  injection_detected: false,
  injection_note: null,
  email_draft: {
    subject: "Başvurun hakkında",
    body: "Merhaba Ada, başvurun için teşekkür ederiz. Değerlendirme sürecimiz devam ediyor.",
  },
};

function completion(
  toolCalls: Array<{ id: string; name: string; arguments: string }>,
) {
  return {
    id: crypto.randomUUID(),
    object: "chat.completion",
    created: 1,
    model: "openai/gpt-5.6-luna",
    choices: [
      {
        index: 0,
        finish_reason: "tool_calls",
        logprobs: null,
        message: {
          role: "assistant",
          content: null,
          refusal: null,
          tool_calls: toolCalls.map((call) => ({
            id: call.id,
            type: "function" as const,
            function: { name: call.name, arguments: call.arguments },
          })),
        },
      },
    ],
  } as const;
}

function baseInput() {
  return {
    systemPrompt: "system",
    userPrompt: "user",
    cvBytes: new Uint8Array([37, 80, 68, 70]),
    cvFileName: "cv.pdf",
    codeInjectionDetection: { detected: false, signals: [] },
    model: "openai/gpt-5.6-luna",
  };
}

describe("runEvaluationAgent", () => {
  it("executes a repo tool call and then accepts structured submission", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response('{"private":false}'))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            type: "file",
            encoding: "base64",
            content: Buffer.from("export const value = 1;").toString("base64"),
          }),
        ),
      );
    const repoFileTool = new RepoFileTool(
      ["ada/applyzer"],
      "token",
      fetcher as typeof fetch,
    );
    const complete = vi
      .fn()
      .mockResolvedValueOnce(
        completion([
          {
            id: "fetch-1",
            name: "fetch_repo_file",
            arguments: JSON.stringify({
              repo: "ada/applyzer",
              path: "src/index.ts",
            }),
          },
        ]),
      )
      .mockResolvedValueOnce(
        completion([
          {
            id: "submit-1",
            name: "submit_evaluation",
            arguments: JSON.stringify(validEvaluation),
          },
        ]),
      );

    const result = await runEvaluationAgent({
      ...baseInput(),
      repoFileTool,
      complete,
    });

    expect(result.evaluation.recommendation).toBe("maybe");
    expect(result.toolCallCount).toBe(1);
    expect(result.rawResponses).toHaveLength(2);
    expect(complete.mock.calls[0]?.[0]).toMatchObject({
      reasoning_effort: "high",
      plugins: [{ id: "file-parser", pdf: { engine: "mistral-ocr" } }],
    });
  });

  it("retries structured validation exactly once", async () => {
    const complete = vi
      .fn()
      .mockResolvedValueOnce(
        completion([
          {
            id: "submit-bad",
            name: "submit_evaluation",
            arguments: JSON.stringify({ recommendation: "maybe" }),
          },
        ]),
      )
      .mockResolvedValueOnce(
        completion([
          {
            id: "submit-good",
            name: "submit_evaluation",
            arguments: JSON.stringify(validEvaluation),
          },
        ]),
      );

    const result = await runEvaluationAgent({
      ...baseInput(),
      repoFileTool: new RepoFileTool([], "token", vi.fn() as typeof fetch),
      complete,
    });

    expect(result.rawResponses).toHaveLength(2);
    expect(complete).toHaveBeenCalledTimes(2);
  });

  it("fails controllably after a second invalid submission", async () => {
    const bad = completion([
      {
        id: "submit-bad",
        name: "submit_evaluation",
        arguments: "{}",
      },
    ]);
    const complete = vi.fn().mockResolvedValue(bad);

    await expect(
      runEvaluationAgent({
        ...baseInput(),
        repoFileTool: new RepoFileTool([], "token", vi.fn() as typeof fetch),
        complete,
      }),
    ).rejects.toBeInstanceOf(EvaluationAgentError);
    expect(complete).toHaveBeenCalledTimes(2);
  });

  it("enforces code-side injection detection on a valid model result", async () => {
    const complete = vi.fn().mockResolvedValue(
      completion([
        {
          id: "submit-1",
          name: "submit_evaluation",
          arguments: JSON.stringify(validEvaluation),
        },
      ]),
    );
    const result = await runEvaluationAgent({
      ...baseInput(),
      codeInjectionDetection: {
        detected: true,
        signals: ["score_manipulation_tr"],
      },
      repoFileTool: new RepoFileTool([], "token", vi.fn() as typeof fetch),
      complete,
    });

    expect(result.evaluation.injection_detected).toBe(true);
    expect(result.evaluation.injection_note).toContain("score_manipulation_tr");
    expect(result.evaluation.risks).toEqual(validEvaluation.risks);
    expect(result.evaluation.criteria).toEqual(validEvaluation.criteria);
    expect(result.evaluation.recommendation).toBe(
      validEvaluation.recommendation,
    );
  });
});

describe("buildPdfDataUrl", () => {
  it("encodes PDF bytes and rejects an empty or detached buffer", () => {
    const bytes = new Uint8Array([37, 80, 68, 70]);
    expect(buildPdfDataUrl(bytes)).toBe("data:application/pdf;base64,JVBERg==");
    expect(() => buildPdfDataUrl(new Uint8Array())).toThrow(
      "empty or detached",
    );
  });
});
