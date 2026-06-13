import * as React from "react";
import { estimatePowerBand, rpmPercent, type PowerBandBin, type PowerBandEstimate } from "@/features/analysis/powerBandAnalysis";
import { formatValue } from "@/lib/format";
import { clampNumber } from "@/lib/math";
import type { Telemetry } from "@/types/telemetry";

type CurvePoint = {
  x: number;
  y: number;
};

const POWER_COLOR = "#63da97";
const TORQUE_COLOR = "#f3d09b";
const BOOST_COLOR = "#59a7ff";

export function PowertrainAnalysisPanel({ samples, telemetry }: { samples: Telemetry[]; telemetry: Telemetry | null }) {
  const estimate = React.useMemo(() => estimatePowerBand(samples), [samples]);
  const maxRpm = Math.max(telemetry?.EngineMaxRpm ?? 0, estimate?.bins.at(-1)?.rpm ?? 0, 1);

  return (
    <div className="grid h-full min-h-0 min-w-0 gap-4 overflow-auto xl:grid-cols-[minmax(0,1fr)_320px]">
      <section className="grid min-h-[520px] min-w-0 content-start gap-4 rounded-lg border border-white/[0.08] bg-[#171717] p-4">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 border-b border-white/[0.07] pb-4">
          <div className="min-w-0">
            <h2 className="text-base font-black leading-tight text-[#f5f7f6]">Powertrain analysis</h2>
            <p className="mt-1 text-sm leading-5 text-[#9ba6a1]">
              Estimated from clean wide-open-throttle telemetry samples.
            </p>
          </div>
          <ConfidenceBadge estimate={estimate} />
        </div>

        {estimate ? (
          <>
            <PowerCurveChart estimate={estimate} maxRpm={maxRpm} currentRpm={telemetry?.CurrentEngineRpm ?? null} />
            <div className="grid gap-3 md:grid-cols-4">
              <AnalysisMetric label="Peak power" value={`${formatValue(estimate.peakPowerHp, { precision: 0 })} hp`} detail={`${formatValue(estimate.peakPowerRpm, { precision: 0 })} rpm`} color={POWER_COLOR} />
              <AnalysisMetric label="Peak torque" value={`${formatValue(estimate.peakTorqueNm, { precision: 0 })} Nm`} detail={`${formatValue(estimate.peakTorqueRpm, { precision: 0 })} rpm`} color={TORQUE_COLOR} />
              <AnalysisMetric label="Usable band" value={`${formatValue(estimate.bandStartRpm, { precision: 0 })}-${formatValue(estimate.bandEndRpm, { precision: 0 })}`} detail={`${estimate.thresholdPercent}%+ peak power`} color={POWER_COLOR} />
              <AnalysisMetric label="Clean samples" value={formatValue(estimate.sampleCount, { precision: 0 })} detail={`${estimate.bins.length} RPM bins`} color="#9ba6a1" />
            </div>
          </>
        ) : (
          <EmptyAnalysis samples={samples} />
        )}
      </section>

      <section className="grid min-w-0 content-start gap-3 rounded-lg border border-white/[0.08] bg-[#171717] p-4">
        <h3 className="text-sm font-black leading-tight text-[#f5f7f6]">Capture targets</h3>
        <CaptureTarget label="Throttle" value="80%+" />
        <CaptureTarget label="Brake" value="0-5%" />
        <CaptureTarget label="Gear" value="2nd+" />
        <CaptureTarget label="Wheelspin" value="Low" />
        <div className="mt-2 border-t border-white/[0.07] pt-3 text-xs leading-5 text-[#9ba6a1]">
          The curve gets cleaner from a steady pull through the rev range. Heavy slip, clutch use, braking, and low throttle samples are filtered out.
        </div>
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
    <div className="grid min-w-0 gap-3">
      <svg className="h-[min(58vh,470px)] min-h-[340px] w-full overflow-visible" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Power torque and boost curve by RPM">
        <rect x={plot.left} y={plot.top} width={plotWidth} height={plotHeight} rx="8" fill="#101312" stroke="rgba(255,255,255,0.08)" />
        <rect x={bandStartX} y={plot.top} width={Math.max(2, bandEndX - bandStartX)} height={plotHeight} fill={POWER_COLOR} opacity="0.08" />
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
        <polyline points={powerLine} fill="none" stroke={POWER_COLOR} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        <polyline points={torqueLine} fill="none" stroke={TORQUE_COLOR} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        <polyline points={boostLine} fill="none" stroke={BOOST_COLOR} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" vectorEffect="non-scaling-stroke" />
        {estimate.bins.map((bin) => {
          const x = plot.left + (rpmPercent(bin.rpm, maxRpm) / 100) * plotWidth;
          const y = valueToY(bin.avgPowerHp, maxPower, plot.top, plotHeight);
          return <circle key={bin.rpm} cx={x} cy={y} r={Math.max(2.5, Math.min(6, bin.sampleCount / 2))} fill={POWER_COLOR} opacity="0.72" />;
        })}
        {currentX !== null ? (
          <line x1={currentX} x2={currentX} y1={plot.top - 8} y2={plot.top + plotHeight + 8} stroke="#f5f7f6" strokeWidth="1.5" strokeDasharray="6 6" opacity="0.75" />
        ) : null}
        <text x={plot.left} y="15" className="fill-[#9ba6a1] text-[10px] font-black uppercase tracking-wide">Power / torque / boost</text>
        <text x={plot.left} y={height - 5} className="fill-[#9ba6a1] text-[10px] font-black uppercase tracking-wide">RPM</text>
      </svg>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[10px] font-black uppercase tracking-wide text-[#9ba6a1]">
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

function ConfidenceBadge({ estimate }: { estimate: PowerBandEstimate | null }) {
  const label = estimate?.confidence ?? "No curve";
  const className = estimate?.confidence === "High"
    ? "border-[#63da97]/40 bg-[#63da97]/10 text-[#63da97]"
    : estimate?.confidence === "Medium"
      ? "border-[#f3d09b]/40 bg-[#f3d09b]/10 text-[#f3d09b]"
      : "border-white/10 bg-white/[0.04] text-[#9ba6a1]";

  return (
    <span className={`rounded-md border px-2.5 py-1 text-xs font-black uppercase leading-none tracking-wide ${className}`}>
      {label}
    </span>
  );
}

function AnalysisMetric({ label, value, detail, color }: { label: string; value: string; detail: string; color: string }) {
  return (
    <div className="grid min-w-0 gap-2 rounded-md bg-white/[0.025] p-3">
      <span className="text-[10px] font-black uppercase leading-none tracking-wide text-[#9ba6a1]">{label}</span>
      <strong className="truncate text-xl font-black leading-none tabular-nums text-[#f5f7f6]">{value}</strong>
      <span className="truncate text-xs font-bold tabular-nums" style={{ color }}>{detail}</span>
    </div>
  );
}

function CaptureTarget({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md bg-white/[0.025] px-3 py-2">
      <span className="text-xs font-bold text-[#9ba6a1]">{label}</span>
      <strong className="text-xs font-black tabular-nums text-[#f5f7f6]">{value}</strong>
    </div>
  );
}

function EmptyAnalysis({ samples }: { samples: Telemetry[] }) {
  return (
    <div className="grid min-h-[340px] place-items-center rounded-md border border-dashed border-white/[0.12] bg-[#101312] p-6 text-center">
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
