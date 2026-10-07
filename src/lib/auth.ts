import "server-only";
import type { NextAuthOptions } from "next-auth";
import type { Adapter, AdapterAccount } from "next-auth/adapters";
import GitHubProvider from "next-auth/providers/github";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { cookies } from "next/headers";
import { decode } from "next-auth/jwt";
import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

/**
 * Prisma adapter that never writes OAuth tokens to the database. The GitHub
 * token is kept only in the encrypted JWT session cookie, so a database leak
 * exposes no credentials.
 */
function tokenlessAdapter(): Adapter {
  const base = PrismaAdapter(db) as Adapter;
  return {
    ...base,
    linkAccount: (account: AdapterAccount) =>
      base.linkAccount!({
        ...account,
        access_token: undefined,
        refresh_token: undefined,
        id_token: undefined,
        expires_at: undefined,
        session_state: undefined,
      }),
  };
}

export function authOptions(): NextAuthOptions {
  const e = env();
  return {
    adapter: tokenlessAdapter(),
    secret: e.NEXTAUTH_SECRET,
    session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
    providers: [
      GitHubProvider({
        clientId: e.GITHUB_ID,
        clientSecret: e.GITHUB_SECRET,
        // Public data only: we never ask for access to private repositories.
        authorization: { params: { scope: "read:user user:email" } },
      }),
    ],
    pages: { signIn: "/login", error: "/login" },
    callbacks: {
      async jwt({ token, account, profile }) {
        if (account?.provider === "github") {
          token.accessToken = account.access_token;
          const login = (profile as { login?: string } | undefined)?.login ?? null;
          token.login = login;
          if (token.sub && login) {
            await db.user.update({ where: { id: token.sub }, data: { githubLogin: login } }).catch(() => undefined);
          }
        }
        return token;
      },
      async session({ session, token }) {
        // Deliberately does NOT copy accessToken onto the session object.
        if (session.user && token.sub) {
          session.user.id = token.sub;
          session.user.login = token.login ?? null;
        }
        return session;
      },
    },
  };
}

export async function getSession() {
  return getServerSession(authOptions());
}

const SESSION_COOKIES = ["__Secure-next-auth.session-token", "next-auth.session-token"];

/** Reads the signed-in user's GitHub token from the encrypted session cookie (server only). */
export async function getGitHubToken(): Promise<string | null> {
  const jar = await cookies();
  for (const name of SESSION_COOKIES) {
    const value = jar.get(name)?.value;
    if (!value) continue;
    try {
      const decoded = await decode({ token: value, secret: env().NEXTAUTH_SECRET });
      if (decoded?.accessToken) return decoded.accessToken;
    } catch {
      // Tampered or stale cookie: treat as signed out.
    }
  }
  return null;
}
