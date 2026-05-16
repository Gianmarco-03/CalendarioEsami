import { Modal } from "./Modal";
import { useTheme } from "../theme";
import { Sun, Moon } from "lucide-react";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const { theme, setTheme } = useTheme();

  return (
    <Modal open={open} onClose={onClose} title="Impostazioni">
      <div className="mb-4">
        <label className="block text-[11px] font-bold text-app-muted uppercase tracking-wide mb-1.5">
          Tema
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTheme("light")}
            className={
              "flex-1 flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg text-[12.5px] font-semibold border transition-colors " +
              (theme === "light"
                ? "bg-app-accent text-app-accent-fg border-app-accent"
                : "bg-app-card text-app-fg border-app-input-border hover:bg-app-hover")
            }
          >
            <Sun size={14} /> Chiaro
          </button>
          <button
            type="button"
            onClick={() => setTheme("dark")}
            className={
              "flex-1 flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg text-[12.5px] font-semibold border transition-colors " +
              (theme === "dark"
                ? "bg-app-accent text-app-accent-fg border-app-accent"
                : "bg-app-card text-app-fg border-app-input-border hover:bg-app-hover")
            }
          >
            <Moon size={14} /> Scuro
          </button>
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-[11px] font-bold text-app-muted uppercase tracking-wide mb-1.5">
          Profilo utente
        </label>
        <p className="text-[12px] text-app-muted leading-relaxed">
          In arrivo: nome, avatar, obiettivi di studio settimanali, sincronizzazione locale tra dispositivi.
        </p>
      </div>

      <div className="flex gap-2 mt-2">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 px-2.5 py-1.5 rounded-lg text-[12.5px] font-semibold bg-app-accent text-app-accent-fg border border-app-accent hover:bg-app-accent-hover"
        >Fatto</button>
      </div>
    </Modal>
  );
}
