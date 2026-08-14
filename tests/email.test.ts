import { describe, expect, it, vi } from "vitest";

import { resolveEmailDeliveryTarget } from "@/lib/email/demo-guard";
import { sendGmailMessage } from "@/lib/email/send";
import { buildEmailDraft, isEmailDraftSafe } from "@/lib/email/templates";

const gmailEnvironment = {
  GMAIL_USER: "owner@example.com",
  GMAIL_APP_PASSWORD: "abcdefghijklmnop",
};

describe("email delivery guard", () => {
  it("defaults to demo mode and redirects mail to the Gmail owner", () => {
    expect(
      resolveEmailDeliveryTarget("candidate@example.com", gmailEnvironment),
    ).toEqual({ demoMode: true, recipient: "owner@example.com" });
  });

  it("uses an explicit demo recipient when configured", () => {
    expect(
      resolveEmailDeliveryTarget("candidate@example.com", {
        ...gmailEnvironment,
        DEMO_MODE: "true",
        DEMO_EMAIL_TO: "test@example.com",
      }),
    ).toEqual({ demoMode: true, recipient: "test@example.com" });
  });

  it("uses the candidate only when demo mode is explicitly disabled", () => {
    expect(
      resolveEmailDeliveryTarget("candidate@example.com", {
        ...gmailEnvironment,
        DEMO_MODE: "false",
      }),
    ).toEqual({ demoMode: false, recipient: "candidate@example.com" });
  });
});

describe("candidate email templates", () => {
  it.each(["yes", "maybe", "no"] as const)(
    "builds a safe %s template within schema limits",
    (draftType) => {
      const draft = buildEmailDraft("Ada Aday", draftType);
      expect(isEmailDraftSafe(draft, draftType)).toBe(true);
      expect(draft.body).not.toMatch(/skor|puan|rubric|yapay zeka/iu);
    },
  );

  it("rejects score and AI disclosure", () => {
    expect(
      isEmailDraftSafe(
        {
          subject: "Başvurunuz",
          body: "Yapay zeka değerlendirmesinde 82 puan aldınız.",
        },
        "yes",
      ),
    ).toBe(false);
  });

  it("keeps rejection emails free of reasons", () => {
    const rejection = buildEmailDraft("Ada Aday", "no");
    expect(rejection.body).not.toMatch(/çünkü|nedeni|sebebi|yetersiz|eksik/iu);
  });
});

describe("Gmail sender", () => {
  it("sends text and escaped HTML with the configured account", async () => {
    const sendMail = vi.fn().mockResolvedValue({
      messageId: "gmail-message-id",
      accepted: ["candidate@example.com"],
    });
    const result = await sendGmailMessage(
      {
        to: "candidate@example.com",
        subject: "Başvurunuz",
        body: "Merhaba <Ada> & arkadaşları",
      },
      {
        environment: gmailEnvironment,
        transport: { sendMail } as never,
      },
    );

    expect(result).toEqual({ providerId: "gmail-message-id" });
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "Kovan Startup Studio <owner@example.com>",
        to: "candidate@example.com",
        text: "Merhaba <Ada> & arkadaşları",
        html: expect.stringContaining("&lt;Ada&gt; &amp; arkadaşları"),
      }),
    );
  });
});
