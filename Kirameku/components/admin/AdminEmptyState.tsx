interface AdminEmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export default function AdminEmptyState({
  title,
  description,
  action,
}: AdminEmptyStateProps) {
  return (
    <div className="px-5 py-16 text-center">
      <p className="text-sm text-slate-300">{title}</p>
      {description ? (
        <p className="mx-auto mt-1.5 max-w-md text-xs leading-5 text-slate-600">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
