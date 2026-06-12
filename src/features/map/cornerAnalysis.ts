import type { CornerEffect, CornerPhaseEffect, CornerSegment, MapPathEffect, PathRenderSegment, PathSample, SvgPoint, Telemetry } from "@/types/telemetry";
import { average, clampNumber, normalizeRadians, radiansToDegrees } from "@/lib/math";
import { MAP_IMAGE_HEIGHT, MAP_IMAGE_WIDTH, MAX_MAP_ZOOM, clampMapViewBox, defaultSessionMapViewBox } from "./mapGeometry";

const CORNER_SMOOTH_DISTANCE_METERS = 35;
const CORNER_LOOK_DISTANCE_METERS = 95;
const CORNER_EXTENSION_DISTANCE_METERS = 60;
const CORNER_PAD_DISTANCE_METERS = 65;
const MIN_CORNER_TURN_DEGREES = 15;
const MIN_CORNER_EXTENSION_DEGREES = 2.4;
const MIN_CORNER_RUN_METERS = 70;
const MAX_CORNER_MERGE_GAP_METERS = 110;

export function buildPathRenderSegments(path: PathSample[], points: SvgPoint[]): PathRenderSegment[] {
  if (path.length < 2 || points.length < 2) return [];

  const segments: PathRenderSegment[] = [];
  const effects = smoothCornerEffects(path);

  for (let index = 1; index < points.length; index += 1) {
    const effect = effects[index] ?? "straight";
    const previousPoint = points[index - 1];
    const point = points[index];
    const current = segments[segments.length - 1];

    if (current && current.effect === effect) {
      current.points.push(point);
    } else {
      segments.push({
        effect,
        points: [previousPoint, point]
      });
    }
  }

  return segments;
}


export function buildCornerSegments(path: PathSample[]): CornerSegment[] {
  const effects = smoothCornerEffects(path);
  return cornerRuns(effects)
    .filter((run): run is CornerRun & { effect: Exclude<CornerEffect, "straight"> } => run.effect !== "straight")
    .map((run, id) => ({
      id,
      startIndex: run.start,
      endIndex: run.end,
      effect: run.effect,
      samples: path.slice(run.start, run.end)
    }));
}


export function cornerSegmentForIndex(corners: CornerSegment[], index: number) {
  return corners.find((corner) => index >= corner.startIndex && index < corner.endIndex) ?? null;
}


export function buildSelectedCornerPhaseSegments(points: SvgPoint[], corner: CornerSegment): PathRenderSegment[] {
  const cornerPoints = points.slice(corner.startIndex, corner.endIndex);
  if (cornerPoints.length < 2) return [];

  const totalDistance = pointPathDistance(cornerPoints);
  if (totalDistance <= 0) {
    return [{
      effect: "cornerMid",
      points: cornerPoints
    }];
  }

  const segments: PathRenderSegment[] = [];
  let distance = 0;

  for (let index = 1; index < cornerPoints.length; index += 1) {
    const previousPoint = cornerPoints[index - 1];
    const point = cornerPoints[index];
    distance += Math.hypot(point.x - previousPoint.x, point.y - previousPoint.y);

    const effect = cornerPhaseAtProgress(distance / totalDistance);
    const current = segments[segments.length - 1];

    if (current && current.effect === effect) {
      current.points.push(point);
    } else {
      segments.push({
        effect,
        points: [previousPoint, point]
      });
    }
  }

  return segments;
}


function cornerPhaseAtProgress(progress: number): CornerPhaseEffect {
  if (progress < 0.34) return "cornerEntry";
  if (progress < 0.67) return "cornerMid";
  return "cornerExit";
}


function pointPathDistance(points: SvgPoint[]) {
  let distance = 0;
  for (let index = 1; index < points.length; index += 1) {
    distance += Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y);
  }
  return distance;
}


export function viewBoxForPointRange(points: SvgPoint[], startIndex: number, endIndex: number) {
  const selectedPoints = points.slice(startIndex, endIndex);
  if (!selectedPoints.length) return defaultSessionMapViewBox();

  const minX = Math.min(...selectedPoints.map((point) => point.x));
  const maxX = Math.max(...selectedPoints.map((point) => point.x));
  const minY = Math.min(...selectedPoints.map((point) => point.y));
  const maxY = Math.max(...selectedPoints.map((point) => point.y));
  const padding = 90;
  const width = Math.max(MAP_IMAGE_WIDTH / MAX_MAP_ZOOM, maxX - minX + padding * 2);
  const height = Math.max(MAP_IMAGE_HEIGHT / MAX_MAP_ZOOM, maxY - minY + padding * 2);

  return clampMapViewBox({
    x: minX - padding,
    y: minY - padding,
    width,
    height
  });
}


function smoothCornerEffects(path: PathSample[]) {
  const cornerPath = smoothCornerPath(path);
  const effects = cornerPath.map((_sample, index) => classifyCornerSeed(cornerPath, index));
  absorbShortCornerRuns(effects, path);
  mergeNearbyCornerRuns(effects, path);
  expandCornerRuns(effects, cornerPath);
  absorbShortCornerRuns(effects, path);
  mergeNearbyCornerRuns(effects, path);
  return effects;
}


function smoothCornerPath(path: PathSample[]) {
  return path.map((sample, index) => {
    let sumX = sample.x;
    let sumZ = sample.z;
    let count = 1;

    for (const direction of [-1, 1]) {
      let distance = 0;
      let cursor = index;

      while (cursor + direction >= 0 && cursor + direction < path.length && distance < CORNER_SMOOTH_DISTANCE_METERS) {
        const current = path[cursor];
        const next = path[cursor + direction];
        distance += Math.hypot(next.x - current.x, next.z - current.z);
        cursor += direction;
        sumX += path[cursor].x;
        sumZ += path[cursor].z;
        count += 1;
      }
    }

    return {
      ...sample,
      x: sumX / count,
      z: sumZ / count
    };
  });
}


function classifyCornerSeed(path: PathSample[], index: number): CornerEffect {
  const turnDegrees = cornerTurnDegrees(path, index, CORNER_LOOK_DISTANCE_METERS);
  if (Math.abs(turnDegrees) < MIN_CORNER_TURN_DEGREES) return "straight";
  return turnDegrees > 0 ? "leftCorner" : "rightCorner";
}


function cornerTurnDegrees(path: PathSample[], index: number, lookDistance: number) {
  const previousIndex = pointIndexAtDistance(path, index, -lookDistance);
  const nextIndex = pointIndexAtDistance(path, index, lookDistance);
  if (previousIndex === index || nextIndex === index || previousIndex === nextIndex) return 0;

  const previous = path[previousIndex];
  const current = path[index];
  const next = path[nextIndex];
  const entryHeading = Math.atan2(current.z - previous.z, current.x - previous.x);
  const exitHeading = Math.atan2(next.z - current.z, next.x - current.x);
  return radiansToDegrees(normalizeRadians(exitHeading - entryHeading));
}


export type CornerRun = {
  start: number;
  end: number;
  effect: CornerEffect;
};


function absorbShortCornerRuns(effects: CornerEffect[], path: PathSample[]) {
  for (const run of cornerRuns(effects)) {
    if (run.effect === "straight" || runDistanceMeters(path, run) >= MIN_CORNER_RUN_METERS) continue;

    const previous = run.start > 0 ? effects[run.start - 1] : null;
    const next = run.end < effects.length ? effects[run.end] : null;
    const replacement = previous && previous !== "straight"
      ? previous
      : next && next !== "straight"
        ? next
        : "straight";

    fillCornerRun(effects, run, replacement);
  }
}


function mergeNearbyCornerRuns(effects: CornerEffect[], path: PathSample[]) {
  for (const run of cornerRuns(effects)) {
    if (run.effect !== "straight" || runDistanceMeters(path, run) > MAX_CORNER_MERGE_GAP_METERS) continue;

    const previous = run.start > 0 ? effects[run.start - 1] : null;
    const next = run.end < effects.length ? effects[run.end] : null;
    if (previous && next && previous === next && previous !== "straight") {
      fillCornerRun(effects, run, previous);
    }
  }
}


function expandCornerRuns(effects: CornerEffect[], path: PathSample[]) {
  for (const run of cornerRuns(effects)) {
    if (run.effect === "straight") continue;

    const direction = run.effect === "leftCorner" ? 1 : -1;
    let start = run.start;
    let end = run.end;
    let startPadDistance = 0;
    let endPadDistance = 0;

    while (start > 0 && effects[start - 1] === "straight" && startPadDistance < CORNER_PAD_DISTANCE_METERS) {
      startPadDistance += Math.hypot(path[start].x - path[start - 1].x, path[start].z - path[start - 1].z);
      start -= 1;
    }

    while (end < effects.length && effects[end] === "straight" && endPadDistance < CORNER_PAD_DISTANCE_METERS) {
      endPadDistance += Math.hypot(path[end].x - path[end - 1].x, path[end].z - path[end - 1].z);
      end += 1;
    }

    while (start > 0 && effects[start - 1] === "straight" && shouldExtendCorner(path, start - 1, direction)) {
      start -= 1;
    }

    while (end < effects.length && effects[end] === "straight" && shouldExtendCorner(path, end, direction)) {
      end += 1;
    }

    for (let index = start; index < end; index += 1) {
      effects[index] = run.effect;
    }
  }
}


function shouldExtendCorner(path: PathSample[], index: number, direction: 1 | -1) {
  const turnDegrees = cornerTurnDegrees(path, index, CORNER_EXTENSION_DISTANCE_METERS);
  if (Math.sign(turnDegrees) !== direction) return false;
  return Math.abs(turnDegrees) >= MIN_CORNER_EXTENSION_DEGREES;
}


function cornerRuns(effects: CornerEffect[]): CornerRun[] {
  const runs: CornerRun[] = [];
  let index = 0;

  while (index < effects.length) {
    const start = index;
    const effect = effects[index];
    while (index < effects.length && effects[index] === effect) {
      index += 1;
    }
    runs.push({ start, end: index, effect });
  }

  return runs;
}


function fillCornerRun(effects: CornerEffect[], run: CornerRun, effect: CornerEffect) {
  for (let index = run.start; index < run.end; index += 1) {
    effects[index] = effect;
  }
}


function runDistanceMeters(path: PathSample[], run: CornerRun) {
  if (run.end - run.start < 2) return 0;
  let distance = 0;
  for (let index = run.start + 1; index < run.end; index += 1) {
    distance += Math.hypot(path[index].x - path[index - 1].x, path[index].z - path[index - 1].z);
  }
  return distance;
}


function pointIndexAtDistance(path: PathSample[], startIndex: number, targetDistance: number) {
  const direction = targetDistance < 0 ? -1 : 1;
  const distanceGoal = Math.abs(targetDistance);
  let distance = 0;
  let index = startIndex;

  while (index + direction >= 0 && index + direction < path.length && distance < distanceGoal) {
    const current = path[index];
    const next = path[index + direction];
    distance += Math.hypot(next.x - current.x, next.z - current.z);
    index += direction;
  }

  return index;
}


export function frontTireSlipAngle(telemetry: Telemetry) {
  return average([
    Math.abs(telemetry.TireSlipAngleFrontLeft),
    Math.abs(telemetry.TireSlipAngleFrontRight)
  ]);
}


export function rearTireSlipAngle(telemetry: Telemetry) {
  return average([
    Math.abs(telemetry.TireSlipAngleRearLeft),
    Math.abs(telemetry.TireSlipAngleRearRight)
  ]);
}


function rearTireCombinedSlip(telemetry: Telemetry) {
  return average([
    Math.abs(telemetry.TireCombinedSlipRearLeft),
    Math.abs(telemetry.TireCombinedSlipRearRight)
  ]);
}


export function mapPathStrokeClass(effect: MapPathEffect) {
  return {
    straight: "stroke-[#d7c7ad]",
    leftCorner: "stroke-[#63da97]",
    rightCorner: "stroke-[#e46645]",
    cornerEntry: "stroke-[#59a7ff]",
    cornerMid: "stroke-[#f3d09b]",
    cornerExit: "stroke-[#63da97]"
  }[effect];
}


export function mapPathSwatchClass(effect: MapPathEffect) {
  return {
    straight: "bg-[#d7c7ad]",
    leftCorner: "bg-[#63da97]",
    rightCorner: "bg-[#e46645]",
    cornerEntry: "bg-[#59a7ff]",
    cornerMid: "bg-[#f3d09b]",
    cornerExit: "bg-[#63da97]"
  }[effect];
}
