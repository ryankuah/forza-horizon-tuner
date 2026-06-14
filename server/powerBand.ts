import type { PowerBandEstimate, Telemetry } from "../src/types/telemetry";

const POWER_BAND_MIN_THROTTLE_PCT = 98;
const POWER_BAND_MAX_BRAKE_PCT = 5;
const POWER_BAND_MAX_CLUTCH_PCT = 5;
const POWER_BAND_MAX_COMBINED_SLIP = 1.2;

export function estimatePowerBand(samples: Iterable<Telemetry>): PowerBandEstimate | null {
  const binSize = 250;
  const buckets = new Map<number, { count: number; powerHp: number; torqueNm: number; boost: number }>();

  for (const sample of samples) {
    if (sample.IsRaceOn !== 1) continue;
    if (
      sample.throttlePct < POWER_BAND_MIN_THROTTLE_PCT ||
      sample.brakePct > POWER_BAND_MAX_BRAKE_PCT ||
      sample.Clutch > POWER_BAND_MAX_CLUTCH_PCT ||
      sample.Gear <= 1
    ) continue;
    if (sample.CurrentEngineRpm < Math.max(900, sample.EngineIdleRpm * 0.9)) continue;
    if (sample.powerHp <= 0 || sample.torqueNm <= 0) continue;

    const combinedSlip = Math.max(
      Math.abs(sample.TireCombinedSlipFrontLeft),
      Math.abs(sample.TireCombinedSlipFrontRight),
      Math.abs(sample.TireCombinedSlipRearLeft),
      Math.abs(sample.TireCombinedSlipRearRight)
    );
    if (combinedSlip > POWER_BAND_MAX_COMBINED_SLIP) continue;

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
