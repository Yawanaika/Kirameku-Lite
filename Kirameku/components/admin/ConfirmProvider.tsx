"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

type ConfirmFn = (message: string) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function useConfirm(): ConfirmFn {
  const confirm = useContext(ConfirmContext);
  if (!confirm) {
    throw new Error("useConfirm must be used inside ConfirmProvider");
  }
  return confirm;
}

/**
 * Promise-based replacement for window.confirm.
 *
 * All current callers are destructive admin actions, so the confirm button is
 * rendered with the destructive style. Radix handles focus trapping, Escape and
 * the aria dialog semantics.
 */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((next) => {
    // A second request supersedes the first instead of stacking dialogs.
    resolver.current?.(false);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
      setMessage(next);
    });
  }, []);

  const finish = useCallback((value: boolean) => {
    const resolve = resolver.current;
    resolver.current = null;
    setMessage(null);
    resolve?.(value);
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog
        open={message !== null}
        onOpenChange={(open) => {
          if (!open) finish(false);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogTitle>请确认操作</DialogTitle>
          <DialogDescription className="mt-2 whitespace-pre-line leading-6">
            {message}
          </DialogDescription>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" onClick={() => finish(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={() => finish(true)}>
              确定
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  );
}
