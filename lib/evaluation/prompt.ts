import { readFileSync } from "node:fs";
import path from "node:path";

import {
  detectPromptInjection,
  sanitizeUntrustedValue,
  type InjectionDetection,
} from "@/lib/evaluation/sanitize";

export type EvaluationPromptApplication = {
  full_name: string;
  department_year: string;
  technologies: string;
  bonus_tools: string[];
  links: string | null;
  self_introduction: string;
  llm_experience: string;
  office_days_per_week: string;
};

export type EvaluationPromptEnrichment = {
  source: string;
  url: string;
  status: string;
  data: unknown;
  error?: string | null;
  duration_ms?: number | null;
};

export type EvaluationPrompts = {
  system: string;
  user: string;
  codeInjectionDetection: InjectionDetection;
};

let promptCache: { system: string; userTemplate: string } | null = null;

function loadPromptFiles() {
  if (promptCache) return promptCache;
  promptCache = {
    system: readFileSync(
      path.join(process.cwd(), "prompts", "system.md"),
      "utf8",
    ).trim(),
    userTemplate: readFileSync(
      path.join(process.cwd(), "prompts", "user-template.md"),
      "utf8",
    ).trim(),
  };
  return promptCache;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function compactEnrichment(rows: EvaluationPromptEnrichment[]) {
  const output: unknown[] = [];
  const githubOwners = new Map<
    string,
    {
      source: "github";
      username: string;
      urls: string[];
      results: Array<{ status: string; error: string | null }>;
      data: Record<string, unknown>;
      requested_repositories: unknown[];
    }
  >();

  for (const row of rows) {
    if (
      row.source !== "github" ||
      !isRecord(row.data) ||
      typeof row.data.username !== "string"
    ) {
      output.push(row);
      continue;
    }

    const username = row.data.username.toLowerCase();
    let owner = githubOwners.get(username);
    if (!owner) {
      const ownerData = { ...row.data };
      delete ownerData.requested_repository;
      owner = {
        source: "github",
        username: row.data.username,
        urls: [],
        results: [],
        data: ownerData,
        requested_repositories: [],
      };
      githubOwners.set(username, owner);
      output.push(owner);
    }

    if (!owner.urls.includes(row.url)) owner.urls.push(row.url);
    owner.results.push({ status: row.status, error: row.error ?? null });
    if (
      row.data.requested_repository !== null &&
      row.data.requested_repository !== undefined
    ) {
      const serialized = JSON.stringify(row.data.requested_repository);
      if (
        !owner.requested_repositories.some(
          (repository) => JSON.stringify(repository) === serialized,
        )
      ) {
        owner.requested_repositories.push(row.data.requested_repository);
      }
    }
  }

  return output;
}

function fallback(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "(işaretlenmemiş)";
}

export function buildEvaluationPrompts(input: {
  application: EvaluationPromptApplication;
  enrichment: EvaluationPromptEnrichment[];
}): EvaluationPrompts {
  const { system, userTemplate } = loadPromptFiles();
  const compactedEnrichment = compactEnrichment(input.enrichment);
  const safeApplication = sanitizeUntrustedValue(input.application);
  const safeEnrichment = sanitizeUntrustedValue(compactedEnrichment);
  const enrichmentJson = JSON.stringify(safeEnrichment, null, 2);
  const replacements: Record<string, string> = {
    "{{ad_soyad}}": fallback(safeApplication.full_name),
    "{{bolum_sinif}}": fallback(safeApplication.department_year),
    "{{teknolojiler}}": fallback(safeApplication.technologies),
    "{{bonus_araclar}}":
      safeApplication.bonus_tools.length > 0
        ? safeApplication.bonus_tools.join(", ")
        : "(işaretlenmemiş)",
    "{{linkler}}": fallback(safeApplication.links),
    "{{kendini_tanit}}": fallback(safeApplication.self_introduction),
    "{{llm_deneyimi}}": fallback(safeApplication.llm_experience),
    "{{ofis_gun}}": fallback(safeApplication.office_days_per_week),
    "{{enrichment_json}}": enrichmentJson,
  };
  const user = Object.entries(replacements).reduce(
    (prompt, [token, value]) => prompt.replaceAll(token, value),
    userTemplate,
  );

  return {
    system,
    user,
    codeInjectionDetection: detectPromptInjection([
      input.application.full_name,
      input.application.department_year,
      input.application.technologies,
      input.application.links,
      input.application.self_introduction,
      input.application.llm_experience,
      JSON.stringify(compactedEnrichment),
    ]),
  };
}
