import * as React from "react";
import { Activity, Gauge, LineChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatGear, formatValue } from "@/lib/format";
import { CarDataPanel } from "./CarVisuals";
import type { DocTelemetryField, Telemetry, TelemetryFieldName } from "@/types/telemetry";

type TelemetrySidePanelMode = "live" | "graph";
type SeriesPoint = { index: number; value: number };
type GearShiftBadge = {
  index: number;
  x: number;
  y: number;
  badgeX: number;
  width: number;
  label: string;
};
type SeriesValue = TelemetryFieldName;
type TelemetrySeriesDefinition = {
  id: string;
  label: string;
  value: SeriesValue;
  color: string;
  suffix?: string;
  precision?: number;
};
type TelemetryChartGroup = {
  title: string;
  series: TelemetrySeriesDefinition[];
};
type TelemetryGraphSection = {
  title: string;
  comment?: string;
  groups?: TelemetryChartGroup[];
  fields?: DocTelemetryField[];
};

const AXLE_COLORS = {
  left: "#63da97",
  right: "#76a9ff"
} as const;
const GRAPH_WINDOW_SIZE = 3000;
const GRAPH_PLAYHEAD_RATIO = 0.75;

const graphTelemetrySections: TelemetryGraphSection[] = [
  {
    title: "Tire temperature",
    groups: [
      {
        title: "Front tires",
        series: [
          { id: "TireTempFrontLeft", label: "Front left", value: "TireTempFrontLeft", color: AXLE_COLORS.left, precision: 1 },
          { id: "TireTempFrontRight", label: "Front right", value: "TireTempFrontRight", color: AXLE_COLORS.right, precision: 1 }
        ]
      },
      {
        title: "Rear tires",
        series: [
          { id: "TireTempRearLeft", label: "Rear left", value: "TireTempRearLeft", color: AXLE_COLORS.left, precision: 1 },
          { id: "TireTempRearRight", label: "Rear right", value: "TireTempRearRight", color: AXLE_COLORS.right, precision: 1 }
        ]
      }
    ],
    fields: [
      { name: "tempBalance", label: "Front/rear temp balance", precision: 1 }
    ]
  },
  {
    title: "Suspension",
    groups: [
      {
        title: "Front compression",
        series: [
          { id: "NormalizedSuspensionTravelFrontLeft", label: "Front left", value: "NormalizedSuspensionTravelFrontLeft", color: AXLE_COLORS.left, precision: 3 },
          { id: "NormalizedSuspensionTravelFrontRight", label: "Front right", value: "NormalizedSuspensionTravelFrontRight", color: AXLE_COLORS.right, precision: 3 }
        ]
      },
      {
        title: "Rear compression",
        series: [
          { id: "NormalizedSuspensionTravelRearLeft", label: "Rear left", value: "NormalizedSuspensionTravelRearLeft", color: AXLE_COLORS.left, precision: 3 },
          { id: "NormalizedSuspensionTravelRearRight", label: "Rear right", value: "NormalizedSuspensionTravelRearRight", color: AXLE_COLORS.right, precision: 3 }
        ]
      }
    ]
  },
  {
    title: "Tire slip",
    groups: [
      {
        title: "Front combined slip",
        series: [
          { id: "TireCombinedSlipFrontLeft", label: "Front left", value: "TireCombinedSlipFrontLeft", color: AXLE_COLORS.left, precision: 3 },
          { id: "TireCombinedSlipFrontRight", label: "Front right", value: "TireCombinedSlipFrontRight", color: AXLE_COLORS.right, precision: 3 }
        ]
      },
      {
        title: "Rear combined slip",
        series: [
          { id: "TireCombinedSlipRearLeft", label: "Rear left", value: "TireCombinedSlipRearLeft", color: AXLE_COLORS.left, precision: 3 },
          { id: "TireCombinedSlipRearRight", label: "Rear right", value: "TireCombinedSlipRearRight", color: AXLE_COLORS.right, precision: 3 }
        ]
      },
      {
        title: "Front slip angle",
        series: [
          { id: "TireSlipAngleFrontLeft", label: "Front left", value: "TireSlipAngleFrontLeft", color: AXLE_COLORS.left, precision: 3 },
          { id: "TireSlipAngleFrontRight", label: "Front right", value: "TireSlipAngleFrontRight", color: AXLE_COLORS.right, precision: 3 }
        ]
      },
      {
        title: "Rear slip angle",
        series: [
          { id: "TireSlipAngleRearLeft", label: "Rear left", value: "TireSlipAngleRearLeft", color: AXLE_COLORS.left, precision: 3 },
          { id: "TireSlipAngleRearRight", label: "Rear right", value: "TireSlipAngleRearRight", color: AXLE_COLORS.right, precision: 3 }
        ]
      }
    ],
    fields: [
      { name: "slipBalance", label: "Front/rear slip balance", precision: 3 }
    ]
  },
  {
    title: "Speed and powertrain",
    comment: "Driving speed and engine output.",
    fields: [
      { name: "speedKmh", label: "Speed", suffix: " km/h", precision: 1 },
      { name: "CurrentEngineRpm", label: "Engine RPM", suffix: " rpm" },
      { name: "powerHp", label: "Power", suffix: " hp", precision: 1 },
      { name: "torqueNm", label: "Torque", suffix: " Nm", precision: 1 },
      { name: "Boost", label: "Boost", suffix: " psi", precision: 2 }
    ]
  },
  {
    title: "Load and motion",
    comment: "Acceleration, velocity, and vehicle attitude.",
    fields: [
      { name: "AccelerationX", label: "Acceleration X", precision: 3 },
      { name: "AccelerationY", label: "Acceleration Y", precision: 3 },
      { name: "AccelerationZ", label: "Acceleration Z", precision: 3 },
      { name: "VelocityX", label: "Velocity X", suffix: " m/s", precision: 2 },
      { name: "VelocityY", label: "Velocity Y", suffix: " m/s", precision: 2 },
      { name: "VelocityZ", label: "Velocity Z", suffix: " m/s", precision: 2 },
      { name: "Pitch", label: "Pitch", precision: 3 },
      { name: "Roll", label: "Roll", precision: 3 },
      { name: "Yaw", label: "Yaw", precision: 3 }
    ]
  }
];

export function TelemetrySidePanel({
  telemetry,
  samples,
  sampleOffset,
  currentSampleIndex,
  mode,
  onModeChange,
  showModeToggle = true,
  hoverSampleIndex = null,
  onGraphHoverIndex
}: {
  telemetry: Telemetry | null;
  samples: Telemetry[];
  sampleOffset: number;
  currentSampleIndex: number | null;
  mode: TelemetrySidePanelMode;
  onModeChange: (mode: TelemetrySidePanelMode) => void;
  showModeToggle?: boolean;
  hoverSampleIndex?: number | null;
  onGraphHoverIndex?: (index: number | null) => void;
}) {
  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col gap-3 bg-transparent p-2" aria-label="Telemetry details">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div className="min-w-0">
          <h2 className="truncate text-[0.95rem] font-bold text-[#f5f7f6]">Telemetry</h2>
          <p className="truncate text-xs font-semibold text-[#9ba6a1]">
            {mode === "live" ? "Current packet view" : `${samples.length.toLocaleString()} samples over time`}
          </p>
        </div>
        {showModeToggle ? (
        <div className="flex shrink-0 rounded-lg border border-white/10 bg-white/[0.03] p-0.5" aria-label="Telemetry view">
          <Button
            type="button"
            variant={mode === "live" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 rounded-md px-2 text-xs"
            onClick={() => onModeChange("live")}
            aria-pressed={mode === "live"}
          >
            <Gauge size={14} />
            Live
          </Button>
          <Button
            type="button"
            variant={mode === "graph" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 rounded-md px-2 text-xs"
            onClick={() => onModeChange("graph")}
            aria-pressed={mode === "graph"}
          >
            <LineChart size={14} />
            Graph
          </Button>
        </div>
        ) : null}
      </div>

      <div className="min-h-0 min-w-0 flex-1">
        {mode === "live" ? (
          <CarDataPanel telemetry={telemetry} />
        ) : (
          <TelemetryGraphPanel
            telemetry={telemetry}
            samples={samples}
            sampleOffset={sampleOffset}
            currentSampleIndex={currentSampleIndex}
            hoverSampleIndex={hoverSampleIndex}
            onGraphHoverIndex={onGraphHoverIndex}
          />
        )}
      </div>
    </section>
  );
}

function TelemetryGraphPanel({
  telemetry,
  samples,
  sampleOffset,
  currentSampleIndex,
  hoverSampleIndex,
  onGraphHoverIndex
}: {
  telemetry: Telemetry | null;
  samples: Telemetry[];
  sampleOffset: number;
  currentSampleIndex: number | null;
  hoverSampleIndex: number | null;
  onGraphHoverIndex?: (index: number | null) => void;
}) {
  const graphWindow = React.useMemo(
    () => pinnedGraphWindow(samples, sampleOffset, currentSampleIndex, GRAPH_WINDOW_SIZE),
    [currentSampleIndex, sampleOffset, samples]
  );
  const plottedSamples = samples.length > 0
    ? samples.slice(graphWindow.sliceStart, graphWindow.sliceEnd)
    : telemetry ? [telemetry] : [];
  const plottedSampleOffset = sampleOffset + graphWindow.sliceStart;
  const currentSample = sampleAtAbsoluteIndex(samples, sampleOffset, graphWindow.currentIndex);
  if (plottedSamples.length === 0) {
    return (
      <div className="flex h-full min-h-[240px] items-center justify-center border border-dashed border-white/10 bg-white/[0.02] p-6 text-center">
        <div className="max-w-[260px]">
          <Activity className="mx-auto mb-3 text-[#9ba6a1]" size={22} />
          <p className="text-sm font-bold text-[#f5f7f6]">Waiting for telemetry</p>
          <p className="mt-1 text-xs font-semibold text-[#9ba6a1]">Graphs appear after the first packet is received.</p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full min-h-0">
      <div className="grid min-w-0 gap-5 pr-3">
        {graphTelemetrySections.map((section) => (
          <section key={section.title} className="grid min-w-0 gap-2">
            <div className="flex min-w-0 items-center justify-between gap-3">
              <h3 className="truncate text-xs font-black uppercase text-[#9ba6a1]">{section.title}</h3>
              <span className="shrink-0 text-[10px] font-bold uppercase text-[#66736d]">{sectionCount(section)} graphs</span>
            </div>
            <div className="grid min-w-0 grid-cols-1 gap-2 2xl:grid-cols-2">
              {section.groups?.map((group) => (
                <TelemetryMultiLineChart
                  key={group.title}
                  group={group}
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
              {section.fields?.map((field) => (
                <TelemetrySparkline
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
        ))}
      </div>
    </ScrollArea>
  );
}

function TelemetryMultiLineChart({
  group,
  samples,
  sampleOffset,
  domainStart,
  domainEnd,
  currentSampleIndex,
  hoverSampleIndex,
  currentSample,
  onGraphHoverIndex
}: {
  group: TelemetryChartGroup;
  samples: Telemetry[];
  sampleOffset: number;
  domainStart: number;
  domainEnd: number;
  currentSampleIndex: number | null;
  hoverSampleIndex: number | null;
  currentSample: Telemetry | null;
  onGraphHoverIndex?: (index: number | null) => void;
}) {
  const series = React.useMemo(
    () => group.series.map((definition) => ({
      definition,
      values: buildSeries(samples, definition.value, sampleOffset)
    })),
    [group.series, sampleOffset, samples]
  );
  const range = React.useMemo(
    () => valueRange(series.flatMap((item) => item.values.map((point) => point.value))),
    [series]
  );
  const currentX = indicatorX(currentSampleIndex, domainStart, domainEnd, 320);
  const hoverX = indicatorX(hoverSampleIndex, domainStart, domainEnd, 320);

  function handlePointerMove(event: React.PointerEvent<SVGSVGElement>) {
    if (!onGraphHoverIndex) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const xRatio = clampNumber((event.clientX - rect.left) / Math.max(1, rect.width), 0, 1);
    onGraphHoverIndex(Math.round(domainStart + xRatio * Math.max(1, domainEnd - domainStart)));
  }

  return (
    <div className="grid min-h-[156px] min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] border border-white/[0.07] bg-[#101312] p-2.5">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <span className="min-w-0 truncate text-xs font-black text-[#f5f7f6]">{group.title}</span>
        <span className="shrink-0 text-[10px] font-bold uppercase text-[#66736d]">{samples.length.toLocaleString()} samples</span>
      </div>
      <svg
        className="h-[82px] w-full min-w-0 overflow-visible py-1"
        viewBox="0 0 320 82"
        preserveAspectRatio="none"
        role="img"
        aria-label={`${group.title} over time`}
        onPointerMove={handlePointerMove}
        onPointerLeave={() => onGraphHoverIndex?.(null)}
      >
        <path d="M0 69 H320 M0 41 H320 M0 13 H320" className="stroke-white/[0.06] [stroke-width:1]" />
        {series.map((item) => {
          const path = chartPath(item.values, range.min, range.max, 320, 82, domainStart, domainEnd);
          return path ? (
            <path
              key={item.definition.id}
              d={path}
              fill="none"
              stroke={item.definition.color}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.2"
              vectorEffect="non-scaling-stroke"
            />
          ) : null;
        })}
        {currentX !== null ? (
          <path d={`M${currentX.toFixed(2)} 5 V77`} className="stroke-[#f3d09b]/85 [stroke-width:1.5]" vectorEffect="non-scaling-stroke" />
        ) : null}
        {hoverX !== null ? (
          <path d={`M${hoverX.toFixed(2)} 5 V77`} className="stroke-[#f5f7f6]/80 [stroke-dasharray:4_4] [stroke-width:1.5]" vectorEffect="non-scaling-stroke" />
        ) : null}
      </svg>
      <div className="grid min-w-0 grid-cols-1 gap-x-3 gap-y-1 text-[10px] font-bold sm:grid-cols-2">
        {series.map((item) => {
          const displayValue = currentSample
            ? telemetryValue(currentSample, item.definition.value)
            : item.values.at(-1)?.value;
          return (
            <div key={item.definition.id} className="flex min-w-0 items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1.5 text-[#9ba6a1]">
                <span className="h-1.5 w-3 shrink-0 rounded-full" style={{ backgroundColor: item.definition.color }} />
                <span className="truncate">{item.definition.label}</span>
              </span>
              <span className="shrink-0 tabular-nums text-[#f5f7f6]">
                {formatValue(displayValue, { precision: item.definition.precision })}{item.definition.suffix ?? ""}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TelemetrySparkline({
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
  field: DocTelemetryField;
  samples: Telemetry[];
  sampleOffset: number;
  domainStart: number;
  domainEnd: number;
  currentSampleIndex: number | null;
  hoverSampleIndex: number | null;
  currentSample: Telemetry | null;
  onGraphHoverIndex?: (index: number | null) => void;
}) {
  const values = React.useMemo(() => buildSeries(samples, field.name, sampleOffset), [field.name, sampleOffset, samples]);
  const latest = currentSample ? telemetryValue(currentSample, field.name) : values.at(-1)?.value;
  const range = React.useMemo(() => valueRange(values.map((item) => item.value)), [values]);
  const path = React.useMemo(() => chartPath(values, range.min, range.max, 220, 54, domainStart, domainEnd), [domainEnd, domainStart, range.max, range.min, values]);
  const isFlat = range.max === range.min;
  const currentX = indicatorX(currentSampleIndex, domainStart, domainEnd, 220);
  const hoverX = indicatorX(hoverSampleIndex, domainStart, domainEnd, 220);
  const gearShiftBadges = React.useMemo(
    () => field.name === "CurrentEngineRpm"
      ? buildGearShiftBadges(samples, sampleOffset, range.min, range.max, 220, 54, domainStart, domainEnd)
      : [],
    [domainEnd, domainStart, field.name, range.max, range.min, sampleOffset, samples]
  );

  function handlePointerMove(event: React.PointerEvent<SVGSVGElement>) {
    if (!onGraphHoverIndex) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const xRatio = clampNumber((event.clientX - rect.left) / Math.max(1, rect.width), 0, 1);
    onGraphHoverIndex(Math.round(domainStart + xRatio * Math.max(1, domainEnd - domainStart)));
  }

  return (
    <div className="grid min-h-[86px] min-w-0 grid-rows-[auto_minmax(0,1fr)] border border-white/[0.07] bg-[#101312] p-2">
      <div className="flex min-w-0 items-baseline justify-between gap-2">
        <span className="min-w-0 truncate text-xs font-bold text-[#f5f7f6]">{field.label}</span>
        <span className="shrink-0 text-xs font-black tabular-nums text-[#63da97]">
          {formatValue(latest, { precision: field.precision, boolean: field.boolean })}{field.boolean ? "" : field.suffix ?? ""}
        </span>
      </div>
      <svg
        className="h-[54px] w-full min-w-0 overflow-visible"
        viewBox="0 0 220 54"
        preserveAspectRatio="none"
        role="img"
        aria-label={`${field.label} over time`}
        onPointerMove={handlePointerMove}
        onPointerLeave={() => onGraphHoverIndex?.(null)}
      >
        <path d="M0 45 H220 M0 27 H220 M0 9 H220" className="stroke-white/[0.06] [stroke-width:1]" />
        {path ? (
          <path d={path} className="fill-none stroke-[#63da97] [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:2.4]" vectorEffect="non-scaling-stroke" />
        ) : (
          <path d="M0 27 H220" className="fill-none stroke-[#63da97] [stroke-linecap:round] [stroke-width:2.4]" vectorEffect="non-scaling-stroke" />
        )}
        {isFlat ? <circle cx="110" cy="27" r="2.5" className="fill-[#63da97]" /> : null}
        {gearShiftBadges.map((badge) => (
          <g key={badge.index}>
            <path d={`M${badge.x.toFixed(2)} ${badge.y.toFixed(2)} V50`} className="stroke-[#f3d09b]/45 [stroke-dasharray:2_3] [stroke-width:1]" vectorEffect="non-scaling-stroke" />
            <rect
              x={badge.badgeX}
              y={Math.max(3, badge.y - 16)}
              width={badge.width}
              height="13"
              rx="3"
              className="fill-[#f3d09b] stroke-[#101312] [stroke-width:1]"
              vectorEffect="non-scaling-stroke"
            />
            <text
              x={badge.badgeX + badge.width / 2}
              y={Math.max(13, badge.y - 6)}
              textAnchor="middle"
              className="fill-[#101312] text-[9px] font-black"
            >
              {badge.label}
            </text>
          </g>
        ))}
        {currentX !== null ? (
          <path d={`M${currentX.toFixed(2)} 4 V50`} className="stroke-[#f3d09b]/85 [stroke-width:1.5]" vectorEffect="non-scaling-stroke" />
        ) : null}
        {hoverX !== null ? (
          <path d={`M${hoverX.toFixed(2)} 4 V50`} className="stroke-[#f5f7f6]/80 [stroke-dasharray:4_4] [stroke-width:1.5]" vectorEffect="non-scaling-stroke" />
        ) : null}
      </svg>
      <div className="flex items-center justify-between text-[10px] font-bold tabular-nums text-[#66736d]">
        <span>{formatValue(range.min, { precision: field.precision, boolean: field.boolean })}</span>
        <span>{formatValue(range.max, { precision: field.precision, boolean: field.boolean })}</span>
      </div>
    </div>
  );
}

function buildSeries(samples: Telemetry[], valueSource: SeriesValue, sampleOffset = 0) {
  const maxPoints = 180;
  const stride = Math.max(1, Math.ceil(samples.length / maxPoints));
  const series: SeriesPoint[] = [];

  for (let index = 0; index < samples.length; index += stride) {
    const value = telemetryValue(samples[index], valueSource);
    if (typeof value === "number" && Number.isFinite(value)) series.push({ index: sampleOffset + index, value });
  }

  const lastIndex = samples.length - 1;
  const lastValue = telemetryValue(samples[lastIndex], valueSource);
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

function telemetryValue(sample: Telemetry | undefined, valueSource: SeriesValue) {
  if (!sample) return undefined;
  return sample[valueSource];
}

function valueRange(values: number[]) {
  if (values.length === 0) return { min: 0, max: 0 };
  let min = values[0];
  let max = values[0];
  for (const value of values) {
    if (value < min) min = value;
    if (value > max) max = value;
  }
  return { min, max };
}

function chartPath(series: SeriesPoint[], min: number, max: number, width: number, height: number, domainStart: number, domainEnd: number) {
  if (series.length === 0) return "";
  const paddingY = 7;
  const indexSpan = Math.max(1, domainEnd - domainStart);
  const valueSpan = Math.max(1, max - min);

  return series.map((point, pointIndex) => {
    const x = ((point.index - domainStart) / indexSpan) * width;
    const normalizedValue = (point.value - min) / valueSpan;
    const y = height - paddingY - normalizedValue * (height - paddingY * 2);
    return `${pointIndex === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(" ");
}

function buildGearShiftBadges(samples: Telemetry[], sampleOffset: number, min: number, max: number, width: number, height: number, domainStart: number, domainEnd: number) {
  const badges: GearShiftBadge[] = [];
  let previousGear: number | null = null;
  let lastBadgeX = -Infinity;

  samples.forEach((sample, index) => {
    const gear = Number.isFinite(sample.Gear) ? sample.Gear : null;
    if (gear === null) return;

    if (previousGear !== null && gear !== previousGear) {
      const absoluteIndex = sampleOffset + index;
      const x = indicatorX(absoluteIndex, domainStart, domainEnd, width);
      const rpm = telemetryValue(sample, "CurrentEngineRpm");
      if (x !== null && typeof rpm === "number" && Number.isFinite(rpm) && x - lastBadgeX >= 14) {
        const label = formatGear(gear);
        const badgeWidth = Math.max(16, label.length * 7 + 10);
        badges.push({
          index: absoluteIndex,
          x,
          y: chartY(rpm, min, max, height),
          badgeX: clampNumber(x - badgeWidth / 2, 2, width - badgeWidth - 2),
          width: badgeWidth,
          label
        });
        lastBadgeX = x;
      }
    }

    previousGear = gear;
  });

  return badges;
}

function chartY(value: number, min: number, max: number, height: number) {
  const paddingY = 7;
  const valueSpan = Math.max(1, max - min);
  const normalizedValue = (value - min) / valueSpan;
  return height - paddingY - normalizedValue * (height - paddingY * 2);
}

function indicatorX(index: number | null, domainStart: number, domainEnd: number, width: number) {
  if (index === null || index < domainStart || index > domainEnd) return null;
  const span = Math.max(1, domainEnd - domainStart);
  return ((index - domainStart) / span) * width;
}

function sampleAtAbsoluteIndex(samples: Telemetry[], sampleOffset: number, index: number | null) {
  if (index === null) return null;
  return samples[index - sampleOffset] ?? null;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
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

function sectionCount(section: TelemetryGraphSection) {
  return (section.groups?.length ?? 0) + (section.fields?.length ?? 0);
}
