import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

/** 后台输入框：浅色为玻璃白底，暗色模式回落到深色底。 */
export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "flex h-9 w-full rounded-xl border border-slate-300/80 bg-white/70 px-3 py-1 text-sm text-slate-800 shadow-sm backdrop-blur transition placeholder:text-slate-400 focus-visible:border-sky-400/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/25 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-slate-950/60 dark:text-slate-100 dark:placeholder:text-slate-600 dark:[color-scheme:dark]",
        className,
      )}
      {...props}
    />
  );
}
