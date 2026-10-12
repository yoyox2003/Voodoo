import { CircleAlert, CircleCheck, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ToastContext } from "./ToastContext";

type ToastKind = "success" | "error";

type Toast = {
  id: string;
  kind: ToastKind;
  message: string;
};

const successDuration = 4_000;
const maximumVisibleToasts = 3;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback((kind: ToastKind, message: string) => {
    const id = crypto.randomUUID();
    const toast = { id, kind, message } satisfies Toast;

    setToasts((current) => [...current, toast].slice(-maximumVisibleToasts));

    if (kind === "success") {
      const timer = setTimeout(() => dismiss(id), successDuration);
      timers.current.set(id, timer);
    }
  }, [dismiss]);

  useEffect(() => () => {
    timers.current.forEach((timer) => clearTimeout(timer));
    timers.current.clear();
  }, []);

  const value = useMemo(() => ({
    success: (message: string) => show("success", message),
    error: (message: string) => show("error", message),
  }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-label="Notifications" className="pointer-events-none fixed bottom-4 left-4 z-[100] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2 sm:bottom-6 sm:left-6">
        {toasts.map((toast) => {
          const isError = toast.kind === "error";

          return (
            <div
              aria-live={isError ? "assertive" : "polite"}
              className={`pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 shadow-xl ${
                isError
                  ? "border-[#efb7ab] bg-[#fff8f6] text-[#842f22] dark:border-[#6c4038] dark:bg-[#35231f] dark:text-[#ffb2a1]"
                  : "border-[#c9dfcf] bg-[#f6fcf7] text-[#23633b] dark:border-[#3d654b] dark:bg-[#203127] dark:text-[#a8e1b8]"
              }`}
              key={toast.id}
              role={isError ? "alert" : "status"}
            >
              {isError ? <CircleAlert aria-hidden="true" className="mt-0.5 shrink-0" size={19} /> : <CircleCheck aria-hidden="true" className="mt-0.5 shrink-0" size={19} />}
              <p className="flex-1 text-sm font-medium leading-5">{toast.message}</p>
              <button aria-label="Dismiss notification" className="-mr-1 -mt-1 rounded-md p-1 opacity-70 transition hover:bg-black/5 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-current dark:hover:bg-white/10" onClick={() => dismiss(toast.id)} type="button">
                <X aria-hidden="true" size={17} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
