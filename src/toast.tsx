import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type ToastVariant = "error" | "success" | "info";
interface ToastItem {
  id: number;
  variant: ToastVariant;
  message: string;
}

interface ToastContextValue {
  error: (msg: string) => void;
  success: (msg: string) => void;
  info: (msg: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((variant: ToastVariant, message: string) => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { id, variant, message }]);
    setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const value: ToastContextValue = {
    error: (m) => push("error", m),
    success: (m) => push("success", m),
    info: (m) => push("info", m),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 w-80 pointer-events-none">
        {items.map((t) => (
          <div
            key={t.id}
            className={
              "pointer-events-auto rounded-lg px-4 py-2 text-sm font-medium shadow-lg border backdrop-blur-md " +
              (t.variant === "error"
                ? "bg-red-500/15 border-red-400/40 text-red-900 dark:text-red-100"
                : t.variant === "success"
                ? "bg-emerald-500/15 border-emerald-400/40 text-emerald-900 dark:text-emerald-100"
                : "bg-sky-500/15 border-sky-400/40 text-sky-900 dark:text-sky-100")
            }
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be inside ToastProvider");
  return ctx;
}
