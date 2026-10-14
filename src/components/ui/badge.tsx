import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center border-[1.5px] px-1.5 pt-[3px] pb-[2px] text-[12px] font-bold uppercase tracking-[.1em] leading-none",
  {
    variants: {
      variant: {
        new: "border-orange bg-orange text-on-orange",
        cached: "border-ink text-ink",
        shared: "border-label text-label",
        outline: "border-plate-muted text-plate-muted",
      },
    },
    defaultVariants: { variant: "cached" },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
