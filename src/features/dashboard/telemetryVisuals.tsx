import * as React from "react";
import { Activity, BarChart3, Clock3, Gauge } from "lucide-react";
import type { AppState, DocTelemetrySection, Telemetry, TelemetryValue, TireMfdTire, RightPanelTab } from "@/types/telemetry";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { average, clampNumber, radiansToDegrees } from "@/lib/math";
import { compressionTone, formatGear, formatValue, shortSessionId, slipAmountTone, temperatureSplitLabel, temperatureTone, tuningStatusLabel } from "@/lib/format";
import { docTelemetrySections } from "./telemetryFields";
import { frontTireSlipAngle, rearTireSlipAngle } from "@/features/map/cornerAnalysis";

const labelClass = "text-xs font-semibold text-muted-foreground";

export function TelemetrySidePanel({
  activeTab,
  onTabChange,
  telemetry,
  samples,
  state
}: {
  activeTab: RightPanelTab;
  onTabChange: (tab: RightPanelTab) => void;
  telemetry: Telemetry | null;
  samples: Telemetry[];
  state: AppState;
}) {
  const tabs: { id: RightPanelTab; label: string; icon: React.ReactNode }[] = [
    { id: "car", label: "Car", icon: <Gauge size={16} /> },
    { id: "behavior", label: "Behavior", icon: <BarChart3 size={16} /> },
    { id: "data", label: "Data", icon: <Activity size={16} /> }
  ];

  return (
    <Card className="flex h-full min-h-0 flex-col border-border bg-card/80 p-3">
      <Tabs value={activeTab} onValueChange={(value) => onTabChange(value as RightPanelTab)} className="min-h-0 flex-1 gap-3">
        <TabsList className="shrink-0">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className="gap-2 px-3">
              {tab.icon}
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <ScrollArea className="min-h-0 flex-1 pr-2">
          <TabsContent value="car" className="m-0 flex flex-col gap-4 pb-2">
            <CarDataPanel telemetry={telemetry} />
          </TabsContent>
          <TabsContent value="behavior" className="m-0 flex flex-col gap-4 pb-2">
            <BehaviorPanel samples={samples} />
          </TabsContent>
          <TabsContent value="data" className="m-0 flex flex-col gap-4 pb-2">
            <TelemetryDashboard telemetry={telemetry} state={state} />
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </Card>
  );
}

export function CarDataPanel({ telemetry }: { telemetry: Telemetry | null }) {
  return (
    <div className="grid gap-[18px]">
      <TelemetryGroup title="Tires and suspension" icon={<Gauge size={18} />}>
        <ChassisVisual telemetry={telemetry} />
      </TelemetryGroup>

      <TelemetryGroup title="Load and motion" icon={<Activity size={18} />}>
        <MotionVisual telemetry={telemetry} />
      </TelemetryGroup>
    </div>
  );
}

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

function BehaviorPanel({ samples }: { samples: Telemetry[] }) {
  const summary = React.useMemo(() => summarizeTuningBehavior(samples), [samples]);

  return (
    <div className="grid gap-[18px]">
      <TelemetryGroup title="Tuning balance" icon={<BarChart3 size={18} />}>
        {summary.sampleCount < 2 ? (
          <div className="rounded-lg border border-white/10 bg-white/[0.035] p-4 text-sm leading-5 text-[#b5bfb9]">
            No cornering samples yet.
          </div>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
              <DataCell label="Corner samples" value={summary.sampleCount} />
              <DataCell label="Analyzed time" value={formatBehaviorDuration(summary.totalMilliseconds)} />
              <DataCell label="Distance" value={summary.totalDistanceMeters} suffix=" m" precision={0} />
              <DataCell label="Avg speed" value={summary.avgSpeedKmh} suffix=" km/h" precision={0} />
            </dl>
            <div className="grid gap-3">
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
    <section className="grid gap-3 rounded-lg border border-white/10 bg-white/[0.035] p-3">
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

      <dl className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
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
    <div className="min-w-0 rounded-md border border-white/10 bg-[#101312]/70 p-2">
      <dt className="truncate text-[9px] font-black uppercase leading-none tracking-wide text-[#9ba6a1]">{label}</dt>
      <dd className={`mt-1 truncate text-xs font-black leading-tight tabular-nums ${metricToneClass(tone)}`}>
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

function ChassisVisual({ telemetry }: { telemetry: Telemetry | null }) {
  const tires = buildTireMfdData(telemetry);
  const corners = [
    { id: "front-left", label: "FL", side: "left" as const, axle: "front" as const, travel: telemetry?.NormalizedSuspensionTravelFrontLeft },
    { id: "front-right", label: "FR", side: "right" as const, axle: "front" as const, travel: telemetry?.NormalizedSuspensionTravelFrontRight },
    { id: "rear-left", label: "RL", side: "left" as const, axle: "rear" as const, travel: telemetry?.NormalizedSuspensionTravelRearLeft },
    { id: "rear-right", label: "RR", side: "right" as const, axle: "rear" as const, travel: telemetry?.NormalizedSuspensionTravelRearRight }
  ];
  const frontTravel = telemetry ? average([
    telemetry.NormalizedSuspensionTravelFrontLeft,
    telemetry.NormalizedSuspensionTravelFrontRight
  ]) : undefined;
  const rearTravel = telemetry ? average([
    telemetry.NormalizedSuspensionTravelRearLeft,
    telemetry.NormalizedSuspensionTravelRearRight
  ]) : undefined;
  const maxCompression = telemetry ? Math.max(
    telemetry.NormalizedSuspensionTravelFrontLeft,
    telemetry.NormalizedSuspensionTravelFrontRight,
    telemetry.NormalizedSuspensionTravelRearLeft,
    telemetry.NormalizedSuspensionTravelRearRight
  ) : undefined;
  const frontCombinedSlip = telemetry ? average([
    Math.abs(telemetry.TireCombinedSlipFrontLeft),
    Math.abs(telemetry.TireCombinedSlipFrontRight)
  ]) : undefined;
  const rearCombinedSlip = telemetry ? average([
    Math.abs(telemetry.TireCombinedSlipRearLeft),
    Math.abs(telemetry.TireCombinedSlipRearRight)
  ]) : undefined;
  const frontSlipAngle = telemetry ? frontTireSlipAngle(telemetry) : undefined;
  const rearSlipAngle = telemetry ? rearTireSlipAngle(telemetry) : undefined;
  const tireTempDelta = telemetry ? telemetry.frontTemp - telemetry.rearTemp : undefined;
  const suspensionSplit = frontTravel !== undefined && rearTravel !== undefined ? (frontTravel - rearTravel) * 100 : undefined;
  const frontSummary = [
    { label: "Slip", value: formatValue(frontCombinedSlip, { precision: 2 }), tone: slipAmountTone(frontCombinedSlip) },
    { label: "Angle", value: formatValue(frontSlipAngle, { precision: 2 }) },
    { label: "Temp", value: `${formatValue(telemetry?.frontTemp, { precision: 0 })}°C`, className: tireTextColorClass(telemetry?.frontTemp ?? 0) }
  ];
  const rearSummary = [
    { label: "Slip", value: formatValue(rearCombinedSlip, { precision: 2 }), tone: slipAmountTone(rearCombinedSlip) },
    { label: "Angle", value: formatValue(rearSlipAngle, { precision: 2 }) },
    { label: "Temp", value: `${formatValue(telemetry?.rearTemp, { precision: 0 })}°C`, className: tireTextColorClass(telemetry?.rearTemp ?? 0) }
  ];
  const suspensionSummary = [
    { label: "F comp", value: `${formatValue(frontTravel !== undefined ? frontTravel * 100 : undefined, { precision: 0 })}%`, tone: compressionTone(frontTravel) },
    { label: "R comp", value: `${formatValue(rearTravel !== undefined ? rearTravel * 100 : undefined, { precision: 0 })}%`, tone: compressionTone(rearTravel) },
    { label: "Max", value: `${formatValue(maxCompression !== undefined ? maxCompression * 100 : undefined, { precision: 0 })}%`, tone: compressionTone(maxCompression) },
    { label: "Split", value: `${formatValue(suspensionSplit, { precision: 0 })}%` }
  ];

  return (
    <div className="grid gap-3">
      <div className="grid gap-2 md:grid-cols-[minmax(150px,1fr)_minmax(190px,0.9fr)] md:items-start">
        <ChassisAxleSummary title="Front axle" items={frontSummary} />
        <ChassisBalanceSummary
          label="Temp balance"
          value={`${temperatureSplitLabel(tireTempDelta)} ${formatValue(tireTempDelta, { precision: 0 })}°C`}
          tone={tireTempDelta === undefined ? "default" : temperatureTone(tireTempDelta)}
        />
      </div>
      <div className="grid min-h-[190px] grid-cols-2 gap-x-2 gap-y-4">
        {corners.map((corner) => {
          const tire = tires.find((candidate) => candidate.id === corner.id);
          return (
            <ChassisCorner
              key={corner.id}
              label={corner.label}
              side={corner.side}
              axle={corner.axle}
              tire={tire}
              travel={corner.travel}
            />
          );
        })}
      </div>
      <div className="grid gap-2 md:grid-cols-[minmax(150px,1fr)_minmax(230px,1.1fr)] md:items-end">
        <ChassisAxleSummary title="Rear axle" items={rearSummary} />
        <ChassisMetricStrip title="Suspension" items={suspensionSummary} />
      </div>
    </div>
  );
}

type ChassisSummaryItem = {
  label: string;
  value: string;
  tone?: "default" | "ok" | "warn" | "alert";
  className?: string;
};

function ChassisAxleSummary({
  title,
  items
}: {
  title: string;
  items: ChassisSummaryItem[];
}) {
  return (
    <div className="grid gap-1.5">
      <span className="text-[9px] font-black uppercase leading-none tracking-wide text-[#9ba6a1]">{title}</span>
      <div className="grid grid-cols-3 gap-1.5">
        {items.map((item) => (
          <ChassisSummaryMetric key={item.label} item={item} />
        ))}
      </div>
    </div>
  );
}

function ChassisMetricStrip({
  title,
  items
}: {
  title: string;
  items: ChassisSummaryItem[];
}) {
  return (
    <div className="grid gap-1.5">
      <span className="text-[9px] font-black uppercase leading-none tracking-wide text-[#9ba6a1]">{title}</span>
      <div className="grid grid-cols-4 gap-1.5">
        {items.map((item) => (
          <ChassisSummaryMetric key={item.label} item={item} />
        ))}
      </div>
    </div>
  );
}

function ChassisBalanceSummary({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone: "default" | "ok" | "warn" | "alert";
}) {
  return (
    <div className="grid justify-items-start gap-1 md:justify-items-end">
      <span className="text-[9px] font-black uppercase leading-none tracking-wide text-[#9ba6a1]">{label}</span>
      <span className={`text-[13px] font-black leading-none tabular-nums ${metricToneClass(tone)}`}>{value}</span>
    </div>
  );
}

function ChassisSummaryMetric({ item }: { item: ChassisSummaryItem }) {
  return (
    <span className="min-w-0 rounded-md border border-white/10 bg-white/[0.035] px-2 py-1.5">
      <span className="block truncate text-[8px] font-black uppercase leading-none tracking-wide text-[#9ba6a1]">{item.label}</span>
      <span className={`block truncate text-[12px] font-black leading-tight tabular-nums ${item.className ?? metricToneClass(item.tone ?? "default")}`}>
        {item.value}
      </span>
    </span>
  );
}

function ChassisCorner({
  label,
  side,
  axle,
  tire,
  travel
}: {
  label: string;
  side: "left" | "right";
  axle: "front" | "rear";
  tire: TireMfdTire | undefined;
  travel: number | undefined;
}) {
  const compression = clampNumber(travel ?? 0, 0, 1);
  const tone = compressionTone(travel);
  const springColor = tone === "alert" ? "#e46645" : tone === "warn" ? "#f3d09b" : "#63da97";
  const tireColor = tireTemperatureColor(tire?.temp ?? 0);
  const tireSlip = tire?.combinedSlip ?? 0;
  const tireReadout = (
    <CornerStackReadout
      lines={[
        { label: "Temp", value: `${formatValue(tire?.temp, { precision: 0 })}°C`, className: tireTextColorClass(tire?.temp ?? 0) },
        { label: "Slip", value: `${Math.round(clampNumber(tireSlip, 0, 1.5) * 100)}%`, className: metricToneClass(slipAmountTone(tireSlip)) },
        { label: "Angle", value: formatValue(tire?.slipAngle, { precision: 2 }), className: metricToneClass("default") }
      ]}
    />
  );
  const suspensionReadout = (
    <CornerStackReadout
      lines={[
        { label: "Comp", value: `${Math.round(compression * 100)}%`, className: metricToneClass(tone) }
      ]}
    />
  );

  return (
    <div
      className={[
        "grid w-[288px] max-w-full min-w-0 grid-cols-[minmax(52px,1fr)_42px_42px_minmax(46px,1fr)] items-center gap-1.5 p-1.5",
        side === "left" ? "justify-self-end" : "justify-self-start",
        axle === "front" ? "self-end" : "self-start"
      ].join(" ")}
    >
      {side === "left" ? (
        <>
          {tireReadout}
          <TireGlyph label={label} tire={tire} />
          <SpringGlyph compression={compression} color={springColor} label={label} />
          {suspensionReadout}
        </>
      ) : (
        <>
          {suspensionReadout}
          <SpringGlyph compression={compression} color={springColor} label={label} />
          <TireGlyph label={label} tire={tire} />
          {tireReadout}
        </>
      )}
    </div>
  );
}

function TireGlyph({ label, tire }: { label: string; tire: TireMfdTire | undefined }) {
  const slip = tire ? clampNumber(Math.abs(tire.combinedSlip), 0, 1.2) : 0;
  const slipHeight = clampNumber(slip / 1.2, 0.12, 1) * 54;

  return (
    <svg className="h-[64px] w-[42px]" viewBox="0 0 54 82" role="img" aria-label={`${label} tire`}>
      <rect className="stroke-[#101312] [stroke-width:2]" x="11" y="9" width="32" height="64" rx="7" fill={tireTemperatureColor(tire?.temp ?? 0)} />
      <rect x="11" y={73 - slipHeight} width="32" height={slipHeight} rx="6" fill="rgba(0,0,0,0.32)" />
      <text className="fill-[#101312] text-[12px] font-black [paint-order:stroke] [stroke:white] [stroke-width:3px]" x="27" y="45" textAnchor="middle">{label}</text>
    </svg>
  );
}

function SpringGlyph({ compression, color, label }: { compression: number; color: string; label: string }) {
  const centerX = 27;
  const topY = 13 + compression * 31;
  const bottomY = 70;
  const springHeight = bottomY - topY;

  return (
    <svg className="h-[64px] w-[42px]" viewBox="0 0 54 82" role="img" aria-label={`${label} suspension`}>
      <path className="fill-none stroke-white/10 [stroke-width:7]" d={`M${centerX} 8 V74`} />
      <path className="fill-none stroke-white/20 [stroke-linecap:round] [stroke-width:2.5]" d={`M14 10 H40 M12 ${bottomY + 5} H42`} />
      <path className="fill-none [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:3.2]" d={springPath(centerX, topY + 4, springHeight - 8)} stroke={color} />
      <rect className="fill-[#101312] stroke-white/15 [stroke-width:1.4]" x="13" y={topY - 7} width="28" height="9" rx="3" />
      <rect className="fill-white/10 stroke-white/20 [stroke-width:1]" x="9" y={bottomY} width="36" height="8" rx="3" />
    </svg>
  );
}

const G_FORCE_LIMIT = 1.4;
const G_FORCE_RADIUS = 54;
const MOTION_CENTER = 96;

type MotionValues = {
  lateralG: number;
  longitudinalG: number;
  rollDeg: number;
  pitchDeg: number;
  yawRateDeg: number;
};

function motionValuesFromTelemetry(telemetry: Telemetry | null): MotionValues {
  return {
    lateralG: clampNumber((telemetry?.AccelerationX ?? 0) / 9.81, -G_FORCE_LIMIT, G_FORCE_LIMIT),
    longitudinalG: clampNumber((telemetry?.AccelerationZ ?? 0) / 9.81, -G_FORCE_LIMIT, G_FORCE_LIMIT),
    rollDeg: clampNumber(telemetry ? radiansToDegrees(telemetry.Roll) : 0, -18, 18),
    pitchDeg: clampNumber(telemetry ? radiansToDegrees(telemetry.Pitch) : 0, -18, 18),
    yawRateDeg: clampNumber(telemetry ? radiansToDegrees(telemetry.AngularVelocityY) : 0, -120, 120)
  };
}

function gDotPosition(lateralG: number, longitudinalG: number) {
  return {
    x: MOTION_CENTER + (lateralG / G_FORCE_LIMIT) * G_FORCE_RADIUS,
    y: MOTION_CENTER - (longitudinalG / G_FORCE_LIMIT) * G_FORCE_RADIUS
  };
}

function MotionVisual({ telemetry }: { telemetry: Telemetry | null }) {
  const motion = motionValuesFromTelemetry(telemetry);
  const dot = gDotPosition(motion.lateralG, motion.longitudinalG);

  return (
    <div className="grid gap-3 xl:grid-cols-[190px_minmax(340px,1fr)] xl:items-center">
      <div className="min-w-0">
        <GForcePlotSvg dot={dot} lateralG={motion.lateralG} longitudinalG={motion.longitudinalG} />
      </div>
      <div className="min-w-0">
        <ChassisAttitudeSvg rollDeg={motion.rollDeg} pitchDeg={motion.pitchDeg} yawRateDeg={motion.yawRateDeg} />
      </div>
    </div>
  );
}

function GForcePlotSvg({
  dot,
  lateralG,
  longitudinalG
}: {
  dot: { x: number; y: number };
  lateralG: number;
  longitudinalG: number;
}) {
  return (
    <svg className="h-[168px] w-full min-w-0 lg:h-[176px]" viewBox="0 0 240 176" role="img" aria-label="Lateral and longitudinal G load">
      <text className="fill-[#9ba6a1] text-[10px] font-bold" x={MOTION_CENTER} y="13" textAnchor="middle">Longitudinal G</text>
      <text className="fill-[#f5f7f6] text-[16px] font-black tabular-nums" x={MOTION_CENTER} y="33" textAnchor="middle">
        {formatValue(longitudinalG, { precision: 2 })}
      </text>
      <text className="fill-[#9ba6a1] text-[10px] font-bold" x="170" y="86">Lateral G</text>
      <text className="fill-[#f5f7f6] text-[16px] font-black tabular-nums" x="170" y="106">
        {formatValue(lateralG, { precision: 2 })}
      </text>
      <circle className="fill-[#101312] stroke-white/10 [stroke-width:1.5]" cx={MOTION_CENTER} cy={MOTION_CENTER} r="58" />
      <circle className="fill-none stroke-white/10 [stroke-width:1]" cx={MOTION_CENTER} cy={MOTION_CENTER} r="32" />
      <path className="fill-none stroke-white/15 [stroke-width:1]" d="M38 96 H154 M96 38 V154" />
      <path className="fill-none stroke-white/10 [stroke-width:1]" d="M55 55 L137 137 M137 55 L55 137" />
      <circle className="fill-[#63da97] stroke-[#101312] [stroke-width:3]" cx={dot.x} cy={dot.y} r="8" />
    </svg>
  );
}

function ChassisAttitudeSvg({
  rollDeg,
  pitchDeg,
  yawRateDeg
}: {
  rollDeg: number;
  pitchDeg: number;
  yawRateDeg: number;
}) {
  return (
    <svg className="h-[168px] w-full min-w-0 lg:h-[176px]" viewBox="0 0 340 176" role="img" aria-label="Pitch roll and yaw rate attitude">
      <text className="fill-[#9ba6a1] text-[10px] font-bold" x="170" y="20" textAnchor="middle">Yaw rate</text>
      <text className="fill-[#f5f7f6] text-[14px] font-black tabular-nums" x="170" y="38" textAnchor="middle">
        {formatValue(yawRateDeg, { precision: 0 })}°/s
      </text>

      <g transform="translate(88 102)">
        <text className="fill-[#9ba6a1] text-[11px] font-bold" x="0" y="-54" textAnchor="middle">Roll</text>
        <circle className="fill-[#101312] stroke-white/10 [stroke-width:1.2]" cx="0" cy="0" r="43" />
        <path className="fill-none stroke-white/15 [stroke-width:1]" d="M-42 0 H42 M0 -34 V34" />
        <g transform={`rotate(${rollDeg})`}>
          <RollCarGlyph />
        </g>
        <text className="fill-[#f5f7f6] text-[14px] font-black tabular-nums" x="0" y="60" textAnchor="middle">
          {formatValue(rollDeg, { precision: 1 })}°
        </text>
      </g>

      <g transform="translate(252 102)">
        <text className="fill-[#9ba6a1] text-[11px] font-bold" x="0" y="-54" textAnchor="middle">Pitch</text>
        <circle className="fill-[#101312] stroke-white/10 [stroke-width:1.2]" cx="0" cy="0" r="43" />
        <path className="fill-none stroke-white/15 [stroke-width:1]" d="M-42 0 H42 M0 -34 V34" />
        <g transform={`rotate(${-pitchDeg})`}>
          <PitchCarGlyph />
        </g>
        <text className="fill-[#f5f7f6] text-[14px] font-black tabular-nums" x="0" y="60" textAnchor="middle">
          {formatValue(pitchDeg, { precision: 1 })}°
        </text>
      </g>
    </svg>
  );
}

function RollCarGlyph() {
  return (
    <g>
      <rect className="fill-[#050706] stroke-[#2f3f39] [stroke-width:1]" x="-29" y="10" width="9" height="13" rx="2" />
      <rect className="fill-[#050706] stroke-[#2f3f39] [stroke-width:1]" x="20" y="10" width="9" height="13" rx="2" />
      <path
        className="fill-[#293c35] stroke-[#f3d09b]/80 [stroke-linejoin:round] [stroke-width:2]"
        d="M-24 -18 H24 L31 -5 V18 H-31 V-5 Z"
      />
      <path className="fill-[#19251f] stroke-white/20 [stroke-width:1]" d="M-15 -13 H15 L19 -5 H-19 Z" />
      <rect className="fill-[#101312] stroke-white/15 [stroke-width:1]" x="-24" y="-1" width="48" height="12" rx="2" />
      <circle className="fill-[#f3d09b]" cx="-19" cy="5" r="2.5" />
      <circle className="fill-[#f3d09b]" cx="19" cy="5" r="2.5" />
      <path className="fill-none stroke-white/20 [stroke-linecap:round] [stroke-width:1.5]" d="M-9 5 H9" />
    </g>
  );
}

function PitchCarGlyph() {
  return (
    <g>
      <path
        className="fill-[#293c35] stroke-[#63da97]/85 [stroke-linejoin:round] [stroke-width:2]"
        d="M-32 8 L-25 -6 L4 -12 L24 -5 L32 8 Z"
      />
      <path className="fill-[#19251f] stroke-white/20 [stroke-width:1]" d="M-16 -6 L3 -10 L15 -5 L-19 -3 Z" />
      <path className="fill-none stroke-white/20 [stroke-linecap:round] [stroke-width:1.8]" d="M-14 3 H20" />
      <circle className="fill-[#050706] stroke-[#2f3f39] [stroke-width:1]" cx="-20" cy="9" r="5" />
      <circle className="fill-[#050706] stroke-[#2f3f39] [stroke-width:1]" cx="21" cy="9" r="5" />
    </g>
  );
}

function CornerStackReadout({
  lines
}: {
  lines: { label: string; value: string; className: string }[];
}) {
  return (
    <div className="grid min-w-0 content-center gap-1">
      {lines.map((line, index) => (
        <span key={`${line.label}-${index}`} className="block min-w-0">
          <span className="block truncate text-[9px] font-black uppercase leading-none tracking-wide text-[#9ba6a1]">{line.label}</span>
          <span className={`block truncate text-[13px] font-black leading-tight tabular-nums ${line.className}`}>
            {line.value}
          </span>
        </span>
      ))}
    </div>
  );
}

function TiltMeter({
  label,
  value,
  max,
  suffix = "°",
  compact = false
}: {
  label: string;
  value: number;
  max: number;
  suffix?: string;
  compact?: boolean;
}) {
  const marker = 50 + (clampNumber(value, -max, max) / max) * 50;

  return (
    <div className={compact ? "grid min-w-0 gap-1.5" : "grid gap-2"}>
      <div className="flex min-w-0 items-center justify-between gap-3">
        <span className={labelClass}>{label}</span>
        <span className={`${compact ? "text-xs" : "text-sm"} shrink-0 font-bold tabular-nums text-[#f5f7f6]`}>{formatValue(value, { precision: suffix === "°/s" ? 0 : 1 })}{suffix}</span>
      </div>
      <div className={`${compact ? "h-2.5" : "h-3"} relative rounded-full border border-white/10 bg-[#101312]`}>
        <div className="absolute left-1/2 top-0 h-full w-px bg-white/25" />
        <div className={`${compact ? "h-4 w-1" : "h-5 w-1.5"} absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#f3d09b]`} style={{ left: `${marker}%` }} />
      </div>
    </div>
  );
}

function RadialGauge({ label, value, display }: { label: string; value: number; display: string }) {
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const progress = clampNumber(value, 0, 1);

  return (
    <div className="grid place-items-center">
      <svg className="h-[168px] w-[168px]" viewBox="0 0 168 168" role="img" aria-label={`${label} gauge`}>
        <circle className="fill-[#101312] stroke-white/10 [stroke-width:1.5]" cx="84" cy="84" r="76" />
        <circle className="fill-none stroke-white/10 [stroke-width:12]" cx="84" cy="84" r={radius} />
        <circle
          className="fill-none stroke-[#f3d09b] [stroke-linecap:round] [stroke-width:12]"
          cx="84"
          cy="84"
          r={radius}
          strokeDasharray={`${circumference * progress} ${circumference}`}
          transform="rotate(-90 84 84)"
        />
        <text className="fill-[#9ba6a1] text-[11px] font-bold" x="84" y="76" textAnchor="middle">{label}</text>
        <text className="fill-[#f5f7f6] text-[24px] font-black tabular-nums" x="84" y="101" textAnchor="middle">{display}</text>
      </svg>
    </div>
  );
}

function springPath(centerX: number, topY: number, height: number) {
  const turns = 5.5;
  const amplitude = 9.5;
  const samples = 44;
  const points: string[] = [];

  for (let index = 0; index <= samples; index += 1) {
    const progress = index / samples;
    const x = centerX + Math.sin(progress * turns * Math.PI * 2) * amplitude;
    const y = topY + progress * height;
    points.push(`${x.toFixed(1)} ${y.toFixed(1)}`);
  }

  return `M ${points.join(" L ")}`;
}

export function buildTireMfdData(telemetry: Telemetry | null): TireMfdTire[] {
  const frontSteerAngle = approximateFrontTireSteerDegrees(telemetry?.steerPct ?? 0);

  return [
    {
      id: "front-left",
      temp: telemetry?.TireTempFrontLeft ?? 0,
      slipAngle: Math.abs(telemetry?.TireSlipAngleFrontLeft ?? 0),
      combinedSlip: Math.abs(telemetry?.TireCombinedSlipFrontLeft ?? 0),
      steerAngleDeg: frontSteerAngle
    },
    {
      id: "front-right",
      temp: telemetry?.TireTempFrontRight ?? 0,
      slipAngle: Math.abs(telemetry?.TireSlipAngleFrontRight ?? 0),
      combinedSlip: Math.abs(telemetry?.TireCombinedSlipFrontRight ?? 0),
      steerAngleDeg: frontSteerAngle
    },
    {
      id: "rear-left",
      temp: telemetry?.TireTempRearLeft ?? 0,
      slipAngle: Math.abs(telemetry?.TireSlipAngleRearLeft ?? 0),
      combinedSlip: Math.abs(telemetry?.TireCombinedSlipRearLeft ?? 0),
      steerAngleDeg: 0
    },
    {
      id: "rear-right",
      temp: telemetry?.TireTempRearRight ?? 0,
      slipAngle: Math.abs(telemetry?.TireSlipAngleRearRight ?? 0),
      combinedSlip: Math.abs(telemetry?.TireCombinedSlipRearRight ?? 0),
      steerAngleDeg: 0
    }
  ];
}

function approximateFrontTireSteerDegrees(steerPct: number) {
  return clampNumber(steerPct, -100, 100) * 0.28;
}

export function tireTemperatureColor(temp: number) {
  if (!Number.isFinite(temp) || temp <= 0) return "#26302d";
  if (temp < 55) return "#59a7ff";
  if (temp < 82) return "#63da97";
  if (temp < 102) return "#f3d09b";
  return "#e46645";
}

function tireTextColorClass(temp: number) {
  if (!Number.isFinite(temp) || temp <= 0) return "text-[#f5f7f6]";
  if (temp < 55) return "text-[#59a7ff]";
  if (temp < 82) return "text-[#63da97]";
  if (temp < 102) return "text-[#f3d09b]";
  return "text-[#e46645]";
}

export function MetricCell({
  label,
  value,
  suffix = "",
  precision = 0,
  tone = "default"
}: {
  label: string;
  value: TelemetryValue;
  suffix?: string;
  precision?: number;
  tone?: "default" | "ok" | "warn" | "alert";
}) {
  const toneClass = metricToneClass(tone);

  return (
    <div className="min-w-0 rounded-lg border border-white/10 bg-white/[0.035] p-3">
      <dt className={`${labelClass} mb-1.5`}>{label}</dt>
      <dd className={`break-words font-bold leading-tight tabular-nums ${toneClass}`}>
        {formatValue(value, { precision })}{suffix}
      </dd>
    </div>
  );
}

function metricToneClass(tone: "default" | "ok" | "warn" | "alert") {
  return {
    default: "text-[#f5f7f6]",
    ok: "text-[#63da97]",
    warn: "text-[#f3d09b]",
    alert: "text-[#e46645]"
  }[tone];
}

export function TelemetryDashboard({
  telemetry,
  state
}: {
  telemetry: Telemetry | null;
  state: AppState;
}) {
  return (
    <div className="grid gap-[18px]">
      <TelemetryGroup title="App info" icon={<Clock3 size={18} />}>
        <dl className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
          {[
            ["Connected", state.connected ? "yes" : "no"],
            ["Packets", state.packets],
            ["Bad packets", state.badPackets],
            ["Status", tuningStatusLabel(state.advice)],
            ["Samples", state.summary?.sampleCount ?? 0],
            ["Window", `${formatValue(state.summary?.windowSeconds ?? 0, { precision: 1 })} s`],
            ["UDP port", state.udpPort],
            ["HTTP port", state.httpPort],
            ["WebSocket port", state.wsPort],
            ["Session", state.sessionId ? shortSessionId(state.sessionId) : "none"],
            ["Source", state.lastSource || "none"],
            ["Last packet", state.lastPacketAt ? new Date(state.lastPacketAt).toLocaleTimeString() : "none"],
            ["Local IPs", state.localIps.length ? state.localIps.join(", ") : "none"]
          ].map(([label, value]) => (
            <DataCell key={label} label={String(label)} value={value} />
          ))}
        </dl>
      </TelemetryGroup>

      <TelemetryGroup title="Raw game info" icon={<Activity size={18} />}>
        {docTelemetrySections.map((section) => (
          <DocDataSection key={section.title} section={section} telemetry={telemetry} />
        ))}
      </TelemetryGroup>
    </div>
  );
}

function TelemetryGroup({
  title,
  icon,
  children,
  className = ""
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`grid gap-3 ${className}`}>
      <SectionTitle icon={icon} compact>{title}</SectionTitle>
      <div className="grid gap-[18px]">
        {children}
      </div>
    </section>
  );
}

function DocDataSection({ section, telemetry }: { section: DocTelemetrySection; telemetry: Telemetry | null }) {
  return (
    <section className="grid gap-3">
      <div className="grid gap-1.5">
        <SectionTitle icon={<Activity size={18} />} compact>{section.title}</SectionTitle>
        <p className="m-0 text-sm leading-5 text-[#b5bfb9]">{section.comment}</p>
      </div>
      <dl className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-3">
        {section.fields.map((field) => (
          <DataCell
            key={field.name}
            label={field.label}
            value={telemetry?.[field.name]}
            suffix={field.suffix}
            precision={field.precision}
            boolean={field.boolean}
          />
        ))}
      </dl>
    </section>
  );
}

export function DataCell({
  label,
  value,
  suffix = "",
  precision = 0,
  boolean = false
}: {
  label: string;
  value: TelemetryValue;
  suffix?: string;
  precision?: number;
  boolean?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-white/10 bg-white/[0.035] p-3">
      <dt className={`${labelClass} mb-1.5`}>{label}</dt>
      <dd className="overflow-hidden text-ellipsis whitespace-nowrap font-bold text-[#f5f7f6]">
        {formatValue(value, { precision, boolean })}{boolean ? "" : suffix}
      </dd>
    </div>
  );
}

export function SectionTitle({ children, icon, compact = false }: { children: React.ReactNode; icon?: React.ReactNode; compact?: boolean }) {
  return (
    <h2 className={`${compact ? "mb-0" : "mb-4"} flex items-center gap-2 text-[0.95rem] font-bold text-[#f5f7f6]`}>
      {icon}{children}
    </h2>
  );
}
