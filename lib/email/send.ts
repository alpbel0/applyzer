import "server-only";

import nodemailer from "nodemailer";
import { z } from "zod";

const gmailEnvironmentSchema = z.object({
  GMAIL_USER: z.email(),
  GMAIL_APP_PASSWORD: z.string().min(16),
});

export type GmailMessage = {
  to: string;
  subject: string;
  body: string;
};

type MailTransport = Pick<
  ReturnType<typeof nodemailer.createTransport>,
  "sendMail"
>;

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function emailHtml(body: string) {
  return body
    .split(/\n{2,}/u)
    .map(
      (paragraph) =>
        `<p style="margin:0 0 16px;line-height:1.65">${escapeHtml(paragraph).replaceAll("\n", "<br>")}</p>`,
    )
    .join("");
}

export function createGmailTransport(
  environment: Record<string, string | undefined> = process.env,
) {
  const parsed = gmailEnvironmentSchema.parse(environment);
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: parsed.GMAIL_USER,
      pass: parsed.GMAIL_APP_PASSWORD.replaceAll(" ", ""),
    },
  });
}

export async function sendGmailMessage(
  message: GmailMessage,
  options?: {
    environment?: Record<string, string | undefined>;
    transport?: MailTransport;
  },
) {
  const environment = options?.environment ?? process.env;
  const parsed = gmailEnvironmentSchema.parse(environment);
  const transport = options?.transport ?? createGmailTransport(environment);
  const result = await transport.sendMail({
    from: `Kovan Startup Studio <${parsed.GMAIL_USER}>`,
    replyTo: parsed.GMAIL_USER,
    to: z.email().parse(message.to),
    subject: message.subject,
    text: message.body,
    html: `<div style="font-family:Arial,sans-serif;color:#16213e;max-width:620px">${emailHtml(message.body)}</div>`,
  });

  const accepted = result.accepted
    .map(String)
    .some((address) => address.toLowerCase() === message.to.toLowerCase());
  if (!result.messageId || !accepted) {
    throw new Error("Gmail did not accept the message.");
  }
  return { providerId: result.messageId };
}
