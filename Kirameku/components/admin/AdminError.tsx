import { AlertCircle } from "lucide-react";

interface AdminErrorProps {
  message: string;
  className?: string;
}

export default function AdminError({ message, className }: AdminErrorProps) {
  return (
    <div
      role="alert"
      className={`flex items-start gap-2.5 rounded-xl border border-rose-400/20 bg-rose-400/10 px-3.5 py-3 text-xs leading-5 text-rose-200 ${className ?? ""}`}
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{message}</span>
    </div>
  );
}
