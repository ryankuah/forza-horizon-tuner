import * as React from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function MapControls({
  canZoomIn,
  canZoomOut,
  zoomPct,
  onZoomIn,
  onZoomOut,
  onReset
}: {
  canZoomIn: boolean;
  canZoomOut: boolean;
  zoomPct: number;
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
