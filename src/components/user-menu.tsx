"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { GitHubIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";

const AccountMenu = dynamic(() => import("./account-menu"), { ssr: false, loading: () => <PillOutline /> });

function PillOutline() {
  return <span aria-hidden className="inline-block h-[38px] w-[42px] rounded-full border-2 border-ink" />;
}

/** A fixed-width auth slot, so the session fetch never shifts the nav. */
export function UserMenu() {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  let content: React.ReactNode;
  if (status === "loading") content = <PillOutline />;
  else if (session?.user) content = <AccountMenu user={session.user} />;
  else if (pathname === "/login") content = null; // the page has its own sign-in action
  else
    content = (
      <Button variant="secondary" size="sm" className="px-2 text-[13px] tracking-[.06em] sm:px-3 sm:text-[14px] sm:tracking-[.1em]" onClick={() => signIn("github")}>
        <GitHubIcon className="hidden size-4 sm:block" /> Sign in
      </Button>
    );

  return <div className="flex w-[88px] shrink-0 justify-end sm:w-[132px]">{content}</div>;
}
