"use client";

import { useEffect } from "react";
import { useDeferredActivation } from "@/lib/useDeferredActivation";

export default function VisitorTracker() {
  const active = useDeferredActivation();

  useEffect(() => {
    if (!active) return;

    // 访客记录
    if (!sessionStorage.getItem("visitor_recorded")) {
      fetch("/api/visitors/record", {
        method: "POST",
        headers: {
          "x-path": window.location.pathname,
        },
      })
        .then(() => {
          sessionStorage.setItem("visitor_recorded", "1");
        })
        .catch(() => {});
    }

    // 获取地理位置，供看板娘欢迎语使用
    if (!sessionStorage.getItem("visitor_location")) {
      fetch("/api/visitors/location")
        .then((r) => r.json())
        .then((res) => {
          if (res.code === 0 && res.data && (res.data.city || res.data.region)) {
            sessionStorage.setItem("visitor_location", JSON.stringify(res.data));
          }
        })
        .catch(() => {});
    }
  }, [active]);

  return null;
}
