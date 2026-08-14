import "server-only";

import { after } from "next/server";

function startApplicationProcessing(
  applicationId: string,
  options?: { alreadyClaimed: boolean },
) {
  const processing = import("@/lib/worker/process-application").then(
    ({ processApplicationLinks }) =>
      processApplicationLinks(applicationId, options),
  );

  // Start the worker while the request is still active, then keep the
  // serverless invocation alive until that same promise settles.
  after(() => processing);
}

export function scheduleApplicationProcessing(applicationId: string) {
  startApplicationProcessing(applicationId);
}

export function scheduleApplicationReevaluation(applicationId: string) {
  startApplicationProcessing(applicationId, { alreadyClaimed: true });
}
