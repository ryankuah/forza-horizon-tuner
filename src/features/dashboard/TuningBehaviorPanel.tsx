import * as React from "react";
import type { CornerEffect, PathSample, RunTelemetrySet, SvgPoint, Telemetry } from "@/types/telemetry";
import { average, clampNumber, radiansToDegrees } from "@/lib/math";
import { formatValue } from "@/lib/format";
import { buildPathFromTelemetry } from "@/features/map/pathSamples";
import { buildCornerSegments, frontTireSlipAngle, rearTireSlipAngle } from "@/features/map/cornerAnalysis";
import {
  pathDistanceMeters,
  SectionTraceChart,
  type SectionMetric,
  type TraceSeries
} from "./TrackSectionGraphs";

type TuningPhaseId = "entry" | "mid" | "exit";

type CornerSummary = {
  id: string;
  label: string;
  effect: Exclude<CornerEffect, "straight">;
  samples: PathSample[];
  pathPoints: SvgPoint[];
  metrics: SectionMetric[];
};

const PERCENT_DOMAIN = [0, 100] as const;
const NORMALIZED_DOMAIN = [0, 1] as const;
const LATERAL_G_DOMAIN = [0, 2] as const;

const INPUT_SERIES: TraceSeries[] = [
  { label: "Steer", color: "#b68cff", value: (sample) => Math.abs(sample.steerPct), format: percentLabel, domain: PERCENT_DOMAIN },
  { label: "Throttle", color: "#63da97", value: (sample) => sample.throttlePct, format: percentLabel, domain: PERCENT_DOMAIN },
  { label: "Brake", color: "#f3d09b", value: (sample) => sample.brakePct, format: percentLabel, domain: PERCENT_DOMAIN }
];

const RESPONSE_SERIES: TraceSeries[] = [
  { label: "Speed", color: "#d7c7ad", value: (sample) => sample.speedKmh, format: kmhLabel, domain: "zero-max" },
  { label: "Lateral G", color: "#9be7bd", value: (sample) => Math.abs(sample.AccelerationX / 9.81), format: gLabel, domain: LATERAL_G_DOMAIN },
  { label: "Yaw rate", color: "#59a7ff", value: (sample) => Math.abs(radiansToDegrees(sample.AngularVelocityY)), format: degSecLabel, domain: "zero-max" }
];

const SLIP_ANGLE_SERIES: TraceSeries[] = [
  { label: "Front slip angle", color: "#59a7ff", value: frontTireSlipAngle },
  { label: "Rear slip angle", color: "#e46645", value: rearTireSlipAngle }
];

const COMBINED_SLIP_SERIES: TraceSeries[] = [
  { label: "Front slip", color: "#86b7ff", value: (sample) => sample.frontSlip },
  { label: "Rear slip", color: "#ff8a6d", value: (sample) => sample.rearSlip }
];

const ROLL_SERIES: TraceSeries[] = [
  { label: "Left side", color: "#59a7ff", value: leftCompression, format: ratioLabel, domain: NORMALIZED_DOMAIN },
  { label: "Right side", color: "#e46645", value: rightCompression, format: ratioLabel, domain: NORMALIZED_DOMAIN }
];

const FRONT_SUSPENSION_TRAVEL_SERIES: TraceSeries[] = [
  { label: "FL travel", color: "#59a7ff", value: (sample) => sample.NormalizedSuspensionTravelFrontLeft, format: ratioLabel, domain: NORMALIZED_DOMAIN },
  { label: "FR travel", color: "#a9ccff", value: (sample) => sample.NormalizedSuspensionTravelFrontRight, format: ratioLabel, domain: NORMALIZED_DOMAIN }
];

const REAR_SUSPENSION_TRAVEL_SERIES: TraceSeries[] = [
  { label: "RL travel", color: "#ffb86c", value: (sample) => sample.NormalizedSuspensionTravelRearLeft, format: ratioLabel, domain: NORMALIZED_DOMAIN },
  { label: "RR travel", color: "#e46645", value: (sample) => sample.NormalizedSuspensionTravelRearRight, format: ratioLabel, domain: NORMALIZED_DOMAIN }
];

const AXLE_SPLIT_SERIES: TraceSeries[] = [
  { label: "Front R-L", color: "#86b7ff", value: frontRightMinusLeftTravel, format: signedRatioLabel, domain: "symmetric-zero" },
  { label: "Rear R-L", color: "#ff8a6d", value: rearRightMinusLeftTravel, format: signedRatioLabel, domain: "symmetric-zero" }
];

export function CornerPanel({ samples, sampleSets }: { samples: Telemetry[]; sampleSets?: RunTelemetrySet[] }) {
  const corners = React.useMemo(
    () => sampleSets?.length
      ? sampleSets.flatMap((set) => summarizeCorners(set.samples, set.label))
      : summarizeCorners(samples),
    [sampleSets, samples]
  );

  return (
    <div className="h-full min-h-0 min-w-0 overflow-auto">
      {corners.length === 0 ? (
        <div className="border-b border-white/[0.08] py-4 text-sm leading-5 text-[#b5bfb9]">
          No cornering sections detected yet.
        </div>
      ) : (
        <div className="grid min-h-0 gap-8">
          {corners.map((corner) => (
            <CornerCard key={corner.id} corner={corner} />
          ))}
        </div>
      )}
    </div>
  );
}

export function BehaviorPanel(props: { samples: Telemetry[] }) {
  return <CornerPanel {...props} />;
}

function CornerCard({ corner }: { corner: CornerSummary }) {
  const [hoverProgress, setHoverProgress] = React.useState<number | null>(null);
  const frontSlipAngleSeries = React.useMemo(() => frontSlipAngleUsageSeries(corner.effect), [corner.effect]);
  const rearSlipAngleSeries = React.useMemo(() => rearSlipAngleUsageSeries(corner.effect), [corner.effect]);
  const frontCombinedSlipSeries = React.useMemo(() => frontCombinedSlipUsageSeries(corner.effect), [corner.effect]);
  const rearCombinedSlipSeries = React.useMemo(() => rearCombinedSlipUsageSeries(corner.effect), [corner.effect]);

  return (
    <section className="grid min-w-0 content-start gap-3 pb-8 last:pb-0">
      <div className="grid gap-2">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${corner.effect === "leftCorner" ? "bg-[#63da97]" : "bg-[#e46645]"}`} />
            <strong className="text-base leading-tight text-[#f5f7f6]">{corner.label}</strong>
            <CornerMetricStrip metrics={corner.metrics} />
          </div>
        </div>
      </div>

      <div className="grid gap-2">
        <CornerOverviewGraphic corner={corner} hoverProgress={hoverProgress} />
        <CornerGraphGroup title="Inputs / response">
          <SectionTraceChart title="Inputs" samples={corner.samples} series={INPUT_SERIES} scale="shared" domain={PERCENT_DOMAIN} showPhases hoverProgress={hoverProgress} onHoverProgress={setHoverProgress} />
          <SectionTraceChart title="Vehicle response" samples={corner.samples} series={RESPONSE_SERIES} showPhases hoverProgress={hoverProgress} onHoverProgress={setHoverProgress} />
        </CornerGraphGroup>
        <CornerGraphGroup title="Axle balance">
          <SectionTraceChart title="Axle slip angle" samples={corner.samples} series={SLIP_ANGLE_SERIES} scale="shared" domain="zero-max" showPhases hoverProgress={hoverProgress} onHoverProgress={setHoverProgress} />
          <SectionTraceChart title="Axle combined slip" samples={corner.samples} series={COMBINED_SLIP_SERIES} scale="shared" domain="zero-max" showPhases hoverProgress={hoverProgress} onHoverProgress={setHoverProgress} />
        </CornerGraphGroup>
        <CornerGraphGroup title="Tire usage">
          <SectionTraceChart title="Front slip angle" samples={corner.samples} series={frontSlipAngleSeries} scale="shared" domain="zero-max" showPhases hoverProgress={hoverProgress} onHoverProgress={setHoverProgress} />
          <SectionTraceChart title="Rear slip angle" samples={corner.samples} series={rearSlipAngleSeries} scale="shared" domain="zero-max" showPhases hoverProgress={hoverProgress} onHoverProgress={setHoverProgress} />
          <SectionTraceChart title="Front combined slip" samples={corner.samples} series={frontCombinedSlipSeries} scale="shared" domain="zero-max" showPhases hoverProgress={hoverProgress} onHoverProgress={setHoverProgress} />
          <SectionTraceChart title="Rear combined slip" samples={corner.samples} series={rearCombinedSlipSeries} scale="shared" domain="zero-max" showPhases hoverProgress={hoverProgress} onHoverProgress={setHoverProgress} />
        </CornerGraphGroup>
        <CornerGraphGroup title="Platform / roll">
          <SectionTraceChart title="Front suspension travel" samples={corner.samples} series={FRONT_SUSPENSION_TRAVEL_SERIES} scale="shared" domain={NORMALIZED_DOMAIN} showPhases hoverProgress={hoverProgress} onHoverProgress={setHoverProgress} />
          <SectionTraceChart title="Rear suspension travel" samples={corner.samples} series={REAR_SUSPENSION_TRAVEL_SERIES} scale="shared" domain={NORMALIZED_DOMAIN} showPhases hoverProgress={hoverProgress} onHoverProgress={setHoverProgress} />
          <SectionTraceChart title="Side compression" samples={corner.samples} series={ROLL_SERIES} scale="shared" domain={NORMALIZED_DOMAIN} showPhases hoverProgress={hoverProgress} onHoverProgress={setHoverProgress} />
          <SectionTraceChart title="Axle side split" samples={corner.samples} series={AXLE_SPLIT_SERIES} scale="shared" domain="symmetric-zero" showPhases hoverProgress={hoverProgress} onHoverProgress={setHoverProgress} />
        </CornerGraphGroup>
      </div>
    </section>
  );
}

function CornerGraphGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid min-w-0 gap-2">
      <h3 className="text-[10px] font-black uppercase tracking-[0.16em] text-[#8e9994]">{title}</h3>
      <div className="grid gap-2 xl:grid-cols-2 2xl:grid-cols-3">
        {children}
      </div>
    </section>
  );
}

function CornerMetricStrip({ metrics }: { metrics: SectionMetric[] }) {
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

function CornerOverviewGraphic({ corner, hoverProgress }: { corner: CornerSummary; hoverProgress: number | null }) {
  const pathData = svgPathData(corner.pathPoints);
  const phaseSegments = buildCornerGraphicPhaseSegments(corner.pathPoints);
  const entryPoint = corner.pathPoints[0] ?? { x: 54, y: 120 };
  const midPoint = pointAtPathProgress(corner.pathPoints, 0.5);
  const exitPoint = corner.pathPoints[corner.pathPoints.length - 1] ?? { x: 306, y: 120 };
  const direction = directionIndicator(corner.pathPoints);
  const hoverPoint = hoverProgress === null ? null : pointAtPathProgress(corner.pathPoints, hoverProgress);

  return (
    <section className="grid min-w-0 gap-2 py-1 md:grid-cols-[minmax(0,1fr)_7rem] md:items-center">
      <svg className="h-[150px] w-full overflow-visible" viewBox="0 0 360 160" role="img" aria-label={`${corner.label} track shape`}>
        <path d={pathData} fill="none" stroke="rgba(245,247,246,0.2)" strokeWidth="22" strokeLinecap="round" strokeLinejoin="round" />
        <path d={pathData} fill="none" stroke="rgba(245,247,246,0.55)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="10 12" />
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
        <PhaseMarker id="entry" point={entryPoint} />
        <PhaseMarker id="mid" point={midPoint} />
        <PhaseMarker id="exit" point={exitPoint} />
        {hoverPoint ? (
          <g>
            <circle cx={hoverPoint.x} cy={hoverPoint.y} r="8" fill="#101312" stroke="#f5f7f6" strokeWidth="2.5" />
            <circle cx={hoverPoint.x} cy={hoverPoint.y} r="3" fill="#f5f7f6" />
          </g>
        ) : null}
      </svg>
      <div className="grid gap-1.5 md:content-center">
        {(["entry", "mid", "exit"] as TuningPhaseId[]).map((phase) => (
          <div key={phase} className="flex min-w-0 items-center gap-1.5">
            <span className="h-1.5 w-4 shrink-0 rounded-full" style={{ backgroundColor: phaseColor(phase) }} />
            <span className="text-[9px] font-black uppercase leading-none tracking-wide text-[#9ba6a1]">{phaseLabel(phase)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function PhaseMarker({ id, point }: { id: TuningPhaseId; point: SvgPoint }) {
  return (
    <g>
      <circle cx={point.x} cy={point.y} r="7" fill="#171717" stroke={phaseColor(id)} strokeWidth="3" />
      <circle cx={point.x} cy={point.y} r="2.5" fill={phaseColor(id)} />
    </g>
  );
}

function summarizeCorners(samples: Telemetry[], runLabelPrefix?: string): CornerSummary[] {
  const path = buildPathFromTelemetry(samples);
  const corners = buildCornerSegments(path);

  return corners
    .map((corner) => summarizeCorner(
      runLabelPrefix ? `${runLabelPrefix}-${corner.id}` : String(corner.id),
      corner.id,
      corner.effect,
      corner.samples,
      runLabelPrefix
    ))
    .filter((corner): corner is CornerSummary => Boolean(corner));
}

function summarizeCorner(
  id: string,
  localId: number,
  effect: Exclude<CornerEffect, "straight">,
  samples: PathSample[],
  runLabelPrefix?: string
): CornerSummary | null {
  if (samples.length < 3) return null;
  const distanceMeters = pathDistanceMeters(samples);
  if (distanceMeters <= 0) return null;
  const telemetrySamples = samples.map((sample) => sample.telemetry).filter((sample): sample is Telemetry => Boolean(sample));
  if (telemetrySamples.length === 0) return null;

  const lateralGs = telemetrySamples.map((sample) => Math.abs(sample.AccelerationX / 9.81));
  const leftCompressionValues = telemetrySamples.map(leftCompression);
  const rightCompressionValues = telemetrySamples.map(rightCompression);
  const frontRollValues = telemetrySamples.map(frontRoll);
  const rearRollValues = telemetrySamples.map(rearRoll);
  const frontCombinedSlip = telemetrySamples.map((sample) => sample.frontSlip);
  const rearCombinedSlip = telemetrySamples.map((sample) => sample.rearSlip);
  const outsideFrontSlipAngle = telemetrySamples.map((sample) => outsideFrontAngle(effect, sample));
  const insideFrontSlipAngle = telemetrySamples.map((sample) => insideFrontAngle(effect, sample));
  const outsideRearSlipAngle = telemetrySamples.map((sample) => outsideRearAngle(effect, sample));
  const insideRearSlipAngle = telemetrySamples.map((sample) => insideRearAngle(effect, sample));
  const slipBalance = average(telemetrySamples.map((sample) => sample.frontSlip - sample.rearSlip));
  const sideCompressionBalance = average(rightCompressionValues.map((value, index) => value - (leftCompressionValues[index] ?? 0)));
  const axleSplitBalance = average(frontRollValues.map((value, index) => value - (rearRollValues[index] ?? 0)));
  const frontAngleSideDelta = average(outsideFrontSlipAngle.map((value, index) => value - (insideFrontSlipAngle[index] ?? 0)));
  const rearAngleSideDelta = average(outsideRearSlipAngle.map((value, index) => value - (insideRearSlipAngle[index] ?? 0)));

  return {
    id,
    label: `${runLabelPrefix ? `${runLabelPrefix} / ` : ""}Corner ${String(localId + 1).padStart(2, "0")} · ${effect === "leftCorner" ? "Left" : "Right"}`,
    effect,
    samples,
    pathPoints: normalizeCornerPath(samples),
    metrics: [
      { label: "Distance", value: `${formatValue(distanceMeters)} m`, detail: `${formatValue(average(telemetrySamples.map((sample) => sample.speedKmh)))} km/h avg` },
      { label: "Lateral G", value: `${formatValue(average(lateralGs), { precision: 2 })}g`, detail: `${formatValue(Math.max(...lateralGs), { precision: 2 })}g peak` },
      { label: "Slip balance", value: signedValue(slipBalance), detail: "Front combined slip minus rear" },
      { label: "Front O/I angle", value: signedValue(frontAngleSideDelta), detail: "Outside front minus inside front" },
      { label: "Rear O/I angle", value: signedValue(rearAngleSideDelta), detail: "Outside rear minus inside rear" },
      { label: "Side comp", value: signedValue(sideCompressionBalance), detail: "Right side minus left" },
      { label: "Axle split", value: signedValue(axleSplitBalance), detail: "Front L/R split minus rear" },
      { label: "Peak front slip", value: formatValue(Math.max(...frontCombinedSlip), { precision: 2 }), detail: "Combined slip" },
      { label: "Peak rear slip", value: formatValue(Math.max(...rearCombinedSlip), { precision: 2 }), detail: "Combined slip" }
    ]
  };
}

function normalizeCornerPath(path: PathSample[]) {
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

function buildCornerGraphicPhaseSegments(points: SvgPoint[]): { id: TuningPhaseId; points: SvgPoint[] }[] {
  const segments: { id: TuningPhaseId; points: SvgPoint[] }[] = [];
  if (points.length < 2) return segments;

  const distances = cumulativePointDistances(points);
  const totalDistance = distances[distances.length - 1] ?? 0;
  if (totalDistance <= 0) return [{ id: "mid", points }];

  for (let index = 1; index < points.length; index += 1) {
    const phaseId = phaseAtProgress((distances[index] ?? 0) / totalDistance);
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

function phaseAtProgress(progress: number): TuningPhaseId {
  if (progress < 0.34) return "entry";
  if (progress < 0.67) return "mid";
  return "exit";
}

function phaseColor(phase: TuningPhaseId) {
  if (phase === "entry") return "#e46645";
  if (phase === "mid") return "#59a7ff";
  return "#63da97";
}

function phaseLabel(phase: TuningPhaseId) {
  if (phase === "entry") return "Entry";
  if (phase === "mid") return "Mid";
  return "Exit";
}

function frontRoll(sample: Telemetry) {
  return Math.abs(sample.NormalizedSuspensionTravelFrontLeft - sample.NormalizedSuspensionTravelFrontRight);
}

function rearRoll(sample: Telemetry) {
  return Math.abs(sample.NormalizedSuspensionTravelRearLeft - sample.NormalizedSuspensionTravelRearRight);
}

function frontRightMinusLeftTravel(sample: Telemetry) {
  return sample.NormalizedSuspensionTravelFrontRight - sample.NormalizedSuspensionTravelFrontLeft;
}

function rearRightMinusLeftTravel(sample: Telemetry) {
  return sample.NormalizedSuspensionTravelRearRight - sample.NormalizedSuspensionTravelRearLeft;
}

function leftCompression(sample: Telemetry) {
  return average([
    sample.NormalizedSuspensionTravelFrontLeft,
    sample.NormalizedSuspensionTravelRearLeft
  ]);
}

function rightCompression(sample: Telemetry) {
  return average([
    sample.NormalizedSuspensionTravelFrontRight,
    sample.NormalizedSuspensionTravelRearRight
  ]);
}

function frontSlipAngleUsageSeries(effect: Exclude<CornerEffect, "straight">): TraceSeries[] {
  return [
    { label: outsideLabel(effect, "front"), color: "#59a7ff", value: (sample) => outsideFrontAngle(effect, sample), format: ratioLabel },
    { label: insideLabel(effect, "front"), color: "#a9ccff", value: (sample) => insideFrontAngle(effect, sample), format: ratioLabel }
  ];
}

function rearSlipAngleUsageSeries(effect: Exclude<CornerEffect, "straight">): TraceSeries[] {
  return [
    { label: outsideLabel(effect, "rear"), color: "#e46645", value: (sample) => outsideRearAngle(effect, sample), format: ratioLabel },
    { label: insideLabel(effect, "rear"), color: "#ffb09d", value: (sample) => insideRearAngle(effect, sample), format: ratioLabel }
  ];
}

function frontCombinedSlipUsageSeries(effect: Exclude<CornerEffect, "straight">): TraceSeries[] {
  return [
    { label: outsideLabel(effect, "front"), color: "#59a7ff", value: (sample) => outsideFrontCombinedSlip(effect, sample), format: ratioLabel },
    { label: insideLabel(effect, "front"), color: "#a9ccff", value: (sample) => insideFrontCombinedSlip(effect, sample), format: ratioLabel }
  ];
}

function rearCombinedSlipUsageSeries(effect: Exclude<CornerEffect, "straight">): TraceSeries[] {
  return [
    { label: outsideLabel(effect, "rear"), color: "#e46645", value: (sample) => outsideRearCombinedSlip(effect, sample), format: ratioLabel },
    { label: insideLabel(effect, "rear"), color: "#ffb09d", value: (sample) => insideRearCombinedSlip(effect, sample), format: ratioLabel }
  ];
}

function outsideFrontAngle(effect: Exclude<CornerEffect, "straight">, sample: Telemetry) {
  return Math.abs(effect === "leftCorner" ? sample.TireSlipAngleFrontRight : sample.TireSlipAngleFrontLeft);
}

function insideFrontAngle(effect: Exclude<CornerEffect, "straight">, sample: Telemetry) {
  return Math.abs(effect === "leftCorner" ? sample.TireSlipAngleFrontLeft : sample.TireSlipAngleFrontRight);
}

function outsideRearAngle(effect: Exclude<CornerEffect, "straight">, sample: Telemetry) {
  return Math.abs(effect === "leftCorner" ? sample.TireSlipAngleRearRight : sample.TireSlipAngleRearLeft);
}

function insideRearAngle(effect: Exclude<CornerEffect, "straight">, sample: Telemetry) {
  return Math.abs(effect === "leftCorner" ? sample.TireSlipAngleRearLeft : sample.TireSlipAngleRearRight);
}

function outsideFrontCombinedSlip(effect: Exclude<CornerEffect, "straight">, sample: Telemetry) {
  return Math.abs(effect === "leftCorner" ? sample.TireCombinedSlipFrontRight : sample.TireCombinedSlipFrontLeft);
}

function insideFrontCombinedSlip(effect: Exclude<CornerEffect, "straight">, sample: Telemetry) {
  return Math.abs(effect === "leftCorner" ? sample.TireCombinedSlipFrontLeft : sample.TireCombinedSlipFrontRight);
}

function outsideRearCombinedSlip(effect: Exclude<CornerEffect, "straight">, sample: Telemetry) {
  return Math.abs(effect === "leftCorner" ? sample.TireCombinedSlipRearRight : sample.TireCombinedSlipRearLeft);
}

function insideRearCombinedSlip(effect: Exclude<CornerEffect, "straight">, sample: Telemetry) {
  return Math.abs(effect === "leftCorner" ? sample.TireCombinedSlipRearLeft : sample.TireCombinedSlipRearRight);
}

function outsideLabel(effect: Exclude<CornerEffect, "straight">, axle: "front" | "rear") {
  const side = effect === "leftCorner" ? "R" : "L";
  return `Outside ${side}${axle === "front" ? "F" : "R"}`;
}

function insideLabel(effect: Exclude<CornerEffect, "straight">, axle: "front" | "rear") {
  const side = effect === "leftCorner" ? "L" : "R";
  return `Inside ${side}${axle === "front" ? "F" : "R"}`;
}

function percentLabel(value: number) {
  return `${formatValue(value)}%`;
}

function kmhLabel(value: number) {
  return `${formatValue(value)} km/h`;
}

function gLabel(value: number) {
  return `${formatValue(value, { precision: 2 })}g`;
}

function degSecLabel(value: number) {
  return `${formatValue(value, { precision: 0 })} deg/s`;
}

function ratioLabel(value: number) {
  return formatValue(value, { precision: 2 });
}

function signedRatioLabel(value: number) {
  return signedValue(value);
}

function signedValue(value: number) {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatValue(value, { precision: 2 })}`;
}
