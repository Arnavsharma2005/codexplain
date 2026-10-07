import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { ApiError, assertSameOrigin, handler } from "@/lib/http";
import { createShareLink, recordAnalysisView, revokeShareLink } from "@/lib/services/analyses";
import { db } from "@/lib/db";

const idSchema = z.string().regex(/^[a-z0-9]{20,32}$/);

async function requireUser(req: Request) {
  assertSameOrigin(req);
  const session = await getSession();
  if (!session?.user?.id) throw new ApiError(401, "UNAUTHORIZED", "Sign in to share analyses.");
  return session.user.id;
}

export const POST = handler(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const userId = await requireUser(req);
  const id = idSchema.parse((await ctx.params).id);
  const exists = await db.analysis.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw new ApiError(404, "NOT_FOUND", "Analysis not found.");
  // Viewing a cached analysis is enough to share it; add it to history first.
  await recordAnalysisView(userId, id);
  const slug = await createShareLink(userId, id);
  if (!slug) throw new ApiError(404, "NOT_FOUND", "Analysis not found.");
  const origin = new URL(req.url).origin;
  return NextResponse.json({ slug, url: `${origin}/a/${slug}` });
});

export const DELETE = handler(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const userId = await requireUser(req);
  const id = idSchema.parse((await ctx.params).id);
  await revokeShareLink(userId, id);
  return new NextResponse(null, { status: 204 });
});
