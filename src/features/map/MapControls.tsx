import * as React from "react";
import { ChevronsLeft, ChevronsRight, Minus, Pause, Play, Plus, Radio, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function MapControls({
  canZoomIn,
  canZoomOut,
  canPlayTelemetry = false,
  isPlaying = false,
  zoomPct,
  playbackLabel = "0:00 / 0:00",
  playbackSpeed = 1,
  canDecreasePlaybackSpeed = false,
  canIncreasePlaybackSpeed = false,
  canReturnToLive = false,
  onTogglePlayback,
  onDecreasePlaybackSpeed,
  onIncreasePlaybackSpeed,
  onReturnToLive,
  onZoomIn,
  onZoomOut,
  onReset
}: {
  canZoomIn: boolean;
  canZoomOut: boolean;
  canPlayTelemetry?: boolean;
  isPlaying?: boolean;
  zoomPct: number;
  playbackLabel?: string;
  playbackSpeed?: number;
  canDecreasePlaybackSpeed?: boolean;
  canIncreasePlaybackSpeed?: boolean;
  canReturnToLive?: boolean;
  onTogglePlayback?: () => void;
  onDecreasePlaybackSpeed?: () => void;
  onIncreasePlaybackSpeed?: () => void;
  onReturnToLive?: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}) {
  function stopControlEvent(event: React.SyntheticEvent) {
    event.preventDefault();
    event.stopPropagation();
  }

  return (
    <div
      className="absolute right-3 top-3 flex items-center overflow-hidden rounded-md border border-border bg-card/90 text-foreground shadow-sm"
      onClick={stopControlEvent}
      onDoubleClick={stopControlEvent}
      onMouseDown={stopControlEvent}
      onMouseMove={(event) => event.stopPropagation()}
      onMouseUp={stopControlEvent}
      onPointerCancel={stopControlEvent}
      onPointerDown={stopControlEvent}
      onPointerMove={(event) => event.stopPropagation()}
      onPointerUp={stopControlEvent}
      onWheel={stopControlEvent}
    >
      {onTogglePlayback ? (
        <>
          <Button type="button" variant="ghost" size="icon" className="h-9 w-9 rounded-none border-r border-border"
            onClick={(event) => {
              stopControlEvent(event);
              onTogglePlayback();
            }}
            disabled={!canPlayTelemetry}
            aria-label={isPlaying ? "Pause telemetry playback" : "Play telemetry playback"}
            title={isPlaying ? "Pause telemetry playback" : "Play telemetry playback"}
          >
            {isPlaying ? <Pause size={15} strokeWidth={2.4} /> : <Play size={15} strokeWidth={2.4} />}
          </Button>
          <span className="min-w-24 border-r border-border px-2 text-center text-[11px] font-bold tabular-nums text-[#c7d0cb]">
            {playbackLabel}
          </span>
          {canReturnToLive && onReturnToLive ? (
            <Button type="button" variant="ghost" size="icon" className="h-9 w-9 rounded-none border-r border-border text-[#70e0a6]"
              onClick={(event) => {
                stopControlEvent(event);
                onReturnToLive();
              }}
              aria-label="Return to live telemetry"
              title="Return to live telemetry"
            ><Radio size={15} strokeWidth={2.4} /></Button>
          ) : null}
          <Button type="button" variant="ghost" size="icon" className="h-9 w-9 rounded-none border-r border-border"
            onClick={(event) => {
              stopControlEvent(event);
              onDecreasePlaybackSpeed?.();
            }}
            disabled={!canDecreasePlaybackSpeed}
            aria-label="Decrease playback speed"
            title="Decrease playback speed"
          ><ChevronsLeft size={15} strokeWidth={2.4} /></Button>
          <span className="min-w-12 border-r border-border px-2 text-center text-[11px] font-bold tabular-nums text-[#c7d0cb]">
            {playbackSpeed}x
          </span>
          <Button type="button" variant="ghost" size="icon" className="h-9 w-9 rounded-none border-r border-border"
            onClick={(event) => {
              stopControlEvent(event);
              onIncreasePlaybackSpeed?.();
            }}
            disabled={!canIncreasePlaybackSpeed}
            aria-label="Increase playback speed"
            title="Increase playback speed"
          ><ChevronsRight size={15} strokeWidth={2.4} /></Button>
        </>
      ) : null}
      <Button type="button" variant="ghost" size="icon" className="h-9 w-9 rounded-none border-r border-border"
        onClick={(event) => {
          stopControlEvent(event);
          onZoomOut();
        }}
        disabled={!canZoomOut}
        aria-label="Zoom out"
        title="Zoom out"
      ><Minus size={16} strokeWidth={2.4} /></Button>
      <span className="min-w-14 px-2 text-center text-[11px] font-bold tabular-nums text-[#c7d0cb]">
        {zoomPct}%
      </span>
      <Button type="button" variant="ghost" size="icon" className="h-9 w-9 rounded-none border-l border-border"
        onClick={(event) => {
          stopControlEvent(event);
          onZoomIn();
        }}
        disabled={!canZoomIn}
        aria-label="Zoom in"
        title="Zoom in"
      ><Plus size={16} strokeWidth={2.4} /></Button>
      <Button type="button" variant="ghost" size="icon" className="h-9 w-9 rounded-none border-l border-border"
        onClick={(event) => {
          stopControlEvent(event);
          onReset();
        }}
        aria-label="Reset map view"
        title="Reset map view"
      ><RotateCcw size={15} strokeWidth={2.3} /></Button>
    </div>
  );
}
