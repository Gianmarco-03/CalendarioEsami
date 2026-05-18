import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "danger";

interface ModalButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant: Variant;
  children: ReactNode;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:   "btn primary",
  secondary: "btn",
  danger:    "btn danger",
};

export function ModalButton({
  variant,
  className,
  children,
  type = "button",
  ...rest
}: ModalButtonProps) {
  const cls = [VARIANT_CLASSES[variant], className].filter(Boolean).join(" ");
  return (
    <button type={type} className={cls} {...rest}>
      {children}
    </button>
  );
}
