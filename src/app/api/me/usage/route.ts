import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ApiError, handler } from "@/lib/http";
import { getUsage } from "@/lib/services/quota";

export const GET = handler(async () => {
  const session = await getSession();
  if (!session?.user?.id) throw new ApiError(401, "UNAUTHORIZED", "Sign in to see your usage.");
  return NextResponse.json(await getUsage(session.user.id), { headers: { "Cache-Control": "no-store" } });
});
