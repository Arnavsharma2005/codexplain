"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export function useCopy(timeout = 1500) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const copy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), timeout);
      } catch {
        toast.error("Couldn't access the clipboard.");
      }
    },
    [timeout],
  );

  return { copied, copy };
}
