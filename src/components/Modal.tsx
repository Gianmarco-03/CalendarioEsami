import { useEffect, type ReactNode, type ComponentType } from "react";
import { X } from "lucide-react";

type Size = "sm" | "md" | "lg" | "xl";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  icon?: ComponentType<{ size?: number; className?: string }>;
  accent?: string;
  size?: Size;
  footer?: ReactNode;
}

const SIZE_CLASSES: Record<Size, string> = {
  sm: "max-w-[360px]",
  md: "max-w-[420px]",
  lg: "max-w-[480px]",
  xl: "max-w-[520px]",
};

export function Modal({
  open,
  onClose,
  title,
  children,
  icon: Icon,
  accent,
  size = "md",
  footer,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const accentColor = accent ?? "var(--color-app-accent)";

  return (
    <div
      className="fixed inset-0 z-40 bg-black/30 backdrop-blur-md flex items-center justify-center p-5"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className={
          "text-app-fg rounded-2xl w-full max-h-[88vh] overflow-hidden " +
          "shadow-2xl glass-panel flex flex-col " +
          SIZE_CLASSES[size]
        }
        style={{ animation: "fade-in 180ms ease-out" }}
      >
        {/* Accent bar */}
        <div
          className="h-[4px] w-full shrink-0"
          style={{ background: accentColor, transition: "background-color 200ms" }}
        />

        {/* Header */}
        <div className="flex items-center gap-2.5 px-[18px] pt-3.5 pb-3 border-b border-app-border shrink-0">
          {Icon && (
            <Icon
              size={18}
              className="shrink-0"
            />
          )}
          <h3 className="text-[14.5px] font-bold leading-snug m-0 flex-1 min-w-0 truncate">
            {title}
          </h3>
          <button
            onClick={onClose}
            aria-label="Chiudi"
            className="text-app-muted p-1 rounded hover:bg-app-hover hover:text-app-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus-ring"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body scrollabile */}
        <div className="px-[18px] py-[18px] overflow-y-auto flex-1 min-h-0 flex flex-col gap-4">
          {children}
        </div>

        {/* Footer sticky (opzionale) */}
        {footer && (
          <div className="flex items-center gap-2 px-[18px] py-3 border-t border-app-border shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
