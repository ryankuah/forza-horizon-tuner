import * as React from "react";
import type { CornerEffect, PathSample, SvgPoint, Telemetry } from "@/types/telemetry";
import { average, clampNumber } from "@/lib/math";
import { formatValue } from "@/lib/format";
import { buildPathFromTelemetry } from "@/features/map/pathSamples";
import { buildCornerSegments, frontTireSlipAngle, rearTireSlipAngle } from "@/features/map/cornerAnalysis";
import { metricToneClass } from "./TelemetryPanelPrimitives";

type TuningPhaseId = "entry" | "mid" | "exit";
type BalanceTendency = "understeer" | "oversteer" | "neutral" | "unknown";

type TuningPhaseDefinition = {
  id: TuningPhaseId;
  label: string;
};

type CornerBehaviorSummary = {
  id: number;
  label: string;
  effect: Exclude<CornerEffect, "straight">;
  distanceMeters: number;
  avgSpeedKmh: number;
  pathPoints: SvgPoint[];
  phases: CornerPhaseSummary[];
};

type CornerPhaseSummary = {
  id: TuningPhaseId;
  label: string;
  tendency: BalanceTendency;
  balanceScore: number;
  percent: number;
  points: CornerGraphPoint[];
  understeerPercent: number;
  oversteerPercent: number;
  neutralPercent: number;
};

type CornerGraphPoint = {
  frontSlip: number;
  rearSlip: number;
  balance: number;
  throttlePct: number;
  brakePct: number;
  steerPct: number;
  tendency: BalanceTendency;
};

const TUNING_PHASES: TuningPhaseDefinition[] = [
  { id: "entry", label: "Braking / corner entry" },
  { id: "mid", label: "Turning / mid-corner" },
  { id: "exit", label: "Exit / throttle application" }
];

export function BehaviorPanel({ samples }: { samples: Telemetry[] }) {
  const corners = React.useMemo(() => summarizeCornerBehavior(samples), [samples]);

  return (
    <div className="h-full min-h-0 min-w-0 overflow-auto">
      {corners.length === 0 ? (
        <div className="rounded-lg border border-white/[0.08] bg-[#171717] p-4 text-sm leading-5 text-[#b5bfb9]">
          No cornering samples yet.
        </div>
      ) : (
        <div className="grid min-h-0 grid-cols-[repeat(auto-fit,minmax(620px,1fr))] gap-3">
          {corners.map((corner) => (
            <CornerBehaviorCard key={corner.id} corner={corner} />
          ))}
        </div>
      )}
    </div>
  );
}

function CornerBehaviorCard({ corner }: { corner: CornerBehaviorSummary }) {
  return (
    <section className="grid min-w-0 content-start gap-3 rounded-lg border border-white/[0.08] bg-[#171717] p-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 border-b border-white/[0.07] pb-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${corner.effect === "leftCorner" ? "bg-[#63da97]" : "bg-[#e46645]"}`} />
          <strong className="text-sm leading-tight text-[#f5f7f6]">{corner.label}</strong>
        </div>
        <div className="flex items-center gap-3 text-right text-xs font-black tabular-nums text-[#f5f7f6]">
          <span>{formatValue(corner.distanceMeters, { precision: 0 })} m</span>
          <span>{formatValue(corner.avgSpeedKmh, { precision: 0 })} km/h</span>
        </div>
      </div>

      <CornerOverviewGraphic corner={corner} />

      <div className="grid gap-3 xl:grid-cols-3">
        {corner.phases.map((phase) => (
          <CornerPhaseGraph key={phase.id} phase={phase} />
        ))}
      </div>
    </section>
  );
}

function CornerOverviewGraphic({ corner }: { corner: CornerBehaviorSummary }) {
  const pathData = svgPathData(corner.pathPoints);
  const phaseSegments = buildCornerGraphicPhaseSegments(corner.pathPoints);
  const entryPoint = corner.pathPoints[0] ?? { x: 54, y: 120 };
  const midPoint = pointAtPathProgress(corner.pathPoints, 0.5);
  const exitPoint = corner.pathPoints[corner.pathPoints.length - 1] ?? { x: 306, y: 120 };
  const direction = directionIndicator(corner.pathPoints);
  const turnLabel = corner.effect === "leftCorner" ? "Left corner" : "Right corner";
  const phaseMarkers: { id: TuningPhaseId; point: { x: number; y: number } }[] = [
    { id: "entry", point: entryPoint },
    { id: "mid", point: midPoint },
    { id: "exit", point: exitPoint }
  ];

  return (
    <section className="grid min-w-0 gap-3 rounded-md bg-white/[0.025] p-3 md:grid-cols-[minmax(0,1fr)_190px] md:items-center">
      <svg className="h-44 w-full overflow-visible" viewBox="0 0 360 170" role="img" aria-label={`${corner.label} analyzed track corner with entry mid-corner and exit`}>
        <rect x="8" y="12" width="344" height="146" rx="8" fill="rgba(245,247,246,0.025)" stroke="rgba(245,247,246,0.08)" />
        <path d={pathData} fill="none" stroke="rgba(245,247,246,0.18)" strokeWidth="24" strokeLinecap="round" strokeLinejoin="round" />
        <path d={pathData} fill="none" stroke="rgba(245,247,246,0.55)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="10 12" />
        <path d={pathData} fill="none" stroke={corner.effect === "leftCorner" ? "#63da97" : "#e46645"} strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" opacity="0.2" />
        {phaseSegments.map((segment) => (
          <polyline
            key={segment.id}
            points={segment.points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ")}
            fill="none"
            stroke={phaseColor(segment.id)}
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        <path d={direction.path} fill="none" stroke="#f5f7f6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
        {phaseMarkers.map((marker) => (
          <g key={marker.id}>
            <circle cx={marker.point.x} cy={marker.point.y} r="8" fill="#171717" stroke={phaseColor(marker.id)} strokeWidth="3" />
            <circle cx={marker.point.x} cy={marker.point.y} r="3" fill={phaseColor(marker.id)} />
          </g>
        ))}
        <text x={labelX(entryPoint)} y={labelY(entryPoint)} textAnchor="middle" className="fill-[#9ba6a1] text-[10px] font-black uppercase tracking-wide">Entry</text>
        <text x={labelX(midPoint)} y={labelY(midPoint, -12)} textAnchor="middle" className="fill-[#9ba6a1] text-[10px] font-black uppercase tracking-wide">Mid</text>
        <text x={labelX(exitPoint)} y={labelY(exitPoint)} textAnchor="middle" className="fill-[#9ba6a1] text-[10px] font-black uppercase tracking-wide">Exit</text>
      </svg>

      <div className="grid gap-3">
        <div className="grid gap-1">
          <span className="text-[10px] font-black uppercase tracking-wide text-[#9ba6a1]">Analyzed segment</span>
          <strong className="text-sm leading-tight text-[#f5f7f6]">{turnLabel}</strong>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {corner.phases.map((phase) => (
            <div key={phase.id} className="grid gap-1">
              <span className="h-1.5 rounded-full" style={{ backgroundColor: phaseColor(phase.id) }} />
              <span className="text-[10px] font-black uppercase leading-none tracking-wide text-[#9ba6a1]">{phase.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function normalizeCornerPath(path: PathSample[]) {
  const width = 360;
  const height = 170;
  const paddingX = 32;
  const paddingY = 26;
  const sourcePoints = downsamplePathSamples(path, 120).map((sample) => ({ x: sample.x, y: -sample.z }));
  if (sourcePoints.length === 0) return [];

  const minX = Math.min(...sourcePoints.map((point) => point.x));
  const maxX = Math.max(...sourcePoints.map((point) => point.x));
  const minY = Math.min(...sourcePoints.map((point) => point.y));
  const maxY = Math.max(...sourcePoints.map((point) => point.y));
  const sourceWidth = Math.max(1, maxX - minX);
  const sourceHeight = Math.max(1, maxY - minY);
  const scale = Math.min((width - paddingX * 2) / sourceWidth, (height - paddingY * 2) / sourceHeight);
  const renderedWidth = sourceWidth * scale;
  const renderedHeight = sourceHeight * scale;
  const offsetX = (width - renderedWidth) / 2;
  const offsetY = (height - renderedHeight) / 2;

  return sourcePoints.map((point) => ({
    x: offsetX + (point.x - minX) * scale,
    y: offsetY + (point.y - minY) * scale
  }));
}

function downsamplePathSamples(path: PathSample[], maxPoints: number) {
  if (path.length <= maxPoints) return path;

  const result: PathSample[] = [];
  const step = (path.length - 1) / (maxPoints - 1);
  for (let index = 0; index < maxPoints; index += 1) {
    result.push(path[Math.round(index * step)]);
  }
  return result;
}

function svgPathData(points: SvgPoint[]) {
  if (points.length === 0) return "";
  return points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
}

function buildCornerGraphicPhaseSegments(points: SvgPoint[]): { id: TuningPhaseId; points: SvgPoint[] }[] {
  const segments: { id: TuningPhaseId; points: SvgPoint[] }[] = [];
  if (points.length < 2) return segments;

  const distances = cumulativePointDistances(points);
  const totalDistance = distances[distances.length - 1] ?? 0;
  if (totalDistance <= 0) return [{ id: "mid", points }];

  for (let index = 1; index < points.length; index += 1) {
    const phaseId = phaseAtCornerProgress((distances[index] ?? 0) / totalDistance);
    const previousPoint = points[index - 1];
    const point = points[index];
    const current = segments[segments.length - 1];

    if (current && current.id === phaseId) {
      current.points.push(point);
    } else {
      segments.push({ id: phaseId, points: [previousPoint, point] });
    }
  }

  return segments;
}

function pointAtPathProgress(points: SvgPoint[], progress: number) {
  if (points.length === 0) return { x: 180, y: 85 };
  if (points.length === 1) return points[0];

  const distances = cumulativePointDistances(points);
  const totalDistance = distances[distances.length - 1] ?? 0;
  const targetDistance = totalDistance * clampNumber(progress, 0, 1);
  const index = distances.findIndex((distance) => distance >= targetDistance);
  if (index <= 0) return points[0];

  const previousDistance = distances[index - 1] ?? 0;
  const segmentDistance = Math.max(1, (distances[index] ?? 0) - previousDistance);
  const ratio = (targetDistance - previousDistance) / segmentDistance;
  const previousPoint = points[index - 1];
  const point = points[index];
  return {
    x: previousPoint.x + (point.x - previousPoint.x) * ratio,
    y: previousPoint.y + (point.y - previousPoint.y) * ratio
  };
}

function directionIndicator(points: SvgPoint[]) {
  const from = pointAtPathProgress(points, 0.58);
  const to = pointAtPathProgress(points, 0.66);
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const size = 14;
  const left = {
    x: to.x - Math.cos(angle - 0.65) * size,
    y: to.y - Math.sin(angle - 0.65) * size
  };
  const right = {
    x: to.x - Math.cos(angle + 0.65) * size,
    y: to.y - Math.sin(angle + 0.65) * size
  };

  return {
    path: `M${left.x.toFixed(1)} ${left.y.toFixed(1)} L${to.x.toFixed(1)} ${to.y.toFixed(1)} L${right.x.toFixed(1)} ${right.y.toFixed(1)}`
  };
}

function cumulativePointDistances(points: SvgPoint[]) {
  const distances = new Array<number>(points.length).fill(0);
  for (let index = 1; index < points.length; index += 1) {
    distances[index] = distances[index - 1] + Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y);
  }
  return distances;
}

function labelX(point: SvgPoint) {
  return clampNumber(point.x, 34, 326);
}

function labelY(point: SvgPoint, offset = 24) {
  return clampNumber(point.y + offset, 24, 150);
}

function CornerPhaseGraph({ phase }: { phase: CornerPhaseSummary }) {
  const tendency = tendencyCopy(phase.tendency);

  return (
    <section className="grid min-w-0 content-start gap-3 rounded-md bg-white/[0.025] p-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: phaseColor(phase.id) }} />
          <strong className="text-xs leading-tight text-[#f5f7f6]">{phase.label}</strong>
        </div>
        <div className="text-right">
          <strong className={`block text-xs tabular-nums ${metricToneClass(tendency.tone)}`}>{tendency.label}</strong>
          <span className="text-[10px] tabular-nums text-[#9ba6a1]">{formatValue(phase.percent, { precision: 0 })}%</span>
        </div>
      </div>

      <SlipBalanceChart phase={phase} />

      <div className="grid grid-cols-3 gap-2">
        <BalanceShare label="Under" value={phase.understeerPercent} color="#f3d09b" />
        <BalanceShare label="Neutral" value={phase.neutralPercent} color="#9ba6a1" />
        <BalanceShare label="Over" value={phase.oversteerPercent} color="#e46645" />
      </div>
    </section>
  );
}

function SlipBalanceChart({ phase }: { phase: CornerPhaseSummary }) {
  const width = 360;
  const height = 170;
  const chartTop = 12;
  const slipChartBottom = 88;
  const inputChartTop = 104;
  const inputChartBottom = 140;
  const slipChartHeight = slipChartBottom - chartTop;
  const inputChartHeight = inputChartBottom - inputChartTop;
  const points = phase.points.length > 1
    ? phase.points
    : [{ frontSlip: 0, rearSlip: 0, balance: phase.balanceScore, throttlePct: 0, brakePct: 0, steerPct: 0, tendency: phase.tendency }];
  const maxSlip = Math.max(0.2, ...points.flatMap((point) => [point.frontSlip, point.rearSlip]));
  const frontPolyline = points.map((point, index) => {
    const x = points.length <= 1 ? width / 2 : (index / (points.length - 1)) * width;
    const y = slipToChartY(point.frontSlip, maxSlip, chartTop, slipChartHeight);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const rearPolyline = points.map((point, index) => {
    const x = points.length <= 1 ? width / 2 : (index / (points.length - 1)) * width;
    const y = slipToChartY(point.rearSlip, maxSlip, chartTop, slipChartHeight);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const balancePolyline = points.map((point, index) => {
    const x = points.length <= 1 ? width / 2 : (index / (points.length - 1)) * width;
    const y = balanceToChartY(point.balance, chartTop, slipChartHeight);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const throttlePolyline = points.map((point, index) => {
    const x = points.length <= 1 ? width / 2 : (index / (points.length - 1)) * width;
    const y = percentToChartY(point.throttlePct, inputChartTop, inputChartHeight);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const brakePolyline = points.map((point, index) => {
    const x = points.length <= 1 ? width / 2 : (index / (points.length - 1)) * width;
    const y = percentToChartY(point.brakePct, inputChartTop, inputChartHeight);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const steerPolyline = points.map((point, index) => {
    const x = points.length <= 1 ? width / 2 : (index / (points.length - 1)) * width;
    const y = signedPercentToChartY(point.steerPct, inputChartTop, inputChartHeight);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const averageY = balanceToChartY(phase.balanceScore, chartTop, slipChartHeight);

  return (
    <div className="grid gap-2">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2">
        <span className="text-[10px] font-black uppercase tracking-[0.08em] text-[#9ba6a1]">Slip / balance / inputs</span>
        <span className="text-xs font-black tabular-nums text-[#f5f7f6]">{formatSignedValue(phase.balanceScore, 2)}</span>
      </div>
      <svg className="h-44 w-full overflow-visible" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${phase.label} front rear slip balance throttle brake and steering trend`}>
        <rect x="0" y={chartTop} width={width} height={slipChartHeight / 2} fill="#e46645" opacity="0.13" />
        <rect x="0" y={chartTop + slipChartHeight / 2} width={width} height={slipChartHeight / 2} fill="#f3d09b" opacity="0.13" />
        <rect x="0" y={inputChartTop} width={width} height={inputChartHeight} fill="rgba(245,247,246,0.035)" />
        {points.map((point, index) => {
          const x = (index / points.length) * width;
          const stripeWidth = Math.max(1, width / points.length);
          return (
            <rect
              key={`${index}-${point.tendency}`}
              x={x}
              y={inputChartBottom + 7}
              width={stripeWidth}
              height="8"
              fill={balanceColor(point.tendency)}
              opacity="0.8"
            />
          );
        })}
        <line x1="0" y1={balanceToChartY(0, chartTop, slipChartHeight)} x2={width} y2={balanceToChartY(0, chartTop, slipChartHeight)} stroke="rgba(245,247,246,0.32)" strokeWidth="1" strokeDasharray="4 4" />
        <line x1="0" y1={averageY} x2={width} y2={averageY} stroke="#f5f7f6" strokeWidth="1.5" opacity="0.8" />
        <line x1="0" y1={inputChartTop + inputChartHeight / 2} x2={width} y2={inputChartTop + inputChartHeight / 2} stroke="rgba(245,247,246,0.18)" strokeWidth="1" strokeDasharray="3 5" />
        <polyline points={frontPolyline} fill="none" stroke="#59a7ff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        <polyline points={rearPolyline} fill="none" stroke="#e46645" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        <polyline points={balancePolyline} fill="none" stroke="#f5f7f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" vectorEffect="non-scaling-stroke" />
        <polyline points={throttlePolyline} fill="none" stroke="#63da97" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        <polyline points={brakePolyline} fill="none" stroke="#f3d09b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        <polyline points={steerPolyline} fill="none" stroke="#b68cff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        <text x="0" y="11" className="fill-[#e46645] text-[10px] font-black uppercase tracking-wide">Oversteer</text>
        <text x={width / 2} y={balanceToChartY(0, chartTop, slipChartHeight) - 5} textAnchor="middle" className="fill-[#9ba6a1] text-[10px] font-black uppercase tracking-wide">Neutral</text>
        <text x="0" y={inputChartTop - 16} className="fill-[#f3d09b] text-[10px] font-black uppercase tracking-wide">Understeer</text>
        <g transform={`translate(96 ${inputChartTop - 8})`}>
          <LegendItem x={0} color="#59a7ff" label="Front slip" />
          <LegendItem x={110} color="#e46645" label="Rear slip" />
        </g>
        <text x="0" y={inputChartTop - 4} className="fill-[#9ba6a1] text-[9px] font-black uppercase tracking-wide">Inputs</text>
        <g transform={`translate(0 ${inputChartBottom + 27})`}>
          <LegendItem x={0} color="#f5f7f6" label="Balance" />
          <LegendItem x={88} color="#63da97" label="Throttle" />
        </g>
      </svg>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] font-black uppercase tracking-wide text-[#9ba6a1]">
        <LegendText color="#f3d09b" label="Brake" />
        <LegendText color="#b68cff" label="Steer" />
      </div>
    </div>
  );
}

function LegendItem({ x, color, label }: { x: number; color: string; label: string }) {
  return (
    <>
      <line x1={x} y1="0" x2={x + 18} y2="0" stroke={color} strokeWidth="3" strokeLinecap="round" />
      <text x={x + 24} y="3" className="fill-[#9ba6a1] text-[10px] font-black uppercase tracking-wide">{label}</text>
    </>
  );
}

function balanceToChartY(score: number, top: number, height: number) {
  return top + (0.5 - clampNumber(score, -1, 1) * 0.5) * height;
}

function slipToChartY(slip: number, maxSlip: number, top: number, height: number) {
  return top + (1 - clampNumber(slip / maxSlip, 0, 1)) * height;
}

function percentToChartY(percent: number, top: number, height: number) {
  return top + (1 - clampNumber(percent, 0, 100) / 100) * height;
}

function signedPercentToChartY(percent: number, top: number, height: number) {
  return top + (0.5 - clampNumber(percent, -100, 100) / 200) * height;
}

function balanceColor(tendency: BalanceTendency) {
  if (tendency === "understeer") return "#f3d09b";
  if (tendency === "oversteer") return "#e46645";
  if (tendency === "neutral") return "#9bd9a9";
  return "#9ba6a1";
}

function LegendText({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-1.5 w-4 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function phaseColor(phase: TuningPhaseId) {
  if (phase === "entry") return "#e46645";
  if (phase === "mid") return "#59a7ff";
  return "#63da97";
}

function BalanceShare({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="grid gap-1">
      <div className="grid gap-0.5">
        <span className="text-[9px] font-black uppercase leading-none tracking-wide text-[#9ba6a1]">{label}</span>
        <span className="text-xs font-black leading-none tabular-nums text-[#f5f7f6]">{formatValue(value, { precision: 0 })}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full" style={{ width: `${clampNumber(value, 0, 100)}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function summarizeCornerBehavior(samples: Telemetry[]): CornerBehaviorSummary[] {
  const path = buildPathFromTelemetry(samples);
  const corners = buildCornerSegments(path);

  return corners
    .map((corner) => summarizeCorner(corner.id, corner.effect, corner.samples))
    .filter((corner): corner is CornerBehaviorSummary => Boolean(corner));
}

function summarizeCorner(id: number, effect: Exclude<CornerEffect, "straight">, pathSamples: PathSample[]): CornerBehaviorSummary | null {
  if (pathSamples.length < 3) return null;

  const distances = cumulativePathDistances(pathSamples);
  const totalDistance = distances[distances.length - 1] ?? 0;
  if (totalDistance <= 0) return null;

  const phaseBuckets = new Map<TuningPhaseId, CornerPhaseBucket>();
  for (const phase of TUNING_PHASES) {
    phaseBuckets.set(phase.id, emptyCornerPhaseBucket());
  }

  let speedKmhTotal = 0;
  let speedCount = 0;

  for (let index = 0; index < pathSamples.length; index += 1) {
    const sample = pathSamples[index]?.telemetry;
    if (!sample || sample.IsRaceOn !== 1) continue;

    const progress = (distances[index] ?? 0) / totalDistance;
    const phaseId = phaseAtCornerProgress(progress);
    const bucket = phaseBuckets.get(phaseId);
    if (!bucket) continue;

    const frontSlip = average([Math.abs(sample.TireCombinedSlipFrontLeft), Math.abs(sample.TireCombinedSlipFrontRight)]);
    const rearSlip = average([Math.abs(sample.TireCombinedSlipRearLeft), Math.abs(sample.TireCombinedSlipRearRight)]);
    const balance = balanceScore(frontTireSlipAngle(sample), rearTireSlipAngle(sample), frontSlip, rearSlip);
    const tendency = sampleTendency(balance);

    bucket.points.push({
      frontSlip,
      rearSlip,
      balance,
      throttlePct: sample.throttlePct,
      brakePct: sample.brakePct,
      steerPct: sample.steerPct,
      tendency
    });
    bucket.balanceTotal += balance;
    bucket.understeerSamples += tendency === "understeer" ? 1 : 0;
    bucket.oversteerSamples += tendency === "oversteer" ? 1 : 0;
    bucket.neutralSamples += tendency === "neutral" ? 1 : 0;
    speedKmhTotal += sample.speedKmh;
    speedCount += 1;
  }

  return {
    id,
    label: `Corner ${String(id + 1).padStart(2, "0")} · ${effect === "leftCorner" ? "Left" : "Right"}`,
    effect,
    distanceMeters: totalDistance,
    avgSpeedKmh: speedCount > 0 ? speedKmhTotal / speedCount : 0,
    pathPoints: normalizeCornerPath(pathSamples),
    phases: TUNING_PHASES.map((phase) => summarizeCornerPhase(phase, phaseBuckets.get(phase.id), pathSamples.length))
  };
}

type CornerPhaseBucket = {
  points: CornerGraphPoint[];
  balanceTotal: number;
  understeerSamples: number;
  oversteerSamples: number;
  neutralSamples: number;
};

function emptyCornerPhaseBucket(): CornerPhaseBucket {
  return {
    points: [],
    balanceTotal: 0,
    understeerSamples: 0,
    oversteerSamples: 0,
    neutralSamples: 0
  };
}

function summarizeCornerPhase(
  definition: TuningPhaseDefinition,
  bucket: CornerPhaseBucket | undefined,
  totalCornerSamples: number
): CornerPhaseSummary {
  const points = bucket?.points ?? [];
  const sampleCount = points.length;
  const balance = sampleCount > 0 ? (bucket?.balanceTotal ?? 0) / sampleCount : 0;
  const understeerPercent = percentOf(bucket?.understeerSamples ?? 0, sampleCount);
  const oversteerPercent = percentOf(bucket?.oversteerSamples ?? 0, sampleCount);
  const neutralPercent = percentOf(bucket?.neutralSamples ?? 0, sampleCount);

  return {
    id: definition.id,
    label: shortPhaseLabel(definition.id),
    tendency: phaseTendency(balance, understeerPercent, oversteerPercent, sampleCount),
    balanceScore: balance,
    percent: percentOf(sampleCount, totalCornerSamples),
    points: downsampleCornerGraphPoints(points, 90),
    understeerPercent,
    oversteerPercent,
    neutralPercent
  };
}

function cumulativePathDistances(path: PathSample[]) {
  const distances = new Array<number>(path.length).fill(0);
  for (let index = 1; index < path.length; index += 1) {
    distances[index] = distances[index - 1] + Math.hypot(path[index].x - path[index - 1].x, path[index].z - path[index - 1].z);
  }
  return distances;
}

function phaseAtCornerProgress(progress: number): TuningPhaseId {
  if (progress < 0.34) return "entry";
  if (progress < 0.67) return "mid";
  return "exit";
}

function shortPhaseLabel(phase: TuningPhaseId) {
  if (phase === "entry") return "Entry";
  if (phase === "mid") return "Mid-corner";
  return "Exit";
}

function downsampleCornerGraphPoints(points: CornerGraphPoint[], maxPoints: number) {
  if (points.length <= maxPoints) return points;

  const result: CornerGraphPoint[] = [];
  const bucketSize = points.length / maxPoints;

  for (let bucketIndex = 0; bucketIndex < maxPoints; bucketIndex += 1) {
    const start = Math.floor(bucketIndex * bucketSize);
    const end = Math.max(start + 1, Math.floor((bucketIndex + 1) * bucketSize));
    const bucket = points.slice(start, end);
    const frontSlip = average(bucket.map((point) => point.frontSlip));
    const rearSlip = average(bucket.map((point) => point.rearSlip));
    const balance = average(bucket.map((point) => point.balance));
    const throttlePct = average(bucket.map((point) => point.throttlePct));
    const brakePct = average(bucket.map((point) => point.brakePct));
    const steerPct = average(bucket.map((point) => point.steerPct));
    result.push({ frontSlip, rearSlip, balance, throttlePct, brakePct, steerPct, tendency: sampleTendency(balance) });
  }

  return result;
}

function balanceScore(frontAngle: number, rearAngle: number, frontSlip: number, rearSlip: number) {
  const angleBalance = rearAngle - frontAngle;
  const slipBalance = (rearSlip - frontSlip) * 0.35;
  return clampNumber(angleBalance + slipBalance, -2.5, 2.5);
}

function sampleTendency(score: number): Exclude<BalanceTendency, "unknown"> {
  if (score < -0.18) return "understeer";
  if (score > 0.18) return "oversteer";
  return "neutral";
}

function phaseTendency(score: number, understeerPercent: number, oversteerPercent: number, milliseconds: number): BalanceTendency {
  if (milliseconds <= 0) return "unknown";
  if (score < -0.14) return "understeer";
  if (score > 0.14) return "oversteer";
  if (understeerPercent > oversteerPercent + 18) return "understeer";
  if (oversteerPercent > understeerPercent + 18) return "oversteer";
  return "neutral";
}

function tendencyCopy(tendency: BalanceTendency): { label: string; tone: "default" | "ok" | "warn" | "alert" } {
  if (tendency === "understeer") return { label: "Understeer", tone: "warn" };
  if (tendency === "oversteer") return { label: "Oversteer", tone: "alert" };
  if (tendency === "neutral") return { label: "Neutral", tone: "ok" };
  return { label: "No data", tone: "default" };
}

function percentOf(value: number, total: number) {
  return total > 0 ? (value / total) * 100 : 0;
}

function formatSignedValue(value: number, precision: number) {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatValue(value, { precision })}`;
}
