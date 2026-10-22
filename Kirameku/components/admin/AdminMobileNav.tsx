"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import AdminNav from "./AdminNav";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * 移动端后台导航：桌面端侧栏在 `lg` 以下隐藏，这里提供抽屉入口。
 * 关闭时把焦点还给触发按钮；打开期间锁定页面滚动并处理 Escape / Tab。
 */
export default function AdminMobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);

  // 路由变化后自动收起（移动端点击导航项）。
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- close drawer after navigation
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      closeRef.current?.focus();

      function onKeyDown(event: KeyboardEvent) {
        if (event.key === "Escape") {
          setOpen(false);
          return;
        }
        if (event.key !== "Tab") return;

        const nodes = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
        if (!nodes?.length) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }

      window.addEventListener("keydown", onKeyDown);

      const desktop = window.matchMedia("(min-width: 1024px)");
      const onDesktop = () => {
        if (desktop.matches) setOpen(false);
      };
      desktop.addEventListener("change", onDesktop);

      return () => {
        document.body.style.overflow = previousOverflow;
        window.removeEventListener("keydown", onKeyDown);
        desktop.removeEventListener("change", onDesktop);
      };
    }

    if (wasOpen.current) {
      wasOpen.current = false;
      triggerRef.current?.focus();
    }
    return;
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="打开后台导航"
        aria-expanded={open}
        aria-controls="admin-mobile-nav"
        className="grid size-9 place-items-center rounded-lg border border-white/10 text-slate-300 transition hover:bg-white/5 hover:text-white lg:hidden"
      >
        <Menu className="size-5" aria-hidden />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            ref={panelRef}
            id="admin-mobile-nav"
            role="dialog"
            aria-modal="true"
            aria-label="后台导航"
            className="relative flex h-full w-[280px] max-w-[85vw] flex-col border-r border-white/10 bg-slate-900 px-4 py-4 shadow-2xl"
          >
            <div className="flex items-center justify-between gap-3">
              <Link
                href="/admin"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-1"
              >
                <span className="grid size-9 place-items-center rounded-xl bg-sky-400 text-sm font-black text-slate-950">
                  K
                </span>
                <span>
                  <span className="block text-sm font-semibold tracking-wide">
                    Kirameku
                  </span>
                  <span className="block text-[11px] text-slate-500">
                    Admin Console
                  </span>
                </span>
              </Link>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                aria-label="关闭后台导航"
                className="grid size-9 place-items-center rounded-lg text-slate-400 transition hover:bg-white/5 hover:text-white"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>

            <div className="mt-4 min-h-0 flex-1 overflow-y-auto pb-4">
              <AdminNav />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
