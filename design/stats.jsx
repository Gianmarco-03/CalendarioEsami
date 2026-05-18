/* Stats view — range selector, KPIs, chart, heatmap, per-exam bars */

const STATS_RANGES = [
  { id: "7g",    label: "7 giorni" },
  { id: "30g",   label: "30 giorni" },
  { id: "mese",  label: "Mese" },
  { id: "anno",  label: "Anno" },
  { id: "tutto", label: "Tutto" },
];

function resolveRange(rangeId) {
  const today = parseYmd(TODAY);
  const ms = 86400000;
  if (rangeId === "7g") {
    const start = new Date(today.getTime() - 6 * ms);
    return { start: ymd(start), end: TODAY };
  }
  if (rangeId === "30g") {
    const start = new Date(today.getTime() - 29 * ms);
    return { start: ymd(start), end: TODAY };
  }
  if (rangeId === "mese") {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return { start: ymd(start), end: ymd(end) };
  }
  if (rangeId === "anno") {
    const start = new Date(today.getFullYear(), 0, 1);
    return { start: ymd(start), end: TODAY };
  }
  return { start: "2026-01-01", end: TODAY };
}

function StatsView({ exams, selectedExamId, onDayClick, headerStyle }) {
  const [range, setRange] = useState("7g");
  const { start, end } = resolveRange(range);

  const selectedExam = selectedExamId != null
    ? exams.find((e) => e.id === selectedExamId)
    : null;

  // Build day-by-day series for the chart
  const series = useMemo(() => {
    const days = [];
    let cur = start;
    while (cur <= end) {
      days.push(cur);
      cur = ymdAdd(cur, 1);
    }
    const filter = (e) => selectedExamId == null ? !e.passed : e.id === selectedExamId;
    return days.map((d) => {
      let actual = 0, suggested = 0;
      for (const e of exams) {
        if (!filter(e)) continue;
        const sd = e.studyDays.find((s) => s.date === d);
        if (sd) actual += sd.minutes || 0;
        // simple suggested: 45min/day during the 14 days before next appello
        for (const a of e.appelli) {
          const ap = parseYmd(a.date);
          const dd = parseYmd(d);
          const diff = Math.round((ap - dd) / 86400000);
          if (diff >= 0 && diff <= 13) suggested += Math.round(60 * (1 - diff / 20));
        }
        if (e.kind === "progetto") {
          for (const r of e.ranges) {
            if (inRange(d, r.start, r.end)) suggested += 45;
          }
        }
      }
      return { date: d, actual, suggested };
    });
  }, [exams, selectedExamId, start, end]);

  // KPIs
  const kpis = useMemo(() => {
    const total = series.reduce((a, s) => a + s.actual, 0);
    const totalSugg = series.reduce((a, s) => a + s.suggested, 0);
    const streak = computeStreak(exams, TODAY);
    const today = series[series.length - 1]?.actual || 0;
    const avg = series.length ? Math.round(total / series.length) : 0;
    return { total, totalSugg, streak, today, avg };
  }, [series, exams]);

  const accent = selectedExam ? selectedExam.color : null;

  return (
    <div className="stats-scroll">
      <StatsHero exam={selectedExam} headerStyle={headerStyle} />

      <div className="range-selector">
        {STATS_RANGES.map((r) => (
          <button
            key={r.id}
            className={range === r.id ? "active" : ""}
            onClick={() => setRange(r.id)}
          >{r.label}</button>
        ))}
      </div>

      <KpiCards kpis={kpis} />

      <TodayQuickLog exams={exams} selectedExamId={selectedExamId} />

      <div className="section-block">
        <div className="head">
          <div className="titlerow">
            <h3>EFFETTIVO · CONSIGLIATO</h3>
            <span className="sub">
              {selectedExam ? "filtrato sull'esame selezionato" : "tempo loggato vs suggerito dalla formula"}
            </span>
          </div>
        </div>
        <StudyChart data={series} accent={accent} />
      </div>

      <div className="section-block">
        <div className="head">
          <div className="titlerow">
            <h3>HEATMAP {parseYmd(TODAY).getFullYear()}</h3>
            <span className="sub">intensità per giorno · clicca per dettagli</span>
          </div>
        </div>
        <YearHeatmap exams={exams} onDayClick={onDayClick} accent={accent} selectedExamId={selectedExamId} />
      </div>

      {selectedExamId == null && (
        <div className="section-block">
          <div className="head">
            <div className="titlerow">
              <h3>PER ESAME · {range.toUpperCase()}</h3>
              <span className="sub">distribuzione del tempo nel periodo</span>
            </div>
          </div>
          <PerExamBars exams={exams} start={start} end={end} />
        </div>
      )}
    </div>
  );
}

function StatsHero({ exam, headerStyle }) {
  if (!exam) {
    return (
      <div className="stats-hero">
        <div className="swatch global">
          <Icon d={UI.globe} size={20} />
        </div>
        <div className="title-wrap">
          <div className="kicker">Statistiche · vista globale</div>
          <h1>Globale</h1>
        </div>
      </div>
    );
  }
  return (
    <div className="stats-hero">
      <div className="swatch" style={{ "--hc": exam.color }}>
        <Icon d={EXAM_ICONS[exam.icon]} size={22} stroke={1.6} />
      </div>
      <div className="title-wrap" style={{ "--hc": exam.color }}>
        <div className="kicker">
          {exam.kind === "progetto" ? "Statistiche · progetto" : "Statistiche · esame"}
        </div>
        <h1><span className="colored">{exam.name}</span></h1>
      </div>
    </div>
  );
}

function KpiCards({ kpis }) {
  const tot = formatStudyTime(kpis.total) || "0m";
  const sugg = formatStudyTime(kpis.totalSugg) || "0m";
  return (
    <div className="kpi-grid">
      <div className="kpi">
        <div className="label">Totale</div>
        <div className="value">
          <span className="num">{tot.replace(/[^0-9]+$/, "")}</span>
          <span className="unit">{tot.match(/[a-z]+$/i)?.[0]}</span>
        </div>
        <div className="delta">consigliato {sugg}</div>
      </div>
      <div className="kpi">
        <div className="label">Oggi</div>
        <div className="value">
          <span className="num">{Math.floor((kpis.today || 0))}</span>
          <span className="unit">min</span>
        </div>
        <div className="delta up">▲ in corso</div>
      </div>
      <div className="kpi">
        <div className="label">Media</div>
        <div className="value">
          <span className="num">{kpis.avg}</span>
          <span className="unit">min/giorno</span>
        </div>
        <div className="delta">su tutto il periodo</div>
      </div>
      <div className="kpi">
        <div className="label">Streak</div>
        <div className="value">
          <span className="num">{kpis.streak}</span>
          <span className="unit">giorni</span>
        </div>
        <div className="delta">consecutivi · senza pausa</div>
      </div>
    </div>
  );
}

function computeStreak(exams, today) {
  // streak = number of consecutive days backwards including today with >0 minutes
  const allDays = new Set();
  for (const e of exams) {
    if (e.passed) continue;
    for (const s of e.studyDays) {
      if ((s.minutes || 0) > 0) allDays.add(s.date);
    }
  }
  let streak = 0;
  let cur = today;
  while (allDays.has(cur)) {
    streak++;
    cur = ymdAdd(cur, -1);
  }
  return streak;
}

function TodayQuickLog({ exams, selectedExamId }) {
  const active = exams.filter((e) => !e.passed && e.kind !== "progetto");
  const filtered = selectedExamId == null ? active : active.filter((e) => e.id === selectedExamId);
  if (filtered.length === 0) return null;
  return (
    <div className="section-block">
      <div className="head">
        <div className="titlerow">
          <h3>OGGI · QUICK LOG</h3>
          <span className="sub">tap per loggare l'attività</span>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
        {filtered.slice(0, 6).map((e) => {
          const todayStudy = e.studyDays.find((s) => s.date === TODAY);
          return (
            <div
              key={e.id}
              style={{
                position: "relative",
                display: "flex", alignItems: "center", gap: 10,
                padding: "12px 14px 12px 16px",
                background: "var(--panel)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                boxShadow: "var(--edge-inset)",
                "--ec": e.color,
              }}
            >
              <span style={{
                position: "absolute", left: 0, top: 10, bottom: 10, width: 2,
                borderRadius: 999, background: e.color,
              }} />
              <div style={{ width: 24, height: 24, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", color: e.color, background: `color-mix(in srgb, ${e.color} 14%, transparent)` }}>
                <Icon d={EXAM_ICONS[e.icon]} size={13} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.name}</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
                  {todayStudy ? `${todayStudy.minutes} min loggati` : "non loggato"}
                </div>
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: todayStudy ? "var(--text)" : "var(--ink-70)", textTransform: "uppercase" }}>
                {todayStudy ? "✓" : "+"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StudyChart({ data, accent }) {
  const W = 800, H = 220;
  const PAD_L = 36, PAD_R = 12, PAD_T = 12, PAD_B = 26;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;
  const maxV = Math.max(60, ...data.map((d) => Math.max(d.actual, d.suggested)));
  const ySteps = 4;
  const x = (i) => PAD_L + (data.length <= 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v) => PAD_T + innerH - (v / maxV) * innerH;
  const barW = data.length ? Math.max(4, Math.min(40, innerW / data.length - 4)) : 8;
  const lineColor = accent || "#fafafa";

  // line points
  const pts = data.map((d, i) => `${x(i)},${y(d.actual)}`).join(" ");
  const fillPts = `${PAD_L},${PAD_T + innerH} ${pts} ${PAD_L + innerW},${PAD_T + innerH}`;
  const refPts = data.map((d, i) => `${x(i)},${y(d.suggested)}`).join(" ");

  const todayIdx = data.findIndex((d) => d.date === TODAY);

  return (
    <div className="chart-card">
      <svg className="chart-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="chart-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity="0.35" />
            <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Y gridlines */}
        {Array.from({ length: ySteps + 1 }).map((_, i) => {
          const v = (maxV / ySteps) * (ySteps - i);
          const yy = PAD_T + (innerH / ySteps) * i;
          return (
            <g key={i}>
              <line x1={PAD_L} x2={PAD_L + innerW} y1={yy} y2={yy} className="chart-gridline" />
              <text x={PAD_L - 6} y={yy + 3} className="chart-axis" textAnchor="end">{Math.round(v)}</text>
            </g>
          );
        })}
        {/* Suggested bars (faint behind) */}
        {data.map((d, i) => (
          <rect
            key={`s${i}`}
            x={x(i) - barW / 2}
            y={y(d.suggested)}
            width={barW}
            height={Math.max(0, PAD_T + innerH - y(d.suggested))}
            className="chart-bar-suggested"
            rx="2"
          />
        ))}
        {/* Actual bars in front (smaller, narrower) */}
        {data.map((d, i) => (
          <rect
            key={`a${i}`}
            x={x(i) - barW / 4}
            y={y(d.actual)}
            width={barW / 2}
            height={Math.max(0, PAD_T + innerH - y(d.actual))}
            className={`chart-bar ${i === todayIdx ? "today" : ""}`}
            style={i === todayIdx && accent ? { fill: accent } : (accent ? { fill: accent, opacity: 0.85 } : {})}
            rx="2"
          />
        ))}
        {/* Today marker */}
        {todayIdx >= 0 && (
          <line
            x1={x(todayIdx)} x2={x(todayIdx)}
            y1={PAD_T} y2={PAD_T + innerH}
            className="chart-today-line"
          />
        )}
        {/* X labels */}
        {data.map((d, i) => {
          if (data.length > 14 && i % Math.ceil(data.length / 7) !== 0) return null;
          return (
            <text key={`x${i}`} x={x(i)} y={H - 8} className="chart-axis" textAnchor="middle">
              {formatXLabel(d.date, data.length)}
            </text>
          );
        })}
      </svg>
      <div style={{ display: "flex", gap: 18, marginTop: 12, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 10, height: 4, background: lineColor, borderRadius: 2 }} />
          effettivo
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 10, height: 4, background: "rgba(255,255,255,0.18)", borderRadius: 2 }} />
          consigliato
        </span>
      </div>
    </div>
  );
}

function formatXLabel(dateKey, n) {
  const d = parseYmd(dateKey);
  if (n <= 14) return WEEKDAYS_IT_SHORT[(d.getDay() + 6) % 7];
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

function YearHeatmap({ exams, onDayClick, accent, selectedExamId }) {
  const year = parseYmd(TODAY).getFullYear();
  const filter = (e) => selectedExamId == null ? !e.passed : e.id === selectedExamId;

  // Build minutes-per-day map
  const minutesByDay = useMemo(() => {
    const m = new Map();
    for (const e of exams) {
      if (!filter(e)) continue;
      for (const s of e.studyDays) {
        if (s.date.startsWith(String(year))) {
          m.set(s.date, (m.get(s.date) || 0) + (s.minutes || 0));
        }
      }
    }
    return m;
  }, [exams, selectedExamId, year]);

  const maxM = Math.max(60, ...minutesByDay.values());

  // Compose 53 columns × 7 rows starting from first Mon on or before Jan 1
  const start = new Date(year, 0, 1);
  const dow = (start.getDay() + 6) % 7;  // 0 = Monday
  const calStart = new Date(year, 0, 1 - dow);
  const days = [];
  for (let i = 0; i < 371; i++) {
    const dt = new Date(calStart.getTime() + i * 86400000);
    if (dt.getFullYear() > year) break;
    days.push({
      key: ymd(dt),
      inYear: dt.getFullYear() === year,
      day: dt.getDate(),
      month: dt.getMonth(),
    });
  }

  const baseColor = accent || "#fafafa";
  function intensity(mins) {
    if (!mins) return null;
    const pct = Math.min(1, mins / maxM);
    return `color-mix(in srgb, ${baseColor} ${10 + 70 * pct}%, transparent)`;
  }

  // Month labels
  const monthLabels = [];
  for (let m = 0; m < 12; m++) {
    const first = new Date(year, m, 1);
    const dowFirst = Math.floor((first - calStart) / 86400000 / 7);
    monthLabels.push({ name: MONTHS_IT_SHORT[m], col: dowFirst });
  }

  return (
    <div className="heatmap-card">
      <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 10, padding: "0 0 0 24px", fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--muted)" }}>
        {monthLabels.map((m, i) => (
          <span key={i} style={{ minWidth: 24 }}>{m.name}</span>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ display: "grid", gridTemplateRows: "repeat(7, 12px)", gap: 3, fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--ink-70)", letterSpacing: "0.04em", paddingTop: 2 }}>
          {["L","","M","","V","",""].map((d, i) => <span key={i} style={{ height: 12, lineHeight: "12px" }}>{d}</span>)}
        </div>
        <div className="heatmap-grid">
          {days.map((d, i) => {
            const mins = minutesByDay.get(d.key) || 0;
            const bg = intensity(mins);
            return (
              <div
                key={i}
                className="heatmap-cell"
                style={{
                  background: bg || (d.inYear ? "rgba(255,255,255,0.04)" : "transparent"),
                  borderColor: d.key === TODAY ? "var(--text)" : "rgba(255,255,255,0.04)",
                  opacity: d.inYear ? 1 : 0.2,
                  cursor: d.inYear && mins > 0 ? "pointer" : "default",
                }}
                onClick={() => d.inYear && onDayClick(d.key)}
                title={`${d.key}: ${mins} min`}
              />
            );
          })}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
        <span>meno</span>
        {[0.1, 0.3, 0.55, 0.8, 1].map((pct, i) => (
          <span key={i} style={{ width: 12, height: 12, borderRadius: 2, background: `color-mix(in srgb, ${baseColor} ${10 + 70 * pct}%, transparent)` }} />
        ))}
        <span>più</span>
      </div>
    </div>
  );
}

function PerExamBars({ exams, start, end }) {
  const active = exams.filter((e) => !e.passed);
  const totals = active.map((e) => {
    let total = 0;
    for (const s of e.studyDays) {
      if (s.date >= start && s.date <= end) total += s.minutes || 0;
    }
    return { exam: e, total };
  }).sort((a, b) => b.total - a.total);
  const max = Math.max(...totals.map((t) => t.total), 1);
  return (
    <div className="exam-bars">
      {totals.map(({ exam: e, total }) => (
        <div key={e.id} className="exam-bar">
          <div className="nm">
            <span className="nm-dot" style={{ "--bc": e.color }} />
            <span className="nm-text">{e.name}</span>
          </div>
          <div className="track" style={{ "--bc": e.color, "--pct": `${(total / max) * 100}%` }}>
            <span />
          </div>
          <div className="val">{formatStudyTime(total) || "0m"}</div>
        </div>
      ))}
    </div>
  );
}

Object.assign(window, { StatsView, KpiCards, StudyChart, YearHeatmap, PerExamBars, STATS_RANGES });
