import { Activity, Gauge } from "lucide-react";
import type { Telemetry, TireMfdTire } from "@/types/telemetry";
import { average, clampNumber, radiansToDegrees } from "@/lib/math";
import { compressionTone, formatValue, slipAmountTone, temperatureSplitLabel, temperatureTone } from "@/lib/format";
import { frontTireSlipAngle, rearTireSlipAngle } from "@/features/map/cornerAnalysis";
import { TelemetryGroup, metricToneClass } from "./TelemetryPanelPrimitives";
import { buildTireMfdData, tireTemperatureColor, tireTextColorClass } from "@/features/telemetry/tireVisuals";

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
