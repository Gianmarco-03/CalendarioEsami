/* Day modal — quick log studio for a day */

function DayModal({ open, dayKey, exams, onClose, onToggleStudy, onSetMinutes }) {
  if (!dayKey) return null;
  const dt = parseYmd(dayKey);
  const titleRaw = `${WEEKDAYS_IT_LONG[(dt.getDay() + 6) % 7]} ${dt.getDate()} ${MONTHS_IT[dt.getMonth()]} ${dt.getFullYear()}`;
  const title = titleRaw.charAt(0).toUpperCase() + titleRaw.slice(1);
  const isToday = dayKey === TODAY;

  const active = exams.filter((e) => !e.passed);
  const infoLines = [];
  for (const e of active) {
    for (const a of e.appelli) {
      if (a.date === dayKey) infoLines.push({ color: e.color, text: e.name, kind: "Appello" });
    }
    if (e.kind === "progetto") {
      if (e.ranges.some((r) => inRange(dayKey, r.start, r.end))) {
        infoLines.push({ color: e.color, text: e.name, kind: "Progetto in corso" });
      }
    }
  }

  const footer = (
    <>
      <span style={{ flex: 1, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", letterSpacing: "0.04em" }}>
        ⌘S salva · ESC chiudi
      </span>
      <button className="btn primary" onClick={onClose}>Chiudi</button>
    </>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      kicker={isToday ? "Oggi" : "Giornata"}
      size="md"
      icon={<Icon d={UI.calendar} size={14} />}
      footer={footer}
    >
      {infoLines.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {infoLines.map((ln, i) => (
            <div key={i} className="info-line" style={{ "--ic": ln.color }}>
              <span className="dot" />
              <span>{ln.text}</span>
              <span className="kind">{ln.kind}</span>
            </div>
          ))}
        </div>
      )}

      {active.length === 0 ? (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)", padding: "8px 0" }}>
          Nessun esame attivo.
        </div>
      ) : (
        <>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--muted)", marginTop: 4 }}>
            Sto studiando per…
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {active.map((e) => {
              const studyEntry = e.studyDays.find((s) => s.date === dayKey);
              const studying = !!studyEntry;
              const suggested = e.kind === "progetto" ? 45 : 60;
              return (
                <div key={e.id} className="study-row" style={{ "--ec": e.color }}>
                  <span className="stripe" />
                  <span className="name">{e.name}</span>
                  {studying && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--muted)" }}>
                      <Icon d={UI.clock} size={12} />
                      <input
                        type="number"
                        min={0}
                        max={1440}
                        step={5}
                        placeholder={String(suggested)}
                        value={studyEntry.minutes ?? ""}
                        onChange={(ev) => {
                          const raw = ev.target.value;
                          const m = raw === "" ? null : Math.max(0, Math.min(1440, parseInt(raw, 10) || 0));
                          onSetMinutes(e.id, dayKey, m);
                        }}
                      />
                      <span className="sugg">~ {suggested}m</span>
                    </div>
                  )}
                  <input
                    type="checkbox"
                    className="checkbox-pill"
                    checked={studying}
                    onChange={() => onToggleStudy(e.id, dayKey)}
                  />
                </div>
              );
            })}
          </div>
        </>
      )}
    </Modal>
  );
}

/* Exam modal — create or edit. Minimal for prototype. */
function ExamModal({ open, editing, kind, onClose, onSave }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#E8543F");
  const [icon, setIcon] = useState("book");

  useEffect(() => {
    if (editing) {
      setName(editing.name);
      setColor(editing.color);
      setIcon(editing.icon);
    } else {
      setName("");
      setColor(EXAM_PALETTE_DEFAULT[Math.floor(Math.random() * EXAM_PALETTE_DEFAULT.length)]);
      setIcon("book");
    }
  }, [editing, open]);

  if (!open) return null;
  const isProj = (editing?.kind || kind) === "progetto";

  const footer = (
    <>
      <span style={{ flex: 1, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>
        {editing ? `Modifica · ${editing.kind}` : `Nuovo · ${kind}`}
      </span>
      <button className="btn" onClick={onClose}>Annulla</button>
      <button className="btn primary" onClick={() => { onSave({ name, color, icon }); onClose(); }}>
        {editing ? "Salva" : "Crea"}
      </button>
    </>
  );

  const iconList = Object.keys(EXAM_ICONS);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? editing.name : (isProj ? "Nuovo progetto" : "Nuovo esame")}
      kicker={isProj ? "Progetto multi-giorno" : "Esame singolo appello"}
      accent={color}
      icon={<Icon d={EXAM_ICONS[icon]} size={14} />}
      size="lg"
      footer={footer}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <label style={labelStyle}>Nome</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={isProj ? "es. Tesi triennale" : "es. Analisi II"}
          style={inputStyle}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <label style={labelStyle}>Colore</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {EXAM_PALETTE_DEFAULT.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              style={{
                width: 26, height: 26, borderRadius: 6,
                background: c,
                border: color === c ? "2px solid var(--text)" : "1px solid var(--border)",
                cursor: "pointer",
                padding: 0,
              }}
              title={c}
            />
          ))}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <label style={labelStyle}>Icona</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {iconList.map((k) => (
            <button
              key={k}
              onClick={() => setIcon(k)}
              style={{
                width: 34, height: 34, borderRadius: 8,
                background: icon === k ? color : "rgba(255,255,255,0.04)",
                color: icon === k ? "#fff" : "var(--ink-80)",
                border: icon === k ? "1px solid transparent" : "1px solid var(--border)",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              }}
              title={k}
            ><Icon d={EXAM_ICONS[k]} size={14} stroke={1.6} /></button>
          ))}
        </div>
      </div>

      <div style={{
        padding: 12,
        background: "rgba(255,255,255,0.018)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        color: "var(--ink-80)",
        lineHeight: 1.6,
      }}>
        <b style={{ color: "var(--text)" }}>Demo prototipo.</b> Nell'app reale qui ci sarebbero appelli, range progetti, totale minuti CFU, strategia di studio.
      </div>
    </Modal>
  );
}

const labelStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "var(--muted)",
};
const inputStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 13,
  color: "var(--text)",
  background: "rgba(0,0,0,0.4)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
  padding: "10px 12px",
  outline: "none",
  boxShadow: "var(--edge-inset)",
};

Object.assign(window, { DayModal, ExamModal });
