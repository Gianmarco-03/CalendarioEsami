/* Calendar grid + DayCell + Legend */

function CalendarHeader({ year, month, onPrev, onNext, onToday, headerStyle }) {
  const monthName = MONTHS_IT[month];
  const todayDate = TODAY_DATE;
  const todayLabel = `${WEEKDAYS_IT_LONG[(todayDate.getDay() + 6) % 7]} ${todayDate.getDate()} ${MONTHS_IT[todayDate.getMonth()]}`;

  return (
    <div className={`page-head header-${headerStyle}`}>
      <div className="left">
        <div className="kicker">Calendario · A.A. 2025–26</div>
        <h1 className="title">
          {monthName}
          <span className="year"> {year}</span>
        </h1>
        <div className="subtitle">
          <span className="live-dot" />
          <span>oggi è {todayLabel}</span>
          <span className="sep">·</span>
          <span>clicca un giorno per loggare lo studio</span>
        </div>
      </div>
      <div className="header-actions">
        <button className="nav-btn" onClick={onPrev} aria-label="Mese precedente">
          <Icon d={UI.chevL} size={16} />
        </button>
        <button className="today-btn" onClick={onToday}>Oggi</button>
        <button className="nav-btn" onClick={onNext} aria-label="Mese successivo">
          <Icon d={UI.chevR} size={16} />
        </button>
      </div>
    </div>
  );
}

function buildActivities(dayKey, exams) {
  const projects = [];
  const studies = [];
  for (const e of exams) {
    if (e.passed) continue;
    const inP = e.kind === "progetto" && e.ranges.some((r) => inRange(dayKey, r.start, r.end));
    const hasStudy = e.studyDays.some((s) => s.date === dayKey);
    if (inP) {
      projects.push({ kind: "project", color: e.color, icon: e.icon, examId: e.id, examName: e.name });
    } else if (hasStudy) {
      studies.push({ kind: "study", color: e.color, icon: e.icon, examId: e.id, examName: e.name });
    }
  }
  projects.sort((a, b) => a.examName.localeCompare(b.examName));
  studies.sort((a, b) => a.examName.localeCompare(b.examName));
  return [...projects, ...studies];
}

function buildBanners(dayKey, exams) {
  const out = [];
  for (const e of exams) {
    if (e.passed) continue;
    for (const a of e.appelli) {
      if (a.date === dayKey) out.push({ color: e.color, examName: e.name });
    }
  }
  out.sort((a, b) => a.examName.localeCompare(b.examName));
  return out;
}

function computeProjectEdges(dayKey, exams) {
  let start = false, end = false, startColor = null, endColor = null;
  for (const e of exams) {
    if (e.passed) continue;
    if (e.kind !== "progetto") continue;
    for (const r of e.ranges) {
      if (r.start === dayKey) { start = true; startColor = e.color; }
      if (r.end === dayKey)   { end = true;   endColor = e.color; }
    }
  }
  return { start, end, startColor, endColor };
}

function DayCell({ day, exams, onClick, cellStyle }) {
  const activities = buildActivities(day.key, exams);
  const banners = buildBanners(day.key, exams);
  const edges = computeProjectEdges(day.key, exams);
  const splitN = Math.min(activities.length, 4);
  const visibleBanners = banners.slice(0, 2);
  const overflowCount = banners.length - visibleBanners.length;
  const isEmpty = activities.length === 0 && banners.length === 0;
  const isWeekend = day.weekday >= 5;

  const cls = [
    "cell",
    `cell-style-${cellStyle}`,
    day.isToday ? "today" : "",
    isEmpty ? "empty" : "",
    isWeekend ? "weekend" : "",
  ].filter(Boolean).join(" ");

  const sty = {};
  if (edges.startColor) sty["--proj-start-color"] = edges.startColor;
  if (edges.endColor)   sty["--proj-end-color"]   = edges.endColor;

  // Firma signatures (style B)
  const signatures = activities.map((a) => ({
    color: a.color,
    kind: a.kind,
  }));

  return (
    <div className={cls} style={sty} onClick={() => onClick(day.key)} role="button">
      <div className="cell-head">
        {day.isToday && <span className="oggi">OGGI</span>}
        {cellStyle === "firma" && signatures.length > 0 && (
          <div className="signatures">
            {signatures.slice(0, 5).map((s, i) =>
              s.kind === "project"
                ? <span key={i} className="sig-bar" style={{ "--sc": s.color }} />
                : <span key={i} className="sig-dot" style={{ "--sc": s.color }} />
            )}
          </div>
        )}
        <span className="day-num">{day.day}</span>
      </div>

      {visibleBanners.length > 0 && (
        <div className="banners">
          {visibleBanners.map((b, i) => (
            <div
              key={i}
              className="banner"
              style={{ "--bc": b.color }}
              title={`Appello: ${b.examName}`}
            >
              <span className="banner-dot" />
              <span className="banner-name">{b.examName}</span>
            </div>
          ))}
          {overflowCount > 0 && (
            <div className="banner banner-overflow">+{overflowCount} altri</div>
          )}
        </div>
      )}

      {activities.length > 0 && cellStyle !== "firma" && (
        <div className={`band-area split-${splitN}`}>
          {activities.slice(0, 4).map((a, i) => {
            const iconD = EXAM_ICONS[a.icon] || EXAM_ICONS.book;
            return (
              <div
                key={i}
                className={`band ${a.kind}`}
                style={{ "--bc": a.color }}
                title={a.kind === "project" ? `Progetto: ${a.examName}` : `Studio: ${a.examName}`}
              >
                <Icon d={iconD} className="band-icon" size={20} stroke={1.5} />
              </div>
            );
          })}
        </div>
      )}

      {edges.start && <span className="proj-stripe-l" />}
      {edges.end && <span className="proj-stripe-r" />}
    </div>
  );
}

function Legend({ exams }) {
  const active = exams.filter((e) => !e.passed);
  if (active.length === 0) return null;
  return (
    <div className="legend">
      {active.map((e) => (
        <span key={e.id} className="item">
          <span className={`sw ${e.kind === "progetto" ? "proj" : ""}`} style={{ "--lc": e.color }} />
          {e.name}
        </span>
      ))}
    </div>
  );
}

function Calendar({ exams, onDayClick, headerStyle, cellStyle, density }) {
  const [view, setView] = useState({ y: TODAY_DATE.getFullYear(), m: TODAY_DATE.getMonth() });
  const grid = buildMonthGrid(view.y, view.m);
  const active = exams.filter((e) => !e.passed);

  const prev = () => setView((v) => v.m === 0 ? { y: v.y - 1, m: 11 } : { ...v, m: v.m - 1 });
  const next = () => setView((v) => v.m === 11 ? { y: v.y + 1, m: 0 } : { ...v, m: v.m + 1 });
  const today = () => setView({ y: TODAY_DATE.getFullYear(), m: TODAY_DATE.getMonth() });

  const totalCells = grid.leadingBlanks + grid.days.length;
  const weeks = Math.ceil(totalCells / 7);
  const trailingBlanks = weeks * 7 - totalCells;

  return (
    <div className={`cal-wrap dens-${density}`}>
      <CalendarHeader
        year={grid.year}
        month={grid.month}
        onPrev={prev}
        onNext={next}
        onToday={today}
        headerStyle={headerStyle}
      />
      <div className="weekdays">
        {WEEKDAYS_IT_SHORT.map((d, i) => (
          <div key={d} className={i >= 5 ? "weekend" : ""}>{d}</div>
        ))}
      </div>
      <div
        className="cal-grid"
        style={{ gridTemplateRows: `repeat(${weeks}, minmax(0, 1fr))` }}
        key={`${view.y}-${view.m}`}
      >
        {Array.from({ length: grid.leadingBlanks }).map((_, i) => (
          <div key={`l${i}`} className="cell empty other-month" />
        ))}
        {grid.days.map((d) => (
          <DayCell
            key={d.key}
            day={d}
            exams={active}
            onClick={onDayClick}
            cellStyle={cellStyle}
          />
        ))}
        {Array.from({ length: trailingBlanks }).map((_, i) => (
          <div key={`t${i}`} className="cell empty other-month" />
        ))}
      </div>
      <Legend exams={exams} />
    </div>
  );
}

Object.assign(window, { Calendar, DayCell, Legend, CalendarHeader });
