import { useState } from "react";
import { importArtifactJson } from "../db";
import { useExams } from "../state";
import { useToast } from "../toast";
import { Modal } from "./Modal";
import { ModalButton } from "./ModalButton";
import { Download } from "lucide-react";

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

  const footer = (
    <>
      <div className="flex-1" />
      <ModalButton variant="secondary" onClick={onClose}>Annulla</ModalButton>
      <ModalButton variant="primary" disabled={busy} onClick={handleImport}>
        {busy ? "Importazione…" : "Importa"}
      </ModalButton>
    </>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Importa da artifact"
      icon={Download}
      size="xl"
      footer={footer}
    >
      <p className="text-[11.5px] text-app-muted leading-relaxed m-0">
        Incolla il valore di{" "}
        <code className="bg-app-soft rounded px-1 py-[1px] text-[10.5px]">appelliStudio_v1</code>{" "}
        dal localStorage dell'artifact HTML. Le voci con nome già presente verranno saltate.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder='{"exams":[…]}'
        rows={9}
        className="glass-input font-mono resize-y"
      />
    </Modal>
  );
}
