import { BarChart3 } from "lucide-react";

export function StatsView() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center py-16">
      <BarChart3 size={48} className="text-app-muted mb-4" />
      <h2 className="text-lg font-semibold mb-2">Statistiche</h2>
      <p className="text-[13px] text-app-muted max-w-sm">
        In arrivo: ore di studio per esame, distribuzione settimanale, andamento mensile,
        progresso verso gli obiettivi.
      </p>
      <span className="mt-4 text-[10.5px] font-bold uppercase tracking-wide text-app-muted bg-[#eef0f3] px-2 py-0.5 rounded">
        Work in progress
      </span>
    </div>
  );
}
