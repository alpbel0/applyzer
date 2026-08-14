import "server-only";

import { z } from "zod";

const demoEnvironmentSchema = z.object({
  DEMO_MODE: z.string().optional(),
  DEMO_EMAIL_TO: z.email().optional(),
  GMAIL_USER: z.email(),
});

export type EmailDeliveryTarget = {
  demoMode: boolean;
  recipient: string;
};

export function resolveEmailDeliveryTarget(
  candidateEmail: string,
  environment: Record<string, string | undefined> = process.env,
): EmailDeliveryTarget {
  const parsed = demoEnvironmentSchema.parse(environment);
  const demoMode = parsed.DEMO_MODE?.trim().toLowerCase() !== "false";

  return {
    demoMode,
    recipient: demoMode
      ? (parsed.DEMO_EMAIL_TO ?? parsed.GMAIL_USER)
      : z.email().parse(candidateEmail),
  };
}
