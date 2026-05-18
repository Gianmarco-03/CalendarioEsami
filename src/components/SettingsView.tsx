import { Sun, Moon } from "lucide-react";
import { useTheme } from "../theme";
import { NotificationsSettings } from "./NotificationsSettings";
import { SystemSettings } from "./SystemSettings";
import { ErrorBoundary } from "./ErrorBoundary";
import type { SettingsTab } from "./settings-tabs";

interface SettingsViewProps {
  tab: SettingsTab;
}

export function SettingsView({ tab }: SettingsViewProps) {
  return (
    <div className="settings-content">
      {tab === "personalization" && <PersonalizationPanel />}
      {tab === "notifications" && (
        <ErrorBoundary fallbackTitle="Errore in NotificationsSettings">
          <Panel title="Notifiche" description="Cosa, quando e come ti viene mostrato.">
            <NotificationsSettings />
          </Panel>
        </ErrorBoundary>
      )}
      {tab === "system" && (
        <ErrorBoundary fallbackTitle="Errore in SystemSettings">
          <Panel title="App e sistema" description="Avvio con Windows e comportamento di chiusura.">
            <SystemSettings />
          </Panel>
        </ErrorBoundary>
      )}
      {tab === "profile" && <ProfilePanel />}
    </div>
  );
}

function Panel({
  title, description, children,
}: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="setting-card">
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {children}
      </div>
    </div>
  );
}

function PersonalizationPanel() {
  const { theme, setTheme } = useTheme();
  return (
    <>
      <Panel
        title="Aspetto"
        description="Nexo Note nasce con un'unica palette: nero pieno, accent bianco, colori-utente come firma. Il tema scuro è il default."
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="nx-label">Tema</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <button
              type="button"
              onClick={() => setTheme("light")}
              className={"btn full" + (theme === "light" ? " primary" : "")}
              style={{ flexDirection: "column", gap: 8, padding: "16px 12px" }}
            >
              <Sun size={20} /> Chiaro
            </button>
            <button
              type="button"
              onClick={() => setTheme("dark")}
              className={"btn full" + (theme === "dark" ? " primary" : "")}
              style={{ flexDirection: "column", gap: 8, padding: "16px 12px" }}
            >
              <Moon size={20} /> Scuro
            </button>
          </div>
        </div>
      </Panel>
    </>
  );
}

function ProfilePanel() {
  return (
    <Panel title="Profilo utente" description="In arrivo.">
      <p style={{
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        color: "var(--ink-80)",
        lineHeight: 1.6,
        margin: 0,
      }}>
        Nome, avatar, obiettivi di studio settimanali e sincronizzazione locale tra dispositivi
        arriveranno in una versione successiva.
      </p>
    </Panel>
  );
}
