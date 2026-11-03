"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

const subscribeNever = () => () => {};
const canObserveOnClient = () => typeof IntersectionObserver !== "undefined";
const canObserveOnServer = () => true;

/**
 * Mount below-the-fold client widgets only when they approach the viewport.
 * This keeps their JS chunks and effects out of the initial LCP critical path.
 */
export default function LazyMount({
  children,
  className = "",
  minHeight = 200,
}: {
  children: ReactNode;
  className?: string;
  minHeight?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  // 服务端与首次水合先按「支持 IntersectionObserver」渲染骨架，客户端拿到真实值后再决定，
  // 这样既能给不支持的老浏览器直接出内容，又不会因为渲染期读取浏览器能力而产生水合不一致。
  const canObserve = useSyncExternalStore(
    subscribeNever,
    canObserveOnClient,
    canObserveOnServer,
  );

  useEffect(() => {
    const element = ref.current;
    if (!element || !canObserve) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setMounted(true);
          observer.disconnect();
        }
      },
      { rootMargin: "240px 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [canObserve]);

  return (
    <div
      ref={ref}
      className={className}
      style={mounted || !canObserve ? undefined : { minHeight }}
    >
      {mounted || !canObserve ? children : null}
    </div>
  );
}