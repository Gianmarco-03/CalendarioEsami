import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function Modal({ open, onClose, title, children }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-40 bg-black/30 backdrop-blur-md flex items-center justify-center p-5"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="text-app-fg rounded-2xl w-[380px] max-w-full max-h-[88vh] overflow-auto shadow-2xl glass-panel">
        <div className="flex items-start justify-between px-4 pt-4 pb-2">
          <h3 className="text-[14.5px] font-semibold leading-snug m-0">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Chiudi"
            className="text-app-muted p-1 rounded hover:bg-app-hover hover:text-app-fg"
          ><X size={18} /></button>
        </div>
        <div className="px-4 pb-4 pt-1">{children}</div>
      </div>
    </div>
  );
}
