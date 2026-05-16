import { useState } from "react";
import { importArtifactJson } from "../db";
import { useExams } from "../state";
import { useToast } from "../toast";
import { Modal } from "./Modal";

interface ImportModalProps {
  open: boolean;
  onClose: () => void;
}

export function ImportModal({ open, onClose }: ImportModalProps) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const { refetch } = useExams();
  const toast = useToast();

  const handleImport = async () => {
    if (!text.trim()) { toast.error("Incolla il JSON dell'artifact"); return; }
    setBusy(true);
    try {
      const report = await importArtifactJson(text);
      toast.success(`Importati ${report.inserted}, saltati ${report.skipped}`);
      if (report.errors.length > 0) {
        for (const err of report.errors.slice(0, 5)) toast.info(err);
      }
      await refetch();
      onClose();
      setText("");
    } catch (e) {
      toast.error(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Importa da artifact">
      <p className="text-[11.5px] text-app-muted mb-2 leading-relaxed">
        Incolla il valore di <code className="bg-[#eef0f3] rounded px-1">appelliStudio_v1</code> dal
        localStorage dell'artifact HTML. Le voci con nome già presente verranno saltate.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder='{"exams":[…]}'
        rows={10}
        className="w-full px-2 py-2 border border-[#d6d9e0] rounded-lg text-[12px] font-mono"
      />
      <div className="flex gap-2 mt-3">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 px-2.5 py-1.5 rounded-lg text-[12.5px] font-semibold border border-[#d6d9e0] bg-white text-[#2f3545] hover:bg-[#f4f5f7]"
        >Annulla</button>
        <button
          type="button"
          disabled={busy}
          onClick={handleImport}
          className="flex-1 px-2.5 py-1.5 rounded-lg text-[12.5px] font-semibold bg-[#2f3545] text-white border border-[#2f3545] hover:bg-[#1f2430] disabled:opacity-50"
        >{busy ? "Importazione…" : "Importa"}</button>
      </div>
    </Modal>
  );
}
