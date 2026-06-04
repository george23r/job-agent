import * as React from "react";
import { cn } from "@/lib/utils";

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {}

export function Select({ className, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        "flex h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-sand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-500",
        className
      )}
      {...props}
    />
  );
}
