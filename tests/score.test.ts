import { describe, expect, it } from "vitest";

import {
  calculateEvaluationScore,
  recommendationFromScore,
  type RubricWeights,
} from "@/lib/evaluation/score";
import { CRITERION_KEYS } from "@/lib/schemas/evaluation";

const weights: RubricWeights = {
  rest_api: 0.15,
  llm_experience: 0.2,
  agentic_mcp: 0.2,
  bonus_tools: 0.15,
  verifiability: 0.15,
  learning_signal: 0.1,
  cv_quality: 0.05,
};

function criteriaWithScore(score: number) {
  return Object.fromEntries(
    CRITERION_KEYS.map((key) => [key, { score, evidence: `${key} evidence` }]),
  ) as Parameters<typeof calculateEvaluationScore>[0]["criteria"];
}

describe("recommendationFromScore", () => {
  it("applies the exact threshold boundaries", () => {
    expect(recommendationFromScore(70)).toBe("yes");
    expect(recommendationFromScore(69.9)).toBe("maybe");
    expect(recommendationFromScore(50)).toBe("maybe");
    expect(recommendationFromScore(49.9)).toBe("no");
  });
});

describe("calculateEvaluationScore", () => {
  it("calculates weighted contributions and the normalized score", () => {
    const result = calculateEvaluationScore({
      criteria: criteriaWithScore(3),
      weights,
      modelRecommendation: "maybe",
      officeDaysPerWeek: "3",
    });

    expect(result.final_score).toBe(60);
    expect(
      result.score_breakdown.reduce(
        (sum, criterion) => sum + criterion.contribution,
        0,
      ),
    ).toBe(60);
    expect(result.final_recommendation).toBe("maybe");
    expect(result.override_reason).toBeNull();
  });

  it("treats remote-only as zero office days and only downgrades yes", () => {
    const result = calculateEvaluationScore({
      criteria: criteriaWithScore(4),
      weights,
      modelRecommendation: "yes",
      officeDaysPerWeek: "remote_only",
    });

    expect(result.final_score).toBe(80);
    expect(result.final_recommendation).toBe("maybe");
    expect(result.override_reason).toContain("0 office days");
  });

  it("does not downgrade relocation-needed availability", () => {
    const result = calculateEvaluationScore({
      criteria: criteriaWithScore(4),
      weights,
      modelRecommendation: "yes",
      officeDaysPerWeek: "relocation_needed",
    });

    expect(result.final_recommendation).toBe("yes");
    expect(result.override_reason).toBeNull();
  });

  it("rejects rubric weights that do not total one", () => {
    expect(() =>
      calculateEvaluationScore({
        criteria: criteriaWithScore(3),
        weights: { ...weights, cv_quality: 0.1 },
        modelRecommendation: "maybe",
        officeDaysPerWeek: "3",
      }),
    ).toThrow("Rubric weights must total 1");
  });
});
