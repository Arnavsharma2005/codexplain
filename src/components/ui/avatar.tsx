"use client";

import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cn } from "@/lib/utils";

export function Avatar({ src, name, className }: { src?: string | null; name?: string | null; className?: string }) {
  const initials = (name ?? "?")
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <AvatarPrimitive.Root className={cn("relative flex size-8 shrink-0 overflow-hidden rounded-full bg-muted", className)}>
      {src ? <AvatarPrimitive.Image src={src} alt={name ?? "Avatar"} className="size-full object-cover" /> : null}
      <AvatarPrimitive.Fallback className="flex size-full items-center justify-center text-xs font-medium text-muted-foreground">
        {initials}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}
