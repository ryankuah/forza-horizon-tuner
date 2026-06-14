import * as React from "react";
import type { PathSample, RunTelemetrySet, SvgPoint, Telemetry } from "@/types/telemetry";
import { average, clampNumber } from "@/lib/math";
import { formatValue } from "@/lib/format";
import { buildPathFromTelemetry } from "@/features/map/pathSamples";
import { buildCornerSegments } from "@/features/map/cornerAnalysis";
import {
  pathDistanceMeters,
  SectionTraceChart,
  type SectionMetric,
  type TraceSeries
} from "@/features/dashboard/TrackSectionGraphs";

type StraightSummary = {
  id: string;
  label: string;
  samples: PathSample[];
  pathPoints: SvgPoint[];
  metrics: SectionMetric[];
};

const MIN_STRAIGHT_SAMPLES = 8;
const MIN_STRAIGHT_DISTANCE_METERS = 50;
const PERCENT_DOMAIN = [0, 100] as const;
const LONGITUDINAL_G_DOMAIN = [-1.5, 1.5] as const;
const NORMALIZED_DOMAIN = [0, 1] as const;

const POWERTRAIN_SERIES: TraceSeries[] = [
  { label: "Speed", color: "#d7c7ad", value: (sample) => sample.speedKmh, format: kmhLabel, domain: "zero-max" },
  { label: "RPM", color: "#b68cff", value: (sample) => sample.CurrentEngineRpm, format: rpmLabel, domain: "zero-max" },
  { label: "Power", color: "#63da97", value: (sample) => sample.powerHp, format: hpLabel, domain: "zero-max" }
];

const INPUT_LOAD_SERIES: TraceSeries[] = [
  { label: "Throttle", color: "#63da97", value: (sample) => sample.throttlePct, format: percentLabel, domain: PERCENT_DOMAIN },
  { label: "Brake", color: "#f3d09b", value: (sample) => sample.brakePct, format: percentLabel, domain: PERCENT_DOMAIN },
  { label: "Longitudinal G", color: "#59a7ff", value: (sample) => sample.AccelerationZ / 9.81, format: gLabel, domain: LONGITUDINAL_G_DOMAIN }
];

const DRIVEN_SLIP_SERIES: TraceSeries[] = [
  { label: "Driven slip", color: "#e46645", value: drivenSlip, domain: "zero-max" }
];

const SLIP_RATIO_SERIES: TraceSeries[] = [
  { label: "Front slip ratio", color: "#86b7ff", value: frontSlipRatio, domain: "zero-max" },
  { label: "Rear slip ratio", color: "#ff8a6d", value: rearSlipRatio, domain: "zero-max" }
];

const FRONT_SUSPENSION_TRAVEL_SERIES: TraceSeries[] = [
  { label: "FL travel", color: "#59a7ff", value: (sample) => sample.NormalizedSuspensionTravelFrontLeft, format: ratioLabel, domain: NORMALIZED_DOMAIN },
  { label: "FR travel", color: "#a9ccff", value: (sample) => sample.NormalizedSuspensionTravelFrontRight, format: ratioLabel, domain: NORMALIZED_DOMAIN }
];

const REAR_SUSPENSION_TRAVEL_SERIES: TraceSeries[] = [
  { label: "RL travel", color: "#ffb86c", value: (sample) => sample.NormalizedSuspensionTravelRearLeft, format: ratioLabel, domain: NORMALIZED_DOMAIN },
  { label: "RR travel", color: "#e46645", value: (sample) => sample.NormalizedSuspensionTravelRearRight, format: ratioLabel, domain: NORMALIZED_DOMAIN }
];

export function StraightsPanel({ samples, sampleSets }: { samples: Telemetry[]; sampleSets?: RunTelemetrySet[] }) {
  const straights = React.useMemo(
    () => sampleSets?.length
      ? sampleSets.flatMap((set) => summarizeStraights(set.samples, set.label))
      : summarizeStraights(samples),
    [sampleSets, samples]
  );

  return (
    <div className="h-full min-h-0 min-w-0 overflow-auto">
      {straights.length === 0 ? (
        <div className="border-b border-white/[0.08] py-4 text-sm leading-5 text-[#b5bfb9]">
          No straight sections detected yet.
        </div>
      ) : (
        <div className="grid min-h-0 gap-8">
          {straights.map((straight) => (
            <StraightCard key={straight.id} straight={straight} />
          ))}
        </div>
      )}
    </div>
  );
}

function StraightCard({ straight }: { straight: StraightSummary }) {
  const [hoverProgress, setHoverProgress] = React.useState<number | null>(null);

  return (
    <section className="grid min-w-0 content-start gap-3 pb-8 last:pb-0">
      <div className="grid gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#63da97]" />
          <strong className="text-base leading-tight text-[#f5f7f6]">{straight.label}</strong>
          <StraightMetricStrip metrics={straight.metrics} />
        </div>
      </div>

      <div className="grid gap-2">
        <StraightOverviewGraphic straight={straight} hoverProgress={hoverProgress} />
        <StraightGraphGroup title="Powertrain / load">
          <SectionTraceChart title="Speed / powertrain" samples={straight.samples} series={POWERTRAIN_SERIES} showGearChanges hoverProgress={hoverProgress} onHoverProgress={setHoverProgress} />
          <SectionTraceChart title="Inputs / longitudinal load" samples={straight.samples} series={INPUT_LOAD_SERIES} showGearChanges hoverProgress={hoverProgress} onHoverProgress={setHoverProgress} />
        </StraightGraphGroup>
        <StraightGraphGroup title="Traction">
          <SectionTraceChart title="Driven slip" samples={straight.samples} series={DRIVEN_SLIP_SERIES} showGearChanges hoverProgress={hoverProgress} onHoverProgress={setHoverProgress} />
          <SectionTraceChart title="Front / rear slip ratio" samples={straight.samples} series={SLIP_RATIO_SERIES} scale="shared" domain="zero-max" showGearChanges hoverProgress={hoverProgress} onHoverProgress={setHoverProgress} />
        </StraightGraphGroup>
        <StraightGraphGroup title="Platform">
          <SectionTraceChart title="Front suspension travel" samples={straight.samples} series={FRONT_SUSPENSION_TRAVEL_SERIES} scale="shared" domain={NORMALIZED_DOMAIN} showGearChanges hoverProgress={hoverProgress} onHoverProgress={setHoverProgress} />
          <SectionTraceChart title="Rear suspension travel" samples={straight.samples} series={REAR_SUSPENSION_TRAVEL_SERIES} scale="shared" domain={NORMALIZED_DOMAIN} showGearChanges hoverProgress={hoverProgress} onHoverProgress={setHoverProgress} />
        </StraightGraphGroup>
      </div>
    </section>
  );
}

function StraightGraphGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid min-w-0 gap-2">
      <h3 className="text-[10px] font-black uppercase tracking-[0.16em] text-[#8e9994]">{title}</h3>
      <div className="grid gap-2 xl:grid-cols-2 2xl:grid-cols-3">
        {children}
      </div>
    </section>
  );
}

function StraightMetricStrip({ metrics }: { metrics: SectionMetric[] }) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-black uppercase tracking-wide text-[#8e9994]">
      {metrics.map((metric) => (
        <span key={metric.label} className="inline-flex items-baseline gap-1.5">
          <span>{metric.label}</span>
          <span className="text-xs text-[#f5f7f6]">{metric.value}</span>
        </span>
      ))}
    </div>
  );
}

function StraightOverviewGraphic({ straight, hoverProgress }: { straight: StraightSummary; hoverProgress: number | null }) {
  const pathData = svgPathData(straight.pathPoints);
  const startPoint = straight.pathPoints[0] ?? { x: 54, y: 120 };
  const endPoint = straight.pathPoints[straight.pathPoints.length - 1] ?? { x: 306, y: 120 };
  const direction = directionIndicator(straight.pathPoints);
  const hoverPoint = hoverProgress === null ? null : pointAtPathProgress(straight.pathPoints, hoverProgress);

  return (
    <section className="grid min-w-0 gap-2 py-1 md:grid-cols-[minmax(0,1fr)_7rem] md:items-center">
      <svg className="h-[150px] w-full overflow-visible" viewBox="0 0 360 160" role="img" aria-label={`${straight.label} track shape`}>
        <path d={pathData} fill="none" stroke="rgba(245,247,246,0.2)" strokeWidth="22" strokeLinecap="round" strokeLinejoin="round" />
        <path d={pathData} fill="none" stroke="rgba(245,247,246,0.55)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="10 12" />
        <path d={direction.path} fill="none" stroke="#f5f7f6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
        <StraightMarker label="Start" point={startPoint} color="#63da97" />
        <StraightMarker label="End" point={endPoint} color="#e46645" />
        {hoverPoint ? (
          <g>
            <circle cx={hoverPoint.x} cy={hoverPoint.y} r="8" fill="#101312" stroke="#f5f7f6" strokeWidth="2.5" />
            <circle cx={hoverPoint.x} cy={hoverPoint.y} r="3" fill="#f5f7f6" />
          </g>
        ) : null}
      </svg>
      <div className="grid gap-1.5 md:content-center">
        <StraightLegend color="#63da97" label="Start" />
        <StraightLegend color="#e46645" label="End" />
      </div>
    </section>
  );
}

function StraightMarker({ label, point, color }: { label: string; point: SvgPoint; color: string }) {
  return (
    <g>
      <circle cx={point.x} cy={point.y} r="7" fill="#171717" stroke={color} strokeWidth="3" />
      <circle cx={point.x} cy={point.y} r="2.5" fill={color} />
      <text x={point.x} y={point.y - 13} textAnchor="middle" className="fill-[#9ba6a1] text-[9px] font-black uppercase tracking-wide">{label}</text>
    </g>
  );
}

function StraightLegend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <span className="h-1.5 w-4 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-[9px] font-black uppercase leading-none tracking-wide text-[#9ba6a1]">{label}</span>
    </div>
  );
}

function summarizeStraights(samples: Telemetry[], runLabelPrefix?: string): StraightSummary[] {
  const path = buildPathFromTelemetry(samples);
  if (path.length < MIN_STRAIGHT_SAMPLES) return [];

  const corners = buildCornerSegments(path);
  const cornerIndices = new Set<number>();
  for (const corner of corners) {
    for (let index = corner.startIndex; index < corner.endIndex; index += 1) {
      cornerIndices.add(index);
    }
  }

  const straightRuns: PathSample[][] = [];
  let currentRun: PathSample[] = [];

  for (let index = 0; index < path.length; index += 1) {
    if (cornerIndices.has(index)) {
      if (currentRun.length > 0) straightRuns.push(currentRun);
      currentRun = [];
    } else {
      currentRun.push(path[index]);
    }
  }

  if (currentRun.length > 0) straightRuns.push(currentRun);

  return straightRuns
    .filter((run) => run.length >= MIN_STRAIGHT_SAMPLES && pathDistanceMeters(run) >= MIN_STRAIGHT_DISTANCE_METERS)
    .map((run, index) => summarizeStraight(run, index, runLabelPrefix));
}

function summarizeStraight(samples: PathSample[], localId: number, runLabelPrefix?: string): StraightSummary {
  const telemetrySamples = samples.map((sample) => sample.telemetry).filter((sample): sample is Telemetry => Boolean(sample));
  const distanceMeters = pathDistanceMeters(samples);
  const first = samples[0];
  const last = samples[samples.length - 1];
  const durationSeconds = Math.max(0, ((last?.at ?? 0) - (first?.at ?? 0)) / 1000);
  const drivenSlipValues = telemetrySamples.map(drivenSlip);
  const shiftCount = countGearChanges(telemetrySamples);

  return {
    id: runLabelPrefix ? `${runLabelPrefix}-${localId}` : String(localId),
    label: `${runLabelPrefix ? `${runLabelPrefix} / ` : ""}Straight ${String(localId + 1).padStart(2, "0")}`,
    samples,
    pathPoints: normalizeStraightPath(samples),
    metrics: [
      { label: "Distance", value: `${formatValue(distanceMeters)} m`, detail: `${formatValue(durationSeconds, { precision: 1 })}s` },
      { label: "Peak speed", value: `${formatValue(maxOf(telemetrySamples, (sample) => sample.speedKmh))} km/h`, detail: `${formatValue(average(telemetrySamples.map((sample) => sample.speedKmh)))} km/h avg` },
      { label: "Max throttle", value: `${formatValue(maxOf(telemetrySamples, (sample) => sample.throttlePct))}%`, detail: "Highest accelerator input" },
      { label: "Max brake", value: `${formatValue(maxOf(telemetrySamples, (sample) => sample.brakePct))}%`, detail: "Highest brake input" },
      { label: "Peak driven slip", value: formatValue(Math.max(0, ...drivenSlipValues), { precision: 2 }), detail: "Driven-axle combined slip" },
      { label: "Shifts", value: formatValue(shiftCount), detail: "Gear changes in section" }
    ]
  };
}

function normalizeStraightPath(path: PathSample[]) {
  const width = 360;
  const height = 160;
  const paddingX = 32;
  const paddingY = 24;
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

function pointAtPathProgress(points: SvgPoint[], progress: number) {
  if (points.length === 0) return { x: 180, y: 80 };
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

function downsamplePathSamples(path: PathSample[], maxPoints: number) {
  if (path.length <= maxPoints) return path;

  const result: PathSample[] = [];
  const step = (path.length - 1) / (maxPoints - 1);
  for (let index = 0; index < maxPoints; index += 1) {
    result.push(path[Math.round(index * step)]);
  }
  return result;
}

function cumulativePointDistances(points: SvgPoint[]) {
  const distances = new Array<number>(points.length).fill(0);
  for (let index = 1; index < points.length; index += 1) {
    distances[index] = distances[index - 1] + Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y);
  }
  return distances;
}

function svgPathData(points: SvgPoint[]) {
  if (points.length === 0) return "";
  return points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
}

function countGearChanges(samples: Telemetry[]) {
  let count = 0;
  let previousGear: number | null = null;
  for (const sample of samples) {
    if (previousGear !== null && sample.Gear !== previousGear) count += 1;
    previousGear = sample.Gear;
  }
  return count;
}

function drivenSlip(sample: Telemetry) {
  if (sample.DrivetrainType === 0) return sample.frontSlip;
  if (sample.DrivetrainType === 1) return sample.rearSlip;
  return average([sample.frontSlip, sample.rearSlip]);
}

function frontSlipRatio(sample: Telemetry) {
  return average([
    Math.abs(sample.TireSlipRatioFrontLeft),
    Math.abs(sample.TireSlipRatioFrontRight)
  ]);
}

function rearSlipRatio(sample: Telemetry) {
  return average([
    Math.abs(sample.TireSlipRatioRearLeft),
    Math.abs(sample.TireSlipRatioRearRight)
  ]);
}

function maxOf(samples: Telemetry[], value: (sample: Telemetry) => number) {
  if (samples.length === 0) return 0;
  return Math.max(...samples.map(value).filter(Number.isFinite));
}

function percentLabel(value: number) {
  return `${formatValue(value)}%`;
}

function kmhLabel(value: number) {
  return `${formatValue(value)} km/h`;
}

function rpmLabel(value: number) {
  return `${formatValue(value)} rpm`;
}

function hpLabel(value: number) {
  return `${formatValue(value)} hp`;
}

function gLabel(value: number) {
  return `${formatValue(value, { precision: 2 })}g`;
}

function ratioLabel(value: number) {
  return formatValue(value, { precision: 2 });
}
