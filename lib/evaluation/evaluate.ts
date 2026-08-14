import "server-only";

import OpenAI from "openai";
import { z } from "zod";

import { extractPdfLinkMaterial } from "@/lib/cv/parse";
import { createSupabaseAdminClient } from "@/lib/db/client";
import {
  createEvaluationRecord,
  linkEvaluationAttempts,
  recordEvaluationAttempts,
} from "@/lib/db/evaluations";
import { createEmailDraftRecord } from "@/lib/db/emails";
import { selectInitialEmailDraft } from "@/lib/email/templates";
import { getActiveRubric } from "@/lib/db/rubric";
import {
  buildEvaluationPrompts,
  type EvaluationPromptApplication,
  type EvaluationPromptEnrichment,
} from "@/lib/evaluation/prompt";
import { calculateEvaluationScore } from "@/lib/evaluation/score";
import {
  createOpenRouterClient,
  getOpenRouterConfig,
  OpenRouterRequestError,
  runOpenRouterRequest,
} from "@/lib/llm/client";
import {
  evaluationOutputSchema,
  type EvaluationOutput,
} from "@/lib/schemas/evaluation";
import {
  detectPromptInjection,
  sanitizeUntrustedText,
  type InjectionDetection,
} from "@/lib/evaluation/sanitize";
import {
  collectAllowedRepositories,
  fetchRepoFileToolDefinition,
  MAX_REPO_FILE_CALLS,
  RepoFileTool,
} from "@/lib/evaluation/tools";

type ChatMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;
type ChatCompletion = OpenAI.Chat.Completions.ChatCompletion;
type CompletionParams =
  OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming & {
    plugins?: Array<{ id: string; pdf: { engine: string } }>;
  };

const MAX_AGENT_TURNS = MAX_REPO_FILE_CALLS + 3;
const MAX_OUTPUT_TOKENS = 20_000;

const evaluationJsonSchema = z.toJSONSchema(evaluationOutputSchema, {
  target: "draft-7",
}) as Record<string, unknown>;
delete evaluationJsonSchema.$schema;

export const submitEvaluationToolDefinition = {
  type: "function" as const,
  function: {
    name: "submit_evaluation",
    description:
      "Submit the final candidate evaluation after all necessary evidence has been reviewed.",
    strict: true,
    parameters: evaluationJsonSchema,
  },
};

export class EvaluationAgentError extends Error {
  constructor(
    message: string,
    readonly rawResponses: unknown[],
    readonly toolCallCount: number,
  ) {
    super(message);
    this.name = "EvaluationAgentError";
  }
}

export type EvaluationAgentResult = {
  evaluation: EvaluationOutput;
  rawResponses: unknown[];
  toolCallCount: number;
  model: string;
};

function systemMessage(
  prompt: string,
  model: string,
  promptCacheEnabled: boolean,
): ChatMessage {
  if (promptCacheEnabled && model.startsWith("anthropic/")) {
    return {
      role: "system",
      content: [
        {
          type: "text",
          text: prompt,
          cache_control: { type: "ephemeral" },
        } as OpenAI.Chat.Completions.ChatCompletionContentPartText,
      ],
    };
  }
  return { role: "system", content: prompt };
}

export function buildPdfDataUrl(cvBytes: Uint8Array) {
  if (cvBytes.byteLength === 0) {
    throw new Error("CV bytes are empty or detached.");
  }
  return `data:application/pdf;base64,${Buffer.from(cvBytes).toString("base64")}`;
}

function userMessage(input: {
  prompt: string;
  cvBytes?: Uint8Array;
  cvFileName?: string;
  cvText?: string;
}) {
  const text = input.cvText
    ? `${input.prompt}\n\n<cv_text>\n${sanitizeUntrustedText(input.cvText)}\n</cv_text>`
    : input.prompt;
  const content: Array<
    | { type: "text"; text: string }
    | { type: "file"; file: { filename: string; file_data: string } }
  > = [{ type: "text", text }];
  if (input.cvBytes && input.cvFileName) {
    content.push({
      type: "file",
      file: {
        filename: input.cvFileName,
        file_data: buildPdfDataUrl(input.cvBytes),
      },
    });
  }
  return {
    role: "user" as const,
    content,
  } satisfies ChatMessage;
}

function assistantMessage(
  message: ChatCompletion["choices"][number]["message"],
) {
  return {
    ...message,
    role: "assistant" as const,
  } as ChatMessage;
}

function validationMessage(error: unknown) {
  if (error instanceof z.ZodError) {
    return error.issues
      .slice(0, 12)
      .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
      .join("; ");
  }
  return error instanceof Error ? error.message : "Invalid JSON arguments.";
}

function applyCodeInjectionDetection(
  evaluation: EvaluationOutput,
  detection: InjectionDetection,
) {
  if (!detection.detected) return evaluation;
  const signalNote = `Kod tarafı sinyalleri: ${detection.signals.join(", ")}.`;

  return evaluationOutputSchema.parse({
    ...evaluation,
    injection_detected: true,
    injection_note: evaluation.injection_note
      ? `${evaluation.injection_note} ${signalNote}`
      : signalNote,
  });
}

export async function runEvaluationAgent(input: {
  systemPrompt: string;
  userPrompt: string;
  cvBytes?: Uint8Array;
  cvFileName?: string;
  cvText?: string;
  repoFileTool: RepoFileTool;
  codeInjectionDetection: InjectionDetection;
  client?: OpenAI;
  model?: string;
  promptCacheEnabled?: boolean;
  complete?: (params: CompletionParams) => Promise<ChatCompletion>;
}): Promise<EvaluationAgentResult> {
  if (!input.cvText && (!input.cvBytes || !input.cvFileName)) {
    throw new Error("A PDF or CV text is required for evaluation.");
  }
  const config = input.model
    ? {
        model: input.model,
        promptCacheEnabled: input.promptCacheEnabled ?? false,
      }
    : getOpenRouterConfig();
  const complete =
    input.complete ??
    ((params: CompletionParams) => {
      const client = input.client ?? createOpenRouterClient();
      return client.chat.completions.create(params);
    });
  const messages: ChatMessage[] = [
    systemMessage(input.systemPrompt, config.model, config.promptCacheEnabled),
    userMessage({
      prompt: input.userPrompt,
      cvBytes: input.cvBytes,
      cvFileName: input.cvFileName,
      cvText: input.cvText,
    }),
  ];
  const rawResponses: unknown[] = [];
  let validationFailures = 0;
  let forceSubmission = false;

  for (let turn = 0; turn < MAX_AGENT_TURNS; turn += 1) {
    const allowRepoTool =
      !forceSubmission && input.repoFileTool.callCount < MAX_REPO_FILE_CALLS;
    const tools = allowRepoTool
      ? [fetchRepoFileToolDefinition, submitEvaluationToolDefinition]
      : [submitEvaluationToolDefinition];
    const params: CompletionParams = {
      model: config.model,
      messages,
      tools,
      tool_choice: allowRepoTool
        ? "required"
        : {
            type: "function",
            function: { name: "submit_evaluation" },
          },
      reasoning_effort: "high",
      max_completion_tokens: MAX_OUTPUT_TOKENS,
      plugins: input.cvBytes
        ? [{ id: "file-parser", pdf: { engine: "mistral-ocr" } }]
        : undefined,
    };
    const completion = await runOpenRouterRequest(() => complete(params));
    rawResponses.push(completion);
    const message = completion.choices[0]?.message;
    if (!message) {
      validationFailures += 1;
      forceSubmission = true;
      if (validationFailures > 1) break;
      messages.push({
        role: "user",
        content:
          "Önceki yanıtta mesaj yoktu. submit_evaluation tool'unu geçerli tüm alanlarla çağır.",
      });
      continue;
    }

    messages.push(assistantMessage(message));
    const toolCalls = message.tool_calls ?? [];
    if (toolCalls.length === 0) {
      validationFailures += 1;
      forceSubmission = true;
      if (validationFailures > 1) break;
      messages.push({
        role: "user",
        content:
          "Düz metin yanıt kabul edilmiyor. submit_evaluation tool'unu geçerli tüm alanlarla çağır.",
      });
      continue;
    }

    for (const toolCall of toolCalls) {
      if (toolCall.type !== "function") continue;
      if (toolCall.function.name === "fetch_repo_file") {
        let args: unknown;
        try {
          args = JSON.parse(toolCall.function.arguments);
        } catch {
          args = null;
        }
        const result = await input.repoFileTool.execute(args);
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
        if (result.status === "limit_reached") forceSubmission = true;
        continue;
      }

      if (toolCall.function.name === "submit_evaluation") {
        try {
          const parsed = evaluationOutputSchema.parse(
            JSON.parse(toolCall.function.arguments),
          );
          return {
            evaluation: applyCodeInjectionDetection(
              parsed,
              input.codeInjectionDetection,
            ),
            rawResponses,
            toolCallCount: input.repoFileTool.callCount,
            model: completion.model || config.model,
          };
        } catch (error) {
          validationFailures += 1;
          forceSubmission = true;
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify({
              status: "invalid_evaluation",
              error: validationMessage(error),
              instruction:
                "Correct every listed issue and call submit_evaluation once more.",
            }),
          });
          if (validationFailures > 1) {
            throw new EvaluationAgentError(
              "The model returned an invalid evaluation twice.",
              rawResponses,
              input.repoFileTool.callCount,
            );
          }
        }
      }
    }
  }

  throw new EvaluationAgentError(
    "The model did not submit a valid evaluation.",
    rawResponses,
    input.repoFileTool.callCount,
  );
}

type StoredApplication = EvaluationPromptApplication & {
  id: string;
  cv_storage_path: string;
  cv_file_name: string;
};

export type EvaluateApplicationResult = {
  application_id: string;
  evaluation_id: string | null;
  status: "done" | "failed";
};

function mergeInjectionDetections(
  ...detections: InjectionDetection[]
): InjectionDetection {
  const signals = [...new Set(detections.flatMap((item) => item.signals))];
  return { detected: signals.length > 0, signals };
}

function safeAuditError(error: unknown) {
  if (error instanceof OpenRouterRequestError) {
    return `${error.kind}: ${error.message}`;
  }
  if (error instanceof EvaluationAgentError) return error.message;
  return "Evaluation pipeline failed.";
}

async function updateApplicationEvaluationStatus(
  applicationId: string,
  status: "done" | "failed",
  errorMessage: string | null,
) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("applications")
    .update({ status, error_message: errorMessage })
    .eq("id", applicationId);
  if (error) throw error;
}

export async function evaluateApplication(
  applicationId: string,
  prepared?: { cvBytes?: Uint8Array; pdfText?: string },
): Promise<EvaluateApplicationResult> {
  const runId = crypto.randomUUID();
  const startedAt = Date.now();
  let rawResponses: unknown[] = [];
  let toolCallCount = 0;
  let attemptsRecorded = false;
  let model = process.env.OPENROUTER_MODEL_JUDGE?.trim() || "unknown";

  try {
    const supabase = createSupabaseAdminClient();
    const [applicationResult, enrichmentResult, rubric] = await Promise.all([
      supabase
        .from("applications")
        .select(
          "id, full_name, department_year, technologies, bonus_tools, links, self_introduction, llm_experience, office_days_per_week, location_note, cv_storage_path, cv_file_name",
        )
        .eq("id", applicationId)
        .single(),
      supabase
        .from("enrichment_results")
        .select("source, url, status, data, error, duration_ms")
        .eq("application_id", applicationId)
        .order("fetched_at", { ascending: true }),
      getActiveRubric(),
    ]);
    if (applicationResult.error) throw applicationResult.error;
    if (enrichmentResult.error) throw enrichmentResult.error;
    const application = applicationResult.data as StoredApplication;
    const enrichment = enrichmentResult.data as EvaluationPromptEnrichment[];

    let cvBytes = prepared?.cvBytes;
    if (!cvBytes) {
      const { data: cv, error: downloadError } = await supabase.storage
        .from("cvs")
        .download(application.cv_storage_path);
      if (downloadError || !cv) {
        throw downloadError ?? new Error("CV download returned no data");
      }
      cvBytes = new Uint8Array(await cv.arrayBuffer());
    }

    let pdfText = prepared?.pdfText ?? "";
    if (!prepared?.pdfText) {
      try {
        pdfText = (await extractPdfLinkMaterial(cvBytes.slice())).text;
      } catch (error) {
        console.warn("PDF text could not be inspected for injection", error);
      }
    }

    const prompts = buildEvaluationPrompts({ application, enrichment });
    const codeInjectionDetection = mergeInjectionDetections(
      prompts.codeInjectionDetection,
      detectPromptInjection([pdfText]),
    );
    const config = getOpenRouterConfig();
    model = config.model;
    const repoFileTool = new RepoFileTool(
      collectAllowedRepositories(enrichment),
    );
    const agentResult = await runEvaluationAgent({
      systemPrompt: prompts.system,
      userPrompt: prompts.user,
      cvBytes,
      cvFileName: application.cv_file_name,
      repoFileTool,
      codeInjectionDetection,
      model: config.model,
      promptCacheEnabled: config.promptCacheEnabled,
    });
    rawResponses = agentResult.rawResponses;
    toolCallCount = agentResult.toolCallCount;
    model = agentResult.model;
    const score = calculateEvaluationScore({
      criteria: agentResult.evaluation.criteria,
      weights: rubric.weights,
      modelRecommendation: agentResult.evaluation.recommendation,
      officeDaysPerWeek: application.office_days_per_week,
    });
    const durationMs = Date.now() - startedAt;

    await recordEvaluationAttempts({
      applicationId,
      evaluationId: null,
      runId,
      model,
      toolCallCount,
      durationMs,
      rawResponses,
      success: true,
    });
    attemptsRecorded = true;
    const evaluation = await createEvaluationRecord({
      applicationId,
      rubricVersionId: rubric.id,
      evaluation: agentResult.evaluation,
      score,
      model,
      toolCallCount,
      durationMs,
      rawResponses,
    });
    try {
      await createEmailDraftRecord({
        applicationId,
        evaluationId: evaluation.id,
        draftType: score.final_recommendation,
        draft: selectInitialEmailDraft({
          fullName: application.full_name,
          finalRecommendation: score.final_recommendation,
          evaluation: agentResult.evaluation,
        }),
      });
    } catch (error) {
      console.error("Evaluation email draft could not be saved", error);
    }
    try {
      await linkEvaluationAttempts(runId, evaluation.id);
    } catch (error) {
      console.error("Evaluation attempts could not be linked", error);
    }
    await updateApplicationEvaluationStatus(applicationId, "done", null);

    return {
      application_id: applicationId,
      evaluation_id: evaluation.id,
      status: "done",
    };
  } catch (error) {
    console.error("Application evaluation failed", error);
    if (error instanceof EvaluationAgentError) {
      rawResponses = error.rawResponses;
      toolCallCount = error.toolCallCount;
    }
    const errorMessage = safeAuditError(error);
    if (!attemptsRecorded) {
      try {
        await recordEvaluationAttempts({
          applicationId,
          evaluationId: null,
          runId,
          model,
          toolCallCount,
          durationMs: Date.now() - startedAt,
          rawResponses,
          success: false,
          errorMessage,
        });
      } catch (attemptError) {
        console.error(
          "Evaluation failure attempt could not be saved",
          attemptError,
        );
      }
    }
    await updateApplicationEvaluationStatus(
      applicationId,
      "failed",
      "Başvuru değerlendirmesi tamamlanamadı.",
    );
    return {
      application_id: applicationId,
      evaluation_id: null,
      status: "failed",
    };
  }
}

export async function evaluateText(input: {
  candidateText: string;
  officeDaysPerWeek?: string;
}) {
  const application: EvaluationPromptApplication = {
    full_name: "Serbest metin adayı",
    department_year: "(metinden değerlendir)",
    technologies: "(metinden değerlendir)",
    bonus_tools: [],
    links: null,
    self_introduction: "(metinden değerlendir)",
    llm_experience: "(metinden değerlendir)",
    office_days_per_week: input.officeDaysPerWeek ?? "relocation_needed",
    location_note: null,
  };
  const [prompts, rubric] = await Promise.all([
    Promise.resolve(buildEvaluationPrompts({ application, enrichment: [] })),
    getActiveRubric(),
  ]);
  const config = getOpenRouterConfig();
  const agentResult = await runEvaluationAgent({
    systemPrompt: prompts.system,
    userPrompt: prompts.user,
    cvText: input.candidateText,
    repoFileTool: new RepoFileTool([]),
    codeInjectionDetection: mergeInjectionDetections(
      prompts.codeInjectionDetection,
      detectPromptInjection([input.candidateText]),
    ),
    model: config.model,
    promptCacheEnabled: config.promptCacheEnabled,
  });
  const score = calculateEvaluationScore({
    criteria: agentResult.evaluation.criteria,
    weights: rubric.weights,
    modelRecommendation: agentResult.evaluation.recommendation,
    officeDaysPerWeek: application.office_days_per_week,
  });
  return {
    evaluation: agentResult.evaluation,
    score,
    rubric_version_id: rubric.id,
    model: agentResult.model,
    tool_call_count: agentResult.toolCallCount,
  };
}
