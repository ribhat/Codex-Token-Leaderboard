import { describe, expect, it } from "vitest";
import { hashToken, tokenMatches } from "@/lib/crypto";

describe("crypto", () => {
  it("matches a token against its hash", async () => {
    await expect(tokenMatches("invite-secret", await hashToken("invite-secret"))).resolves.toBe(true);
  });

  it("rejects a token that does not match a hash", async () => {
    await expect(tokenMatches("wrong-secret", await hashToken("invite-secret"))).resolves.toBe(false);
  });

  it("rejects a malformed expected hash without throwing", async () => {
    await expect(tokenMatches("invite-secret", "not-a-hex-hash")).resolves.toBe(false);
  });
});
