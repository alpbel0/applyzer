export const ADMIN_SESSION_COOKIE = "applyzer_admin_session";
export const ADMIN_SESSION_DURATION_SECONDS = 8 * 60 * 60;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

type AdminSessionPayload = {
  role: "admin";
  issued_at: number;
  expires_at: number;
  version: 1;
};

function sessionSecret() {
  const value = process.env.ADMIN_PASSWORD?.trim();
  if (!value) throw new Error("ADMIN_PASSWORD is not configured.");
  return value;
}

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

function fromBase64Url(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "=",
  );
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function hmacKey() {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(sessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function createAdminSessionToken(now = Date.now()) {
  const issuedAt = Math.floor(now / 1000);
  const payload: AdminSessionPayload = {
    role: "admin",
    issued_at: issuedAt,
    expires_at: issuedAt + ADMIN_SESSION_DURATION_SECONDS,
    version: 1,
  };
  const encodedPayload = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign(
    "HMAC",
    await hmacKey(),
    encoder.encode(encodedPayload),
  );
  return `${encodedPayload}.${toBase64Url(new Uint8Array(signature))}`;
}

export async function verifyAdminSessionToken(
  token: string | null | undefined,
  now = Date.now(),
) {
  if (!token) return false;
  const [encodedPayload, encodedSignature, extra] = token.split(".");
  if (!encodedPayload || !encodedSignature || extra) return false;

  try {
    const validSignature = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(),
      fromBase64Url(encodedSignature),
      encoder.encode(encodedPayload),
    );
    if (!validSignature) return false;

    const payload = JSON.parse(
      decoder.decode(fromBase64Url(encodedPayload)),
    ) as Partial<AdminSessionPayload>;
    const nowSeconds = Math.floor(now / 1000);
    return (
      payload.role === "admin" &&
      payload.version === 1 &&
      typeof payload.issued_at === "number" &&
      typeof payload.expires_at === "number" &&
      payload.issued_at <= nowSeconds + 60 &&
      payload.expires_at > nowSeconds &&
      payload.expires_at - payload.issued_at === ADMIN_SESSION_DURATION_SECONDS
    );
  } catch {
    return false;
  }
}

export async function verifyAdminPassword(candidate: string) {
  const expected = encoder.encode(sessionSecret());
  const received = encoder.encode(candidate);
  const [expectedHash, receivedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", expected),
    crypto.subtle.digest("SHA-256", received),
  ]);
  const left = new Uint8Array(expectedHash);
  const right = new Uint8Array(receivedHash);
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}
