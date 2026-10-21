import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "flex h-9 w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-1 text-sm text-slate-100 shadow-sm transition [color-scheme:dark] placeholder:text-slate-600 focus-visible:border-sky-400/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/20 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
