"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * localStorage 的读写封装。
 *
 * 组件里「首屏从 localStorage 恢复、之后保持同步」的写法很容易退化成
 * 「在 effect 里 setState」，那会多一次渲染并且和其它状态交叉更新。这里改用
 * useSyncExternalStore：服务端渲染拿 fallback，客户端水合后直接读到真实值。
 */

type Listener = () => void;

const listeners = new Map<string, Set<Listener>>();

function emit(key: string): void {
  const bucket = listeners.get(key);
  if (!bucket) return;
  for (const listener of bucket) listener();
}

function subscribe(key: string, listener: Listener): () => void {
  let bucket = listeners.get(key);
  if (!bucket) {
    bucket = new Set<Listener>();
    listeners.set(key, bucket);
  }
  bucket.add(listener);

  // storage 事件只在「其它标签页」写入时触发，同页面内的写入靠 emit。
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === key) listener();
  };
  window.addEventListener("storage", onStorage);

  return () => {
    bucket.delete(listener);
    if (bucket.size === 0) listeners.delete(key);
    window.removeEventListener("storage", onStorage);
  };
}

function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    // 隐私模式 / 禁用了存储时读取会抛错，按「没有存过」处理。
    return null;
  }
}

function writeRaw(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
    emit(key);
  } catch {
    // 写入失败（配额、隐私模式）不应让界面崩溃，保持内存中的即时反馈即可。
  }
}

export function readStoredNumber(key: string, fallback = 0): number {
  const raw = readRaw(key);
  if (raw === null) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

export function readStoredBoolean(key: string, fallback = false): boolean {
  const raw = readRaw(key);
  return raw === null ? fallback : raw === "true";
}

/**
 * 读写一个数字型本地存储值，返回值始终与 localStorage 同步。
 * 更新函数既可以传值，也可以传 `(prev) => next`，prev 是存储里的当前值，
 * 因此不必把副作用写在 setState 的 updater 里。
 */
export function useStoredNumber(key: string, fallback = 0) {
  const value = useSyncExternalStore(
    useCallback((onChange: Listener) => subscribe(key, onChange), [key]),
    useCallback(() => readStoredNumber(key, fallback), [key, fallback]),
    useCallback(() => fallback, [fallback]),
  );

  const save = useCallback(
    (next: number | ((prev: number) => number)) => {
      const prev = readStoredNumber(key, fallback);
      writeRaw(key, String(typeof next === "function" ? next(prev) : next));
    },
    [key, fallback],
  );

  return [value, save] as const;
}

/** 读写一个布尔型本地存储值，语义同 useStoredNumber。 */
export function useStoredBoolean(key: string, fallback = false) {
  const value = useSyncExternalStore(
    useCallback((onChange: Listener) => subscribe(key, onChange), [key]),
    useCallback(() => readStoredBoolean(key, fallback), [key, fallback]),
    useCallback(() => fallback, [fallback]),
  );

  const save = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      const prev = readStoredBoolean(key, fallback);
      writeRaw(key, String(typeof next === "function" ? next(prev) : next));
    },
    [key, fallback],
  );

  return [value, save] as const;
}
