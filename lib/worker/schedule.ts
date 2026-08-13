import "server-only";

import { after } from "next/server";

export function scheduleApplicationProcessing(applicationId: string) {
  after(async () => {
    const { processApplicationLinks } =
      await import("@/lib/worker/process-application");
    await processApplicationLinks(applicationId);
  });
}

export function scheduleApplicationReevaluation(applicationId: string) {
  after(async () => {
    const { evaluateApplication } = await import("@/lib/evaluation/evaluate");
    await evaluateApplication(applicationId);
  });
}
