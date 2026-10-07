"use client";

import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";
import { LayoutDashboard, LogOut } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { GitHubIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UserMenu() {
  const { data: session, status } = useSession();

  if (status === "loading") return <Skeleton className="size-8 rounded-full" />;

  if (!session?.user) {
    return (
      <Button size="sm" onClick={() => signIn("github")}>
        <GitHubIcon /> Sign in
      </Button>
    );
  }

  const { user } = session;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-full" aria-label="Account menu">
        <Avatar src={user.image} name={user.name ?? user.login} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>
          <div className="font-medium text-foreground">{user.name ?? user.login}</div>
          {user.login ? <div>@{user.login}</div> : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/dashboard">
            <LayoutDashboard /> Dashboard
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => signOut({ callbackUrl: "/" })}>
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
