import { Modal } from "./Modal";
import { ModalButton } from "./ModalButton";
import { useTheme } from "../theme";
import { Sun, Moon, Settings as SettingsIcon } from "lucide-react";
import { NotificationsSettings } from "./NotificationsSettings";
import { SystemSettings } from "./SystemSettings";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const { theme, setTheme } = useTheme();

  const footer = (
    <>
      <div className="flex-1" />
      <ModalButton variant="primary" onClick={onClose}>Fatto</ModalButton>
    </>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Impostazioni"
      icon={SettingsIcon}
      size="sm"
      footer={footer}
    >
      <Section title="Tema">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setTheme("light")}
            className={
              "flex flex-col items-center justify-center gap-2 px-3 py-[18px] " +
              "rounded-[10px] text-[12.5px] font-semibold border transition-colors " +
              (theme === "light"
                ? "bg-app-accent text-app-accent-fg border-app-accent"
                : "bg-app-card text-app-fg border-app-input-border hover:bg-app-hover")
            }
          >
            <Sun size={22} /> Chiaro
          </button>
          <button
            type="button"
            onClick={() => setTheme("dark")}
            className={
              "flex flex-col items-center justify-center gap-2 px-3 py-[18px] " +
              "rounded-[10px] text-[12.5px] font-semibold border transition-colors " +
              (theme === "dark"
                ? "bg-app-accent text-app-accent-fg border-app-accent"
                : "bg-app-card text-app-fg border-app-input-border hover:bg-app-hover")
            }
          >
            <Moon size={22} /> Scuro
          </button>
        </div>
      </Section>

      <Section title="Notifiche">
        <NotificationsSettings />
      </Section>

      <Section title="App e sistema">
        <SystemSettings />
      </Section>

      <Section title="Profilo utente">
        <p className="text-[12px] text-app-muted leading-relaxed m-0">
          In arrivo: nome, avatar, obiettivi di studio settimanali, sincronizzazione locale tra dispositivi.
        </p>
      </Section>
    </Modal>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 pt-4 border-t border-app-border first:pt-0 first:border-t-0">
      <div className="text-[11.5px] font-semibold text-app-muted">{title}</div>
      {children}
    </div>
  );
}
