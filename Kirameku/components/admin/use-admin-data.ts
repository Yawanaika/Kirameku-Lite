"use client";

import { useCallback, useEffect, useState } from "react";
import { adminRequest, describeAdminError } from "./admin-api";

interface DataState<T> {
  path: string;
  version: number;
  data: T | null;
  error: string | null;
}

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

    adminRequest<T>(path, { signal: controller.signal })
      .then((value) => {
        if (!controller.signal.aborted) {
          setState({ path, version, data: value, error: null });
        }
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setState({
            path,
            version,
            data: null,
            error: describeAdminError(reason),
          });
        }
      });

    return () => controller.abort();
  }, [path, version]);

  const current = state.path === path && state.version === version;

  return {
    data: current ? state.data : null,
    loading: !current,
    error: current ? state.error : null,
    reload,
  };
}
