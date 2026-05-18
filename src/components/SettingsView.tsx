import { useState } from "react";
import { Sun, Moon, Palette, Bell, Cog, User } from "lucide-react";
import { useTheme } from "../theme";
import { NotificationsSettings } from "./NotificationsSettings";
import { SystemSettings } from "./SystemSettings";
import { ErrorBoundary } from "./ErrorBoundary";

type SettingsTab = "personalization" | "notifications" | "system" | "profile";

interface TabMeta {
  id: SettingsTab;
  label: string;
  Icon: typeof Palette;
}

const TABS: TabMeta[] = [
  { id: "personalization", label: "Personalizzazione", Icon: Palette },
  { id: "notifications",   label: "Notifiche",         Icon: Bell },
  { id: "system",          label: "App e sistema",     Icon: Cog },
  { id: "profile",         label: "Profilo utente",    Icon: User },
];

export function SettingsView() {
  const [active, setActive] = useState<SettingsTab>("personalization");

  return (
    <div className="flex-1 min-h-0 flex gap-4">
      <nav className="w-[200px] shrink-0 flex flex-col gap-1">
        {TABS.map(({ id, label, Icon }) => {
          const isActive = id === active;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActive(id)}
              className={
                "flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium text-left transition-colors " +
                (isActive
                  ? "bg-app-accent text-app-accent-fg shadow-sm"
                  : "text-app-fg hover:bg-app-hover")
              }
            >
              <Icon size={15} />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>

      <section className="flex-1 min-w-0 overflow-y-auto pr-1">
        {active === "personalization" && <PersonalizationPanel />}
        {active === "notifications" && (
          <ErrorBoundary fallbackTitle="Errore in NotificationsSettings">
            <Panel title="Notifiche" description="Cosa, quando e come ti viene mostrato.">
              <NotificationsSettings />
            </Panel>
          </ErrorBoundary>
        )}
        {active === "system" && (
          <ErrorBoundary fallbackTitle="Errore in SystemSettings">
            <Panel title="App e sistema" description="Avvio con Windows e comportamento di chiusura.">
              <SystemSettings />
            </Panel>
          </ErrorBoundary>
        )}
        {active === "profile" && <ProfilePanel />}
      </section>
    </div>
  );
}

function Panel({
  title, description, children,
}: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 max-w-[640px]">
      <header className="flex flex-col gap-1">
        <h2 className="text-[18px] font-bold leading-tight">{title}</h2>
        {description && (
          <p className="text-[12.5px] text-app-muted leading-relaxed m-0">{description}</p>
        )}
      </header>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

function PersonalizationPanel() {
  const { theme, setTheme } = useTheme();
  return (
    <Panel title="Personalizzazione" description="Aspetto dell'app.">
      <div className="flex flex-col gap-2">
        <div className="text-[11.5px] font-semibold text-app-muted uppercase tracking-wider">Tema</div>
        <div className="grid grid-cols-2 gap-3 max-w-[420px]">
          <button
            type="button"
            onClick={() => setTheme("light")}
            className={
              "flex flex-col items-center justify-center gap-2 px-3 py-5 " +
              "rounded-[12px] text-[13px] font-semibold border transition-colors " +
              (theme === "light"
                ? "bg-app-accent text-app-accent-fg border-app-accent"
                : "bg-app-card text-app-fg border-app-input-border hover:bg-app-hover")
            }
          >
            <Sun size={24} /> Chiaro
          </button>
          <button
            type="button"
            onClick={() => setTheme("dark")}
            className={
              "flex flex-col items-center justify-center gap-2 px-3 py-5 " +
              "rounded-[12px] text-[13px] font-semibold border transition-colors " +
              (theme === "dark"
                ? "bg-app-accent text-app-accent-fg border-app-accent"
                : "bg-app-card text-app-fg border-app-input-border hover:bg-app-hover")
            }
          >
            <Moon size={24} /> Scuro
          </button>
        </div>
      </div>
    </Panel>
  );
}

function ProfilePanel() {
  return (
    <Panel title="Profilo utente" description="In arrivo.">
      <p className="text-[12.5px] text-app-muted leading-relaxed m-0">
        Nome, avatar, obiettivi di studio settimanali e sincronizzazione locale tra dispositivi
        arriveranno in una versione successiva.
      </p>
    </Panel>
  );
}
