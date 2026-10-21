"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AdminPaginationProps {
  page: number;
  pageSize: number;
  total?: number;
  hasNext?: boolean;
  onPageChange: (page: number) => void;
}

export default function AdminPagination({
  page,
  pageSize,
  total,
  hasNext,
  onPageChange,
}: AdminPaginationProps) {
  const totalPages =
    total === undefined ? undefined : Math.max(1, Math.ceil(total / pageSize));
  const canGoNext = totalPages !== undefined ? page < totalPages : hasNext;
  const canGoPrevious = page > 1;

  if (!canGoPrevious && !canGoNext && total === undefined) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-5 py-3.5">
      <p className="text-xs text-slate-600">
        {total === undefined ? (
          <>第 {page} 页</>
        ) : (
          <>
            共 {total} 条 · 第 {page}
            {totalPages && totalPages > 1 ? ` / ${totalPages}` : ""} 页
          </>
        )}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={!canGoPrevious}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="size-3.5" aria-hidden />
          上一页
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!canGoNext}
          onClick={() => onPageChange(page + 1)}
        >
          下一页
          <ChevronRight className="size-3.5" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
