import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function generateToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export async function hashToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export async function tokenMatches(token: string, expectedHash: string) {
  if (!/^[a-f0-9]{64}$/i.test(expectedHash)) {
    return false;
  }

  const actual = Buffer.from(await hashToken(token), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
