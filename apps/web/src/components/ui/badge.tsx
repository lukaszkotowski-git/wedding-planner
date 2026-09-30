import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", {
  variants: {
    variant: {
      default: "bg-secondary text-secondary-foreground",
      success: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
      warning: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300",
      muted: "bg-muted text-muted-foreground",
      destructive: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
    },
  },
  defaultVariants: { variant: "default" },
});

export function Badge({ className, variant, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
