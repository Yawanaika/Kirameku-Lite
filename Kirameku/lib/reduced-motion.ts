"use client";

import { useSyncExternalStore } from "react";

/**
 * 系统「减少动态效果」偏好的订阅封装。
 *
 * 站内几层装饰特效（点击粒子、鼠标拖尾、季节粒子、星光）都是常驻
 * requestAnimationFrame 的 canvas，对开启该偏好的用户既是干扰也是无谓耗电，
 * 所以统一在这里读一次偏好，交给 EffectProvider 分发给各特效。
 */

const QUERY = "(prefers-reduced-motion: reduce)";

function getMediaQueryList(): MediaQueryList | null {
  if (typeof window === "undefined" || !window.matchMedia) return null;
  return window.matchMedia(QUERY);
}

function subscribe(listener: () => void): () => void {
  const list = getMediaQueryList();
  if (!list) return () => {};
  list.addEventListener("change", listener);
  return () => list.removeEventListener("change", listener);
}

function getSnapshot(): boolean {
  return getMediaQueryList()?.matches ?? false;
}

export function useReducedMotion(): boolean {
  // 服务端没有该偏好，先按 false 渲染，水合后若系统开启会立刻切到 true；
  // 特效本身只在客户端运行，这里的来回不会造成闪动。
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
