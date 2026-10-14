"use client";

import { usePathname } from "next/navigation";
import { RepoSearch } from "@/components/repo-search";

const HIDDEN_ON = new Set(["/", "/dashboard", "/login"]);

/** The compact repository field in the header (md+), except where the page has its own. */
export function HeaderSearch() {
  const pathname = usePathname();
  if (HIDDEN_ON.has(pathname)) return null;
  return <RepoSearch size="sm" variant="header" className="hidden w-full max-w-[420px] md:block" />;
}
