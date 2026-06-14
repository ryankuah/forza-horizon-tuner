import * as React from "react";
import { formatValue } from "@/lib/format";
import { clampNumber } from "@/lib/math";
import type { PathSample, Telemetry } from "@/types/telemetry";

export type TraceSeries = {
  label: string;
  color: string;
  value: (sample: Telemetry, previous?: Telemetry) => number;
  format?: (value: number) => string;
  domain?: TraceDomain;
};

export type TraceDomain = "auto" | "zero-max" | "symmetric-zero" | readonly [number, number];

export type SectionMetric = {
  label: string;
  value: string;
  detail?: string;
};

export function SectionMetricGrid({ metrics }: { metrics: SectionMetric[] }) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <div key={metric.label} className="grid min-h-[58px] content-between rounded-md border border-white/[0.07] bg-white/[0.025] px-2.5 py-1.5">
          <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[#8e9994]">{metric.label}</span>
          <strong className="mt-0.5 text-base font-black tabular-nums text-[#f5f7f6]">{metric.value}</strong>
          {metric.detail ? <span className="mt-0.5 text-[11px] leading-3 text-[#9ba6a1]">{metric.detail}</span> : null}
        </div>
      ))}
    </div>
  );
}

export function SectionTraceChart({
  title,
  samples,
  series,
  showPhases = false,
  showGearChanges = false,
  scale = "independent",
  domain = "auto",
  hoverProgress = null,
  onHoverProgress
}: {
  title: string;
  samples: PathSample[];
  series: TraceSeries[];
  showPhases?: boolean;
  showGearChanges?: boolean;
  scale?: "independent" | "shared";
  domain?: TraceDomain;
  hoverProgress?: number | null;
  onHoverProgress?: (progress: number | null) => void;
}) {
  const width = 920;
  const height = 220;
  const plot = { left: 52, top: 24, right: 18, bottom: 26 };
  const plotWidth = width - plot.left - plot.right;
  const plotHeight = height - plot.top - plot.bottom;
  const telemetrySamples = samples.map((sample) => sample.telemetry).filter((sample): sample is Telemetry => Boolean(sample));
  const distances = cumulativePathDistances(samples);
  const totalDistance = Math.max(1, distances[distances.length - 1] ?? 0);
  const traces = buildTraceLines(samples, distances, totalDistance, series, plot, plotWidth, plotHeight, scale, domain);
  const gearMarkers = showGearChanges ? buildGearMarkers(samples, distances, totalDistance, plot.left, plotWidth) : [];
  const hoverX = hoverProgress === null ? null : plot.left + clampNumber(hoverProgress, 0, 1) * plotWidth;

  if (samples.length < 2 || telemetrySamples.length < 2) {
    return (
      <div className="grid min-h-[130px] place-items-center rounded-md border border-dashed border-white/[0.12] bg-[#101312] p-4 text-center">
        <div>
          <strong className="block text-sm font-black text-[#f5f7f6]">{title}</strong>
          <p className="m-0 mt-1 text-sm leading-5 text-[#9ba6a1]">Not enough telemetry samples for this trace.</p>
        </div>
      </div>
    );
  }

  function handlePointerMove(event: React.PointerEvent<SVGSVGElement>) {
    if (!onHoverProgress) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const svgX = ((event.clientX - rect.left) / Math.max(1, rect.width)) * width;
    onHoverProgress(clampNumber((svgX - plot.left) / plotWidth, 0, 1));
  }

  return (
    <div className="grid min-w-0 content-start gap-1 self-start">
      <svg
        className="h-[218px] w-full overflow-visible"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${title} telemetry trace over distance`}
        onPointerMove={handlePointerMove}
        onPointerLeave={() => onHoverProgress?.(null)}
      >
        <rect x={plot.left} y={plot.top} width={plotWidth} height={plotHeight} rx="6" fill="#0d0f0e" stroke="rgba(255,255,255,0.06)" />
        {showPhases ? <PhaseBands plot={plot} plotWidth={plotWidth} plotHeight={plotHeight} /> : null}
        {[0.25, 0.5, 0.75].map((fraction) => (
          <line key={fraction} x1={plot.left} x2={plot.left + plotWidth} y1={plot.top + plotHeight * fraction} y2={plot.top + plotHeight * fraction} stroke="rgba(245,247,246,0.12)" strokeDasharray="4 6" />
        ))}
        {[0.2, 0.4, 0.6, 0.8].map((fraction) => (
          <line key={fraction} x1={plot.left + plotWidth * fraction} x2={plot.left + plotWidth * fraction} y1={plot.top} y2={plot.top + plotHeight} stroke="rgba(245,247,246,0.07)" />
        ))}
        {traces.map((trace) => (
          <polyline
            key={trace.label}
            points={trace.points}
            fill="none"
            stroke={trace.color}
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.94"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {hoverX !== null ? (
          <line x1={hoverX} x2={hoverX} y1={plot.top - 5} y2={plot.top + plotHeight + 5} stroke="#f5f7f6" strokeWidth="1.5" strokeDasharray="5 5" opacity="0.8" />
        ) : null}
        {gearMarkers.map((marker) => (
          <g key={`${marker.x}-${marker.label}`}>
            <line x1={marker.x} x2={marker.x} y1={plot.top - 6} y2={plot.top + plotHeight + 6} stroke="#f5f7f6" strokeWidth="1.2" strokeDasharray="5 5" opacity="0.62" />
            <text x={marker.x + 5} y={plot.top + 15} className="fill-[#f5f7f6] text-[11px] font-black tabular-nums">{marker.label}</text>
          </g>
        ))}
        <text x={plot.left} y="17" className="fill-[#b5bfb9] text-[12px] font-black uppercase tracking-wide">{title}</text>
        <text x={plot.left} y={height - 7} className="fill-[#b5bfb9] text-[11px] font-black uppercase tracking-wide">Distance</text>
        <text x={plot.left + plotWidth} y={height - 7} textAnchor="end" className="fill-[#b5bfb9] text-[11px] font-black uppercase tracking-wide">{formatValue(totalDistance, { precision: 0 })} m</text>
      </svg>

      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] font-black uppercase leading-4 tracking-wide text-[#aeb8b3]">
        {traces.map((trace) => (
          <span key={trace.label} className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-5 rounded-full" style={{ backgroundColor: trace.color }} />
            {trace.label}: {trace.minLabel} to {trace.maxLabel}
          </span>
        ))}
      </div>
    </div>
  );
}

function PhaseBands({
  plot,
  plotWidth,
  plotHeight
}: {
  plot: { left: number; top: number };
  plotWidth: number;
  plotHeight: number;
}) {
  const phases = [
    { label: "Entry", start: 0, end: 0.34, color: "#e46645" },
    { label: "Mid", start: 0.34, end: 0.67, color: "#59a7ff" },
    { label: "Exit", start: 0.67, end: 1, color: "#63da97" }
  ];

  return (
    <>
      {phases.map((phase) => {
        const x = plot.left + plotWidth * phase.start;
        const width = plotWidth * (phase.end - phase.start);
        return (
          <g key={phase.label}>
            <rect x={x} y={plot.top} width={width} height={plotHeight} fill={phase.color} opacity="0.055" />
            <text x={x + 7} y={plot.top + 16} className="fill-[#b5bfb9] text-[10px] font-black uppercase tracking-wide">{phase.label}</text>
          </g>
        );
      })}
    </>
  );
}

function buildTraceLines(
  samples: PathSample[],
  distances: number[],
  totalDistance: number,
  series: TraceSeries[],
  plot: { left: number; top: number },
  plotWidth: number,
  plotHeight: number,
  scale: "independent" | "shared",
  chartDomain: TraceDomain
) {
  const telemetrySamples = samples.map((sample) => sample.telemetry);
  const seriesValues = series.map((trace) => telemetrySamples.map((sample, index) => sample ? trace.value(sample, telemetrySamples[index - 1] ?? undefined) : 0));
  const sharedFiniteValues = scale === "shared" ? seriesValues.flat().filter(Number.isFinite) : [];
  const sharedDomain = scale === "shared" ? resolveDomain(sharedFiniteValues, chartDomain) : null;

  return series.map((trace, seriesIndex) => {
    const values = seriesValues[seriesIndex] ?? [];
    const [minValue, maxValue] = sharedDomain ?? resolveDomain(values, trace.domain ?? chartDomain);
    const range = Math.max(0.0001, maxValue - minValue);
    const points = values.map((value, index) => {
      const x = plot.left + ((distances[index] ?? 0) / totalDistance) * plotWidth;
      const y = plot.top + (1 - clampNumber((value - minValue) / range, 0, 1)) * plotHeight;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");

    return {
      label: trace.label,
      color: trace.color,
      points,
      minLabel: trace.format ? trace.format(minValue) : formatValue(minValue, { precision: 2 }),
      maxLabel: trace.format ? trace.format(maxValue) : formatValue(maxValue, { precision: 2 })
    };
  });
}

function resolveDomain(values: number[], domain: TraceDomain): [number, number] {
  if (Array.isArray(domain)) return normalizeDomain(domain[0], domain[1]);

  const finiteValues = values.filter(Number.isFinite);
  if (finiteValues.length === 0) return [0, 1];

  const dataMin = Math.min(...finiteValues);
  const dataMax = Math.max(...finiteValues);

  if (domain === "zero-max") {
    return [0, niceUpperBound(Math.max(0, dataMax))];
  }

  if (domain === "symmetric-zero") {
    const maxAbs = niceUpperBound(Math.max(Math.abs(dataMin), Math.abs(dataMax)));
    return [-maxAbs, maxAbs];
  }

  const range = dataMax - dataMin;
  if (range <= 0.0001) {
    const padding = Math.max(0.5, Math.abs(dataMax) * 0.05);
    return normalizeDomain(dataMin - padding, dataMax + padding);
  }

  const padding = range * 0.08;
  return normalizeDomain(dataMin - padding, dataMax + padding);
}

function normalizeDomain(minValue: number, maxValue: number): [number, number] {
  if (!Number.isFinite(minValue) || !Number.isFinite(maxValue)) return [0, 1];
  if (maxValue > minValue) return [minValue, maxValue];
  const padding = Math.max(0.5, Math.abs(maxValue) * 0.05);
  return [minValue - padding, maxValue + padding];
}

function niceUpperBound(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 1;

  const exponent = 10 ** Math.floor(Math.log10(value));
  const normalized = value / exponent;
  const niceNormalized = normalized <= 1
    ? 1
    : normalized <= 2
      ? 2
      : normalized <= 5
        ? 5
        : 10;
  return niceNormalized * exponent;
}

function buildGearMarkers(samples: PathSample[], distances: number[], totalDistance: number, left: number, width: number) {
  const markers: { x: number; label: string }[] = [];
  let previousGear: number | null = null;
  let lastMarkerX = -Infinity;

  samples.forEach((sample, index) => {
    const gear = sample.telemetry?.Gear;
    if (gear === undefined || !Number.isFinite(gear)) return;
    if (previousGear !== null && gear !== previousGear) {
      const x = left + ((distances[index] ?? 0) / totalDistance) * width;
      if (x - lastMarkerX > 18) {
        markers.push({ x, label: gear === 0 ? "N" : gear === 1 ? "R" : String(gear) });
        lastMarkerX = x;
      }
    }
    previousGear = gear;
  });

  return markers;
}

export function cumulativePathDistances(path: PathSample[]) {
  const distances = new Array<number>(path.length).fill(0);
  for (let index = 1; index < path.length; index += 1) {
    distances[index] = distances[index - 1] + Math.hypot(path[index].x - path[index - 1].x, path[index].z - path[index - 1].z);
  }
  return distances;
}

export function pathDistanceMeters(path: PathSample[]) {
  const distances = cumulativePathDistances(path);
  return distances[distances.length - 1] ?? 0;
}
