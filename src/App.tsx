import { ExamsProvider } from "./state";
import { ToastProvider } from "./toast";

function Shell() {
  return (
    <div className="min-h-screen bg-app-bg text-app-fg p-4">
      <div className="max-w-[1100px] mx-auto flex gap-4 items-start">
        <aside className="w-[290px] shrink-0 rounded-2xl bg-white border border-app-border shadow-sm p-4">
          <h2 className="font-semibold text-[15px] mb-1">Esami e progetti</h2>
          <p className="text-[11.5px] text-app-muted leading-relaxed mb-3">
            Clicca un giorno per segnare lo studio. I <b>progetti</b> sono esami che durano più giorni.
            Spunta la casella quando hai superato/completato.
          </p>
          <div className="text-sm text-app-muted">Sidebar (in arrivo)</div>
        </aside>
        <main className="flex-1 min-w-0 rounded-2xl bg-white border border-app-border shadow-sm p-4">
          <h1 className="text-base font-semibold mb-3">📅 Calendario Appelli &amp; Studio</h1>
          <div className="text-sm text-app-muted">Calendario (in arrivo)</div>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <ExamsProvider>
        <Shell />
      </ExamsProvider>
    </ToastProvider>
  );
}
