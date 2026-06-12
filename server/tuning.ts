import type { Advice, Summary, Telemetry } from "../src/types/telemetry";

const MAX_WINDOW = 480;

type MeasuredTelemetry = Telemetry & {
  effectiveSpeedKmh: number;
};

export class TelemetryWindow {
  private samples: Telemetry[];

  constructor() {
    this.samples = [];
  }

  add(sample: Telemetry) {
    this.samples.push(sample);
    if (this.samples.length > MAX_WINDOW) {
      this.samples.splice(0, this.samples.length - MAX_WINDOW);
    }
  }

  summary(): Summary | null {
    if (this.samples.length === 0) {
      return null;
    }

    const measuredSamples = withInferredSpeed(this.samples);
    const active = measuredSamples.filter((sample) => sample.IsRaceOn === 1 && sample.effectiveSpeedKmh > 20);
    const samples = active.length > 8 ? active : measuredSamples;
    const avg = (field: keyof MeasuredTelemetry) => averageField(samples, field);
    const max = (field: keyof MeasuredTelemetry) => maxField(samples, field);
    const min = (field: keyof MeasuredTelemetry) => minField(samples, field);

    return {
      sampleCount: this.samples.length,
      windowSeconds: durationSeconds(this.samples),
      avgSpeedKmh: avg("effectiveSpeedKmh"),
      peakSpeedKmh: max("effectiveSpeedKmh"),
      avgFrontSlip: avg("frontSlip"),
      avgRearSlip: avg("rearSlip"),
      avgSlipBalance: avg("slipBalance"),
      avgFrontTemp: avg("frontTemp"),
      avgRearTemp: avg("rearTemp"),
      minSuspensionFront: Math.min(
        min("NormalizedSuspensionTravelFrontLeft"),
        min("NormalizedSuspensionTravelFrontRight")
      ),
      maxSuspensionFront: Math.max(
        max("NormalizedSuspensionTravelFrontLeft"),
        max("NormalizedSuspensionTravelFrontRight")
      ),
      minSuspensionRear: Math.min(
        min("NormalizedSuspensionTravelRearLeft"),
        min("NormalizedSuspensionTravelRearRight")
      ),
      maxSuspensionRear: Math.max(
        max("NormalizedSuspensionTravelRearLeft"),
        max("NormalizedSuspensionTravelRearRight")
      )
    };
  }
}

export function buildTuningAdvice(current: Telemetry | null, summary: Summary | null): Advice[] {
  if (!current || !summary || current.IsRaceOn !== 1) {
    return [
      {
        level: "idle",
        title: "Waiting for driving data",
        detail: "Start driving with Data Out enabled to collect setup signals."
      }
    ];
  }

  const advice: Advice[] = [];
  const fastEnough = summary.avgSpeedKmh > 35;

  if (fastEnough && summary.avgSlipBalance > 0.12) {
    advice.push({
      level: "warn",
      title: "Mid-corner understeer",
      detail: "Front tires are slipping more than the rear. Try softer front anti-roll bar, lower front tire pressure, or slightly more front aero."
    });
  }

  if (fastEnough && summary.avgSlipBalance < -0.12) {
    advice.push({
      level: "warn",
      title: "Rear instability",
      detail: "Rear tires are giving up first. Try softer rear anti-roll bar, lower rear tire pressure, or less rear differential acceleration lock."
    });
  }

  if (summary.maxSuspensionFront > 0.93) {
    advice.push({
      level: "alert",
      title: "Front suspension bottoming",
      detail: "Front suspension is near full compression. Add front spring rate or raise front ride height."
    });
  }

  if (summary.maxSuspensionRear > 0.93) {
    advice.push({
      level: "alert",
      title: "Rear suspension bottoming",
      detail: "Rear suspension is near full compression. Add rear spring rate or raise rear ride height."
    });
  }

  if (summary.avgFrontTemp - summary.avgRearTemp > 12) {
    advice.push({
      level: "note",
      title: "Front tires running hotter",
      detail: "Reduce front pressure slightly or remove front roll stiffness if grip fades during long corners."
    });
  }

  if (summary.avgRearTemp - summary.avgFrontTemp > 12) {
    advice.push({
      level: "note",
      title: "Rear tires running hotter",
      detail: "Reduce rear pressure slightly or soften rear roll stiffness if exits feel nervous."
    });
  }

  if (current.throttlePct > 65 && current.rearSlip > 0.8 && current.DrivetrainType !== 0) {
    advice.push({
      level: "warn",
      title: "Power exit wheelspin",
      detail: "Rear slip is high under throttle. Reduce rear tire pressure, soften rear springs, or lower diff acceleration lock."
    });
  }

  if (advice.length === 0) {
    advice.push({
      level: "ok",
      title: "Setup looks settled",
      detail: "No strong balance problem in the current sample window. Push harder or test another corner type."
    });
  }

  return advice.slice(0, 4);
}

function durationSeconds(samples: Telemetry[]) {
  if (samples.length < 2) return 0;
  return ((samples[samples.length - 1]?.receivedAt ?? 0) - (samples[0]?.receivedAt ?? 0)) / 1000;
}

function withInferredSpeed(samples: Telemetry[]): MeasuredTelemetry[] {
  return samples.map((sample, index) => {
    const packetSpeed = finiteNumber(sample.speedKmh);
    const inferredSpeed = inferSpeedKmh(samples[index - 1], sample);

    return {
      ...sample,
      effectiveSpeedKmh: packetSpeed > 0.1 ? packetSpeed : inferredSpeed
    };
  });
}

function inferSpeedKmh(previous: Telemetry | undefined, sample: Telemetry) {
  if (!previous) return 0;
  const elapsedSeconds = ((sample.receivedAt ?? 0) - (previous.receivedAt ?? 0)) / 1000;
  if (elapsedSeconds <= 0) return 0;

  const distanceMeters = Math.hypot(
    sample.PositionX - previous.PositionX,
    sample.PositionY - previous.PositionY,
    sample.PositionZ - previous.PositionZ
  );

  return (distanceMeters / elapsedSeconds) * 3.6;
}

function averageField(samples: MeasuredTelemetry[], field: keyof MeasuredTelemetry) {
  const values = finiteValues(samples, field);
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function maxField(samples: MeasuredTelemetry[], field: keyof MeasuredTelemetry) {
  const values = finiteValues(samples, field);
  return values.length ? Math.max(...values) : 0;
}

function minField(samples: MeasuredTelemetry[], field: keyof MeasuredTelemetry) {
  const values = finiteValues(samples, field);
  return values.length ? Math.min(...values) : 0;
}

function finiteValues(samples: MeasuredTelemetry[], field: keyof MeasuredTelemetry) {
  return samples
    .map((sample) => finiteNumber(sample[field]))
    .filter((value) => Number.isFinite(value));
}

function finiteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
