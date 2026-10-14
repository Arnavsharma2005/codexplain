"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { toast } from "sonner";
import { apiSend, ApiClientError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";

/** Save / Saved: the accessible name is the visible label (no aria-label, no tooltip). */
export function StarButton({
  owner,
  repo,
  initial,
  signedIn,
}: {
  owner: string;
  repo: string;
  initial: boolean;
  signedIn: boolean;
}) {
  const [starred, setStarred] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (!signedIn) {
      void signIn("github", { callbackUrl: window.location.href });
      return;
    }
    const next = !starred;
    setStarred(next);
    setBusy(true);
    try {
      await apiSend("/api/repos/star", "POST", { owner, repo, starred: next });
      toast.success(next ? "Saved to your dashboard" : "Removed from saved repositories");
    } catch (err) {
      setStarred(!next);
      toast.error(err instanceof ApiClientError ? err.message : "Couldn't update. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="secondary" size="sm" onClick={toggle} disabled={busy} aria-busy={busy || undefined} aria-pressed={starred} className="px-2 sm:px-3">
      {starred ? <BookmarkCheck className="hidden sm:block" aria-hidden /> : <Bookmark className="hidden sm:block" aria-hidden />}
      {starred ? "Saved" : "Save"}
    </Button>
  );
}
