import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      login?: string | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    /** GitHub OAuth token. Lives only inside the encrypted session cookie; never sent to the browser as data. */
    accessToken?: string;
    login?: string | null;
  }
}
