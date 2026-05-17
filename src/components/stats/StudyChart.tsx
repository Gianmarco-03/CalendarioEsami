import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, Activity, TrendingUp } from "lucide-react";
import { ChartModeToggle, type ChartMode } from "./ChartModeToggle";

export type { ChartMode };

export interface DayPoint {
  date: string;
  label: string;
  minutes: number;
}

interface Props {
  data: DayPoint[];
  referenceData?: DayPoint[];
  viewMode: ChartMode;
  onViewModeChange?: (m: ChartMode) => void;
  todayIndex?: number;
  title?: string;
  subtitle?: string;
  animationKey?: string | number;
  /** Override del colore "actual" (default: var(--color-stats-actual)). */
  accentColor?: string;
}

const SVG_W = 800;
const SVG_H = 320;
const PL = 50;
const PR = 18;
const PT = 18;
const PB = 36;
const CW = SVG_W - PL - PR;
const CH = SVG_H - PT - PB;
const AXIS_TICKS = 5;
const LINE_DRAW = "stroke-dashoffset 1.6s cubic-bezier(0.22, 1, 0.36, 1)";

function niceStep(v: number) {
  if (v <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(v));
  const r = v / mag;
  if (r <= 1) return mag;
  if (r <= 2) return 2 * mag;
  if (r <= 5) return 5 * mag;
  return 10 * mag;
}
function getScaleMax(maxV: number) {
  if (maxV <= 0) return 1;
  const target = maxV < 5 ? maxV : maxV * 1.08;
  const step = niceStep(target / (AXIS_TICKS - 1));
  return step * (AXIS_TICKS - 1);
}
function fmt(v: number) { return Number.isInteger(v) ? `${v}` : v.toFixed(0); }

type Point = { x: number; y: number };
function buildPoints(values: number[], scaleMax: number): Point[] {
  return values.map((v, i) => ({
    x: PL + (i / Math.max(1, values.length - 1)) * CW,
    y: PT + (1 - v / scaleMax) * CH,
  }));
}
function smoothPath(pts: Point[], area = false) {
  if (pts.length < 2) return "";
  let p = `M ${pts[0].x},${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const cur = pts[i];
    const next = pts[i + 1];
    const cp1x = prev.x + (cur.x - prev.x) * 0.35;
    const cp1y = prev.y;
    const cp2x = cur.x - (next ? (next.x - cur.x) * 0.18 : 0);
    const cp2y = cur.y;
    p += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${cur.x},${cur.y}`;
  }
  if (area) {
    p += ` L ${pts[pts.length - 1].x},${PT + CH}`;
    p += ` L ${PL},${PT + CH} Z`;
  }
  return p;
}

function decimateLabels(data: DayPoint[]): string[] {
  const n = data.length;
  if (n <= 14) return data.map((d) => d.label);
  const stride = Math.ceil(n / 12);
  return data.map((d, i) => (i % stride === 0 ? d.label : ""));
}

export function StudyChart({ data, referenceData, viewMode, onViewModeChange, todayIndex, title, subtitle, animationKey, accentColor }: Props) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [chartVisible, setChartVisible] = useState(false);
  const lineRef = useRef<SVGPathElement | null>(null);
  const uid = useId().replace(/:/g, "");
  const gradId = `stats-grad-${uid}`;
  const clipId = `stats-clip-${uid}`;

  const values = useMemo(() => data.map((d) => d.minutes), [data]);
  const refValues = useMemo(() => referenceData?.map((d) => d.minutes) ?? [], [referenceData]);
  const hasRef = refValues.some((v) => v > 0);
  const scaleMax = useMemo(
    () => getScaleMax(Math.max(0, ...values, ...refValues)),
    [values, refValues]
  );
  const pts = useMemo(() => buildPoints(values, scaleMax), [values, scaleMax]);
  const refPts = useMemo(() => hasRef ? buildPoints(refValues, scaleMax) : [], [hasRef, refValues, scaleMax]);
  const labels = useMemo(() => decimateLabels(data), [data]);

  const metrics = useMemo(() => {
    if (values.length === 0) return { peak: 0, growth: 0, average: 0 };
    const peak = Math.max(...values);
    const average = values.reduce((s, v) => s + v, 0) / values.length;
    const growth = values[values.length - 1] - values[0];
    return { peak, average, growth };
  }, [values]);

  const animationToken = useMemo(() => {
    return `${animationKey ?? "x"}|${viewMode}|${values.join(",")}|${refValues.join(",")}`;
  }, [animationKey, viewMode, values, refValues]);

  useLayoutEffect(() => {
    setChartVisible(false);
    setHovered(null);
    if (lineRef.current) {
      lineRef.current.style.transition = "none";
      lineRef.current.style.strokeDasharray = "";
      lineRef.current.style.strokeDashoffset = "0";
      lineRef.current.style.opacity = "0";
    }
  }, [animationToken]);

  useEffect(() => {
    if (viewMode === "bars") {
      const id = window.setTimeout(() => setChartVisible(true), 120);
      return () => window.clearTimeout(id);
    }
    const el = lineRef.current;
    if (!el) return;
    let raf = 0;
    let to = 0;
    try {
      const len = el.getTotalLength();
      el.style.transition = "none";
      el.style.strokeDasharray = `${len}`;
      el.style.strokeDashoffset = `${len}`;
      el.style.opacity = "1";
      el.getBoundingClientRect();
      raf = window.requestAnimationFrame(() => {
        el.style.transition = LINE_DRAW;
        el.style.strokeDashoffset = "0";
        to = window.setTimeout(() => setChartVisible(true), 220);
      });
    } catch {
      el.style.opacity = "1";
      setChartVisible(true);
    }
    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      if (to) window.clearTimeout(to);
    };
  }, [viewMode, animationToken]);

  const ticks = useMemo(() => {
    const arr: { value: number; y: number }[] = [];
    for (let i = 0; i < AXIS_TICKS; i++) {
      const ratio = i / (AXIS_TICKS - 1);
      arr.push({ value: scaleMax * (1 - ratio), y: PT + ratio * CH });
    }
    return arr;
  }, [scaleMax]);

  const linePath = useMemo(
    () => (viewMode === "line" ? smoothPath(pts, false) : ""),
    [viewMode, pts]
  );
  const areaPath = useMemo(
    () => (viewMode === "line" ? smoothPath(pts, true) : ""),
    [viewMode, pts]
  );
  const refPath = useMemo(
    () => (viewMode === "line" && hasRef ? smoothPath(refPts, false) : ""),
    [viewMode, hasRef, refPts]
  );

  const barW = Math.min(28, (CW / Math.max(1, data.length)) * 0.28);
  const overlayW = barW * 0.74;
  const baseY = PT + CH;
  const tIdx = todayIndex !== undefined && todayIndex >= 0 && todayIndex < pts.length ? todayIndex : -1;

  // Quando accentColor è fornito, override la CSS variable solo nello scope di questo chart.
  const containerStyle = accentColor
    ? ({ ["--color-stats-actual" as string]: accentColor } as React.CSSProperties)
    : undefined;

  return (
    <div className="stats-chart" style={containerStyle}>
      {(title || subtitle || onViewModeChange) && (
        <div className="stats-chart__head">
          <div>
            {title && <div className="stats-chart__title">{title}</div>}
            {subtitle && <div className="stats-chart__subtitle">{subtitle}</div>}
          </div>
          {onViewModeChange && (
            <ChartModeToggle value={viewMode} onChange={onViewModeChange} />
          )}
        </div>
      )}

      <div className="stats-chart__metrics">
        <div className="stats-chart__metric">
          <div className="stats-chart__cm-head">
            <span className="stats-chart__cm-icon-wrap"><ArrowUp size={13} /></span>
            <span>Picco</span>
          </div>
          <div className="stats-chart__cm-value">{fmt(metrics.peak)}<span className="stats-chart__cm-unit">min</span></div>
        </div>
        <div className="stats-chart__metric">
          <div className="stats-chart__cm-head">
            <span className="stats-chart__cm-icon-wrap"><TrendingUp size={13} /></span>
            <span>Crescita</span>
          </div>
          <div className="stats-chart__cm-value">
            {metrics.growth > 0 ? `+${fmt(metrics.growth)}` : fmt(metrics.growth)}
            <span className="stats-chart__cm-unit">min</span>
          </div>
        </div>
        <div className="stats-chart__metric">
          <div className="stats-chart__cm-head">
            <span className="stats-chart__cm-icon-wrap"><Activity size={13} /></span>
            <span>Media</span>
          </div>
          <div className="stats-chart__cm-value">{fmt(metrics.average)}<span className="stats-chart__cm-unit">min</span></div>
        </div>
      </div>

      {hasRef && (
        <div className="stats-chart__legend">
          <span className="stats-chart__legend-item">
            <span className="stats-chart__legend-dot" />
            Effettivo
          </span>
          <span className="stats-chart__legend-item">
            <span className={viewMode === "bars" ? "stats-chart__legend-bar" : "stats-chart__legend-dash"} />
            Consigliato
          </span>
        </div>
      )}

      <div className="stats-chart__svg-wrap">
        <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} preserveAspectRatio="xMidYMid meet" className="stats-chart__svg">
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-stats-actual)" stopOpacity="0.45" />
              <stop offset="100%" stopColor="var(--color-stats-actual)" stopOpacity="0.02" />
            </linearGradient>
            <clipPath id={clipId}>
              <rect x="0" y="0" width={chartVisible ? SVG_W : 0} height={SVG_H} style={{ transition: "width 1.4s cubic-bezier(0.22, 1, 0.36, 1)" }} />
            </clipPath>
          </defs>

          {ticks.map((t, i) => (
            <g key={i}>
              <text x={PL - 10} y={t.y + 4} textAnchor="end" className="stats-chart__y-label">{fmt(t.value)}</text>
              <line x1={PL} y1={t.y} x2={SVG_W - PR} y2={t.y} className="stats-chart__grid-line" />
            </g>
          ))}
          <line x1={PL} y1={baseY} x2={SVG_W - PR} y2={baseY} className="stats-chart__axis-line" />

          {tIdx >= 0 && (
            <g>
              <line x1={pts[tIdx].x} y1={PT} x2={pts[tIdx].x} y2={baseY} className="stats-chart__today-line" />
              <text x={pts[tIdx].x} y={PT - 4} textAnchor="middle" className="stats-chart__today-badge">oggi</text>
            </g>
          )}

          {viewMode === "line" && (
            <>
              <path d={areaPath} clipPath={`url(#${clipId})`} className="stats-chart__area" style={{ fill: `url(#${gradId})` }} />
              <path ref={lineRef} d={linePath} className="stats-chart__line" />
              {hasRef && refPath && (
                <>
                  <path d={refPath} className="stats-chart__ref-line" clipPath={`url(#${clipId})`} />
                  {refPts.map((p, i) => (
                    <circle key={i} cx={p.x} cy={p.y} r={chartVisible ? 3 : 0} className="stats-chart__ref-point" />
                  ))}
                </>
              )}
              {pts.map((p, i) => {
                const isFuture = tIdx >= 0 && i > tIdx;
                return (
                  <circle
                    key={i}
                    cx={p.x}
                    cy={p.y}
                    r={hovered === i ? 5 : 3.5}
                    className={`stats-chart__actual-point${isFuture ? " is-future" : ""}`}
                    style={{ opacity: isFuture ? 0.4 : (chartVisible ? 1 : 0), transitionDelay: `${820 + i * 70}ms` }}
                    onMouseEnter={() => setHovered(i)}
                    onMouseLeave={() => setHovered(null)}
                  />
                );
              })}
            </>
          )}

          {viewMode === "bars" && data.map((d, i) => {
            const isFuture = tIdx >= 0 && i > tIdx;
            const a = d.minutes;
            const r = referenceData?.[i]?.minutes ?? 0;
            const aH = a > 0 ? Math.max(2, (a / scaleMax) * CH) : 0;
            const rH = r > 0 ? Math.max(2, (r / scaleMax) * CH) : 0;
            const aLower = a <= r;
            const aBar = { h: aH, w: aLower ? overlayW : barW, y: baseY - aH };
            const rBar = { h: rH, w: aLower ? barW : overlayW, y: baseY - rH };
            const layers = aLower
              ? [{ ...rBar, cls: "stats-chart__bar stats-chart__bar--reference" }, { ...aBar, cls: "stats-chart__bar stats-chart__bar--actual" }]
              : [{ ...aBar, cls: "stats-chart__bar stats-chart__bar--actual" }, { ...rBar, cls: "stats-chart__bar stats-chart__bar--reference" }];
            const x = pts[i].x;
            return (
              <g key={i} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
                {layers.filter((l) => l.h > 0).map((l, j) => (
                  <rect
                    key={j}
                    x={x - l.w / 2}
                    y={l.y}
                    width={l.w}
                    height={l.h}
                    rx={6}
                    className={`${l.cls}${isFuture ? " is-future" : ""}`}
                    style={{ opacity: chartVisible ? (isFuture ? 0.45 : 1) : 0, transform: chartVisible ? "scaleY(1)" : "scaleY(0.35)", transitionDelay: `${180 + i * 70}ms` }}
                  />
                ))}
              </g>
            );
          })}

          {labels.map((lbl, i) => (
            lbl ? (
              <text key={i} x={pts[i].x} y={SVG_H - 12} textAnchor="middle" className="stats-chart__x-label">{lbl}</text>
            ) : null
          ))}

          {hovered !== null && pts[hovered] && (
            <g>
              <rect
                x={Math.max(PL, Math.min(SVG_W - PR - 128, pts[hovered].x - 64))}
                y={10}
                width={128}
                height={hasRef ? 74 : 58}
                rx={12}
                className="stats-chart__tooltip-box"
              />
              <text
                x={Math.max(PL + 64, Math.min(SVG_W - PR - 64, pts[hovered].x))}
                y={31}
                textAnchor="middle"
                className="stats-chart__tooltip-title"
              >{data[hovered].label}</text>
              <text
                x={Math.max(PL + 64, Math.min(SVG_W - PR - 64, pts[hovered].x))}
                y={50}
                textAnchor="middle"
                className="stats-chart__tooltip-value"
              >{fmt(data[hovered].minutes)} min</text>
              {hasRef && referenceData && (
                <text
                  x={Math.max(PL + 64, Math.min(SVG_W - PR - 64, pts[hovered].x))}
                  y={67}
                  textAnchor="middle"
                  className="stats-chart__tooltip-ref"
                >≈ {fmt(referenceData[hovered].minutes)} consigliato</text>
              )}
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}
