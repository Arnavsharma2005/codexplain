import type { AdapterAccount } from "next-auth/adapters";

/**
 * The row we store for a linked OAuth account. Only the columns of the Prisma
 * `Account` model are kept, and never the OAuth tokens: the GitHub token
 * lives only in the encrypted session cookie, so a database leak exposes no
 * credentials. Whitelisting also matters because GitHub can return extra
 * fields (for example `refresh_token_expires_in` for apps with expiring
 * tokens) that Prisma rejects, which would fail the sign-in half-way.
 */
export function storedAccount(account: AdapterAccount): AdapterAccount {
  return {
    userId: account.userId,
    type: account.type,
    provider: account.provider,
    providerAccountId: account.providerAccountId,
    token_type: account.token_type,
    scope: account.scope,
  };
}
