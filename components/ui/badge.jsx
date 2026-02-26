import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-zinc-50 text-zinc-900",
        secondary: "border-transparent bg-zinc-800 text-zinc-50",
        outline: "border-zinc-700 text-zinc-300",
        success: "border-transparent bg-emerald-900/50 text-emerald-400",
        warning: "border-transparent bg-amber-900/50 text-amber-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function Badge({ className, variant, ...props }) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
