import { useEffect, type ReactNode, type ComponentType } from "react";
import { X } from "lucide-react";

type Size = "sm" | "md" | "lg" | "xl";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  icon?: ComponentType<{ size?: number; className?: string }>;
  kicker?: string;
  accent?: string;
  size?: Size;
  footer?: ReactNode;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  icon: Icon,
  kicker,
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

  const accentColor = accent ?? "var(--text)";
  const iconBg = accent
    ? `color-mix(in srgb, ${accent} 16%, transparent)`
    : "rgba(255,255,255,0.05)";
  const iconBorder = accent
    ? `1px solid color-mix(in srgb, ${accent} 30%, transparent)`
    : "1px solid var(--border)";

  return (
    <div
      className="modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className={`modal-panel size-${size}`}
        style={{ ["--accent-color" as string]: accentColor } as React.CSSProperties}
      >
        <div className="modal-accent" style={{ background: accentColor }} />

        <div className="modal-head">
          {Icon && (
            <div
              style={{
                width: 28, height: 28,
                borderRadius: 8,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: accentColor,
                background: iconBg,
                border: iconBorder,
                flexShrink: 0,
              }}
            >
              <Icon size={14} />
            </div>
          )}
          <div className="head-text">
            {kicker && <div className="head-kicker">{kicker}</div>}
            <h2>{title}</h2>
          </div>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Chiudi"
          >
            <X size={16} />
          </button>
        </div>

        <div className="modal-body">
          {children}
        </div>

        {footer && (
          <div className="modal-foot">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
