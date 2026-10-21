import { Badge, type BadgeProps } from "@/components/ui/badge";
import { statusLabel } from "./format";

const variants: Record<string, BadgeProps["variant"]> = {
  published: "success",
  approved: "success",
  active: "success",
  draft: "muted",
  archived: "muted",
  pending: "warning",
  developing: "info",
  rejected: "danger",
};

interface StatusBadgeProps {
  status: string;
  label?: string;
  className?: string;
}

export default function StatusBadge({
  status,
  label,
  className,
}: StatusBadgeProps) {
  return (
    <Badge variant={variants[status] ?? "default"} className={className}>
      {statusLabel(status, label)}
    </Badge>
  );
}
