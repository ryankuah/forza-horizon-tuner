import * as React from "react";
import { BarChart3 } from "lucide-react";
import type { Telemetry } from "@/types/telemetry";
import { average, clampNumber } from "@/lib/math";
import { formatValue } from "@/lib/format";
import { frontTireSlipAngle, rearTireSlipAngle } from "@/features/map/cornerAnalysis";
import { DataCell, TelemetryGroup, metricToneClass } from "./TelemetryPanelPrimitives";

type TuningPhaseId = "entry" | "mid" | "exit";
type BalanceTendency = "understeer" | "oversteer" | "neutral" | "unknown";

type TuningPhaseDefinition = {
  id: TuningPhaseId;
  label: string;
  color: string;
};

type TuningPhaseBucket = {
  milliseconds: number;
  samples: number;
  speedKmhMs: number;
  frontAngleMs: number;
  rearAngleMs: number;
  frontSlipMs: number;
  rearSlipMs: number;
  frontTempMs: number;
  rearTempMs: number;
  frontCompressionMs: number;
  rearCompressionMs: number;
  throttleMs: number;
  brakeMs: number;
  lateralGMs: number;
  balanceScoreMs: number;
  understeerMs: number;
  oversteerMs: number;
  neutralMs: number;
};

type TuningPhaseSummary = TuningPhaseDefinition & {
  milliseconds: number;
  samples: number;
  percent: number;
  avgSpeedKmh: number;
  frontAngle: number;
  rearAngle: number;
  frontSlip: number;
  rearSlip: number;
  frontTemp: number;
  rearTemp: number;
  frontCompression: number;
  rearCompression: number;
  throttlePct: number;
  brakePct: number;
  lateralG: number;
  balanceScore: number;
  tendency: BalanceTendency;
  understeerPercent: number;
  oversteerPercent: number;
  neutralPercent: number;
};

type TuningBehaviorSummary = {
  phases: TuningPhaseSummary[];
  totalMilliseconds: number;
  totalDistanceMeters: number;
  sampleCount: number;
  avgSpeedKmh: number;
};

const TUNING_PHASES: TuningPhaseDefinition[] = [
  { id: "entry", label: "Braking / corner entry", color: "#e46645" },
  { id: "mid", label: "Turning / mid-corner", color: "#59a7ff" },
  { id: "exit", label: "Exit / throttle application", color: "#63da97" }
];

export function BehaviorPanel({ samples }: { samples: Telemetry[] }) {
  const summary = React.useMemo(() => summarizeTuningBehavior(samples), [samples]);

  return (
    <div className="grid h-full min-h-0 min-w-0">
      <TelemetryGroup title="Tuning balance" icon={<BarChart3 size={18} />} className="min-h-0">
        {summary.sampleCount < 2 ? (
          <div className="text-sm leading-5 text-[#b5bfb9]">
            No cornering samples yet.
          </div>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-x-5 gap-y-2 md:grid-cols-4">
              <DataCell label="Corner samples" value={summary.sampleCount} />
              <DataCell label="Analyzed time" value={formatBehaviorDuration(summary.totalMilliseconds)} />
              <DataCell label="Distance" value={summary.totalDistanceMeters} suffix=" m" precision={0} />
              <DataCell label="Avg speed" value={summary.avgSpeedKmh} suffix=" km/h" precision={0} />
            </dl>
            <div className="grid min-h-0 grid-cols-1 gap-3 xl:grid-cols-3">
              {summary.phases.map((phase) => (
                <TuningPhaseCard key={phase.id} phase={phase} />
              ))}
            </div>
          </>
        )}
      </TelemetryGroup>
    </div>
  );
}

function TuningPhaseCard({ phase }: { phase: TuningPhaseSummary }) {
  const tendency = tendencyCopy(phase.tendency);

  return (
    <section className="grid min-w-0 gap-3 border-t border-white/[0.08] pt-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: phase.color }} />
          <strong className="truncate text-sm leading-tight text-[#f5f7f6]">{phase.label}</strong>
        </div>
        <div className="text-right">
          <strong className={`block text-sm tabular-nums ${metricToneClass(tendency.tone)}`}>{tendency.label}</strong>
          <span className="text-xs tabular-nums text-[#9ba6a1]">Score {formatSignedValue(phase.balanceScore, 2)}</span>
        </div>
      </div>

      <BalanceMeter score={phase.balanceScore} />

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        <TuningMetric label="Front angle" value={phase.frontAngle} precision={2} tone={phase.tendency === "understeer" ? "warn" : "default"} />
        <TuningMetric label="Rear angle" value={phase.rearAngle} precision={2} tone={phase.tendency === "oversteer" ? "warn" : "default"} />
        <TuningMetric label="Front slip" value={phase.frontSlip} precision={2} tone={phase.tendency === "understeer" ? "warn" : "default"} />
        <TuningMetric label="Rear slip" value={phase.rearSlip} precision={2} tone={phase.tendency === "oversteer" ? "warn" : "default"} />
        <TuningMetric label="Front temp" value={phase.frontTemp} suffix="°C" precision={0} />
        <TuningMetric label="Rear temp" value={phase.rearTemp} suffix="°C" precision={0} />
        <TuningMetric label="Front comp" value={phase.frontCompression} suffix="%" precision={0} />
        <TuningMetric label="Rear comp" value={phase.rearCompression} suffix="%" precision={0} />
        <TuningMetric label="Throttle" value={phase.throttlePct} suffix="%" precision={0} />
        <TuningMetric label="Brake" value={phase.brakePct} suffix="%" precision={0} />
        <TuningMetric label="Lat G" value={phase.lateralG} precision={2} />
        <TuningMetric label="Time" value={phase.percent} suffix="%" precision={1} />
      </dl>

      <div className="grid grid-cols-3 gap-2">
        <BalanceShare label="Under" value={phase.understeerPercent} color="#f3d09b" />
        <BalanceShare label="Neutral" value={phase.neutralPercent} color="#9ba6a1" />
        <BalanceShare label="Over" value={phase.oversteerPercent} color="#e46645" />
      </div>
    </section>
  );
}

function TuningMetric({
  label,
  value,
  suffix = "",
  precision,
  tone = "default"
}: {
  label: string;
  value: number;
  suffix?: string;
  precision: number;
  tone?: "default" | "ok" | "warn" | "alert";
}) {
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2 border-b border-white/[0.06] py-1">
      <dt className="truncate text-[9px] font-black uppercase leading-none tracking-wide text-[#9ba6a1]">{label}</dt>
      <dd className={`text-right text-xs font-black leading-tight tabular-nums ${metricToneClass(tone)}`}>
        {formatValue(value, { precision })}{suffix}
      </dd>
    </div>
  );
}

function BalanceMeter({ score }: { score: number }) {
  const marker = clampNumber(50 + score * 35, 0, 100);

  return (
    <div className="grid gap-1.5">
      <div className="relative h-3 rounded-full border border-white/10 bg-[#101312]">
        <div className="absolute inset-y-0 left-0 w-1/2 rounded-l-full bg-[#f3d09b]/25" />
        <div className="absolute inset-y-0 right-0 w-1/2 rounded-r-full bg-[#e46645]/25" />
        <div className="absolute left-1/2 top-0 h-full w-px bg-white/25" />
        <div className="absolute top-1/2 h-5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#f5f7f6]" style={{ left: `${marker}%` }} />
      </div>
      <div className="grid grid-cols-3 text-[9px] font-black uppercase leading-none text-[#9ba6a1]">
        <span>Understeer</span>
        <span className="text-center">Neutral</span>
        <span className="text-right">Oversteer</span>
      </div>
    </div>
  );
}

function BalanceShare({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="grid gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[9px] font-black uppercase leading-none tracking-wide text-[#9ba6a1]">{label}</span>
        <span className="text-[10px] font-black leading-none tabular-nums text-[#f5f7f6]">{formatValue(value, { precision: 0 })}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full" style={{ width: `${clampNumber(value, 0, 100)}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function summarizeTuningBehavior(samples: Telemetry[]): TuningBehaviorSummary {
  const buckets = new Map<TuningPhaseId, TuningPhaseBucket>();

  for (const phase of TUNING_PHASES) {
    buckets.set(phase.id, emptyTuningPhaseBucket());
  }

  let totalMilliseconds = 0;
  let totalDistanceMeters = 0;
  let speedKmhMs = 0;
  let sampleCount = 0;

  for (let index = 0; index < samples.length - 1; index += 1) {
    const sample = samples[index];
    if (sample.IsRaceOn !== 1) continue;

    const phase = classifyTuningPhase(sample);
    if (!phase) continue;

    const milliseconds = behaviorSampleDeltaMs(samples, index);
    if (milliseconds <= 0) continue;

    const bucket = buckets.get(phase);
    if (!bucket) continue;

    const frontAngle = frontTireSlipAngle(sample);
    const rearAngle = rearTireSlipAngle(sample);
    const frontSlip = average([Math.abs(sample.TireCombinedSlipFrontLeft), Math.abs(sample.TireCombinedSlipFrontRight)]);
    const rearSlip = average([Math.abs(sample.TireCombinedSlipRearLeft), Math.abs(sample.TireCombinedSlipRearRight)]);
    const balance = balanceScore(frontAngle, rearAngle, frontSlip, rearSlip);
    const tendency = sampleTendency(balance);
    const distanceMeters = Math.max(0, sample.Speed) * (milliseconds / 1000);
    const lateralG = Math.abs(sample.AccelerationX / 9.81);

    bucket.milliseconds += milliseconds;
    bucket.samples += 1;
    bucket.speedKmhMs += sample.speedKmh * milliseconds;
    bucket.frontAngleMs += frontAngle * milliseconds;
    bucket.rearAngleMs += rearAngle * milliseconds;
    bucket.frontSlipMs += frontSlip * milliseconds;
    bucket.rearSlipMs += rearSlip * milliseconds;
    bucket.frontTempMs += sample.frontTemp * milliseconds;
    bucket.rearTempMs += sample.rearTemp * milliseconds;
    bucket.frontCompressionMs += sample.suspensionAvgFront * 100 * milliseconds;
    bucket.rearCompressionMs += sample.suspensionAvgRear * 100 * milliseconds;
    bucket.throttleMs += sample.throttlePct * milliseconds;
    bucket.brakeMs += sample.brakePct * milliseconds;
    bucket.lateralGMs += lateralG * milliseconds;
    bucket.balanceScoreMs += balance * milliseconds;
    bucket.understeerMs += tendency === "understeer" ? milliseconds : 0;
    bucket.oversteerMs += tendency === "oversteer" ? milliseconds : 0;
    bucket.neutralMs += tendency === "neutral" ? milliseconds : 0;

    totalMilliseconds += milliseconds;
    totalDistanceMeters += distanceMeters;
    speedKmhMs += sample.speedKmh * milliseconds;
    sampleCount += 1;
  }

  return {
    phases: TUNING_PHASES.map((definition) => tuningPhaseSummary(definition, buckets.get(definition.id), totalMilliseconds)),
    totalMilliseconds,
    totalDistanceMeters,
    sampleCount,
    avgSpeedKmh: weightedAverage(speedKmhMs, totalMilliseconds)
  };
}

function emptyTuningPhaseBucket(): TuningPhaseBucket {
  return {
    milliseconds: 0,
    samples: 0,
    speedKmhMs: 0,
    frontAngleMs: 0,
    rearAngleMs: 0,
    frontSlipMs: 0,
    rearSlipMs: 0,
    frontTempMs: 0,
    rearTempMs: 0,
    frontCompressionMs: 0,
    rearCompressionMs: 0,
    throttleMs: 0,
    brakeMs: 0,
    lateralGMs: 0,
    balanceScoreMs: 0,
    understeerMs: 0,
    oversteerMs: 0,
    neutralMs: 0
  };
}

function tuningPhaseSummary(definition: TuningPhaseDefinition, bucket: TuningPhaseBucket | undefined, totalMilliseconds: number): TuningPhaseSummary {
  const milliseconds = bucket?.milliseconds ?? 0;
  const balance = weightedAverage(bucket?.balanceScoreMs ?? 0, milliseconds);
  const understeerPercent = percentOf(bucket?.understeerMs ?? 0, milliseconds);
  const oversteerPercent = percentOf(bucket?.oversteerMs ?? 0, milliseconds);
  const neutralPercent = percentOf(bucket?.neutralMs ?? 0, milliseconds);
  const tendency = phaseTendency(balance, understeerPercent, oversteerPercent, milliseconds);

  return {
    ...definition,
    milliseconds,
    samples: bucket?.samples ?? 0,
    percent: percentOf(milliseconds, totalMilliseconds),
    avgSpeedKmh: weightedAverage(bucket?.speedKmhMs ?? 0, milliseconds),
    frontAngle: weightedAverage(bucket?.frontAngleMs ?? 0, milliseconds),
    rearAngle: weightedAverage(bucket?.rearAngleMs ?? 0, milliseconds),
    frontSlip: weightedAverage(bucket?.frontSlipMs ?? 0, milliseconds),
    rearSlip: weightedAverage(bucket?.rearSlipMs ?? 0, milliseconds),
    frontTemp: weightedAverage(bucket?.frontTempMs ?? 0, milliseconds),
    rearTemp: weightedAverage(bucket?.rearTempMs ?? 0, milliseconds),
    frontCompression: weightedAverage(bucket?.frontCompressionMs ?? 0, milliseconds),
    rearCompression: weightedAverage(bucket?.rearCompressionMs ?? 0, milliseconds),
    throttlePct: weightedAverage(bucket?.throttleMs ?? 0, milliseconds),
    brakePct: weightedAverage(bucket?.brakeMs ?? 0, milliseconds),
    lateralG: weightedAverage(bucket?.lateralGMs ?? 0, milliseconds),
    balanceScore: balance,
    tendency,
    understeerPercent,
    oversteerPercent,
    neutralPercent
  };
}

function classifyTuningPhase(sample: Telemetry): TuningPhaseId | null {
  const steerPct = Math.abs(sample.steerPct);
  const lateralG = Math.abs(sample.AccelerationX / 9.81);
  const isTurning = steerPct >= 12 || lateralG >= 0.22;
  if (!isTurning) return null;

  if (sample.brakePct > 8) return "entry";
  if (sample.throttlePct >= 25) return "exit";
  return "mid";
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

function behaviorSampleDeltaMs(samples: Telemetry[], index: number) {
  const sample = samples[index];
  const next = samples[index + 1];
  if (!sample || !next) return 0;

  const receivedDelta = sample.receivedAt !== undefined && next.receivedAt !== undefined
    ? next.receivedAt - sample.receivedAt
    : NaN;
  const timestampDelta = next.TimestampMS - sample.TimestampMS;
  const delta = Number.isFinite(receivedDelta) && receivedDelta > 0
    ? receivedDelta
    : timestampDelta;

  if (!Number.isFinite(delta) || delta <= 0) return 16;
  return clampNumber(delta, 1, 250);
}

function weightedAverage(weightedTotal: number, milliseconds: number) {
  return milliseconds > 0 ? weightedTotal / milliseconds : 0;
}

function formatBehaviorDuration(milliseconds: number) {
  const totalSeconds = Math.round(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatSignedValue(value: number, precision: number) {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatValue(value, { precision })}`;
}
