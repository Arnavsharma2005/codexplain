import { describe, expect, it } from "vitest";
import type { AdapterAccount } from "next-auth/adapters";
import { storedAccount } from "@/lib/auth-account";

describe("storedAccount", () => {
  const fromGitHub = {
    userId: "u1",
    type: "oauth",
    provider: "github",
    providerAccountId: "123",
    access_token: "gho_secret",
    refresh_token: "ghr_secret",
    expires_at: 1_800_000_000,
    refresh_token_expires_in: 15_897_600,
    token_type: "bearer",
    scope: "read:user,user:email",
  } as unknown as AdapterAccount;

  it("drops tokens and fields the Account table doesn't have", () => {
    expect(storedAccount(fromGitHub)).toEqual({
      userId: "u1",
      type: "oauth",
      provider: "github",
      providerAccountId: "123",
      token_type: "bearer",
      scope: "read:user,user:email",
    });
  });

  it("never stores a credential", () => {
    expect(JSON.stringify(storedAccount(fromGitHub))).not.toMatch(/secret/);
  });
});
