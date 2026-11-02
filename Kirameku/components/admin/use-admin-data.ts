"use client";

import { useCallback, useEffect, useState } from "react";
import { adminRequest, describeAdminError } from "./admin-api";

interface DataState<T> {
  path: string;
  version: number;
  data: T | null;
  error: string | null;
}

/**
 * 取数超时时间：开发环境里 dev server 可能在编译中挂住请求，
 * 没有兜底的话页面会永远停在「正在加载」，还拿不到重试入口。
 */
const REQUEST_TIMEOUT_MS = 20_000;

export function useAdminData<T>(path: string) {
  const [state, setState] = useState<DataState<T>>({
    path: "",
    version: -1,
    data: null,
    error: null,
  });
  const [version, setVersion] = useState(0);

  const reload = useCallback(() => {
    setVersion((current) => current + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    adminRequest<T>(path, { signal: controller.signal })
      .then((value) => {
        if (!controller.signal.aborted) {
          setState({ path, version, data: value, error: null });
        }
      })
      .catch((reason: unknown) => {
        if (timedOut) {
          setState({
            path,
            version,
            data: null,
            error: `读取超时：服务器 ${REQUEST_TIMEOUT_MS / 1000} 秒内没有响应，请重新载入。`,
          });
          return;
        }
        if (!controller.signal.aborted) {
          setState({
            path,
            version,
            data: null,
            error: describeAdminError(reason),
          });
        }
      })
      .finally(() => clearTimeout(timer));

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [path, version]);

  const current = state.path === path && state.version === version;

  return {
    data: current ? state.data : null,
    loading: !current,
    error: current ? state.error : null,
    reload,
  };
}
