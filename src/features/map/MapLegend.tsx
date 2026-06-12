import type { MapPathEffect } from "@/types/telemetry";
import { mapPathSwatchClass } from "./cornerAnalysis";

export function MapLegend({ hasSelectedPoint, hasSelectedCorner }: { hasSelectedPoint: boolean; hasSelectedCorner: boolean }) {
  const items: { effect: MapPathEffect; label: string }[] = [
    { effect: "straight", label: "Straight" },
    ...(hasSelectedCorner
      ? []
      : [
        { effect: "leftCorner" as const, label: "Left corner" },
        { effect: "rightCorner" as const, label: "Right corner" }
      ]),
    ...(hasSelectedCorner
      ? [
        { effect: "cornerEntry" as const, label: "Entry" },
        { effect: "cornerMid" as const, label: "Mid-corner" },
        { effect: "cornerExit" as const, label: "Exit" }
      ]
      : [])
  ];

  return (
    <div className="pointer-events-none absolute bottom-3 left-3 flex max-w-[calc(100%-1.5rem)] flex-wrap gap-x-3 gap-y-1.5 rounded-md border border-white/10 bg-[#070a09]/75 px-3 py-2 text-[11px] font-bold text-[#c7d0cb] backdrop-blur">
      {items.map((item) => (
        <span key={item.effect} className="flex items-center gap-1.5">
          <span className={`h-2 w-4 rounded-full ${mapPathSwatchClass(item.effect)}`} />
          {item.label}
        </span>
      ))}
      {hasSelectedPoint && !hasSelectedCorner ? (
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-4 rounded-full border border-[#f3d09b] bg-[#f3d09b]/20" />
          Pinned sample
        </span>
      ) : null}
    </div>
  );
}
