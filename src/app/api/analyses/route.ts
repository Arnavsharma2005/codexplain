import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { ApiError, handler } from "@/lib/http";
import { searchParamsObject } from "@/lib/api-schemas";

const querySchema = z.object({
  cursor: z.string().max(64).optional(),
  q: z.string().max(200).optional(),
});

const PAGE_SIZE = 20;

export const GET = handler(async (req: Request) => {
  const session = await getSession();
  if (!session?.user?.id) throw new ApiError(401, "UNAUTHORIZED", "Sign in to see your history.");
  const { cursor, q } = querySchema.parse(searchParamsObject(req));

  const views = await db.analysisView.findMany({
    where: {
      userId: session.user.id,
      ...(q
        ? {
            OR: [
              { analysis: { path: { contains: q, mode: "insensitive" } } },
              { analysis: { repository: { name: { contains: q, mode: "insensitive" } } } },
              { analysis: { repository: { owner: { contains: q, mode: "insensitive" } } } },
            ],
          }
        : {}),
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: { analysis: { include: { repository: true } } },
  });

  const hasMore = views.length > PAGE_SIZE;
  const items = views.slice(0, PAGE_SIZE).map((v) => ({
    id: v.analysis.id,
    viewId: v.id,
    owner: v.analysis.repository.owner,
    repo: v.analysis.repository.name,
    path: v.analysis.path,
    ref: v.analysis.ref,
    mode: v.analysis.mode,
    language: v.analysis.language,
    shareSlug: v.shareSlug,
    updatedAt: v.updatedAt.toISOString(),
    preview: v.analysis.content.replace(/[#*`>_|-]/g, "").replace(/\s+/g, " ").trim().slice(0, 180),
  }));
  return NextResponse.json({ items, nextCursor: hasMore ? items[items.length - 1].viewId : null });
});
