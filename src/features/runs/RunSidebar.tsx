import * as React from "react";
import { Car, Check, ChevronDown, ChevronRight, Clock, Gauge, PanelLeftClose, PanelLeftOpen, Radio, RadioReceiver } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { drivetrainLabel, shortRunId } from "@/lib/format";
import type { CarCatalogItem, RunDateGroup, RunSelection, RunSummary, Telemetry } from "@/types/telemetry";

function formatRunTime(value: number | null | undefined) {
  if (!value) return "No packets";
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function formatDateGroup(value: number) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: date.getFullYear() === today.getFullYear() ? undefined : "numeric"
  });
}

function carClassLabel(value: number | null | undefined) {
  if (value === 0) return "D";
  if (value === 1) return "C";
  if (value === 2) return "B";
  if (value === 3) return "A";
  if (value === 4) return "S1";
  if (value === 5) return "S2";
  if (value === 6) return "X";
  return null;
}

function formatCar(
  run: Pick<RunSummary, "carOrdinal" | "carClass" | "carPerformanceIndex" | "drivetrainType">,
  carCatalogByOrdinal: Map<number, CarCatalogItem>
) {
  const catalogCar = run.carOrdinal === null || run.carOrdinal === undefined
    ? null
    : carCatalogByOrdinal.get(run.carOrdinal) ?? null;
  const carName = catalogCar?.carName ?? "Unknown car";
  const className = carClassLabel(run.carClass) ?? catalogCar?.carClass ?? null;
  const piLabel = run.carPerformanceIndex === null || run.carPerformanceIndex === undefined ? null : `PI ${run.carPerformanceIndex}`;
  const classLabel = className && run.carPerformanceIndex !== null && run.carPerformanceIndex !== undefined
    ? `${className} ${run.carPerformanceIndex}`
    : className;
  const drivetrain = run.drivetrainType === null || run.drivetrainType === undefined ? null : drivetrainLabel(run.drivetrainType);
  return [carName, classLabel ?? piLabel, drivetrain].filter(Boolean).join(" / ");
}

function formatDuration(item: Pick<RunSummary, "startedAt" | "endedAt" | "lastPacketAt">) {
  const start = item.startedAt;
  const end = item.endedAt ?? item.lastPacketAt;
  if (!end || end <= start) return "Open";

  const totalSeconds = Math.round((end - start) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

function splitReasonLabel(reason: string | null | undefined) {
  if (reason === "quick_travel") return "Quick travel";
  if (reason === "car_change") return "Car change";
  if (reason === "afk") return "AFK";
  if (reason === "telemetry_reset") return "Reset";
  if (reason === "udp_reconnect") return "Reconnect";
  return "Run";
}

export function RunSidebar({
  runGroups,
  carCatalogByOrdinal,
  activePage,
  selectedRunId,
  canSelectLive,
  liveRunId,
  liveTelemetry,
  livePackets,
  liveBadPackets,
  liveLastPacketAt,
  statusLabel,
  statusConnected,
  statusPackets,
  statusUdpPort,
  udpListening,
  isTogglingUdpListening,
  statusRunId,
  isCollapsed,
  onCollapsedChange,
  onPageChange,
  onRunChange,
  onToggleUdpListening
}: {
  runGroups: RunDateGroup[];
  carCatalogByOrdinal: Map<number, CarCatalogItem>;
  activePage: "runs" | "cars";
  selectedRunId: RunSelection;
  canSelectLive: boolean;
  liveRunId?: string;
  liveTelemetry?: Telemetry | null;
  livePackets?: number;
  liveBadPackets?: number;
  liveLastPacketAt?: number | null;
  statusLabel: string;
  statusConnected: boolean;
  statusPackets: number;
  statusUdpPort: number;
  udpListening: boolean;
  isTogglingUdpListening: boolean;
  statusRunId?: string;
  isCollapsed: boolean;
  onCollapsedChange: (isCollapsed: boolean) => void;
  onPageChange: (page: "runs" | "cars") => void;
  onRunChange: (runId: RunSelection) => void;
  onToggleUdpListening: () => void;
}) {
  const selectedValue = canSelectLive
    ? selectedRunId
    : selectedRunId === "live"
      ? runGroups[0]?.runs[0]?.id ?? "__none"
      : selectedRunId;

  function selectRun(runId: RunSelection | "__none") {
    if (runId === "__none") return;
    onRunChange(runId);
  }

  return (
    <aside
      className={cn(
        "flex h-screen shrink-0 flex-col border-r border-white/10 bg-[#242424] text-[#e7e7e7] transition-[width] duration-200 ease-out",
        isCollapsed ? "w-[132px]" : "w-[316px]"
      )}
      aria-label="Runs"
    >
      <div className="flex h-[62px] shrink-0 items-center justify-end px-3 [-webkit-app-region:drag]">
        <Button
          className={cn(
            "text-[#b6b6b6] hover:bg-white/10 hover:text-white [-webkit-app-region:no-drag]",
            isCollapsed && "-translate-y-1.5"
          )}
          variant="ghost"
          size="icon"
          type="button"
          onClick={() => onCollapsedChange(!isCollapsed)}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={18} />}
        </Button>
      </div>

      <SidebarPageNav activePage={activePage} isCollapsed={isCollapsed} onPageChange={onPageChange} />

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {isCollapsed ? (
          <CollapsedRuns
            runGroups={runGroups}
            selectedValue={selectedValue}
            canSelectLive={canSelectLive}
            onRunChange={selectRun}
          />
        ) : (
          <ExpandedRuns
            runGroups={runGroups}
            selectedValue={selectedValue}
            canSelectLive={canSelectLive}
            liveRunId={liveRunId}
            liveTelemetry={liveTelemetry}
            livePackets={livePackets}
            liveBadPackets={liveBadPackets}
            liveLastPacketAt={liveLastPacketAt}
            carCatalogByOrdinal={carCatalogByOrdinal}
            onRunChange={selectRun}
          />
        )}
      </div>

      <SidebarStatusFooter
        isCollapsed={isCollapsed}
        label={statusLabel}
        connected={statusConnected}
        packets={statusPackets}
        udpPort={statusUdpPort}
        udpListening={udpListening}
        isTogglingUdpListening={isTogglingUdpListening}
        runId={statusRunId}
        onToggleUdpListening={onToggleUdpListening}
      />
    </aside>
  );
}

function SidebarPageNav({
  activePage,
  isCollapsed,
  onPageChange
}: {
  activePage: "runs" | "cars";
  isCollapsed: boolean;
  onPageChange: (page: "runs" | "cars") => void;
}) {
  return (
    <nav className={cn("shrink-0 px-2 pb-4", isCollapsed && "px-3")} aria-label="Primary pages">
      <div className="grid gap-1">
        <button
          className={cn(
            "flex h-10 items-center rounded-lg text-sm font-medium transition",
            isCollapsed ? "justify-center px-0" : "justify-start gap-3 px-3",
            activePage === "cars"
              ? "bg-white/10 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]"
              : "text-[#b8b8b8] hover:bg-white/8 hover:text-[#ededed]"
          )}
          type="button"
          onClick={() => onPageChange("cars")}
          aria-current={activePage === "cars" ? "page" : undefined}
          aria-label="Cars"
          title="Cars"
        >
          <Gauge size={18} />
          {!isCollapsed ? <span>Cars</span> : null}
        </button>
      </div>
    </nav>
  );
}

function SidebarStatusFooter({
  isCollapsed,
  label,
  connected,
  packets,
  udpPort,
  udpListening,
  isTogglingUdpListening,
  runId,
  onToggleUdpListening
}: {
  isCollapsed: boolean;
  label: string;
  connected: boolean;
  packets: number;
  udpPort: number;
  udpListening: boolean;
  isTogglingUdpListening: boolean;
  runId?: string;
  onToggleUdpListening: () => void;
}) {
  const listenerLabel = udpListening ? "Listening" : "Paused";

  return (
    <div className="shrink-0 border-t border-white/10 px-3 py-3">
      {isCollapsed ? (
        <div className="grid justify-items-center gap-2 text-center">
          <Button
            className={cn(
              "size-9 border-white/10 text-[#d8d8d8] hover:bg-white/10 hover:text-white",
              udpListening ? "bg-[#4cc38a]/15 text-[#70e0a6]" : "bg-white/[0.04]"
            )}
            variant="outline"
            size="icon"
            type="button"
            disabled={isTogglingUdpListening}
            onClick={onToggleUdpListening}
            aria-pressed={udpListening}
            aria-label={udpListening ? `Stop listening on UDP ${udpPort}` : `Start listening on UDP ${udpPort}`}
            title={udpListening ? `Stop UDP ${udpPort}` : `Listen on UDP ${udpPort}`}
          >
            <RadioReceiver size={16} />
          </Button>
          <div
            className={cn("h-2 w-2 rounded-full", connected ? "bg-[#70e0a6]" : udpListening ? "bg-[#d4a94f]" : "bg-[#8f8f8f]")}
            title={connected ? "Connected" : listenerLabel}
          />
          <div className="max-w-full truncate font-mono text-[10px] text-[#8f8f8f]">
            {runId ? shortRunId(runId) : "No run"}
          </div>
        </div>
      ) : (
        <div className="grid gap-2">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <div className="truncate text-[13px] font-medium text-[#ededed]">{label}</div>
            <div className="shrink-0 font-mono text-xs text-[#8f8f8f]">{runId ? shortRunId(runId) : "No run"}</div>
          </div>
          <div className="flex min-w-0 items-center gap-2 text-xs text-[#8f8f8f]">
            <span>{connected ? "Connected" : "Idle"}</span>
            <span className="text-[#555]">/</span>
            <span>{packets.toLocaleString()} packets</span>
            <span className="text-[#555]">/</span>
            <span>UDP {udpPort}</span>
          </div>
          <Button
            className={cn(
              "h-8 w-full justify-start border-white/10 px-2.5 text-xs",
              udpListening
                ? "bg-[#4cc38a]/15 text-[#70e0a6] hover:bg-[#4cc38a]/20 hover:text-[#8af0b8]"
                : "bg-white/[0.04] text-[#cfcfcf] hover:bg-white/10 hover:text-white"
            )}
            variant="outline"
            size="sm"
            type="button"
            disabled={isTogglingUdpListening}
            onClick={onToggleUdpListening}
            aria-pressed={udpListening}
          >
            <RadioReceiver size={14} />
            <span>{udpListening ? "Stop listening" : "Listen on UDP"}</span>
          </Button>
        </div>
      )}
    </div>
  );
}

function ExpandedRuns({
  runGroups,
  selectedValue,
  canSelectLive,
  liveRunId,
  liveTelemetry,
  livePackets,
  liveBadPackets,
  liveLastPacketAt,
  carCatalogByOrdinal,
  onRunChange
}: {
  runGroups: RunDateGroup[];
  selectedValue: RunSelection | "__none";
  canSelectLive: boolean;
  liveRunId?: string;
  liveTelemetry?: Telemetry | null;
  livePackets?: number;
  liveBadPackets?: number;
  liveLastPacketAt?: number | null;
  carCatalogByOrdinal: Map<number, CarCatalogItem>;
  onRunChange: (runId: RunSelection | "__none") => void;
}) {
  const [expandedDateKeys, setExpandedDateKeys] = React.useState<Set<string>>(() => new Set(runGroups.slice(0, 2).map((group) => group.dateKey)));

  React.useEffect(() => {
    setExpandedDateKeys((current) => {
      const next = new Set(current);
      for (const group of runGroups) {
        if (group.runs.some((run) => run.id === selectedValue)) next.add(group.dateKey);
      }
      if (next.size === 0 && runGroups[0]) next.add(runGroups[0].dateKey);
      return next;
    });
  }, [selectedValue, runGroups]);

  function toggleDate(dateKey: string) {
    setExpandedDateKeys((current) => {
      const next = new Set(current);
      if (next.has(dateKey)) next.delete(dateKey);
      else next.add(dateKey);
      return next;
    });
  }

  return (
    <div className="grid gap-5">
      {canSelectLive ? (
        <div className="grid gap-1">
          <div className="px-3 pb-1 text-xs font-medium text-[#8e8e8e]">Live</div>
          <button
            className={cn(
              "w-full rounded-lg px-3 py-2.5 text-left transition hover:bg-white/8",
              selectedValue === "live" ? "bg-white/10 text-white" : "text-[#d0d0d0]"
            )}
            type="button"
            onClick={() => onRunChange("live")}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2 text-sm font-medium">
                <Radio size={15} />
                <span className="truncate">Live telemetry</span>
              </div>
              {selectedValue === "live" ? <Check size={15} /> : <Badge className="h-5 bg-[#4cc38a]/15 text-[#70e0a6]">Live</Badge>}
            </div>
            <div className="mt-1 truncate pl-6 text-xs text-[#8f8f8f]">
              {liveRunId ? `Run ${shortRunId(liveRunId)}` : "Waiting for run"}
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 pl-6 text-xs text-[#8f8f8f]">
              <span>{(livePackets ?? 0).toLocaleString()} pkt</span>
              <span>{(liveBadPackets ?? 0).toLocaleString()} bad</span>
              <span className="truncate">{formatRunTime(liveLastPacketAt)}</span>
            </div>
            <div className="mt-1 truncate pl-6 text-xs text-[#8f8f8f]">
              {liveTelemetry
                ? formatCar({
                  carOrdinal: liveTelemetry.CarOrdinal,
                  carClass: liveTelemetry.CarClass,
                  carPerformanceIndex: liveTelemetry.CarPerformanceIndex,
                  drivetrainType: liveTelemetry.DrivetrainType
                }, carCatalogByOrdinal)
                : "No car telemetry"}
            </div>
          </button>
        </div>
      ) : null}

      <div className="grid gap-1">
        <div className="px-3 pb-1 text-xs font-medium text-[#8e8e8e]">Runs</div>
        {runGroups.map((group) => {
          const { runs } = group;
          const isExpanded = expandedDateKeys.has(group.dateKey);
          const selectedInside = runs.some((run) => run.id === selectedValue);
          const packetCount = runs.reduce((total, run) => total + run.packetCount, 0);
          const badPacketCount = runs.reduce((total, run) => total + run.badPacketCount, 0);
          return (
            <div key={group.dateKey} className="grid gap-1">
              <button
                className={cn(
                  "w-full rounded-lg px-2.5 py-2 text-left transition hover:bg-white/8",
                  selectedInside ? "bg-white/[0.07] text-white" : "text-[#d0d0d0]"
                )}
                type="button"
                onClick={() => toggleDate(group.dateKey)}
                aria-expanded={isExpanded}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                    <span className="truncate text-sm font-medium">{formatDateGroup(group.dateStart)}</span>
                  </div>
                  <Badge className="h-5 bg-white/8 text-[#bdbdbd]">{runs.length}</Badge>
                </div>
                <div className="mt-1 flex items-center gap-3 pl-6 text-xs text-[#8f8f8f]">
                  <span>{packetCount.toLocaleString()} pkt</span>
                  <span>{runs.length === 1 ? "1 run" : `${runs.length} runs`}</span>
                  <span>{badPacketCount.toLocaleString()} bad</span>
                </div>
              </button>

              {isExpanded ? (
                <div className="grid gap-1 pl-4">
                  {runs.map((run, index) => (
                    <RunButton
                      key={run.id}
                      run={run}
                      index={runs.length - index}
                      isSelected={selectedValue === run.id}
                      carCatalogByOrdinal={carCatalogByOrdinal}
                      onSelect={() => onRunChange(run.id)}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}

        {!canSelectLive && runGroups.length === 0 ? (
          <div className="px-3 py-2 text-sm text-[#8f8f8f]">No saved runs yet.</div>
        ) : null}
      </div>
    </div>
  );
}

function RunButton({
  run,
  index,
  isSelected,
  carCatalogByOrdinal,
  onSelect
}: {
  run: RunSummary;
  index: number;
  isSelected: boolean;
  carCatalogByOrdinal: Map<number, CarCatalogItem>;
  onSelect: () => void;
}) {
  return (
    <button
      className={cn(
        "w-full rounded-lg px-3 py-2.5 text-left transition hover:bg-white/8",
        isSelected ? "bg-white/10 text-white" : "text-[#d0d0d0]"
      )}
      type="button"
      onClick={onSelect}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 truncate text-sm font-medium">Run {index}</div>
        {isSelected ? <Check size={15} /> : <span className="text-xs text-[#8f8f8f]">{splitReasonLabel(run.splitReason)}</span>}
      </div>
      <div className="mt-1 flex min-w-0 items-center gap-2 text-xs text-[#8f8f8f]">
        <Car size={13} />
        <span className="truncate">{formatCar(run, carCatalogByOrdinal)}</span>
      </div>
      <div className="mt-2 flex items-center gap-3 text-xs text-[#8f8f8f]">
        <span>{run.packetCount.toLocaleString()} pkt</span>
        <span>{formatDuration(run)}</span>
        <span>{run.badPacketCount.toLocaleString()} bad</span>
      </div>
      <div className="mt-1 flex items-center gap-2 text-xs text-[#8f8f8f]">
        <Clock size={13} />
        <span className="truncate">{shortRunId(run.id)}</span>
      </div>
    </button>
  );
}

function CollapsedRuns({
  runGroups,
  selectedValue,
  canSelectLive,
  onRunChange
}: {
  runGroups: RunDateGroup[];
  selectedValue: RunSelection | "__none";
  canSelectLive: boolean;
  onRunChange: (runId: RunSelection | "__none") => void;
}) {
  const visibleRuns = runGroups.flatMap(({ runs }) => runs).slice(0, 10);

  return (
    <div className="flex flex-col items-center gap-2">
      {canSelectLive ? (
        <button
          className={cn(
            "flex size-10 items-center justify-center rounded-lg transition hover:bg-white/8",
            selectedValue === "live" ? "bg-white/10 text-white" : "text-[#bdbdbd]"
          )}
          type="button"
          onClick={() => onRunChange("live")}
          aria-label="Live telemetry"
        >
          <Radio size={17} />
        </button>
      ) : null}
      {visibleRuns.map((run) => (
        <button
          key={run.id}
          className={cn(
            "flex size-10 items-center justify-center rounded-lg text-xs font-medium transition hover:bg-white/8",
            selectedValue === run.id ? "bg-white/10 text-white" : "text-[#bdbdbd]"
          )}
          type="button"
          onClick={() => onRunChange(run.id)}
          aria-label={`Run ${shortRunId(run.id)}`}
        >
          {new Date(run.startedAt).getDate()}
        </button>
      ))}
    </div>
  );
}
