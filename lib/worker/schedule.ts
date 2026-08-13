import "server-only";

import { after } from "next/server";

import { processApplicationLinks } from "@/lib/worker/process-application";

export function scheduleApplicationProcessing(applicationId: string) {
  after(async () => {
    await processApplicationLinks(applicationId);
  });
}
