import { useCallback, useEffect, useRef, useState } from "react";

export type ToastTone = "success" | "error" | "info";

export type ToastMessage = {
  id: string;
  message: string;
  tone: ToastTone;
};

const DEFAULT_DURATION_MS = 3200;

export function useToasts() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const timersRef = useRef(new Map<string, number>());

  const dismissToast = useCallback((id: string) => {
    setToasts((value) => value.filter((toast) => toast.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const showToast = useCallback(
    (message: string, tone: ToastTone = "info", durationMs = DEFAULT_DURATION_MS) => {
      const id = crypto.randomUUID();
      setToasts((value) => [...value, { id, message, tone }]);
      const timer = window.setTimeout(() => dismissToast(id), durationMs);
      timersRef.current.set(id, timer);
    },
    [dismissToast]
  );

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.clear();
    };
  }, []);

  return { toasts, showToast, dismissToast };
}

type ToastHostProps = {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
};

export function ToastHost({ toasts, onDismiss }: ToastHostProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-host" aria-live="polite" aria-relevant="additions text">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast--${toast.tone}`} role="status">
          <span>{toast.message}</span>
          <button type="button" className="toast-dismiss tap-spring" onClick={() => onDismiss(toast.id)} aria-label="Dismiss">
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
