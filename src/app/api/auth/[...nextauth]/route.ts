import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

async function handler(req: Request, ctx: { params: Promise<{ nextauth: string[] }> }) {
  // next-auth v4 reads params synchronously; Next.js 16 passes them as a Promise.
  const params = await ctx.params;
  return NextAuth(req as never, { params } as never, authOptions());
}

export { handler as GET, handler as POST };
