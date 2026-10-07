import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { ApiError, assertSameOrigin, handler } from "@/lib/http";

const idSchema = z.string().regex(/^[a-z0-9]{20,32}$/);

/** Removes an analysis from the current user's history (the shared cache entry stays). */
export const DELETE = handler(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const session = await getSession();
  if (!session?.user?.id) throw new ApiError(401, "UNAUTHORIZED", "Sign in first.");
  const id = idSchema.parse((await ctx.params).id);
  await db.analysisView.deleteMany({ where: { userId: session.user.id, analysisId: id } });
  return new NextResponse(null, { status: 204 });
});
