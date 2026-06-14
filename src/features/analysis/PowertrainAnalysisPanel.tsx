import * as React from "react";
import {
  estimatePowerBand,
  rpmPercent,
  type PowerBandBin
} from "@/features/analysis/powerBandAnalysis";
import { formatValue } from "@/lib/format";
import { clampNumber } from "@/lib/math";
import type { PowerBandEstimate, Telemetry } from "@/types/telemetry";

type CurvePoint = {
  x: number;
  y: number;
};

const POWER_COLOR = "#63da97";
const TORQUE_COLOR = "#f3d09b";
const BOOST_COLOR = "#59a7ff";

export function PowertrainAnalysisPanel({
  samples,
  telemetry,
  powerBand
}: {
  samples: Telemetry[];
  telemetry: Telemetry | null;
  powerBand?: PowerBandEstimate | null;
}) {
  const localEstimate = React.useMemo(() => estimatePowerBand(samples), [samples]);
  const estimate = powerBand ?? localEstimate;
  const maxRpm = Math.max(telemetry?.EngineMaxRpm ?? 0, estimate?.bins.at(-1)?.rpm ?? 0, 1);

  return (
    <div className="h-full min-h-0 min-w-0 overflow-auto">
      <section className="grid min-w-0 content-start gap-3 rounded-lg border border-white/[0.08] bg-[#171717] p-3">
        {estimate ? (
          <PowerCurveChart estimate={estimate} maxRpm={maxRpm} currentRpm={telemetry?.CurrentEngineRpm ?? null} />
        ) : (
          <EmptyAnalysis samples={samples} />
        )}
      </section>
    </div>
  );
}

function PowerCurveChart({ estimate, maxRpm, currentRpm }: { estimate: PowerBandEstimate; maxRpm: number; currentRpm: number | null }) {
  const width = 760;
  const height = 390;
  const plot = { left: 54, top: 24, right: 24, bottom: 48 };
  const plotWidth = width - plot.left - plot.right;
  const plotHeight = height - plot.top - plot.bottom;
  const maxPower = niceMax(Math.max(...estimate.bins.map((bin) => bin.avgPowerHp)));
  const maxTorque = niceMax(Math.max(...estimate.bins.map((bin) => bin.avgTorqueNm)));
  const maxBoost = Math.max(1, Math.ceil(Math.max(...estimate.bins.map((bin) => bin.avgBoost)) / 5) * 5);
  const currentX = currentRpm === null ? null : plot.left + (rpmPercent(currentRpm, maxRpm) / 100) * plotWidth;

  const powerLine = buildPolyline(estimate.bins, (bin) => bin.avgPowerHp, maxPower, maxRpm, plot, plotWidth, plotHeight);
  const torqueLine = buildPolyline(estimate.bins, (bin) => bin.avgTorqueNm, maxTorque, maxRpm, plot, plotWidth, plotHeight);
  const boostLine = buildPolyline(estimate.bins, (bin) => bin.avgBoost, maxBoost, maxRpm, plot, plotWidth, plotHeight);
  const bandStartX = plot.left + (rpmPercent(estimate.bandStartRpm, maxRpm) / 100) * plotWidth;
  const bandEndX = plot.left + (rpmPercent(estimate.bandEndRpm, maxRpm) / 100) * plotWidth;
  const rpmTicks = buildRpmTicks(maxRpm);

  return (
    <div className="grid min-w-0 gap-2">
      <svg className="h-[min(44vh,360px)] min-h-[240px] w-full overflow-visible" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Power torque and boost curve by RPM">
        <rect x={plot.left} y={plot.top} width={plotWidth} height={plotHeight} rx="8" fill="#101312" stroke="rgba(255,255,255,0.08)" />
        <rect x={bandStartX} y={plot.top} width={Math.max(2, bandEndX - bandStartX)} height={plotHeight} fill={POWER_COLOR} opacity="0.06" />
        {[0.25, 0.5, 0.75].map((fraction) => (
          <line key={fraction} x1={plot.left} x2={plot.left + plotWidth} y1={plot.top + plotHeight * fraction} y2={plot.top + plotHeight * fraction} stroke="rgba(245,247,246,0.12)" strokeDasharray="4 6" />
        ))}
        {rpmTicks.map((tick) => {
          const x = plot.left + (tick.percent / 100) * plotWidth;
          return (
            <g key={tick.rpm}>
              <line x1={x} x2={x} y1={plot.top} y2={plot.top + plotHeight} stroke={tick.major ? "rgba(245,247,246,0.16)" : "rgba(245,247,246,0.07)"} />
              {tick.major ? (
                <text x={x} y={height - 19} textAnchor="middle" className="fill-[#9ba6a1] text-[11px] font-black tabular-nums">{formatValue(tick.rpm, { precision: 0 })}</text>
              ) : null}
            </g>
          );
        })}
        <polyline points={powerLine} fill="none" stroke={POWER_COLOR} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        <polyline points={torqueLine} fill="none" stroke={TORQUE_COLOR} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        <polyline points={boostLine} fill="none" stroke={BOOST_COLOR} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" vectorEffect="non-scaling-stroke" />
        {estimate.bins.map((bin) => {
          const x = plot.left + (rpmPercent(bin.rpm, maxRpm) / 100) * plotWidth;
          const y = valueToY(bin.avgPowerHp, maxPower, plot.top, plotHeight);
          return <circle key={bin.rpm} cx={x} cy={y} r={Math.max(2, Math.min(4.5, bin.sampleCount / 2.5))} fill={POWER_COLOR} opacity="0.72" />;
        })}
        {currentX !== null ? (
          <line x1={currentX} x2={currentX} y1={plot.top - 8} y2={plot.top + plotHeight + 8} stroke="#f5f7f6" strokeWidth="1.5" strokeDasharray="6 6" opacity="0.75" />
        ) : null}
        <text x={plot.left} y="15" className="fill-[#9ba6a1] text-[10px] font-black uppercase tracking-wide">Power / torque / boost</text>
        <text x={plot.left} y={height - 5} className="fill-[#9ba6a1] text-[10px] font-black uppercase tracking-wide">RPM</text>
      </svg>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] font-black uppercase tracking-wide text-[#9ba6a1]">
        <LegendText color={POWER_COLOR} label={`Power, max ${formatValue(maxPower, { precision: 0 })} hp`} />
        <LegendText color={TORQUE_COLOR} label={`Torque, max ${formatValue(maxTorque, { precision: 0 })} Nm`} />
        <LegendText color={BOOST_COLOR} label={`Boost, max ${formatValue(maxBoost, { precision: 0 })} psi`} />
      </div>
    </div>
  );
}

function buildPolyline(
  bins: PowerBandBin[],
  valueFromBin: (bin: PowerBandBin) => number,
  maxValue: number,
  maxRpm: number,
  plot: { left: number; top: number },
  plotWidth: number,
  plotHeight: number
) {
  return bins
    .map((bin): CurvePoint => ({
      x: plot.left + (rpmPercent(bin.rpm, maxRpm) / 100) * plotWidth,
      y: valueToY(valueFromBin(bin), maxValue, plot.top, plotHeight)
    }))
    .map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(" ");
}

function valueToY(value: number, maxValue: number, top: number, height: number) {
  return top + (1 - clampNumber(value / Math.max(1, maxValue), 0, 1)) * height;
}

function niceMax(value: number) {
  if (value <= 100) return 100;
  if (value <= 250) return Math.ceil(value / 50) * 50;
  if (value <= 1000) return Math.ceil(value / 100) * 100;
  return Math.ceil(value / 250) * 250;
}

function buildRpmTicks(maxRpm: number) {
  const safeMaxRpm = Math.max(1, maxRpm);
  const step = safeMaxRpm <= 7000 ? 1000 : 2000;
  const ticks: { rpm: number; percent: number; major: boolean }[] = [];

  for (let rpm = 0; rpm < safeMaxRpm; rpm += step / 2) {
    ticks.push({ rpm, percent: rpmPercent(rpm, safeMaxRpm), major: rpm % step === 0 });
  }

  ticks.push({ rpm: safeMaxRpm, percent: 100, major: true });
  return ticks;
}

function EmptyAnalysis({ samples }: { samples: Telemetry[] }) {
  return (
    <div className="grid min-h-[240px] place-items-center rounded-md border border-dashed border-white/[0.12] bg-[#101312] p-6 text-center">
      <div className="max-w-md">
        <strong className="block text-base font-black text-[#f5f7f6]">No clean power curve yet</strong>
        <p className="mt-2 text-sm leading-6 text-[#9ba6a1]">
          Recorded {formatValue(samples.length, { precision: 0 })} total samples. Make a clean wide-open-throttle pull with low wheelspin to populate the curve.
        </p>
      </div>
    </div>
  );
}

function LegendText({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-1.5 w-5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
