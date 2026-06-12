import type { PathSample, Telemetry } from "@/types/telemetry";

const MAX_PATH_POINTS = 5000;
const MIN_PATH_STEP_METERS = 1.5;

export function addTelemetryPoint(currentPath: PathSample[], telemetry: Telemetry | null, sampleIndex = inferNextSampleIndex(currentPath)) {
  const point = telemetryToPathSample(telemetry, sampleIndex);
  if (!point) return currentPath;

  const previous = currentPath[currentPath.length - 1];

  if (previous) {
    const distance = Math.hypot(point.x - previous.x, point.z - previous.z);
    if (distance < MIN_PATH_STEP_METERS) return currentPath;
  }

  const nextPath = [...currentPath, point];
  return nextPath.length > MAX_PATH_POINTS
    ? nextPath.slice(nextPath.length - MAX_PATH_POINTS)
    : nextPath;
}


export function buildPathFromTelemetry(samples: Telemetry[]) {
  const path: PathSample[] = [];

  for (let index = 0; index < samples.length; index += 1) {
    const point = telemetryToPathSample(samples[index], index);
    if (!point) continue;

    const previous = path[path.length - 1];
    if (previous) {
      const distance = Math.hypot(point.x - previous.x, point.z - previous.z);
      if (distance < MIN_PATH_STEP_METERS) continue;
    }

    path.push(point);
  }

  return path;
}


function telemetryToPathSample(telemetry: Telemetry | null, sampleIndex: number): PathSample | null {
  if (!telemetry || telemetry.IsRaceOn !== 1) return null;
  if (!Number.isFinite(telemetry.PositionX) || !Number.isFinite(telemetry.PositionZ)) return null;

  return {
    x: telemetry.PositionX,
    z: telemetry.PositionZ,
    speedKmh: telemetry.speedKmh || 0,
    at: telemetry.receivedAt || Date.now(),
    sampleIndex,
    telemetry
  };
}


function inferNextSampleIndex(path: PathSample[]) {
  return (path[path.length - 1]?.sampleIndex ?? -1) + 1;
}
