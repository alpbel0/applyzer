import {
  CRITERION_KEYS,
  type CriterionKey,
  type EvaluationOutput,
} from "@/lib/schemas/evaluation";

export type RubricWeights = Record<CriterionKey, number>;

export type ScoreBreakdownItem = {
  key: CriterionKey;
  score: number;
  weight: number;
  contribution: number;
};

export type ScoreResult = {
  final_score: number;
  score_breakdown: ScoreBreakdownItem[];
  model_recommendation: EvaluationOutput["recommendation"];
  final_recommendation: EvaluationOutput["recommendation"];
  override_reason: string | null;
};

const SCORE_EPSILON = 0.000001;

function roundToTwo(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function assertValidWeights(weights: RubricWeights) {
  const values = CRITERION_KEYS.map((key) => weights[key]);
  if (values.some((weight) => !Number.isFinite(weight) || weight < 0)) {
    throw new Error("Rubric weights must be finite, non-negative numbers.");
  }

  const total = values.reduce((sum, weight) => sum + weight, 0);
  if (Math.abs(total - 1) > SCORE_EPSILON) {
    throw new Error("Rubric weights must total 1.");
  }
}

export function recommendationFromScore(
  score: number,
): EvaluationOutput["recommendation"] {
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    throw new Error("Score must be between 0 and 100.");
  }
  if (score >= 70) return "yes";
  if (score >= 50) return "maybe";
  return "no";
}

export function calculateEvaluationScore(input: {
  criteria: EvaluationOutput["criteria"];
  weights: RubricWeights;
  modelRecommendation: EvaluationOutput["recommendation"];
  officeDaysPerWeek: string;
}): ScoreResult {
  assertValidWeights(input.weights);

  const scoreBreakdown = CRITERION_KEYS.map((key) => {
    const score = input.criteria[key].score;
    const weight = input.weights[key];
    return {
      key,
      score,
      weight,
      contribution: roundToTwo((score * weight * 100) / 5),
    };
  });
  const finalScore = roundToTwo(
    scoreBreakdown.reduce((sum, item) => sum + item.contribution, 0),
  );
  const thresholdRecommendation = recommendationFromScore(finalScore);
  const remoteOverride =
    input.officeDaysPerWeek === "remote_only" &&
    thresholdRecommendation === "yes";
  const finalRecommendation = remoteOverride
    ? "maybe"
    : thresholdRecommendation;

  const reasons: string[] = [];
  if (input.modelRecommendation !== thresholdRecommendation) {
    reasons.push(
      `Model recommendation '${input.modelRecommendation}' was replaced by the deterministic score threshold '${thresholdRecommendation}'.`,
    );
  }
  if (remoteOverride) {
    reasons.push(
      "Remote-only availability (0 office days) downgraded 'yes' to 'maybe'.",
    );
  }

  return {
    final_score: finalScore,
    score_breakdown: scoreBreakdown,
    model_recommendation: input.modelRecommendation,
    final_recommendation: finalRecommendation,
    override_reason: reasons.length > 0 ? reasons.join(" ") : null,
  };
}
