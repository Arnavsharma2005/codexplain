"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { GitHubIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";

export function SignInButton({ callbackUrl }: { callbackUrl: string }) {
  const [loading, setLoading] = useState(false);
  return (
    <Button
      size="lg"
      className="mt-6 w-full"
      disabled={loading}
      onClick={() => {
        setLoading(true);
        void signIn("github", { callbackUrl });
      }}
    >
      {loading ? <Loader2 className="animate-spin" /> : <GitHubIcon />}
      Continue with GitHub
    </Button>
  );
}
