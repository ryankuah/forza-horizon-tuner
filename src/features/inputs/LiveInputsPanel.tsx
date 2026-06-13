import * as React from "react";
import { Progress } from "@/components/ui/progress";
import { estimatePowerBand, type PowerBandEstimate } from "@/features/analysis/powerBandAnalysis";
import { formatGear, formatSignedPercent, formatValue } from "@/lib/format";
import { clampNumber, clampPercent } from "@/lib/math";
import type { Telemetry } from "@/types/telemetry";

const labelClass = "text-xs font-semibold text-muted-foreground";

type RpmTick = {
  rpm: number;
  percent: number;
  major: boolean;
};

export function LiveInputsPanel({ telemetry, samples }: { telemetry: Telemetry | null; samples: Telemetry[] }) {
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
  const powerBand = React.useMemo(() => estimatePowerBand(samples), [samples]);

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
        <RpmPowerBandDisplay
          telemetry={telemetry}
          estimate={powerBand}
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

function RpmPowerBandDisplay({
  telemetry,
  estimate,
  maxRpm,
  rpmPercent,
  speed
}: {
  telemetry: Telemetry | null;
  estimate: PowerBandEstimate | null;
  maxRpm: number;
  rpmPercent: number;
  speed: string;
}) {
  const rpm = telemetry?.CurrentEngineRpm ?? 0;
  const idleRpm = telemetry?.EngineIdleRpm ?? 0;
  const idlePercent = clampNumber((idleRpm / maxRpm) * 100, 0, 100);
  const bandStartPercent = estimate ? clampNumber((estimate.bandStartRpm / maxRpm) * 100, 0, 100) : 0;
  const bandEndPercent = estimate ? clampNumber((estimate.bandEndRpm / maxRpm) * 100, 0, 100) : 0;
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
        {estimate ? (
          <>
            <span
              className="absolute top-1 text-[9px] font-black leading-none tabular-nums text-[#63da97]"
              style={{ left: `clamp(0px, calc(${bandStartPercent}% - 22px), calc(100% - 44px))` }}
            >
              {formatValue(estimate.bandStartRpm, { precision: 0 })}
            </span>
            <span
              className="absolute top-1 text-right text-[9px] font-black leading-none tabular-nums text-[#63da97]"
              style={{ left: `clamp(0px, calc(${bandEndPercent}% - 22px), calc(100% - 44px))` }}
            >
              {formatValue(estimate.bandEndRpm, { precision: 0 })}
            </span>
            <div className="absolute inset-x-2 bottom-1.5 h-3.5">
              <div
                className="absolute h-full rounded-sm bg-[#63da97]/28 ring-1 ring-[#63da97]/45"
                style={{ left: `${bandStartPercent}%`, width: `${Math.max(1, bandEndPercent - bandStartPercent)}%` }}
              />
            </div>
          </>
        ) : null}
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
        <span className="truncate text-center">Peak {estimate ? formatValue(estimate.peakPowerRpm, { precision: 0 }) : "0"}</span>
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
