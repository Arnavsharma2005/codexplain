"use client";

import { Check, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCopy } from "@/components/workspace/use-copy";

/** Copies the walkthrough's link. */
export function ShareButton({ path }: { path: string }) {
  const { copied, copy } = useCopy();
  return (
    <Button size="sm" onClick={() => copy(new URL(path, window.location.origin).toString())}>
      {copied ? <Check /> : <Share2 />} {copied ? "Link copied" : "Share walkthrough"}
    </Button>
  );
}
