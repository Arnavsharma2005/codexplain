import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap border-2 font-sans font-bold uppercase tracking-[.1em] text-[14px] leading-none transition-colors duration-[120ms] cursor-pointer disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4 [&_svg]:shrink-0 pointer-coarse:min-h-11 pointer-coarse:min-w-11",
  {
    variants: {
      variant: {
        default: "border-orange bg-orange text-on-orange hover:border-ink hover:bg-ink hover:text-paper",
        secondary: "border-ink bg-transparent text-ink hover:bg-ink hover:text-paper",
        outline: "border-ink bg-transparent text-ink hover:bg-ink hover:text-paper",
        ghost: "border-transparent border-b-[3px] text-ink hover:border-b-orange",
        "ghost-icon": "border-transparent text-ink hover:bg-paper-sunk",
        plate: "border-transparent text-plate-fg hover:bg-plate-hover",
        "plate-outline": "border-plate-fg bg-transparent text-plate-fg hover:bg-plate-fg hover:text-plate",
        destructive: "border-danger bg-transparent text-danger hover:bg-danger hover:text-paper",
        link: "border-0 border-b-[3px] border-b-orange px-0 text-ink hover:text-label",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-8 px-3",
        lg: "h-12 px-5",
        hero: "h-14 px-5",
        icon: "size-10",
        "icon-sm": "size-8",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    // Icon-sized ghost buttons are squares with a fill on hover, not an underline.
    const v = variant === "ghost" && (size === "icon" || size === "icon-sm") ? "ghost-icon" : variant;
    return <Comp ref={ref} className={cn(buttonVariants({ variant: v, size }), className)} {...props} />;
  },
);
Button.displayName = "Button";

export { buttonVariants };
