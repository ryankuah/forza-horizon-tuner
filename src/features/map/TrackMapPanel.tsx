import * as React from "react";
import type { MapDragState, PathSample, SvgPoint, SvgViewBox, Telemetry } from "@/types/telemetry";
import { buildTireMfdData, tireTemperatureColor } from "@/features/telemetry/tireVisuals";
import { clampNumber } from "@/lib/math";
import { MapControls } from "./MapControls";
import { MapLegend } from "./MapLegend";
import { buildCornerSegments, buildPathRenderSegments, buildSelectedCornerPhaseSegments, cornerSegmentForIndex, mapPathStrokeClass } from "./cornerAnalysis";
import { CAR_FOLLOW_MAP_ZOOM, MAP_DRAG_THRESHOLD_PX, MAP_IMAGE_HEIGHT, MAP_IMAGE_URL, MAP_IMAGE_WIDTH, MAP_ZOOM_STEP, MAX_MAP_ZOOM, activeMapCalibration, buildPathGeometry, centerViewBoxAtPoint, clientPointToSvgPoint, defaultRunMapViewBox, mapMarkerScale, mapZoomPercent, nearestPointIndex, viewBoxCenter, worldTelemetryToMapPoint, zoomViewBoxAtPoint, clampMapViewBox } from "./mapGeometry";

export function TrackMapPanel({
  path,
  hoverIndex,
  playheadPathIndex,
  playheadTelemetry,
  isPlaying,
  canPlayTelemetry,
  playbackLabel,
  playbackSpeed,
  canDecreasePlaybackSpeed,
  canIncreasePlaybackSpeed,
  canReturnToLive,
  onHoverIndex,
  onScrubPathIndex,
  onTogglePlayback,
  onDecreasePlaybackSpeed,
  onIncreasePlaybackSpeed,
  onReturnToLive
}: {
  path: PathSample[];
  hoverIndex: number | null;
  playheadPathIndex: number | null;
  playheadTelemetry: Telemetry | null;
  isPlaying: boolean;
  canPlayTelemetry: boolean;
  playbackLabel: string;
  playbackSpeed: number;
  canDecreasePlaybackSpeed: boolean;
  canIncreasePlaybackSpeed: boolean;
  canReturnToLive: boolean;
  onHoverIndex: (index: number | null) => void;
  onScrubPathIndex: (index: number | null) => void;
  onTogglePlayback: () => void;
  onDecreasePlaybackSpeed: () => void;
  onIncreasePlaybackSpeed: () => void;
  onReturnToLive: () => void;
}) {
  const svgRef = React.useRef<SVGSVGElement | null>(null);
  const dragRef = React.useRef<MapDragState | null>(null);
  const lastScrubIndexRef = React.useRef<number | null>(null);
  const [viewBox, setViewBox] = React.useState<SvgViewBox>(() => defaultRunMapViewBox());
  const geometry = React.useMemo(() => buildPathGeometry(path), [path]);
  const cornerSegments = React.useMemo(() => buildCornerSegments(path), [path]);
  const playheadCorner = playheadPathIndex === null ? null : cornerSegmentForIndex(cornerSegments, playheadPathIndex);
  const renderSegments = React.useMemo(() => buildPathRenderSegments(path, geometry.points), [path, geometry.points]);
  const playheadCornerSegments = React.useMemo(
    () => playheadCorner ? buildSelectedCornerPhaseSegments(geometry.points, playheadCorner) : [],
    [geometry.points, playheadCorner]
  );
  const progressPolyline = React.useMemo(
    () => geometry.points
      .slice(0, playheadPathIndex === null ? 0 : playheadPathIndex + 1)
      .map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`)
      .join(" "),
    [geometry.points, playheadPathIndex]
  );
  const latestPoint = geometry.points[geometry.points.length - 1];
  const latestSample = path[path.length - 1];
  const playheadPoint = playheadTelemetry && hasFinitePosition(playheadTelemetry)
    ? worldTelemetryToMapPoint(playheadTelemetry, activeMapCalibration())
    : null;
  const currentPoint = playheadPoint ?? latestPoint;
  const currentTelemetry = playheadTelemetry ?? latestSample?.telemetry ?? null;
  const hoverPoint = hoverIndex === null ? null : geometry.points[hoverIndex];
  const hoverSample = hoverIndex === null ? null : path[hoverIndex];
  const canZoomIn = viewBox.width > geometry.width / MAX_MAP_ZOOM;
  const canZoomOut = viewBox.width < geometry.width;
  const zoomPct = mapZoomPercent(viewBox);
  const markerScale = mapMarkerScale(viewBox);

  React.useEffect(() => {
    if (!currentPoint) {
      setViewBox(defaultRunMapViewBox());
      return;
    }

    setViewBox((current) => {
      const width = current.width === MAP_IMAGE_WIDTH
        ? MAP_IMAGE_WIDTH / CAR_FOLLOW_MAP_ZOOM
        : current.width;
      const height = current.height === MAP_IMAGE_HEIGHT
        ? MAP_IMAGE_HEIGHT / CAR_FOLLOW_MAP_ZOOM
        : current.height;

      return centerViewBoxAtPoint(currentPoint, width, height);
    });
  }, [currentPoint?.x, currentPoint?.y, geometry.points.length]);

  function handlePointerMove(event: React.PointerEvent<SVGSVGElement>) {
    if (!svgRef.current) return;

    const drag = dragRef.current;
    if (drag && drag.pointerId === event.pointerId) {
      const deltaX = event.clientX - drag.startClientX;
      const deltaY = event.clientY - drag.startClientY;

      if (drag.mode === "scrub") {
        event.preventDefault();
        const cursor = clientPointToSvgPoint(svgRef.current, event);
        if (cursor && geometry.points.length) {
          scrubToPathIndex(nearestPointIndex(geometry.points, cursor));
        }
        return;
      }

      if (!drag.dragging && Math.hypot(deltaX, deltaY) > MAP_DRAG_THRESHOLD_PX) {
        drag.dragging = true;
      }

      if (drag.dragging) {
        event.preventDefault();
        onHoverIndex(null);
        setViewBox(clampMapViewBox({
          ...drag.startViewBox,
          x: drag.startViewBox.x - deltaX * (drag.startViewBox.width / svgRef.current.clientWidth),
          y: drag.startViewBox.y - deltaY * (drag.startViewBox.height / svgRef.current.clientHeight)
        }));
        return;
      }
    }

    if (geometry.points.length === 0) return;

    const cursor = clientPointToSvgPoint(svgRef.current, event);
    if (!cursor) return;
    onHoverIndex(nearestPointIndexWithinThreshold(geometry.points, cursor, scrubThresholdSvgUnits()));
  }

  function handlePointerDown(event: React.PointerEvent<SVGSVGElement>) {
    if (!svgRef.current) return;

    lastScrubIndexRef.current = null;
    const cursor = clientPointToSvgPoint(svgRef.current, event);
    const scrubIndex = cursor ? nearestPointIndexWithinThreshold(geometry.points, cursor, scrubThresholdSvgUnits()) : null;

    dragRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startViewBox: viewBox,
      dragging: false,
      mode: scrubIndex === null ? "pan" : "scrub"
    };
    svgRef.current.setPointerCapture(event.pointerId);
    if (scrubIndex !== null) {
      event.preventDefault();
      scrubToPathIndex(scrubIndex);
    }
  }

  function handlePointerUp(event: React.PointerEvent<SVGSVGElement>) {
    if (!svgRef.current) return;

    const drag = dragRef.current;
    dragRef.current = null;
    if (svgRef.current.hasPointerCapture(event.pointerId)) {
      svgRef.current.releasePointerCapture(event.pointerId);
    }
    if (drag?.dragging || geometry.points.length === 0) {
      lastScrubIndexRef.current = null;
      return;
    }
    if (drag?.mode === "scrub") {
      const cursor = clientPointToSvgPoint(svgRef.current, event);
      if (cursor) scrubToPathIndex(nearestPointIndex(geometry.points, cursor));
      lastScrubIndexRef.current = null;
      return;
    }

    const cursor = clientPointToSvgPoint(svgRef.current, event);
    if (!cursor) {
      lastScrubIndexRef.current = null;
      return;
    }
    scrubToPathIndex(nearestPointIndex(geometry.points, cursor));
    lastScrubIndexRef.current = null;
  }

  function handlePointerCancel(event: React.PointerEvent<SVGSVGElement>) {
    dragRef.current = null;
    lastScrubIndexRef.current = null;
    if (svgRef.current?.hasPointerCapture(event.pointerId)) {
      svgRef.current.releasePointerCapture(event.pointerId);
    }
  }

  function handleWheel(event: React.WheelEvent<SVGSVGElement>) {
    if (!svgRef.current) return;

    event.preventDefault();
    const cursor = clientPointToSvgPoint(svgRef.current, event);
    zoomMapAt(cursor ?? viewBoxCenter(viewBox), event.deltaY > 0 ? MAP_ZOOM_STEP : 1 / MAP_ZOOM_STEP);
  }

  function zoomMapAt(focus: SvgPoint, factor: number) {
    setViewBox((current) => zoomViewBoxAtPoint(current, focus, factor));
  }

  function zoomMapFromSelectedPoint(factor: number) {
    setViewBox((current) => zoomViewBoxAtPoint(current, currentPoint ?? viewBoxCenter(current), factor));
  }

  function scrubToPathIndex(index: number) {
    if (lastScrubIndexRef.current === index) return;
    lastScrubIndexRef.current = index;
    onHoverIndex(null);
    onScrubPathIndex(index);
  }

  function scrubThresholdSvgUnits() {
    const svg = svgRef.current;
    if (!svg || svg.clientWidth <= 0) return 24;
    return 24 * (viewBox.width / svg.clientWidth);
  }

  return (
    <section className="flex h-full min-h-0 flex-col">
      <div
        data-path-surface
        className="relative min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-card/80"
        onMouseLeave={() => onHoverIndex(null)}
        onPointerLeave={() => onHoverIndex(null)}
      >
        <svg
          className="block h-full w-full cursor-grab touch-none active:cursor-grabbing"
          ref={svgRef}
          viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
          role="img"
          aria-label="Live car map"
          onPointerMove={handlePointerMove}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          onPointerLeave={() => onHoverIndex(null)}
          onWheel={handleWheel}
        >
          <image
            href={MAP_IMAGE_URL}
            x="0"
            y="0"
            width={geometry.width}
            height={geometry.height}
            preserveAspectRatio="none"
          />
          <rect width="100%" height="100%" fill="rgba(7,10,9,0.16)" />
          {geometry.polyline ? (
            <>
              <polyline className="fill-none stroke-[rgba(228,102,69,0.28)] [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:12] [vector-effect:non-scaling-stroke]" points={geometry.polyline} />
              {renderSegments.map((segment, index) => (
                <polyline
                  key={`${segment.effect}-${index}`}
                  className={[
                    "fill-none [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:4] [vector-effect:non-scaling-stroke]",
                    mapPathStrokeClass(segment.effect)
                  ].join(" ")}
                  points={segment.points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ")}
                />
              ))}
              {progressPolyline ? (
                <polyline
                  className="pointer-events-none fill-none stroke-[#f5f7f6]/90 [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:2.5] [vector-effect:non-scaling-stroke]"
                  points={progressPolyline}
                />
              ) : null}
              {playheadCornerSegments.length ? (
                <>
                  <polyline
                    className="pointer-events-none fill-none stroke-[#101312]/80 [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:8] [vector-effect:non-scaling-stroke]"
                    points={geometry.points.slice(playheadCorner!.startIndex, playheadCorner!.endIndex).map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ")}
                  />
                  {playheadCornerSegments.map((segment, index) => (
                    <polyline
                      key={`playhead-${segment.effect}-${index}`}
                      className={[
                        "pointer-events-none fill-none [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:4.5] [vector-effect:non-scaling-stroke]",
                        mapPathStrokeClass(segment.effect)
                      ].join(" ")}
                      points={segment.points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ")}
                    />
                  ))}
                </>
              ) : null}
            </>
          ) : (
            <text className="fill-[#f5f7f6] text-5xl font-bold [paint-order:stroke] [stroke:#070a09] [stroke-width:8px]" x="50%" y="50%" dominantBaseline="middle" textAnchor="middle">
              Waiting for position samples
            </text>
          )}
          {hoverPoint && hoverSample?.telemetry ? (
            <MfdCarMarker point={hoverPoint} telemetry={hoverSample.telemetry} variant="hover" scale={markerScale} />
          ) : null}
          {currentPoint && currentTelemetry ? (
            <MfdCarMarker point={currentPoint} telemetry={currentTelemetry} variant="selected" scale={markerScale} />
          ) : null}
        </svg>
        <MapControls
          canZoomIn={canZoomIn}
          canZoomOut={canZoomOut}
          canPlayTelemetry={canPlayTelemetry}
          isPlaying={isPlaying}
          zoomPct={zoomPct}
          playbackLabel={playbackLabel}
          playbackSpeed={playbackSpeed}
          canDecreasePlaybackSpeed={canDecreasePlaybackSpeed}
          canIncreasePlaybackSpeed={canIncreasePlaybackSpeed}
          canReturnToLive={canReturnToLive}
          onTogglePlayback={onTogglePlayback}
          onDecreasePlaybackSpeed={onDecreasePlaybackSpeed}
          onIncreasePlaybackSpeed={onIncreasePlaybackSpeed}
          onReturnToLive={onReturnToLive}
          onZoomIn={() => zoomMapFromSelectedPoint(1 / MAP_ZOOM_STEP)}
          onZoomOut={() => zoomMapFromSelectedPoint(MAP_ZOOM_STEP)}
          onReset={() => {
            setViewBox(currentPoint
              ? centerViewBoxAtPoint(currentPoint, MAP_IMAGE_WIDTH / CAR_FOLLOW_MAP_ZOOM, MAP_IMAGE_HEIGHT / CAR_FOLLOW_MAP_ZOOM)
              : defaultRunMapViewBox()
            );
          }}
        />
        <MapLegend hasSelectedPoint={Boolean(playheadPoint)} hasSelectedCorner={Boolean(playheadCorner)} />
      </div>
    </section>
  );
}

function hasFinitePosition(telemetry: Telemetry) {
  return Number.isFinite(telemetry.PositionX) && Number.isFinite(telemetry.PositionZ);
}

function nearestPointIndexWithinThreshold(points: SvgPoint[], cursor: SvgPoint, threshold: number) {
  if (!points.length) return null;

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

  return bestDistance <= threshold ** 2 ? bestIndex : null;
}

function MfdCarMarker({
  point,
  telemetry,
  variant,
  scale
}: {
  point: SvgPoint;
  telemetry: Telemetry;
  variant: "current" | "hover" | "selected";
  scale: number;
}) {
  const rotation = yawToSvgDegrees(telemetry.Yaw);
  const tires = buildTireMfdData(telemetry);
  const tireLayout = [
    { id: "front-left", x: -8, y: -12 },
    { id: "front-right", x: 8, y: -12 },
    { id: "rear-left", x: -8, y: 12 },
    { id: "rear-right", x: 8, y: 12 }
  ];
  const ringClass = variant === "selected"
    ? "fill-[#f3d09b]/12 stroke-[#f3d09b]/75"
    : variant === "hover"
      ? "fill-[#63da97]/12 stroke-[#63da97]/70"
    : "fill-[#e46645]/12 stroke-[#e46645]/60";

  return (
    <g className="pointer-events-none" transform={`translate(${point.x} ${point.y}) rotate(${rotation}) scale(${scale})`}>
      <circle className={`${ringClass} [stroke-width:1.5] [vector-effect:non-scaling-stroke]`} r={variant === "selected" ? 25 : variant === "hover" ? 23 : 21} />
      <rect className="fill-[#101312]/85 stroke-[#f5f7f6]/45 [stroke-width:1.2] [vector-effect:non-scaling-stroke]" x="-7" y="-18" width="14" height="36" rx="4" />
      <path className="fill-[#f3d09b] stroke-[#101312] [stroke-linejoin:round] [stroke-width:1] [vector-effect:non-scaling-stroke]" d="M 0 -23 L 5 -15 L -5 -15 Z" />
      {tireLayout.map((layout) => {
        const tire = tires.find((candidate) => candidate.id === layout.id);
        const slipOpacity = tire ? clampNumber(Math.abs(tire.combinedSlip), 0.18, 1) : 0.18;
        return (
          <g key={layout.id} transform={`translate(${layout.x} ${layout.y}) rotate(${tire?.steerAngleDeg ?? 0})`}>
            <rect
              className="stroke-[#101312] [stroke-width:1] [vector-effect:non-scaling-stroke]"
              x="-4"
              y="-7"
              width="8"
              height="14"
              rx="2"
              fill={tireTemperatureColor(tire?.temp ?? 0)}
            />
            <rect x="-4" y={7 - slipOpacity * 14} width="8" height={slipOpacity * 14} rx="1.5" fill="rgba(0,0,0,0.32)" />
          </g>
        );
      })}
    </g>
  );
}

function yawToSvgDegrees(yaw: number) {
  if (!Number.isFinite(yaw)) return 0;
  return (yaw * 180) / Math.PI;
}
