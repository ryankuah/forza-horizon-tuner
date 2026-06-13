import * as React from "react";
import { Activity, BarChart3, Clock3, Gauge } from "lucide-react";
import { CarDataPanel } from "./CarVisuals";
import { BehaviorPanel } from "./TuningBehaviorPanel";
import type { AppState, DocTelemetrySection, Telemetry, RightPanelTab } from "@/types/telemetry";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatValue, shortSessionId, tuningStatusLabel } from "@/lib/format";
import { docTelemetrySections } from "./telemetryFields";
import { DataCell, TelemetryGroup } from "./TelemetryPanelPrimitives";

export function TelemetrySidePanel({
  activeTab,
  onTabChange,
  telemetry,
  samples,
  state
}: {
  activeTab: RightPanelTab;
  onTabChange: (tab: RightPanelTab) => void;
  telemetry: Telemetry | null;
  samples: Telemetry[];
  state: AppState;
}) {
  const tabs: { id: RightPanelTab; label: string; icon: React.ReactNode }[] = [
    { id: "car", label: "Car", icon: <Gauge size={16} /> },
    { id: "behavior", label: "Behavior", icon: <BarChart3 size={16} /> },
    { id: "data", label: "Data", icon: <Activity size={16} /> }
  ];

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col bg-transparent p-2" aria-label="Telemetry details">
      <Tabs value={activeTab} onValueChange={(value) => onTabChange(value as RightPanelTab)} className="h-full min-h-0 min-w-0 flex-1 gap-3">
        <TabsList className="shrink-0 self-start">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className="gap-2 px-3">
              {tab.icon}
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <div className="min-h-0 min-w-0 flex-1">
          <TabsContent value="car" className="m-0 h-full min-h-0 min-w-0">
            <CarDataPanel telemetry={telemetry} />
          </TabsContent>
          <TabsContent value="behavior" className="m-0 h-full min-h-0 min-w-0">
            <BehaviorPanel samples={samples} />
          </TabsContent>
          <TabsContent value="data" className="m-0 h-full min-h-0 min-w-0">
            <TelemetryDashboard telemetry={telemetry} state={state} />
          </TabsContent>
        </div>
      </Tabs>
    </section>
  );
}

export function TelemetryDashboard({
  telemetry,
  state
}: {
  telemetry: Telemetry | null;
  state: AppState;
}) {
  return (
    <div className="grid h-full min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] gap-4">
      <TelemetryGroup title="App info" icon={<Clock3 size={18} />}>
        <dl className="grid grid-cols-2 gap-x-5 gap-y-2 md:grid-cols-3">
          {[
            ["Connected", state.connected ? "yes" : "no"],
            ["Packets", state.packets],
            ["Bad packets", state.badPackets],
            ["Status", tuningStatusLabel(state.advice)],
            ["Samples", state.summary?.sampleCount ?? 0],
            ["Window", `${formatValue(state.summary?.windowSeconds ?? 0, { precision: 1 })} s`],
            ["UDP port", state.udpPort],
            ["Session", state.sessionId ? shortSessionId(state.sessionId) : "none"],
            ["Source", state.lastSource || "none"],
            ["Last packet", state.lastPacketAt ? new Date(state.lastPacketAt).toLocaleTimeString() : "none"],
            ["Local IPs", state.localIps.length ? state.localIps.join(", ") : "none"]
          ].map(([label, value]) => (
            <DataCell key={label} label={String(label)} value={value} />
          ))}
        </dl>
      </TelemetryGroup>

      <TelemetryGroup title="Raw game info" icon={<Activity size={18} />} className="min-h-0">
        <div className="grid min-h-0 min-w-0 auto-rows-min grid-cols-2 gap-x-5 gap-y-3 text-[12px] xl:grid-cols-3">
          {docTelemetrySections.map((section) => (
            <DocDataSection key={section.title} section={section} telemetry={telemetry} />
          ))}
        </div>
      </TelemetryGroup>
    </div>
  );
}

function DocDataSection({ section, telemetry }: { section: DocTelemetrySection; telemetry: Telemetry | null }) {
  return (
    <section className="min-w-0">
      <div className="mb-2 grid gap-1">
        <div className="flex min-w-0 items-center gap-2 text-xs font-semibold text-[#dbe5df]">
          <Activity size={16} />
          <span className="truncate">{section.title}</span>
        </div>
        <p className="m-0 text-xs leading-4 text-[#8f9a95]">{section.comment}</p>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {section.fields.map((field) => (
          <DataCell
            key={field.name}
            label={field.label}
            value={telemetry?.[field.name]}
            suffix={field.suffix}
            precision={field.precision}
            boolean={field.boolean}
          />
        ))}
      </dl>
    </section>
  );
}
