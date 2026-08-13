import "server-only";

import { after } from "next/server";

export function scheduleApplicationProcessing(applicationId: string) {
  after(async () => {
    const { processApplicationLinks } =
      await import("@/lib/worker/process-application");
    await processApplicationLinks(applicationId);
  });
}
