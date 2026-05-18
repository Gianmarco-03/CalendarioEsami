/* To-do placeholder + Settings view */

function TodoView() {
  return (
    <div className="todo-empty view-enter">
      <div className="icon-box"><Icon d={UI.todo} size={26} stroke={1.5} /></div>
      <h2>In arrivo</h2>
      <p>
        Lista attività per esame, deadline, sotto-task e priorità.
        L'agenda ti dirà cosa fare prima.
      </p>
      <span className="wip-badge">work in progress</span>
    </div>
  );
}

function SettingsView({ tab, settingsState, onChangeSettings }) {
  if (tab === "personalization") return <PersonalizationTab state={settingsState} onChange={onChangeSettings} />;
  if (tab === "notifications") return <NotificationsTab state={settingsState} onChange={onChangeSettings} />;
  if (tab === "data") return <DataTab />;
  if (tab === "system") return <SystemTab />;
  if (tab === "about") return <AboutTab />;
  return null;
}

function PersonalizationTab({ state, onChange }) {
  return (
    <div className="settings-content view-enter" key="pers">
      <div className="setting-card">
        <h3>Aspetto</h3>
        <p>Il tema nero è fissato — l'app è pensata per sessioni lunghe in luce bassa. Qui regoli i dettagli.</p>
        <div className="setting-row">
          <div className="ll">
            Numeri giorno in Syne
            <small>display grande tipografico sul calendario</small>
          </div>
          <input type="checkbox" className="toggle" defaultChecked />
        </div>
        <div className="setting-row">
          <div className="ll">
            Mostra weekend in grigio
            <small>sabato e domenica si distinguono</small>
          </div>
          <input type="checkbox" className="toggle" defaultChecked />
        </div>
        <div className="setting-row">
          <div className="ll">
            Hover-lift sulle celle
            <small>le celle si sollevano leggermente al passaggio</small>
          </div>
          <input type="checkbox" className="toggle" defaultChecked />
        </div>
      </div>

      <div className="setting-card">
        <h3>Settimana</h3>
        <p>Il primo giorno della settimana e quali giorni nascondere.</p>
        <div className="setting-row">
          <div className="ll">
            Primo giorno
            <small>standard europeo</small>
          </div>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-secondary)", padding: "4px 10px", border: "1px solid var(--border-strong)", borderRadius: "var(--radius-pill)" }}>lunedì</span>
        </div>
      </div>
    </div>
  );
}

function NotificationsTab() {
  return (
    <div className="settings-content view-enter" key="notif">
      <div className="setting-card">
        <h3>Promemoria</h3>
        <p>L'app può avvisarti prima di un appello o quando un progetto sta per chiudere.</p>
        <div className="setting-row">
          <div className="ll">
            Notifica appelli
            <small>3 giorni prima, alle 09:00</small>
          </div>
          <input type="checkbox" className="toggle" defaultChecked />
        </div>
        <div className="setting-row">
          <div className="ll">
            Riepilogo serale
            <small>ogni sera alle 21:30, hai loggato o no?</small>
          </div>
          <input type="checkbox" className="toggle" />
        </div>
        <div className="setting-row">
          <div className="ll">
            Streak rotto
            <small>solo se è la prima volta in 7+ giorni</small>
          </div>
          <input type="checkbox" className="toggle" defaultChecked />
        </div>
      </div>
    </div>
  );
}

function DataTab() {
  return (
    <div className="settings-content view-enter" key="data">
      <div className="setting-card">
        <h3>Backup</h3>
        <p>Il database SQLite vive nella cartella locale dell'app. Niente sync remoto.</p>
        <div className="setting-row">
          <div className="ll">
            Esporta tutto
            <small>file JSON con esami, studio, progetti</small>
          </div>
          <button className="btn">Esporta</button>
        </div>
        <div className="setting-row">
          <div className="ll">
            Importa
            <small>JSON dell'artifact originale, o esportato</small>
          </div>
          <button className="btn">Importa</button>
        </div>
        <div className="setting-row">
          <div className="ll">
            Cartella database
            <small style={{ fontFamily: "var(--font-mono)" }}>~/Library/Application Support/com.calendario-appelli.app/</small>
          </div>
          <button className="btn ghost">Apri</button>
        </div>
      </div>
      <div className="setting-card" style={{ borderColor: "var(--danger-edge)", background: "var(--danger-soft)" }}>
        <h3 style={{ color: "var(--danger)" }}>Zona pericolosa</h3>
        <p>Reset completo del database. Tutti gli esami, progetti e log studio verranno cancellati.</p>
        <button className="btn danger">Cancella tutto</button>
      </div>
    </div>
  );
}

function SystemTab() {
  return (
    <div className="settings-content view-enter" key="sys">
      <div className="setting-card">
        <h3>Comportamento</h3>
        <p>Come l'app si comporta all'avvio e mentre lavori.</p>
        <div className="setting-row">
          <div className="ll">
            Avvia automaticamente
            <small>al login del sistema</small>
          </div>
          <input type="checkbox" className="toggle" />
        </div>
        <div className="setting-row">
          <div className="ll">
            Riapri sull'ultima vista
            <small>se chiudi su Statistiche, riapri lì</small>
          </div>
          <input type="checkbox" className="toggle" defaultChecked />
        </div>
        <div className="setting-row">
          <div className="ll">
            Scorciatoia globale
            <small>⌃⌥C per aprire la finestra ovunque</small>
          </div>
          <input type="checkbox" className="toggle" defaultChecked />
        </div>
      </div>
    </div>
  );
}

function AboutTab() {
  return (
    <div className="settings-content view-enter" key="about">
      <div className="setting-card">
        <h3>claendario</h3>
        <p style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 16, color: "var(--text)", lineHeight: 1.5 }}>
          Un calendario per studenti che pensano in connessioni. Locale, sobrio, offline-first.
        </p>
        <div className="setting-row">
          <div className="ll">Versione<small style={{ fontFamily: "var(--font-mono)" }}>0.1.0 · prototipo</small></div>
        </div>
        <div className="setting-row">
          <div className="ll">Tauri<small style={{ fontFamily: "var(--font-mono)" }}>2.x · React 19 · SQLite</small></div>
        </div>
        <div className="setting-row">
          <div className="ll">Design system<small style={{ fontFamily: "var(--font-mono)" }}>Nexo Note · minimal-black</small></div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { TodoView, SettingsView });
