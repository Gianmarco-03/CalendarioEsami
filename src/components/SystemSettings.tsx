import { useEffect, useState } from "react";
import { getAutostart, setAutostart, getNotifPrefs, setNotifPref } from "../notifications";
import { useToast } from "../toast";

export function SystemSettings() {
  const toast = useToast();
  const [autostart, setAuto] = useState(false);
  const [minimize, setMinimize] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        setAuto(await getAutostart());
        const p = await getNotifPrefs();
        setMinimize(p.entries["_minimize_to_tray"]?.enabled ?? true);
      } catch (e) {
        toast.error(String(e));
      } finally {
        setLoaded(true);
      }
    })();
  }, [toast]);

  const toggleAuto = async () => {
    const next = !autostart;
    try {
      await setAutostart(next);
      await setNotifPref("_autostart", next);
      setAuto(next);
    } catch (e) {
      toast.error(String(e));
    }
  };

  const toggleMinimize = async () => {
    const next = !minimize;
    try {
      await setNotifPref("_minimize_to_tray", next);
      setMinimize(next);
    } catch (e) {
      toast.error(String(e));
    }
  };

  if (!loaded) return <div className="text-[12px] text-app-muted">Caricamento…</div>;

  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-2 text-[12.5px]">
        <input type="checkbox" checked={autostart} onChange={toggleAuto} />
        Avvia con Windows
      </label>
      <label className="flex items-center gap-2 text-[12.5px]">
        <input type="checkbox" checked={minimize} onChange={toggleMinimize} />
        Minimizza in tray invece di chiudere
      </label>
    </div>
  );
}
