import { beforeEach, describe, expect, it } from "vitest";

import {
  ADMIN_SESSION_DURATION_SECONDS,
  createAdminSessionToken,
  verifyAdminPassword,
  verifyAdminSessionToken,
} from "@/lib/auth/session";

describe("admin session", () => {
  beforeEach(() => {
    process.env.ADMIN_PASSWORD = "a-long-test-admin-password";
  });

  it("creates an eight-hour signed session", async () => {
    const now = Date.UTC(2026, 7, 13, 12);
    const token = await createAdminSessionToken(now);

    expect(await verifyAdminSessionToken(token, now)).toBe(true);
    expect(
      await verifyAdminSessionToken(
        token,
        now + ADMIN_SESSION_DURATION_SECONDS * 1000,
      ),
    ).toBe(false);
  });

  it("rejects tampered sessions and incorrect passwords", async () => {
    const token = await createAdminSessionToken();
    const [payload, signature] = token.split(".");

    expect(await verifyAdminSessionToken(`${payload}x.${signature}`)).toBe(
      false,
    );
    expect(await verifyAdminPassword("wrong-password")).toBe(false);
    expect(await verifyAdminPassword("a-long-test-admin-password")).toBe(true);
  });
});
