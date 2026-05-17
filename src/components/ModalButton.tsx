import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "danger";

interface ModalButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant: Variant;
  children: ReactNode;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-app-accent text-app-accent-fg border-app-accent hover:bg-app-accent-hover",
  secondary:
    "bg-app-card text-app-fg border-app-input-border hover:bg-app-hover",
  danger:
    "bg-app-danger-soft text-app-danger-fg border-transparent hover:bg-app-danger/20",
};

const BASE =
  "inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg " +
  "text-[12.5px] font-semibold border transition-colors active:scale-[0.98] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus-ring " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

export function ModalButton({
  variant,
  className,
  children,
  type = "button",
  ...rest
}: ModalButtonProps) {
  const cls = [BASE, VARIANT_CLASSES[variant], className].filter(Boolean).join(" ");
  return (
    <button type={type} className={cls} {...rest}>
      {children}
    </button>
  );
}
