"use client";

import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cn } from "@/lib/utils";

/** Requests the GitHub avatar at 2x the rendered size (`&s=`), so it stays small. */
function sized(src: string, px: number) {
  if (!src.includes("avatars.githubusercontent.com")) return src;
  const url = new URL(src);
  url.searchParams.set("s", String(px * 2));
  return url.toString();
}

export function Avatar({ src, name, size = 24, className }: { src?: string | null; name?: string | null; size?: number; className?: string }) {
  const initials = (name ?? "?")
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <AvatarPrimitive.Root
      className={cn("relative flex shrink-0 overflow-hidden rounded-full bg-paper-sunk", className)}
      style={{ width: size, height: size }}
    >
      {src ? <AvatarPrimitive.Image src={sized(src, size)} alt={name ?? "Avatar"} className="size-full object-cover" /> : null}
      <AvatarPrimitive.Fallback className="flex size-full items-center justify-center text-[12px] font-bold text-ink-muted">
        {initials}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}
