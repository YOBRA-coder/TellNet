import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-wide uppercase",
  {
    variants: {
      tone: {
        neutral: "border-border bg-raised text-muted",
        ok: "border-ok/20 bg-ok/10 text-ok",
        warn: "border-warn/20 bg-warn/10 text-warn",
        danger: "border-danger/20 bg-danger/10 text-danger",
        accent: "border-accent/20 bg-accent/10 text-accent",
        cream: "border-cream/15 bg-cream/10 text-cream",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export function Badge({
  className,
  tone,
  ...props
}: HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>) {
  return <div className={cn(badgeVariants({ tone }), className)} {...props} />;
}
