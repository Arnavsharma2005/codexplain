import "server-only";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

function todayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Atomically reserves one analysis for today. Returns the remaining count, or
 * null when the daily limit is reached. A single conditional upsert makes it
 * safe under concurrent requests.
 */
export async function reserveAnalysis(userId: string): Promise<number | null> {
  const limit = env().DAILY_ANALYSIS_LIMIT;
  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "UsageDay" ("userId", "day", "count")
    VALUES (${userId}, ${todayUtc()}::date, 1)
    ON CONFLICT ("userId", "day")
    DO UPDATE SET "count" = "UsageDay"."count" + 1
    WHERE "UsageDay"."count" < ${limit}
    RETURNING "count"`;
  if (rows.length === 0) return null;
  return limit - Number(rows[0].count);
}

/** Gives back a reservation when the analysis failed before producing a result. */
export async function refundAnalysis(userId: string) {
  await db.$executeRaw`
    UPDATE "UsageDay" SET "count" = GREATEST("count" - 1, 0)
    WHERE "userId" = ${userId} AND "day" = ${todayUtc()}::date`;
}

export async function getUsage(userId: string) {
  const limit = env().DAILY_ANALYSIS_LIMIT;
  const row = await db.usageDay.findUnique({ where: { userId_day: { userId, day: todayUtc() } } });
  const used = row?.count ?? 0;
  return { used, limit, remaining: Math.max(limit - used, 0) };
}
