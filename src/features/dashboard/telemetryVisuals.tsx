import * as React from "react";
import { Activity, BarChart3, Clock3, Gauge } from "lucide-react";
import { CarDataPanel } from "./CarVisuals";
import { BehaviorPanel } from "./TuningBehaviorPanel";
import type { AppState, DocTelemetrySection, Telemetry, RightPanelTab } from "@/types/telemetry";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
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
    <Card className="flex h-full min-h-0 flex-col border-border bg-card/80 p-3">
      <Tabs value={activeTab} onValueChange={(value) => onTabChange(value as RightPanelTab)} className="min-h-0 flex-1 gap-3">
        <TabsList className="shrink-0">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className="gap-2 px-3">
              {tab.icon}
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <ScrollArea className="min-h-0 flex-1 pr-2">
          <TabsContent value="car" className="m-0 flex flex-col gap-4 pb-2">
            <CarDataPanel telemetry={telemetry} />
          </TabsContent>
          <TabsContent value="behavior" className="m-0 flex flex-col gap-4 pb-2">
            <BehaviorPanel samples={samples} />
          </TabsContent>
          <TabsContent value="data" className="m-0 flex flex-col gap-4 pb-2">
            <TelemetryDashboard telemetry={telemetry} state={state} />
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </Card>
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
    <div className="grid gap-[18px]">
      <TelemetryGroup title="App info" icon={<Clock3 size={18} />}>
        <dl className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
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

      <TelemetryGroup title="Raw game info" icon={<Activity size={18} />}>
        {docTelemetrySections.map((section) => (
          <DocDataSection key={section.title} section={section} telemetry={telemetry} />
        ))}
      </TelemetryGroup>
    </div>
  );
}

function DocDataSection({ section, telemetry }: { section: DocTelemetrySection; telemetry: Telemetry | null }) {
  return (
    <section className="grid gap-3">
      <div className="grid gap-1.5">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#dbe5df]">
          <Activity size={16} />
          {section.title}
        </div>
        <p className="m-0 text-sm leading-5 text-[#b5bfb9]">{section.comment}</p>
      </div>
      <dl className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-3">
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
