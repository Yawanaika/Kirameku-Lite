"use client";

import { useEffect, useState } from "react";

const ACTIVATION_EVENTS: Array<keyof WindowEventMap> = [
  "pointerdown",
  "keydown",
  "scroll",
  "touchstart",
];

/**
 * Returns true after the first user interaction or after `delayMs`, whichever
 * comes first. Used to keep non-critical widgets and their network requests
 * out of the initial LCP/interactive critical path.
 */
export function useDeferredActivation(delayMs = 3500) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (active) return;

    let cancelled = false;
    const activate = () => {
      if (!cancelled) setActive(true);
    };

    for (const event of ACTIVATION_EVENTS) {
      window.addEventListener(event, activate, { once: true, passive: true });
    }
    const timer = window.setTimeout(activate, delayMs);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      for (const event of ACTIVATION_EVENTS) {
        window.removeEventListener(event, activate);
      }
    };
  }, [active, delayMs]);

  return active;
}
