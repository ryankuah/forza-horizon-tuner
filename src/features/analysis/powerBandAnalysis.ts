import { clampNumber } from "@/lib/math";
import type { Telemetry } from "@/types/telemetry";

export type PowerBandBin = {
  rpm: number;
  sampleCount: number;
  avgPowerHp: number;
  avgTorqueNm: number;
  avgBoost: number;
};

export type PowerBandEstimate = {
  bins: PowerBandBin[];
  sampleCount: number;
  peakPowerHp: number;
  peakPowerRpm: number;
  peakTorqueNm: number;
  peakTorqueRpm: number;
  bandStartRpm: number;
  bandEndRpm: number;
  thresholdPercent: number;
  confidence: "Low" | "Medium" | "High";
};

export function estimatePowerBand(samples: Telemetry[]): PowerBandEstimate | null {
  const binSize = 250;
  const buckets = new Map<number, { count: number; powerHp: number; torqueNm: number; boost: number }>();

  for (const sample of samples) {
    if (sample.IsRaceOn !== 1) continue;
    if (sample.throttlePct < 80 || sample.brakePct > 5 || sample.Clutch > 5 || sample.Gear <= 1) continue;
    if (sample.CurrentEngineRpm < Math.max(900, sample.EngineIdleRpm * 0.9)) continue;
    if (sample.powerHp <= 0 || sample.torqueNm <= 0) continue;

    const combinedSlip = Math.max(
      Math.abs(sample.TireCombinedSlipFrontLeft),
      Math.abs(sample.TireCombinedSlipFrontRight),
      Math.abs(sample.TireCombinedSlipRearLeft),
      Math.abs(sample.TireCombinedSlipRearRight)
    );
    if (combinedSlip > 1.8) continue;

    const rpmBin = Math.round(sample.CurrentEngineRpm / binSize) * binSize;
    const bucket = buckets.get(rpmBin) ?? { count: 0, powerHp: 0, torqueNm: 0, boost: 0 };
    bucket.count += 1;
    bucket.powerHp += sample.powerHp;
    bucket.torqueNm += sample.torqueNm;
    bucket.boost += sample.Boost;
    buckets.set(rpmBin, bucket);
  }

  const bins = [...buckets.entries()]
    .map(([rpmBin, bucket]) => ({
      rpm: rpmBin,
      sampleCount: bucket.count,
      avgPowerHp: bucket.powerHp / bucket.count,
      avgTorqueNm: bucket.torqueNm / bucket.count,
      avgBoost: bucket.boost / bucket.count
    }))
    .filter((bin) => bin.sampleCount >= 2)
    .sort((left, right) => left.rpm - right.rpm);

  const sampleCount = bins.reduce((sum, bin) => sum + bin.sampleCount, 0);
  if (bins.length < 4 || sampleCount < 16) return null;

  const peakPowerBin = bins.reduce((best, bin) => bin.avgPowerHp > best.avgPowerHp ? bin : best, bins[0]);
  const peakTorqueBin = bins.reduce((best, bin) => bin.avgTorqueNm > best.avgTorqueNm ? bin : best, bins[0]);
  const thresholdPercent = sampleCount >= 50 ? 95 : 90;
  const thresholdPower = peakPowerBin.avgPowerHp * (thresholdPercent / 100);
  const peakIndex = bins.indexOf(peakPowerBin);
  let startIndex = peakIndex;
  let endIndex = peakIndex;

  while (startIndex > 0 && bins[startIndex - 1].avgPowerHp >= thresholdPower) startIndex -= 1;
  while (endIndex < bins.length - 1 && bins[endIndex + 1].avgPowerHp >= thresholdPower) endIndex += 1;

  const confidence = sampleCount >= 120 && bins.length >= 10
    ? "High"
    : sampleCount >= 50 && bins.length >= 7
      ? "Medium"
      : "Low";

  return {
    bins,
    sampleCount,
    peakPowerHp: peakPowerBin.avgPowerHp,
    peakPowerRpm: peakPowerBin.rpm,
    peakTorqueNm: peakTorqueBin.avgTorqueNm,
    peakTorqueRpm: peakTorqueBin.rpm,
    bandStartRpm: Math.max(0, bins[startIndex].rpm - binSize / 2),
    bandEndRpm: bins[endIndex].rpm + binSize / 2,
    thresholdPercent,
    confidence
  };
}

export function rpmPercent(rpm: number, maxRpm: number) {
  return clampNumber((rpm / Math.max(1, maxRpm)) * 100, 0, 100);
}
