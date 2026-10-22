"use client";

import { useEffect } from "react";

const SRC = "/live2d/jsdelivr/random/autoload.js?v=4";

/**
 * Live2D 看板娘。
 *
 * 该第三方脚本（`public/live2d/jsdelivr/random/waifu-tips.js`）会直接向
 * `document.body` 追加 `#waifu`、`#waifu-toggle`、`<audio>` 和 canvas 等节点，
 * 完全绕过 React。用 `next/script` 的 `lazyOnload` 在生产构建里常抢在水合完成
 * 之前执行，React 就会看到 body 下多出来的节点并整棵树重新渲染
 * （React error #418）。改为在水合完成后的 `useEffect` 里手动注入、并放到浏览器
 * 空闲时执行，既消除水合冲突，也不占首屏关键路径。
 */
export default function Live2D() {
  useEffect(() => {
    let cancelled = false;

    const load = () => {
      if (cancelled) return;
      if (document.querySelector('script[data-live2d="1"]')) return;
      const script = document.createElement("script");
      script.src = SRC;
      script.async = true;
      script.dataset.live2d = "1";
      document.body.appendChild(script);
    };

    const idle =
      typeof window.requestIdleCallback === "function"
        ? window.requestIdleCallback(load, { timeout: 3000 })
        : window.setTimeout(load, 1200);

    return () => {
      cancelled = true;
      if (typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idle as number);
      } else {
        window.clearTimeout(idle as number);
      }
    };
  }, []);

  return null;
}
