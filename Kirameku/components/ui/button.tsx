import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * 后台按钮。
 *
 * 默认是浅色玻璃质感，与前台卡片保持一致；暗色模式通过 `dark:` 变体切换。
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-sky-500 text-white shadow-sm shadow-sky-500/20 hover:bg-sky-600 dark:bg-sky-400 dark:text-slate-950 dark:hover:bg-sky-300",
        secondary:
          "border border-white/70 bg-white/60 text-slate-700 shadow-sm backdrop-blur hover:bg-white/80 dark:border-white/10 dark:bg-white/10 dark:text-slate-100 dark:hover:bg-white/15",
        outline:
          "border border-slate-300/80 bg-white/40 text-slate-700 backdrop-blur hover:bg-white/70 dark:border-white/10 dark:bg-transparent dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white",
        ghost:
          "text-slate-600 hover:bg-white/60 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white",
        destructive:
          "border border-rose-500/25 bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 dark:border-rose-400/20 dark:bg-rose-500/15 dark:text-rose-300 dark:hover:bg-rose-500/25",
        link: "text-sky-600 underline-offset-4 hover:underline dark:text-sky-400",
      },
      size: {
        default: "h-9 px-3.5",
        sm: "h-8 px-3 text-xs",
        lg: "h-10 px-5",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({
  className,
  variant,
  size,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { buttonVariants };
