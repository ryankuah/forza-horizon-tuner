import { CarDataPanel } from "./CarVisuals";
import type { Telemetry } from "@/types/telemetry";

export function TelemetrySidePanel({
  telemetry
}: {
  telemetry: Telemetry | null;
}) {
  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col bg-transparent p-2" aria-label="Telemetry details">
      <CarDataPanel telemetry={telemetry} />
    </section>
  );
}
