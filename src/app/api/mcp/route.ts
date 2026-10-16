import { clientIp, handler } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { requireIntel } from "@/lib/intel/http";
import { handleMcp } from "@/lib/intel/mcp";

// Remote MCP server (Streamable HTTP). Add it to Claude Code with:
//   claude mcp add --transport http codexplain https://<host>/api/mcp
// It is read-only and serves public repositories only, so it needs no auth.
const serve = handler(async (req: Request) => {
  requireIntel();
  rateLimit(`mcp:${clientIp(req)}`, 30, 60_000);
  return handleMcp(req, new URL(req.url).origin);
});

export const POST = serve;
export const GET = serve;
export const DELETE = serve;
