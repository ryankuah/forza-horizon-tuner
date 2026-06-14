import type { CalibrationTransform, PathSample, SvgPoint, SvgViewBox, Telemetry } from "@/types/telemetry";
import { clampNumber } from "@/lib/math";
import mapImageUrl from "../../../public/fh6-map-reveal.jpg";

export const MAP_IMAGE_URL = mapImageUrl;
export const MAP_IMAGE_WIDTH = 2160;
export const MAP_IMAGE_HEIGHT = 2700;
export const CAR_FOLLOW_MAP_ZOOM = 8;
export const MAX_MAP_ZOOM = CAR_FOLLOW_MAP_ZOOM * 8;
export const MAP_ZOOM_STEP = 1.35;
export const MAP_DRAG_THRESHOLD_PX = 4;

const FH6_MAP_PIXELS_PER_WORLD_METER = 0.13158;

export const DEFAULT_MAP_CALIBRATION: CalibrationTransform = {
  a: FH6_MAP_PIXELS_PER_WORLD_METER,
  b: 0,
  c: 1160.32838497,
  d: 0,
  e: -FH6_MAP_PIXELS_PER_WORLD_METER,
  f: 1321.0827332
};

export function clientPointToSvgPoint(svg: SVGSVGElement, event: { clientX: number; clientY: number }): SvgPoint | null {
  const matrix = svg.getScreenCTM();
  if (!matrix) return null;

  const point = svg.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  const transformed = point.matrixTransform(matrix.inverse());
  return { x: transformed.x, y: transformed.y };
}


export function defaultRunMapViewBox(): SvgViewBox {
  return centerViewBoxAtPoint(
    { x: MAP_IMAGE_WIDTH / 2, y: MAP_IMAGE_HEIGHT / 2 },
    MAP_IMAGE_WIDTH / CAR_FOLLOW_MAP_ZOOM,
    MAP_IMAGE_HEIGHT / CAR_FOLLOW_MAP_ZOOM
  );
}


export function mapZoomPercent(viewBox: SvgViewBox) {
  return Math.round((MAP_IMAGE_WIDTH / viewBox.width / CAR_FOLLOW_MAP_ZOOM) * 100);
}


export function mapMarkerScale(viewBox: SvgViewBox) {
  return (viewBox.width / (MAP_IMAGE_WIDTH / CAR_FOLLOW_MAP_ZOOM)) * 0.5;
}


export function zoomViewBoxAtPoint(viewBox: SvgViewBox, focus: SvgPoint, factor: number): SvgViewBox {
  const minWidth = MAP_IMAGE_WIDTH / MAX_MAP_ZOOM;
  const nextWidth = clampNumber(viewBox.width * factor, minWidth, MAP_IMAGE_WIDTH);
  const nextHeight = clampNumber(viewBox.height * factor, MAP_IMAGE_HEIGHT / MAX_MAP_ZOOM, MAP_IMAGE_HEIGHT);

  const focusRatioX = (focus.x - viewBox.x) / viewBox.width;
  const focusRatioY = (focus.y - viewBox.y) / viewBox.height;

  return clampMapViewBox({
    x: focus.x - nextWidth * focusRatioX,
    y: focus.y - nextHeight * focusRatioY,
    width: nextWidth,
    height: nextHeight
  });
}


export function centerViewBoxAtPoint(center: SvgPoint, width: number, height: number): SvgViewBox {
  return clampMapViewBox({
    x: center.x - width / 2,
    y: center.y - height / 2,
    width,
    height
  });
}


export function clampMapViewBox(viewBox: SvgViewBox): SvgViewBox {
  const width = clampNumber(viewBox.width, MAP_IMAGE_WIDTH / MAX_MAP_ZOOM, MAP_IMAGE_WIDTH);
  const height = clampNumber(viewBox.height, MAP_IMAGE_HEIGHT / MAX_MAP_ZOOM, MAP_IMAGE_HEIGHT);

  return {
    x: clampNumber(viewBox.x, 0, MAP_IMAGE_WIDTH - width),
    y: clampNumber(viewBox.y, 0, MAP_IMAGE_HEIGHT - height),
    width,
    height
  };
}


export function viewBoxCenter(viewBox: SvgViewBox): SvgPoint {
  return {
    x: viewBox.x + viewBox.width / 2,
    y: viewBox.y + viewBox.height / 2
  };
}


export function buildPathGeometry(path: PathSample[]) {
  const width = MAP_IMAGE_WIDTH;
  const height = MAP_IMAGE_HEIGHT;
  if (path.length === 0) {
    return { width, height, points: [] as SvgPoint[], polyline: "" };
  }

  const transform = activeMapCalibration();
  const points = path.map((point) => worldCoordinatesToMapPoint(point.x, point.z, transform));

  return {
    width,
    height,
    points,
    polyline: points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ")
  };
}


export function worldTelemetryToMapPoint(telemetry: Telemetry, transform: CalibrationTransform): SvgPoint {
  return worldCoordinatesToMapPoint(telemetry.PositionX, telemetry.PositionZ, transform);
}


export function worldCoordinatesToMapPoint(worldX: number, worldZ: number, transform: CalibrationTransform): SvgPoint {
  return {
    x: transform.a * worldX + transform.b * worldZ + transform.c,
    y: transform.d * worldX + transform.e * worldZ + transform.f
  };
}

let cachedMapCalibration: CalibrationTransform | null | undefined;


export function activeMapCalibration() {
  if (cachedMapCalibration !== undefined) return cachedMapCalibration ?? DEFAULT_MAP_CALIBRATION;

  cachedMapCalibration = loadSavedMapCalibration();
  return cachedMapCalibration ?? DEFAULT_MAP_CALIBRATION;
}


function loadSavedMapCalibration(): CalibrationTransform | null {
  try {
    const raw = window.localStorage.getItem("fh6MapCalibration");
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<CalibrationTransform>;
    if (
      Number.isFinite(parsed.a)
      && Number.isFinite(parsed.b)
      && Number.isFinite(parsed.c)
      && Number.isFinite(parsed.d)
      && Number.isFinite(parsed.e)
      && Number.isFinite(parsed.f)
    ) {
      return {
        a: parsed.a,
        b: parsed.b,
        c: parsed.c,
        d: parsed.d,
        e: parsed.e,
        f: parsed.f
      } as CalibrationTransform;
    }
  } catch {
    return null;
  }

  return null;
}


export function nearestPointIndex(points: SvgPoint[], cursor: SvgPoint) {
  let bestIndex = 0;
  let bestDistance = Infinity;

  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    const distance = (point.x - cursor.x) ** 2 + (point.y - cursor.y) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }

  return bestIndex;
}
