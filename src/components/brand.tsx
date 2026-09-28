import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/brand-copy";

export function TelNetMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("text-accent", className)}
      fill="none"
      aria-hidden
    >
      <circle cx="16" cy="21" r="2.2" fill="currentColor" />
      <path
        d="M10.2 16.8c3.2-3.1 8.4-3.1 11.6 0"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M7.2 13.4c5.2-5 12.4-5 17.6 0"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M4.4 10c7.1-6.8 16.1-6.8 23.2 0"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function TelNetWordmark({
  className,
  markClassName,
}: {
  className?: string;
  markClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <TelNetMark className={cn("size-7", markClassName)} />
      <span className="font-display text-lg font-semibold tracking-tight">
        {APP_NAME}
      </span>
    </span>
  );
}
