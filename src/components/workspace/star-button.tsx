"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { toast } from "sonner";
import { apiSend, ApiClientError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";

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
    <Tooltip content={starred ? "Remove from saved" : "Save to dashboard"}>
      <Button variant="outline" size="sm" onClick={toggle} disabled={busy} aria-pressed={starred}>
        {starred ? <BookmarkCheck className="text-primary" /> : <Bookmark />}
        <span className="hidden sm:inline">{starred ? "Saved" : "Save"}</span>
      </Button>
    </Tooltip>
  );
}
