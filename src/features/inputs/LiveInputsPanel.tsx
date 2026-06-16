import * as React from "react";
import { Progress } from "@/components/ui/progress";
import { formatGear, formatSignedPercent, formatValue } from "@/lib/format";
import { clampNumber, clampPercent } from "@/lib/math";
import type { Telemetry } from "@/types/telemetry";

const labelClass = "text-xs font-semibold text-muted-foreground";

type RpmTick = {
  rpm: number;
  percent: number;
  major: boolean;
};

type LiveInputsPanelMode = "live" | "graph";
type InputSeriesPoint = { index: number; value: number };

type InputTraceField = {
  name: keyof Telemetry;
  label: string;
  color: string;
  min: number;
  max: number;
  suffix: string;
};

const inputTraceFields: InputTraceField[] = [
  { name: "steerPct", label: "Steer", color: "#f3d09b", min: -100, max: 100, suffix: "%" },
  { name: "brakePct", label: "Brake", color: "#e46645", min: 0, max: 100, suffix: "%" },
  { name: "throttlePct", label: "Throttle", color: "#63da97", min: 0, max: 100, suffix: "%" }
];
const INPUT_GRAPH_WINDOW_SIZE = 3000;
const GRAPH_PLAYHEAD_RATIO = 0.75;

export function LiveInputsPanel({
  telemetry,
  samples,
  mode = "live",
  currentSampleIndex = null,
  sampleOffset = 0,
  hoverSampleIndex = null,
  onGraphHoverIndex
}: {
  telemetry: Telemetry | null;
  samples: Telemetry[];
  mode?: LiveInputsPanelMode;
  currentSampleIndex?: number | null;
  sampleOffset?: number;
  hoverSampleIndex?: number | null;
  onGraphHoverIndex?: (index: number | null) => void;
}) {
  if (mode === "graph") {
    return (
      <InputTracesPanel
        telemetry={telemetry}
        samples={samples}
        currentSampleIndex={currentSampleIndex}
        sampleOffset={sampleOffset}
        hoverSampleIndex={hoverSampleIndex}
        onGraphHoverIndex={onGraphHoverIndex}
      />
    );
  }

  const steerPct = clampPercent(telemetry?.steerPct ?? 0);
  const throttlePct = clampPercent(telemetry?.throttlePct ?? 0);
  const brakePct = clampPercent(telemetry?.brakePct ?? 0);
  const gear = formatGear(telemetry?.Gear);
  const steeringRotation = steerPct * 1.35;
  const speedKmh = telemetry?.speedKmh ?? 0;
  const rpm = telemetry?.CurrentEngineRpm ?? 0;
  const maxRpm = Math.max(telemetry?.EngineMaxRpm ?? 0, telemetry?.EngineIdleRpm ?? 0, 1);
  const rpmPercent = clampNumber((rpm / maxRpm) * 100, 0, 100);
  const powerRatio = clampNumber((telemetry?.powerHp ?? 0) / 1200, 0, 1);
  const torqueRatio = clampNumber((telemetry?.torqueNm ?? 0) / 1500, 0, 1);
  const boostRatio = clampNumber((telemetry?.Boost ?? 0) / 30, 0, 1);

  return (
    <section className="grid min-h-0 grid-cols-[190px_minmax(0,1fr)] gap-3 border-border bg-card/80 p-3">
      <div className="grid min-w-0 content-center gap-2.5 border-r border-white/10 pr-3">
        <div className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-3">
          <div className="grid justify-items-center gap-1">
            <strong className="text-xs font-black leading-none tabular-nums text-[#f5f7f6]">{formatSignedPercent(steerPct)}</strong>
            <div className="grid h-[50px] w-[50px] place-items-center rounded-full border border-white/15 bg-[#070a09]/60 text-[#f3d09b] shadow-[inset_0_0_0_5px_rgba(255,255,255,0.035)]">
              <SteeringWheelIcon rotation={steeringRotation} />
            </div>
          </div>
          <PowertrainReadout label="Gear" value={gear} tone="accent" />
        </div>

        <div className="grid gap-2">
          <InputBar label="Throttle" value={throttlePct} color="#63da97" />
          <InputBar label="Brake" value={brakePct} color="#e46645" />
        </div>
      </div>

      <div className="grid min-w-0 content-center gap-2.5">
        <RpmDisplay
          telemetry={telemetry}
          maxRpm={maxRpm}
          rpmPercent={rpmPercent}
          speed={`${formatValue(speedKmh, { precision: 0 })} km/h`}
        />
        <div className="grid min-w-0 grid-cols-3 gap-2.5">
          <PowertrainStat label="Power" value={`${formatValue(telemetry?.powerHp, { precision: 0 })} hp`} ratio={powerRatio} color="#63da97" />
          <PowertrainStat label="Torque" value={`${formatValue(telemetry?.torqueNm, { precision: 0 })} Nm`} ratio={torqueRatio} color="#f3d09b" />
          <PowertrainStat label="Boost" value={`${formatValue(telemetry?.Boost, { precision: 1 })} psi`} ratio={boostRatio} color="#59a7ff" />
        </div>
      </div>
    </section>
  );
}

function InputTracesPanel({
  telemetry,
  samples,
  currentSampleIndex,
  sampleOffset,
  hoverSampleIndex,
  onGraphHoverIndex
}: {
  telemetry: Telemetry | null;
  samples: Telemetry[];
  currentSampleIndex: number | null;
  sampleOffset: number;
  hoverSampleIndex: number | null;
  onGraphHoverIndex?: (index: number | null) => void;
}) {
  const graphWindow = React.useMemo(
    () => pinnedGraphWindow(samples, sampleOffset, currentSampleIndex, INPUT_GRAPH_WINDOW_SIZE),
    [currentSampleIndex, sampleOffset, samples]
  );
  const plottedSamples = samples.length > 0
    ? samples.slice(graphWindow.sliceStart, graphWindow.sliceEnd)
    : telemetry ? [telemetry] : [];
  const plottedSampleOffset = sampleOffset + graphWindow.sliceStart;
  const currentSample = sampleAtAbsoluteInputIndex(samples, sampleOffset, graphWindow.currentIndex);
  const windowLabel = samples.length > 0
    ? `${(graphWindow.sliceStart + 1).toLocaleString()}-${graphWindow.sliceEnd.toLocaleString()} / ${samples.length.toLocaleString()}`
    : `${plottedSamples.length.toLocaleString()} samples`;

  return (
    <section className="grid min-h-0 gap-3 border-border bg-card/80 p-3">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-black text-[#f5f7f6]">Input traces</h2>
          <p className="truncate text-xs font-semibold text-[#9ba6a1]">
            {windowLabel} / playhead pinned
          </p>
        </div>
        <span className="shrink-0 text-[10px] font-black uppercase text-[#66736d]">Under map</span>
      </div>
      <div className="grid min-h-0 min-w-0 grid-cols-1 gap-3 md:grid-cols-3">
        {inputTraceFields.map((field) => (
          <InputTrace
            key={field.name}
            field={field}
            samples={plottedSamples}
            sampleOffset={plottedSampleOffset}
            domainStart={graphWindow.domainStart}
            domainEnd={graphWindow.domainEnd}
            currentSampleIndex={graphWindow.currentIndex}
            hoverSampleIndex={hoverSampleIndex}
            currentSample={currentSample}
            onGraphHoverIndex={onGraphHoverIndex}
          />
        ))}
      </div>
    </section>
  );
}

function InputTrace({
  field,
  samples,
  sampleOffset,
  domainStart,
  domainEnd,
  currentSampleIndex,
  hoverSampleIndex,
  currentSample,
  onGraphHoverIndex
}: {
  field: InputTraceField;
  samples: Telemetry[];
  sampleOffset: number;
  domainStart: number;
  domainEnd: number;
  currentSampleIndex: number | null;
  hoverSampleIndex: number | null;
  currentSample: Telemetry | null;
  onGraphHoverIndex?: (index: number | null) => void;
}) {
  const values = React.useMemo(() => buildInputSeries(samples, field.name, sampleOffset), [field.name, sampleOffset, samples]);
  const currentValue = currentSample?.[field.name];
  const latest = typeof currentValue === "number" && Number.isFinite(currentValue) ? currentValue : values.at(-1)?.value ?? 0;
  const path = React.useMemo(() => inputTracePath(values, field.min, field.max, domainStart, domainEnd), [domainEnd, domainStart, field.max, field.min, values]);
  const currentX = inputIndicatorX(currentSampleIndex, domainStart, domainEnd);
  const hoverX = inputIndicatorX(hoverSampleIndex, domainStart, domainEnd);
  const zeroY = field.min < 0 && field.max > 0
    ? 54 - ((0 - field.min) / (field.max - field.min)) * 44 - 5
    : null;

  function handlePointerMove(event: React.PointerEvent<SVGSVGElement>) {
    if (!onGraphHoverIndex) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const xRatio = clampNumber((event.clientX - rect.left) / Math.max(1, rect.width), 0, 1);
    onGraphHoverIndex(Math.round(domainStart + xRatio * Math.max(1, domainEnd - domainStart)));
  }

  return (
    <div className="grid min-h-[104px] min-w-0 grid-rows-[auto_minmax(0,1fr)] border border-white/[0.07] bg-[#101312] p-2.5">
      <div className="flex min-w-0 items-baseline justify-between gap-2">
        <span className="min-w-0 truncate text-xs font-bold text-[#f5f7f6]">{field.label}</span>
        <span className="shrink-0 text-sm font-black tabular-nums" style={{ color: field.color }}>
          {formatValue(latest, { precision: 0 })}{field.suffix}
        </span>
      </div>
      <svg
        className="h-[68px] w-full min-w-0 overflow-visible"
        viewBox="0 0 240 68"
        preserveAspectRatio="none"
        role="img"
        aria-label={`${field.label} input over time`}
        onPointerMove={handlePointerMove}
        onPointerLeave={() => onGraphHoverIndex?.(null)}
      >
        <path d="M0 56 H240 M0 34 H240 M0 12 H240" className="stroke-white/[0.06] [stroke-width:1]" />
        {zeroY !== null ? (
          <path d={`M0 ${zeroY.toFixed(2)} H240`} className="stroke-white/20 [stroke-dasharray:4_4] [stroke-width:1]" vectorEffect="non-scaling-stroke" />
        ) : null}
        <path
          d={path || "M0 56 H240"}
          className="fill-none [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:2.6]"
          stroke={field.color}
          vectorEffect="non-scaling-stroke"
        />
        {currentX !== null ? (
          <path d={`M${currentX.toFixed(2)} 6 V62`} className="stroke-[#f3d09b]/85 [stroke-width:1.5]" vectorEffect="non-scaling-stroke" />
        ) : null}
        {hoverX !== null ? (
          <path d={`M${hoverX.toFixed(2)} 6 V62`} className="stroke-[#f5f7f6]/80 [stroke-dasharray:4_4] [stroke-width:1.5]" vectorEffect="non-scaling-stroke" />
        ) : null}
      </svg>
    </div>
  );
}

function buildInputSeries(samples: Telemetry[], fieldName: keyof Telemetry, sampleOffset = 0) {
  const maxPoints = 220;
  const stride = Math.max(1, Math.ceil(samples.length / maxPoints));
  const series: InputSeriesPoint[] = [];

  for (let index = 0; index < samples.length; index += stride) {
    const value = samples[index]?.[fieldName];
    if (typeof value === "number" && Number.isFinite(value)) series.push({ index: sampleOffset + index, value });
  }

  const lastIndex = samples.length - 1;
  const lastValue = samples[lastIndex]?.[fieldName];
  if (
    lastIndex >= 0
    && typeof lastValue === "number"
    && Number.isFinite(lastValue)
    && series.at(-1)?.index !== sampleOffset + lastIndex
  ) {
    series.push({ index: sampleOffset + lastIndex, value: lastValue });
  }

  return series;
}

function inputTracePath(series: InputSeriesPoint[], min: number, max: number, domainStart: number, domainEnd: number) {
  if (series.length === 0) return "";
  const width = 240;
  const height = 68;
  const paddingY = 6;
  const indexSpan = Math.max(1, domainEnd - domainStart);
  const valueSpan = Math.max(1, max - min);

  return series.map((point, pointIndex) => {
    const x = ((point.index - domainStart) / indexSpan) * width;
    const normalizedValue = clampNumber((point.value - min) / valueSpan, 0, 1);
    const y = height - paddingY - normalizedValue * (height - paddingY * 2);
    return `${pointIndex === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(" ");
}

function inputIndicatorX(index: number | null, domainStart: number, domainEnd: number) {
  if (index === null || index < domainStart || index > domainEnd) return null;
  const span = Math.max(1, domainEnd - domainStart);
  return ((index - domainStart) / span) * 240;
}

function sampleAtAbsoluteInputIndex(samples: Telemetry[], sampleOffset: number, index: number | null) {
  if (index === null) return null;
  return samples[index - sampleOffset] ?? null;
}

function pinnedGraphWindow(samples: Telemetry[], sampleOffset: number, currentSampleIndex: number | null, windowSize: number) {
  const sampleCount = samples.length;
  const fallbackCurrentIndex = sampleCount > 0 ? sampleOffset + sampleCount - 1 : sampleOffset;
  const currentIndex = currentSampleIndex ?? fallbackCurrentIndex;
  const historyCount = Math.floor(windowSize * GRAPH_PLAYHEAD_RATIO);
  const domainStart = currentIndex - historyCount;
  const domainEnd = domainStart + windowSize - 1;
  const sliceStart = clampNumber(domainStart - sampleOffset, 0, sampleCount);
  const sliceEnd = clampNumber(domainEnd - sampleOffset + 1, sliceStart, sampleCount);

  return {
    currentIndex,
    domainStart,
    domainEnd,
    sliceStart,
    sliceEnd
  };
}

function RpmDisplay({
  telemetry,
  maxRpm,
  rpmPercent,
  speed
}: {
  telemetry: Telemetry | null;
  maxRpm: number;
  rpmPercent: number;
  speed: string;
}) {
  const rpm = telemetry?.CurrentEngineRpm ?? 0;
  const idleRpm = telemetry?.EngineIdleRpm ?? 0;
  const idlePercent = clampNumber((idleRpm / maxRpm) * 100, 0, 100);
  const rpmTicks = buildRpmTicks(maxRpm);

  return (
    <div className="grid min-w-0 gap-2">
      <div className="grid grid-cols-[108px_minmax(0,1fr)] items-end gap-2.5">
        <CompactSpeedReadout value={speed} />
        <strong className="justify-self-center text-2xl font-black leading-none tabular-nums text-[#f5f7f6]">
          {formatValue(rpm, { precision: 0 })}
        </strong>
      </div>

      <div className="relative h-9 overflow-hidden rounded-md border border-white/10 bg-[#101312]">
        <div className="absolute inset-y-1.5 left-2 right-2" aria-hidden="true">
          {rpmTicks.map((tick) => (
            <span
              key={tick.rpm}
              className={`${tick.major ? "top-0 h-full bg-white/25" : "top-1/2 h-3.5 -translate-y-1/2 bg-white/12"} absolute w-px -translate-x-1/2`}
              style={{ left: `${tick.percent}%` }}
            />
          ))}
        </div>
        <div className="absolute inset-y-1.5 left-2 right-2">
          <div className="absolute bottom-0 top-0 w-px -translate-x-1/2 bg-white/25" style={{ left: `${idlePercent}%` }} />
          <div
            className="absolute bottom-0 top-0 w-1 -translate-x-1/2 rounded-full bg-[#f3d09b] shadow-[0_0_18px_rgba(243,208,155,0.45)]"
            style={{ left: `${rpmPercent}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 px-1 text-[10px] font-black uppercase leading-none text-[#9ba6a1]">
        <span className="truncate text-left">Idle {formatValue(idleRpm, { precision: 0 })}</span>
        <span className="truncate text-center">RPM</span>
        <span className="truncate text-right">Redline {formatValue(maxRpm, { precision: 0 })}</span>
      </div>
    </div>
  );
}

function buildRpmTicks(maxRpm: number): RpmTick[] {
  const safeMaxRpm = Math.max(1, maxRpm);
  const step = niceRpmTickStep(safeMaxRpm / 10);
  const majorEvery = step * (safeMaxRpm / step > 10 ? 3 : 2);
  const ticks: RpmTick[] = [];

  for (let rpm = 0; rpm < safeMaxRpm; rpm += step) {
    ticks.push({
      rpm,
      percent: clampNumber((rpm / safeMaxRpm) * 100, 0, 100),
      major: rpm === 0 || rpm % majorEvery === 0
    });
  }

  ticks.push({ rpm: safeMaxRpm, percent: 100, major: true });
  return ticks;
}

function niceRpmTickStep(rawStep: number) {
  if (rawStep <= 250) return 250;
  if (rawStep <= 500) return 500;
  if (rawStep <= 1000) return 1000;
  if (rawStep <= 1500) return 1500;
  if (rawStep <= 2000) return 2000;
  return 2500;
}

function PowertrainReadout({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "accent" }) {
  return (
    <div className="grid min-w-0 place-items-center px-1 py-1.5 text-center">
      <span className={labelClass}>{label}</span>
      <strong className={`${tone === "accent" ? "text-[#f3d09b]" : "text-[#f5f7f6]"} truncate text-lg font-black leading-none tabular-nums`}>
        {value}
      </strong>
    </div>
  );
}

function CompactSpeedReadout({ value }: { value: string }) {
  return (
    <div className="flex min-w-0 items-baseline py-1.5">
      <strong className="truncate text-sm font-black leading-none tabular-nums text-[#f5f7f6]">{value}</strong>
    </div>
  );
}


function SteeringWheelIcon({ rotation }: { rotation: number }) {
  return (
    <svg
      className="h-[44px] w-[44px] overflow-visible transition-transform duration-100 ease-out"
      style={{ transform: `rotate(${rotation}deg)` }}
      viewBox="0 0 64 64"
      role="img"
      aria-label="Steering wheel position"
    >
      <circle className="fill-none stroke-[#f3d09b] [stroke-width:5.5]" cx="32" cy="32" r="25" />
      <circle className="fill-[#101312] stroke-[#f3d09b] [stroke-width:4]" cx="32" cy="32" r="7" />
      <path className="fill-none stroke-[#f3d09b] [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:5.5]" d="M32 39 L32 57" />
      <path className="fill-none stroke-[#f3d09b] [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:5.5]" d="M26 34 L11 45" />
      <path className="fill-none stroke-[#f3d09b] [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:5.5]" d="M38 34 L53 45" />
      <path className="fill-none stroke-[#101312] [stroke-linecap:round] [stroke-width:6]" d="M24 8 L40 8" />
      <path className="fill-none stroke-[#f3d09b] [stroke-linecap:round] [stroke-width:3.5]" d="M29 7 L35 7" />
    </svg>
  );
}


function InputBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <span className={labelClass}>{label}</span>
        <span className="text-xs font-bold tabular-nums text-[#f5f7f6]">{value.toFixed(0)}%</span>
      </div>
      <Progress className="[&_[data-slot=progress-track]]:h-2 [&_[data-slot=progress-track]]:border [&_[data-slot=progress-track]]:border-border [&_[data-slot=progress-track]]:bg-background/70 [&_[data-slot=progress-indicator]]:bg-[var(--bar-color)] [&_[data-slot=progress-indicator]]:transition-[width] [&_[data-slot=progress-indicator]]:duration-100" value={value} style={{ "--bar-color": color } as React.CSSProperties} />
    </div>
  );
}

function PowertrainStat({
  label,
  value,
  ratio,
  color
}: {
  label: string;
  value: string;
  ratio: number;
  color: string;
}) {
  return (
    <div className="grid min-w-0 gap-1.5 px-1 py-1">
      <span className="truncate text-[10px] font-black uppercase leading-none text-[#9ba6a1]">{label}</span>
      <strong className="truncate text-sm font-black leading-none tabular-nums text-[#f5f7f6]">{value}</strong>
      <ProgressBar value={ratio * 100} color={color} compact />
    </div>
  );
}

function ProgressBar({ value, color, compact = false }: { value: number; color: string; compact?: boolean }) {
  return (
    <div className={`${compact ? "h-1.5" : "h-2.5"} overflow-hidden rounded-full border border-white/10 bg-[#101312]`}>
      <div
        className="h-full rounded-full transition-[width] duration-100"
        style={{ width: `${clampNumber(value, 0, 100)}%`, backgroundColor: color }}
      />
    </div>
  );
}
