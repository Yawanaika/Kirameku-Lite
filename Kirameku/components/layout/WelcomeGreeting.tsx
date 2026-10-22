"use client";

import { useSyncExternalStore } from "react";

/** 本地时间问候。
 *
 *  服务端与首次客户端渲染都通过 `getServerSnapshot` 输出空串以保持水合一致，
 *  水合完成后由 `getSnapshot` 提供按浏览器本地时区生成的文案。
 *  用 `useSyncExternalStore` 而不是 `useEffect` + `setState`，是因为后者会触发
 *  React 的级联渲染告警（`react-hooks/set-state-in-effect`）。
 */
function buildGreeting(now = new Date()): string {
  const h = now.getHours();
  const period =
    h < 6 ? "凌晨" : h < 9 ? "早上" : h < 12 ? "上午" : h < 14 ? "中午" : h < 18 ? "下午" : "晚上";
  const hour12 = h <= 12 ? h : h - 12;
  const minutes = now.getMinutes();
  return `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日${period}${hour12}点${
    minutes > 0 ? `${minutes}分` : ""
  }，很高兴与你相遇`;
}

const noopSubscribe = () => () => {};
const getServerSnapshot = () => "";
const getSnapshot = () => buildGreeting();

export default function WelcomeGreeting() {
  const greeting = useSyncExternalStore(
    noopSubscribe,
    getSnapshot,
    getServerSnapshot,
  );

  return (
    <p
      id="welcome-greeting"
      className="welcome-fade welcome-fade-delay-1 text-sm md:text-base text-slate-500 tracking-wider"
      suppressHydrationWarning
    >
      {greeting}
    </p>
  );
}
