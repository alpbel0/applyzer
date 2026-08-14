import { afterEach, describe, expect, it, vi } from "vitest";

const after = vi.fn();
const processApplicationLinks = vi.fn();

vi.mock("next/server", () => ({ after }));
vi.mock("@/lib/worker/process-application", () => ({
  processApplicationLinks,
}));

describe("worker scheduler", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("starts processing before the after callback runs", async () => {
    processApplicationLinks.mockResolvedValue(undefined);
    const { scheduleApplicationProcessing } =
      await import("@/lib/worker/schedule");

    scheduleApplicationProcessing("application-1");

    await vi.waitFor(() => {
      expect(processApplicationLinks).toHaveBeenCalledWith(
        "application-1",
        undefined,
      );
    });
    expect(after).toHaveBeenCalledOnce();

    const keepAlive = after.mock.calls[0]?.[0] as () => Promise<unknown>;
    await expect(keepAlive()).resolves.toBeUndefined();
  });

  it("preserves the already-claimed flag for reevaluation", async () => {
    processApplicationLinks.mockResolvedValue(undefined);
    const { scheduleApplicationReevaluation } =
      await import("@/lib/worker/schedule");

    scheduleApplicationReevaluation("application-2");

    await vi.waitFor(() => {
      expect(processApplicationLinks).toHaveBeenCalledWith("application-2", {
        alreadyClaimed: true,
      });
    });
  });
});
